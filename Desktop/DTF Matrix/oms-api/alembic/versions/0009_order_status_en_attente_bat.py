"""add EN_ATTENTE_BAT to order_status enum

Revision ID: 0009
Revises: 0008
Create Date: 2026-04-25

Adds the EN_ATTENTE_BAT value to the orderstatus enum so orders can be
created without a validated BAT (BAT to be sent later).
"""
from typing import Union
from alembic import op


revision: str = "0009"
down_revision: Union[str, None] = "0008"
branch_labels = None
depends_on = None


def _is_postgres(bind) -> bool:
    return bind.dialect.name == "postgresql"


def upgrade() -> None:
    bind = op.get_bind()
    if _is_postgres(bind):
        # Postgres requires ALTER TYPE … ADD VALUE for enum extension; must
        # run outside a transaction in some versions, but Alembic's online
        # mode handles this when autocommit_block is used.
        with op.get_context().autocommit_block():
            op.execute(
                "ALTER TYPE orderstatus ADD VALUE IF NOT EXISTS 'EN_ATTENTE_BAT'"
            )
    # SQLite: enum is text-backed, nothing to migrate.


def downgrade() -> None:
    # Postgres does not support removing enum values without recreating the
    # type; left as a no-op intentionally.
    pass
