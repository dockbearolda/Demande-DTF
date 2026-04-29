"""Tests d'intégration pour les endpoints /quotes (étape 5A).

Couvre :
- création d'un devis (snapshot pricing figé en DB),
- génération de la référence séquentielle ``D-YYYY-NNNN``,
- listing avec filtre status,
- get par id, update status, soft delete,
- erreurs 404 (client inconnu, produit inconnu) et 422 (champs invalides).
"""
from datetime import datetime, timezone

import pytest
from httpx import AsyncClient


# ── Grille Textile 2026 (snapshot) ───────────────────────────────────
TEXTILE_2026_TIERS = [
    {"minQty": 1,   "coef": 3.80, "coeur": 9.50, "poitrine": 10.93, "avantPlein": 16.20, "arrierePlein": 16.20, "mancheG": 9.50, "mancheD": 9.50},
    {"minQty": 5,   "coef": 2.09, "coeur": 6.37, "poitrine": 7.33,  "avantPlein": 12.10, "arrierePlein": 12.10, "mancheG": 6.37, "mancheD": 6.37},
    {"minQty": 10,  "coef": 1.91, "coeur": 5.10, "poitrine": 5.86,  "avantPlein": 10.80, "arrierePlein": 10.80, "mancheG": 5.10, "mancheD": 5.10},
    {"minQty": 20,  "coef": 1.82, "coeur": 4.47, "poitrine": 5.14,  "avantPlein":  9.45, "arrierePlein":  9.45, "mancheG": 4.47, "mancheD": 4.47},
    {"minQty": 30,  "coef": 1.73, "coeur": 4.07, "poitrine": 4.69,  "avantPlein":  8.10, "arrierePlein":  8.10, "mancheG": 4.07, "mancheD": 4.07},
    {"minQty": 50,  "coef": 1.55, "coeur": 3.57, "poitrine": 4.11,  "avantPlein":  7.30, "arrierePlein":  7.30, "mancheG": 3.57, "mancheD": 3.57},
    {"minQty": 100, "coef": 1.27, "coeur": 2.93, "poitrine": 3.36,  "avantPlein":  5.90, "arrierePlein":  5.90, "mancheG": 2.93, "mancheD": 2.93},
    {"minQty": 150, "coef": 1.27, "coeur": 2.80, "poitrine": 3.22,  "avantPlein":  5.70, "arrierePlein":  5.70, "mancheG": 2.80, "mancheD": 2.80},
]


async def _seed(client: AsyncClient) -> dict:
    """Crée un client + family/subfamily/matrix + product NS300. Retourne
    les ids utiles pour les tests."""
    # Client
    cli = (
        await client.post(
            "/clients",
            json={"nom": "Atelier Test", "email": "test@example.com"},
        )
    ).json()

    # Catalogue
    fam = (
        await client.post(
            "/catalog/families", json={"slug": "textile", "label": "Textile"}
        )
    ).json()
    sf = (
        await client.post(
            f"/catalog/families/{fam['id']}/subfamilies",
            json={"slug": "polos", "label": "Polos"},
        )
    ).json()
    matrix = (
        await client.post(
            "/catalog/pricing-matrices",
            json={
                "name": "Textile 2026",
                "currency": "EUR",
                "tiers": TEXTILE_2026_TIERS,
            },
        )
    ).json()
    await client.post(
        f"/catalog/subfamilies/{sf['id']}/products",
        json={
            "reference": "NS300",
            "name": "Polo NS300",
            "pricing_matrix_id": matrix["id"],
            "purchase_price_ht": 4.05,
            "colors": [],
            "sizes": [],
        },
    )
    return {"client_id": cli["id"], "matrix_id": matrix["id"]}


# ── Création ─────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_create_quote_default_persists_snapshot(client: AsyncClient):
    """POST /quotes : snapshot figé, référence D-YYYY-0001 générée."""
    seeded = await _seed(client)
    payload = {
        "client_id": seeded["client_id"],
        "model_ref": "NS300",
        "quantity": 30,
        "placements": ["Coeur"],
        "transport_active": True,
        "tgca_active": False,
    }
    r = await client.post("/quotes", json=payload)
    assert r.status_code == 201, r.text
    data = r.json()

    year = datetime.now(timezone.utc).year
    assert data["reference"] == f"D-{year}-0001"
    assert data["status"] == "draft"
    assert data["client"]["id"] == seeded["client_id"]
    assert data["model_ref"] == "NS300"
    assert data["matrix_name"] == "Textile 2026"
    assert data["quantity"] == 30
    # Snapshot figé : 332,40 + 46,80 = 379,20
    assert data["snapshot_sous_total_ht"] == pytest.approx(332.40)
    assert data["snapshot_transport_ttc"] == pytest.approx(46.80)
    assert data["snapshot_total_ttc"] == pytest.approx(379.20)
    assert data["snapshot_palier_applique"] == 30
    # snapshot_payload contient le détail logos
    payload_out = data["snapshot_payload"]
    assert payload_out["palier_applique"] == 30
    assert payload_out["coef"] == pytest.approx(1.73)
    assert len(payload_out["logos"]) == 1


@pytest.mark.asyncio
async def test_create_quote_with_tgca_and_discount(client: AsyncClient):
    """TGCA active + remise → snapshot reflète le calcul complet."""
    seeded = await _seed(client)
    r = await client.post(
        "/quotes",
        json={
            "client_id": seeded["client_id"],
            "model_ref": "NS300",
            "quantity": 30,
            "placements": ["Coeur"],
            "transport_active": True,
            "tgca_active": True,
            "discount": 50,
            "notes": "À livrer avant fin du mois.",
        },
    )
    assert r.status_code == 201, r.text
    data = r.json()
    # Sans remise : 392,50. Avec −50 : 342,50.
    assert data["snapshot_total_avant_remise"] == pytest.approx(392.50)
    assert data["discount"] == pytest.approx(50.0)
    assert data["snapshot_total_ttc"] == pytest.approx(342.50)
    assert data["notes"] == "À livrer avant fin du mois."


@pytest.mark.asyncio
async def test_create_quote_assigns_sequential_references(client: AsyncClient):
    """Trois POST consécutifs → 0001, 0002, 0003 pour l'année courante."""
    seeded = await _seed(client)
    payload = {
        "client_id": seeded["client_id"],
        "model_ref": "NS300",
        "quantity": 10,
        "placements": [],
    }
    refs = []
    for _ in range(3):
        r = await client.post("/quotes", json=payload)
        assert r.status_code == 201, r.text
        refs.append(r.json()["reference"])

    year = datetime.now(timezone.utc).year
    assert refs == [f"D-{year}-0001", f"D-{year}-0002", f"D-{year}-0003"]


@pytest.mark.asyncio
async def test_create_quote_unknown_client_returns_404(client: AsyncClient):
    await _seed(client)
    r = await client.post(
        "/quotes",
        json={
            "client_id": "00000000-0000-0000-0000-000000000000",
            "model_ref": "NS300",
            "quantity": 10,
            "placements": [],
        },
    )
    assert r.status_code == 404


@pytest.mark.asyncio
async def test_create_quote_unknown_product_returns_404(client: AsyncClient):
    seeded = await _seed(client)
    r = await client.post(
        "/quotes",
        json={
            "client_id": seeded["client_id"],
            "model_ref": "NOPE",
            "quantity": 10,
            "placements": [],
        },
    )
    assert r.status_code == 404


@pytest.mark.asyncio
async def test_create_quote_invalid_quantity_returns_422(client: AsyncClient):
    seeded = await _seed(client)
    r = await client.post(
        "/quotes",
        json={
            "client_id": seeded["client_id"],
            "model_ref": "NS300",
            "quantity": 0,  # min=1
            "placements": [],
        },
    )
    assert r.status_code == 422


@pytest.mark.asyncio
async def test_create_quote_negative_discount_returns_422(client: AsyncClient):
    seeded = await _seed(client)
    r = await client.post(
        "/quotes",
        json={
            "client_id": seeded["client_id"],
            "model_ref": "NS300",
            "quantity": 10,
            "placements": [],
            "discount": -10,
        },
    )
    assert r.status_code == 422


# ── Listing & lecture ────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_list_quotes_empty_initially(client: AsyncClient):
    r = await client.get("/quotes")
    assert r.status_code == 200
    assert r.json() == []


@pytest.mark.asyncio
async def test_list_quotes_returns_recent_first(client: AsyncClient):
    seeded = await _seed(client)
    payload = {
        "client_id": seeded["client_id"],
        "model_ref": "NS300",
        "quantity": 10,
        "placements": [],
    }
    refs = []
    for _ in range(3):
        r = await client.post("/quotes", json=payload)
        refs.append(r.json()["reference"])

    r = await client.get("/quotes")
    assert r.status_code == 200
    listed = r.json()
    assert len(listed) == 3
    # Tri created_at DESC → ref la plus récente en premier
    assert listed[0]["reference"] == refs[-1]
    # L'item liste contient le client en sous-objet et le snapshot total
    assert listed[0]["client"]["id"] == seeded["client_id"]
    assert "snapshot_total_ttc" in listed[0]


@pytest.mark.asyncio
async def test_list_quotes_filter_by_status(client: AsyncClient):
    seeded = await _seed(client)
    for _ in range(2):
        await client.post(
            "/quotes",
            json={
                "client_id": seeded["client_id"],
                "model_ref": "NS300",
                "quantity": 10,
                "placements": [],
            },
        )
    # Tous draft par défaut
    r1 = await client.get("/quotes?status=draft")
    assert len(r1.json()) == 2
    r2 = await client.get("/quotes?status=on_hold")
    assert r2.json() == []


@pytest.mark.asyncio
async def test_get_quote_by_id(client: AsyncClient):
    seeded = await _seed(client)
    created = (
        await client.post(
            "/quotes",
            json={
                "client_id": seeded["client_id"],
                "model_ref": "NS300",
                "quantity": 30,
                "placements": ["Coeur"],
            },
        )
    ).json()

    r = await client.get(f"/quotes/{created['id']}")
    assert r.status_code == 200
    assert r.json()["reference"] == created["reference"]


@pytest.mark.asyncio
async def test_get_quote_unknown_returns_404(client: AsyncClient):
    r = await client.get("/quotes/00000000-0000-0000-0000-000000000000")
    assert r.status_code == 404


# ── Statut & suppression ──────────────────────────────────────────────


@pytest.mark.asyncio
async def test_update_status_to_on_hold(client: AsyncClient):
    seeded = await _seed(client)
    created = (
        await client.post(
            "/quotes",
            json={
                "client_id": seeded["client_id"],
                "model_ref": "NS300",
                "quantity": 10,
                "placements": [],
            },
        )
    ).json()
    r = await client.patch(
        f"/quotes/{created['id']}/status", json={"status": "on_hold"}
    )
    assert r.status_code == 200, r.text
    assert r.json()["status"] == "on_hold"


@pytest.mark.asyncio
async def test_update_status_invalid_value_returns_422(client: AsyncClient):
    seeded = await _seed(client)
    created = (
        await client.post(
            "/quotes",
            json={
                "client_id": seeded["client_id"],
                "model_ref": "NS300",
                "quantity": 10,
                "placements": [],
            },
        )
    ).json()
    r = await client.patch(
        f"/quotes/{created['id']}/status", json={"status": "not-a-status"}
    )
    assert r.status_code == 422


@pytest.mark.asyncio
async def test_soft_delete_removes_from_listing(client: AsyncClient):
    seeded = await _seed(client)
    created = (
        await client.post(
            "/quotes",
            json={
                "client_id": seeded["client_id"],
                "model_ref": "NS300",
                "quantity": 10,
                "placements": [],
            },
        )
    ).json()
    r = await client.delete(f"/quotes/{created['id']}")
    assert r.status_code == 204
    # Listing : 0 résultats
    listed = (await client.get("/quotes")).json()
    assert listed == []
    # Get direct : 404
    r2 = await client.get(f"/quotes/{created['id']}")
    assert r2.status_code == 404
