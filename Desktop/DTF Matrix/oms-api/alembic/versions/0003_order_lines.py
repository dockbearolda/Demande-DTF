"""add order_lines table and fields to orders

Revision ID: 0003
Revises: 0002
Create Date: 2026-04-24

"""
from typing import Union
from alembic import op

revision: str = "0003"
down_revision: Union[str, None] = "0002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("""
        DO $$ BEGIN
            CREATE TYPE assignedto AS ENUM ('L', 'C', 'M');
        EXCEPTION WHEN duplicate_object THEN null;
        END $$;
    """)
    op.execute("""
        DO $$ BEGIN
            CREATE TYPE secteur AS ENUM ('DTF', 'PRESSAGE', 'UV', 'TROTEC', 'GOODIES', 'AUTRES');
        EXCEPTION WHEN duplicate_object THEN null;
        END $$;
    """)

    op.execute("""
        ALTER TABLE orders
            ADD COLUMN IF NOT EXISTS is_urgent BOOLEAN NOT NULL DEFAULT false,
            ADD COLUMN IF NOT EXISTS assigned_to assignedto,
            ADD COLUMN IF NOT EXISTS personne_contact VARCHAR(255),
            ADD COLUMN IF NOT EXISTS telephone VARCHAR(20),
            ADD COLUMN IF NOT EXISTS notes_globales VARCHAR(2000)
    """)

    op.execute("""
        CREATE TABLE IF NOT EXISTS order_lines (
            id UUID PRIMARY KEY,
            order_id UUID NOT NULL REFERENCES orders(id),
            ligne_numero INTEGER NOT NULL,
            secteur secteur NOT NULL,
            produit VARCHAR(255) NOT NULL,
            quantite INTEGER NOT NULL,
            notes VARCHAR(1000),
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS ix_order_lines_order_id ON order_lines(order_id)")


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS order_lines")
    op.execute("""
        ALTER TABLE orders
            DROP COLUMN IF EXISTS notes_globales,
            DROP COLUMN IF EXISTS telephone,
            DROP COLUMN IF EXISTS personne_contact,
            DROP COLUMN IF EXISTS assigned_to,
            DROP COLUMN IF EXISTS is_urgent
    """)
    op.execute("DROP TYPE IF EXISTS assignedto CASCADE")
    op.execute("DROP TYPE IF EXISTS secteur CASCADE")
