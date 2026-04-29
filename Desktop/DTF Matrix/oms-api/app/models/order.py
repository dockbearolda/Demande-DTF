import enum
import uuid
from datetime import datetime, date
from sqlalchemy import (
    String,
    DateTime,
    Date,
    Boolean,
    Numeric,
    Enum as SAEnum,
    ForeignKey,
    Uuid,
    func,
    Integer,
    JSON,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from decimal import Decimal

from app.database import Base


class OrderStatus(str, enum.Enum):
    DRAFT = "DRAFT"
    EN_ATTENTE_SOURCING = "EN_ATTENTE_SOURCING"
    EN_ATTENTE_BAT = "EN_ATTENTE_BAT"
    CONFIRMED = "CONFIRMED"
    IN_PRODUCTION = "IN_PRODUCTION"
    BAT_SENT = "BAT_SENT"
    BAT_APPROVED = "BAT_APPROVED"
    SHIPPED = "SHIPPED"
    DELIVERED = "DELIVERED"
    CANCELLED = "CANCELLED"


class AssignedTo(str, enum.Enum):
    LOIC = "L"
    CHARLIE = "C"
    MELINA = "M"


class Secteur(str, enum.Enum):
    DTF = "DTF"
    PRESSAGE = "PRESSAGE"
    UV = "UV"
    TROTEC = "TROTEC"
    GOODIES = "GOODIES"
    AUTRES = "AUTRES"


class ProductType(str, enum.Enum):
    """Type métier d'un article. Couvre les variantes polymorphes du formulaire
    de saisie (textile, magnet, sticker, …). Indépendant du `Secteur` qui
    désigne la technique de production."""

    TSHIRT = "TSHIRT"
    SWEAT = "SWEAT"
    HOODIE = "HOODIE"
    POLO = "POLO"
    CAP = "CAP"
    MAGNET = "MAGNET"
    STICKER = "STICKER"
    PLEXIGLASS = "PLEXIGLASS"
    KEYRING = "KEYRING"
    MUG = "MUG"
    GOODIE = "GOODIE"
    OTHER = "OTHER"


class Order(Base):
    __tablename__ = "orders"

    id: Mapped[uuid.UUID] = mapped_column(Uuid(), primary_key=True, default=uuid.uuid4)
    client_id: Mapped[uuid.UUID] = mapped_column(Uuid(), ForeignKey("clients.id"), nullable=False, index=True)
    reference: Mapped[str] = mapped_column(String(100), unique=True, index=True, nullable=False)
    statut: Mapped[OrderStatus] = mapped_column(SAEnum(OrderStatus), default=OrderStatus.DRAFT, nullable=False, index=True)
    montant_total: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0)
    date_commande: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    date_livraison_prevue: Mapped[date | None] = mapped_column(Date)
    is_urgent: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    assigned_to: Mapped[AssignedTo | None] = mapped_column(
        SAEnum(
            AssignedTo,
            name="assignedto",
            values_callable=lambda x: [e.value for e in x],
        )
    )
    personne_contact: Mapped[str | None] = mapped_column(String(255))
    telephone: Mapped[str | None] = mapped_column(String(20))
    notes: Mapped[str | None] = mapped_column(String(2000))
    notes_globales: Mapped[str | None] = mapped_column(String(2000))
    is_deleted: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    client = relationship("Client", back_populates="orders")
    lines = relationship(
        "OrderLine",
        back_populates="order",
        cascade="all, delete-orphan",
        order_by="OrderLine.position, OrderLine.ligne_numero",
    )


class OrderLine(Base):
    __tablename__ = "order_lines"

    id: Mapped[uuid.UUID] = mapped_column(Uuid(), primary_key=True, default=uuid.uuid4)
    order_id: Mapped[uuid.UUID] = mapped_column(Uuid(), ForeignKey("orders.id"), nullable=False, index=True)
    ligne_numero: Mapped[int] = mapped_column(Integer, nullable=False)
    position: Mapped[int] = mapped_column(Integer, default=0, nullable=False, server_default="0")
    secteur: Mapped[Secteur] = mapped_column(SAEnum(Secteur), nullable=False)
    product_type: Mapped[ProductType | None] = mapped_column(
        SAEnum(
            ProductType,
            name="producttype",
            values_callable=lambda x: [e.value for e in x],
        ),
        nullable=True,
    )
    product_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid(), ForeignKey("catalog_products.id"), nullable=True, index=True
    )
    # Legacy free-text product label kept for retro-compat with mono-line orders
    # created before multi-references. New code should prefer `product_id` +
    # variants. Will be deprecated once the migration backfill is fully validated.
    produit: Mapped[str] = mapped_column(String(255), nullable=False)
    quantite: Mapped[int] = mapped_column(Integer, nullable=False)
    prix_unitaire: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=Decimal("0"), nullable=False, server_default="0")
    options: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    notes: Mapped[str | None] = mapped_column(String(1000))
    # Sourcing spécial : ligne libre que l'équipe doit sourcer auprès d'un
    # fournisseur. Les champs ci-dessous restent vides pour les lignes
    # catalogue ; quand `is_sourcing_required` est True, `produit` contient le
    # nom libre saisi par l'employé et le prix sera renseigné a posteriori
    # par un manager une fois le fournisseur trouvé.
    is_sourcing_required: Mapped[bool] = mapped_column(
        Boolean, default=False, nullable=False, server_default="0", index=True
    )
    sourcing_description: Mapped[str | None] = mapped_column(String(2000))
    sourcing_budget_estime: Mapped[Decimal | None] = mapped_column(Numeric(10, 2))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    order = relationship("Order", back_populates="lines")
    product = relationship("Product")
    variants = relationship(
        "OrderLineVariant",
        back_populates="line",
        cascade="all, delete-orphan",
        order_by="OrderLineVariant.position, OrderLineVariant.id",
    )
    artworks = relationship(
        "OrderLineArtwork",
        back_populates="line",
        cascade="all, delete-orphan",
    )


class OrderLineVariant(Base):
    """Une déclinaison concrète d'une ligne de commande (couleur × taille × format,
    avec une quantité). Un magnet n'aura ni `color` ni `size` mais un `format`."""

    __tablename__ = "order_line_variants"

    id: Mapped[uuid.UUID] = mapped_column(Uuid(), primary_key=True, default=uuid.uuid4)
    order_line_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(),
        ForeignKey("order_lines.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    color: Mapped[str | None] = mapped_column(String(80), nullable=True)
    size: Mapped[str | None] = mapped_column(String(40), nullable=True)
    format: Mapped[str | None] = mapped_column(String(80), nullable=True)
    qty: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    unit_price_ht: Mapped[Decimal] = mapped_column(
        Numeric(10, 2), default=Decimal("0"), nullable=False, server_default="0"
    )
    position: Mapped[int] = mapped_column(Integer, default=0, nullable=False, server_default="0")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    line = relationship("OrderLine", back_populates="variants")


class OrderLineArtwork(Base):
    """Visuel associé à une ligne (un côté = une entrée). Peut référencer un BAT
    déjà uploadé via `bat_id`."""

    __tablename__ = "order_line_artworks"

    id: Mapped[uuid.UUID] = mapped_column(Uuid(), primary_key=True, default=uuid.uuid4)
    order_line_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(),
        ForeignKey("order_lines.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    side: Mapped[str] = mapped_column(String(40), nullable=False)
    placement: Mapped[str | None] = mapped_column(String(40), nullable=True)
    file_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    bat_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid(), ForeignKey("bats.id"), nullable=True
    )
    artwork_metadata: Mapped[dict | None] = mapped_column("metadata", JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    line = relationship("OrderLine", back_populates="artworks")
