import uuid
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models.catalog import Family, Subfamily, Product, PricingMatrix
from app.schemas.catalog import (
    CatalogTree,
    FamilyCreate,
    FamilyRead,
    FamilyUpdate,
    PricingMatrixCreate,
    PricingMatrixRead,
    PricingMatrixUpdate,
    ProductCreate,
    ProductRead,
    ProductUpdate,
    SubfamilyCreate,
    SubfamilyRead,
    SubfamilyUpdate,
)

router = APIRouter(prefix="/catalog", tags=["catalog"])


# ───────── Helpers ─────────


async def _get_family_or_404(db: AsyncSession, family_id: uuid.UUID) -> Family:
    result = await db.execute(select(Family).where(Family.id == family_id))
    obj = result.scalar_one_or_none()
    if not obj:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Family not found")
    return obj


async def _get_subfamily_or_404(db: AsyncSession, subfamily_id: uuid.UUID) -> Subfamily:
    result = await db.execute(select(Subfamily).where(Subfamily.id == subfamily_id))
    obj = result.scalar_one_or_none()
    if not obj:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Subfamily not found")
    return obj


async def _get_product_or_404(db: AsyncSession, product_id: uuid.UUID) -> Product:
    result = await db.execute(select(Product).where(Product.id == product_id))
    obj = result.scalar_one_or_none()
    if not obj:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")
    return obj


async def _get_matrix_or_404(db: AsyncSession, matrix_id: uuid.UUID) -> PricingMatrix:
    result = await db.execute(select(PricingMatrix).where(PricingMatrix.id == matrix_id))
    obj = result.scalar_one_or_none()
    if not obj:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="PricingMatrix not found")
    return obj


# ───────── Tree ─────────


@router.get("/tree", response_model=CatalogTree)
async def get_tree(db: AsyncSession = Depends(get_db)) -> CatalogTree:
    fams_result = await db.execute(
        select(Family)
        .options(selectinload(Family.subfamilies).selectinload(Subfamily.products))
        .order_by(Family.position, Family.label)
    )
    families = list(fams_result.scalars().all())
    matrices_result = await db.execute(select(PricingMatrix).order_by(PricingMatrix.name))
    matrices = list(matrices_result.scalars().all())
    return CatalogTree(
        families=[FamilyRead.model_validate(f) for f in families],
        pricing_matrices=[PricingMatrixRead.model_validate(m) for m in matrices],
    )


# ───────── Families ─────────


@router.get("/families", response_model=list[FamilyRead])
async def list_families(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Family)
        .options(selectinload(Family.subfamilies).selectinload(Subfamily.products))
        .order_by(Family.position, Family.label)
    )
    return list(result.scalars().all())


@router.post("/families", response_model=FamilyRead, status_code=status.HTTP_201_CREATED)
async def create_family(payload: FamilyCreate, db: AsyncSession = Depends(get_db)):
    existing = await db.execute(select(Family).where(Family.slug == payload.slug))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Slug already exists")
    fam = Family(**payload.model_dump())
    db.add(fam)
    await db.commit()
    await db.refresh(fam)
    await db.refresh(fam, attribute_names=["subfamilies"])
    return fam


@router.patch("/families/{family_id}", response_model=FamilyRead)
async def update_family(
    family_id: uuid.UUID, payload: FamilyUpdate, db: AsyncSession = Depends(get_db)
):
    fam = await _get_family_or_404(db, family_id)
    data = payload.model_dump(exclude_unset=True)
    for k, v in data.items():
        setattr(fam, k, v)
    await db.commit()
    await db.refresh(fam)
    await db.refresh(fam, attribute_names=["subfamilies"])
    return fam


@router.delete("/families/{family_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_family(family_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    fam = await _get_family_or_404(db, family_id)
    fam.enabled = False
    # cascade soft: disable subfamilies & products
    sf_res = await db.execute(select(Subfamily).where(Subfamily.family_id == family_id))
    for sf in sf_res.scalars().all():
        sf.enabled = False
        prod_res = await db.execute(select(Product).where(Product.subfamily_id == sf.id))
        for p in prod_res.scalars().all():
            p.enabled = False
    await db.commit()


# ───────── Subfamilies ─────────


@router.get("/families/{family_id}/subfamilies", response_model=list[SubfamilyRead])
async def list_subfamilies(family_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    await _get_family_or_404(db, family_id)
    result = await db.execute(
        select(Subfamily)
        .options(selectinload(Subfamily.products))
        .where(Subfamily.family_id == family_id)
        .order_by(Subfamily.position, Subfamily.label)
    )
    return list(result.scalars().all())


@router.post(
    "/families/{family_id}/subfamilies",
    response_model=SubfamilyRead,
    status_code=status.HTTP_201_CREATED,
)
async def create_subfamily(
    family_id: uuid.UUID, payload: SubfamilyCreate, db: AsyncSession = Depends(get_db)
):
    await _get_family_or_404(db, family_id)
    sf = Subfamily(family_id=family_id, **payload.model_dump())
    db.add(sf)
    await db.commit()
    await db.refresh(sf)
    await db.refresh(sf, attribute_names=["products"])
    return sf


@router.patch("/subfamilies/{subfamily_id}", response_model=SubfamilyRead)
async def update_subfamily(
    subfamily_id: uuid.UUID, payload: SubfamilyUpdate, db: AsyncSession = Depends(get_db)
):
    sf = await _get_subfamily_or_404(db, subfamily_id)
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(sf, k, v)
    await db.commit()
    await db.refresh(sf)
    await db.refresh(sf, attribute_names=["products"])
    return sf


@router.delete("/subfamilies/{subfamily_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_subfamily(subfamily_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    sf = await _get_subfamily_or_404(db, subfamily_id)
    sf.enabled = False
    prod_res = await db.execute(select(Product).where(Product.subfamily_id == sf.id))
    for p in prod_res.scalars().all():
        p.enabled = False
    await db.commit()


# ───────── Products ─────────


@router.get("/subfamilies/{subfamily_id}/products", response_model=list[ProductRead])
async def list_products(subfamily_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    await _get_subfamily_or_404(db, subfamily_id)
    result = await db.execute(
        select(Product)
        .where(Product.subfamily_id == subfamily_id)
        .order_by(Product.position, Product.name)
    )
    return list(result.scalars().all())


@router.post(
    "/subfamilies/{subfamily_id}/products",
    response_model=ProductRead,
    status_code=status.HTTP_201_CREATED,
)
async def create_product(
    subfamily_id: uuid.UUID, payload: ProductCreate, db: AsyncSession = Depends(get_db)
):
    await _get_subfamily_or_404(db, subfamily_id)
    if payload.pricing_matrix_id:
        await _get_matrix_or_404(db, payload.pricing_matrix_id)
    data = payload.model_dump()
    colors = data.pop("colors", [])
    sizes = data.pop("sizes", [])
    p = Product(subfamily_id=subfamily_id, colors_json=colors, sizes_json=sizes, **data)
    db.add(p)
    await db.commit()
    await db.refresh(p)
    return p


@router.patch("/products/{product_id}", response_model=ProductRead)
async def update_product(
    product_id: uuid.UUID, payload: ProductUpdate, db: AsyncSession = Depends(get_db)
):
    p = await _get_product_or_404(db, product_id)
    data = payload.model_dump(exclude_unset=True)
    if "pricing_matrix_id" in data and data["pricing_matrix_id"]:
        await _get_matrix_or_404(db, data["pricing_matrix_id"])
    if "colors" in data:
        p.colors_json = data.pop("colors")
    if "sizes" in data:
        p.sizes_json = data.pop("sizes")
    for k, v in data.items():
        setattr(p, k, v)
    await db.commit()
    await db.refresh(p)
    return p


@router.delete("/products/{product_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_product(product_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    p = await _get_product_or_404(db, product_id)
    p.enabled = False
    await db.commit()


# ───────── PricingMatrices ─────────


@router.get("/pricing-matrices", response_model=list[PricingMatrixRead])
async def list_matrices(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(PricingMatrix).order_by(PricingMatrix.name))
    return list(result.scalars().all())


@router.post(
    "/pricing-matrices",
    response_model=PricingMatrixRead,
    status_code=status.HTTP_201_CREATED,
)
async def create_matrix(payload: PricingMatrixCreate, db: AsyncSession = Depends(get_db)):
    m = PricingMatrix(
        name=payload.name,
        currency=payload.currency,
        tiers_json=[t.model_dump() for t in payload.tiers],
    )
    db.add(m)
    await db.commit()
    await db.refresh(m)
    return m


@router.patch("/pricing-matrices/{matrix_id}", response_model=PricingMatrixRead)
async def update_matrix(
    matrix_id: uuid.UUID, payload: PricingMatrixUpdate, db: AsyncSession = Depends(get_db)
):
    m = await _get_matrix_or_404(db, matrix_id)
    data = payload.model_dump(exclude_unset=True)
    if "tiers" in data and data["tiers"] is not None:
        m.tiers_json = [t for t in data.pop("tiers")]
    for k, v in data.items():
        setattr(m, k, v)
    await db.commit()
    await db.refresh(m)
    return m


@router.delete("/pricing-matrices/{matrix_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_matrix(matrix_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    m = await _get_matrix_or_404(db, matrix_id)
    await db.delete(m)
    await db.commit()
