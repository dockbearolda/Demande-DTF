import enum
import uuid
from datetime import datetime
from sqlalchemy import Integer, String, Text, DateTime, Enum as SAEnum, ForeignKey, Uuid, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class BatStatus(str, enum.Enum):
    PENDING = "PENDING"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"
    EXPIRED = "EXPIRED"


class Bat(Base):
    __tablename__ = "bats"

    id: Mapped[uuid.UUID] = mapped_column(Uuid(), primary_key=True, default=uuid.uuid4)
    order_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(), ForeignKey("orders.id"), nullable=False, index=True
    )
    token: Mapped[str] = mapped_column(String(64), unique=True, nullable=False, index=True)
    file_path: Mapped[str] = mapped_column(String(500), nullable=False)
    file_type: Mapped[str] = mapped_column(String(50), nullable=False)
    file_name: Mapped[str] = mapped_column(String(255), nullable=False)
    message: Mapped[str | None] = mapped_column(String(2000))
    status: Mapped[BatStatus] = mapped_column(
        SAEnum(BatStatus), default=BatStatus.PENDING, nullable=False, index=True
    )
    decision_comment: Mapped[str | None] = mapped_column(String(2000))
    decided_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    decided_ip: Mapped[str | None] = mapped_column(String(64))
    decided_user_agent: Mapped[str | None] = mapped_column(String(500))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    composition_metadata: Mapped[str | None] = mapped_column(Text(), nullable=True)
    # ─── Versioning (per order × model × color) ─────────────────────────
    # Successive uploads for the same (order_id, model_reference, color_id) produce
    # version 1, 2, 3… The frontend is the source of truth for which logical group
    # a BAT belongs to.
    version: Mapped[int] = mapped_column(Integer, nullable=False, server_default="1")
    parent_bat_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid(), ForeignKey("bats.id"), nullable=True
    )
    model_reference: Mapped[str | None] = mapped_column(String(120), nullable=True, index=True)
    color_id: Mapped[str | None] = mapped_column(String(80), nullable=True, index=True)

    order = relationship("Order")
