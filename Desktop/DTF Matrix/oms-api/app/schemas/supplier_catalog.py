"""Schémas Pydantic pour le catalogue fournisseur."""
import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class SupplierMockupRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    view: str
    url: str  # URL servie par StaticFiles, calculée au moment de la sérialisation
    ext: str
    width: int | None = None
    height: int | None = None
    is_lifestyle: bool = False


class SupplierColorRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    slug: str
    label: str
    hex: str | None = None
    position: int = 0
    enabled: bool = True
    mockups: list[SupplierMockupRead] = Field(default_factory=list)


class SupplierModelRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    ref_internal: str
    ref_supplier: str
    ref_label: str
    category: str
    brand: str | None = None
    name: str | None = None
    fit_type: str | None = None
    fabric_composition: str | None = None
    fabric_weight_gsm: int | None = None
    position: int = 0
    enabled: bool = True
    colors: list[SupplierColorRead] = Field(default_factory=list)


class SupplierCategoryGroup(BaseModel):
    """Groupe de modèles par catégorie (HOMME/FEMME/ENFANT/BEBE)."""

    category: str
    label: str
    models: list[SupplierModelRead]


class SupplierCatalogTree(BaseModel):
    """Arborescence complète : catégories → modèles → couleurs → vues."""

    categories: list[SupplierCategoryGroup]
    total_models: int
    total_colors: int
    total_mockups: int
    generated_at: datetime
