"""Endpoint de calcul tarifaire (source de vérité backend).

Le frontend duplique la logique pour le recalcul live <100 ms ; cet
endpoint sert à valider les montants avant enregistrement d'un devis.
"""
from __future__ import annotations

from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.catalog import PricingMatrix, Product
from app.models.parametres import ParametresGlobaux
from app.routes.admin import _get_singleton as _get_params_singleton
from app.schemas.pricing import (
    LogoLineRead,
    PricingComputeRequest,
    PricingComputeResponse,
)
from app.services.pricing_engine import (
    PricingInput,
    compute_quote,
)

router = APIRouter(prefix="/pricing", tags=["pricing"])

DEFAULT_MATRIX_NAME = "Textile 2026"


async def _get_matrix_by_name(db: AsyncSession, name: str) -> PricingMatrix:
    result = await db.execute(select(PricingMatrix).where(PricingMatrix.name == name))
    obj = result.scalar_one_or_none()
    if obj is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"PricingMatrix « {name} » introuvable.",
        )
    return obj


async def _get_product_by_ref(db: AsyncSession, ref: str) -> Product:
    result = await db.execute(select(Product).where(Product.reference == ref))
    obj = result.scalar_one_or_none()
    if obj is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Produit « {ref} » introuvable.",
        )
    return obj


@router.post("/compute", response_model=PricingComputeResponse)
async def compute(
    payload: PricingComputeRequest, db: AsyncSession = Depends(get_db)
) -> PricingComputeResponse:
    product = await _get_product_by_ref(db, payload.model_ref)

    # Sélection de la matrice : override explicite > matrice du produit > défaut.
    matrix: PricingMatrix
    if payload.matrix_name:
        matrix = await _get_matrix_by_name(db, payload.matrix_name)
    elif product.pricing_matrix_id is not None:
        result = await db.execute(
            select(PricingMatrix).where(PricingMatrix.id == product.pricing_matrix_id)
        )
        m = result.scalar_one_or_none()
        matrix = m if m is not None else await _get_matrix_by_name(db, DEFAULT_MATRIX_NAME)
    else:
        matrix = await _get_matrix_by_name(db, DEFAULT_MATRIX_NAME)

    params: ParametresGlobaux = await _get_params_singleton(db)

    pa = product.purchase_price_ht
    pa_decimal: Decimal | None = (
        Decimal(str(pa)) if pa is not None else None
    )

    inp = PricingInput(
        purchase_price_ht=pa_decimal,
        quantity=payload.quantity,
        placements=tuple(payload.placements),  # type: ignore[arg-type]
        tiers=tuple(matrix.tiers_json or ()),
        transport_ttc_unit=Decimal(str(params.transport_ttc)),
        transport_active=payload.transport_active,
        tgca_active=payload.tgca_active,
        tgca_rate=Decimal(str(params.taux_tgca)),
        discount=Decimal(str(payload.discount)),
    )

    out = compute_quote(inp)

    return PricingComputeResponse(
        quantity=out.quantity,
        palier_applique=out.palier_applique,
        coef=float(out.coef) if out.coef is not None else None,
        prix_vierge_unit=(
            float(out.prix_vierge_unit) if out.prix_vierge_unit is not None else None
        ),
        logos=[
            LogoLineRead(placement=l.placement, unit_price=float(l.unit_price))
            for l in out.logos
        ],
        prix_logos_unit=float(out.prix_logos_unit),
        prix_vente_ht_unit=(
            float(out.prix_vente_ht_unit) if out.prix_vente_ht_unit is not None else None
        ),
        sous_total_ht=float(out.sous_total_ht),
        transport_ttc=float(out.transport_ttc),
        montant_tgca=float(out.montant_tgca),
        total_avant_remise=float(out.total_avant_remise),
        discount=float(out.discount),
        total_ttc=float(out.total_ttc),
        warnings=list(out.warnings),
        matrix_name=matrix.name,
        purchase_price_ht=float(pa) if pa is not None else None,
    )
