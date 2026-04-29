"""pricing 2026: PA + grille 6 emplacements + params globaux + wipe orders

Revision ID: 0021
Revises: 0020
Create Date: 2026-04-28

- Wipe complet des commandes existantes (commandes de test).
- Ajout colonnes Product : purchase_price_ht, sleeve_type, neck_type.
- Ajout colonne Client : tgca_default.
- Création table parametres_globaux (singleton id=1).
- Création matrice tarifaire "Textile 2026" (grille §2.2 — coef + 6 emplacements).
- Renseignement PA + sleeve/neck pour les 19 modèles du tarif 2026.
"""
import json
import uuid
from typing import Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "0021"
down_revision: Union[str, None] = "0020"
branch_labels = None
depends_on = None


# ── Grille Textile 2026 ─────────────────────────────────────────────────
# Source : prompt §2.2. Format: minQty + coef + 6 prix d'emplacement.
TEXTILE_2026_TIERS = [
    {"minQty": 1,   "coef": 3.80, "coeur": 9.50, "poitrine": 10.93, "avantPlein": 16.20, "arrierePlein": 16.20, "mancheG": 9.50, "mancheD": 9.50},
    {"minQty": 5,   "coef": 2.09, "coeur": 6.37, "poitrine": 7.33,  "avantPlein": 12.10, "arrierePlein": 12.10, "mancheG": 6.37, "mancheD": 6.37},
    {"minQty": 10,  "coef": 1.91, "coeur": 5.10, "poitrine": 5.86,  "avantPlein": 10.80, "arrierePlein": 10.80, "mancheG": 5.10, "mancheD": 5.10},
    {"minQty": 20,  "coef": 1.82, "coeur": 4.47, "poitrine": 5.14,  "avantPlein":  9.45, "arrierePlein":  9.45, "mancheG": 4.47, "mancheD": 4.47},
    {"minQty": 30,  "coef": 1.73, "coeur": 4.07, "poitrine": 4.69,  "avantPlein":  8.10, "arrierePlein":  8.10, "mancheG": 4.07, "mancheD": 4.07},
    {"minQty": 40,  "coef": 1.64, "coeur": 3.82, "poitrine": 4.40,  "avantPlein":  7.60, "arrierePlein":  7.60, "mancheG": 3.82, "mancheD": 3.82},
    {"minQty": 50,  "coef": 1.55, "coeur": 3.57, "poitrine": 4.11,  "avantPlein":  7.30, "arrierePlein":  7.30, "mancheG": 3.57, "mancheD": 3.57},
    {"minQty": 60,  "coef": 1.50, "coeur": 3.44, "poitrine": 3.96,  "avantPlein":  7.00, "arrierePlein":  7.00, "mancheG": 3.44, "mancheD": 3.44},
    {"minQty": 70,  "coef": 1.46, "coeur": 3.32, "poitrine": 3.82,  "avantPlein":  6.80, "arrierePlein":  6.80, "mancheG": 3.32, "mancheD": 3.32},
    {"minQty": 80,  "coef": 1.37, "coeur": 3.19, "poitrine": 3.67,  "avantPlein":  6.50, "arrierePlein":  6.50, "mancheG": 3.19, "mancheD": 3.19},
    {"minQty": 90,  "coef": 1.32, "coeur": 3.05, "poitrine": 3.51,  "avantPlein":  6.20, "arrierePlein":  6.20, "mancheG": 3.05, "mancheD": 3.05},
    {"minQty": 100, "coef": 1.27, "coeur": 2.93, "poitrine": 3.36,  "avantPlein":  5.90, "arrierePlein":  5.90, "mancheG": 2.93, "mancheD": 2.93},
    {"minQty": 150, "coef": 1.27, "coeur": 2.80, "poitrine": 3.22,  "avantPlein":  5.70, "arrierePlein":  5.70, "mancheG": 2.80, "mancheD": 2.80},
]


# ── Tarif 2026 — modèles existants (mis à jour PA + sleeve/neck) ────────
# (ref_interne, name_label_2026, prix_achat_ht, sleeve_type, neck_type)
EXISTING_PRODUCTS_2026 = [
    ("H-001", "T-shirt Léger",                    4.05, "courte",      "rond"),
    ("H-002", "T-shirt Classique",                4.87, "courte",      "rond"),
    ("H-003", "T-shirt Oversize Premium",         7.01, "courte",      "rond"),
    ("H-004", "T-shirt Sweet",                   10.95, "courte",      "rond"),
    ("H-005", "T-shirt Tye Dye",                  7.01, "courte",      "rond"),
    ("H-008", "T-shirt Manches Longues",          4.99, "longue",      "rond"),
    ("H-009", "T-shirt Manches Longues",          3.86, "longue",      "rond"),
    ("H-011", "T-shirt Sans Manches",             2.46, "sans_manche", "rond"),
    ("H-012", "T-shirt Léger Col V",              3.45, "courte",      "v"),
    ("H-013", "T-shirt Classique Col V",          4.42, "courte",      "v"),
    ("H-014", "T-shirt Léger Pro",                2.81, "courte",      "rond"),
    ("H-016", "T-shirt Sport",                    2.66, "courte",      "rond"),
    ("H-018", "T-shirt Classique Pro",            3.58, "courte",      "rond"),
    ("H-019", "T-shirt Léger Éco",                2.09, "courte",      "rond"),
    ("H-021", "T-shirt Oversize 180",             5.50, "courte",      "rond"),
]

# ── Tarif 2026 — modèles à créer (n'existent pas encore en base) ────────
# (ref_interne, ref_supplier, name_label_2026, prix_achat_ht, sleeve_type, neck_type, position)
NEW_PRODUCTS_2026 = [
    ("H-022", "K3008",   "T-shirt Oversize",          5.50, "courte",      "rond", 22),
    ("T-001", "PA479",   "T-shirt Sans Manches",      3.75, "sans_manche", "rond", 23),
    ("N-001", "NS333",   "T-shirt Manches Longues",   8.61, "longue",      "rond", 24),
    ("N-002", "NS347",   "T-shirt Manches Longues",   5.92, "longue",      "rond", 25),
]

SIZES_STANDARD = [
    {"id": "XS",  "label": "XS",  "order": 0},
    {"id": "S",   "label": "S",   "order": 1},
    {"id": "M",   "label": "M",   "order": 2},
    {"id": "L",   "label": "L",   "order": 3},
    {"id": "XL",  "label": "XL",  "order": 4},
    {"id": "2XL", "label": "2XL", "order": 5},
    {"id": "3XL", "label": "3XL", "order": 6},
]


def _is_postgres(bind) -> bool:
    return bind.dialect.name == "postgresql"


def _row_id_to_uuid(raw) -> uuid.UUID:
    if isinstance(raw, uuid.UUID):
        return raw
    if isinstance(raw, str):
        return uuid.UUID(hex=raw.replace("-", ""))
    if isinstance(raw, bytes):
        return uuid.UUID(bytes=raw)
    return uuid.UUID(str(raw))


def upgrade() -> None:
    bind = op.get_bind()
    is_pg = _is_postgres(bind)
    uuid_type = postgresql.UUID(as_uuid=True) if is_pg else sa.Uuid()

    # ── 1. Wipe commandes existantes (commandes de test) ────────────────
    # Garde-fou : la migration n'efface les commandes que si l'environnement
    # est explicitement marqué comme jetable. Sur prod (et tout environnement
    # sans OMS_ALLOW_DESTRUCTIVE_MIGRATIONS=1), on saute le wipe — l'admin doit
    # nettoyer manuellement, ce qui est intentionnel : 0021 a été écrite
    # pendant un sprint où l'unique base contenait des commandes de test.
    import os
    allow_destructive = os.environ.get(
        "OMS_ALLOW_DESTRUCTIVE_MIGRATIONS", ""
    ).lower() in {"1", "true", "yes"}

    if allow_destructive:
        op.execute(sa.text("DELETE FROM order_line_artworks"))
        op.execute(sa.text("DELETE FROM order_line_variants"))
        op.execute(sa.text("DELETE FROM order_lines"))
        op.execute(sa.text("DELETE FROM bats"))
        op.execute(sa.text("DELETE FROM orders"))
    else:
        # Vérifier qu'il n'y a pas de commande à perdre. Si la base contient
        # des données métier, exiger l'opt-in explicite.
        result = bind.execute(sa.text("SELECT COUNT(*) FROM orders")).scalar()
        if result and int(result) > 0:
            raise RuntimeError(
                "Migration 0021 voudrait DELETE FROM orders mais la table "
                f"contient {result} ligne(s). Définir "
                "OMS_ALLOW_DESTRUCTIVE_MIGRATIONS=1 pour confirmer la perte "
                "ou nettoyer manuellement avant `alembic upgrade head`."
            )

    # ── 2. Colonnes Product (PA + sleeve_type + neck_type) ──────────────
    with op.batch_alter_table("catalog_products") as batch:
        batch.add_column(sa.Column("purchase_price_ht", sa.Numeric(8, 2), nullable=True))
        batch.add_column(sa.Column("sleeve_type", sa.String(20), nullable=True))
        batch.add_column(sa.Column("neck_type", sa.String(20), nullable=True))

    # ── 3. Colonne Client (tgca_default) ────────────────────────────────
    with op.batch_alter_table("clients") as batch:
        batch.add_column(
            sa.Column("tgca_default", sa.Boolean(), nullable=False, server_default=sa.false())
        )

    # ── 4. Table parametres_globaux (singleton id=1) ────────────────────
    op.create_table(
        "parametres_globaux",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("transport_ttc", sa.Numeric(8, 2), nullable=False, server_default=sa.text("1.56")),
        sa.Column("taux_tgca", sa.Numeric(5, 4), nullable=False, server_default=sa.text("0.04")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            onupdate=sa.func.now(),
        ),
    )
    op.execute(
        sa.text("INSERT INTO parametres_globaux (id, transport_ttc, taux_tgca) VALUES (1, 1.56, 0.04)")
    )

    # ── 5. Matrice "Textile 2026" ───────────────────────────────────────
    pm_2026 = uuid.uuid4()
    matrices = sa.table(
        "catalog_pricing_matrices",
        sa.column("id", uuid_type),
        sa.column("name", sa.String),
        sa.column("currency", sa.String),
        sa.column("tiers_json", sa.JSON),
    )
    op.bulk_insert(
        matrices,
        [
            {
                "id": pm_2026,
                "name": "Textile 2026",
                "currency": "EUR",
                "tiers_json": TEXTILE_2026_TIERS,
            }
        ],
    )
    pm_2026_hex = pm_2026.hex

    # ── 6. Mise à jour des 15 modèles existants ─────────────────────────
    for ref, name, pa, sleeve, neck in EXISTING_PRODUCTS_2026:
        op.execute(
            sa.text(
                "UPDATE catalog_products SET "
                "purchase_price_ht = :pa, "
                "sleeve_type = :sl, "
                "neck_type = :n, "
                "name = :name, "
                f"pricing_matrix_id = '{pm_2026_hex}' "
                "WHERE reference = :ref"
            ).bindparams(pa=pa, sl=sleeve, n=neck, name=name, ref=ref)
        )

    # ── 7. Création des 4 nouveaux modèles ──────────────────────────────
    sf_homme_row = bind.execute(
        sa.text("SELECT id FROM catalog_subfamilies WHERE slug = 'tshirt-homme'")
    ).fetchone()
    if sf_homme_row is None:
        return  # rien à faire si la sous-famille n'existe pas
    sf_homme_id = _row_id_to_uuid(sf_homme_row[0])

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
        sa.column("purchase_price_ht", sa.Numeric(8, 2)),
        sa.column("sleeve_type", sa.String),
        sa.column("neck_type", sa.String),
    )

    rows = []
    for ref, sup_ref, name, pa, sleeve, neck, pos in NEW_PRODUCTS_2026:
        # On stocke ref_supplier dans description pour cohérence avec migration 0017
        # (qui a renommé name → ref_supplier seul). On garde sup_ref dans description
        # pour traçabilité fournisseur, et name = libellé commercial 2026.
        rows.append(
            {
                "id": uuid.uuid4(),
                "subfamily_id": sf_homme_id,
                "reference": ref,
                "name": name,
                "description": f"Réf fournisseur : {sup_ref}",
                "pricing_matrix_id": pm_2026,
                "position": pos,
                "enabled": True,
                "colors_json": [],
                "sizes_json": SIZES_STANDARD,
                "print_techniques_json": [],
                "purchase_price_ht": pa,
                "sleeve_type": sleeve,
                "neck_type": neck,
            }
        )
    op.bulk_insert(products, rows)


def downgrade() -> None:
    # Supprime les 4 produits ajoutés
    op.execute(
        sa.text(
            "DELETE FROM catalog_products WHERE reference IN ('H-022','T-001','N-001','N-002')"
        )
    )
    # Détache les produits de la matrice 2026 (les laisse sans matrice — admin retriera)
    op.execute(
        sa.text(
            "UPDATE catalog_products SET pricing_matrix_id = NULL "
            "WHERE pricing_matrix_id = (SELECT id FROM catalog_pricing_matrices WHERE name = 'Textile 2026')"
        )
    )
    op.execute(sa.text("DELETE FROM catalog_pricing_matrices WHERE name = 'Textile 2026'"))

    op.drop_table("parametres_globaux")

    with op.batch_alter_table("clients") as batch:
        batch.drop_column("tgca_default")

    with op.batch_alter_table("catalog_products") as batch:
        batch.drop_column("neck_type")
        batch.drop_column("sleeve_type")
        batch.drop_column("purchase_price_ht")
