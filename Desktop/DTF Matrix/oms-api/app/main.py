import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from sqlalchemy.exc import IntegrityError, SQLAlchemyError

from app.config import settings
from app.database import Base, engine
from app.logging_config import setup_logging
from app.routes import clients, orders, bat, kanban, catalog
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
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(RequestValidationError)
async def validation_handler(request: Request, exc: RequestValidationError):
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={"detail": "Validation error", "errors": exc.errors()},
    )


@app.exception_handler(IntegrityError)
async def integrity_handler(request: Request, exc: IntegrityError):
    logger.warning("integrity_error", extra={"path": str(request.url)})
    return JSONResponse(
        status_code=status.HTTP_409_CONFLICT,
        content={"detail": "Database integrity error"},
    )


@app.exception_handler(SQLAlchemyError)
async def sqlalchemy_handler(request: Request, exc: SQLAlchemyError):
    logger.exception("db_error", extra={"path": str(request.url)})
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
