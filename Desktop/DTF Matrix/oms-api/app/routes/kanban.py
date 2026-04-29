"""Kanban board routes.

Exposes:
- GET  /kanban/board       -> full board grouped by status (for the React kanban view)
- GET  /kanban/columns     -> column metadata (status + label + allowed next moves)
- POST /kanban/transition  -> move an order to a new status, emitting an HMAC-signed
                              webhook to KANBAN_WEBHOOK_URL for external sync.

The webhook is the same one used by the BAT module (HMAC-SHA256, envelope
{event, data, timestamp}). See app/services/webhook_service.py.
"""
from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models.order import Order, OrderStatus
from app.schemas.kanban import (
    KanbanBoard,
    KanbanColumn,
    KanbanTransitionRequest,
    KanbanTransitionResponse,
)
from app.services.kanban_service import (
    ALLOWED_TRANSITIONS,
    KANBAN_COLUMNS,
    KANBAN_LABELS,
    InvalidTransition,
    assert_transition,
    emit_status_changed,
)

router = APIRouter(prefix="/kanban", tags=["kanban"])


@router.get("/columns")
async def list_columns() -> dict:
    """Return column metadata so the frontend can render the board dynamically."""
    return {
        "columns": [
            {
                "status": s.value,
                "label": KANBAN_LABELS[s],
                "allowed_next": sorted(t.value for t in ALLOWED_TRANSITIONS[s]),
            }
            for s in KANBAN_COLUMNS
        ]
    }


@router.get("/board", response_model=KanbanBoard)
async def get_board(
    limit: int = Query(500, ge=1, le=2000),
    db: AsyncSession = Depends(get_db),
) -> KanbanBoard:
    """Return non-deleted orders grouped by status.

    Limit borné (default 500, max 2 000) pour éviter qu'une base à plusieurs
    milliers de commandes ne sature mémoire backend + payload réseau. Au-delà,
    la liste classique `/orders` avec filtres est plus adaptée.
    """
    result = await db.execute(
        select(Order)
        .options(selectinload(Order.client), selectinload(Order.lines))
        .where(Order.is_deleted.is_(False))
        .order_by(Order.date_commande.desc())
        .limit(limit)
    )
    orders = list(result.scalars().all())

    buckets: dict[OrderStatus, list[Order]] = {s: [] for s in KANBAN_COLUMNS}
    for order in orders:
        buckets.setdefault(order.statut, []).append(order)

    columns = [
        KanbanColumn(
            status=s,
            label=KANBAN_LABELS[s],
            count=len(buckets[s]),
            orders=buckets[s],
        )
        for s in KANBAN_COLUMNS
    ]
    return KanbanBoard(columns=columns)


@router.post("/transition", response_model=KanbanTransitionResponse)
async def transition_order(
    payload: KanbanTransitionRequest,
    db: AsyncSession = Depends(get_db),
) -> KanbanTransitionResponse:
    """Move an order to a new status.

    Enforces the workflow transitions defined in `kanban_service.ALLOWED_TRANSITIONS`.
    On success, emits an `order.status_changed` webhook (HMAC-SHA256 signed).
    The response includes `webhook_emitted` so the frontend can surface warnings
    if the external kanban sync failed.
    """
    result = await db.execute(
        select(Order)
        .options(selectinload(Order.client), selectinload(Order.lines))
        .where(
            Order.id == payload.order_id,
            Order.is_deleted.is_(False),
        )
    )
    order = result.scalar_one_or_none()
    if not order:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found")

    from_status = order.statut
    to_status = payload.to_status

    try:
        assert_transition(from_status, to_status)
    except InvalidTransition as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(exc),
        )

    order.statut = to_status
    if payload.comment:
        # Append the transition comment to notes for audit trail.
        suffix = f"\n[{from_status.value} -> {to_status.value}] {payload.comment}"
        order.notes = (order.notes or "") + suffix

    await db.commit()
    await db.refresh(order)
    await db.refresh(order, attribute_names=["client", "lines"])

    webhook_ok = False
    if from_status != to_status:
        webhook_ok = await emit_status_changed(
            order,
            from_status=from_status,
            to_status=to_status,
            actor_id="system",
        )

    return KanbanTransitionResponse(
        order=order,  # type: ignore[arg-type]
        from_status=from_status,
        to_status=to_status,
        webhook_emitted=webhook_ok,
    )


@router.get("/metrics")
async def get_metrics(
    db: AsyncSession = Depends(get_db),
) -> dict:
    """KPI summary consumed by the React dashboard.

    Returned counts include only non-deleted orders.
    """
    from datetime import date

    result = await db.execute(
        select(Order).where(Order.is_deleted.is_(False))
    )
    orders = list(result.scalars().all())

    by_status = {s.value: 0 for s in OrderStatus}
    overdue = 0
    today = date.today()
    active_statuses = {
        OrderStatus.CONFIRMED,
        OrderStatus.IN_PRODUCTION,
        OrderStatus.BAT_SENT,
        OrderStatus.BAT_APPROVED,
    }
    total_amount = 0.0
    for o in orders:
        by_status[o.statut.value] += 1
        total_amount += float(o.montant_total or 0)
        if (
            o.date_livraison_prevue is not None
            and o.date_livraison_prevue < today
            and o.statut in active_statuses
        ):
            overdue += 1

    active_count = sum(by_status[s.value] for s in active_statuses)

    return {
        "total": len(orders),
        "active": active_count,
        "overdue": overdue,
        "total_amount": round(total_amount, 2),
        "by_status": by_status,
    }


__all__ = ["router"]
