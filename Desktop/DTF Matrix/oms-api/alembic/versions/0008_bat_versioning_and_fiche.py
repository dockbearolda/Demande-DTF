"""bat versioning + product fiche fields

Revision ID: 0008
Revises: 0007
Create Date: 2026-04-25

Adds:
  - bats.version, bats.parent_bat_id, bats.model_reference, bats.color_id
    → enables auto-incrementing versions per (order × model × color).
  - catalog_products.brand, sku_supplier, fabric_composition,
    fabric_weight_gsm, fit_type, print_techniques_json
    → fiche-produit data needed by the BAT PDF.
"""
from typing import Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "0008"
down_revision: Union[str, None] = "0007"
branch_labels = None
depends_on = None


def _is_postgres(bind) -> bool:
    return bind.dialect.name == "postgresql"


def upgrade() -> None:
    bind = op.get_bind()
    uuid_type = postgresql.UUID(as_uuid=True) if _is_postgres(bind) else sa.Uuid()

    # ─── BAT versioning ──────────────────────────────────────────────
    op.add_column(
        "bats",
        sa.Column("version", sa.Integer(), nullable=False, server_default="1"),
    )
    op.add_column(
        "bats",
        sa.Column("parent_bat_id", uuid_type, sa.ForeignKey("bats.id"), nullable=True),
    )
    op.add_column(
        "bats",
        sa.Column("model_reference", sa.String(120), nullable=True),
    )
    op.add_column(
        "bats",
        sa.Column("color_id", sa.String(80), nullable=True),
    )
    op.create_index(
        "ix_bats_model_reference", "bats", ["model_reference"]
    )
    op.create_index("ix_bats_color_id", "bats", ["color_id"])

    # ─── Fiche-produit fields on catalog_products ────────────────────
    op.add_column(
        "catalog_products",
        sa.Column("brand", sa.String(120), nullable=True),
    )
    op.add_column(
        "catalog_products",
        sa.Column("sku_supplier", sa.String(120), nullable=True),
    )
    op.add_column(
        "catalog_products",
        sa.Column("fabric_composition", sa.String(240), nullable=True),
    )
    op.add_column(
        "catalog_products",
        sa.Column("fabric_weight_gsm", sa.Integer(), nullable=True),
    )
    op.add_column(
        "catalog_products",
        sa.Column("fit_type", sa.String(40), nullable=True),
    )
    op.add_column(
        "catalog_products",
        sa.Column(
            "print_techniques_json",
            sa.JSON(),
            nullable=False,
            server_default=sa.text("'[]'"),
        ),
    )


def downgrade() -> None:
    op.drop_column("catalog_products", "print_techniques_json")
    op.drop_column("catalog_products", "fit_type")
    op.drop_column("catalog_products", "fabric_weight_gsm")
    op.drop_column("catalog_products", "fabric_composition")
    op.drop_column("catalog_products", "sku_supplier")
    op.drop_column("catalog_products", "brand")

    op.drop_index("ix_bats_color_id", table_name="bats")
    op.drop_index("ix_bats_model_reference", table_name="bats")
    op.drop_column("bats", "color_id")
    op.drop_column("bats", "model_reference")
    op.drop_column("bats", "parent_bat_id")
    op.drop_column("bats", "version")
