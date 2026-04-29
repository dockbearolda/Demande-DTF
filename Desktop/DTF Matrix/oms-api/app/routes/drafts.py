"""Routes for order drafts (« brouillons »).

Storage = one JSON file per draft in `settings.DRAFTS_DIR`. The folder is
expected to live inside a Dropbox-synced directory in production so multiple
posts can pick up the same drafts. Writes are atomic (write to a temp file in
the same directory, fsync, rename) so a Dropbox client never observes a
half-written file.

We keep the model intentionally dumb: the payload is opaque JSON, summary
fields are extracted from the upsert body (computed client-side) and stored
alongside it. This avoids coupling the API to the wizard's internal shape.
"""
from __future__ import annotations

import json
import logging
import os
import re
import tempfile
import uuid
from datetime import datetime, timezone
from pathlib import Path

from fastapi import APIRouter, HTTPException, status

from app.config import settings
from app.schemas.draft import DraftRead, DraftSummary, DraftUpsert

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/drafts", tags=["drafts"])


# ───────── Helpers ─────────


_ID_RE = re.compile(r"^[A-Za-z0-9_-]{1,64}$")


def _drafts_dir() -> Path:
    """Resolve and ensure the drafts directory exists. Cheap to call on every
    request — `mkdir(exist_ok=True)` is a single stat + maybe-mkdir.

    Garde-fou : si la variable est vide ou ne contient que des espaces, on
    refuse plutôt que d'écrire dans le `cwd` du process (comportement par
    défaut de `Path("").resolve()` qui surprend silencieusement)."""
    raw = (settings.DRAFTS_DIR or "").strip()
    if not raw:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="DRAFTS_DIR is not configured",
        )
    p = Path(raw).expanduser().resolve()
    p.mkdir(parents=True, exist_ok=True)
    return p


def _validate_id(draft_id: str) -> None:
    """Refuse anything that could escape the directory (path traversal) or
    contain characters that break Dropbox sync (spaces, slashes, …)."""
    if not _ID_RE.match(draft_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid draft id (allowed: letters, digits, _ and -, max 64 chars)",
        )


def _path_for(draft_id: str) -> Path:
    base = _drafts_dir()
    candidate = (base / f"{draft_id}.json").resolve()
    # Defense-in-depth : la regex `_validate_id` interdit déjà / et . — cette
    # vérification supplémentaire garantit qu'aucune réécriture ne sort de
    # `base`, même si la regex évolue ou si le filesystem fait du symlinking.
    try:
        candidate.relative_to(base)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid draft path",
        ) from exc
    return candidate


def _read_draft(path: Path) -> dict | None:
    """Return the raw record stored on disk, or None if the file is missing
    or corrupted (logged at warning — not an error since the user can simply
    save again)."""
    try:
        with path.open("r", encoding="utf-8") as fh:
            return json.load(fh)
    except FileNotFoundError:
        return None
    except (OSError, json.JSONDecodeError) as exc:
        logger.warning("draft_read_failed path=%s err=%s", path, exc)
        return None


def _atomic_write(path: Path, record: dict) -> None:
    """Write `record` to `path` atomically via temp + rename in the same dir.

    Same-directory rename is atomic on POSIX and survives Dropbox sync — the
    sync client either sees the previous file or the new one, never a partial
    write."""
    parent = path.parent
    parent.mkdir(parents=True, exist_ok=True)
    fd, tmp_path = tempfile.mkstemp(prefix=".draft-", suffix=".tmp", dir=str(parent))
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as fh:
            json.dump(record, fh, ensure_ascii=False, indent=2)
            fh.flush()
            os.fsync(fh.fileno())
        os.replace(tmp_path, path)
    except Exception:
        # Best-effort cleanup of the temp file; re-raise so the caller can
        # surface a 500 to the client.
        try:
            os.unlink(tmp_path)
        except OSError:
            pass
        raise


def _to_summary(record: dict, draft_id: str) -> DraftSummary:
    return DraftSummary(
        id=draft_id,
        client_name=record.get("client_name"),
        item_count=int(record.get("item_count") or 0),
        reference_count=int(record.get("reference_count") or 0),
        last_step=int(record.get("last_step") or 1),
        quote_id=record.get("quote_id"),
        created_at=datetime.fromisoformat(record["created_at"]),
        updated_at=datetime.fromisoformat(record["updated_at"]),
    )


# ───────── Endpoints ─────────


@router.get("", response_model=list[DraftSummary])
async def list_drafts() -> list[DraftSummary]:
    """List all stored drafts, most-recently-modified first.

    Reads every JSON file in the drafts directory — fine for the realistic
    upper bound (a few hundred drafts max). If that ever grows, we'll add an
    index file."""
    out: list[DraftSummary] = []
    for path in _drafts_dir().glob("*.json"):
        if path.name.startswith(".draft-"):
            continue  # skip any orphan temp files
        draft_id = path.stem
        record = _read_draft(path)
        if record is None:
            continue
        try:
            out.append(_to_summary(record, draft_id))
        except (KeyError, ValueError) as exc:
            logger.warning("draft_summary_failed id=%s err=%s", draft_id, exc)
    out.sort(key=lambda d: d.updated_at, reverse=True)
    return out


@router.get("/{draft_id}", response_model=DraftRead)
async def get_draft(draft_id: str) -> DraftRead:
    _validate_id(draft_id)
    record = _read_draft(_path_for(draft_id))
    if record is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Draft not found")
    return DraftRead(
        id=draft_id,
        payload=record.get("payload", {}),
        client_name=record.get("client_name"),
        item_count=int(record.get("item_count") or 0),
        reference_count=int(record.get("reference_count") or 0),
        last_step=int(record.get("last_step") or 1),
        quote_id=record.get("quote_id"),
        created_at=datetime.fromisoformat(record["created_at"]),
        updated_at=datetime.fromisoformat(record["updated_at"]),
    )


@router.put("/{draft_id}", response_model=DraftRead)
async def upsert_draft(draft_id: str, body: DraftUpsert) -> DraftRead:
    """Upsert: create the draft if missing, overwrite otherwise. The id is
    chosen by the client (uuid generated when the wizard opens) so the same
    draft survives reloads without a server-roundtrip to learn its id."""
    _validate_id(draft_id)
    path = _path_for(draft_id)
    now = datetime.now(timezone.utc).isoformat()
    existing = _read_draft(path)
    created_at = (existing or {}).get("created_at") if existing else now
    record = {
        "id": draft_id,
        "payload": body.payload,
        "client_name": body.client_name,
        "item_count": body.item_count,
        "reference_count": body.reference_count,
        "last_step": body.last_step,
        "quote_id": body.quote_id,
        "created_at": created_at,
        "updated_at": now,
    }
    try:
        _atomic_write(path, record)
    except OSError as exc:
        logger.exception("draft_write_failed id=%s err=%s", draft_id, exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to persist draft",
        )
    return DraftRead(
        id=draft_id,
        payload=body.payload,
        client_name=body.client_name,
        item_count=body.item_count,
        reference_count=body.reference_count,
        last_step=body.last_step,
        quote_id=body.quote_id,
        created_at=datetime.fromisoformat(created_at),
        updated_at=datetime.fromisoformat(now),
    )


@router.delete("/{draft_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_draft(draft_id: str) -> None:
    _validate_id(draft_id)
    path = _path_for(draft_id)
    try:
        path.unlink()
    except FileNotFoundError:
        # Idempotent — deleting a non-existent draft is fine.
        return
    except OSError as exc:
        logger.exception("draft_delete_failed id=%s err=%s", draft_id, exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete draft",
        )


@router.post("/_new_id", response_model=dict)
async def new_id() -> dict[str, str]:
    """Convenience endpoint: returns a fresh uuid for a new draft. The client
    can also generate one locally (`crypto.randomUUID()`) — kept here so a
    server-controlled id is reachable when needed (e.g. tests)."""
    return {"id": uuid.uuid4().hex}
