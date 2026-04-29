import uuid
from datetime import datetime, date
from decimal import Decimal
from pydantic import BaseModel, ConfigDict, EmailStr, Field

from app.models.order import OrderStatus, AssignedTo, Secteur, ProductType


class OrderClientSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    nom: str
    email: EmailStr | None = None


# ───────── Variants & Artworks ─────────


class OrderLineVariantCreate(BaseModel):
    color: str | None = Field(default=None, max_length=80)
    size: str | None = Field(default=None, max_length=40)
    format: str | None = Field(default=None, max_length=80)
    qty: int = Field(ge=0)
    unit_price_ht: Decimal = Field(default=Decimal("0"), ge=0)
    position: int = 0


class OrderLineVariantRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    color: str | None
    size: str | None
    format: str | None
    qty: int
    unit_price_ht: Decimal
    position: int


class OrderLineArtworkCreate(BaseModel):
    side: str = Field(min_length=1, max_length=40)
    placement: str | None = Field(default=None, max_length=40)
    file_url: str | None = Field(default=None, max_length=500)
    bat_id: uuid.UUID | None = None
    # Renamed from `metadata` to avoid the SQLAlchemy reserved attribute on
    # `Base.metadata` — colliding with from_attributes serialization.
    artwork_metadata: dict | None = None


class OrderLineArtworkRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    side: str
    placement: str | None
    file_url: str | None
    bat_id: uuid.UUID | None
    artwork_metadata: dict | None = None


# ───────── Order lines ─────────


class OrderLineCreate(BaseModel):
    """Payload to create an order line.

    Backwards compat
    ----------------
    Legacy clients send only (`secteur`, `produit`, `quantite`, `prix_unitaire`)
    with no variants. New clients send `product_type` + `product_id` (optional
    FK to catalog) + a list of `variants` describing every (color, size, qty)
    declension. When `variants` is empty the server creates a single "blanket"
    variant inheriting `quantite` / `prix_unitaire` so the row remains
    consistent with the new schema.
    """

    ligne_numero: int
    position: int = 0
    secteur: Secteur
    product_type: ProductType | None = None
    product_id: uuid.UUID | None = None
    produit: str = Field(min_length=1, max_length=255)
    quantite: int = Field(ge=1)
    prix_unitaire: Decimal = Field(default=Decimal("0"), ge=0)
    options: dict | None = None
    notes: str | None = Field(default=None, max_length=1000)
    variants: list[OrderLineVariantCreate] = Field(default_factory=list)
    artworks: list[OrderLineArtworkCreate] = Field(default_factory=list)
    # Sourcing spécial — articles hors catalogue à sourcer auprès d'un
    # fournisseur. Quand True, `prix_unitaire` peut rester à 0 (chiffré plus
    # tard par un manager) et la commande passe automatiquement en statut
    # EN_ATTENTE_SOURCING au lieu de DRAFT.
    is_sourcing_required: bool = False
    sourcing_description: str | None = Field(default=None, max_length=2000)
    sourcing_budget_estime: Decimal | None = Field(default=None, ge=0)


class OrderLineRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    order_id: uuid.UUID
    ligne_numero: int
    position: int
    secteur: Secteur
    product_type: ProductType | None = None
    product_id: uuid.UUID | None = None
    produit: str
    quantite: int
    prix_unitaire: Decimal
    options: dict | None = None
    notes: str | None
    is_sourcing_required: bool = False
    sourcing_description: str | None = None
    sourcing_budget_estime: Decimal | None = None
    created_at: datetime
    updated_at: datetime
    variants: list[OrderLineVariantRead] = Field(default_factory=list)
    artworks: list[OrderLineArtworkRead] = Field(default_factory=list)


# ───────── Order ─────────


class OrderCreate(BaseModel):
    client_id: uuid.UUID
    reference: str = Field(min_length=1, max_length=100)
    statut: OrderStatus = OrderStatus.DRAFT
    montant_total: Decimal = Field(default=Decimal("0"), ge=0)
    date_livraison_prevue: date | None = None
    is_urgent: bool = False
    assigned_to: AssignedTo | None = None
    personne_contact: str | None = Field(default=None, max_length=255)
    telephone: str | None = Field(default=None, max_length=20)
    notes: str | None = Field(default=None, max_length=2000)
    notes_globales: str | None = Field(default=None, max_length=2000)
    lines: list[OrderLineCreate] = Field(default_factory=list)


class OrderUpdate(BaseModel):
    reference: str | None = Field(default=None, min_length=1, max_length=100)
    montant_total: Decimal | None = Field(default=None, ge=0)
    date_livraison_prevue: date | None = None
    is_urgent: bool | None = None
    assigned_to: AssignedTo | None = None
    personne_contact: str | None = Field(default=None, max_length=255)
    telephone: str | None = Field(default=None, max_length=20)
    notes: str | None = Field(default=None, max_length=2000)
    notes_globales: str | None = Field(default=None, max_length=2000)
    # Optional: when provided, replaces ALL lines of the order and recomputes
    # montant_total from sum(variant.qty * variant.unit_price_ht), or from
    # (line.prix_unitaire * line.quantite) when no variants are supplied for
    # backwards compatibility. Pass an empty list explicitly to clear lines.
    lines: list[OrderLineCreate] | None = None


class OrderStatusUpdate(BaseModel):
    statut: OrderStatus


class OrderRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    client_id: uuid.UUID
    reference: str
    statut: OrderStatus
    montant_total: Decimal
    date_commande: datetime
    date_livraison_prevue: date | None
    is_urgent: bool
    assigned_to: AssignedTo | None
    personne_contact: str | None
    telephone: str | None
    notes: str | None
    notes_globales: str | None
    created_at: datetime
    updated_at: datetime
    client: OrderClientSummary | None = None
    lines: list[OrderLineRead] = Field(default_factory=list)
