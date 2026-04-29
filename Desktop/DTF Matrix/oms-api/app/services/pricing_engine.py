"""Moteur de tarification Textile 2026.

Source de vérité serveur. Le frontend duplique cette logique pour la fluidité
(<100 ms, recalcul live), et le backend re-valide à l'enregistrement du devis.

Règles métier (cf. prompt §3, complétées étape 4-bis) :
- Palier appliqué = palier inférieur ou égal à la quantité saisie. Pas d'interpolation.
- PrixVierge_unit = PA × coef(palier).
- PrixLogos_unit = Σ prix d'emplacement(palier) pour chaque emplacement coché.
- Prix de vente HT_unit = Vierge + Logos.
- Sous-total HT (marchandise) = qty × prix_vente_ht_unit.
- Transport : 1,56 € TTC **par unité** (× qty), case à cocher pour activer/désactiver
  la ligne. Le transport n'entre PAS dans l'assiette TGCA.
- TGCA (4 % par défaut) appliquée sur le sous-total HT marchandise UNIQUEMENT.
- Remise commerciale : montant TTC fixe soustrait au total final, clampé à
  [0, total_avant_remise] (jamais de total négatif, jamais de remise majorante).
- Tous les montants finaux arrondis à 2 décimales (ROUND_HALF_UP).
"""
from __future__ import annotations

from dataclasses import dataclass, field
from decimal import Decimal, ROUND_CEILING, ROUND_HALF_UP
from typing import Iterable, Literal


# ─── Types & constantes ──────────────────────────────────────────────────

LogoPlacement = Literal[
    "Coeur",
    "Poitrine",
    "AvantPlein",
    "ArrierePlein",
    "MancheG",
    "MancheD",
]

ALL_PLACEMENTS: tuple[LogoPlacement, ...] = (
    "Coeur",
    "Poitrine",
    "AvantPlein",
    "ArrierePlein",
    "MancheG",
    "MancheD",
)

# Mapping placement → clé JSON dans tiers_json (palier).
PLACEMENT_TO_TIER_KEY: dict[LogoPlacement, str] = {
    "Coeur": "coeur",
    "Poitrine": "poitrine",
    "AvantPlein": "avantPlein",
    "ArrierePlein": "arrierePlein",
    "MancheG": "mancheG",
    "MancheD": "mancheD",
}


def _q2(x: Decimal) -> Decimal:
    """Arrondi à 2 décimales, ROUND_HALF_UP (règle commerciale FR)."""
    return x.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


_HALF = Decimal("0.5")


def _round_up_05(x: Decimal) -> Decimal:
    """Arrondi au 0,5 supérieur : 1,03 → 1,5 ; 1,78 → 2,0.

    Calcul Decimal-pur — pas de passage par float (sinon on réintroduit les
    erreurs binaires que tout le moteur évite par construction).
    """
    return (x / _HALF).to_integral_value(rounding=ROUND_CEILING) * _HALF


# ─── Lookup de palier ────────────────────────────────────────────────────


def find_palier(qty: int, tiers: Iterable[dict]) -> dict | None:
    """Retourne le palier applicable pour `qty` (palier inférieur ou égal).

    - Si `qty` < min(minQty), retourne None.
    - Si `qty` >= max(minQty), retourne le dernier palier (cf. règle
      "au-delà de 150, conserver la grille 150").
    """
    if qty < 1:
        return None
    sorted_tiers = sorted(tiers, key=lambda t: t["minQty"])
    if not sorted_tiers:
        return None
    chosen: dict | None = None
    for t in sorted_tiers:
        if t["minQty"] <= qty:
            chosen = t
        else:
            break
    return chosen


# ─── Entrée / sortie ─────────────────────────────────────────────────────


@dataclass(frozen=True)
class PricingInput:
    purchase_price_ht: Decimal | None  # PA modèle (None si non renseigné)
    quantity: int
    placements: tuple[LogoPlacement, ...]
    tiers: tuple[dict, ...]  # grille tarifaire (snapshot tiers_json)
    # Tarif unitaire transport TTC (par t-shirt). Le total ligne est
    # qty × transport_ttc_unit.
    transport_ttc_unit: Decimal = Decimal("1.56")
    transport_active: bool = True
    tgca_active: bool = False
    tgca_rate: Decimal = Decimal("0.04")
    # Remise commerciale TTC (montant fixe). Clampée par le moteur.
    discount: Decimal = Decimal("0")


@dataclass
class LogoLine:
    placement: LogoPlacement
    unit_price: Decimal


@dataclass
class PricingOutput:
    quantity: int
    palier_applique: int | None
    coef: Decimal | None
    prix_vierge_unit: Decimal | None  # None si PA manquant
    logos: list[LogoLine] = field(default_factory=list)
    prix_logos_unit: Decimal = Decimal("0.00")
    prix_vente_ht_unit: Decimal | None = None  # None si PA manquant
    sous_total_ht: Decimal = Decimal("0.00")  # marchandise = qty × prix_vente_ht_unit
    transport_ttc: Decimal = Decimal("0.00")  # ligne transport totale (qty × unit)
    montant_tgca: Decimal = Decimal("0.00")  # sur marchandise seule
    total_avant_remise: Decimal = Decimal("0.00")  # marchandise + tgca + transport
    discount: Decimal = Decimal("0.00")  # montant effectivement appliqué (après clamp)
    total_ttc: Decimal = Decimal("0.00")  # total - remise
    warnings: list[str] = field(default_factory=list)


# ─── Calcul ──────────────────────────────────────────────────────────────


def compute_quote(inp: PricingInput) -> PricingOutput:
    """Calcule le récapitulatif d'un devis selon les règles §3 du prompt.

    Pas de validation d'entrée (pour qty<1 etc.) : on retourne un output vide.
    Le caller (route ou test) est responsable de la validation.
    """
    out = PricingOutput(quantity=max(inp.quantity, 0), palier_applique=None, coef=None,
                        prix_vierge_unit=None)

    if inp.quantity < 1:
        out.warnings.append("Quantité < 1 — devis vide.")
        return out

    palier = find_palier(inp.quantity, inp.tiers)
    if palier is None:
        out.warnings.append("Aucun palier applicable pour cette quantité.")
        return out

    out.palier_applique = palier["minQty"]
    coef = palier.get("coef")
    if coef is not None:
        out.coef = Decimal(str(coef))

    # Prix vierge (PA × coef)
    if inp.purchase_price_ht is None:
        out.warnings.append("Prix d'achat du modèle non renseigné.")
        out.prix_vierge_unit = None
    elif out.coef is None:
        out.warnings.append("Coefficient absent du palier.")
        out.prix_vierge_unit = None
    else:
        out.prix_vierge_unit = _q2(inp.purchase_price_ht * out.coef)

    # Prix logos (somme des emplacements cochés)
    logos_total = Decimal("0.00")
    for p in inp.placements:
        key = PLACEMENT_TO_TIER_KEY.get(p)
        if key is None:
            out.warnings.append(f"Emplacement inconnu : {p}")
            continue
        raw = palier.get(key)
        if raw is None:
            out.warnings.append(f"Prix manquant dans le palier pour {p}.")
            continue
        unit = _q2(Decimal(str(raw)))
        out.logos.append(LogoLine(placement=p, unit_price=unit))
        logos_total += unit
    out.prix_logos_unit = _q2(logos_total)

    # Prix vente HT unitaire = vierge + logos, arrondi au 0,5 supérieur
    if out.prix_vierge_unit is None:
        out.prix_vente_ht_unit = None
    else:
        out.prix_vente_ht_unit = _round_up_05(_q2(out.prix_vierge_unit + out.prix_logos_unit))

    # Sous-total HT (marchandise) = qty × prix_vente_ht_unit
    if out.prix_vente_ht_unit is not None:
        out.sous_total_ht = _q2(out.prix_vente_ht_unit * Decimal(inp.quantity))
    else:
        out.sous_total_ht = Decimal("0.00")

    # Transport ligne = qty × tarif unitaire TTC (si actif)
    if inp.transport_active:
        out.transport_ttc = _q2(inp.transport_ttc_unit * Decimal(inp.quantity))
    else:
        out.transport_ttc = Decimal("0.00")

    # TGCA — sur la marchandise UNIQUEMENT (pas sur le transport).
    rate = inp.tgca_rate if inp.tgca_active else Decimal("0")
    if inp.tgca_active and rate > 0:
        out.montant_tgca = _q2(out.sous_total_ht * rate)
    else:
        out.montant_tgca = Decimal("0.00")

    # Total avant remise
    out.total_avant_remise = _q2(
        out.sous_total_ht + out.montant_tgca + out.transport_ttc
    )

    # Remise commerciale (clampée à [0, total_avant_remise])
    raw_discount = inp.discount
    if raw_discount < 0:
        out.warnings.append("Remise négative ignorée.")
        applied = Decimal("0")
    elif raw_discount > out.total_avant_remise:
        out.warnings.append("Remise plafonnée au total avant remise.")
        applied = out.total_avant_remise
    else:
        applied = raw_discount
    out.discount = _q2(applied)

    out.total_ttc = _q2(out.total_avant_remise - out.discount)

    return out
