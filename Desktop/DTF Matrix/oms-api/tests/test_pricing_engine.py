"""Tests du moteur de tarification Textile 2026.

Couvre les critères d'acceptation §6 du prompt et les règles métier §3,
mises à jour pour l'étape 4-bis :
- transport TTC = 1,56 € **par unité** (× qty),
- TGCA appliquée uniquement sur la marchandise HT,
- remise commerciale en € soustraite au total.
"""
from decimal import Decimal

import pytest

from app.services.pricing_engine import (
    PricingInput,
    compute_quote,
    find_palier,
)


# ── Grille Textile 2026 (snapshot identique à la migration 0021) ─────────
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


# ─── find_palier — règles §2.2 du prompt ─────────────────────────────────


@pytest.mark.parametrize(
    "qty,expected_min",
    [
        (1, 1),
        (4, 1),
        (5, 5),
        (9, 5),
        (10, 10),
        (19, 10),
        (20, 20),
        (25, 20),    # critère §6.3
        (29, 20),
        (30, 30),
        (49, 40),
        (50, 50),
        (89, 80),
        (90, 90),
        (99, 90),    # exemple prompt
        (100, 100),
        (149, 100),
        (150, 150),
        (200, 150),  # critère §6.4
        (10000, 150),
    ],
)
def test_find_palier_returns_correct_minQty(qty, expected_min):
    palier = find_palier(qty, TEXTILE_2026_TIERS)
    assert palier is not None
    assert palier["minQty"] == expected_min


def test_find_palier_below_min_returns_none():
    assert find_palier(0, TEXTILE_2026_TIERS) is None
    assert find_palier(-5, TEXTILE_2026_TIERS) is None


def test_find_palier_empty_grid():
    assert find_palier(10, []) is None


# ─── compute_quote — critères d'acceptation §6.1 à §6.4 ──────────────────


def _ns300_input(**overrides):
    """Input par défaut : NS300, PA 4,05 €, qty 30, Cœur, TGCA off, transport on."""
    base = dict(
        purchase_price_ht=Decimal("4.05"),
        quantity=30,
        placements=("Coeur",),
        tiers=tuple(TEXTILE_2026_TIERS),
        transport_ttc_unit=Decimal("1.56"),
        transport_active=True,
        tgca_active=False,
        tgca_rate=Decimal("0.04"),
        discount=Decimal("0"),
    )
    base.update(overrides)
    return PricingInput(**base)


def test_critere_6_1_ns300_qty30_coeur_no_tgca():
    """§6.1 (révisé) : NS300 PA 4,05, qty 30, Cœur, TGCA off, transport on.

    Transport = 30 × 1,56 = 46,80 € → Total TTC = 332,40 + 46,80 = 379,20 €.
    """
    out = compute_quote(_ns300_input())

    assert out.palier_applique == 30
    assert out.coef == Decimal("1.73")
    assert out.prix_vierge_unit == Decimal("7.01")
    assert len(out.logos) == 1
    assert out.logos[0].placement == "Coeur"
    assert out.logos[0].unit_price == Decimal("4.07")
    assert out.prix_logos_unit == Decimal("4.07")
    assert out.prix_vente_ht_unit == Decimal("11.08")
    assert out.sous_total_ht == Decimal("332.40")
    # Transport ligne = 30 × 1,56
    assert out.transport_ttc == Decimal("46.80")
    assert out.montant_tgca == Decimal("0.00")
    assert out.discount == Decimal("0.00")
    assert out.total_avant_remise == Decimal("379.20")
    assert out.total_ttc == Decimal("379.20")


def test_critere_6_2_ns300_qty30_coeur_with_tgca():
    """§6.2 (révisé) : Même cas avec TGCA on.

    TGCA 4 % sur la marchandise seule = 332,40 × 0,04 = 13,296 → 13,30 €.
    Total TTC = 332,40 + 13,30 + 46,80 = 392,50 €.
    """
    out = compute_quote(_ns300_input(tgca_active=True))

    assert out.palier_applique == 30
    assert out.sous_total_ht == Decimal("332.40")
    assert out.transport_ttc == Decimal("46.80")
    assert out.montant_tgca == Decimal("13.30")
    assert out.total_avant_remise == Decimal("392.50")
    assert out.total_ttc == Decimal("392.50")


def test_critere_6_3_qty25_uses_palier_20():
    """§6.3 : qty 25 → palier 20 doit s'appliquer."""
    out = compute_quote(_ns300_input(quantity=25))
    assert out.palier_applique == 20
    assert out.coef == Decimal("1.82")
    # Vierge unit = 4.05 × 1.82 = 7.371 → 7.37 €
    assert out.prix_vierge_unit == Decimal("7.37")


def test_critere_6_4_qty200_uses_palier_150():
    """§6.4 : qty 200 → palier 150 doit s'appliquer."""
    out = compute_quote(_ns300_input(quantity=200))
    assert out.palier_applique == 150
    assert out.coef == Decimal("1.27")


# ─── Variantes additionnelles ────────────────────────────────────────────


def test_no_placements_returns_zero_logos():
    out = compute_quote(_ns300_input(placements=()))
    assert out.logos == []
    assert out.prix_logos_unit == Decimal("0.00")
    # Vierge seul × 30 = 7,01 × 30 = 210,30
    # + transport 30 × 1,56 = 46,80
    # → 257,10
    assert out.total_ttc == Decimal("257.10")


def test_all_six_placements_qty_50():
    """Exhaustif : palier 50, les 6 emplacements cochés."""
    out = compute_quote(
        _ns300_input(
            quantity=50,
            placements=("Coeur", "Poitrine", "AvantPlein", "ArrierePlein", "MancheG", "MancheD"),
        )
    )
    assert out.palier_applique == 50
    # Somme prix logos palier 50 = 3.57 + 4.11 + 7.30 + 7.30 + 3.57 + 3.57
    # = 29.42 €
    assert out.prix_logos_unit == Decimal("29.42")
    # Vierge unit = 4.05 × 1.55 = 6.2775 → 6.28 €
    assert out.prix_vierge_unit == Decimal("6.28")
    # Vente unit = 6.28 + 29.42 = 35.70 €
    assert out.prix_vente_ht_unit == Decimal("35.70")


def test_transport_disabled():
    """Transport désactivé → ligne à 0, TGCA inchangée."""
    out = compute_quote(_ns300_input(transport_active=False))
    assert out.transport_ttc == Decimal("0.00")
    # 332.40 + 0 + 0 = 332.40
    assert out.total_ttc == Decimal("332.40")


def test_pa_missing_returns_warning():
    """Si PA inconnu → pas de prix vierge, warning, total = transport seul."""
    out = compute_quote(_ns300_input(purchase_price_ht=None))
    assert out.prix_vierge_unit is None
    assert out.prix_vente_ht_unit is None
    assert any("achat" in w.lower() for w in out.warnings)
    # Sous-total = 0, transport = 30 × 1,56 = 46,80 → total = 46,80
    assert out.transport_ttc == Decimal("46.80")
    assert out.total_ttc == Decimal("46.80")


def test_qty_zero_returns_empty_with_warning():
    out = compute_quote(_ns300_input(quantity=0))
    assert out.palier_applique is None
    assert out.total_ttc == Decimal("0.00")
    assert len(out.warnings) >= 1


def test_unknown_placement_emits_warning():
    """Un emplacement non reconnu doit produire un warning sans casser le calcul."""
    inp = _ns300_input()
    inp2 = PricingInput(
        purchase_price_ht=inp.purchase_price_ht,
        quantity=inp.quantity,
        placements=("Coeur", "InvalidPlacement"),  # type: ignore
        tiers=inp.tiers,
        transport_ttc_unit=inp.transport_ttc_unit,
        transport_active=inp.transport_active,
        tgca_active=inp.tgca_active,
        tgca_rate=inp.tgca_rate,
        discount=inp.discount,
    )
    out = compute_quote(inp2)
    assert any(l.placement == "Coeur" for l in out.logos)
    assert any("Emplacement inconnu" in w or "manquant" in w for w in out.warnings)


def test_tgca_rate_custom():
    """La TGCA peut prendre un taux configurable (paramètres globaux)."""
    out = compute_quote(_ns300_input(tgca_active=True, tgca_rate=Decimal("0.10")))
    # marchandise = 332.40, TGCA 10 % = 33.24, transport = 46.80
    # → 332.40 + 33.24 + 46.80 = 412.44
    assert out.montant_tgca == Decimal("33.24")
    assert out.total_ttc == Decimal("412.44")


# ─── Remise commerciale (étape 4-bis) ────────────────────────────────────


def test_discount_subtracts_from_total():
    """Une remise de 50 € sur 379,20 € → total = 329,20 €."""
    out = compute_quote(_ns300_input(discount=Decimal("50")))
    assert out.total_avant_remise == Decimal("379.20")
    assert out.discount == Decimal("50.00")
    assert out.total_ttc == Decimal("329.20")


def test_discount_zero_is_default():
    """Sans remise, total avant et total final sont identiques."""
    out = compute_quote(_ns300_input())
    assert out.discount == Decimal("0.00")
    assert out.total_avant_remise == out.total_ttc


def test_discount_capped_at_total_avant_remise():
    """Une remise > total_avant_remise est plafonnée, total_ttc = 0."""
    out = compute_quote(_ns300_input(discount=Decimal("10000")))
    assert out.discount == Decimal("379.20")
    assert out.total_ttc == Decimal("0.00")
    assert any("plafonn" in w.lower() for w in out.warnings)


def test_discount_negative_ignored():
    """Une remise négative doit être ignorée (warning) et total inchangé."""
    out = compute_quote(_ns300_input(discount=Decimal("-50")))
    assert out.discount == Decimal("0.00")
    assert out.total_ttc == Decimal("379.20")
    assert any("négative" in w.lower() for w in out.warnings)


def test_discount_combined_with_tgca():
    """Remise s'applique après TGCA et transport (sur le total final)."""
    out = compute_quote(_ns300_input(tgca_active=True, discount=Decimal("100")))
    # total_avant_remise = 392.50 (cf. §6.2 révisé)
    assert out.total_avant_remise == Decimal("392.50")
    assert out.discount == Decimal("100.00")
    assert out.total_ttc == Decimal("292.50")
