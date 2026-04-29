"""Kanban service - workflow transitions + webhook emission for Order status changes.

Workflow (atelier DTF):
    DRAFT ──► CONFIRMED ──► IN_PRODUCTION ──► BAT_SENT ──► BAT_APPROVED ──► SHIPPED ──► DELIVERED
                                   │               │              │
                                   ▼               ▼              ▼
                               SHIPPED      IN_PRODUCTION    IN_PRODUCTION
                                          (rejet BAT, rework)

Any active state can transition to CANCELLED. Terminal states: DELIVERED, CANCELLED.
"""
from __future__ import annotations

from app.models.order import Order, OrderStatus
from app.services.webhook_service import emit_webhook

# Allowed transitions: from_status -> set of allowed to_statuses
ALLOWED_TRANSITIONS: dict[OrderStatus, set[OrderStatus]] = {
    OrderStatus.DRAFT: {
        OrderStatus.CONFIRMED,
        OrderStatus.EN_ATTENTE_SOURCING,
        OrderStatus.EN_ATTENTE_BAT,
        OrderStatus.CANCELLED,
    },
    OrderStatus.EN_ATTENTE_SOURCING: {
        OrderStatus.EN_ATTENTE_BAT,
        OrderStatus.CONFIRMED,
        OrderStatus.CANCELLED,
    },
    OrderStatus.EN_ATTENTE_BAT: {
        OrderStatus.BAT_SENT,
        OrderStatus.CONFIRMED,
        OrderStatus.CANCELLED,
    },
    OrderStatus.CONFIRMED: {OrderStatus.IN_PRODUCTION, OrderStatus.CANCELLED},
    OrderStatus.IN_PRODUCTION: {
        OrderStatus.BAT_SENT,
        OrderStatus.SHIPPED,
        OrderStatus.CANCELLED,
    },
    OrderStatus.BAT_SENT: {
        OrderStatus.BAT_APPROVED,
        OrderStatus.IN_PRODUCTION,  # rejection -> back to prod
        OrderStatus.CANCELLED,
    },
    OrderStatus.BAT_APPROVED: {
        OrderStatus.SHIPPED,
        OrderStatus.IN_PRODUCTION,  # rework
        OrderStatus.CANCELLED,
    },
    OrderStatus.SHIPPED: {OrderStatus.DELIVERED},
    OrderStatus.DELIVERED: set(),
    OrderStatus.CANCELLED: set(),
}

# Column order shown in the kanban board (left to right).
KANBAN_COLUMNS: list[OrderStatus] = [
    OrderStatus.DRAFT,
    OrderStatus.EN_ATTENTE_SOURCING,
    OrderStatus.EN_ATTENTE_BAT,
    OrderStatus.CONFIRMED,
    OrderStatus.IN_PRODUCTION,
    OrderStatus.BAT_SENT,
    OrderStatus.BAT_APPROVED,
    OrderStatus.SHIPPED,
    OrderStatus.DELIVERED,
    OrderStatus.CANCELLED,
]

# Human-readable labels (FR, atelier vocabulary).
KANBAN_LABELS: dict[OrderStatus, str] = {
    OrderStatus.DRAFT: "Brouillon",
    OrderStatus.EN_ATTENTE_SOURCING: "En attente sourcing",
    OrderStatus.EN_ATTENTE_BAT: "En attente BAT",
    OrderStatus.CONFIRMED: "Confirmée",
    OrderStatus.IN_PRODUCTION: "En production",
    OrderStatus.BAT_SENT: "BAT envoyé",
    OrderStatus.BAT_APPROVED: "BAT validé",
    OrderStatus.SHIPPED: "Expédiée",
    OrderStatus.DELIVERED: "Livrée",
    OrderStatus.CANCELLED: "Annulée",
}


class InvalidTransition(Exception):
    """Raised when a status transition is not allowed by the workflow."""

    def __init__(self, from_status: OrderStatus, to_status: OrderStatus):
        self.from_status = from_status
        self.to_status = to_status
        super().__init__(
            f"Invalid transition: {from_status.value} -> {to_status.value}. "
            f"Allowed: {sorted(s.value for s in ALLOWED_TRANSITIONS[from_status])}"
        )


def can_transition(from_status: OrderStatus, to_status: OrderStatus) -> bool:
    """Return True if the transition is allowed by the workflow."""
    if from_status == to_status:
        return True  # no-op is always allowed
    return to_status in ALLOWED_TRANSITIONS.get(from_status, set())


def assert_transition(from_status: OrderStatus, to_status: OrderStatus) -> None:
    """Raise InvalidTransition if the transition is not allowed."""
    if not can_transition(from_status, to_status):
        raise InvalidTransition(from_status, to_status)


async def emit_status_changed(
    order: Order,
    from_status: OrderStatus,
    to_status: OrderStatus,
    actor_id: str | None = None,
) -> bool:
    """Emit an HMAC-signed webhook for an Order status transition.

    Event name: order.status_changed
    Returns True if the webhook was emitted (2xx), False otherwise.
    """
    payload = {
        "order_id": str(order.id),
        "reference": order.reference,
        "client_id": str(order.client_id),
        "from_status": from_status.value,
        "to_status": to_status.value,
        "montant_total": float(order.montant_total or 0),
        "actor_id": actor_id,
    }
    return await emit_webhook("order.status_changed", payload)
