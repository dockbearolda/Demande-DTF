from datetime import datetime
from decimal import Decimal
from sqlalchemy import Integer, Numeric, DateTime, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class ParametresGlobaux(Base):
    """Paramètres globaux de tarification (singleton, id=1).

    Édité par Loïc/Charlie/Melina via /admin/parametres.
    """

    __tablename__ = "parametres_globaux"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, default=1)
    transport_ttc: Mapped[Decimal] = mapped_column(Numeric(8, 2), nullable=False, default=Decimal("1.56"))
    taux_tgca: Mapped[Decimal] = mapped_column(Numeric(5, 4), nullable=False, default=Decimal("0.0400"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
