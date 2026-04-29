"""Dropbox client-folder provisioning.

Creates one folder per CLIENT under /Clients/{safe_client_name}/ with a
standard set of sub-folders. Not wired to any route yet — call sites will
plug into it later.
"""

from __future__ import annotations

import asyncio
import logging
import os
import re
from typing import TypedDict

try:
    from dotenv import load_dotenv
except ImportError:  # pragma: no cover
    def load_dotenv(*_args, **_kwargs) -> bool:
        return False

try:
    import dropbox
    from dropbox.exceptions import ApiError, AuthError
    from dropbox.files import FolderMetadata
except ImportError:  # pragma: no cover
    dropbox = None
    ApiError = Exception
    AuthError = Exception
    FolderMetadata = object


load_dotenv()

logger = logging.getLogger(__name__)


SUBFOLDERS: list[str] = [
    "01_Brief",
    "02_Fichiers_client",
    "03_BAT",
    "04_Production",
    "05_Livraison",
]


class CreateClientFolderResult(TypedDict):
    success: bool
    path: str
    subfolders_created: list[str]
    errors: list[str]


def sanitize_name(name: str) -> str:
    """Strip characters illegal in Dropbox paths and collapse whitespace."""
    cleaned = re.sub(r'[\\/:*?"<>|]+', "_", name)
    cleaned = re.sub(r"\s+", "_", cleaned).strip("._")
    return cleaned or "client"


def build_client_path(client_name: str) -> str:
    return f"/Clients/{sanitize_name(client_name)}"


def _get_client() -> "dropbox.Dropbox":
    token = os.environ.get("DROPBOX_ACCESS_TOKEN")
    if not token:
        raise RuntimeError("DROPBOX_ACCESS_TOKEN is not set")
    if dropbox is None:
        raise RuntimeError("dropbox SDK is not installed")
    return dropbox.Dropbox(token)


def _folder_exists(dbx_client, path: str) -> bool:
    try:
        meta = dbx_client.files_get_metadata(path)
        return isinstance(meta, FolderMetadata) or meta.__class__.__name__ == "FolderMetadata"
    except ApiError:
        return False


def _create_folder(dbx_client, path: str, errors: list[str]) -> bool:
    try:
        if _folder_exists(dbx_client, path):
            logger.info("Folder already exists, skipping: %s", path)
            return True
        dbx_client.files_create_folder_v2(path)
        logger.info("Created folder: %s", path)
        return True
    except ApiError as exc:
        message = str(exc)
        if "conflict" in message.lower() or "already_exists" in message.lower():
            logger.warning("Folder already exists (race): %s", path)
            return True
        logger.error("Dropbox API error on %s: %s", path, message)
        errors.append(f"{path}: {message}")
        return False


def _create_client_folder_sync(
    client_name: str,
    dbx_client=None,
) -> CreateClientFolderResult:
    base_path = build_client_path(client_name)
    result: CreateClientFolderResult = {
        "success": False,
        "path": base_path,
        "subfolders_created": [],
        "errors": [],
    }

    try:
        client = dbx_client or _get_client()
    except RuntimeError as exc:
        logger.error("Configuration error: %s", exc)
        result["errors"].append(str(exc))
        return result

    try:
        if not _create_folder(client, base_path, result["errors"]):
            return result

        for sub in SUBFOLDERS:
            sub_path = f"{base_path}/{sub}"
            if _create_folder(client, sub_path, result["errors"]):
                result["subfolders_created"].append(sub)

        result["success"] = len(result["errors"]) == 0
        if result["success"]:
            logger.info("Client folder ready at %s", base_path)
        else:
            logger.warning(
                "Client folder partially created at %s with %d error(s)",
                base_path,
                len(result["errors"]),
            )
        return result

    except AuthError as exc:
        logger.error("Authentication failed: %s", exc)
        result["errors"].append(f"auth_error: {exc}")
        return result
    except ApiError as exc:
        message = str(exc)
        if "insufficient_space" in message.lower() or "quota" in message.lower():
            logger.error("Quota exceeded: %s", message)
            result["errors"].append(f"quota_exceeded: {message}")
        else:
            logger.error("Dropbox API error: %s", message)
            result["errors"].append(f"api_error: {message}")
        return result
    except (TimeoutError, ConnectionError) as exc:
        logger.error("Network error: %s", exc)
        result["errors"].append(f"network_error: {exc}")
        return result


async def create_client_folder(
    client_name: str,
    dbx_client=None,
) -> CreateClientFolderResult:
    """Create the standard Dropbox folder structure for a client.

    The Dropbox SDK is synchronous, so the blocking call is offloaded to a
    worker thread to keep the event loop free.

    Args:
        client_name: Client display name (sanitized for filesystem use).
        dbx_client: Optional Dropbox client (injected for tests). When None,
            a client is built from DROPBOX_ACCESS_TOKEN.
    """
    return await asyncio.to_thread(_create_client_folder_sync, client_name, dbx_client)
