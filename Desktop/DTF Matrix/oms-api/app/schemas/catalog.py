import uuid
from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field


# ───────── Pricing ─────────


class PricingTier(BaseModel):
    minQty: int = Field(ge=1)
    vierge: float = Field(ge=0)
    coeur: float = Field(ge=0)
    dos: float = Field(ge=0)


class PricingMatrixCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    currency: str = Field(default="EUR", min_length=3, max_length=3)
    tiers: list[PricingTier] = Field(default_factory=list)


class PricingMatrixUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    currency: str | None = Field(default=None, min_length=3, max_length=3)
    tiers: list[PricingTier] | None = None


class PricingMatrixRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    name: str
    currency: str
    tiers: list[PricingTier] = Field(default_factory=list, validation_alias="tiers_json")
    created_at: datetime
    updated_at: datetime


# ───────── Color & Size ─────────


class ColorVariant(BaseModel):
    id: str
    label: str
    hex: str
    swatchBorder: bool | None = None


class SizeOption(BaseModel):
    id: str
    label: str
    order: int = 0


# ───────── Product ─────────


class ProductCreate(BaseModel):
    reference: str = Field(min_length=1, max_length=120)
    name: str = Field(min_length=1, max_length=180)
    description: str | None = Field(default=None, max_length=500)
    image_url: str | None = Field(default=None, max_length=500)
    pricing_matrix_id: uuid.UUID | None = None
    position: int = 0
    enabled: bool = True
    colors: list[ColorVariant] = Field(default_factory=list)
    sizes: list[SizeOption] = Field(default_factory=list)


class ProductUpdate(BaseModel):
    reference: str | None = Field(default=None, min_length=1, max_length=120)
    name: str | None = Field(default=None, min_length=1, max_length=180)
    description: str | None = Field(default=None, max_length=500)
    image_url: str | None = Field(default=None, max_length=500)
    pricing_matrix_id: uuid.UUID | None = None
    position: int | None = None
    enabled: bool | None = None
    colors: list[ColorVariant] | None = None
    sizes: list[SizeOption] | None = None


class ProductRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    subfamily_id: uuid.UUID
    reference: str
    name: str
    description: str | None
    image_url: str | None
    pricing_matrix_id: uuid.UUID | None
    position: int
    enabled: bool
    colors: list[ColorVariant] = Field(default_factory=list, validation_alias="colors_json")
    sizes: list[SizeOption] = Field(default_factory=list, validation_alias="sizes_json")


# ───────── Subfamily ─────────


class SubfamilyCreate(BaseModel):
    slug: str = Field(min_length=1, max_length=80)
    label: str = Field(min_length=1, max_length=120)
    target: str | None = Field(default=None, max_length=20)
    position: int = 0
    enabled: bool = True


class SubfamilyUpdate(BaseModel):
    slug: str | None = Field(default=None, min_length=1, max_length=80)
    label: str | None = Field(default=None, min_length=1, max_length=120)
    target: str | None = Field(default=None, max_length=20)
    position: int | None = None
    enabled: bool | None = None


class SubfamilyRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    family_id: uuid.UUID
    slug: str
    label: str
    target: str | None
    position: int
    enabled: bool
    products: list[ProductRead] = Field(default_factory=list)


# ───────── Family ─────────


class FamilyCreate(BaseModel):
    slug: str = Field(min_length=1, max_length=80)
    label: str = Field(min_length=1, max_length=120)
    icon: str = Field(default="Shirt", max_length=60)
    position: int = 0
    enabled: bool = True


class FamilyUpdate(BaseModel):
    slug: str | None = Field(default=None, min_length=1, max_length=80)
    label: str | None = Field(default=None, min_length=1, max_length=120)
    icon: str | None = Field(default=None, max_length=60)
    position: int | None = None
    enabled: bool | None = None


class FamilyRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    slug: str
    label: str
    icon: str
    position: int
    enabled: bool
    subfamilies: list[SubfamilyRead] = Field(default_factory=list)


# ───────── Tree ─────────


class CatalogTree(BaseModel):
    families: list[FamilyRead]
    pricing_matrices: list[PricingMatrixRead]
