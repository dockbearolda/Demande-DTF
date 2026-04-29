#!/usr/bin/env python3
"""
CLI pour gérer l'application OMS.

Usage:
    python cli.py clients-import --csv-path data/clients_import.csv
    python cli.py seed-fake --count 20
"""

import asyncio
import random
import sys
from datetime import date, timedelta
from decimal import Decimal
from pathlib import Path
import typer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker

from app.config import settings
from app.database import Base
from app.models import Client, Order, OrderLine, OrderStatus, Secteur, AssignedTo
from app.utils.import_clients import import_clients_from_csv

app = typer.Typer(help="CLI OMS")


class Colors:
    OK = "\033[92m"
    WARN = "\033[93m"
    ERR = "\033[91m"
    INFO = "\033[94m"
    BOLD = "\033[1m"
    END = "\033[0m"


def log_ok(msg: str):
    print(f"{Colors.OK}✓{Colors.END} {msg}")


def log_warn(msg: str):
    print(f"{Colors.WARN}⚠{Colors.END} {msg}")


def log_err(msg: str):
    print(f"{Colors.ERR}✗{Colors.END} {msg}")


def log_info(msg: str):
    print(f"{Colors.INFO}ℹ{Colors.END} {msg}")


async def get_async_session():
    """Crée une session async."""
    engine = create_async_engine(
        settings.DATABASE_URL,
        echo=False,
        pool_pre_ping=True,
    )
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    return async_session, engine


@app.command()
def clients_import(
    csv_path: str = typer.Option(
        "clients_import.csv",
        "--csv-path",
        help="Chemin vers le fichier CSV des clients"
    ),
    include_contact: bool = typer.Option(
        True,
        "--include-contact/--no-include-contact",
        help="Inclure le contact dans le nom du client"
    ),
):
    """Importe les clients depuis un fichier CSV."""
    print(f"\n{Colors.BOLD}=== Import des clients OMS ==={Colors.END}\n")

    csv_file = Path(csv_path)
    if not csv_file.exists():
        log_err(f"Fichier CSV non trouvé : {csv_file}")
        sys.exit(1)

    log_info(f"Fichier CSV : {csv_file}")
    log_info(f"Base de données : {settings.DATABASE_URL.split('@')[-1]}\n")

    async def _import():
        async_session, engine = await get_async_session()

        try:
            async with async_session() as session:
                report = await import_clients_from_csv(
                    csv_file,
                    session,
                    include_contact_in_name=include_contact
                )

                # Affiche le rapport
                print(f"{Colors.BOLD}=== Rapport ==={Colors.END}")
                print(f"  Total traité : {report.get('total', len(report.get('error_details', [])))}")
                print(f"  {Colors.OK}Créés       : {report['created']}{Colors.END}")
                print(f"  {Colors.WARN}Ignorés     : {report['skipped']}{Colors.END}")
                print(f"  {Colors.ERR}Erreurs     : {report['errors']}{Colors.END}")

                if report['error_details']:
                    print(f"\n{Colors.ERR}Détails des erreurs :{Colors.END}")
                    for err in report['error_details']:
                        print(f"  - {err}")

                if report['errors'] == 0:
                    log_ok("Import terminé avec succès !")
                    return 0
                else:
                    log_err(f"Import terminé avec {report['errors']} erreur(s)")
                    return 1

        finally:
            await engine.dispose()

    result = asyncio.run(_import())
    sys.exit(result)


@app.command()
def db_init():
    """Initialise la base de données (crée les tables)."""
    print(f"\n{Colors.BOLD}=== Initialisation de la BDD ==={Colors.END}\n")

    async def _init():
        engine = create_async_engine(
            settings.DATABASE_URL,
            echo=False,
        )
        try:
            async with engine.begin() as conn:
                await conn.run_sync(Base.metadata.create_all)
            log_ok("Tables créées avec succès")
        except Exception as e:
            log_err(f"Erreur : {e}")
            raise
        finally:
            await engine.dispose()

    asyncio.run(_init())


FAKE_CLIENTS = [
    ("Atelier Durand", "contact@atelier-durand.fr", "0142536789", "12 rue de Rivoli, 75001 Paris"),
    ("Boulangerie Moreau", "info@boulangerie-moreau.fr", "0478561234", "45 avenue Jean Jaurès, 69007 Lyon"),
    ("Café du Port", "hello@cafeduport.fr", "0491234567", "3 quai du Port, 13002 Marseille"),
    ("Studio Graphik", "contact@studiographik.fr", "0556789012", "22 cours de l'Intendance, 33000 Bordeaux"),
    ("Librairie Le Chapitre", "librairie@lechapitre.fr", "0231456789", "7 place du Parvis, 14000 Caen"),
    ("Pizzeria Luigi", "commande@pizzeria-luigi.fr", "0388123456", "18 rue des Orfèvres, 67000 Strasbourg"),
    ("Hôtel Belle Vue", "reception@hotel-bellevue.fr", "0493876543", "9 promenade des Anglais, 06000 Nice"),
    ("Garage Central", "contact@garage-central.fr", "0534789012", "56 avenue de Grande-Bretagne, 31300 Toulouse"),
    ("Fromagerie du Marché", "ventes@fromagerie-marche.fr", "0380456789", "14 rue Monge, 21000 Dijon"),
    ("Cabinet Médical St-Michel", "secretariat@cab-st-michel.fr", "0299345678", "2 rue Saint-Michel, 35000 Rennes"),
    ("Brasserie L'Ancre", "contact@brasserie-lancre.fr", "0240123456", "31 quai de la Fosse, 44000 Nantes"),
    ("École de Musique Crescendo", "info@crescendo-musique.fr", "0472987654", "88 rue de la République, 69002 Lyon"),
]

FAKE_PRODUITS = {
    Secteur.DTF: ["T-shirt coton blanc", "Sweat bio noir", "Polo jersey", "Tote bag", "Casquette"],
    Secteur.PRESSAGE: ["Flex thermocollant", "Flock velours", "Transfert sérigraphique"],
    Secteur.UV: ["Panneau forex A3", "Plaque dibond", "Roll-up 85x200"],
    Secteur.TROTEC: ["Gravure inox 10x10", "Découpe MDF 3mm", "Plexi rond Ø15"],
    Secteur.GOODIES: ["Mug céramique", "Stylo bille", "Clé USB 16Go", "Porte-clés"],
    Secteur.AUTRES: ["Sticker vinyle", "Autocollant vitrine"],
}

FAKE_NOTES = [
    "Livraison urgente avant vendredi",
    "Appeler avant expédition",
    "Couleur Pantone 286 C confirmée",
    "Logo fourni en PDF vectoriel",
    "Rappel : emballage neutre sans marque",
    None,
    None,
]


@app.command()
def seed_fake(
    count: int = typer.Option(20, "--count", "-n", help="Nombre de commandes à créer"),
    wipe: bool = typer.Option(False, "--wipe", help="Supprimer d'abord clients/commandes existants"),
):
    """Génère des clients + commandes factices pour le développement local."""
    print(f"\n{Colors.BOLD}=== Seed de données factices ==={Colors.END}\n")

    async def _seed():
        engine = create_async_engine(settings.DATABASE_URL, echo=False, future=True)
        async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

        try:
            async with engine.begin() as conn:
                await conn.run_sync(Base.metadata.create_all)

            async with async_session() as session:
                if wipe:
                    from sqlalchemy import delete as sa_delete
                    await session.execute(sa_delete(OrderLine))
                    await session.execute(sa_delete(Order))
                    await session.execute(sa_delete(Client))
                    await session.commit()
                    log_warn("Tables clients/orders vidées")

                # Clients (réutilise si existants par nom)
                clients: list[Client] = []
                for nom, email, tel, adresse in FAKE_CLIENTS:
                    existing = await session.execute(
                        select(Client).where(Client.nom == nom, Client.is_deleted.is_(False))
                    )
                    c = existing.scalar_one_or_none()
                    if not c:
                        c = Client(nom=nom, email=email, telephone=tel, adresse=adresse)
                        session.add(c)
                    clients.append(c)
                await session.commit()
                for c in clients:
                    await session.refresh(c)
                log_ok(f"{len(clients)} clients disponibles")

                # Orders
                rng = random.Random(42)
                statuses = [
                    OrderStatus.DRAFT,
                    OrderStatus.CONFIRMED,
                    OrderStatus.CONFIRMED,
                    OrderStatus.IN_PRODUCTION,
                    OrderStatus.IN_PRODUCTION,
                    OrderStatus.BAT_SENT,
                    OrderStatus.BAT_APPROVED,
                    OrderStatus.SHIPPED,
                    OrderStatus.DELIVERED,
                ]
                # AssignedTo enum uses short codes ("L","C","M") but SQLAlchemy
                # sends member names on Postgres — skip it to keep seed portable.
                assignees = [None]

                # Trouver le prochain numéro de référence libre
                ref_prefix = "CMD"
                existing_refs = await session.execute(select(Order.reference))
                used = {r for (r,) in existing_refs.all() if r.startswith(ref_prefix)}
                next_num = 1
                while f"{ref_prefix}-{next_num:05d}" in used:
                    next_num += 1

                created = 0
                for _ in range(count):
                    client = rng.choice(clients)
                    reference = f"{ref_prefix}-{next_num:05d}"
                    next_num += 1
                    statut = rng.choice(statuses)
                    livraison = date.today() + timedelta(days=rng.randint(-5, 30))
                    order = Order(
                        client_id=client.id,
                        reference=reference,
                        statut=statut,
                        montant_total=Decimal(rng.randint(50, 4000)),
                        date_livraison_prevue=livraison,
                        is_urgent=rng.random() < 0.15,
                        assigned_to=rng.choice(assignees),
                        personne_contact=client.nom.split()[0],
                        telephone=client.telephone,
                        notes=rng.choice(FAKE_NOTES),
                    )
                    session.add(order)
                    await session.flush()

                    n_lines = rng.randint(1, 3)
                    for i in range(1, n_lines + 1):
                        secteur = rng.choice(list(Secteur))
                        produit = rng.choice(FAKE_PRODUITS[secteur])
                        line = OrderLine(
                            order_id=order.id,
                            ligne_numero=i,
                            secteur=secteur,
                            produit=produit,
                            quantite=rng.randint(1, 200),
                            notes=rng.choice(FAKE_NOTES),
                        )
                        session.add(line)
                    created += 1

                await session.commit()
                log_ok(f"{created} commandes créées avec lignes")

                # Résumé par statut
                from collections import Counter
                by_status = await session.execute(
                    select(Order.statut).where(Order.is_deleted.is_(False))
                )
                counts = Counter(s.value for (s,) in by_status.all())
                print(f"\n{Colors.BOLD}Répartition par statut :{Colors.END}")
                for statut, n in sorted(counts.items()):
                    print(f"  {statut:<16} {n}")

        finally:
            await engine.dispose()

    asyncio.run(_seed())
    log_ok("Seed terminé")


@app.command()
def seed_supplier_catalog(
    source: str = typer.Option(
        str(Path(__file__).resolve().parent.parent / "Mokeup fournisseur uniforme"),
        "--source",
        help="Chemin vers le dossier `Mokeup fournisseur uniforme/`",
    ),
    storage: str = typer.Option(
        "./storage/supplier-mockups",
        "--storage",
        help="Dossier local servi par StaticFiles (sera lié en symlink au source)",
    ),
    no_link: bool = typer.Option(
        False,
        "--no-link",
        help="Ne pas créer/mettre à jour le symlink storage → source",
    ),
):
    """Indexe les mockups fournisseur dans la base à partir de `_manifest.csv`.

    Crée par défaut un symlink `storage/supplier-mockups` → `<source>` pour
    que FastAPI/StaticFiles puisse servir les images sans copie. En prod,
    remplacer le symlink par un vrai dossier copié ou un mount S3.
    """
    from app.utils.seed_supplier_catalog import seed_supplier_catalog as run_seed

    print(f"\n{Colors.BOLD}=== Seed catalogue fournisseur ==={Colors.END}\n")

    source_path = Path(source).expanduser().resolve()
    manifest_path = source_path / "_manifest.csv"
    storage_path = Path(storage).expanduser().resolve()

    if not source_path.exists():
        log_err(f"Source introuvable : {source_path}")
        sys.exit(1)
    if not manifest_path.exists():
        log_err(f"`_manifest.csv` introuvable dans {source_path}")
        sys.exit(1)

    log_info(f"Source : {source_path}")
    log_info(f"Manifest : {manifest_path}")
    log_info(f"Storage : {storage_path}")

    # ─── Symlink storage → source (sauf --no-link) ─────────────────
    # Sur Windows sans privilèges admin, `symlink_to` lève OSError ; on
    # bascule alors automatiquement sur la lecture directe via
    # SUPPLIER_MOCKUPS_PATH (l'utilisateur doit pointer cette variable
    # vers le dossier source dans son `.env`).
    if not no_link:
        storage_path.parent.mkdir(parents=True, exist_ok=True)
        try:
            if storage_path.is_symlink():
                current = storage_path.readlink()
                if Path(current).resolve() == source_path:
                    log_info(f"Symlink déjà à jour ({storage_path} → {source_path})")
                else:
                    storage_path.unlink()
                    storage_path.symlink_to(source_path)
                    log_ok(f"Symlink mis à jour ({storage_path} → {source_path})")
            elif storage_path.exists():
                log_warn(
                    f"{storage_path} existe et n'est pas un symlink — "
                    "skip de la mise à jour (utilise --no-link pour ignorer)"
                )
            else:
                storage_path.symlink_to(source_path)
                log_ok(f"Symlink créé ({storage_path} → {source_path})")
        except OSError as exc:
            log_warn(
                f"Impossible de créer le symlink ({exc}). "
                f"Sous Windows : configure SUPPLIER_MOCKUPS_PATH={source_path} "
                "dans `.env` pour pointer directement le dossier source."
            )

    # ─── Seed BDD ──────────────────────────────────────────────────
    async def _seed():
        async_session, engine = await get_async_session()
        try:
            async with async_session() as session:
                stats = await run_seed(session, manifest_path)
                print(f"\n{Colors.BOLD}=== Rapport ==={Colors.END}")
                print(
                    f"  Modèles  : {Colors.OK}+{stats.models_created}{Colors.END}"
                    f" / ↻{stats.models_updated}"
                )
                print(
                    f"  Couleurs : {Colors.OK}+{stats.colors_created}{Colors.END}"
                    f" / ↻{stats.colors_updated}"
                )
                print(
                    f"  Mockups  : {Colors.OK}+{stats.mockups_created}{Colors.END}"
                    f" / ↻{stats.mockups_updated}"
                )
                if stats.rows_skipped:
                    log_warn(f"{stats.rows_skipped} lignes ignorées (voir logs)")
                log_ok("Seed terminé")
        finally:
            await engine.dispose()

    asyncio.run(_seed())


if __name__ == "__main__":
    app()
