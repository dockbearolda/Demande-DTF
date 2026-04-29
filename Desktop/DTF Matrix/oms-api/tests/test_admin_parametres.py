"""Tests de l'endpoint /admin/parametres (singleton id=1)."""
import pytest

from app.config import settings


_TEST_ADMIN_TOKEN = "test-admin-token"
_HEADERS = {"X-Admin-Token": _TEST_ADMIN_TOKEN}


@pytest.fixture(autouse=True)
def admin_token(monkeypatch):
    """Configure ADMIN_TOKEN for the whole module so the admin guard accepts
    requests, then restore it after each test."""
    monkeypatch.setattr(settings, "ADMIN_TOKEN", _TEST_ADMIN_TOKEN)


@pytest.mark.asyncio
async def test_get_parametres_creates_default_singleton(client):
    """GET initial doit créer la ligne par défaut (1.56 / 0.04)."""
    r = await client.get("/admin/parametres", headers=_HEADERS)
    assert r.status_code == 200
    data = r.json()
    assert data["id"] == 1
    assert float(data["transport_ttc"]) == pytest.approx(1.56)
    assert float(data["taux_tgca"]) == pytest.approx(0.04)


@pytest.mark.asyncio
async def test_put_parametres_partial_update(client):
    # init
    await client.get("/admin/parametres", headers=_HEADERS)
    r = await client.put(
        "/admin/parametres", json={"transport_ttc": 2.50}, headers=_HEADERS
    )
    assert r.status_code == 200
    data = r.json()
    assert float(data["transport_ttc"]) == pytest.approx(2.50)
    # taux inchangé
    assert float(data["taux_tgca"]) == pytest.approx(0.04)


@pytest.mark.asyncio
async def test_put_parametres_both_fields(client):
    await client.get("/admin/parametres", headers=_HEADERS)
    r = await client.put(
        "/admin/parametres",
        json={"transport_ttc": 0, "taux_tgca": 0.06},
        headers=_HEADERS,
    )
    assert r.status_code == 200
    data = r.json()
    assert float(data["transport_ttc"]) == 0
    assert float(data["taux_tgca"]) == pytest.approx(0.06)


@pytest.mark.asyncio
async def test_put_parametres_validation_negative_transport_rejected(client):
    r = await client.put(
        "/admin/parametres", json={"transport_ttc": -1}, headers=_HEADERS
    )
    assert r.status_code == 422


@pytest.mark.asyncio
async def test_put_parametres_validation_tgca_above_one_rejected(client):
    r = await client.put(
        "/admin/parametres", json={"taux_tgca": 1.5}, headers=_HEADERS
    )
    assert r.status_code == 422


@pytest.mark.asyncio
async def test_admin_route_rejects_missing_token(client, monkeypatch):
    """Sans header X-Admin-Token, la route doit renvoyer 401."""
    r = await client.get("/admin/parametres")
    assert r.status_code == 401


@pytest.mark.asyncio
async def test_admin_route_rejects_wrong_token(client):
    r = await client.get(
        "/admin/parametres", headers={"X-Admin-Token": "wrong-token"}
    )
    assert r.status_code == 401


@pytest.mark.asyncio
async def test_admin_route_disabled_when_token_unset(client, monkeypatch):
    """Sans ADMIN_TOKEN configuré, la route renvoie 503 (fail-closed)."""
    monkeypatch.setattr(settings, "ADMIN_TOKEN", None)
    r = await client.get("/admin/parametres", headers=_HEADERS)
    assert r.status_code == 503
