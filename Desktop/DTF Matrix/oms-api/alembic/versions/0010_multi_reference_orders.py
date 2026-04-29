"""multi-reference orders: order line variants, artworks, polymorphic product type

Revision ID: 0010
Revises: 0009
Create Date: 2026-04-26

Schema changes
==============
- Adds columns to `order_lines`:
    * `position` (int, default 0) — drag & drop reorder
    * `product_type` (enum ProductType, nullable) — polymorphic article kind
    * `product_id` (UUID FK catalog_products.id, nullable) — link to catalog
    * `options` (JSON, nullable) — type-specific extra fields

- Creates table `order_line_variants` — concrete declensions
  (color × size × format, qty, unit_price_ht).

- Creates table `order_line_artworks` — visuals per line, optionally linked
  to a BAT row via `bat_id`.

Backfill
========
For every existing `order_lines` row, a single `order_line_variants` row is
created with `qty = order_lines.quantite` and `unit_price_ht = order_lines.prix_unitaire`.
This keeps mono-reference legacy orders readable and editable through the new
multi-reference UI without losing any data.
"""
from typing import Union
import uuid

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "0010"
down_revision: Union[str, None] = "0009"
branch_labels = None
depends_on = None


PRODUCT_TYPE_VALUES = (
    "TSHIRT",
    "SWEAT",
    "HOODIE",
    "POLO",
    "CAP",
    "MAGNET",
    "STICKER",
    "PLEXIGLASS",
    "KEYRING",
    "MUG",
    "GOODIE",
    "OTHER",
)


def _is_postgres(bind) -> bool:
    return bind.dialect.name == "postgresql"


def upgrade() -> None:
    bind = op.get_bind()
    is_pg = _is_postgres(bind)
    uuid_type = postgresql.UUID(as_uuid=True) if is_pg else sa.Uuid()

    # ─── Postgres: create the producttype ENUM type up-front ─────────────
    if is_pg:
        product_type_enum = postgresql.ENUM(
            *PRODUCT_TYPE_VALUES, name="producttype", create_type=False
        )
        product_type_enum.create(bind, checkfirst=True)
        product_type_col = sa.Column(
            "product_type",
            postgresql.ENUM(*PRODUCT_TYPE_VALUES, name="producttype", create_type=False),
            nullable=True,
        )
    else:
        product_type_col = sa.Column(
            "product_type",
            sa.Enum(*PRODUCT_TYPE_VALUES, name="producttype"),
            nullable=True,
        )

    # ─── Add columns on order_lines ──────────────────────────────────────
    op.add_column(
        "order_lines",
        sa.Column("position", sa.Integer(), nullable=False, server_default="0"),
    )
    op.add_column("order_lines", product_type_col)
    op.add_column(
        "order_lines",
        sa.Column(
            "product_id",
            uuid_type,
            sa.ForeignKey("catalog_products.id"),
            nullable=True,
        ),
    )
    op.create_index(
        "ix_order_lines_product_id", "order_lines", ["product_id"]
    )
    op.add_column(
        "order_lines",
        sa.Column("options", sa.JSON(), nullable=True),
    )

    # ─── New table: order_line_variants ──────────────────────────────────
    op.create_table(
        "order_line_variants",
        sa.Column("id", uuid_type, primary_key=True),
        sa.Column(
            "order_line_id",
            uuid_type,
            sa.ForeignKey("order_lines.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("color", sa.String(80), nullable=True),
        sa.Column("size", sa.String(40), nullable=True),
        sa.Column("format", sa.String(80), nullable=True),
        sa.Column("qty", sa.Integer(), nullable=False, server_default="0"),
        sa.Column(
            "unit_price_ht",
            sa.Numeric(10, 2),
            nullable=False,
            server_default="0",
        ),
        sa.Column("position", sa.Integer(), nullable=False, server_default="0"),
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
    )

    # ─── New table: order_line_artworks ──────────────────────────────────
    op.create_table(
        "order_line_artworks",
        sa.Column("id", uuid_type, primary_key=True),
        sa.Column(
            "order_line_id",
            uuid_type,
            sa.ForeignKey("order_lines.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("side", sa.String(40), nullable=False),
        sa.Column("placement", sa.String(40), nullable=True),
        sa.Column("file_url", sa.String(500), nullable=True),
        sa.Column("bat_id", uuid_type, sa.ForeignKey("bats.id"), nullable=True),
        sa.Column("metadata", sa.JSON(), nullable=True),
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
    )

    # ─── Backfill: 1 variant per legacy order_line ───────────────────────
    # Use a CTAS-style insert so the migration runs in a single pass and
    # stays cheap on big tables. The variant inherits qty and unit price
    # from the parent line — colors/sizes are unknown, left NULL.
    if is_pg:
        op.execute(
            sa.text(
                """
                INSERT INTO order_line_variants (
                    id, order_line_id, color, size, format,
                    qty, unit_price_ht, position
                )
                SELECT
                    gen_random_uuid(),
                    id,
                    NULL,
                    NULL,
                    NULL,
                    quantite,
                    prix_unitaire,
                    0
                FROM order_lines
                """
            )
        )
    else:
        # SQLite: gen_random_uuid() doesn't exist — generate IDs in Python.
        rows = bind.execute(
            sa.text(
                "SELECT id, quantite, prix_unitaire FROM order_lines"
            )
        ).fetchall()
        for row in rows:
            bind.execute(
                sa.text(
                    """
                    INSERT INTO order_line_variants
                        (id, order_line_id, qty, unit_price_ht, position)
                    VALUES (:id, :line_id, :qty, :price, 0)
                    """
                ),
                {
                    "id": str(uuid.uuid4()),
                    "line_id": row[0],
                    "qty": row[1],
                    "price": row[2],
                },
            )

    # ─── Backfill: position copied from ligne_numero so the new sort
    # order matches what users currently see. ─────────────────────────────
    op.execute(
        sa.text("UPDATE order_lines SET position = ligne_numero")
    )


def downgrade() -> None:
    op.drop_table("order_line_artworks")
    op.drop_table("order_line_variants")

    op.drop_column("order_lines", "options")
    op.drop_index("ix_order_lines_product_id", table_name="order_lines")
    op.drop_column("order_lines", "product_id")
    op.drop_column("order_lines", "product_type")
    op.drop_column("order_lines", "position")

    bind = op.get_bind()
    if _is_postgres(bind):
        sa.Enum(name="producttype").drop(bind, checkfirst=True)
