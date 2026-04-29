"""Quotes (devis) — table dédiée pour la persistance Devis Flash v2.

Revision ID: 0022
Revises: 0021
Create Date: 2026-04-28

- Création table `quotes` : entité distincte des Order, snapshot du moteur
  pricing au moment de l'enregistrement, statut (draft / on_hold / sent /
  converted).
- Référence auto-générée côté service (format `D-2026-0001`), index unique.
"""
from typing import Union

from alembic import op
import sqlalchemy as sa


revision: str = "0022"
down_revision: Union[str, None] = "0021"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "quotes",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("reference", sa.String(length=40), nullable=False),
        sa.Column(
            "client_id",
            sa.Uuid(),
            sa.ForeignKey("clients.id"),
            nullable=False,
            index=True,
        ),
        sa.Column("model_ref", sa.String(length=120), nullable=False),
        sa.Column("matrix_name", sa.String(length=120), nullable=False),
        sa.Column("quantity", sa.Integer(), nullable=False),
        # Liste des emplacements logos sélectionnés (JSON list of strings,
        # cf. ALL_PLACEMENTS du moteur pricing).
        sa.Column("placements", sa.JSON(), nullable=False),
        sa.Column("transport_active", sa.Boolean(), nullable=False, server_default="1"),
        sa.Column("tgca_active", sa.Boolean(), nullable=False, server_default="0"),
        sa.Column(
            "discount",
            sa.Numeric(10, 2),
            nullable=False,
            server_default="0",
        ),
        sa.Column("notes", sa.String(length=2000), nullable=True),
        # Snapshot des montants au moment de l'enregistrement (figés pour
        # cohérence du PDF / reproductibilité même si la grille ou les
        # paramètres globaux changent ensuite).
        sa.Column("snapshot_sous_total_ht", sa.Numeric(12, 2), nullable=False),
        sa.Column("snapshot_montant_tgca", sa.Numeric(12, 2), nullable=False),
        sa.Column("snapshot_transport_ttc", sa.Numeric(12, 2), nullable=False),
        sa.Column("snapshot_total_avant_remise", sa.Numeric(12, 2), nullable=False),
        sa.Column("snapshot_total_ttc", sa.Numeric(12, 2), nullable=False),
        sa.Column("snapshot_palier_applique", sa.Integer(), nullable=True),
        # Output complet du moteur (logos line-by-line, warnings, etc.) pour
        # reconstruction exacte du PDF sans recalcul.
        sa.Column("snapshot_payload", sa.JSON(), nullable=False),
        sa.Column(
            "status",
            sa.String(length=20),
            nullable=False,
            server_default="draft",
            index=True,
        ),
        sa.Column(
            "is_deleted",
            sa.Boolean(),
            nullable=False,
            server_default="0",
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
    )
    op.create_index(
        "ix_quotes_reference",
        "quotes",
        ["reference"],
        unique=True,
    )


def downgrade() -> None:
    op.drop_index("ix_quotes_reference", table_name="quotes")
    op.drop_table("quotes")
