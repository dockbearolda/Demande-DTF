import uuid
from datetime import datetime
from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models.order import (
    Order,
    OrderStatus,
    OrderLine,
    OrderLineVariant,
    OrderLineArtwork,
)
from app.models.client import Client
from app.schemas.order import (
    OrderCreate,
    OrderUpdate,
    OrderRead,
    OrderStatusUpdate,
    OrderLineCreate,
)
from app.services.kanban_service import (
    InvalidTransition,
    assert_transition,
    emit_status_changed,
)

router = APIRouter(prefix="/orders", tags=["orders"])


# ───────── Helpers ─────────


def _line_total(line: OrderLineCreate) -> Decimal:
    """Compute a line's subtotal HT.

    Prefers the per-variant breakdown (sum of qty × unit_price_ht). Falls back
    to (quantite × prix_unitaire) for legacy mono-reference payloads that
    don't include variants — keeps existing API consumers working.
    """
    if line.variants:
        return sum(
            (Decimal(str(v.unit_price_ht)) * v.qty for v in line.variants),
            Decimal("0"),
        )
    return Decimal(str(line.prix_unitaire)) * line.quantite


def _build_line(line_data: OrderLineCreate) -> OrderLine:
    """Materialize an OrderLine SQLAlchemy instance with its variants and
    artworks. When no variants are provided, synthesizes a single blanket
    variant from the legacy fields so the row is queryable through the new
    schema."""
    line = OrderLine(
        ligne_numero=line_data.ligne_numero,
        # Trust the client-provided position. Legacy clients omit it and get 0
        # for all lines — the secondary sort on `ligne_numero` then preserves
        # their order. New clients send explicit positions for drag & drop.
        position=line_data.position,
        secteur=line_data.secteur,
        product_type=line_data.product_type,
        product_id=line_data.product_id,
        produit=line_data.produit,
        quantite=line_data.quantite,
        prix_unitaire=line_data.prix_unitaire,
        options=line_data.options,
        notes=line_data.notes,
        is_sourcing_required=line_data.is_sourcing_required,
        sourcing_description=line_data.sourcing_description,
        sourcing_budget_estime=line_data.sourcing_budget_estime,
    )

    variants = list(line_data.variants)
    if not variants:
        # Synthetic single variant for legacy payloads.
        line.variants = [
            OrderLineVariant(
                qty=line_data.quantite,
                unit_price_ht=line_data.prix_unitaire,
                position=0,
            )
        ]
    else:
        line.variants = [
            OrderLineVariant(
                color=v.color,
                size=v.size,
                format=v.format,
                qty=v.qty,
                unit_price_ht=v.unit_price_ht,
                position=v.position,
            )
            for v in variants
        ]

    line.artworks = [
        OrderLineArtwork(
            side=a.side,
            placement=a.placement,
            file_url=a.file_url,
            bat_id=a.bat_id,
            artwork_metadata=a.artwork_metadata,
        )
        for a in line_data.artworks
    ]
    return line


def _eager_order_query():
    """Common eager-loading options for fetching a fully hydrated Order."""
    return (
        selectinload(Order.client),
        selectinload(Order.lines).selectinload(OrderLine.variants),
        selectinload(Order.lines).selectinload(OrderLine.artworks),
        selectinload(Order.lines).selectinload(OrderLine.product),
    )


def _list_order_query():
    """Lighter eager-loading for the list endpoint.

    `OrderLineRead` exposes `product_id` (a scalar) but never the linked `Product`
    relationship, so eager-loading it for the list view is wasted work — every
    extra `selectinload` is one round-trip + a payload of columns we discard.
    """
    return (
        selectinload(Order.client),
        selectinload(Order.lines).selectinload(OrderLine.variants),
        selectinload(Order.lines).selectinload(OrderLine.artworks),
    )


# ───────── List ─────────


@router.get("", response_model=list[OrderRead])
async def list_orders(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=500),
    statut: OrderStatus | None = None,
    client_id: uuid.UUID | None = None,
    date_from: datetime | None = None,
    date_to: datetime | None = None,
    db: AsyncSession = Depends(get_db),
) -> list[Order]:
    stmt = (
        select(Order)
        .options(*_list_order_query())
        .where(Order.is_deleted.is_(False))
    )
    if statut is not None:
        stmt = stmt.where(Order.statut == statut)
    if client_id is not None:
        stmt = stmt.where(Order.client_id == client_id)
    if date_from is not None:
        stmt = stmt.where(Order.date_commande >= date_from)
    if date_to is not None:
        stmt = stmt.where(Order.date_commande <= date_to)
    stmt = stmt.order_by(Order.date_commande.desc()).offset(skip).limit(limit)
    result = await db.execute(stmt)
    return list(result.scalars().all())


# ───────── Create ─────────


@router.post("", response_model=OrderRead, status_code=status.HTTP_201_CREATED)
async def create_order(
    payload: OrderCreate,
    db: AsyncSession = Depends(get_db),
) -> Order:
    client = await db.execute(
        select(Client).where(Client.id == payload.client_id, Client.is_deleted.is_(False))
    )
    if not client.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Client not found")
    existing = await db.execute(select(Order).where(Order.reference == payload.reference))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Reference already exists")

    order_data = payload.model_dump(exclude={"lines", "montant_total"})
    montant_total = sum(
        (_line_total(line) for line in payload.lines),
        Decimal("0"),
    )
    # Statut auto-promu : si l'utilisateur n'a pas explicitement choisi un
    # statut (= DRAFT par défaut) et qu'au moins une ligne nécessite un
    # sourcing, on bascule la commande en EN_ATTENTE_SOURCING. Le manager
    # passera ensuite manuellement à CONFIRMED une fois les fournisseurs
    # trouvés et les prix renseignés.
    has_sourcing = any(line.is_sourcing_required for line in payload.lines)
    if has_sourcing and order_data.get("statut") == OrderStatus.DRAFT:
        order_data["statut"] = OrderStatus.EN_ATTENTE_SOURCING
    order = Order(**order_data, montant_total=montant_total)
    order.lines = [_build_line(line_data) for line_data in payload.lines]
    db.add(order)
    await db.commit()
    # Drop the freshly-committed object from the session so the eager re-fetch
    # below applies the relationship's `order_by` (position, ligne_numero)
    # instead of returning the in-memory insertion order.
    order_id = order.id
    db.expunge_all()
    return await _get_order_or_404(db, order_id)


async def _get_order_or_404(db: AsyncSession, order_id: uuid.UUID) -> Order:
    result = await db.execute(
        select(Order)
        .options(*_eager_order_query())
        .where(Order.id == order_id, Order.is_deleted.is_(False))
    )
    order = result.scalar_one_or_none()
    if not order:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found")
    return order


@router.get("/{order_id}", response_model=OrderRead)
async def get_order(
    order_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
) -> Order:
    return await _get_order_or_404(db, order_id)


# ───────── Update ─────────


@router.put("/{order_id}", response_model=OrderRead)
async def update_order(
    order_id: uuid.UUID,
    payload: OrderUpdate,
    db: AsyncSession = Depends(get_db),
) -> Order:
    order = await _get_order_or_404(db, order_id)

    data = payload.model_dump(exclude_unset=True, exclude={"lines"})

    # Apply scalar header updates first.
    for k, v in data.items():
        setattr(order, k, v)

    # Replace lines if explicitly provided. cascade="all, delete-orphan" on
    # the relationship will delete removed rows when we reassign the
    # collection. We re-validate via OrderLineCreate to reuse coercion + the
    # blanket-variant fallback logic.
    new_lines = payload.lines
    if new_lines is not None:
        recomputed = sum(
            (_line_total(line) for line in new_lines),
            Decimal("0"),
        )
        order.lines = [_build_line(line_data) for line_data in new_lines]
        if "montant_total" not in data:
            order.montant_total = recomputed

        # Auto-promotion sourcing — symétrique à create_order. Si une ligne
        # nécessite un sourcing et que la commande est encore en DRAFT, on
        # bascule en EN_ATTENTE_SOURCING. Ne dégrade jamais un statut avancé
        # (CONFIRMED, IN_PRODUCTION…) — la décision est volontairement manuelle
        # pour les commandes déjà en cours de traitement.
        if (
            order.statut == OrderStatus.DRAFT
            and any(line.is_sourcing_required for line in new_lines)
        ):
            order.statut = OrderStatus.EN_ATTENTE_SOURCING

    await db.commit()
    order_id = order.id
    db.expunge_all()
    return await _get_order_or_404(db, order_id)


@router.patch("/{order_id}/status", response_model=OrderRead)
async def update_status(
    order_id: uuid.UUID,
    payload: OrderStatusUpdate,
    db: AsyncSession = Depends(get_db),
) -> Order:
    order = await _get_order_or_404(db, order_id)
    from_status = order.statut
    to_status = payload.statut

    try:
        assert_transition(from_status, to_status)
    except InvalidTransition as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc))

    order.statut = to_status
    await db.commit()
    await db.refresh(order)
    await db.refresh(order, attribute_names=["client"])

    if from_status != to_status:
        await emit_status_changed(
            order,
            from_status=from_status,
            to_status=to_status,
            actor_id="system",
        )
    return order


@router.delete("/{order_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_order(
    order_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
) -> None:
    order = await _get_order_or_404(db, order_id)
    order.is_deleted = True
    await db.commit()
