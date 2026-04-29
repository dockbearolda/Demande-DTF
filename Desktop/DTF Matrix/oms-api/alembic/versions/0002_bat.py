"""add bat table

Revision ID: 0002
Revises: 0001
Create Date: 2026-04-23

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "0002"
down_revision: Union[str, None] = "0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "bats",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "order_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("orders.id"),
            nullable=False,
            index=True,
        ),
        sa.Column("token", sa.String(64), nullable=False, unique=True, index=True),
        sa.Column("file_path", sa.String(500), nullable=False),
        sa.Column("file_type", sa.String(50), nullable=False),
        sa.Column("file_name", sa.String(255), nullable=False),
        sa.Column("message", sa.String(2000)),
        sa.Column(
            "status",
            sa.Enum("PENDING", "APPROVED", "REJECTED", "EXPIRED", name="batstatus"),
            nullable=False,
            server_default="PENDING",
            index=True,
        ),
        sa.Column("decision_comment", sa.String(2000)),
        sa.Column("decided_at", sa.DateTime(timezone=True)),
        sa.Column("decided_ip", sa.String(64)),
        sa.Column("decided_user_agent", sa.String(500)),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("bats")
    op.execute("DROP TYPE IF EXISTS batstatus")
