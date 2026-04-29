"""add prix_unitaire to order_lines

Revision ID: 0006
Revises: 0005
Create Date: 2026-04-24

"""
from typing import Union
from alembic import op
import sqlalchemy as sa


revision: str = "0006"
down_revision: Union[str, None] = "0005"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "order_lines",
        sa.Column(
            "prix_unitaire",
            sa.Numeric(10, 2),
            nullable=False,
            server_default="0",
        ),
    )


def downgrade() -> None:
    op.drop_column("order_lines", "prix_unitaire")
