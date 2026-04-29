"""client.contact column

Revision ID: 0012
Revises: 0011
Create Date: 2026-04-27

Ajoute la colonne `contact` (nullable, str 255) sur la table `clients` —
utilisée par le mini-formulaire de création inline du Combobox client.
"""
from typing import Union

from alembic import op
import sqlalchemy as sa


revision: str = "0012"
down_revision: Union[str, None] = "0011"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "clients",
        sa.Column("contact", sa.String(255), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("clients", "contact")
