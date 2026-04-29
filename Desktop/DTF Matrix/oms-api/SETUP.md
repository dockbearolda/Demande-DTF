# Configuration de l'OMS API

## Installation des dépendances

```bash
pip install -r requirements.txt
```

## Avant de lancer l'application

### 1. Initialiser la base de données

```bash
python3 cli.py db-init
```

### 2. Importer les clients

```bash
python3 cli.py clients-import --csv-path data/clients_import.csv
```

Vous verrez un rapport :
```
=== Rapport ===
  Total traité : 45
  ✓ Créés       : 42
  ⚠ Ignorés     : 3
  ✗ Erreurs     : 0
```

## Lancer l'application

### Développement
```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### Production
```bash
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

## Structure des données

- **Clients** : Importés depuis `data/clients_import.csv`
- **Base de données** : Définie dans `.env` via `DATABASE_URL`
- **Migrations** : Gérées par Alembic

## Pour le BAT / Exécutable

Avant de générer le BAT, assurez-vous que :

1. ✅ Les dépendances sont installées
2. ✅ La base de données est initialisée (`python3 cli.py db-init`)
3. ✅ Les clients sont importés (`python3 cli.py clients-import --csv-path data/clients_import.csv`)

L'application est alors prête à être empaquetée avec PyInstaller ou équivalent.

## Exemple de script de setup (pour CI/CD ou BAT)

```bash
#!/bin/bash
# setup.sh

echo "🔧 Installation des dépendances..."
pip install -r requirements.txt

echo "📊 Initialisation de la base de données..."
python3 cli.py db-init

echo "👥 Import des clients..."
python3 cli.py clients-import --csv-path data/clients_import.csv

echo "✅ Setup terminé !"
```

## Aide CLI

```bash
python3 cli.py --help
python3 cli.py clients-import --help
python3 cli.py db-init --help
```
