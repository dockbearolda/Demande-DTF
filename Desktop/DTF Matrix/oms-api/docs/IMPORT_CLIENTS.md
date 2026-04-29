# Import des Clients

## Structure

```
oms-api/
├── cli.py                          # CLI principal
├── data/
│   └── clients_import.csv          # Données clients
├── app/
│   └── utils/
│       └── import_clients.py       # Module d'import réutilisable
└── ...
```

## Utilisation

### 1. Initialiser la base de données

```bash
python cli.py db-init
```

Cela crée toutes les tables nécessaires.

### 2. Importer les clients

```bash
python cli.py clients-import --csv-path data/clients_import.csv
```

Optionnel : exclure le contact du nom (par défaut inclus)
```bash
python cli.py clients-import --csv-path data/clients_import.csv --no-include-contact
```

## Format du CSV

Le fichier CSV doit contenir ces colonnes :
- `societe` : Nom de la société (obligatoire)
- `contact` : Nom du contact (optionnel)
- `telephone` : Numéro de téléphone (optionnel)
- `email` : Adresse email (optionnel)
- `ville` : Ville / Adresse (optionnel)

Exemple :
```csv
societe,ville,contact,telephone,email
VOILA SXM,GRAND CASE,Clara,0690377241,
SEA YOU,GRAND CASE,Iris,0690552585,
```

## Comportement

- **Doublons** : Les clients avec le même nom sont ignorés
- **Emails** : Validés avant insertion (doit contenir @)
- **Contacts** : Les valeurs "?" et "—" sont ignorées
- **Rapport** : Affiche le nombre de clients créés, ignorés et les erreurs

## Pour le BAT

Avant de générer le BAT, exécutez :
1. `python cli.py db-init`
2. `python cli.py clients-import --csv-path data/clients_import.csv`

Cela prépare l'application avec votre base client intégrée.
