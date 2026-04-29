import logging
from contextlib import asynccontextmanager
from pathlib import Path
from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.exceptions import RequestValidationError
from sqlalchemy.exc import IntegrityError, SQLAlchemyError

from app.config import settings
from app.database import Base, engine
from app.logging_config import setup_logging
from app.routes import clients, orders, bat, kanban, catalog, supplier_catalog, drafts, admin, pricing, quotes
from app import models  # noqa: F401  register models

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    setup_logging()
    if settings.AUTO_CREATE_TABLES:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
    logger.info("api_startup", extra={"event": "startup"})
    yield
    logger.info("api_shutdown", extra={"event": "shutdown"})


app = FastAPI(title="OMS API", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    # Méthodes/headers explicites — combinés à `allow_credentials=True`,
    # `*` est trop permissif et plusieurs navigateurs le refusent activement.
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=[
        "Authorization",
        "Content-Type",
        "Accept",
        "Origin",
        "X-Requested-With",
        "X-Webhook-Signature",
        "X-Webhook-Event",
    ],
)


@app.exception_handler(RequestValidationError)
async def validation_handler(request: Request, exc: RequestValidationError):
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={"detail": "Validation error", "errors": exc.errors()},
    )


def _safe_path(request: Request) -> str:
    """Logge le path sans la query string — celle-ci peut contenir des PII
    (search=email@…) ou des tokens dans des cas d'usage futurs."""
    return request.url.path


@app.exception_handler(IntegrityError)
async def integrity_handler(request: Request, exc: IntegrityError):
    logger.warning("integrity_error", extra={"path": _safe_path(request)})
    return JSONResponse(
        status_code=status.HTTP_409_CONFLICT,
        content={"detail": "Database integrity error"},
    )


@app.exception_handler(SQLAlchemyError)
async def sqlalchemy_handler(request: Request, exc: SQLAlchemyError):
    logger.exception("db_error", extra={"path": _safe_path(request)})
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"detail": "Database error"},
    )


@app.get("/health", tags=["health"])
async def health():
    return {"status": "ok"}


app.include_router(clients.router)
app.include_router(orders.router)
app.include_router(bat.router)
app.include_router(kanban.router)
app.include_router(catalog.router)
app.include_router(supplier_catalog.router)
app.include_router(drafts.router)
app.include_router(admin.router)
app.include_router(pricing.router)
app.include_router(quotes.router)


# ─── Mockups fournisseur (servis statiquement) ──────────────────────
# Dossier indexé par la commande `python cli.py seed-supplier-catalog`.
# Peut être un symlink en dev vers le dossier source ; en prod un vrai
# dossier ou un mount S3/Cloudflare R2.
_mockups_dir = Path(settings.SUPPLIER_MOCKUPS_PATH).resolve()
if _mockups_dir.exists():
    app.mount(
        settings.SUPPLIER_MOCKUPS_PUBLIC_PREFIX,
        StaticFiles(directory=str(_mockups_dir), check_dir=False),
        name="supplier-mockups",
    )
else:
    logger.warning(
        "supplier_mockups_dir_missing path=%s — endpoint catalogue fournisseur "
        "fonctionnera mais les images renverront 404 tant que le dossier "
        "n'existe pas (lance `python cli.py seed-supplier-catalog`)",
        _mockups_dir,
    )
