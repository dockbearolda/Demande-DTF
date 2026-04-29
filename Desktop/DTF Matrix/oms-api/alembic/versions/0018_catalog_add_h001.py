"""catalog: add missing H-001 (NS300) to T-shirt Homme

Revision ID: 0018
Revises: 0017
Create Date: 2026-04-27
"""
import uuid
from typing import Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "0018"
down_revision: Union[str, None] = "0017"
branch_labels = None
depends_on = None

SIZES_ADULT = [
    {"id": "XS",  "label": "XS",  "order": 0},
    {"id": "S",   "label": "S",   "order": 1},
    {"id": "M",   "label": "M",   "order": 2},
    {"id": "L",   "label": "L",   "order": 3},
    {"id": "XL",  "label": "XL",  "order": 4},
    {"id": "XXL", "label": "XXL", "order": 5},
    {"id": "3XL", "label": "3XL", "order": 6},
]


def _is_postgres(bind) -> bool:
    return bind.dialect.name == "postgresql"


def upgrade() -> None:
    bind = op.get_bind()
    is_pg = _is_postgres(bind)
    uuid_type = postgresql.UUID(as_uuid=True) if is_pg else sa.Uuid()

    # Get pricing matrix and subfamily IDs
    pm_row = bind.execute(
        sa.text("SELECT id FROM catalog_pricing_matrices WHERE name = 'T-shirt Standard Flash'")
    ).fetchone()
    sf_row = bind.execute(
        sa.text("SELECT id FROM catalog_subfamilies WHERE slug = 'tshirt-homme'")
    ).fetchone()

    if not pm_row or not sf_row:
        return  # safety — nothing to insert if parent data is missing

    # Convert raw IDs to uuid.UUID for bulk_insert compatibility
    def to_uuid(raw):
        if isinstance(raw, uuid.UUID):
            return raw
        s = str(raw).replace("-", "")
        return uuid.UUID(hex=s)

    pm_id = to_uuid(pm_row[0])
    sf_id = to_uuid(sf_row[0])

    # Shift existing products down by 1 so H-001 can sit at position 0
    op.execute(sa.text(
        "UPDATE catalog_products SET position = position + 1 "
        "WHERE subfamily_id = (SELECT id FROM catalog_subfamilies WHERE slug = 'tshirt-homme')"
    ))

    products = sa.table(
        "catalog_products",
        sa.column("id", uuid_type),
        sa.column("subfamily_id", uuid_type),
        sa.column("reference", sa.String),
        sa.column("name", sa.String),
        sa.column("description", sa.String),
        sa.column("pricing_matrix_id", uuid_type),
        sa.column("position", sa.Integer),
        sa.column("enabled", sa.Boolean),
        sa.column("colors_json", sa.JSON),
        sa.column("sizes_json", sa.JSON),
        sa.column("print_techniques_json", sa.JSON),
    )
    op.bulk_insert(products, [{
        "id": uuid.uuid4(),
        "subfamily_id": sf_id,
        "reference": "H-001",
        "name": "NS300",
        "description": None,
        "pricing_matrix_id": pm_id,
        "position": 0,
        "enabled": True,
        "colors_json": [],
        "sizes_json": SIZES_ADULT,
        "print_techniques_json": [],
    }])


def downgrade() -> None:
    op.execute(sa.text("DELETE FROM catalog_products WHERE reference = 'H-001'"))
    op.execute(sa.text(
        "UPDATE catalog_products SET position = position - 1 "
        "WHERE subfamily_id = (SELECT id FROM catalog_subfamilies WHERE slug = 'tshirt-homme') "
        "AND position > 0"
    ))
