"""Integration tests for /clients routes.

Covers the realistic happy paths plus the validation/edge cases that have
caused regressions in the past: search filtering, soft-delete (is_deleted),
contacts CRUD, and the bulk-import dedup behaviour.
"""
import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_create_and_get_client(client: AsyncClient):
    r = await client.post(
        "/clients", json={"nom": "ACME", "email": "acme@example.com"}
    )
    assert r.status_code == 201
    cid = r.json()["id"]

    r = await client.get(f"/clients/{cid}")
    assert r.status_code == 200
    assert r.json()["nom"] == "ACME"


@pytest.mark.asyncio
async def test_get_client_not_found(client: AsyncClient):
    r = await client.get("/clients/00000000-0000-0000-0000-000000000000")
    assert r.status_code == 404


@pytest.mark.asyncio
async def test_list_clients_search_filters_by_name(client: AsyncClient):
    await client.post("/clients", json={"nom": "Bakery Prime"})
    await client.post("/clients", json={"nom": "Tech Studio"})
    r = await client.get("/clients", params={"search": "bakery"})
    assert r.status_code == 200
    nomes = [c["nom"] for c in r.json()]
    assert "Bakery Prime" in nomes
    assert "Tech Studio" not in nomes


@pytest.mark.asyncio
async def test_update_client_partial(client: AsyncClient):
    r = await client.post("/clients", json={"nom": "Old Name"})
    cid = r.json()["id"]
    r = await client.put(f"/clients/{cid}", json={"ville": "Paris"})
    assert r.status_code == 200
    assert r.json()["nom"] == "Old Name"
    assert r.json()["ville"] == "Paris"


@pytest.mark.asyncio
async def test_delete_client_is_soft_delete(client: AsyncClient):
    r = await client.post("/clients", json={"nom": "ToRemove"})
    cid = r.json()["id"]
    r = await client.delete(f"/clients/{cid}")
    assert r.status_code == 204
    # Listing must not surface the soft-deleted record.
    r = await client.get("/clients", params={"search": "ToRemove"})
    assert all(c["id"] != cid for c in r.json())
    # Direct fetch returns 404.
    r = await client.get(f"/clients/{cid}")
    assert r.status_code == 404


@pytest.mark.asyncio
async def test_search_or_create_creates_when_missing(client: AsyncClient):
    r = await client.post("/clients/search-or-create", json={"nom": "Brand New"})
    assert r.status_code == 200
    body = r.json()
    assert body["created"] is True
    assert body["nom"] == "Brand New"


@pytest.mark.asyncio
async def test_search_or_create_returns_existing(client: AsyncClient):
    await client.post("/clients", json={"nom": "Existing Co"})
    r = await client.post(
        "/clients/search-or-create", json={"nom": "Existing Co"}
    )
    assert r.status_code == 200
    body = r.json()
    assert body["created"] is False
    assert body["nom"] == "Existing Co"


@pytest.mark.asyncio
async def test_search_or_create_requires_nom(client: AsyncClient):
    r = await client.post("/clients/search-or-create", json={})
    assert r.status_code == 400


@pytest.mark.asyncio
async def test_contacts_crud_lifecycle(client: AsyncClient):
    cid = (await client.post("/clients", json={"nom": "ContactCo"})).json()["id"]

    # Add contact
    r = await client.post(
        f"/clients/{cid}/contacts",
        json={"nom": "Alice", "email": "alice@example.com"},
    )
    assert r.status_code == 201
    contact_id = r.json()["id"]

    # List
    r = await client.get(f"/clients/{cid}/contacts")
    assert r.status_code == 200
    assert len(r.json()) == 1

    # Update
    r = await client.put(
        f"/clients/{cid}/contacts/{contact_id}",
        json={"telephone": "0102030405"},
    )
    assert r.status_code == 200
    assert r.json()["telephone"] == "0102030405"

    # Delete
    r = await client.delete(f"/clients/{cid}/contacts/{contact_id}")
    assert r.status_code == 204
    r = await client.get(f"/clients/{cid}/contacts")
    assert r.json() == []


@pytest.mark.asyncio
async def test_contact_404_on_unknown_contact(client: AsyncClient):
    cid = (await client.post("/clients", json={"nom": "Co"})).json()["id"]
    r = await client.put(
        f"/clients/{cid}/contacts/00000000-0000-0000-0000-000000000000",
        json={"nom": "x"},
    )
    assert r.status_code == 404


@pytest.mark.asyncio
async def test_bulk_import_groups_by_company_name(client: AsyncClient):
    payload = [
        {"nom": "Bulk Co", "contact": "Alice", "email": "alice@example.com"},
        {"nom": "Bulk Co", "contact": "Bob", "email": "bob@example.com"},
        {"nom": "Solo Co", "contact": "Sam"},
    ]
    r = await client.post("/clients/bulk-import", json=payload)
    assert r.status_code == 200
    body = r.json()
    # Two distinct companies create two Client rows; three contacts created.
    assert body["clients_created"] == 2
    assert body["contacts_created"] == 3


@pytest.mark.asyncio
async def test_bulk_import_dedup_contacts_within_same_company(
    client: AsyncClient,
):
    """Two rows with the same nom + contact must collapse into one contact."""
    payload = [
        {"nom": "DupeCo", "contact": "Alice"},
        {"nom": "DupeCo", "contact": "Alice"},  # duplicate — should be skipped
    ]
    r = await client.post("/clients/bulk-import", json=payload)
    assert r.status_code == 200
    assert r.json()["contacts_created"] == 1


@pytest.mark.asyncio
async def test_bulk_import_rejects_oversized_payload(client: AsyncClient):
    """5001 rows must be refused — guards the API from accidental flood.

    The route enforces MAX_BULK_IMPORT=5000.
    """
    payload = [{"nom": f"Co {i}"} for i in range(5001)]
    r = await client.post("/clients/bulk-import", json=payload)
    assert r.status_code in (400, 413, 422)
