"""client.ville column

Revision ID: 0015
Revises: 0014
Create Date: 2026-04-27

Ajoute la colonne `ville` (nullable, str 255) sur la table `clients`.
"""
from typing import Union

from alembic import op
import sqlalchemy as sa


revision: str = "0015"
down_revision: Union[str, None] = "0014"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "clients",
        sa.Column("ville", sa.String(255), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("clients", "ville")
