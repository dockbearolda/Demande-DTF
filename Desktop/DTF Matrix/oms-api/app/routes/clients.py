import uuid
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_, and_

from app.database import get_db
from app.models.client import Client
from app.models.client_contact import ClientContact
from app.schemas.client import (
    ClientCreate,
    ClientUpdate,
    ClientRead,
    ClientContactCreate,
    ClientContactUpdate,
    ClientContactRead,
)

router = APIRouter(prefix="/clients", tags=["clients"])


# ─── Clients ────────────────────────────────────────────────────────────────

@router.get("", response_model=list[ClientRead])
async def list_clients(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=500),
    search: str | None = None,
    db: AsyncSession = Depends(get_db),
) -> list[Client]:
    stmt = select(Client).where(Client.is_deleted.is_(False))
    if search:
        pattern = f"%{search}%"
        stmt = stmt.where(
            or_(
                Client.nom.ilike(pattern),
                Client.contact.ilike(pattern),
                Client.ville.ilike(pattern),
                Client.email.ilike(pattern),
            )
        )
    stmt = stmt.order_by(Client.nom.asc()).offset(skip).limit(limit)
    result = await db.execute(stmt)
    return list(result.scalars().all())


@router.post("", response_model=ClientRead, status_code=status.HTTP_201_CREATED)
async def create_client(
    payload: ClientCreate,
    db: AsyncSession = Depends(get_db),
) -> Client:
    client = Client(**payload.model_dump())
    db.add(client)
    await db.commit()
    await db.refresh(client)
    return client


@router.post("/search-or-create", response_model=dict)
async def search_or_create_client(
    payload: dict,
    db: AsyncSession = Depends(get_db),
):
    """Search for client by name (fuzzy) or create if doesn't exist."""
    nom = payload.get("nom")
    if not nom:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="nom is required")

    existing = await db.execute(
        select(Client).where(Client.nom.ilike(f"%{nom}%"), Client.is_deleted.is_(False)).limit(1)
    )
    client = existing.scalar_one_or_none()

    if client:
        return {
            "id": str(client.id),
            "nom": client.nom,
            "email": client.email,
            "telephone": client.telephone,
            "created": False,
        }

    new_client = Client(nom=nom)
    db.add(new_client)
    await db.commit()
    await db.refresh(new_client)

    return {
        "id": str(new_client.id),
        "nom": new_client.nom,
        "email": new_client.email,
        "telephone": new_client.telephone,
        "created": True,
    }


MAX_BULK_IMPORT = 5000


@router.post("/bulk-import", response_model=dict, status_code=status.HTTP_200_OK)
async def bulk_import_clients(
    payload: list[ClientCreate],
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Import a list of clients, grouping by company name.

    For each unique company (nom), one Client record is created (or reused if
    already exists). Each row's contact/telephone/email is added as a
    ClientContact, skipping exact duplicates (same nom + contact name).

    Borné à `MAX_BULK_IMPORT` lignes pour empêcher un payload abusif de saturer
    mémoire et transaction.
    """
    if len(payload) > MAX_BULK_IMPORT:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"Bulk import exceeds maximum of {MAX_BULK_IMPORT} rows",
        )

    clients_created = 0
    clients_skipped = 0
    contacts_created = 0

    # Group rows by normalised company name
    groups: dict[str, list[ClientCreate]] = {}
    for item in payload:
        key = item.nom.strip().upper()
        groups.setdefault(key, []).append(item)

    for key, rows in groups.items():
        first = rows[0]

        # Find or create the Client record
        result = await db.execute(
            select(Client).where(
                Client.nom.ilike(first.nom),
                Client.is_deleted.is_(False),
            ).limit(1)
        )
        client = result.scalar_one_or_none()

        if client is None:
            client = Client(
                nom=first.nom,
                ville=first.ville,
                telephone=first.telephone,
                email=first.email,
                nom_facture=first.nom_facture,
                adresse=first.adresse,
            )
            db.add(client)
            await db.flush()  # get client.id
            clients_created += 1
        else:
            clients_skipped += 1

        # Add contacts for every row that has a contact name
        for row in rows:
            if not row.contact:
                continue
            dup = await db.execute(
                select(ClientContact).where(
                    and_(
                        ClientContact.client_id == client.id,
                        ClientContact.nom.ilike(row.contact),
                    )
                ).limit(1)
            )
            if dup.scalar_one_or_none():
                continue
            db.add(ClientContact(
                client_id=client.id,
                nom=row.contact,
                telephone=row.telephone,
                email=row.email,
            ))
            contacts_created += 1

    await db.commit()
    return {
        "clients_created": clients_created,
        "clients_skipped": clients_skipped,
        "contacts_created": contacts_created,
    }


async def _get_client_or_404(db: AsyncSession, client_id: uuid.UUID) -> Client:
    result = await db.execute(
        select(Client).where(Client.id == client_id, Client.is_deleted.is_(False))
    )
    client = result.scalar_one_or_none()
    if not client:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Client not found")
    return client


@router.get("/{client_id}", response_model=ClientRead)
async def get_client(
    client_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
) -> Client:
    return await _get_client_or_404(db, client_id)


@router.put("/{client_id}", response_model=ClientRead)
async def update_client(
    client_id: uuid.UUID,
    payload: ClientUpdate,
    db: AsyncSession = Depends(get_db),
) -> Client:
    client = await _get_client_or_404(db, client_id)
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(client, k, v)
    await db.commit()
    await db.refresh(client)
    return client


@router.delete("/{client_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_client(
    client_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
) -> None:
    client = await _get_client_or_404(db, client_id)
    client.is_deleted = True
    await db.commit()


# ─── Contacts (responsables internes) ───────────────────────────────────────

@router.get("/{client_id}/contacts", response_model=list[ClientContactRead])
async def list_contacts(
    client_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
) -> list[ClientContact]:
    await _get_client_or_404(db, client_id)
    result = await db.execute(
        select(ClientContact)
        .where(ClientContact.client_id == client_id)
        .order_by(ClientContact.created_at.asc())
    )
    return list(result.scalars().all())


@router.post(
    "/{client_id}/contacts",
    response_model=ClientContactRead,
    status_code=status.HTTP_201_CREATED,
)
async def add_contact(
    client_id: uuid.UUID,
    payload: ClientContactCreate,
    db: AsyncSession = Depends(get_db),
) -> ClientContact:
    await _get_client_or_404(db, client_id)
    contact = ClientContact(client_id=client_id, **payload.model_dump())
    db.add(contact)
    await db.commit()
    await db.refresh(contact)
    return contact


@router.put(
    "/{client_id}/contacts/{contact_id}",
    response_model=ClientContactRead,
)
async def update_contact(
    client_id: uuid.UUID,
    contact_id: uuid.UUID,
    payload: ClientContactUpdate,
    db: AsyncSession = Depends(get_db),
) -> ClientContact:
    await _get_client_or_404(db, client_id)
    result = await db.execute(
        select(ClientContact).where(
            ClientContact.id == contact_id,
            ClientContact.client_id == client_id,
        )
    )
    contact = result.scalar_one_or_none()
    if not contact:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Contact not found")
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(contact, k, v)
    await db.commit()
    await db.refresh(contact)
    return contact


@router.delete("/{client_id}/contacts/{contact_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_contact(
    client_id: uuid.UUID,
    contact_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
) -> None:
    await _get_client_or_404(db, client_id)
    result = await db.execute(
        select(ClientContact).where(
            ClientContact.id == contact_id,
            ClientContact.client_id == client_id,
        )
    )
    contact = result.scalar_one_or_none()
    if not contact:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Contact not found")
    await db.delete(contact)
    await db.commit()
