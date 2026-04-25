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
    JSON,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Family(Base):
    __tablename__ = "catalog_families"

    id: Mapped[uuid.UUID] = mapped_column(Uuid(), primary_key=True, default=uuid.uuid4)
    slug: Mapped[str] = mapped_column(String(80), unique=True, nullable=False, index=True)
    label: Mapped[str] = mapped_column(String(120), nullable=False)
    icon: Mapped[str] = mapped_column(String(60), nullable=False, default="Shirt")
    position: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    enabled: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    subfamilies = relationship(
        "Subfamily",
        back_populates="family",
        cascade="all, delete-orphan",
        order_by="Subfamily.position",
    )


class Subfamily(Base):
    __tablename__ = "catalog_subfamilies"
    __table_args__ = (UniqueConstraint("family_id", "slug", name="uq_subfamily_family_slug"),)

    id: Mapped[uuid.UUID] = mapped_column(Uuid(), primary_key=True, default=uuid.uuid4)
    family_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(), ForeignKey("catalog_families.id", ondelete="CASCADE"), nullable=False, index=True
    )
    slug: Mapped[str] = mapped_column(String(80), nullable=False, index=True)
    label: Mapped[str] = mapped_column(String(120), nullable=False)
    target: Mapped[str | None] = mapped_column(String(20), nullable=True)
    position: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    enabled: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    family = relationship("Family", back_populates="subfamilies")
    products = relationship(
        "Product",
        back_populates="subfamily",
        cascade="all, delete-orphan",
        order_by="Product.position",
    )


class PricingMatrix(Base):
    __tablename__ = "catalog_pricing_matrices"

    id: Mapped[uuid.UUID] = mapped_column(Uuid(), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(120), nullable=False, unique=True)
    currency: Mapped[str] = mapped_column(String(3), default="EUR", nullable=False)
    tiers_json: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    products = relationship("Product", back_populates="pricing_matrix")


class Product(Base):
    __tablename__ = "catalog_products"

    id: Mapped[uuid.UUID] = mapped_column(Uuid(), primary_key=True, default=uuid.uuid4)
    subfamily_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(), ForeignKey("catalog_subfamilies.id", ondelete="CASCADE"), nullable=False, index=True
    )
    reference: Mapped[str] = mapped_column(String(120), nullable=False)
    name: Mapped[str] = mapped_column(String(180), nullable=False)
    description: Mapped[str | None] = mapped_column(String(500), nullable=True)
    image_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    pricing_matrix_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid(), ForeignKey("catalog_pricing_matrices.id"), nullable=True
    )
    position: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    enabled: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    colors_json: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    sizes_json: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    subfamily = relationship("Subfamily", back_populates="products")
    pricing_matrix = relationship("PricingMatrix", back_populates="products")
