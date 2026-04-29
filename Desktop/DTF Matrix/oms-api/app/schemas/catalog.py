import uuid
from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field


# ───────── Pricing ─────────


class PricingTier(BaseModel):
    """Palier tarifaire.

    Le format Textile 2026 utilise `coef` + 6 prix d'emplacement
    (`coeur`, `poitrine`, `avantPlein`, `arrierePlein`, `mancheG`, `mancheD`).
    Les anciens champs `vierge` / `dos` restent acceptés en lecture pour les
    matrices créées avant la migration 0021 mais ne sont plus produits.
    Tous les champs prix sont optionnels — un palier peut ne déclarer que ce
    qu'il facture.
    """

    minQty: int = Field(ge=1)
    coef: float | None = Field(default=None, ge=0)
    coeur: float | None = Field(default=None, ge=0)
    poitrine: float | None = Field(default=None, ge=0)
    avantPlein: float | None = Field(default=None, ge=0)
    arrierePlein: float | None = Field(default=None, ge=0)
    mancheG: float | None = Field(default=None, ge=0)
    mancheD: float | None = Field(default=None, ge=0)
    # legacy (rétrocompat lecture)
    vierge: float | None = Field(default=None, ge=0)
    dos: float | None = Field(default=None, ge=0)


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
    # Fiche couleur (renseignée à la main fabricant). Tous optionnels.
    commercialName: str | None = None
    manufacturerCode: str | None = None
    pantone: str | None = None
    rgb: dict | None = None  # {"r": int, "g": int, "b": int}
    mockupUrl: str | None = None


class SizeOption(BaseModel):
    id: str
    label: str
    order: int = 0


# ───────── Product ─────────


SLEEVE_TYPES = {"courte", "longue", "sans_manche"}
NECK_TYPES = {"rond", "v"}


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
    # Fiche produit (BAT)
    brand: str | None = Field(default=None, max_length=120)
    sku_supplier: str | None = Field(default=None, max_length=120)
    fabric_composition: str | None = Field(default=None, max_length=240)
    fabric_weight_gsm: int | None = Field(default=None, ge=0, le=2000)
    fit_type: str | None = Field(default=None, max_length=40)
    print_techniques: list[str] = Field(default_factory=list)
    # Tarif & filtres 2026
    purchase_price_ht: float | None = Field(default=None, ge=0)
    sleeve_type: str | None = Field(default=None, max_length=20)
    neck_type: str | None = Field(default=None, max_length=20)


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
    brand: str | None = Field(default=None, max_length=120)
    sku_supplier: str | None = Field(default=None, max_length=120)
    fabric_composition: str | None = Field(default=None, max_length=240)
    fabric_weight_gsm: int | None = Field(default=None, ge=0, le=2000)
    fit_type: str | None = Field(default=None, max_length=40)
    print_techniques: list[str] | None = None
    purchase_price_ht: float | None = Field(default=None, ge=0)
    sleeve_type: str | None = Field(default=None, max_length=20)
    neck_type: str | None = Field(default=None, max_length=20)


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
    brand: str | None = None
    sku_supplier: str | None = None
    fabric_composition: str | None = None
    fabric_weight_gsm: int | None = None
    fit_type: str | None = None
    print_techniques: list[str] = Field(
        default_factory=list, validation_alias="print_techniques_json"
    )
    purchase_price_ht: float | None = None
    sleeve_type: str | None = None
    neck_type: str | None = None


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
