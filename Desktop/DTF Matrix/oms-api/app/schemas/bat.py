import json
import uuid
from datetime import datetime
from typing import Any
from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.models.bat import BatStatus


class BatDecision(BaseModel):
    decision: str = Field(pattern=r"^(approved|rejected)$")
    comment: str | None = Field(default=None, max_length=2000)


class BatRead(BaseModel):
    """Lecture publique d'un BAT.

    Le `token` (URL secret de validation publique) est volontairement absent :
    `/bat/{bat_id}` n'a pas d'auth et exposer le token reviendrait à laisser
    quiconque connaît un UUID télécharger ou approuver le BAT. Le token reste
    en DB et n'est connu que de l'expéditeur de l'email de validation.
    """

    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    order_id: uuid.UUID
    file_name: str
    file_type: str
    message: str | None
    status: BatStatus
    decision_comment: str | None
    decided_at: datetime | None
    created_at: datetime
    expires_at: datetime
    composition_metadata: dict[str, Any] | None = None
    version: int = 1
    parent_bat_id: uuid.UUID | None = None
    model_reference: str | None = None
    color_id: str | None = None

    @field_validator("composition_metadata", mode="before")
    @classmethod
    def _parse_composition(cls, value: Any) -> Any:
        if value is None or isinstance(value, dict):
            return value
        if isinstance(value, str):
            try:
                return json.loads(value)
            except json.JSONDecodeError:
                return None
        return None


class BatUploadResponse(BaseModel):
    bat_id: uuid.UUID
    validation_url: str
    expires_at: datetime


class BatSearchResult(BaseModel):
    """Lightweight projection of a BAT for the reuse picker."""
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    order_id: uuid.UUID
    order_reference: str
    client_id: uuid.UUID
    client_name: str
    file_name: str
    file_type: str
    status: BatStatus
    version: int
    model_reference: str | None
    color_id: str | None
    created_at: datetime
    decided_at: datetime | None
    file_url: str
    usage_count: int


class BatLinkRequest(BaseModel):
    """Re-use an existing BAT for a new order. Creates a linked copy."""
    source_bat_id: uuid.UUID
    target_order_id: uuid.UUID
    color_id: str | None = None
    model_reference: str | None = None


class BatValidationContext(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    token: str
    order_reference: str
    client_name: str
    created_at: datetime
    status: BatStatus
    file_url: str
    file_type: str
