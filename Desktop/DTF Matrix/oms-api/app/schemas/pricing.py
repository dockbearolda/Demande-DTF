"""Schémas Pydantic pour l'endpoint POST /pricing/compute.

Sérialisation Decimal → float pour transit JSON. Le moteur reste en
Decimal côté Python (cf. app/services/pricing_engine.py) ; on convertit
au moment de la sortie HTTP.
"""
from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


# ── Types partagés avec le moteur ────────────────────────────────────
LogoPlacementName = Literal[
    "Coeur",
    "Poitrine",
    "AvantPlein",
    "ArrierePlein",
    "MancheG",
    "MancheD",
]


# ── Requête ──────────────────────────────────────────────────────────
class PricingComputeRequest(BaseModel):
    """Input du calculateur de devis.

    `model_ref` cible un Product existant (Product.reference). Le PA et
    la matrice tarifaire utilisée proviennent du Product en base, sauf
    si `matrix_name` est fourni explicitement (ex. tests, simulations).
    """

    model_config = ConfigDict(extra="forbid")

    model_ref: str = Field(min_length=1, max_length=120)
    quantity: int = Field(ge=0)
    placements: list[LogoPlacementName] = Field(default_factory=list)
    transport_active: bool = True
    tgca_active: bool = False
    discount: float = Field(default=0.0, ge=0.0, description="Remise commerciale TTC en €.")
    matrix_name: str | None = Field(
        default=None,
        max_length=120,
        description="Override grille tarifaire (sinon : matrice du produit, ou « Textile 2026 »).",
    )


# ── Réponse ──────────────────────────────────────────────────────────
class LogoLineRead(BaseModel):
    placement: LogoPlacementName
    unit_price: float


class PricingComputeResponse(BaseModel):
    """Sortie sérialisable du moteur.

    Tous les montants sont en EUR, arrondis à 2 décimales.
    `prix_vierge_unit` et `prix_vente_ht_unit` sont nullables si le PA
    est manquant — voir `warnings`.
    """

    quantity: int
    palier_applique: int | None
    coef: float | None
    prix_vierge_unit: float | None
    logos: list[LogoLineRead] = Field(default_factory=list)
    prix_logos_unit: float
    prix_vente_ht_unit: float | None
    sous_total_ht: float
    transport_ttc: float
    montant_tgca: float
    total_avant_remise: float
    discount: float
    total_ttc: float
    warnings: list[str] = Field(default_factory=list)
    # Métadonnées (utiles côté frontend pour debug / reconstruction).
    matrix_name: str
    purchase_price_ht: float | None
