import secrets
from decimal import Decimal

from fastapi import APIRouter, Depends, Header, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.models.parametres import ParametresGlobaux
from app.schemas.parametres import ParametresGlobauxRead, ParametresGlobauxUpdate


async def require_admin_token(
    x_admin_token: str | None = Header(default=None, alias="X-Admin-Token"),
) -> None:
    """Lightweight admin guard used by /admin/* routes.

    Compare via constant-time comparison to avoid timing oracles. Until the
    `ADMIN_TOKEN` env var is set the endpoints return 503, which fails closed
    rather than silently exposing them in dev/staging.
    """
    expected = settings.ADMIN_TOKEN
    if not expected:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Admin endpoints are disabled (ADMIN_TOKEN not configured).",
        )
    if not x_admin_token or not secrets.compare_digest(x_admin_token, expected):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or missing X-Admin-Token header.",
        )


router = APIRouter(
    prefix="/admin",
    tags=["admin"],
    dependencies=[Depends(require_admin_token)],
)


async def _get_singleton(db: AsyncSession) -> ParametresGlobaux:
    result = await db.execute(select(ParametresGlobaux).where(ParametresGlobaux.id == 1))
    obj = result.scalar_one_or_none()
    if obj is None:
        # Auto-création si table vide (cas tests sans migration)
        obj = ParametresGlobaux(
            id=1,
            transport_ttc=Decimal("1.56"),
            taux_tgca=Decimal("0.0400"),
        )
        db.add(obj)
        await db.commit()
        await db.refresh(obj)
    return obj


@router.get("/parametres", response_model=ParametresGlobauxRead)
async def get_parametres(db: AsyncSession = Depends(get_db)) -> ParametresGlobauxRead:
    obj = await _get_singleton(db)
    return ParametresGlobauxRead.model_validate(obj)


@router.put("/parametres", response_model=ParametresGlobauxRead)
async def update_parametres(
    payload: ParametresGlobauxUpdate, db: AsyncSession = Depends(get_db)
) -> ParametresGlobauxRead:
    obj = await _get_singleton(db)
    if payload.transport_ttc is not None:
        obj.transport_ttc = Decimal(str(payload.transport_ttc))
    if payload.taux_tgca is not None:
        obj.taux_tgca = Decimal(str(payload.taux_tgca))
    await db.commit()
    await db.refresh(obj)
    return ParametresGlobauxRead.model_validate(obj)
