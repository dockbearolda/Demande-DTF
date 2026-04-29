import logging
from email.message import EmailMessage
from pathlib import Path

import aiosmtplib
from jinja2 import Environment, FileSystemLoader, select_autoescape

from app.config import settings

logger = logging.getLogger(__name__)

TEMPLATES_DIR = Path(__file__).parent.parent / "templates"

_env = Environment(
    loader=FileSystemLoader(str(TEMPLATES_DIR)),
    autoescape=select_autoescape(["html", "xml"]),
)


def render_template(name: str, **context) -> str:
    template = _env.get_template(name)
    return template.render(**context)


async def send_email(
    to: str,
    subject: str,
    html_body: str,
    text_body: str | None = None,
) -> bool:
    """
    Send an HTML email. Returns True on success, False on failure.

    When SMTP_ENABLED is False (dev/test), logs the message instead of sending
    so the upload flow still works without a live SMTP server.
    """
    if not settings.SMTP_ENABLED:
        logger.info(
            "email_skipped",
            extra={"to": to, "subject": subject, "reason": "SMTP_ENABLED=false"},
        )
        return True

    msg = EmailMessage()
    msg["From"] = settings.SMTP_FROM
    msg["To"] = to
    msg["Subject"] = subject
    msg.set_content(text_body or "Please view this message in an HTML capable client.")
    msg.add_alternative(html_body, subtype="html")

    try:
        await aiosmtplib.send(
            msg,
            hostname=settings.SMTP_HOST,
            port=settings.SMTP_PORT,
            username=settings.SMTP_USER,
            password=settings.SMTP_PASSWORD,
            start_tls=settings.SMTP_TLS,
        )
        logger.info("email_sent", extra={"to": to, "subject": subject})
        return True
    except Exception as exc:  # pragma: no cover — runtime guard
        logger.exception("email_send_failed", extra={"to": to, "subject": subject, "error": str(exc)})
        return False


async def send_bat_client_email(
    to: str,
    order_reference: str,
    client_name: str,
    validation_url: str,
    message: str | None,
) -> bool:
    html = render_template(
        "email_bat_client.html",
        order_reference=order_reference,
        client_name=client_name,
        validation_url=validation_url,
        message=message,
    )
    subject = f"BAT à valider — commande {order_reference}"
    return await send_email(to=to, subject=subject, html_body=html)


async def send_bat_decision_email(
    order_reference: str,
    decision: str,
    comment: str | None,
    client_name: str,
) -> bool:
    html = render_template(
        "email_bat_decision.html",
        order_reference=order_reference,
        decision=decision,
        comment=comment,
        client_name=client_name,
    )
    subject = f"BAT {decision} — commande {order_reference}"
    return await send_email(
        to=settings.SMTP_TEAM_ADDRESS, subject=subject, html_body=html
    )
