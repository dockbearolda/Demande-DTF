"""add composition_metadata to bats

Revision ID: 0004
Revises: 0003
Create Date: 2026-04-24

"""
from typing import Union
from alembic import op
import sqlalchemy as sa

revision: str = "0004"
down_revision: Union[str, None] = "0003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "bats",
        sa.Column("composition_metadata", sa.Text(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("bats", "composition_metadata")
