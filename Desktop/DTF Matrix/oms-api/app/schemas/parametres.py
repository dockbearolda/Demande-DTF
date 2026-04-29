from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field


class ParametresGlobauxRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    transport_ttc: float
    taux_tgca: float
    created_at: datetime
    updated_at: datetime


class ParametresGlobauxUpdate(BaseModel):
    transport_ttc: float | None = Field(default=None, ge=0)
    taux_tgca: float | None = Field(default=None, ge=0, le=1)
