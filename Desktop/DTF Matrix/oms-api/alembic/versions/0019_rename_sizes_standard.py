"""catalog: rename XXL→2XL in adult sizes, replace kid sizes with XS-3XL

Revision ID: 0019
Revises: 0018
Create Date: 2026-04-27
"""
from typing import Union

from alembic import op
import sqlalchemy as sa
import json

revision: str = "0019"
down_revision: Union[str, None] = "0018"
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

SIZES_STANDARD_OLD_ADULT = [
    {"id": "XS",  "label": "XS",  "order": 0},
    {"id": "S",   "label": "S",   "order": 1},
    {"id": "M",   "label": "M",   "order": 2},
    {"id": "L",   "label": "L",   "order": 3},
    {"id": "XL",  "label": "XL",  "order": 4},
    {"id": "XXL", "label": "XXL", "order": 5},
    {"id": "3XL", "label": "3XL", "order": 6},
]

# Kid subfamilies to migrate to standard sizes
KID_SLUGS = ("tshirt-enfant", "tshirt-bebe")


def _sizes_json_literal(sizes):
    return json.dumps(sizes)


def upgrade() -> None:
    bind = op.get_bind()

    # Update adult subfamilies: rename XXL → 2XL
    for slug in ("tshirt-homme", "tshirt-femme"):
        sf_row = bind.execute(
            sa.text("SELECT id FROM catalog_subfamilies WHERE slug = :slug"),
            {"slug": slug},
        ).fetchone()
        if not sf_row:
            continue
        sf_id = sf_row[0]

        products = bind.execute(
            sa.text("SELECT id, sizes_json FROM catalog_products WHERE subfamily_id = :sf_id"),
            {"sf_id": sf_id},
        ).fetchall()
        for row in products:
            prod_id, sizes = row[0], row[1]
            if isinstance(sizes, str):
                sizes = json.loads(sizes)
            updated = [
                {**s, "id": "2XL", "label": "2XL"} if s.get("id") == "XXL" else s
                for s in sizes
            ]
            op.execute(
                sa.text(
                    "UPDATE catalog_products SET sizes_json = CAST(:sizes AS JSON) WHERE id = :id"
                ).bindparams(sizes=json.dumps(updated), id=str(prod_id))
            )

    # Update kid/baby subfamilies: replace with standard sizes
    for slug in KID_SLUGS:
        op.execute(
            sa.text(
                "UPDATE catalog_products SET sizes_json = CAST(:sizes AS JSON) "
                "WHERE subfamily_id = (SELECT id FROM catalog_subfamilies WHERE slug = :slug)"
            ).bindparams(sizes=_sizes_json_literal(SIZES_STANDARD), slug=slug)
        )


def downgrade() -> None:
    bind = op.get_bind()

    # Restore adult: 2XL → XXL
    for slug in ("tshirt-homme", "tshirt-femme"):
        sf_row = bind.execute(
            sa.text("SELECT id FROM catalog_subfamilies WHERE slug = :slug"),
            {"slug": slug},
        ).fetchone()
        if not sf_row:
            continue
        sf_id = sf_row[0]

        products = bind.execute(
            sa.text("SELECT id, sizes_json FROM catalog_products WHERE subfamily_id = :sf_id"),
            {"sf_id": sf_id},
        ).fetchall()
        for row in products:
            prod_id, sizes = row[0], row[1]
            if isinstance(sizes, str):
                sizes = json.loads(sizes)
            restored = [
                {**s, "id": "XXL", "label": "XXL"} if s.get("id") == "2XL" else s
                for s in sizes
            ]
            op.execute(
                sa.text(
                    "UPDATE catalog_products SET sizes_json = CAST(:sizes AS JSON) WHERE id = :id"
                ).bindparams(sizes=json.dumps(restored), id=str(prod_id))
            )

    # Restore kid sizes (approximate — original kid/baby sizes)
    KID_SIZES_OLD = [
        {"id": "2A",  "label": "2 ans",  "order": 0},
        {"id": "4A",  "label": "4 ans",  "order": 1},
        {"id": "6A",  "label": "6 ans",  "order": 2},
        {"id": "8A",  "label": "8 ans",  "order": 3},
        {"id": "10A", "label": "10 ans", "order": 4},
        {"id": "12A", "label": "12 ans", "order": 5},
        {"id": "14A", "label": "14 ans", "order": 6},
    ]
    op.execute(
        sa.text(
            "UPDATE catalog_products SET sizes_json = CAST(:sizes AS JSON) "
            "WHERE subfamily_id = (SELECT id FROM catalog_subfamilies WHERE slug = 'tshirt-enfant')"
        ).bindparams(sizes=_sizes_json_literal(KID_SIZES_OLD))
    )
