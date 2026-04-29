import hashlib
import hmac
import json
import logging
import time
from typing import Any

import httpx

from app.config import settings

logger = logging.getLogger(__name__)


def sign_payload(payload: bytes, secret: str) -> str:
    """Return the HMAC-SHA256 hex digest of payload using secret."""
    return hmac.new(secret.encode("utf-8"), payload, hashlib.sha256).hexdigest()


def verify_signature(payload: bytes, signature: str, secret: str) -> bool:
    expected = sign_payload(payload, secret)
    return hmac.compare_digest(expected, signature)


async def emit_webhook(event: str, data: dict[str, Any]) -> bool:
    """
    POST a signed webhook to KANBAN_WEBHOOK_URL.
    Returns True if the webhook was emitted successfully (2xx),
    False on failure or when disabled/unconfigured.
    """
    if not settings.KANBAN_WEBHOOK_ENABLED or not settings.KANBAN_WEBHOOK_URL:
        logger.info(
            "webhook_skipped",
            extra={"event": event, "reason": "disabled_or_no_url"},
        )
        return False

    # Sécurité : on refuse de signer un payload sans secret configuré. Sinon
    # une signature `sha256(body, "")` est triviale à forger et le récepteur
    # peut être trompé.
    secret = settings.KANBAN_WEBHOOK_SECRET
    if not secret:
        logger.error(
            "webhook_skipped",
            extra={"event": event, "reason": "missing_secret"},
        )
        return False

    envelope = {"event": event, "data": data, "timestamp": int(time.time())}
    body = json.dumps(envelope, separators=(",", ":"), default=str).encode("utf-8")
    signature = sign_payload(body, secret)

    headers = {
        "Content-Type": "application/json",
        "X-Webhook-Signature": f"sha256={signature}",
        "X-Webhook-Event": event,
    }

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            r = await client.post(settings.KANBAN_WEBHOOK_URL, content=body, headers=headers)
            r.raise_for_status()
            logger.info(
                "webhook_sent",
                extra={"event": event, "url": settings.KANBAN_WEBHOOK_URL, "status": r.status_code},
            )
            return True
    except Exception as exc:  # pragma: no cover — runtime guard
        logger.exception(
            "webhook_failed",
            extra={"event": event, "url": settings.KANBAN_WEBHOOK_URL, "error": str(exc)},
        )
        return False
