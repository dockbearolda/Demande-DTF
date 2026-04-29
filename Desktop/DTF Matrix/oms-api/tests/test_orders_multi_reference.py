"""Tests for multi-reference order creation.

Covers:
  - creating an order with N heterogeneous lines (textile + magnet + sticker),
    each with their own variants and artworks;
  - montant_total recomputed from variants when supplied;
  - legacy mono-reference payloads still produce a synthetic blanket variant;
  - PUT /orders/{id} with new line shape replaces variants atomically.
"""
import pytest
from httpx import AsyncClient


async def _create_client(client: AsyncClient, headers: dict[str, str]) -> str:
    r = await client.post(
        "/clients",
        json={"nom": "ACME Multi", "email": "multi@example.com"},
        headers=headers,
    )
    assert r.status_code == 201
    return r.json()["id"]


@pytest.mark.asyncio
async def test_create_order_with_variants_computes_total(
    client: AsyncClient, auth_headers
):
    cid = await _create_client(client, auth_headers)
    payload = {
        "client_id": cid,
        "reference": "ORD-MULTI-1",
        "lines": [
            {
                "ligne_numero": 1,
                "secteur": "DTF",
                "product_type": "TSHIRT",
                "produit": "T-shirt CGTU01",
                "quantite": 24,
                "prix_unitaire": "0",
                "variants": [
                    {"color": "black", "size": "M", "qty": 12, "unit_price_ht": "9.50"},
                    {"color": "black", "size": "L", "qty": 8, "unit_price_ht": "9.50"},
                    {"color": "white", "size": "M", "qty": 4, "unit_price_ht": "9.50"},
                ],
                "artworks": [
                    {"side": "front", "placement": "front-center"},
                ],
            },
            {
                "ligne_numero": 2,
                "secteur": "UV",
                "product_type": "MAGNET",
                "produit": "Magnet acrylique 50x50",
                "quantite": 100,
                "prix_unitaire": "0",
                "variants": [
                    {"format": "50x50mm", "qty": 100, "unit_price_ht": "1.20"},
                ],
            },
        ],
    }
    r = await client.post("/orders", json=payload, headers=auth_headers)
    assert r.status_code == 201, r.text
    body = r.json()

    # 24 × 9.50 + 100 × 1.20 = 228.00 + 120.00 = 348.00
    assert body["montant_total"] == "348.00"
    assert len(body["lines"]) == 2

    line1 = next(l for l in body["lines"] if l["ligne_numero"] == 1)
    assert line1["product_type"] == "TSHIRT"
    assert len(line1["variants"]) == 3
    assert sum(v["qty"] for v in line1["variants"]) == 24
    assert len(line1["artworks"]) == 1
    assert line1["artworks"][0]["side"] == "front"

    line2 = next(l for l in body["lines"] if l["ligne_numero"] == 2)
    assert line2["product_type"] == "MAGNET"
    assert line2["variants"][0]["format"] == "50x50mm"


@pytest.mark.asyncio
async def test_legacy_mono_reference_creates_blanket_variant(
    client: AsyncClient, auth_headers
):
    """Legacy clients sending only (produit, quantite, prix_unitaire) still
    work — a synthetic variant is created so the new schema stays consistent."""
    cid = await _create_client(client, auth_headers)
    r = await client.post(
        "/orders",
        json={
            "client_id": cid,
            "reference": "ORD-LEGACY",
            "lines": [
                {
                    "ligne_numero": 1,
                    "secteur": "DTF",
                    "produit": "Old item",
                    "quantite": 5,
                    "prix_unitaire": "10.00",
                },
            ],
        },
        headers=auth_headers,
    )
    assert r.status_code == 201
    body = r.json()
    assert body["montant_total"] == "50.00"
    line = body["lines"][0]
    assert len(line["variants"]) == 1
    assert line["variants"][0]["qty"] == 5
    assert line["variants"][0]["unit_price_ht"] == "10.00"


@pytest.mark.asyncio
async def test_update_order_replaces_lines_with_variants(
    client: AsyncClient, auth_headers
):
    cid = await _create_client(client, auth_headers)
    r = await client.post(
        "/orders",
        json={
            "client_id": cid,
            "reference": "ORD-PUT",
            "lines": [
                {
                    "ligne_numero": 1,
                    "secteur": "DTF",
                    "produit": "X",
                    "quantite": 1,
                    "prix_unitaire": "1.00",
                }
            ],
        },
        headers=auth_headers,
    )
    oid = r.json()["id"]

    # Replace with a multi-variant line.
    r2 = await client.put(
        f"/orders/{oid}",
        json={
            "lines": [
                {
                    "ligne_numero": 1,
                    "secteur": "DTF",
                    "product_type": "TSHIRT",
                    "produit": "Updated",
                    "quantite": 10,
                    "prix_unitaire": "0",
                    "variants": [
                        {"color": "navy", "size": "M", "qty": 6, "unit_price_ht": "8.00"},
                        {"color": "navy", "size": "L", "qty": 4, "unit_price_ht": "8.00"},
                    ],
                }
            ]
        },
        headers=auth_headers,
    )
    assert r2.status_code == 200, r2.text
    body = r2.json()
    # 10 × 8.00 = 80.00
    assert body["montant_total"] == "80.00"
    assert body["lines"][0]["variants"][0]["color"] == "navy"
    assert len(body["lines"][0]["variants"]) == 2


@pytest.mark.asyncio
async def test_get_order_includes_variants_and_artworks(
    client: AsyncClient, auth_headers
):
    cid = await _create_client(client, auth_headers)
    r = await client.post(
        "/orders",
        json={
            "client_id": cid,
            "reference": "ORD-GET",
            "lines": [
                {
                    "ligne_numero": 1,
                    "secteur": "Textiles" if False else "DTF",
                    "product_type": "TSHIRT",
                    "produit": "T",
                    "quantite": 3,
                    "prix_unitaire": "0",
                    "variants": [
                        {"color": "red", "size": "S", "qty": 3, "unit_price_ht": "12.00"}
                    ],
                    "artworks": [
                        {"side": "back", "placement": "back"},
                        {"side": "front", "placement": "front-heart"},
                    ],
                }
            ],
        },
        headers=auth_headers,
    )
    oid = r.json()["id"]

    r2 = await client.get(f"/orders/{oid}", headers=auth_headers)
    assert r2.status_code == 200
    body = r2.json()
    assert len(body["lines"][0]["artworks"]) == 2
    assert {a["side"] for a in body["lines"][0]["artworks"]} == {"front", "back"}


@pytest.mark.asyncio
async def test_position_field_persists(client: AsyncClient, auth_headers):
    cid = await _create_client(client, auth_headers)
    r = await client.post(
        "/orders",
        json={
            "client_id": cid,
            "reference": "ORD-POS",
            "lines": [
                {"ligne_numero": 1, "position": 2, "secteur": "DTF", "produit": "A", "quantite": 1, "prix_unitaire": "1"},
                {"ligne_numero": 2, "position": 0, "secteur": "DTF", "produit": "B", "quantite": 1, "prix_unitaire": "1"},
                {"ligne_numero": 3, "position": 1, "secteur": "DTF", "produit": "C", "quantite": 1, "prix_unitaire": "1"},
            ],
        },
        headers=auth_headers,
    )
    assert r.status_code == 201
    body = r.json()
    # Lines should come back ordered by position (B, C, A).
    produits = [l["produit"] for l in body["lines"]]
    assert produits == ["B", "C", "A"]


@pytest.mark.asyncio
async def test_create_order_with_sourcing_line_promotes_status(
    client: AsyncClient, auth_headers
):
    """Une commande qui contient au moins une ligne `is_sourcing_required=True`
    et qui n'a pas de statut explicite est créée en EN_ATTENTE_SOURCING au
    lieu de DRAFT — ainsi elle apparaît dans la colonne dédiée du Kanban."""
    cid = await _create_client(client, auth_headers)
    r = await client.post(
        "/orders",
        json={
            "client_id": cid,
            "reference": "ORD-SOURCING-1",
            "lines": [
                {
                    "ligne_numero": 1,
                    "secteur": "DTF",
                    "product_type": "TSHIRT",
                    "produit": "T-shirt CGTU01",
                    "quantite": 3,
                    "prix_unitaire": "10",
                },
                {
                    "ligne_numero": 2,
                    "secteur": "AUTRES",
                    "produit": "Casquettes 5-panel marine",
                    "quantite": 25,
                    "prix_unitaire": "0",
                    "is_sourcing_required": True,
                    "sourcing_description": "Casquettes 5-panel marine ou noir mat, broderie devant possible. ~25 personnes, livraison sous 3 semaines.",
                    "sourcing_budget_estime": "12.50",
                },
            ],
        },
        headers=auth_headers,
    )
    assert r.status_code == 201
    body = r.json()
    assert body["statut"] == "EN_ATTENTE_SOURCING"
    sourcing_line = next(
        l for l in body["lines"] if l["produit"].startswith("Casquettes")
    )
    assert sourcing_line["is_sourcing_required"] is True
    assert "Casquettes 5-panel" in sourcing_line["sourcing_description"]
    assert sourcing_line["sourcing_budget_estime"] == "12.50"


@pytest.mark.asyncio
async def test_create_order_without_sourcing_keeps_default_status(
    client: AsyncClient, auth_headers
):
    cid = await _create_client(client, auth_headers)
    r = await client.post(
        "/orders",
        json={
            "client_id": cid,
            "reference": "ORD-NO-SOURCING",
            "lines": [
                {
                    "ligne_numero": 1,
                    "secteur": "DTF",
                    "produit": "Planche A3",
                    "quantite": 1,
                    "prix_unitaire": "8",
                },
            ],
        },
        headers=auth_headers,
    )
    assert r.status_code == 201
    assert r.json()["statut"] == "DRAFT"


@pytest.mark.asyncio
async def test_sourcing_kanban_transitions(client: AsyncClient, auth_headers):
    """EN_ATTENTE_SOURCING peut transitionner vers EN_ATTENTE_BAT, CONFIRMED
    ou CANCELLED — le manager n'est jamais bloqué après le sourcing."""
    cid = await _create_client(client, auth_headers)
    r = await client.post(
        "/orders",
        json={
            "client_id": cid,
            "reference": "ORD-SOURCING-FLOW",
            "lines": [
                {
                    "ligne_numero": 1,
                    "secteur": "AUTRES",
                    "produit": "Tote bag custom",
                    "quantite": 50,
                    "prix_unitaire": "0",
                    "is_sourcing_required": True,
                    "sourcing_description": "Toiles 250g/m2",
                },
            ],
        },
        headers=auth_headers,
    )
    assert r.status_code == 201
    order_id = r.json()["id"]

    # EN_ATTENTE_SOURCING → CONFIRMED (sourcing terminé, prix fixés).
    r2 = await client.patch(
        f"/orders/{order_id}/status",
        json={"statut": "CONFIRMED"},
        headers=auth_headers,
    )
    assert r2.status_code == 200
    assert r2.json()["statut"] == "CONFIRMED"
