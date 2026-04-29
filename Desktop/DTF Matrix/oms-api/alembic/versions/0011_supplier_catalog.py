"""supplier catalog: SupplierModel / SupplierColor / SupplierMockup + legacy mapping

Revision ID: 0011
Revises: 0010
Create Date: 2026-04-26

Crée le catalogue fournisseur indexé depuis le dossier
`Mokeup fournisseur uniforme/`. Pas de seed dans la migration : le seed
est piloté par la commande CLI `python cli.py seed-supplier-catalog`
qui parse le `_manifest.csv` et peuple les tables de façon idempotente.
"""
from typing import Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "0011"
down_revision: Union[str, None] = "0010"
branch_labels = None
depends_on = None


def _is_postgres(bind) -> bool:
    return bind.dialect.name == "postgresql"


def upgrade() -> None:
    bind = op.get_bind()
    uuid_type = postgresql.UUID(as_uuid=True) if _is_postgres(bind) else sa.Uuid()

    op.create_table(
        "supplier_models",
        sa.Column("id", uuid_type, primary_key=True),
        sa.Column("ref_internal", sa.String(20), nullable=False, index=True),
        sa.Column("ref_supplier", sa.String(40), nullable=False, index=True),
        sa.Column("ref_label", sa.String(80), nullable=False),
        sa.Column("category", sa.String(20), nullable=False, index=True),
        sa.Column("brand", sa.String(80), nullable=True),
        sa.Column("name", sa.String(180), nullable=True),
        sa.Column("fit_type", sa.String(40), nullable=True),
        sa.Column("fabric_composition", sa.String(240), nullable=True),
        sa.Column("fabric_weight_gsm", sa.Integer(), nullable=True),
        sa.Column("position", sa.Integer(), nullable=False, server_default="0"),
        sa.Column(
            "enabled", sa.Boolean(), nullable=False, server_default=sa.text("true")
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.UniqueConstraint("ref_internal", name="uq_supplier_model_ref_internal"),
    )

    op.create_table(
        "supplier_colors",
        sa.Column("id", uuid_type, primary_key=True),
        sa.Column(
            "supplier_model_id",
            uuid_type,
            sa.ForeignKey("supplier_models.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("slug", sa.String(60), nullable=False),
        sa.Column("label", sa.String(80), nullable=False),
        sa.Column("hex", sa.String(7), nullable=True),
        sa.Column("position", sa.Integer(), nullable=False, server_default="0"),
        sa.Column(
            "enabled", sa.Boolean(), nullable=False, server_default=sa.text("true")
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.UniqueConstraint(
            "supplier_model_id", "slug", name="uq_supplier_color_model_slug"
        ),
    )

    op.create_table(
        "supplier_mockups",
        sa.Column("id", uuid_type, primary_key=True),
        sa.Column(
            "supplier_color_id",
            uuid_type,
            sa.ForeignKey("supplier_colors.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("view", sa.String(30), nullable=False),
        sa.Column("file_path", sa.String(400), nullable=False),
        sa.Column("ext", sa.String(10), nullable=False),
        sa.Column("width", sa.Integer(), nullable=True),
        sa.Column("height", sa.Integer(), nullable=True),
        sa.Column(
            "is_lifestyle",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.UniqueConstraint(
            "supplier_color_id", "view", name="uq_supplier_mockup_color_view"
        ),
    )

    op.create_table(
        "supplier_legacy_mappings",
        sa.Column("legacy_model_id", sa.String(120), primary_key=True),
        sa.Column(
            "supplier_model_id",
            uuid_type,
            sa.ForeignKey("supplier_models.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("default_color_slug", sa.String(60), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )


def downgrade() -> None:
    op.drop_table("supplier_legacy_mappings")
    op.drop_table("supplier_mockups")
    op.drop_table("supplier_colors")
    op.drop_table("supplier_models")
