"""sourcing spécial: order_lines.is_sourcing_required + EN_ATTENTE_SOURCING status

Revision ID: 0013
Revises: 0012
Create Date: 2026-04-27

Schema changes
==============
- Adds `EN_ATTENTE_SOURCING` to the `orderstatus` enum so a freshly created
  order containing at least one out-of-catalog line lands in a dedicated
  workflow column instead of "Brouillon".

- Adds three columns on `order_lines` to support out-of-catalog items:
    * `is_sourcing_required` (bool, default False, indexed) — flag.
    * `sourcing_description` (str 2000, nullable) — détail des attentes client.
    * `sourcing_budget_estime` (numeric 10,2, nullable) — budget indicatif.

Existing rows default to `is_sourcing_required = False`, so legacy orders
remain untouched and keep their current statuses.
"""
from typing import Union

from alembic import op
import sqlalchemy as sa


revision: str = "0013"
down_revision: Union[str, None] = "0012"
branch_labels = None
depends_on = None


def _is_postgres(bind) -> bool:
    return bind.dialect.name == "postgresql"


def upgrade() -> None:
    bind = op.get_bind()
    is_pg = _is_postgres(bind)

    # ─── Extend orderstatus enum ──────────────────────────────────────────
    if is_pg:
        with op.get_context().autocommit_block():
            op.execute(
                "ALTER TYPE orderstatus ADD VALUE IF NOT EXISTS 'EN_ATTENTE_SOURCING'"
            )
    # SQLite : enum text-backed, rien à faire.

    # ─── Sourcing columns on order_lines ──────────────────────────────────
    op.add_column(
        "order_lines",
        sa.Column(
            "is_sourcing_required",
            sa.Boolean(),
            nullable=False,
            server_default=sa.false(),
        ),
    )
    op.add_column(
        "order_lines",
        sa.Column("sourcing_description", sa.String(2000), nullable=True),
    )
    op.add_column(
        "order_lines",
        sa.Column(
            "sourcing_budget_estime",
            sa.Numeric(10, 2),
            nullable=True,
        ),
    )
    op.create_index(
        "ix_order_lines_is_sourcing_required",
        "order_lines",
        ["is_sourcing_required"],
    )


def downgrade() -> None:
    op.drop_index(
        "ix_order_lines_is_sourcing_required", table_name="order_lines"
    )
    op.drop_column("order_lines", "sourcing_budget_estime")
    op.drop_column("order_lines", "sourcing_description")
    op.drop_column("order_lines", "is_sourcing_required")
    # Postgres : retrait d'une valeur enum non supporté sans recréation du
    # type — laissé en no-op intentionnellement.
