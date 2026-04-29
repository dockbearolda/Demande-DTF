"""Devis (Quote) — entité distincte des Order, persistance Devis Flash v2.

Snapshot du moteur pricing au moment de l'enregistrement : on fige les
montants pour que le PDF reste reproductible même si la grille ou les
paramètres globaux changent ensuite.
"""
import enum
import uuid
from datetime import datetime
from decimal import Decimal

from sqlalchemy import (
    Boolean,
    DateTime,
    ForeignKey,
    Integer,
    JSON,
    Numeric,
    String,
    Uuid,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class QuoteStatus(str, enum.Enum):
    """Statut d'un devis. La valeur en DB est la string lower-case (cf.
    migration 0022)."""

    DRAFT = "draft"
    ON_HOLD = "on_hold"
    SENT = "sent"
    CONVERTED = "converted"


class Quote(Base):
    __tablename__ = "quotes"

    id: Mapped[uuid.UUID] = mapped_column(Uuid(), primary_key=True, default=uuid.uuid4)
    reference: Mapped[str] = mapped_column(
        String(40), unique=True, index=True, nullable=False
    )
    client_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(), ForeignKey("clients.id"), nullable=False, index=True
    )

    model_ref: Mapped[str] = mapped_column(String(120), nullable=False)
    matrix_name: Mapped[str] = mapped_column(String(120), nullable=False)

    quantity: Mapped[int] = mapped_column(Integer, nullable=False)
    placements: Mapped[list[str]] = mapped_column(JSON, nullable=False)
    transport_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    tgca_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    discount: Mapped[Decimal] = mapped_column(
        Numeric(10, 2), nullable=False, default=Decimal("0")
    )
    notes: Mapped[str | None] = mapped_column(String(2000), nullable=True)

    # Snapshot des montants au moment de l'enregistrement.
    snapshot_sous_total_ht: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    snapshot_montant_tgca: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    snapshot_transport_ttc: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    snapshot_total_avant_remise: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    snapshot_total_ttc: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    snapshot_palier_applique: Mapped[int | None] = mapped_column(Integer, nullable=True)
    # Output complet du moteur, sérialisé.
    snapshot_payload: Mapped[dict] = mapped_column(JSON, nullable=False)

    status: Mapped[str] = mapped_column(
        String(20), nullable=False, default=QuoteStatus.DRAFT.value, index=True
    )

    is_deleted: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    client = relationship("Client")
