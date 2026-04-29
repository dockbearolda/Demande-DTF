import csv
from pathlib import Path
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models.client import Client


async def import_clients_from_csv(
    csv_path: Path,
    session: AsyncSession,
    include_contact_in_name: bool = True,
) -> dict:
    """
    Importe les clients depuis un fichier CSV.

    Args:
        csv_path: Chemin vers le fichier CSV
        session: Session SQLAlchemy asynchrone
        include_contact_in_name: Inclure le contact dans le nom du client

    Returns:
        Dictionnaire avec stats : {'created': int, 'skipped': int, 'errors': int, 'error_details': list}
    """

    created, skipped, errors = 0, 0, 0
    error_details: list[str] = []

    if not csv_path.exists():
        return {
            'created': 0,
            'skipped': 0,
            'errors': 1,
            'error_details': [f"CSV non trouvé : {csv_path}"]
        }

    # Récupère les noms existants
    result = await session.execute(select(Client.nom))
    existing_names = {row[0].strip().lower() for row in result}

    try:
        with open(csv_path, encoding='utf-8') as f:
            reader = csv.DictReader(f)
            rows = list(reader)
    except Exception as e:
        return {
            'created': 0,
            'skipped': 0,
            'errors': 1,
            'error_details': [f"Erreur lecture CSV : {e}"]
        }

    for row in rows:
        try:
            payload = build_client_payload(row, include_contact_in_name)
            if not payload:
                skipped += 1
                continue

            nom_key = payload['nom'].strip().lower()
            if nom_key in existing_names:
                skipped += 1
                continue

            client = Client(**payload)
            session.add(client)
            existing_names.add(nom_key)
            created += 1

        except Exception as e:
            errors += 1
            error_details.append(f"{row.get('societe', 'Unknown')} → {str(e)}")

    try:
        await session.commit()
    except Exception as e:
        errors += 1
        error_details.append(f"Erreur commit BDD : {str(e)}")
        await session.rollback()

    return {
        'created': created,
        'skipped': skipped,
        'errors': errors,
        'error_details': error_details,
        'total': len(rows)
    }


def build_client_payload(row: dict, include_contact_in_name: bool = True) -> Optional[dict]:
    """Construit le payload client à partir d'une ligne CSV."""
    societe = (row.get('societe') or '').strip()
    contact = (row.get('contact') or '').strip()
    ville = (row.get('ville') or '').strip()
    tel = (row.get('telephone') or '').strip()
    email = (row.get('email') or '').strip()

    if not societe:
        return None

    # Construit le nom
    if include_contact_in_name and contact and contact not in ('?', '—'):
        nom = f"{societe} — {contact}"
    else:
        nom = societe

    payload = {'nom': nom}

    if not include_contact_in_name and contact and contact not in ('?', '—'):
        payload['contact'] = contact

    if email and '@' in email:
        payload['email'] = email

    if tel and tel not in ('?', '—'):
        payload['telephone'] = tel

    if ville and ville not in ('-', '?', '—'):
        payload['ville'] = ville

    return payload
