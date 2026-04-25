import uuid
import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_create_family_then_tree(client: AsyncClient):
    r = await client.post(
        "/catalog/families",
        json={"slug": "textile", "label": "Textile", "icon": "Shirt", "position": 0, "enabled": True},
    )
    assert r.status_code == 201
    fam = r.json()
    assert fam["slug"] == "textile"

    tree = await client.get("/catalog/tree")
    assert tree.status_code == 200
    body = tree.json()
    assert any(f["slug"] == "textile" for f in body["families"])


@pytest.mark.asyncio
async def test_create_subfamily_under_unknown_family_returns_404(client: AsyncClient):
    fake_id = str(uuid.uuid4())
    r = await client.post(
        f"/catalog/families/{fake_id}/subfamilies",
        json={"slug": "missing", "label": "Missing"},
    )
    assert r.status_code == 404


@pytest.mark.asyncio
async def test_delete_family_soft_disables_descendants(client: AsyncClient):
    # family
    r = await client.post(
        "/catalog/families",
        json={"slug": "f1", "label": "F1"},
    )
    fid = r.json()["id"]
    # subfamily
    r2 = await client.post(
        f"/catalog/families/{fid}/subfamilies",
        json={"slug": "sf1", "label": "SF1"},
    )
    assert r2.status_code == 201
    sfid = r2.json()["id"]
    # pricing matrix
    rm = await client.post(
        "/catalog/pricing-matrices",
        json={
            "name": "PM-test",
            "currency": "EUR",
            "tiers": [{"minQty": 1, "vierge": 10.0, "coeur": 1.0, "dos": 2.0}],
        },
    )
    assert rm.status_code == 201
    pm_id = rm.json()["id"]
    # product
    r3 = await client.post(
        f"/catalog/subfamilies/{sfid}/products",
        json={
            "reference": "REF1",
            "name": "Prod 1",
            "pricing_matrix_id": pm_id,
            "colors": [{"id": "white", "label": "Blanc", "hex": "#fff"}],
            "sizes": [{"id": "M", "label": "M", "order": 0}],
        },
    )
    assert r3.status_code == 201

    # delete family
    rd = await client.delete(f"/catalog/families/{fid}")
    assert rd.status_code == 204

    # tree shows family + subfamily + product all enabled=False
    tree = (await client.get("/catalog/tree")).json()
    fam = next(f for f in tree["families"] if f["id"] == fid)
    assert fam["enabled"] is False
    assert all(sf["enabled"] is False for sf in fam["subfamilies"])
    for sf in fam["subfamilies"]:
        for p in sf["products"]:
            assert p["enabled"] is False


@pytest.mark.asyncio
async def test_update_pricing_matrix_tiers(client: AsyncClient):
    rm = await client.post(
        "/catalog/pricing-matrices",
        json={
            "name": "PM-1",
            "tiers": [{"minQty": 1, "vierge": 10.0, "coeur": 1.0, "dos": 2.0}],
        },
    )
    pmid = rm.json()["id"]
    rp = await client.patch(
        f"/catalog/pricing-matrices/{pmid}",
        json={
            "tiers": [
                {"minQty": 1, "vierge": 9.0, "coeur": 1.0, "dos": 2.0},
                {"minQty": 50, "vierge": 5.0, "coeur": 0.5, "dos": 1.0},
            ]
        },
    )
    assert rp.status_code == 200
    body = rp.json()
    assert len(body["tiers"]) == 2
    assert body["tiers"][1]["minQty"] == 50


@pytest.mark.asyncio
async def test_duplicate_family_slug_conflict(client: AsyncClient):
    await client.post("/catalog/families", json={"slug": "dup", "label": "D"})
    r2 = await client.post("/catalog/families", json={"slug": "dup", "label": "D2"})
    assert r2.status_code == 409
