"""Routes catalogue fournisseur — exposition des références aux clients
React (page de prise de commande + éditeur BAT).

Le `url` des mockups est calculé à la volée à partir de
`SUPPLIER_MOCKUPS_PUBLIC_PREFIX` (ex. `/static/supplier-mockups`) +
`mockup.file_path` relatif. Aucune URL n'est stockée en base : on peut
basculer du local au CDN/S3 en ne touchant qu'à la config.
"""
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.config import settings
from app.database import get_db
from app.models.supplier_catalog import (
    SupplierColor,
    SupplierMockup,
    SupplierModel,
)
from app.schemas.supplier_catalog import (
    SupplierCatalogTree,
    SupplierCategoryGroup,
    SupplierColorRead,
    SupplierMockupRead,
    SupplierModelRead,
)

router = APIRouter(prefix="/catalog/supplier", tags=["supplier-catalog"])


CATEGORY_LABELS = {
    "HOMME": "Homme",
    "FEMME": "Femme",
    "ENFANT": "Enfant",
    "BEBE": "Bébé",
}
CATEGORY_ORDER = ["HOMME", "FEMME", "ENFANT", "BEBE"]


def _mockup_url(file_path: str) -> str:
    prefix = settings.SUPPLIER_MOCKUPS_PUBLIC_PREFIX.rstrip("/")
    return f"{prefix}/{file_path.lstrip('/')}"


def _serialize_mockup(m: SupplierMockup) -> SupplierMockupRead:
    return SupplierMockupRead(
        id=m.id,
        view=m.view,
        url=_mockup_url(m.file_path),
        ext=m.ext,
        width=m.width,
        height=m.height,
        is_lifestyle=m.is_lifestyle,
    )


def _serialize_color(c: SupplierColor) -> SupplierColorRead:
    return SupplierColorRead(
        id=c.id,
        slug=c.slug,
        label=c.label,
        hex=c.hex,
        position=c.position,
        enabled=c.enabled,
        mockups=[_serialize_mockup(m) for m in c.mockups],
    )


def _serialize_model(m: SupplierModel) -> SupplierModelRead:
    return SupplierModelRead(
        id=m.id,
        ref_internal=m.ref_internal,
        ref_supplier=m.ref_supplier,
        ref_label=m.ref_label,
        category=m.category,
        brand=m.brand,
        name=m.name,
        fit_type=m.fit_type,
        fabric_composition=m.fabric_composition,
        fabric_weight_gsm=m.fabric_weight_gsm,
        position=m.position,
        enabled=m.enabled,
        colors=[_serialize_color(c) for c in m.colors if c.enabled],
    )


@router.get("/tree", response_model=SupplierCatalogTree)
async def get_supplier_tree(db: AsyncSession = Depends(get_db)) -> SupplierCatalogTree:
    """Retourne l'arborescence complète : catégories → modèles → couleurs → vues."""
    result = await db.execute(
        select(SupplierModel)
        .where(SupplierModel.enabled.is_(True))
        .options(
            selectinload(SupplierModel.colors).selectinload(SupplierColor.mockups)
        )
        .order_by(SupplierModel.category, SupplierModel.position, SupplierModel.ref_internal)
    )
    models = list(result.scalars().all())

    by_category: dict[str, list[SupplierModelRead]] = {}
    for m in models:
        by_category.setdefault(m.category, []).append(_serialize_model(m))

    groups = [
        SupplierCategoryGroup(
            category=cat,
            label=CATEGORY_LABELS.get(cat, cat.title()),
            models=by_category[cat],
        )
        for cat in CATEGORY_ORDER
        if cat in by_category
    ]
    # Catégories non prévues à la fin
    for cat, ms in by_category.items():
        if cat not in CATEGORY_ORDER:
            groups.append(
                SupplierCategoryGroup(
                    category=cat, label=cat.title(), models=ms
                )
            )

    counts = await db.execute(
        select(
            func.count(SupplierModel.id.distinct()),
            func.count(SupplierColor.id.distinct()),
            func.count(SupplierMockup.id),
        )
        .select_from(SupplierModel)
        .join(SupplierColor, SupplierColor.supplier_model_id == SupplierModel.id, isouter=True)
        .join(SupplierMockup, SupplierMockup.supplier_color_id == SupplierColor.id, isouter=True)
    )
    n_models, n_colors, n_mockups = counts.one()

    return SupplierCatalogTree(
        categories=groups,
        total_models=int(n_models or 0),
        total_colors=int(n_colors or 0),
        total_mockups=int(n_mockups or 0),
        generated_at=datetime.now(timezone.utc),
    )


@router.get("/models/{ref_internal}", response_model=SupplierModelRead)
async def get_supplier_model(
    ref_internal: str, db: AsyncSession = Depends(get_db)
) -> SupplierModelRead:
    result = await db.execute(
        select(SupplierModel)
        .where(SupplierModel.ref_internal == ref_internal)
        .options(
            selectinload(SupplierModel.colors).selectinload(SupplierColor.mockups)
        )
    )
    obj = result.scalar_one_or_none()
    if not obj:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Supplier model {ref_internal} not found",
        )
    return _serialize_model(obj)
