import json
import logging
import secrets
import time
import uuid
from collections import defaultdict, deque
from datetime import datetime, timedelta, timezone
from pathlib import Path

from fastapi import (
    APIRouter,
    Depends,
    File,
    Form,
    HTTPException,
    Request,
    UploadFile,
    status,
)
from fastapi.responses import HTMLResponse, Response
from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.models.bat import Bat, BatStatus
from app.models.client import Client
from app.models.order import Order, OrderStatus
from app.schemas.bat import (
    BatDecision,
    BatLinkRequest,
    BatRead,
    BatSearchResult,
    BatUploadResponse,
)
from sqlalchemy import func as sa_func, or_
from app.services.email_service import (
    render_template,
    send_bat_client_email,
    send_bat_decision_email,
)
from app.services.storage_service import get_storage, validate_mime_type
from app.services.webhook_service import emit_webhook

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/bat", tags=["bat"])


# ---------- Rate limiting (in-memory, best-effort) ----------
# Sliding window per client IP on /bat/validate/* endpoints.
#
# Limites de cette implémentation (volontaires — pas critique pour ce flow) :
# - in-memory : ne survit pas à un restart, et chaque worker a son propre dict ;
# - GC périodique : on nettoie les buckets vides quand on traverse plus de
#   `_RATE_GC_THRESHOLD` IPs distinctes pour éviter la croissance non bornée.
# Un vrai rate-limiter (Redis token bucket, par exemple) viendra avec l'auth.
_RATE_WINDOW = 60.0  # seconds
_RATE_MAX = 30       # requests per window per IP
_RATE_GC_THRESHOLD = 1024  # nb d'IPs distinctes avant GC opportuniste
_rate_buckets: dict[str, deque[float]] = defaultdict(deque)


def _rate_limit_gc(now: float) -> None:
    """Purge les buckets vides + ceux dont la dernière requête remonte à
    plus de `_RATE_WINDOW`. O(n) mais déclenché rarement (1 fois sur 1024)."""
    stale: list[str] = []
    for ip, bucket in _rate_buckets.items():
        while bucket and (now - bucket[0]) > _RATE_WINDOW:
            bucket.popleft()
        if not bucket:
            stale.append(ip)
    for ip in stale:
        _rate_buckets.pop(ip, None)


def _rate_limit(request: Request) -> None:
    ip = request.client.host if request.client else "unknown"
    now = time.monotonic()
    if len(_rate_buckets) > _RATE_GC_THRESHOLD:
        _rate_limit_gc(now)
    bucket = _rate_buckets[ip]
    while bucket and (now - bucket[0]) > _RATE_WINDOW:
        bucket.popleft()
    if len(bucket) >= _RATE_MAX:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many requests",
        )
    bucket.append(now)


# ---------- Helpers ----------
async def _get_bat_by_token(db: AsyncSession, token: str) -> Bat:
    result = await db.execute(select(Bat).where(Bat.token == token))
    bat = result.scalar_one_or_none()
    if not bat:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="BAT not found")
    return bat


def _now_utc() -> datetime:
    return datetime.now(timezone.utc)


def _is_expired(bat: Bat) -> bool:
    expires = bat.expires_at
    if expires.tzinfo is None:
        expires = expires.replace(tzinfo=timezone.utc)
    return _now_utc() > expires


async def _get_order_client(db: AsyncSession, order_id: uuid.UUID) -> tuple[Order, Client]:
    result = await db.execute(
        select(Order, Client)
        .join(Client, Client.id == Order.client_id)
        .where(Order.id == order_id, Order.is_deleted.is_(False))
    )
    row = result.one_or_none()
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found")
    return row[0], row[1]


# ---------- Admin: upload ----------
@router.post(
    "/upload",
    response_model=BatUploadResponse,
    status_code=status.HTTP_201_CREATED,
)
async def upload_bat(
    order_id: uuid.UUID = Form(...),
    message: str | None = Form(default=None),
    composition: str | None = Form(default=None),
    model_reference: str | None = Form(default=None),
    color_id: str | None = Form(default=None),
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
) -> BatUploadResponse:
    order, client = await _get_order_client(db, order_id)

    # MIME validation
    try:
        ext = validate_mime_type(file.content_type)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))

    # Composition metadata (JSON string) — validate parseable if provided
    composition_json: str | None = None
    if composition is not None and composition.strip():
        try:
            parsed = json.loads(composition)
        except json.JSONDecodeError as exc:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid composition JSON: {exc}",
            )
        if not isinstance(parsed, dict):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="composition must be a JSON object",
            )
        composition_json = json.dumps(parsed, separators=(",", ":"))

    # Size validation (read fully; FastAPI's SpooledTemporaryFile handles memory safely)
    content = await file.read()
    max_bytes = settings.BAT_MAX_UPLOAD_MB * 1024 * 1024
    if len(content) == 0:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Empty file")
    if len(content) > max_bytes:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File too large (max {settings.BAT_MAX_UPLOAD_MB} MB)",
        )

    bat_uuid = uuid.uuid4()
    token = secrets.token_urlsafe(32)
    relative_key = f"{bat_uuid}.{ext}"

    storage = get_storage()
    stored_path = await storage.save(relative_key, content)

    expires_at = _now_utc() + timedelta(days=settings.BAT_EXPIRATION_DAYS)

    # ─── Versioning: find latest version for (order, model_ref, color) ───
    # If a previous BAT exists with the same logical key, increment version
    # and link via parent_bat_id (chain to the previous head). When the
    # frontend doesn't supply model_reference / color_id, treat it as a
    # standalone BAT (version=1, parent=None).
    parent_id: uuid.UUID | None = None
    next_version: int = 1
    if model_reference and color_id:
        prev_q = await db.execute(
            select(Bat)
            .where(
                and_(
                    Bat.order_id == order.id,
                    Bat.model_reference == model_reference,
                    Bat.color_id == color_id,
                )
            )
            .order_by(Bat.version.desc())
            .limit(1)
        )
        prev = prev_q.scalar_one_or_none()
        if prev is not None:
            parent_id = prev.id
            next_version = (prev.version or 0) + 1

    bat = Bat(
        id=bat_uuid,
        order_id=order.id,
        token=token,
        file_path=stored_path,
        file_type=ext,
        file_name=file.filename or relative_key,
        message=message,
        status=BatStatus.PENDING,
        expires_at=expires_at,
        composition_metadata=composition_json,
        version=next_version,
        parent_bat_id=parent_id,
        model_reference=model_reference,
        color_id=color_id,
    )
    db.add(bat)

    # Move order to BAT_SENT
    order.statut = OrderStatus.BAT_SENT
    await db.commit()
    await db.refresh(bat)

    validation_url = f"{settings.BAT_PUBLIC_BASE_URL.rstrip('/')}/bat/validate/{token}"

    if client.email:
        await send_bat_client_email(
            to=client.email,
            order_reference=order.reference,
            client_name=client.nom,
            validation_url=validation_url,
            message=message,
        )
    else:
        logger.warning(
            "bat_uploaded_without_client_email",
            extra={"bat_id": str(bat.id), "order_id": str(order.id)},
        )

    return BatUploadResponse(
        bat_id=bat.id, validation_url=validation_url, expires_at=bat.expires_at
    )


# ---------- Public: HTML validation page ----------
@router.get("/validate/{token}", response_class=HTMLResponse)
async def get_validation_page(
    token: str,
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> HTMLResponse:
    _rate_limit(request)
    bat = await _get_bat_by_token(db, token)
    order, client = await _get_order_client(db, bat.order_id)

    # Expire silently if the deadline has passed and still pending
    display_status = bat.status
    if bat.status == BatStatus.PENDING and _is_expired(bat):
        bat.status = BatStatus.EXPIRED
        await db.commit()
        display_status = BatStatus.EXPIRED

    file_url = f"{settings.BAT_PUBLIC_BASE_URL.rstrip('/')}/bat/file/{token}"

    html = render_template(
        "bat_validation.html",
        token=token,
        order_reference=order.reference,
        client_name=client.nom,
        created_at=bat.created_at,
        expires_at=bat.expires_at,
        status=display_status.value,
        file_url=file_url,
        file_type=bat.file_type,
        message=bat.message,
    )
    return HTMLResponse(content=html)


# ---------- Public: serve the BAT file by token ----------
@router.get("/file/{token}")
async def get_bat_file(
    token: str,
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> Response:
    _rate_limit(request)
    bat = await _get_bat_by_token(db, token)
    if _is_expired(bat) and bat.status == BatStatus.PENDING:
        bat.status = BatStatus.EXPIRED
        await db.commit()

    storage = get_storage()
    relative_key = Path(bat.file_path).name
    content = await storage.read(relative_key)

    mime_map = {"pdf": "application/pdf", "png": "image/png", "jpg": "image/jpeg"}
    media_type = mime_map.get(bat.file_type, "application/octet-stream")
    return Response(content=content, media_type=media_type)


# ---------- Public: decision webhook ----------
@router.post("/validate/{token}/decision", response_model=BatRead)
async def post_decision(
    token: str,
    payload: BatDecision,
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> Bat:
    _rate_limit(request)
    bat = await _get_bat_by_token(db, token)

    # Idempotency: one decision per BAT
    if bat.status != BatStatus.PENDING:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"BAT already in status {bat.status.value}",
        )

    if _is_expired(bat):
        bat.status = BatStatus.EXPIRED
        await db.commit()
        raise HTTPException(status_code=status.HTTP_410_GONE, detail="BAT link expired")

    if payload.decision == "rejected" and not (payload.comment or "").strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A comment is required when requesting modifications",
        )

    order, client = await _get_order_client(db, bat.order_id)

    ip = request.client.host if request.client else None
    ua = request.headers.get("user-agent")

    if payload.decision == "approved":
        bat.status = BatStatus.APPROVED
        order.statut = OrderStatus.BAT_APPROVED
    else:
        bat.status = BatStatus.REJECTED
        order.statut = OrderStatus.CONFIRMED

    bat.decision_comment = payload.comment
    bat.decided_at = _now_utc()
    bat.decided_ip = ip
    bat.decided_user_agent = ua[:500] if ua else None

    logger.info(
        "bat_decision",
        extra={
            "bat_id": str(bat.id),
            "order_id": str(order.id),
            "decision": payload.decision,
            "ip": ip,
            "user_agent": ua,
        },
    )

    await db.commit()
    await db.refresh(bat)

    # Notify team + emit outbound webhook
    await send_bat_decision_email(
        order_reference=order.reference,
        decision=payload.decision,
        comment=payload.comment,
        client_name=client.nom,
    )
    await emit_webhook(
        event=f"bat.{payload.decision}",
        data={
            "bat_id": str(bat.id),
            "order_id": str(order.id),
            "order_reference": order.reference,
            "client_id": str(client.id),
            "decision": payload.decision,
            "comment": payload.comment,
            "decided_at": bat.decided_at.isoformat(),
        },
    )

    return bat


# ---------- Admin: consult ----------
@router.get("/{bat_id}", response_model=BatRead)
async def get_bat(
    bat_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
) -> Bat:
    result = await db.execute(select(Bat).where(Bat.id == bat_id))
    bat = result.scalar_one_or_none()
    if not bat:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="BAT not found")
    return bat


# ---------- Admin: search existing BATs (for reuse picker) ----------
@router.get("/search/list", response_model=list[BatSearchResult])
async def search_bats(
    client_id: uuid.UUID | None = None,
    model_reference: str | None = None,
    color_id: str | None = None,
    query: str | None = None,
    days: int = 365,
    limit: int = 50,
    db: AsyncSession = Depends(get_db),
) -> list[BatSearchResult]:
    """Search BATs eligible for reuse on a new order.

    Filters by client (most common), model reference, color id, free-text on
    order reference / client name / file name. Default window: 1 year.
    """
    cutoff = _now_utc() - timedelta(days=max(days, 1))
    stmt = (
        select(Bat, Order, Client)
        .join(Order, Order.id == Bat.order_id)
        .join(Client, Client.id == Order.client_id)
        .where(
            Bat.created_at >= cutoff,
            Order.is_deleted.is_(False),
            # Only successful BATs are eligible for reuse
            Bat.status.in_([BatStatus.APPROVED, BatStatus.PENDING]),
        )
    )
    if client_id is not None:
        stmt = stmt.where(Order.client_id == client_id)
    if model_reference:
        stmt = stmt.where(Bat.model_reference == model_reference)
    if color_id:
        stmt = stmt.where(Bat.color_id == color_id)
    if query:
        like = f"%{query.strip()}%"
        stmt = stmt.where(
            or_(
                Order.reference.ilike(like),
                Client.nom.ilike(like),
                Bat.file_name.ilike(like),
            )
        )
    stmt = stmt.order_by(Bat.created_at.desc()).limit(limit)
    result = await db.execute(stmt)
    rows = result.all()

    # « Popularité » d'un BAT = nombre de commandes distinctes partageant la
    # même clé (model_reference, color_id, file_name). On batch toutes les
    # clés des résultats en UNE seule requête `GROUP BY` au lieu d'un COUNT
    # par ligne (anciennement N+1, ~50 round-trips à limit=50).
    keyed: list[tuple[str, str, str]] = [
        (bat.model_reference, bat.color_id, bat.file_name)
        for bat, _o, _c in rows
        if bat.model_reference and bat.color_id
    ]
    counts: dict[tuple[str, str, str], int] = {}
    if keyed:
        # Filtrage pré-aggrégat sur l'union des clés présentes — chaque ligne
        # de résultat est une (model_reference, color_id, file_name, count).
        keys_set = set(keyed)
        models = {k[0] for k in keys_set}
        colors = {k[1] for k in keys_set}
        names = {k[2] for k in keys_set}
        agg_stmt = (
            select(
                Bat.model_reference,
                Bat.color_id,
                Bat.file_name,
                sa_func.count(sa_func.distinct(Bat.order_id)),
            )
            .where(
                Bat.model_reference.in_(models),
                Bat.color_id.in_(colors),
                Bat.file_name.in_(names),
            )
            .group_by(Bat.model_reference, Bat.color_id, Bat.file_name)
        )
        agg_rows = await db.execute(agg_stmt)
        for mr, ci, fn, cnt in agg_rows.all():
            counts[(mr, ci, fn)] = int(cnt or 1)

    out: list[BatSearchResult] = []
    base_url = settings.BAT_PUBLIC_BASE_URL.rstrip("/")
    for bat, order, client in rows:
        usage_count = 1
        if bat.model_reference and bat.color_id:
            usage_count = counts.get(
                (bat.model_reference, bat.color_id, bat.file_name), 1
            )
        out.append(
            BatSearchResult(
                id=bat.id,
                order_id=order.id,
                order_reference=order.reference,
                client_id=client.id,
                client_name=client.nom,
                file_name=bat.file_name,
                file_type=bat.file_type,
                status=bat.status,
                version=bat.version,
                model_reference=bat.model_reference,
                color_id=bat.color_id,
                created_at=bat.created_at,
                decided_at=bat.decided_at,
                file_url=f"{base_url}/bat/file/{bat.token}",
                usage_count=usage_count,
            )
        )
    return out


# ---------- Admin: reuse a BAT on a new order ----------
@router.post("/link", response_model=BatRead, status_code=status.HTTP_201_CREATED)
async def link_bat(
    payload: BatLinkRequest,
    db: AsyncSession = Depends(get_db),
) -> Bat:
    """Re-use an existing BAT for a new order.

    Creates a new BAT row pointing at the same stored file, linked to the
    original via parent_bat_id. If the source was APPROVED, the new BAT is
    auto-approved too (visual content is identical) and the target order is
    moved to BAT_APPROVED.
    """
    # Source BAT
    src_q = await db.execute(select(Bat).where(Bat.id == payload.source_bat_id))
    src = src_q.scalar_one_or_none()
    if not src:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Source BAT not found")

    target_order, _ = await _get_order_client(db, payload.target_order_id)

    new_uuid = uuid.uuid4()
    new_token = secrets.token_urlsafe(32)
    expires_at = _now_utc() + timedelta(days=settings.BAT_EXPIRATION_DAYS)

    # Inherit approval state from source.
    inherited_status = (
        BatStatus.APPROVED if src.status == BatStatus.APPROVED else BatStatus.PENDING
    )
    decided_at = src.decided_at if inherited_status == BatStatus.APPROVED else None

    new_bat = Bat(
        id=new_uuid,
        order_id=target_order.id,
        token=new_token,
        file_path=src.file_path,
        file_type=src.file_type,
        file_name=src.file_name,
        message=src.message,
        status=inherited_status,
        decision_comment=(
            f"Réutilisé depuis BAT {src.id} (commande source)"
            if inherited_status == BatStatus.APPROVED
            else None
        ),
        decided_at=decided_at,
        expires_at=expires_at,
        composition_metadata=src.composition_metadata,
        version=1,
        parent_bat_id=src.id,
        model_reference=payload.model_reference or src.model_reference,
        color_id=payload.color_id or src.color_id,
    )
    db.add(new_bat)

    # Bump order status if BAT is auto-approved.
    if inherited_status == BatStatus.APPROVED:
        target_order.statut = OrderStatus.BAT_APPROVED

    await db.commit()
    await db.refresh(new_bat)
    return new_bat


@router.get("/order/{order_id}", response_model=list[BatRead])
async def list_bats_for_order(
    order_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
) -> list[Bat]:
    result = await db.execute(
        select(Bat).where(Bat.order_id == order_id).order_by(Bat.created_at.desc())
    )
    return list(result.scalars().all())
