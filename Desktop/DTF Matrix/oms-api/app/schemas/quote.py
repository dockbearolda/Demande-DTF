"""Schémas Pydantic pour les devis (Quote).

Le payload de création réutilise les champs déjà validés par
`PricingComputeRequest` (cf. app/schemas/pricing.py) — c'est l'état du
store frontend au moment où l'utilisateur clique « Enregistrer ».

La réponse Read inclut le snapshot complet du moteur pour que le PDF /
les actions de sortie (étape 5B) puissent reconstituer le devis sans
recalcul.
"""
from __future__ import annotations

import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.pricing import LogoPlacementName


# ── Statut ───────────────────────────────────────────────────────────
QuoteStatusName = Literal["draft", "on_hold", "sent", "converted"]


# ── Création ─────────────────────────────────────────────────────────
class QuoteCreate(BaseModel):
    """Snapshot du store frontend au moment de l'enregistrement.

    Le serveur recalcule les montants via le moteur pricing (source de
    vérité) à partir de ces champs. Toute divergence frontend/backend
    sera donc résolue côté serveur.
    """

    model_config = ConfigDict(extra="forbid")

    client_id: uuid.UUID
    model_ref: str = Field(min_length=1, max_length=120)
    quantity: int = Field(ge=1)
    placements: list[LogoPlacementName] = Field(default_factory=list)
    transport_active: bool = True
    tgca_active: bool = False
    discount: float = Field(default=0.0, ge=0.0)
    notes: str | None = Field(default=None, max_length=2000)
    matrix_name: str | None = Field(
        default=None,
        max_length=120,
        description="Override grille tarifaire (sinon : matrice du produit, ou « Textile 2026 »).",
    )


# ── Réponse ──────────────────────────────────────────────────────────
class QuoteClientSummary(BaseModel):
    """Sous-objet client pour les listes de devis."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    nom: str
    email: str | None = None


class QuoteRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    reference: str
    client_id: uuid.UUID
    client: QuoteClientSummary

    model_ref: str
    matrix_name: str
    quantity: int
    placements: list[str]
    transport_active: bool
    tgca_active: bool
    discount: float
    notes: str | None

    snapshot_sous_total_ht: float
    snapshot_montant_tgca: float
    snapshot_transport_ttc: float
    snapshot_total_avant_remise: float
    snapshot_total_ttc: float
    snapshot_palier_applique: int | None
    snapshot_payload: dict

    status: QuoteStatusName

    created_at: datetime
    updated_at: datetime


class QuoteListItem(BaseModel):
    """Version allégée pour la liste — pas de snapshot complet."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    reference: str
    client: QuoteClientSummary
    model_ref: str
    quantity: int
    snapshot_total_ttc: float
    status: QuoteStatusName
    created_at: datetime


class QuoteStatusUpdate(BaseModel):
    """PATCH /quotes/{id}/status."""

    model_config = ConfigDict(extra="forbid")

    status: QuoteStatusName
