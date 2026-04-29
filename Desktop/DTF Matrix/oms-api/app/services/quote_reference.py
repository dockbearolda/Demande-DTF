"""Génération de la référence séquentielle d'un devis.

Format : ``D-<YYYY>-<NNNN>`` (préfixe « D » + année à 4 chiffres + compteur
sur 4 chiffres remis à zéro chaque année). Exemples : ``D-2026-0001``,
``D-2026-0042``.

Stratégie : on calcule le prochain numéro à partir du MAX existant de
l'année courante. En cas de course (deux INSERT concurrents avec la
même reference), l'index unique côté DB lèvera IntegrityError et le
caller pourra retry.
"""
from __future__ import annotations

import re
from datetime import datetime, timezone

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.quote import Quote


REFERENCE_PREFIX = "D"
REFERENCE_RE = re.compile(r"^D-(\d{4})-(\d{4,})$")


def _current_year() -> int:
    return datetime.now(timezone.utc).year


async def generate_quote_reference(db: AsyncSession, *, year: int | None = None) -> str:
    """Renvoie la prochaine référence disponible pour l'année donnée.

    Si la table est vide pour l'année (ou globalement), on commence à 1.

    Implémentation : `MAX(reference)` côté SQL (single-row scalar). Comme la
    référence est lexicographique avec le compteur sur 4 chiffres zéro-padded,
    le max lexical correspond au max numérique tant que `next_n < 10_000`.
    Au-delà, le format passe à 5 chiffres et l'ordre lexico reste correct
    (le préfixe + année + tiret est commun, donc la longueur dicte l'ordre).
    """
    target_year = year if year is not None else _current_year()
    prefix = f"{REFERENCE_PREFIX}-{target_year}-"

    stmt = select(func.max(Quote.reference)).where(Quote.reference.like(f"{prefix}%"))
    max_ref = (await db.execute(stmt)).scalar_one_or_none()

    max_n = 0
    if max_ref:
        m = REFERENCE_RE.match(max_ref)
        if m and int(m.group(1)) == target_year:
            max_n = int(m.group(2))

    next_n = max_n + 1
    return f"{prefix}{next_n:04d}"
