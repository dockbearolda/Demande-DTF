"""drop users table (auth removed)

Revision ID: 0005
Revises: 0004
Create Date: 2026-04-24

"""
from typing import Union
from alembic import op


revision: str = "0005"
down_revision: Union[str, None] = "0004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.drop_table("users")
    op.execute("DROP TYPE IF EXISTS userrole")


def downgrade() -> None:
    # Recreate the table for rollback (auth removed in this revision).
    import sqlalchemy as sa
    from sqlalchemy.dialects import postgresql

    op.create_table(
        "users",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("email", sa.String(255), nullable=False, unique=True, index=True),
        sa.Column("hashed_password", sa.String(255), nullable=False),
        sa.Column("role", sa.Enum("ADMIN", "OPERATOR", name="userrole"), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
