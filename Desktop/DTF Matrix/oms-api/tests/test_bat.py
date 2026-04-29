import io
import json
import tempfile
from datetime import datetime, timedelta, timezone

import pytest
import pytest_asyncio
from httpx import AsyncClient
from sqlalchemy import select

from app.config import settings
from app.models.bat import Bat, BatStatus
from app.services.webhook_service import sign_payload, verify_signature


PDF_BYTES = (
    b"%PDF-1.4\n%fake-pdf\n1 0 obj<<>>endobj\n"
    b"trailer<<>>\n%%EOF\n"
)


@pytest_asyncio.fixture(autouse=True)
def _tmp_storage(monkeypatch):
    """Use a temp dir for local storage so tests don't leak files."""
    tmp = tempfile.TemporaryDirectory()
    monkeypatch.setattr(settings, "STORAGE_LOCAL_PATH", tmp.name)
    monkeypatch.setattr(settings, "STORAGE_BACKEND", "local")
    monkeypatch.setattr(settings, "SMTP_ENABLED", False)
    monkeypatch.setattr(settings, "KANBAN_WEBHOOK_ENABLED", False)
    yield
    tmp.cleanup()


async def _create_client_and_order(client: AsyncClient, headers: dict[str, str]) -> tuple[str, str, str]:
    rc = await client.post(
        "/clients",
        json={"nom": "ACME", "email": "client@example.com"},
        headers=headers,
    )
    assert rc.status_code == 201
    cid = rc.json()["id"]
    ro = await client.post(
        "/orders",
        json={"client_id": cid, "reference": f"ORD-BAT-{cid[:6]}"},
        headers=headers,
    )
    assert ro.status_code == 201
    return cid, ro.json()["id"], ro.json()["reference"]


async def _upload_bat(client: AsyncClient, headers: dict[str, str], order_id: str) -> dict:
    files = {"file": ("bat.pdf", io.BytesIO(PDF_BYTES), "application/pdf")}
    data = {"order_id": order_id, "message": "Merci de valider"}
    r = await client.post("/bat/upload", data=data, files=files, headers=headers)
    assert r.status_code == 201, r.text
    return r.json()


@pytest.mark.asyncio
async def test_upload_creates_bat_and_returns_link(client: AsyncClient, auth_headers):
    _, oid, _ = await _create_client_and_order(client, auth_headers)
    body = await _upload_bat(client, auth_headers, oid)
    assert "bat_id" in body
    assert body["validation_url"].startswith("http")
    assert "/bat/validate/" in body["validation_url"]


@pytest.mark.asyncio
async def test_upload_rejects_bad_mime(client: AsyncClient, auth_headers):
    _, oid, _ = await _create_client_and_order(client, auth_headers)
    files = {"file": ("evil.exe", io.BytesIO(b"MZ\x90"), "application/x-msdownload")}
    r = await client.post(
        "/bat/upload", data={"order_id": oid}, files=files, headers=auth_headers
    )
    assert r.status_code == 400


@pytest.mark.asyncio
async def test_upload_rejects_unknown_order(client: AsyncClient, auth_headers):
    import uuid
    files = {"file": ("bat.pdf", io.BytesIO(PDF_BYTES), "application/pdf")}
    r = await client.post(
        "/bat/upload",
        data={"order_id": str(uuid.uuid4())},
        files=files,
        headers=auth_headers,
    )
    assert r.status_code == 404


@pytest.mark.asyncio
async def test_validation_page_public_html(client: AsyncClient, auth_headers):
    _, oid, ref = await _create_client_and_order(client, auth_headers)
    body = await _upload_bat(client, auth_headers, oid)
    token = body["validation_url"].rsplit("/", 1)[-1]
    r = await client.get(f"/bat/validate/{token}")
    assert r.status_code == 200
    assert "text/html" in r.headers["content-type"]
    assert ref in r.text
    assert "Valider le BAT" in r.text


@pytest.mark.asyncio
async def test_validation_page_404_unknown_token(client: AsyncClient):
    r = await client.get("/bat/validate/does-not-exist")
    assert r.status_code == 404


@pytest.mark.asyncio
async def test_decision_approved_updates_order_and_bat(client: AsyncClient, auth_headers):
    _, oid, _ = await _create_client_and_order(client, auth_headers)
    body = await _upload_bat(client, auth_headers, oid)
    token = body["validation_url"].rsplit("/", 1)[-1]

    r = await client.post(
        f"/bat/validate/{token}/decision",
        json={"decision": "approved", "comment": ""},
    )
    assert r.status_code == 200, r.text
    assert r.json()["status"] == "APPROVED"

    ro = await client.get(f"/orders/{oid}", headers=auth_headers)
    assert ro.json()["statut"] == "BAT_APPROVED"


@pytest.mark.asyncio
async def test_decision_rejected_requires_comment(client: AsyncClient, auth_headers):
    _, oid, _ = await _create_client_and_order(client, auth_headers)
    body = await _upload_bat(client, auth_headers, oid)
    token = body["validation_url"].rsplit("/", 1)[-1]

    r = await client.post(
        f"/bat/validate/{token}/decision",
        json={"decision": "rejected", "comment": ""},
    )
    assert r.status_code == 400


@pytest.mark.asyncio
async def test_decision_rejected_sets_order_confirmed(client: AsyncClient, auth_headers):
    _, oid, _ = await _create_client_and_order(client, auth_headers)
    body = await _upload_bat(client, auth_headers, oid)
    token = body["validation_url"].rsplit("/", 1)[-1]

    r = await client.post(
        f"/bat/validate/{token}/decision",
        json={"decision": "rejected", "comment": "change the color"},
    )
    assert r.status_code == 200
    assert r.json()["status"] == "REJECTED"

    ro = await client.get(f"/orders/{oid}", headers=auth_headers)
    assert ro.json()["statut"] == "CONFIRMED"


@pytest.mark.asyncio
async def test_decision_is_idempotent(client: AsyncClient, auth_headers):
    _, oid, _ = await _create_client_and_order(client, auth_headers)
    body = await _upload_bat(client, auth_headers, oid)
    token = body["validation_url"].rsplit("/", 1)[-1]

    r1 = await client.post(
        f"/bat/validate/{token}/decision", json={"decision": "approved"}
    )
    assert r1.status_code == 200

    r2 = await client.post(
        f"/bat/validate/{token}/decision",
        json={"decision": "rejected", "comment": "too late"},
    )
    assert r2.status_code == 409


@pytest.mark.asyncio
async def test_expired_link_rejects_decision(client: AsyncClient, auth_headers, db_session):
    _, oid, _ = await _create_client_and_order(client, auth_headers)
    body = await _upload_bat(client, auth_headers, oid)
    token = body["validation_url"].rsplit("/", 1)[-1]

    # Force expiration in DB
    result = await db_session.execute(select(Bat).where(Bat.token == token))
    bat = result.scalar_one()
    bat.expires_at = datetime.now(timezone.utc) - timedelta(days=1)
    await db_session.commit()

    r = await client.post(
        f"/bat/validate/{token}/decision", json={"decision": "approved"}
    )
    assert r.status_code in (409, 410)


@pytest.mark.asyncio
async def test_admin_list_bats_for_order(client: AsyncClient, auth_headers):
    _, oid, _ = await _create_client_and_order(client, auth_headers)
    await _upload_bat(client, auth_headers, oid)

    r = await client.get(f"/bat/order/{oid}", headers=auth_headers)
    assert r.status_code == 200
    arr = r.json()
    assert len(arr) == 1
    assert arr[0]["order_id"] == oid


@pytest.mark.asyncio
async def test_admin_get_bat(client: AsyncClient, auth_headers):
    _, oid, _ = await _create_client_and_order(client, auth_headers)
    body = await _upload_bat(client, auth_headers, oid)
    r = await client.get(f"/bat/{body['bat_id']}", headers=auth_headers)
    assert r.status_code == 200
    assert r.json()["id"] == body["bat_id"]


@pytest.mark.asyncio
async def test_bat_file_served_publicly(client: AsyncClient, auth_headers):
    _, oid, _ = await _create_client_and_order(client, auth_headers)
    body = await _upload_bat(client, auth_headers, oid)
    token = body["validation_url"].rsplit("/", 1)[-1]

    r = await client.get(f"/bat/file/{token}")
    assert r.status_code == 200
    assert r.headers["content-type"] == "application/pdf"
    assert r.content == PDF_BYTES


def test_webhook_hmac_signature_roundtrip():
    secret = "top-secret"
    payload = json.dumps({"event": "bat.approved", "data": {"id": 1}}).encode("utf-8")
    sig = sign_payload(payload, secret)
    assert len(sig) == 64
    assert verify_signature(payload, sig, secret) is True
    assert verify_signature(payload, "deadbeef", secret) is False
    assert verify_signature(payload + b"x", sig, secret) is False


@pytest.mark.asyncio
async def test_webhook_emitted_on_decision(client: AsyncClient, auth_headers, monkeypatch):
    import app.routes.bat as bat_module

    captured = {}

    async def fake_emit(event: str, data: dict):
        captured["event"] = event
        captured["data"] = data
        return True

    monkeypatch.setattr(bat_module, "emit_webhook", fake_emit)

    _, oid, ref = await _create_client_and_order(client, auth_headers)
    body = await _upload_bat(client, auth_headers, oid)
    token = body["validation_url"].rsplit("/", 1)[-1]

    r = await client.post(
        f"/bat/validate/{token}/decision", json={"decision": "approved"}
    )
    assert r.status_code == 200
    assert captured["event"] == "bat.approved"
    assert captured["data"]["order_reference"] == ref
    assert captured["data"]["decision"] == "approved"


@pytest.mark.asyncio
async def test_upload_persists_composition_metadata(
    client: AsyncClient, auth_headers, db_session
):
    """Step 2 du wizard envoie un PDF + composition JSON ; on persiste les deux."""
    _, oid, _ = await _create_client_and_order(client, auth_headers)
    composition = {
        "views": [
            {
                "id": "front",
                "label": "Avant",
                "sizePct": 30,
                "posXPct": 50,
                "posYPct": 30,
                "mockupFile": "PS_NS300-2_COOLBLUE.png",
                "logoFile": "requin.png",
            }
        ],
        "color": "COOLBLUE",
        "model": "PS_NS300-2",
        "productLabel": "T-shirt",
        "sizesSummary": "M×3, L×2",
        "totalQuantity": 5,
    }
    files = {"file": ("bat.pdf", io.BytesIO(PDF_BYTES), "application/pdf")}
    data = {"order_id": oid, "composition": json.dumps(composition)}
    r = await client.post("/bat/upload", data=data, files=files, headers=auth_headers)
    assert r.status_code == 201, r.text
    bat_id = r.json()["bat_id"]

    rb = await client.get(f"/bat/{bat_id}", headers=auth_headers)
    assert rb.status_code == 200
    body = rb.json()
    assert body["composition_metadata"] is not None
    assert body["composition_metadata"]["color"] == "COOLBLUE"
    assert body["composition_metadata"]["totalQuantity"] == 5
    assert body["composition_metadata"]["views"][0]["mockupFile"] == "PS_NS300-2_COOLBLUE.png"


@pytest.mark.asyncio
async def test_upload_rejects_invalid_composition_json(client: AsyncClient, auth_headers):
    _, oid, _ = await _create_client_and_order(client, auth_headers)
    files = {"file": ("bat.pdf", io.BytesIO(PDF_BYTES), "application/pdf")}
    data = {"order_id": oid, "composition": "not-json"}
    r = await client.post("/bat/upload", data=data, files=files, headers=auth_headers)
    assert r.status_code == 400
    assert "composition" in r.json()["detail"].lower()
