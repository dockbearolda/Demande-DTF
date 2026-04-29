"""One-shot dedupe + multi-contact import.

- Merges the legacy "BREAD N BUTTER — Sandra / Sylvain" client into "BREAD N
  BUTTER" (repointing orders + contacts) so the dropdown shows a single row.
- Re-walks data/clients_import.csv: for each company already in DB, sets the
  primary contact if missing and creates `client_contacts` entries for every
  additional person mentioned in the CSV.
"""

import asyncio
import csv
import sys
from pathlib import Path

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine, AsyncSession

# Make sure the script can import the app package when run from oms-api/.
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.config import settings  # noqa: E402
from app.models.client import Client  # noqa: E402
from app.models.client_contact import ClientContact  # noqa: E402
from app.models.order import Order  # noqa: E402


def normalize_name(s: str) -> str:
    return " ".join(s.strip().lower().split())


async def main() -> None:
    engine = create_async_engine(settings.DATABASE_URL, echo=False)
    Session = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)

    csv_path = Path(__file__).resolve().parent.parent / "data" / "clients_import.csv"
    with open(csv_path, encoding="utf-8") as f:
        rows = list(csv.DictReader(f))

    async with Session() as session:
        # ---------- Step 1: merge BREAD N BUTTER duplicate ----------
        all_clients = (await session.execute(select(Client))).scalars().all()
        by_norm: dict[str, Client] = {normalize_name(c.nom): c for c in all_clients}

        merged = 0
        bb_main = by_norm.get(normalize_name("BREAD N BUTTER"))
        bb_dup = by_norm.get(normalize_name("BREAD N BUTTER — Sandra / Sylvain"))
        if bb_main and bb_dup and bb_main.id != bb_dup.id:
            await session.execute(
                update(Order).where(Order.client_id == bb_dup.id).values(client_id=bb_main.id)
            )
            await session.execute(
                update(ClientContact)
                .where(ClientContact.client_id == bb_dup.id)
                .values(client_id=bb_main.id)
            )
            await session.delete(bb_dup)
            del by_norm[normalize_name("BREAD N BUTTER — Sandra / Sylvain")]
            merged = 1
            await session.flush()

        # ---------- Step 2: walk CSV and add primary + extra contacts ----------
        # Pre-load all existing client_contacts to dedupe in-memory.
        existing_contacts = (await session.execute(select(ClientContact))).scalars().all()
        contacts_by_client: dict[str, list[ClientContact]] = {}
        for cc in existing_contacts:
            contacts_by_client.setdefault(str(cc.client_id), []).append(cc)

        primary_set = 0
        extras_added = 0
        ville_filled = 0
        skipped = 0

        for row in rows:
            societe = (row.get("societe") or "").strip()
            contact = (row.get("contact") or "").strip()
            tel = (row.get("telephone") or "").strip() or None
            email_raw = (row.get("email") or "").strip()
            email = email_raw if email_raw and "@" in email_raw else None
            ville = (row.get("ville") or "").strip()

            if not societe:
                continue

            client = by_norm.get(normalize_name(societe))
            if not client:
                # Should be present from the prior import. Create defensively.
                client = Client(nom=societe)
                session.add(client)
                await session.flush()
                by_norm[normalize_name(societe)] = client

            # Backfill ville on the master record if it was empty.
            if ville and not (client.ville or "").strip():
                client.ville = ville
                ville_filled += 1

            if not contact:
                continue

            # Primary contact slot is empty → fill it (and capture tel/email).
            if not (client.contact or "").strip():
                client.contact = contact
                if tel and not (client.telephone or "").strip():
                    client.telephone = tel
                if email and not (client.email or "").strip():
                    client.email = email
                primary_set += 1
                continue

            # Already has a primary. Skip if this row IS the primary.
            if (client.contact or "").strip().lower() == contact.lower():
                skipped += 1
                continue

            # Otherwise add as a ClientContact, deduping on (name, phone, email).
            cid = str(client.id)
            existing = contacts_by_client.setdefault(cid, [])
            already = any(
                (cc.nom or "").strip().lower() == contact.lower()
                and (cc.telephone or "") == (tel or "")
                and (cc.email or "") == (email or "")
                for cc in existing
            )
            if already:
                skipped += 1
                continue

            cc = ClientContact(
                client_id=client.id,
                nom=contact,
                telephone=tel,
                email=email,
            )
            session.add(cc)
            existing.append(cc)
            extras_added += 1

        await session.commit()

        # ---------- Final report ----------
        n_clients = len(
            (await session.execute(select(Client).where(Client.is_deleted.is_(False))))
            .scalars()
            .all()
        )
        n_contacts = len((await session.execute(select(ClientContact))).scalars().all())

        print("=== Dedupe + multi-contact import ===")
        print(f"  Merged duplicates       : {merged}")
        print(f"  Primary contact set     : {primary_set}")
        print(f"  Extra contacts added    : {extras_added}")
        print(f"  Ville backfilled        : {ville_filled}")
        print(f"  Skipped (already present): {skipped}")
        print(f"  Total clients (active)  : {n_clients}")
        print(f"  Total contacts          : {n_contacts}")


if __name__ == "__main__":
    asyncio.run(main())
