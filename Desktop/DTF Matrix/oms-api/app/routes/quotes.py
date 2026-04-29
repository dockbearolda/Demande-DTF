"""Endpoints CRUD pour les devis (Devis Flash v2).

Les montants sont systématiquement recalculés côté serveur via le moteur
pricing — le payload du frontend n'est qu'un **state**, pas une source
de vérité financière. Le snapshot calculé est figé en DB pour
reproductibilité du PDF (étape 5B).
"""
from __future__ import annotations

import uuid
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models.catalog import PricingMatrix, Product
from app.models.client import Client
from app.models.parametres import ParametresGlobaux
from app.models.quote import Quote, QuoteStatus
from app.routes.admin import _get_singleton as _get_params_singleton
from app.schemas.quote import (
    QuoteCreate,
    QuoteListItem,
    QuoteRead,
    QuoteStatusUpdate,
)
from app.services.pricing_engine import PricingInput, compute_quote
from app.services.quote_reference import generate_quote_reference

router = APIRouter(prefix="/quotes", tags=["quotes"])

DEFAULT_MATRIX_NAME = "Textile 2026"
MAX_REFERENCE_RETRIES = 5


# ── Helpers ──────────────────────────────────────────────────────────


async def _get_product_by_ref(db: AsyncSession, ref: str) -> Product:
    result = await db.execute(select(Product).where(Product.reference == ref))
    obj = result.scalar_one_or_none()
    if obj is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Produit « {ref} » introuvable.",
        )
    return obj


async def _get_matrix_by_name(db: AsyncSession, name: str) -> PricingMatrix:
    result = await db.execute(select(PricingMatrix).where(PricingMatrix.name == name))
    obj = result.scalar_one_or_none()
    if obj is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"PricingMatrix « {name} » introuvable.",
        )
    return obj


async def _get_client(db: AsyncSession, client_id: uuid.UUID) -> Client:
    result = await db.execute(
        select(Client).where(Client.id == client_id, Client.is_deleted.is_(False))
    )
    obj = result.scalar_one_or_none()
    if obj is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Client {client_id} introuvable.",
        )
    return obj


def _serialize_pricing_output(out) -> dict:
    """Convertit un PricingOutput (Decimal partout) en dict JSON-safe."""
    return {
        "quantity": out.quantity,
        "palier_applique": out.palier_applique,
        "coef": float(out.coef) if out.coef is not None else None,
        "prix_vierge_unit": (
            float(out.prix_vierge_unit) if out.prix_vierge_unit is not None else None
        ),
        "logos": [
            {"placement": l.placement, "unit_price": float(l.unit_price)}
            for l in out.logos
        ],
        "prix_logos_unit": float(out.prix_logos_unit),
        "prix_vente_ht_unit": (
            float(out.prix_vente_ht_unit) if out.prix_vente_ht_unit is not None else None
        ),
        "sous_total_ht": float(out.sous_total_ht),
        "transport_ttc": float(out.transport_ttc),
        "montant_tgca": float(out.montant_tgca),
        "total_avant_remise": float(out.total_avant_remise),
        "discount": float(out.discount),
        "total_ttc": float(out.total_ttc),
        "warnings": list(out.warnings),
    }


# ── Endpoints ────────────────────────────────────────────────────────


@router.post(
    "",
    response_model=QuoteRead,
    status_code=status.HTTP_201_CREATED,
)
async def create_quote(
    payload: QuoteCreate, db: AsyncSession = Depends(get_db)
) -> Quote:
    # Validation des FK / refs
    client = await _get_client(db, payload.client_id)
    product = await _get_product_by_ref(db, payload.model_ref)

    # Sélection de la matrice (override > matrice produit > défaut)
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

    pa_decimal: Decimal | None = (
        Decimal(str(product.purchase_price_ht))
        if product.purchase_price_ht is not None
        else None
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

    snapshot_payload = _serialize_pricing_output(out)

    # Insertion avec retry si collision sur la référence
    last_error: IntegrityError | None = None
    for _ in range(MAX_REFERENCE_RETRIES):
        reference = await generate_quote_reference(db)
        quote = Quote(
            reference=reference,
            client_id=client.id,
            model_ref=product.reference,
            matrix_name=matrix.name,
            quantity=payload.quantity,
            placements=list(payload.placements),
            transport_active=payload.transport_active,
            tgca_active=payload.tgca_active,
            discount=Decimal(str(payload.discount)),
            notes=payload.notes,
            snapshot_sous_total_ht=out.sous_total_ht,
            snapshot_montant_tgca=out.montant_tgca,
            snapshot_transport_ttc=out.transport_ttc,
            snapshot_total_avant_remise=out.total_avant_remise,
            snapshot_total_ttc=out.total_ttc,
            snapshot_palier_applique=out.palier_applique,
            snapshot_payload=snapshot_payload,
            status=QuoteStatus.DRAFT.value,
        )
        db.add(quote)
        try:
            await db.commit()
            await db.refresh(quote, attribute_names=["client"])
            return quote
        except IntegrityError as e:
            last_error = e
            await db.rollback()
            continue

    # Toutes les tentatives ont échoué
    raise HTTPException(
        status_code=status.HTTP_409_CONFLICT,
        detail="Impossible de générer une référence unique après plusieurs essais.",
    ) from last_error


@router.get("", response_model=list[QuoteListItem])
async def list_quotes(
    db: AsyncSession = Depends(get_db),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    status_filter: str | None = Query(default=None, alias="status"),
) -> list[Quote]:
    # Tri DESC par created_at puis par reference pour rester stable même
    # si plusieurs devis sont insérés dans la même milliseconde (cas tests).
    stmt = (
        select(Quote)
        .where(Quote.is_deleted.is_(False))
        .options(selectinload(Quote.client))
        .order_by(Quote.created_at.desc(), Quote.reference.desc())
        .offset(skip)
        .limit(limit)
    )
    if status_filter:
        stmt = stmt.where(Quote.status == status_filter)
    result = await db.execute(stmt)
    return list(result.scalars().all())


@router.get("/{quote_id}", response_model=QuoteRead)
async def get_quote(quote_id: uuid.UUID, db: AsyncSession = Depends(get_db)) -> Quote:
    stmt = (
        select(Quote)
        .where(Quote.id == quote_id, Quote.is_deleted.is_(False))
        .options(selectinload(Quote.client))
    )
    result = await db.execute(stmt)
    obj = result.scalar_one_or_none()
    if obj is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Devis {quote_id} introuvable.",
        )
    return obj


@router.patch("/{quote_id}/status", response_model=QuoteRead)
async def update_quote_status(
    quote_id: uuid.UUID,
    payload: QuoteStatusUpdate,
    db: AsyncSession = Depends(get_db),
) -> Quote:
    stmt = (
        select(Quote)
        .where(Quote.id == quote_id, Quote.is_deleted.is_(False))
        .options(selectinload(Quote.client))
    )
    result = await db.execute(stmt)
    obj = result.scalar_one_or_none()
    if obj is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Devis {quote_id} introuvable.",
        )
    obj.status = payload.status
    await db.commit()
    # Refresh complet : `updated_at` est calculé côté DB (onupdate), donc
    # il faut le re-fetch ; le client est déjà chargé via selectinload.
    await db.refresh(obj)
    return obj


@router.delete("/{quote_id}", status_code=status.HTTP_204_NO_CONTENT)
async def soft_delete_quote(
    quote_id: uuid.UUID, db: AsyncSession = Depends(get_db)
) -> None:
    result = await db.execute(
        select(Quote).where(Quote.id == quote_id, Quote.is_deleted.is_(False))
    )
    obj = result.scalar_one_or_none()
    if obj is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Devis {quote_id} introuvable.",
        )
    obj.is_deleted = True
    await db.commit()
