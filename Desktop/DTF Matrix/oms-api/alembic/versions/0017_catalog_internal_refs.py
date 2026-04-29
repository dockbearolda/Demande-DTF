"""catalog: use internal refs (H-001…) and label subfamilies by gender

Revision ID: 0017
Revises: 0016
Create Date: 2026-04-27

- Product references → internal refs (H-002, F-001, E-001, B-001…)
- Product names → supplier ref only (NS305, NS342…) — serves as designation
- Subfamily labels → Homme / Femme / Enfant / Bébé (concise)
"""
from typing import Union
from alembic import op
import sqlalchemy as sa

revision: str = "0017"
down_revision: Union[str, None] = "0016"
branch_labels = None
depends_on = None

# supplier_ref → (internal_ref, name_label)
HOMME_MAP = {
    "NS305":        ("H-002", "NS305"),
    "NS332":        ("H-003", "NS332"),
    "NS308":        ("H-004", "NS308"),
    "NS345":        ("H-005", "NS345"),
    "BY190":        ("H-006", "BY190"),
    "BY189":        ("H-007", "BY189"),
    "NS336":        ("H-008", "NS336"),
    "CGTU05TC":     ("H-009", "CGTU05TC"),
    "CGTM072":      ("H-010", "CGTM072"),
    "K3022IC":      ("H-011", "K3022IC"),
    "CGTM044":      ("H-012", "CGTM044"),
    "K357":         ("H-013", "K357"),
    "K3025IC":      ("H-014", "K3025IC"),
    "RUZT180":      ("H-015", "RUZT180"),
    "PA438":        ("H-016", "PA438"),
    "WK302":        ("H-017", "WK302"),
    "K3032IC":      ("H-018", "K3032IC"),
    "CGTU01T":      ("H-019", "CGTU01T"),
    "K3028IC":      ("H-020", "K3028IC"),
    "NS352":        ("H-021", "NS352"),
    "LYCRA-PARAGON":("L-001", "Lycra Paragon"),
}

FEMME_MAP = {
    "NS342": ("F-001", "NS342"),
    "NS324": ("F-003", "NS324"),
    "NS313": ("F-004", "NS313"),
    "NS334": ("F-006", "NS334"),
}

ENFANT_MAP = {
    "NS307":   ("E-001", "NS307"),
    "NS340":   ("E-002", "NS340"),
    "K3027IC": ("E-003", "K3027IC"),
}

BEBE_MAP = {
    "K831": ("B-001", "K831"),
    "K837": ("B-002", "K837"),
}


def upgrade() -> None:
    all_maps = {**HOMME_MAP, **FEMME_MAP, **ENFANT_MAP, **BEBE_MAP}
    for supplier_ref, (internal_ref, name) in all_maps.items():
        op.execute(
            sa.text(
                "UPDATE catalog_products SET reference = :ref, name = :name "
                "WHERE reference = :old_ref"
            ).bindparams(ref=internal_ref, name=name, old_ref=supplier_ref)
        )

    # Concise subfamily labels
    for slug, label in [
        ("tshirt-homme",  "Homme"),
        ("tshirt-femme",  "Femme"),
        ("tshirt-enfant", "Enfant"),
        ("tshirt-bebe",   "Bébé"),
    ]:
        op.execute(
            sa.text("UPDATE catalog_subfamilies SET label = :label WHERE slug = :slug")
            .bindparams(label=label, slug=slug)
        )


def downgrade() -> None:
    all_maps = {**HOMME_MAP, **FEMME_MAP, **ENFANT_MAP, **BEBE_MAP}
    for supplier_ref, (internal_ref, name) in all_maps.items():
        op.execute(
            sa.text(
                "UPDATE catalog_products SET reference = :old_ref, name = :name "
                "WHERE reference = :ref"
            ).bindparams(old_ref=supplier_ref, name=f"T-shirt {supplier_ref}", ref=internal_ref)
        )
    for slug, label in [
        ("tshirt-homme",  "T-shirt Homme"),
        ("tshirt-femme",  "T-shirt Femme"),
        ("tshirt-enfant", "T-shirt Enfant"),
        ("tshirt-bebe",   "T-shirt Bébé"),
    ]:
        op.execute(
            sa.text("UPDATE catalog_subfamilies SET label = :label WHERE slug = :slug")
            .bindparams(label=label, slug=slug)
        )
