"""catalog (families, subfamilies, products, pricing matrices) + seed

Revision ID: 0007
Revises: 0006
Create Date: 2026-04-24

"""
import json
import uuid
from typing import Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "0007"
down_revision: Union[str, None] = "0006"
branch_labels = None
depends_on = None


# ───────── Données seed (alignées sur catalog.mock.ts) ─────────

SIZES_ADULT = [
    {"id": "XS", "label": "XS", "order": 0},
    {"id": "S", "label": "S", "order": 1},
    {"id": "M", "label": "M", "order": 2},
    {"id": "L", "label": "L", "order": 3},
    {"id": "XL", "label": "XL", "order": 4},
    {"id": "XXL", "label": "XXL", "order": 5},
    {"id": "3XL", "label": "3XL", "order": 6},
]

PREMIUM_TIERS = [
    {"minQty": 1, "vierge": 15.39, "coeur": 9.5, "dos": 16.2},
    {"minQty": 5, "vierge": 8.5, "coeur": 6.37, "dos": 12.1},
    {"minQty": 10, "vierge": 7.74, "coeur": 5.1, "dos": 10.8},
    {"minQty": 20, "vierge": 7.37, "coeur": 4.47, "dos": 9.45},
    {"minQty": 30, "vierge": 7.01, "coeur": 4.07, "dos": 8.1},
    {"minQty": 40, "vierge": 6.64, "coeur": 3.82, "dos": 7.6},
    {"minQty": 50, "vierge": 6.28, "coeur": 3.57, "dos": 7.3},
    {"minQty": 60, "vierge": 6.08, "coeur": 3.44, "dos": 7.0},
    {"minQty": 70, "vierge": 5.91, "coeur": 3.32, "dos": 6.8},
    {"minQty": 80, "vierge": 5.55, "coeur": 3.19, "dos": 6.5},
    {"minQty": 90, "vierge": 5.35, "coeur": 3.05, "dos": 6.2},
    {"minQty": 100, "vierge": 5.14, "coeur": 2.93, "dos": 5.9},
    {"minQty": 150, "vierge": 5.14, "coeur": 2.8, "dos": 5.7},
]

ECO_VIERGE = {1: 10.9, 5: 6.2, 10: 5.6, 20: 5.35, 30: 5.1, 40: 4.85, 50: 4.6, 60: 4.45, 70: 4.3, 80: 4.1, 90: 3.95, 100: 3.8, 150: 3.8}
CLASSIC_VIERGE = {1: 13.1, 5: 7.25, 10: 6.6, 20: 6.3, 30: 5.95, 40: 5.65, 50: 5.35, 60: 5.2, 70: 5.05, 80: 4.75, 90: 4.55, 100: 4.4, 150: 4.4}

ECO_TIERS = [{"minQty": t["minQty"], "vierge": ECO_VIERGE[t["minQty"]], "coeur": t["coeur"], "dos": t["dos"]} for t in PREMIUM_TIERS]
CLASSIC_TIERS = [{"minQty": t["minQty"], "vierge": CLASSIC_VIERGE[t["minQty"]], "coeur": t["coeur"], "dos": t["dos"]} for t in PREMIUM_TIERS]

ECO_COLORS = [
    {"id": "white", "label": "Blanc", "hex": "#ffffff", "swatchBorder": True},
    {"id": "black", "label": "Noir", "hex": "#111111"},
    {"id": "navy", "label": "Marine", "hex": "#1b2a4e"},
]
CLASSIC_COLORS = ECO_COLORS + [
    {"id": "red", "label": "Rouge", "hex": "#c0392b"},
    {"id": "grey", "label": "Gris chiné", "hex": "#9aa0a6"},
]
PREMIUM_COLORS = CLASSIC_COLORS + [
    {"id": "forest", "label": "Vert forêt", "hex": "#2f5233"},
    {"id": "bordeaux", "label": "Bordeaux", "hex": "#5c1a1b"},
    {"id": "sand", "label": "Sable", "hex": "#d6c9a8", "swatchBorder": True},
]


def _is_postgres(bind) -> bool:
    return bind.dialect.name == "postgresql"


def _uuid_col():
    # SQLite stores Uuid as CHAR(32) via SQLAlchemy Uuid type but in raw DDL we use BLOB-equivalent;
    # using sa.Uuid() lets the type adapt to the dialect.
    return sa.Uuid()


def upgrade() -> None:
    bind = op.get_bind()
    uuid_type = postgresql.UUID(as_uuid=True) if _is_postgres(bind) else sa.Uuid()

    op.create_table(
        "catalog_families",
        sa.Column("id", uuid_type, primary_key=True),
        sa.Column("slug", sa.String(80), nullable=False, unique=True, index=True),
        sa.Column("label", sa.String(120), nullable=False),
        sa.Column("icon", sa.String(60), nullable=False, server_default="Shirt"),
        sa.Column("position", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("enabled", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    op.create_table(
        "catalog_subfamilies",
        sa.Column("id", uuid_type, primary_key=True),
        sa.Column("family_id", uuid_type, sa.ForeignKey("catalog_families.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("slug", sa.String(80), nullable=False, index=True),
        sa.Column("label", sa.String(120), nullable=False),
        sa.Column("target", sa.String(20), nullable=True),
        sa.Column("position", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("enabled", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint("family_id", "slug", name="uq_subfamily_family_slug"),
    )

    op.create_table(
        "catalog_pricing_matrices",
        sa.Column("id", uuid_type, primary_key=True),
        sa.Column("name", sa.String(120), nullable=False, unique=True),
        sa.Column("currency", sa.String(3), nullable=False, server_default="EUR"),
        sa.Column("tiers_json", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    op.create_table(
        "catalog_products",
        sa.Column("id", uuid_type, primary_key=True),
        sa.Column("subfamily_id", uuid_type, sa.ForeignKey("catalog_subfamilies.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("reference", sa.String(120), nullable=False),
        sa.Column("name", sa.String(180), nullable=False),
        sa.Column("description", sa.String(500), nullable=True),
        sa.Column("image_url", sa.String(500), nullable=True),
        sa.Column("pricing_matrix_id", uuid_type, sa.ForeignKey("catalog_pricing_matrices.id"), nullable=True),
        sa.Column("position", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("enabled", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("colors_json", sa.JSON(), nullable=False),
        sa.Column("sizes_json", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # ───────── Seed ─────────
    families = sa.table(
        "catalog_families",
        sa.column("id", uuid_type),
        sa.column("slug", sa.String),
        sa.column("label", sa.String),
        sa.column("icon", sa.String),
        sa.column("position", sa.Integer),
        sa.column("enabled", sa.Boolean),
    )
    subfamilies = sa.table(
        "catalog_subfamilies",
        sa.column("id", uuid_type),
        sa.column("family_id", uuid_type),
        sa.column("slug", sa.String),
        sa.column("label", sa.String),
        sa.column("target", sa.String),
        sa.column("position", sa.Integer),
        sa.column("enabled", sa.Boolean),
    )
    matrices = sa.table(
        "catalog_pricing_matrices",
        sa.column("id", uuid_type),
        sa.column("name", sa.String),
        sa.column("currency", sa.String),
        sa.column("tiers_json", sa.JSON),
    )
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
    )

    fam_textile = uuid.uuid4()
    fam_tasses = uuid.uuid4()
    fam_porteclefs = uuid.uuid4()
    fam_magnets = uuid.uuid4()
    fam_goodies = uuid.uuid4()

    op.bulk_insert(
        families,
        [
            {"id": fam_textile, "slug": "textile", "label": "Textile", "icon": "Shirt", "position": 0, "enabled": True},
            {"id": fam_tasses, "slug": "tasses", "label": "Tasses", "icon": "Coffee", "position": 1, "enabled": False},
            {"id": fam_porteclefs, "slug": "porte-cles", "label": "Porte-clés", "icon": "Key", "position": 2, "enabled": False},
            {"id": fam_magnets, "slug": "magnets", "label": "Magnets", "icon": "Magnet", "position": 3, "enabled": False},
            {"id": fam_goodies, "slug": "goodies", "label": "Goodies", "icon": "Gift", "position": 4, "enabled": False},
        ],
    )

    sf_eco_h = uuid.uuid4()
    sf_classic_h = uuid.uuid4()
    sf_premium_h = uuid.uuid4()
    sf_eco_f = uuid.uuid4()
    sf_classic_f = uuid.uuid4()
    sf_premium_f = uuid.uuid4()
    sf_eco_e = uuid.uuid4()
    sf_classic_e = uuid.uuid4()
    sf_premium_e = uuid.uuid4()

    op.bulk_insert(
        subfamilies,
        [
            {"id": sf_eco_h, "family_id": fam_textile, "slug": "tshirt-eco-homme", "label": "T-shirt Eco Homme", "target": "HOMME", "position": 0, "enabled": True},
            {"id": sf_classic_h, "family_id": fam_textile, "slug": "tshirt-classic-homme", "label": "T-shirt Classic Homme", "target": "HOMME", "position": 1, "enabled": True},
            {"id": sf_premium_h, "family_id": fam_textile, "slug": "tshirt-premium-homme", "label": "T-shirt Premium Homme", "target": "HOMME", "position": 2, "enabled": True},
            {"id": sf_eco_f, "family_id": fam_textile, "slug": "tshirt-eco-femme", "label": "T-shirt Eco Femme", "target": "FEMME", "position": 3, "enabled": False},
            {"id": sf_classic_f, "family_id": fam_textile, "slug": "tshirt-classic-femme", "label": "T-shirt Classic Femme", "target": "FEMME", "position": 4, "enabled": False},
            {"id": sf_premium_f, "family_id": fam_textile, "slug": "tshirt-premium-femme", "label": "T-shirt Premium Femme", "target": "FEMME", "position": 5, "enabled": False},
            {"id": sf_eco_e, "family_id": fam_textile, "slug": "tshirt-eco-enfant", "label": "T-shirt Eco Enfant", "target": "ENFANT", "position": 6, "enabled": False},
            {"id": sf_classic_e, "family_id": fam_textile, "slug": "tshirt-classic-enfant", "label": "T-shirt Classic Enfant", "target": "ENFANT", "position": 7, "enabled": False},
            {"id": sf_premium_e, "family_id": fam_textile, "slug": "tshirt-premium-enfant", "label": "T-shirt Premium Enfant", "target": "ENFANT", "position": 8, "enabled": False},
        ],
    )

    pm_eco = uuid.uuid4()
    pm_classic = uuid.uuid4()
    pm_premium = uuid.uuid4()

    op.bulk_insert(
        matrices,
        [
            {"id": pm_eco, "name": "Eco T-shirt", "currency": "EUR", "tiers_json": ECO_TIERS},
            {"id": pm_classic, "name": "Classic T-shirt", "currency": "EUR", "tiers_json": CLASSIC_TIERS},
            {"id": pm_premium, "name": "Premium NS300", "currency": "EUR", "tiers_json": PREMIUM_TIERS},
        ],
    )

    op.bulk_insert(
        products,
        [
            {
                "id": uuid.uuid4(),
                "subfamily_id": sf_eco_h,
                "reference": "CGTU01",
                "name": "T-shirt ECO",
                "description": "Coton bio 150g — coupe regular",
                "pricing_matrix_id": pm_eco,
                "position": 0,
                "enabled": True,
                "colors_json": ECO_COLORS,
                "sizes_json": SIZES_ADULT,
            },
            {
                "id": uuid.uuid4(),
                "subfamily_id": sf_classic_h,
                "reference": "K3025",
                "name": "T-shirt Classic",
                "description": "Jersey 180g — tenue irréprochable",
                "pricing_matrix_id": pm_classic,
                "position": 0,
                "enabled": True,
                "colors_json": CLASSIC_COLORS,
                "sizes_json": SIZES_ADULT,
            },
            {
                "id": uuid.uuid4(),
                "subfamily_id": sf_premium_h,
                "reference": "NS300",
                "name": "T-shirt Premium",
                "description": "Coton peigné 210g — rendu haut de gamme",
                "pricing_matrix_id": pm_premium,
                "position": 0,
                "enabled": True,
                "colors_json": PREMIUM_COLORS,
                "sizes_json": SIZES_ADULT,
            },
        ],
    )


def downgrade() -> None:
    op.drop_table("catalog_products")
    op.drop_table("catalog_pricing_matrices")
    op.drop_table("catalog_subfamilies")
    op.drop_table("catalog_families")
