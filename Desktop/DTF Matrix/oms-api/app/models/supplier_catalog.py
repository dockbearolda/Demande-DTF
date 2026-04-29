"""Catalogue fournisseur — modèles t-shirts indexés depuis le dossier
`Mokeup fournisseur uniforme/`.

Hiérarchie : SupplierModel → SupplierColor → SupplierMockup
            (1 référence)   (1 couleur)     (1 vue : front/back/sleeve…)

Cette table est volontairement séparée de `catalog_products` (tarifaire)
pour ne pas mélanger les concerns. La FK optionnelle
`Product.supplier_model_id` (ajoutée plus tard) servira de pont quand
le tarif sera plaqué sur les références fournisseur.
"""
import uuid
from datetime import datetime
from sqlalchemy import (
    String,
    Integer,
    Boolean,
    DateTime,
    ForeignKey,
    Uuid,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class SupplierModel(Base):
    """Une référence fournisseur (ex. H-013_K357 = Kariban K357)."""

    __tablename__ = "supplier_models"
    __table_args__ = (
        UniqueConstraint("ref_internal", name="uq_supplier_model_ref_internal"),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid(), primary_key=True, default=uuid.uuid4)

    # Identifiants
    ref_internal: Mapped[str] = mapped_column(String(20), nullable=False, index=True)
    ref_supplier: Mapped[str] = mapped_column(String(40), nullable=False, index=True)
    ref_label: Mapped[str] = mapped_column(String(80), nullable=False)

    # Classification
    category: Mapped[str] = mapped_column(String(20), nullable=False, index=True)
    brand: Mapped[str | None] = mapped_column(String(80), nullable=True)
    name: Mapped[str | None] = mapped_column(String(180), nullable=True)
    fit_type: Mapped[str | None] = mapped_column(String(40), nullable=True)
    fabric_composition: Mapped[str | None] = mapped_column(String(240), nullable=True)
    fabric_weight_gsm: Mapped[int | None] = mapped_column(Integer, nullable=True)

    position: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    enabled: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    colors = relationship(
        "SupplierColor",
        back_populates="model",
        cascade="all, delete-orphan",
        order_by="SupplierColor.position, SupplierColor.label",
    )


class SupplierColor(Base):
    """Une déclinaison de couleur d'un modèle fournisseur."""

    __tablename__ = "supplier_colors"
    __table_args__ = (
        UniqueConstraint(
            "supplier_model_id", "slug", name="uq_supplier_color_model_slug"
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid(), primary_key=True, default=uuid.uuid4)
    supplier_model_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(),
        ForeignKey("supplier_models.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    slug: Mapped[str] = mapped_column(String(60), nullable=False)
    label: Mapped[str] = mapped_column(String(80), nullable=False)
    hex: Mapped[str | None] = mapped_column(String(7), nullable=True)

    position: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    enabled: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    model = relationship("SupplierModel", back_populates="colors")
    mockups = relationship(
        "SupplierMockup",
        back_populates="color",
        cascade="all, delete-orphan",
        order_by="SupplierMockup.view",
    )


class SupplierMockup(Base):
    """Un fichier image (PNG/JPG/AVIF/WebP) pour une couleur + une vue."""

    __tablename__ = "supplier_mockups"
    __table_args__ = (
        UniqueConstraint(
            "supplier_color_id", "view", name="uq_supplier_mockup_color_view"
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid(), primary_key=True, default=uuid.uuid4)
    supplier_color_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(),
        ForeignKey("supplier_colors.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # `front` | `back` | `sleeve` | `front_lifestyle` | `back_lifestyle` |
    # `sleeve_lifestyle` | `front_alt` | `back_alt` | `front_sleeve`
    view: Mapped[str] = mapped_column(String(30), nullable=False)
    file_path: Mapped[str] = mapped_column(String(400), nullable=False)
    ext: Mapped[str] = mapped_column(String(10), nullable=False)
    width: Mapped[int | None] = mapped_column(Integer, nullable=True)
    height: Mapped[int | None] = mapped_column(Integer, nullable=True)
    is_lifestyle: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    color = relationship("SupplierColor", back_populates="mockups")


class LegacyModelMapping(Base):
    """Pont legacy_model_id (TEXTILE_MODELS frontend) → supplier_model_id.

    Permet aux commandes existantes de continuer à fonctionner après bascule
    sur le nouveau catalogue fournisseur.
    """

    __tablename__ = "supplier_legacy_mappings"

    legacy_model_id: Mapped[str] = mapped_column(String(120), primary_key=True)
    supplier_model_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(),
        ForeignKey("supplier_models.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    default_color_slug: Mapped[str | None] = mapped_column(String(60), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
