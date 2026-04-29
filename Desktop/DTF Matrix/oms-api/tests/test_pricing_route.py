"""Tests d'intégration HTTP pour POST /pricing/compute.

Reproduit les critères d'acceptation §6 (révisés étape 4-bis) en passant
par l'endpoint, pour s'assurer que la sérialisation JSON ne dégrade pas
les résultats du moteur. Transport = 1,56 € **par unité**, TGCA sur la
marchandise seule, remise commerciale en €.
"""
import pytest
from httpx import AsyncClient


# ── Grille Textile 2026 (snapshot identique à la migration 0021) ─────
TEXTILE_2026_TIERS = [
    {"minQty": 1,   "coef": 3.80, "coeur": 9.50, "poitrine": 10.93, "avantPlein": 16.20, "arrierePlein": 16.20, "mancheG": 9.50, "mancheD": 9.50},
    {"minQty": 5,   "coef": 2.09, "coeur": 6.37, "poitrine": 7.33,  "avantPlein": 12.10, "arrierePlein": 12.10, "mancheG": 6.37, "mancheD": 6.37},
    {"minQty": 10,  "coef": 1.91, "coeur": 5.10, "poitrine": 5.86,  "avantPlein": 10.80, "arrierePlein": 10.80, "mancheG": 5.10, "mancheD": 5.10},
    {"minQty": 20,  "coef": 1.82, "coeur": 4.47, "poitrine": 5.14,  "avantPlein":  9.45, "arrierePlein":  9.45, "mancheG": 4.47, "mancheD": 4.47},
    {"minQty": 30,  "coef": 1.73, "coeur": 4.07, "poitrine": 4.69,  "avantPlein":  8.10, "arrierePlein":  8.10, "mancheG": 4.07, "mancheD": 4.07},
    {"minQty": 40,  "coef": 1.64, "coeur": 3.82, "poitrine": 4.40,  "avantPlein":  7.60, "arrierePlein":  7.60, "mancheG": 3.82, "mancheD": 3.82},
    {"minQty": 50,  "coef": 1.55, "coeur": 3.57, "poitrine": 4.11,  "avantPlein":  7.30, "arrierePlein":  7.30, "mancheG": 3.57, "mancheD": 3.57},
    {"minQty": 60,  "coef": 1.50, "coeur": 3.44, "poitrine": 3.96,  "avantPlein":  7.00, "arrierePlein":  7.00, "mancheG": 3.44, "mancheD": 3.44},
    {"minQty": 70,  "coef": 1.46, "coeur": 3.32, "poitrine": 3.82,  "avantPlein":  6.80, "arrierePlein":  6.80, "mancheG": 3.32, "mancheD": 3.32},
    {"minQty": 80,  "coef": 1.37, "coeur": 3.19, "poitrine": 3.67,  "avantPlein":  6.50, "arrierePlein":  6.50, "mancheG": 3.19, "mancheD": 3.19},
    {"minQty": 90,  "coef": 1.32, "coeur": 3.05, "poitrine": 3.51,  "avantPlein":  6.20, "arrierePlein":  6.20, "mancheG": 3.05, "mancheD": 3.05},
    {"minQty": 100, "coef": 1.27, "coeur": 2.93, "poitrine": 3.36,  "avantPlein":  5.90, "arrierePlein":  5.90, "mancheG": 2.93, "mancheD": 2.93},
    {"minQty": 150, "coef": 1.27, "coeur": 2.80, "poitrine": 3.22,  "avantPlein":  5.70, "arrierePlein":  5.70, "mancheG": 2.80, "mancheD": 2.80},
]


async def _seed_ns300(client: AsyncClient, *, pa: float | None = 4.05) -> None:
    """Crée family/subfamily/matrix Textile 2026 + Product NS300."""
    fam = (await client.post(
        "/catalog/families",
        json={"slug": "textile", "label": "Textile"},
    )).json()
    sf = (await client.post(
        f"/catalog/families/{fam['id']}/subfamilies",
        json={"slug": "polos", "label": "Polos"},
    )).json()
    matrix = (await client.post(
        "/catalog/pricing-matrices",
        json={
            "name": "Textile 2026",
            "currency": "EUR",
            "tiers": TEXTILE_2026_TIERS,
        },
    )).json()
    payload: dict = {
        "reference": "NS300",
        "name": "Polo NS300",
        "pricing_matrix_id": matrix["id"],
        "colors": [],
        "sizes": [],
    }
    if pa is not None:
        payload["purchase_price_ht"] = pa
    r = await client.post(
        f"/catalog/subfamilies/{sf['id']}/products",
        json=payload,
    )
    assert r.status_code == 201, r.text


# ─── Critères §6 révisés via HTTP ────────────────────────────────────


@pytest.mark.asyncio
async def test_route_critere_6_1_ns300_qty30_coeur_no_tgca(client: AsyncClient):
    """§6.1 (révisé) : qty 30 / Cœur / TGCA off / transport on → 379,20 €."""
    await _seed_ns300(client)
    r = await client.post(
        "/pricing/compute",
        json={
            "model_ref": "NS300",
            "quantity": 30,
            "placements": ["Coeur"],
            "transport_active": True,
            "tgca_active": False,
        },
    )
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["palier_applique"] == 30
    assert data["coef"] == pytest.approx(1.73)
    assert data["prix_vierge_unit"] == pytest.approx(7.01)
    assert data["prix_logos_unit"] == pytest.approx(4.07)
    assert data["prix_vente_ht_unit"] == pytest.approx(11.08)
    assert data["sous_total_ht"] == pytest.approx(332.40)
    assert data["transport_ttc"] == pytest.approx(46.80)
    assert data["montant_tgca"] == pytest.approx(0.00)
    assert data["discount"] == pytest.approx(0.00)
    assert data["total_avant_remise"] == pytest.approx(379.20)
    assert data["total_ttc"] == pytest.approx(379.20)
    assert data["matrix_name"] == "Textile 2026"


@pytest.mark.asyncio
async def test_route_critere_6_2_ns300_qty30_coeur_with_tgca(client: AsyncClient):
    """§6.2 (révisé) : Même cas avec TGCA on → 392,50 € (TGCA sur marchandise seule)."""
    await _seed_ns300(client)
    r = await client.post(
        "/pricing/compute",
        json={
            "model_ref": "NS300",
            "quantity": 30,
            "placements": ["Coeur"],
            "transport_active": True,
            "tgca_active": True,
        },
    )
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["sous_total_ht"] == pytest.approx(332.40)
    assert data["montant_tgca"] == pytest.approx(13.30)
    assert data["transport_ttc"] == pytest.approx(46.80)
    assert data["total_avant_remise"] == pytest.approx(392.50)
    assert data["total_ttc"] == pytest.approx(392.50)


@pytest.mark.asyncio
async def test_route_critere_6_3_qty25_uses_palier_20(client: AsyncClient):
    """§6.3 : qty 25 → palier 20."""
    await _seed_ns300(client)
    r = await client.post(
        "/pricing/compute",
        json={
            "model_ref": "NS300",
            "quantity": 25,
            "placements": ["Coeur"],
        },
    )
    data = r.json()
    assert data["palier_applique"] == 20
    assert data["coef"] == pytest.approx(1.82)
    assert data["prix_vierge_unit"] == pytest.approx(7.37)


@pytest.mark.asyncio
async def test_route_critere_6_4_qty200_uses_palier_150(client: AsyncClient):
    """§6.4 : qty 200 → palier 150."""
    await _seed_ns300(client)
    r = await client.post(
        "/pricing/compute",
        json={
            "model_ref": "NS300",
            "quantity": 200,
            "placements": ["Coeur"],
        },
    )
    data = r.json()
    assert data["palier_applique"] == 150
    assert data["coef"] == pytest.approx(1.27)


# ─── Edge cases & erreurs ────────────────────────────────────────────


@pytest.mark.asyncio
async def test_route_unknown_product_returns_404(client: AsyncClient):
    await _seed_ns300(client)
    r = await client.post(
        "/pricing/compute",
        json={"model_ref": "DOES_NOT_EXIST", "quantity": 10, "placements": []},
    )
    assert r.status_code == 404


@pytest.mark.asyncio
async def test_route_unknown_matrix_override_returns_404(client: AsyncClient):
    await _seed_ns300(client)
    r = await client.post(
        "/pricing/compute",
        json={
            "model_ref": "NS300",
            "quantity": 10,
            "placements": [],
            "matrix_name": "Inexistante",
        },
    )
    assert r.status_code == 404


@pytest.mark.asyncio
async def test_route_pa_missing_emits_warning_and_charges_transport_only(
    client: AsyncClient,
):
    """Si PA absent : prix_vierge_unit=null, warning, total = transport seul (qty × 1,56)."""
    await _seed_ns300(client, pa=None)
    r = await client.post(
        "/pricing/compute",
        json={
            "model_ref": "NS300",
            "quantity": 30,
            "placements": ["Coeur"],
            "transport_active": True,
            "tgca_active": False,
        },
    )
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["prix_vierge_unit"] is None
    assert data["prix_vente_ht_unit"] is None
    assert any("achat" in w.lower() for w in data["warnings"])
    # 30 × 1,56 = 46,80
    assert data["transport_ttc"] == pytest.approx(46.80)
    assert data["total_ttc"] == pytest.approx(46.80)


@pytest.mark.asyncio
async def test_route_six_placements_qty50(client: AsyncClient):
    """Sanity: les 6 emplacements simultanés transitent bien via JSON."""
    await _seed_ns300(client)
    r = await client.post(
        "/pricing/compute",
        json={
            "model_ref": "NS300",
            "quantity": 50,
            "placements": [
                "Coeur",
                "Poitrine",
                "AvantPlein",
                "ArrierePlein",
                "MancheG",
                "MancheD",
            ],
            "transport_active": True,
            "tgca_active": False,
        },
    )
    data = r.json()
    assert data["palier_applique"] == 50
    assert len(data["logos"]) == 6
    assert data["prix_logos_unit"] == pytest.approx(29.42)
    assert data["prix_vierge_unit"] == pytest.approx(6.28)
    assert data["prix_vente_ht_unit"] == pytest.approx(35.70)


@pytest.mark.asyncio
async def test_route_transport_disabled(client: AsyncClient):
    await _seed_ns300(client)
    r = await client.post(
        "/pricing/compute",
        json={
            "model_ref": "NS300",
            "quantity": 30,
            "placements": ["Coeur"],
            "transport_active": False,
            "tgca_active": False,
        },
    )
    data = r.json()
    assert data["transport_ttc"] == pytest.approx(0.00)
    assert data["total_ttc"] == pytest.approx(332.40)


@pytest.mark.asyncio
async def test_route_validation_negative_quantity_rejected(client: AsyncClient):
    await _seed_ns300(client)
    r = await client.post(
        "/pricing/compute",
        json={"model_ref": "NS300", "quantity": -5, "placements": []},
    )
    assert r.status_code == 422


@pytest.mark.asyncio
async def test_route_validation_unknown_placement_rejected(client: AsyncClient):
    await _seed_ns300(client)
    r = await client.post(
        "/pricing/compute",
        json={
            "model_ref": "NS300",
            "quantity": 10,
            "placements": ["NotAPlacement"],
        },
    )
    assert r.status_code == 422


@pytest.mark.asyncio
async def test_route_validation_negative_discount_rejected(client: AsyncClient):
    """Pydantic rejette une remise négative en 422."""
    await _seed_ns300(client)
    r = await client.post(
        "/pricing/compute",
        json={
            "model_ref": "NS300",
            "quantity": 30,
            "placements": ["Coeur"],
            "discount": -10,
        },
    )
    assert r.status_code == 422


@pytest.mark.asyncio
async def test_route_uses_custom_taux_tgca_from_params(client: AsyncClient):
    """Si l'admin change taux_tgca à 10 %, le calcul doit suivre.

    Marchandise = 332,40 ; TGCA 10 % = 33,24 ; transport = 46,80 → 412,44.
    """
    await _seed_ns300(client)
    r = await client.put("/admin/parametres", json={"taux_tgca": 0.10})
    assert r.status_code == 200
    r2 = await client.post(
        "/pricing/compute",
        json={
            "model_ref": "NS300",
            "quantity": 30,
            "placements": ["Coeur"],
            "transport_active": True,
            "tgca_active": True,
        },
    )
    data = r2.json()
    assert data["montant_tgca"] == pytest.approx(33.24)
    assert data["total_ttc"] == pytest.approx(412.44)


@pytest.mark.asyncio
async def test_route_discount_subtracts_from_total(client: AsyncClient):
    """Une remise de 50 € sur 379,20 → 329,20 €."""
    await _seed_ns300(client)
    r = await client.post(
        "/pricing/compute",
        json={
            "model_ref": "NS300",
            "quantity": 30,
            "placements": ["Coeur"],
            "discount": 50,
        },
    )
    data = r.json()
    assert data["total_avant_remise"] == pytest.approx(379.20)
    assert data["discount"] == pytest.approx(50.00)
    assert data["total_ttc"] == pytest.approx(329.20)


@pytest.mark.asyncio
async def test_route_discount_capped_at_total(client: AsyncClient):
    """Remise > total_avant_remise → plafonnée, total = 0, warning."""
    await _seed_ns300(client)
    r = await client.post(
        "/pricing/compute",
        json={
            "model_ref": "NS300",
            "quantity": 30,
            "placements": ["Coeur"],
            "discount": 9999,
        },
    )
    data = r.json()
    assert data["discount"] == pytest.approx(379.20)
    assert data["total_ttc"] == pytest.approx(0.00)
    assert any("plafonn" in w.lower() for w in data["warnings"])
