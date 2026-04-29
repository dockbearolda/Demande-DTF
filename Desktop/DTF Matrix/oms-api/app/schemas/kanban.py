from __future__ import annotations

import uuid
from pydantic import BaseModel, Field

from app.models.order import OrderStatus
from app.schemas.order import OrderRead


class KanbanColumn(BaseModel):
    """A single column of the kanban board."""

    status: OrderStatus
    label: str
    count: int
    orders: list[OrderRead]


class KanbanBoard(BaseModel):
    """The full kanban board, ordered left-to-right."""

    columns: list[KanbanColumn]


class KanbanTransitionRequest(BaseModel):
    """Request to move an order from one status to another."""

    order_id: uuid.UUID
    to_status: OrderStatus
    comment: str | None = Field(default=None, max_length=2000)


class KanbanTransitionResponse(BaseModel):
    order: OrderRead
    from_status: OrderStatus
    to_status: OrderStatus
    webhook_emitted: bool
