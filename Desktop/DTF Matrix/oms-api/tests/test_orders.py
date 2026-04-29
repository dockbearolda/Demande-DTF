import pytest
from httpx import AsyncClient


async def _create_client(client: AsyncClient, headers: dict[str, str]) -> str:
    r = await client.post(
        "/clients",
        json={"nom": "ACME", "email": "acme@example.com"},
        headers=headers,
    )
    assert r.status_code == 201
    return r.json()["id"]


@pytest.mark.asyncio
async def test_create_order(client: AsyncClient, auth_headers):
    cid = await _create_client(client, auth_headers)
    r = await client.post(
        "/orders",
        json={"client_id": cid, "reference": "ORD-001"},
        headers=auth_headers,
    )
    assert r.status_code == 201
    body = r.json()
    assert body["reference"] == "ORD-001"
    assert body["statut"] == "DRAFT"


@pytest.mark.asyncio
async def test_create_order_montant_total_from_lines(client: AsyncClient, auth_headers):
    cid = await _create_client(client, auth_headers)
    r = await client.post(
        "/orders",
        json={
            "client_id": cid,
            "reference": "ORD-PU",
            "lines": [
                {"ligne_numero": 1, "secteur": "DTF", "produit": "P1", "quantite": 2, "prix_unitaire": "12.50"},
                {"ligne_numero": 2, "secteur": "UV", "produit": "P2", "quantite": 3, "prix_unitaire": "5.00"},
            ],
        },
        headers=auth_headers,
    )
    assert r.status_code == 201
    body = r.json()
    assert body["montant_total"] == "40.00"
    assert body["lines"][0]["prix_unitaire"] == "12.50"


@pytest.mark.asyncio
async def test_create_order_unknown_client(client: AsyncClient, auth_headers):
    import uuid
    r = await client.post(
        "/orders",
        json={"client_id": str(uuid.uuid4()), "reference": "ORD-X"},
        headers=auth_headers,
    )
    assert r.status_code == 404


@pytest.mark.asyncio
async def test_list_orders_filters(client: AsyncClient, auth_headers):
    cid = await _create_client(client, auth_headers)
    for i in range(3):
        await client.post(
            "/orders",
            json={"client_id": cid, "reference": f"ORD-{i}"},
            headers=auth_headers,
        )
    r = await client.get("/orders", headers=auth_headers)
    assert r.status_code == 200
    assert len(r.json()) == 3

    r2 = await client.get("/orders", params={"statut": "DRAFT"}, headers=auth_headers)
    assert r2.status_code == 200
    assert len(r2.json()) == 3

    r3 = await client.get("/orders", params={"statut": "DELIVERED"}, headers=auth_headers)
    assert len(r3.json()) == 0


@pytest.mark.asyncio
async def test_update_order_status(client: AsyncClient, auth_headers):
    cid = await _create_client(client, auth_headers)
    r = await client.post(
        "/orders",
        json={"client_id": cid, "reference": "ORD-S"},
        headers=auth_headers,
    )
    oid = r.json()["id"]
    r2 = await client.patch(
        f"/orders/{oid}/status",
        json={"statut": "CONFIRMED"},
        headers=auth_headers,
    )
    assert r2.status_code == 200
    assert r2.json()["statut"] == "CONFIRMED"


@pytest.mark.asyncio
async def test_update_order(client: AsyncClient, auth_headers):
    cid = await _create_client(client, auth_headers)
    r = await client.post(
        "/orders",
        json={"client_id": cid, "reference": "ORD-U"},
        headers=auth_headers,
    )
    oid = r.json()["id"]
    r2 = await client.put(
        f"/orders/{oid}",
        json={"notes": "hello world"},
        headers=auth_headers,
    )
    assert r2.status_code == 200
    assert r2.json()["notes"] == "hello world"


@pytest.mark.asyncio
async def test_delete_order_soft(client: AsyncClient, auth_headers):
    cid = await _create_client(client, auth_headers)
    r = await client.post(
        "/orders",
        json={"client_id": cid, "reference": "ORD-D"},
        headers=auth_headers,
    )
    oid = r.json()["id"]
    r2 = await client.delete(f"/orders/{oid}", headers=auth_headers)
    assert r2.status_code == 204
    r3 = await client.get(f"/orders/{oid}", headers=auth_headers)
    assert r3.status_code == 404


@pytest.mark.asyncio
async def test_duplicate_order_reference(client: AsyncClient, auth_headers):
    cid = await _create_client(client, auth_headers)
    payload = {"client_id": cid, "reference": "ORD-DUP"}
    r1 = await client.post("/orders", json=payload, headers=auth_headers)
    assert r1.status_code == 201
    r2 = await client.post("/orders", json=payload, headers=auth_headers)
    assert r2.status_code == 409
