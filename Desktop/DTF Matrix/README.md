# OMS (Order Management System)

This monorepo contains a full-stack order management system with:
- **Backend**: FastAPI + SQLAlchemy + PostgreSQL
- **Frontend**: React 18 + Vite + TailwindCSS
- **Deployment**: Railway (CI/CD via GitHub Actions)

## Project Structure

```
.
├── oms-api/          # FastAPI backend
├── oms-frontend/     # React + Vite frontend
├── .github/workflows # CI/CD pipelines
├── railway.json      # Railway configuration
└── README.md         # This file
```

## Development Setup

### Backend

```bash
cd oms-api
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
# or with uv:
uv pip install -r requirements.txt

# Run migrations
alembic upgrade head

# Start server
uvicorn app.main:app --reload
```

### Frontend

```bash
cd oms-frontend
npm ci
npm run dev
# App runs on http://localhost:5173
```

### Full Stack (with docker-compose)

```bash
docker-compose up -d
# API: http://localhost:8000
# Frontend: http://localhost:5173
```

## Testing

### Backend Tests

```bash
cd oms-api
pytest -v
```

### Frontend Tests (E2E)

```bash
cd oms-frontend
npm run test:e2e  # Runs Playwright tests (chromium, webkit, msedge)
```

### CI Pipeline

Push to `main` or `develop` to trigger:
1. **Backend lint-test** — ruff + pytest
2. **Frontend build** — npm build + tsc
3. **E2E tests** — Playwright matrix (chromium, webkit, msedge)

See [`.github/workflows/ci.yml`](.github/workflows/ci.yml) for details.

## Deploy

### Railway Configuration

Set these environment variables in your Railway project:

#### Backend (oms-api)
- `DATABASE_URL` — PostgreSQL connection string (e.g., `postgresql://user:pass@host/dbname`)
- `SECRET_KEY` — JWT secret for token signing
- `KANBAN_WEBHOOK_URL` — External webhook endpoint for order status changes
- `KANBAN_WEBHOOK_SECRET` — Shared secret for webhook signature verification
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD` — Email server credentials
- `STORAGE_BACKEND` — Set to `s3` for S3 file storage
- `S3_BUCKET`, `S3_REGION`, `S3_ACCESS_KEY`, `S3_SECRET_KEY` — S3 credentials

#### Frontend (oms-frontend)
- `VITE_API_URL` — Backend API base URL (auto-set from backend service URL)

### GitHub Secrets

For automated deployment, set these in your GitHub repo settings:
- `RAILWAY_TOKEN` — Railway API token for deployments
- `PROD_API_URL` — Production API URL (used during frontend build)

### Deploy to Railway

Merge to `main` to trigger deployment (automatic via GitHub Actions):

```yaml
# Or manual deploy via Railway CLI:
railway deploy --service oms-api --working-directory oms-api
railway deploy --service oms-frontend --working-directory oms-frontend
```

## Production Deployment Checklist

- [ ] Configure all required environment variables in Railway
- [ ] Set up PostgreSQL database (Railway Postgres plugin)
- [ ] Configure S3 bucket for file storage (or use Railway storage)
- [ ] Set up SMTP server for email notifications
- [ ] Configure KANBAN_WEBHOOK_URL and SECRET for webhooks
- [ ] Run database migrations: `alembic upgrade head`
- [ ] Test health endpoints: `GET /health` (backend), `GET /` (frontend)

---

# DTF Matrix

Python module that exposes a **Direct-to-Film (DTF)** print-size matrix for
t-shirts and polos across sizes `XS` → `5XL` and four print zones:
`front`, `back`, `chest`, `sleeve`.

## Installation

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

## Quick start

```python
from dtf_matrix import get_print_size, validate_design_dimensions

# Maximum DTF print size (width, height) in cm
width, height = get_print_size("t-shirt", "L", "front")
print(width, height)  # -> 32.0 38.0

# Will a 20 x 25 cm design fit on a size-M t-shirt front?
validate_design_dimensions("t-shirt", "M", "front", 20.0, 25.0)  # -> True

# Too wide?
validate_design_dimensions("polo", "S", "chest", 50.0, 5.0)      # -> False
```

## API

| Function                                                                 | Returns              |
| ------------------------------------------------------------------------ | -------------------- |
| `get_print_size(garment_type, size, zone)`                               | `(width, height)` cm |
| `validate_design_dimensions(garment_type, size, zone, width, height)`    | `bool`               |

### Errors

- `InvalidGarmentError` — garment type is not `"t-shirt"` or `"polo"`
- `InvalidSizeError` — size is not one of `XS, S, M, L, XL, XXL, 3XL, 4XL, 5XL`
- `InvalidZoneError` — zone is not one of `front, back, chest, sleeve`

All three inherit from `ValueError`.

## Tests

```bash
pytest -v --cov=dtf_matrix
```

---

# Dropbox Setup (`dropbox_setup.py`)

Automates the creation of a standardized folder tree on Dropbox for every new
order.

## Folder structure

```
/Commandes/{YYYY}/{MM}/{order_id}_{client_name}/
    ├── 01_Brief/
    ├── 02_Fichiers_client/
    ├── 03_BAT/
    ├── 04_Production/
    └── 05_Livraison/
```

## Setup

1. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
2. Create a Dropbox app and generate an access token at
   <https://www.dropbox.com/developers/apps>.
3. Copy `.env.example` to `.env` and paste the token:
   ```bash
   cp .env.example .env
   # then edit .env: DROPBOX_ACCESS_TOKEN=sl.xxxxx
   ```

## Usage

```python
from dropbox_setup import create_order_folders

result = create_order_folders("ORD-2026-001", "Acme Corp")
# {
#   "success": True,
#   "path": "/Commandes/2026/04/ORD-2026-001_Acme_Corp",
#   "subfolders_created": ["01_Brief", "02_Fichiers_client", ...],
#   "errors": []
# }
```

CLI:

```bash
python dropbox_setup.py ORD-2026-001 "Acme Corp"
```

The function is **idempotent**: re-running it on the same order does not
duplicate folders.

## Tests

The Dropbox suite is fully mocked — no network calls, no real token required:

```bash
pytest -v tests/test_dropbox_setup.py
```
