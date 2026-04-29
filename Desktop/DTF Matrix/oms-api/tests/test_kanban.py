"""Integration tests for the Kanban board and webhook emission.

Covers:
- GET /kanban/columns         -> metadata + allowed transitions
- GET /kanban/board           -> orders grouped per column, canonical order
- GET /kanban/metrics         -> KPI payload (total, active, overdue, by_status)
- POST /kanban/transition     -> valid transition + webhook call + HMAC signing
- POST /kanban/transition     -> invalid transition returns 409
- PATCH /orders/{id}/status   -> same workflow enforcement + webhook
"""
from __future__ import annotations

import hashlib
import hmac
import json
from datetime import date, timedelta
from unittest.mock import AsyncMock, patch

import pytest
from httpx import AsyncClient

from app.config import settings
from app.models.order import OrderStatus


async def _create_client(client: AsyncClient, headers: dict) -> str:
    r = await client.post(
        "/clients",
        headers=headers,
        json={"nom": "Atelier Client", "email": "client@example.com"},
    )
    assert r.status_code in (200, 201), r.text
    return r.json()["id"]


async def _create_order(
    client: AsyncClient,
    headers: dict,
    client_id: str,
    reference: str,
    statut: str = "DRAFT",
    date_livraison: str | None = None,
) -> dict:
    payload = {
        "client_id": client_id,
        "reference": reference,
        "statut": statut,
        "montant_total": "120.00",
    }
    if date_livraison is not None:
        payload["date_livraison_prevue"] = date_livraison
    r = await client.post("/orders", headers=headers, json=payload)
    assert r.status_code == 201, r.text
    return r.json()


@pytest.mark.asyncio
async def test_columns_metadata(client: AsyncClient, auth_headers: dict):
    r = await client.get("/kanban/columns", headers=auth_headers)
    assert r.status_code == 200, r.text
    data = r.json()
    statuses = [c["status"] for c in data["columns"]]
    # All OrderStatus values must be present, in workflow order starting with DRAFT.
    assert statuses[0] == "DRAFT"
    assert set(statuses) == {s.value for s in OrderStatus}
    # DRAFT must allow CONFIRMED as a next move.
    draft_col = next(c for c in data["columns"] if c["status"] == "DRAFT")
    assert "CONFIRMED" in draft_col["allowed_next"]
    # DELIVERED is terminal.
    delivered_col = next(c for c in data["columns"] if c["status"] == "DELIVERED")
    assert delivered_col["allowed_next"] == []


@pytest.mark.asyncio
async def test_board_groups_orders_by_status(client: AsyncClient, auth_headers: dict):
    client_id = await _create_client(client, auth_headers)
    await _create_order(client, auth_headers, client_id, "REF-001", "DRAFT")
    await _create_order(client, auth_headers, client_id, "REF-002", "CONFIRMED")
    await _create_order(client, auth_headers, client_id, "REF-003", "CONFIRMED")

    r = await client.get("/kanban/board", headers=auth_headers)
    assert r.status_code == 200, r.text
    data = r.json()
    by_status = {c["status"]: c for c in data["columns"]}
    assert by_status["DRAFT"]["count"] == 1
    assert by_status["CONFIRMED"]["count"] == 2
    assert by_status["IN_PRODUCTION"]["count"] == 0
    # Columns are returned in canonical workflow order.
    order_index = [c["status"] for c in data["columns"]]
    assert order_index.index("DRAFT") < order_index.index("CONFIRMED")
    assert order_index.index("CONFIRMED") < order_index.index("IN_PRODUCTION")


@pytest.mark.asyncio
async def test_metrics_counts_active_and_overdue(client: AsyncClient, auth_headers: dict):
    client_id = await _create_client(client, auth_headers)
    yesterday = (date.today() - timedelta(days=1)).isoformat()
    tomorrow = (date.today() + timedelta(days=1)).isoformat()
    # Active + overdue (IN_PRODUCTION w/ past delivery date).
    await _create_order(client, auth_headers, client_id, "REF-A", "IN_PRODUCTION", yesterday)
    # Active + on time.
    await _create_order(client, auth_headers, client_id, "REF-B", "CONFIRMED", tomorrow)
    # Terminal, should not count as overdue even with past date.
    await _create_order(client, auth_headers, client_id, "REF-C", "DELIVERED", yesterday)

    r = await client.get("/kanban/metrics", headers=auth_headers)
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["total"] == 3
    assert data["active"] == 2
    assert data["overdue"] == 1
    assert data["by_status"]["IN_PRODUCTION"] == 1
    assert data["by_status"]["CONFIRMED"] == 1
    assert data["by_status"]["DELIVERED"] == 1


@pytest.mark.asyncio
async def test_transition_valid_emits_signed_webhook(
    client: AsyncClient, auth_headers: dict, monkeypatch: pytest.MonkeyPatch
):
    client_id = await _create_client(client, auth_headers)
    order = await _create_order(client, auth_headers, client_id, "REF-TR-1", "DRAFT")

    # Enable webhook + set a predictable URL & secret.
    monkeypatch.setattr(settings, "KANBAN_WEBHOOK_ENABLED", True)
    monkeypatch.setattr(settings, "KANBAN_WEBHOOK_URL", "https://kanban.example.test/in")
    monkeypatch.setattr(settings, "KANBAN_WEBHOOK_SECRET", "test-secret")

    captured: dict = {}

    class _FakeResp:
        status_code = 200

        def raise_for_status(self):
            return None

    class _FakeAsyncClient:
        def __init__(self, **kwargs):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, *a):
            return None

        async def post(self, url, content=None, headers=None, **kwargs):
            captured["url"] = url
            captured["content"] = content
            captured["headers"] = headers
            return _FakeResp()

    # Patch only the AsyncClient used inside webhook_service — not the
    # test-client one that drives the ASGI app.
    with patch("app.services.webhook_service.httpx.AsyncClient", _FakeAsyncClient):
        r = await client.post(
            "/kanban/transition",
            headers=auth_headers,
            json={"order_id": order["id"], "to_status": "CONFIRMED"},
        )

    assert r.status_code == 200, r.text
    body = r.json()
    assert body["from_status"] == "DRAFT"
    assert body["to_status"] == "CONFIRMED"
    assert body["webhook_emitted"] is True
    assert body["order"]["statut"] == "CONFIRMED"

    # Webhook was called with HMAC-SHA256 signature over the raw JSON body.
    assert captured["url"] == "https://kanban.example.test/in"
    assert captured["headers"]["X-Webhook-Event"] == "order.status_changed"
    sig_header = captured["headers"]["X-Webhook-Signature"]
    assert sig_header.startswith("sha256=")
    expected = hmac.new(
        b"test-secret", captured["content"], hashlib.sha256
    ).hexdigest()
    assert sig_header == f"sha256={expected}"

    # Envelope shape: {event, data, timestamp}
    envelope = json.loads(captured["content"])
    assert envelope["event"] == "order.status_changed"
    assert envelope["data"]["from_status"] == "DRAFT"
    assert envelope["data"]["to_status"] == "CONFIRMED"
    assert envelope["data"]["reference"] == "REF-TR-1"
    assert "timestamp" in envelope


@pytest.mark.asyncio
async def test_transition_invalid_returns_409(client: AsyncClient, auth_headers: dict):
    client_id = await _create_client(client, auth_headers)
    order = await _create_order(client, auth_headers, client_id, "REF-TR-2", "DRAFT")

    # DRAFT -> SHIPPED is not a valid transition.
    r = await client.post(
        "/kanban/transition",
        headers=auth_headers,
        json={"order_id": order["id"], "to_status": "SHIPPED"},
    )
    assert r.status_code == 409, r.text
    assert "Invalid transition" in r.json()["detail"]


@pytest.mark.asyncio
async def test_transition_unknown_order_returns_404(
    client: AsyncClient, auth_headers: dict
):
    import uuid as _uuid

    r = await client.post(
        "/kanban/transition",
        headers=auth_headers,
        json={"order_id": str(_uuid.uuid4()), "to_status": "CONFIRMED"},
    )
    assert r.status_code == 404, r.text


@pytest.mark.asyncio
async def test_patch_status_enforces_workflow_and_emits_webhook(
    client: AsyncClient, auth_headers: dict, monkeypatch: pytest.MonkeyPatch
):
    """PATCH /orders/{id}/status should share the same workflow + webhook logic."""
    client_id = await _create_client(client, auth_headers)
    order = await _create_order(client, auth_headers, client_id, "REF-PATCH", "DRAFT")

    # Invalid transition -> 409.
    r = await client.patch(
        f"/orders/{order['id']}/status",
        headers=auth_headers,
        json={"statut": "DELIVERED"},
    )
    assert r.status_code == 409, r.text

    # Valid transition + webhook emission.
    monkeypatch.setattr(settings, "KANBAN_WEBHOOK_ENABLED", True)
    monkeypatch.setattr(settings, "KANBAN_WEBHOOK_URL", "https://kanban.example.test/in")
    monkeypatch.setattr(settings, "KANBAN_WEBHOOK_SECRET", "test-secret")

    with patch(
        "app.routes.orders.emit_status_changed", new=AsyncMock(return_value=True)
    ) as mock_emit:
        r = await client.patch(
            f"/orders/{order['id']}/status",
            headers=auth_headers,
            json={"statut": "CONFIRMED"},
        )
        assert r.status_code == 200, r.text
        assert r.json()["statut"] == "CONFIRMED"
        mock_emit.assert_awaited_once()


@pytest.mark.asyncio
async def test_transition_noop_does_not_emit(
    client: AsyncClient, auth_headers: dict, monkeypatch: pytest.MonkeyPatch
):
    """Moving to the same status is a no-op: no webhook must fire."""
    client_id = await _create_client(client, auth_headers)
    order = await _create_order(client, auth_headers, client_id, "REF-NOOP", "DRAFT")

    monkeypatch.setattr(settings, "KANBAN_WEBHOOK_ENABLED", True)
    monkeypatch.setattr(settings, "KANBAN_WEBHOOK_URL", "https://kanban.example.test/in")

    with patch(
        "app.routes.kanban.emit_status_changed", new=AsyncMock(return_value=True)
    ) as mock_emit:
        r = await client.post(
            "/kanban/transition",
            headers=auth_headers,
            json={"order_id": order["id"], "to_status": "DRAFT"},
        )
        assert r.status_code == 200
        assert r.json()["webhook_emitted"] is False
        mock_emit.assert_not_awaited()


@pytest.mark.asyncio
async def test_webhook_disabled_returns_false(
    client: AsyncClient, auth_headers: dict, monkeypatch: pytest.MonkeyPatch
):
    """When KANBAN_WEBHOOK_ENABLED=False, transition still works but webhook_emitted=False."""
    client_id = await _create_client(client, auth_headers)
    order = await _create_order(client, auth_headers, client_id, "REF-DISABLED", "DRAFT")

    monkeypatch.setattr(settings, "KANBAN_WEBHOOK_ENABLED", False)

    r = await client.post(
        "/kanban/transition",
        headers=auth_headers,
        json={"order_id": order["id"], "to_status": "CONFIRMED"},
    )
    assert r.status_code == 200
    body = r.json()
    assert body["order"]["statut"] == "CONFIRMED"
    assert body["webhook_emitted"] is False


