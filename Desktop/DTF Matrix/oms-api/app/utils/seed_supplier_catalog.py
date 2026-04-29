"""Seed du catalogue fournisseur depuis `_manifest.csv`.

Lit le manifest produit par `reorganize_mokeup.py` et peuple les tables
`supplier_models` / `supplier_colors` / `supplier_mockups` de façon
idempotente : les lignes existantes sont mises à jour, les nouvelles
sont insérées.

Les champs descriptifs (name, brand, fit_type, etc.) ne sont pas dans
le manifest — ils restent `NULL` par défaut, à compléter ultérieurement
via l'admin ou un YAML de surcharge.
"""
from __future__ import annotations

import csv
import logging
from dataclasses import dataclass
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.supplier_catalog import (
    SupplierColor,
    SupplierMockup,
    SupplierModel,
)

logger = logging.getLogger(__name__)


# ─── Mappings français pour les couleurs (slug → label/hex) ────────
# Couvre les ~50 couleurs présentes dans le manifest. Les couleurs
# inconnues retombent sur un label "title-case" et hex=None.

COLOR_LABELS_FR: dict[str, str] = {
    "white": "Blanc",
    "black": "Noir",
    "navy": "Marine",
    "navy_blue": "Bleu Marine",
    "red": "Rouge",
    "royal_blue": "Bleu Royal",
    "oxford_grey": "Gris Oxford",
    "sky_blue": "Bleu Ciel",
    "fuchsia": "Fuchsia",
    "forest_green": "Vert Forêt",
    "chocolate": "Chocolat",
    "yellow": "Jaune",
    "orange": "Orange",
    "purple": "Violet",
    "lime": "Vert Lime",
    "kelly_green": "Vert Kelly",
    "wine": "Bordeaux",
    "dark_grey": "Gris Foncé",
    "ash_heather": "Cendre chiné",
    "light_sand": "Sable Clair",
    "tropical_blue": "Bleu Tropical",
    "light_royal_blue": "Bleu Royal Clair",
    "ice_mint": "Menthe Glacée",
    "soft_lilac": "Lilas Doux",
    "soft_pink": "Rose Doux",
    "pale_pink": "Rose Pâle",
    "vintage_blue": "Bleu Vintage",
    "vintage_blue_white": "Bleu Vintage / Blanc",
    "baltic_blue": "Bleu Baltique",
    "asphalt": "Asphalte",
    "dark_khaki": "Kaki Foncé",
    "urban_khaki": "Kaki Urbain",
    "burnt_brick": "Brique Brûlée",
    "raw_natural": "Naturel Brut",
    "wet_sand": "Sable Mouillé",
    "ivory": "Ivoire",
    "iron_grey": "Gris Fer",
    "organic_khaki": "Kaki Bio",
    "sage": "Sauge",
    "terracotta_red": "Terracotta",
    "deep_purple": "Violet Profond",
    "green_marble_heather": "Vert Marbré chiné",
    "sea_turquoise": "Turquoise",
    "cloudy_blue_heather": "Bleu Nuageux chiné",
    "coconut_milk": "Lait de Coco",
    "wine_heather": "Bordeaux chiné",
    "light_orange": "Orange Clair",
}

COLOR_HEX: dict[str, str] = {
    "white": "#ffffff",
    "black": "#1a1a1a",
    "navy": "#1b2a4e",
    "navy_blue": "#1b2a4e",
    "red": "#c0392b",
    "royal_blue": "#1e3a8a",
    "oxford_grey": "#4b5563",
    "sky_blue": "#87ceeb",
    "fuchsia": "#d63384",
    "forest_green": "#2f5233",
    "chocolate": "#5b3a1d",
    "yellow": "#fbbf24",
    "orange": "#f97316",
    "purple": "#7c3aed",
    "lime": "#a3e635",
    "kelly_green": "#16a34a",
    "wine": "#7f1d1d",
    "dark_grey": "#374151",
    "ash_heather": "#c0c4c9",
    "light_sand": "#e8d4b0",
    "tropical_blue": "#0ea5e9",
    "light_royal_blue": "#3b82f6",
    "ice_mint": "#b8e0d2",
    "soft_lilac": "#d8bfd8",
    "soft_pink": "#ffd1dc",
    "pale_pink": "#fce7e9",
    "vintage_blue": "#6b8caf",
    "vintage_blue_white": "#8fa9c4",
    "baltic_blue": "#4a6b8a",
    "asphalt": "#3c3c3c",
    "dark_khaki": "#6b6432",
    "urban_khaki": "#8b7355",
    "burnt_brick": "#8b3a3a",
    "raw_natural": "#e8dcc4",
    "wet_sand": "#b8a890",
    "ivory": "#fffff0",
    "iron_grey": "#4a4a4a",
    "organic_khaki": "#7b7d2f",
    "sage": "#87a96b",
    "terracotta_red": "#c2410c",
    "deep_purple": "#4c1d95",
    "green_marble_heather": "#4d7355",
    "sea_turquoise": "#0d9488",
    "cloudy_blue_heather": "#94a3b8",
    "coconut_milk": "#f8e8d0",
    "wine_heather": "#6b2a2a",
    "light_orange": "#ffb86c",
}


def _color_label(slug: str) -> str:
    if slug in COLOR_LABELS_FR:
        return COLOR_LABELS_FR[slug]
    return slug.replace("_", " ").title()


@dataclass
class SeedStats:
    models_created: int = 0
    models_updated: int = 0
    colors_created: int = 0
    colors_updated: int = 0
    mockups_created: int = 0
    mockups_updated: int = 0
    rows_skipped: int = 0


@dataclass
class _ModelKey:
    ref_internal: str
    ref_supplier: str
    ref_label: str
    category: str


def _read_manifest(manifest_path: Path) -> list[dict]:
    rows: list[dict] = []
    with manifest_path.open("r", encoding="utf-8", newline="") as f:
        reader = csv.DictReader(f)
        for row in reader:
            rows.append(row)
    return rows


async def seed_supplier_catalog(
    session: AsyncSession, manifest_path: Path
) -> SeedStats:
    """Peuple les tables fournisseur depuis le manifest CSV.

    Le manifest a les colonnes :
    `category, ref_internal, ref_supplier, ref_label, color, view, ext, src, dst`
    où `dst` est le chemin relatif depuis la racine du dossier mockups
    (ex. `HOMME/H-013_K357/red/H-013_K357_front.png`).
    """
    if not manifest_path.exists():
        raise FileNotFoundError(f"Manifest introuvable : {manifest_path}")

    rows = _read_manifest(manifest_path)
    logger.info("seed_supplier_catalog: %d lignes à traiter", len(rows))

    stats = SeedStats()

    # ─── Étape 1 : modèles (1 ligne par ref_internal) ──────────────
    model_keys: dict[str, _ModelKey] = {}
    for row in rows:
        ri = row["ref_internal"]
        if ri not in model_keys:
            model_keys[ri] = _ModelKey(
                ref_internal=ri,
                ref_supplier=row["ref_supplier"],
                ref_label=row["ref_label"],
                category=row["category"],
            )

    existing_models_q = await session.execute(select(SupplierModel))
    existing_models: dict[str, SupplierModel] = {
        m.ref_internal: m for m in existing_models_q.scalars().all()
    }

    for ri, mk in model_keys.items():
        if ri in existing_models:
            m = existing_models[ri]
            changed = False
            if m.ref_supplier != mk.ref_supplier:
                m.ref_supplier = mk.ref_supplier
                changed = True
            if m.ref_label != mk.ref_label:
                m.ref_label = mk.ref_label
                changed = True
            if m.category != mk.category:
                m.category = mk.category
                changed = True
            if changed:
                stats.models_updated += 1
        else:
            m = SupplierModel(
                ref_internal=mk.ref_internal,
                ref_supplier=mk.ref_supplier,
                ref_label=mk.ref_label,
                category=mk.category,
                position=0,
                enabled=True,
            )
            session.add(m)
            existing_models[ri] = m
            stats.models_created += 1
    await session.flush()

    # ─── Étape 2 : couleurs ────────────────────────────────────────
    # On collecte les paires (ref_internal, color_slug) uniques.
    color_keys: dict[tuple[str, str], None] = {}
    for row in rows:
        color_keys[(row["ref_internal"], row["color"])] = None

    existing_colors_q = await session.execute(select(SupplierColor))
    existing_colors: dict[tuple[str, str], SupplierColor] = {}
    # On indexe par (model.ref_internal, color.slug) — d'où le besoin
    # d'avoir le model en mémoire (chargé ci-dessus).
    model_id_to_ref = {m.id: m.ref_internal for m in existing_models.values()}
    for c in existing_colors_q.scalars().all():
        ref = model_id_to_ref.get(c.supplier_model_id)
        if ref:
            existing_colors[(ref, c.slug)] = c

    color_position_counter: dict[str, int] = {}
    for ri, slug in color_keys.keys():
        key = (ri, slug)
        position = color_position_counter.get(ri, 0)
        color_position_counter[ri] = position + 1

        label = _color_label(slug)
        hex_value = COLOR_HEX.get(slug)

        if key in existing_colors:
            c = existing_colors[key]
            changed = False
            if c.label != label:
                c.label = label
                changed = True
            if hex_value and c.hex != hex_value:
                c.hex = hex_value
                changed = True
            if changed:
                stats.colors_updated += 1
        else:
            model = existing_models[ri]
            c = SupplierColor(
                supplier_model_id=model.id,
                slug=slug,
                label=label,
                hex=hex_value,
                position=position,
                enabled=True,
            )
            session.add(c)
            existing_colors[key] = c
            stats.colors_created += 1
    await session.flush()

    # ─── Étape 3 : mockups (un par triplet ref/color/view) ─────────
    # On indexe les existants par (color.id, view).
    color_id_to_key = {c.id: k for k, c in existing_colors.items()}
    existing_mockups_q = await session.execute(select(SupplierMockup))
    existing_mockups: dict[tuple[tuple[str, str], str], SupplierMockup] = {}
    for mk in existing_mockups_q.scalars().all():
        key_ck = color_id_to_key.get(mk.supplier_color_id)
        if key_ck:
            existing_mockups[(key_ck, mk.view)] = mk

    for row in rows:
        ri = row["ref_internal"]
        slug = row["color"]
        view = row["view"]
        ext = row["ext"]
        file_path = row["dst"]
        is_lifestyle = "lifestyle" in view

        color_key = (ri, slug)
        color = existing_colors.get(color_key)
        if not color:
            stats.rows_skipped += 1
            logger.warning(
                "seed: couleur manquante %s/%s (ligne ignorée)", ri, slug
            )
            continue

        mk_key = (color_key, view)
        if mk_key in existing_mockups:
            existing = existing_mockups[mk_key]
            if existing.file_path != file_path or existing.ext != ext:
                existing.file_path = file_path
                existing.ext = ext
                existing.is_lifestyle = is_lifestyle
                stats.mockups_updated += 1
        else:
            m = SupplierMockup(
                supplier_color_id=color.id,
                view=view,
                file_path=file_path,
                ext=ext,
                is_lifestyle=is_lifestyle,
            )
            session.add(m)
            existing_mockups[mk_key] = m
            stats.mockups_created += 1

    await session.commit()
    logger.info(
        "seed_supplier_catalog: terminé — %d modèles, %d couleurs, %d mockups",
        stats.models_created + stats.models_updated,
        stats.colors_created + stats.colors_updated,
        stats.mockups_created + stats.mockups_updated,
    )
    return stats
