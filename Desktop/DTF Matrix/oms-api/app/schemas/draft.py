"""Schemas for in-progress order drafts (« brouillons »).

A draft is a free-form JSON snapshot of the new-order wizard's state. The
backend doesn't validate the inner structure — it just stores it, indexed by
client-generated id, with a few summary fields extracted for the listing page
(client name, item count, last reached step).
"""
from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class DraftUpsert(BaseModel):
    """Body for PUT /drafts/{id} — full payload + extracted summary fields.

    The summary fields are computed client-side from the same payload (cheaper
    than re-deriving them server-side, and avoids coupling the API to the
    wizard's internal shape)."""

    payload: dict[str, Any] = Field(
        ..., description="Free-form snapshot of the wizard state (draft + currentStep)."
    )
    client_name: str | None = None
    item_count: int = 0
    last_step: int = 1
    reference_count: int = 0
    quote_id: str | None = Field(
        default=None, description="DEVIS #… display id surfaced in the title."
    )


class DraftSummary(BaseModel):
    """Minimal record used by the listing page (no payload — keeps it cheap)."""

    model_config = ConfigDict(from_attributes=True)

    id: str
    client_name: str | None
    item_count: int
    reference_count: int
    last_step: int
    quote_id: str | None
    created_at: datetime
    updated_at: datetime


class DraftRead(DraftSummary):
    """Full record — used by GET /drafts/{id} when the user clicks Reprendre."""

    payload: dict[str, Any]
