"""client_contacts table + nom_facture

Revision ID: 0016
Revises: 0015
Create Date: 2026-04-27

- Ajoute `nom_facture` (nullable, str 255) sur la table `clients`
- Crée la table `client_contacts` pour les responsables internes d'un client
"""
from typing import Union

import sqlalchemy as sa
from alembic import op


revision: str = "0016"
down_revision: Union[str, None] = "0015"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "clients",
        sa.Column("nom_facture", sa.String(255), nullable=True),
    )
    op.create_table(
        "client_contacts",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column(
            "client_id",
            sa.Uuid(),
            sa.ForeignKey("clients.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("nom", sa.String(255), nullable=False),
        sa.Column("telephone", sa.String(50), nullable=True),
        sa.Column("email", sa.String(255), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )


def downgrade() -> None:
    op.drop_table("client_contacts")
    op.drop_column("clients", "nom_facture")
