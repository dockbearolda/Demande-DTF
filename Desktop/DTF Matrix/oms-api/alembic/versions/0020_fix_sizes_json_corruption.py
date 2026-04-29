"""catalog: fix sizes_json corruption from 0019 (CAST AS JSON broken on SQLite)

Revision ID: 0020
Revises: 0019
Create Date: 2026-04-27
"""
from typing import Union

from alembic import op
import sqlalchemy as sa
import json

revision: str = "0020"
down_revision: Union[str, None] = "0019"
branch_labels = None
depends_on = None

SIZES_STANDARD = [
    {"id": "XS",  "label": "XS",  "order": 0},
    {"id": "S",   "label": "S",   "order": 1},
    {"id": "M",   "label": "M",   "order": 2},
    {"id": "L",   "label": "L",   "order": 3},
    {"id": "XL",  "label": "XL",  "order": 4},
    {"id": "2XL", "label": "2XL", "order": 5},
    {"id": "3XL", "label": "3XL", "order": 6},
]

SIZES_BABY = [
    {"id": "3M",  "label": "3 mois",  "order": 0},
    {"id": "6M",  "label": "6 mois",  "order": 1},
    {"id": "12M", "label": "12 mois", "order": 2},
    {"id": "18M", "label": "18 mois", "order": 3},
    {"id": "24M", "label": "24 mois", "order": 4},
]

_STD = json.dumps(SIZES_STANDARD)
_BABY = json.dumps(SIZES_BABY)

SLUG_SIZES = {
    "tshirt-homme":  _STD,
    "tshirt-femme":  _STD,
    "tshirt-enfant": _STD,
    "tshirt-bebe":   _BABY,
}


def upgrade() -> None:
    bind = op.get_bind()
    for slug, sizes_str in SLUG_SIZES.items():
        sf_row = bind.execute(
            sa.text("SELECT id FROM catalog_subfamilies WHERE slug = :slug"),
            {"slug": slug},
        ).fetchone()
        if not sf_row:
            continue
        sf_id = str(sf_row[0])
        bind.execute(
            sa.text(
                "UPDATE catalog_products SET sizes_json = :sizes "
                "WHERE subfamily_id = :sf_id"
            ),
            {"sizes": sizes_str, "sf_id": sf_id},
        )


def downgrade() -> None:
    pass
