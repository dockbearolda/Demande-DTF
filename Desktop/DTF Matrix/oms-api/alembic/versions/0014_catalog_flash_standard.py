"""catalog: add all catalogue refs with standard flash pricing

Revision ID: 0014
Revises: 0013
Create Date: 2026-04-27

Adds a single "T-shirt Standard Flash" pricing matrix with round degressive prices
(30 € shirt / 5 € front / 10 € back at qty 1, stepwise per 10 units), reassigns all
existing catalog products to this matrix, and populates the catalog with every
reference found in the supplier manifest (Homme, Femme, Enfant, Bébé).

Prices are PROVISIONAL — final pricing will be set later.
"""
import json
import uuid
from typing import Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "0014"
down_revision: Union[str, None] = "0013"
branch_labels = None
depends_on = None


# ── Grille tarifaire standard (prix provisoires, ronds, dégressifs par palier de 10) ──
# vierge = tshirt seul | coeur = personnalisation avant | dos = personnalisation dos
STANDARD_TIERS = [
    {"minQty": 1,   "vierge": 30, "coeur": 5, "dos": 10},
    {"minQty": 10,  "vierge": 27, "coeur": 5, "dos": 10},
    {"minQty": 20,  "vierge": 25, "coeur": 4, "dos": 9},
    {"minQty": 30,  "vierge": 24, "coeur": 4, "dos": 8},
    {"minQty": 40,  "vierge": 23, "coeur": 4, "dos": 8},
    {"minQty": 50,  "vierge": 22, "coeur": 4, "dos": 7},
    {"minQty": 60,  "vierge": 21, "coeur": 3, "dos": 7},
    {"minQty": 70,  "vierge": 20, "coeur": 3, "dos": 6},
    {"minQty": 80,  "vierge": 19, "coeur": 3, "dos": 6},
    {"minQty": 90,  "vierge": 18, "coeur": 3, "dos": 5},
    {"minQty": 100, "vierge": 17, "coeur": 3, "dos": 5},
]

SIZES_ADULT = [
    {"id": "XS",  "label": "XS",  "order": 0},
    {"id": "S",   "label": "S",   "order": 1},
    {"id": "M",   "label": "M",   "order": 2},
    {"id": "L",   "label": "L",   "order": 3},
    {"id": "XL",  "label": "XL",  "order": 4},
    {"id": "XXL", "label": "XXL", "order": 5},
    {"id": "3XL", "label": "3XL", "order": 6},
]

SIZES_KID = [
    {"id": "2A",  "label": "2 ans",  "order": 0},
    {"id": "4A",  "label": "4 ans",  "order": 1},
    {"id": "6A",  "label": "6 ans",  "order": 2},
    {"id": "8A",  "label": "8 ans",  "order": 3},
    {"id": "10A", "label": "10 ans", "order": 4},
    {"id": "12A", "label": "12 ans", "order": 5},
    {"id": "14A", "label": "14 ans", "order": 6},
]

SIZES_BABY = [
    {"id": "3M",  "label": "3 mois",  "order": 0},
    {"id": "6M",  "label": "6 mois",  "order": 1},
    {"id": "12M", "label": "12 mois", "order": 2},
    {"id": "18M", "label": "18 mois", "order": 3},
    {"id": "24M", "label": "24 mois", "order": 4},
]

# ── Références Homme (manifest) — NS300 skipped, already seeded in 0007 ──
HOMME_PRODUCTS = [
    {"ref": "NS305",        "name": "T-shirt NS305",        "pos": 0},
    {"ref": "NS332",        "name": "T-shirt NS332",        "pos": 1},
    {"ref": "NS308",        "name": "T-shirt NS308",        "pos": 2},
    {"ref": "NS345",        "name": "T-shirt NS345",        "pos": 3},
    {"ref": "BY190",        "name": "T-shirt BY190",        "pos": 4},
    {"ref": "BY189",        "name": "T-shirt BY189",        "pos": 5},
    {"ref": "NS336",        "name": "T-shirt NS336",        "pos": 6},
    {"ref": "CGTU05TC",     "name": "T-shirt CGTU05TC",     "pos": 7},
    {"ref": "CGTM072",      "name": "T-shirt CGTM072",      "pos": 8},
    {"ref": "K3022IC",      "name": "T-shirt K3022IC",      "pos": 9},
    {"ref": "CGTM044",      "name": "T-shirt CGTM044",      "pos": 10},
    {"ref": "K357",         "name": "T-shirt K357",         "pos": 11},
    {"ref": "K3025IC",      "name": "T-shirt K3025IC",      "pos": 12},
    {"ref": "RUZT180",      "name": "T-shirt RUZT180",      "pos": 13},
    {"ref": "PA438",        "name": "T-shirt PA438",        "pos": 14},
    {"ref": "WK302",        "name": "T-shirt WK302",        "pos": 15},
    {"ref": "K3032IC",      "name": "T-shirt K3032IC",      "pos": 16},
    {"ref": "CGTU01T",      "name": "T-shirt CGTU01T",      "pos": 17},
    {"ref": "K3028IC",      "name": "T-shirt K3028IC",      "pos": 18},
    {"ref": "NS352",        "name": "T-shirt NS352",        "pos": 19},
    {"ref": "LYCRA-PARAGON","name": "Lycra Paragon",        "pos": 20},
]

FEMME_PRODUCTS = [
    {"ref": "NS342", "name": "T-shirt NS342", "pos": 0},
    {"ref": "NS324", "name": "T-shirt NS324", "pos": 1},
    {"ref": "NS313", "name": "T-shirt NS313", "pos": 2},
    {"ref": "NS334", "name": "T-shirt NS334", "pos": 3},
]

ENFANT_PRODUCTS = [
    {"ref": "NS307",   "name": "T-shirt NS307",   "pos": 0},
    {"ref": "NS340",   "name": "T-shirt NS340",   "pos": 1},
    {"ref": "K3027IC", "name": "T-shirt K3027IC", "pos": 2},
]

BEBE_PRODUCTS = [
    {"ref": "K831", "name": "T-shirt K831", "pos": 0},
    {"ref": "K837", "name": "T-shirt K837", "pos": 1},
]


def _is_postgres(bind) -> bool:
    return bind.dialect.name == "postgresql"


def _uuid_to_db(u: uuid.UUID, is_pg: bool):
    """Return UUID in the format expected by bulk_insert for this dialect."""
    return u if is_pg else u


def _row_id_to_uuid(raw, is_pg: bool) -> uuid.UUID:
    """Convert a SELECT result ID to a uuid.UUID, regardless of dialect storage format."""
    if isinstance(raw, uuid.UUID):
        return raw
    if isinstance(raw, str):
        # SQLite stores as CHAR(32) hex without dashes
        raw_clean = raw.replace("-", "")
        return uuid.UUID(hex=raw_clean)
    if isinstance(raw, bytes):
        return uuid.UUID(bytes=raw)
    return uuid.UUID(str(raw))


def upgrade() -> None:
    bind = op.get_bind()
    is_pg = _is_postgres(bind)
    uuid_type = postgresql.UUID(as_uuid=True) if is_pg else sa.Uuid()

    # ── 1. Nouvelle grille tarifaire standard ──────────────────────────────────
    pm_standard = uuid.uuid4()

    matrices = sa.table(
        "catalog_pricing_matrices",
        sa.column("id", uuid_type),
        sa.column("name", sa.String),
        sa.column("currency", sa.String),
        sa.column("tiers_json", sa.JSON),
    )
    op.bulk_insert(
        matrices,
        [{"id": pm_standard, "name": "T-shirt Standard Flash", "currency": "EUR", "tiers_json": STANDARD_TIERS}],
    )

    # ── 2. Réassigner les produits existants à la nouvelle grille (si catalogue peuplé) ──
    # Embed UUID directly in SQL to avoid dialect-specific bind parameter conversion
    pm_hex = pm_standard.hex  # 32-char, no dashes — accepted by both SQLite and PostgreSQL
    op.execute(sa.text(f"UPDATE catalog_products SET pricing_matrix_id = '{pm_hex}'"))

    # ── 3. Récupérer ou créer la famille Textile ───────────────────────────────
    result = bind.execute(sa.text("SELECT id FROM catalog_families WHERE slug = 'textile'"))
    row = result.fetchone()

    families = sa.table(
        "catalog_families",
        sa.column("id", uuid_type),
        sa.column("slug", sa.String),
        sa.column("label", sa.String),
        sa.column("icon", sa.String),
        sa.column("position", sa.Integer),
        sa.column("enabled", sa.Boolean),
    )

    if row is None:
        fam_textile = uuid.uuid4()
        op.bulk_insert(
            families,
            [{"id": fam_textile, "slug": "textile", "label": "Textile", "icon": "Shirt", "position": 0, "enabled": True}],
        )
    else:
        fam_textile = _row_id_to_uuid(row[0], is_pg)

    # ── 4. Nouvelles sous-familles ─────────────────────────────────────────────
    sf_homme   = uuid.uuid4()
    sf_femme   = uuid.uuid4()
    sf_enfant  = uuid.uuid4()
    sf_bebe    = uuid.uuid4()

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
    op.bulk_insert(
        subfamilies,
        [
            {"id": sf_homme,  "family_id": fam_textile, "slug": "tshirt-homme",  "label": "T-shirt Homme",  "target": "HOMME",  "position": 10, "enabled": True},
            {"id": sf_femme,  "family_id": fam_textile, "slug": "tshirt-femme",  "label": "T-shirt Femme",  "target": "FEMME",  "position": 11, "enabled": True},
            {"id": sf_enfant, "family_id": fam_textile, "slug": "tshirt-enfant", "label": "T-shirt Enfant", "target": "ENFANT", "position": 12, "enabled": True},
            {"id": sf_bebe,   "family_id": fam_textile, "slug": "tshirt-bebe",   "label": "T-shirt Bébé",   "target": "BEBE",   "position": 13, "enabled": True},
        ],
    )

    # ── 5. Produits ────────────────────────────────────────────────────────────
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

    def _rows(sf_id, items, sizes):
        return [
            {
                "id": uuid.uuid4(),
                "subfamily_id": sf_id,
                "reference": p["ref"],
                "name": p["name"],
                "description": None,
                "pricing_matrix_id": pm_standard,
                "position": p["pos"],
                "enabled": True,
                "colors_json": [],
                "sizes_json": sizes,
                "print_techniques_json": [],
            }
            for p in items
        ]

    op.bulk_insert(products, _rows(sf_homme,  HOMME_PRODUCTS,  SIZES_ADULT))
    op.bulk_insert(products, _rows(sf_femme,  FEMME_PRODUCTS,  SIZES_ADULT))
    op.bulk_insert(products, _rows(sf_enfant, ENFANT_PRODUCTS, SIZES_KID))
    op.bulk_insert(products, _rows(sf_bebe,   BEBE_PRODUCTS,   SIZES_BABY))


def downgrade() -> None:
    op.execute(sa.text(
        "DELETE FROM catalog_subfamilies WHERE slug IN "
        "('tshirt-homme','tshirt-femme','tshirt-enfant','tshirt-bebe')"
    ))
    op.execute(sa.text(
        "DELETE FROM catalog_pricing_matrices WHERE name = 'T-shirt Standard Flash'"
    ))
    # Optionnellement supprimer la famille textile si elle a été créée par ce migration
    # (on ne le fait pas pour éviter de supprimer les sous-familles 0007)
