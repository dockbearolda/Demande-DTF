# OMS API

FastAPI backend for Order Management System — clients, orders, JWT auth.

## Stack

- FastAPI + Pydantic v2
- SQLAlchemy 2.0 async + asyncpg
- PostgreSQL
- Alembic migrations
- JWT (python-jose) + bcrypt (passlib)
- pytest + httpx (async)

## Quick start (Docker)

```bash
cp .env.example .env
docker compose up --build
```

API on http://localhost:8000 — Swagger UI at http://localhost:8000/docs.

## Local development

```bash
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
# Start Postgres (docker compose up db) or set DATABASE_URL
alembic upgrade head
uvicorn app.main:app --reload
```

## Migrations

```bash
# Create a new migration from model changes
alembic revision --autogenerate -m "description"

# Apply migrations
alembic upgrade head

# Rollback
alembic downgrade -1
```

## Tests

```bash
pytest -v
```

Tests run against in-memory SQLite — no Postgres required.

## Routes

### Auth (`/auth`)
- `POST /auth/register` — create user
- `POST /auth/login` — returns `access_token` + `refresh_token`
- `POST /auth/refresh` — exchange refresh token for a new pair
- `GET  /auth/me` — current user (requires bearer token)

### Clients (`/clients`) — all require auth
- `GET    /clients?skip=&limit=&search=`
- `POST   /clients`
- `GET    /clients/{id}`
- `PUT    /clients/{id}`
- `DELETE /clients/{id}` — soft delete

### Orders (`/orders`) — all require auth
- `GET    /orders?skip=&limit=&statut=&client_id=&date_from=&date_to=`
- `POST   /orders`
- `GET    /orders/{id}`
- `PUT    /orders/{id}`
- `PATCH  /orders/{id}/status`
- `DELETE /orders/{id}` — soft delete

### BAT (`/bat`)
- `POST /bat/upload` (auth) — multipart: `order_id`, `file` (PDF/PNG/JPG, ≤ 20 Mo), optional `message`. Returns `{bat_id, validation_url, expires_at}`, sets the order to `BAT_SENT`, and emails the client.
- `GET  /bat/validate/{token}` (public) — HTML page (Tailwind via CDN) with preview + approve/reject buttons. Applies rate limiting.
- `POST /bat/validate/{token}/decision` (public) — body `{decision: "approved"|"rejected", comment}`. Idempotent (subsequent calls → 409). Updates the BAT and order, logs IP/UA, emits the `bat.approved` / `bat.rejected` webhook.
- `GET  /bat/file/{token}` (public) — serves the raw BAT file (used by the iframe/img on the validation page).
- `GET  /bat/{id}` (auth) — admin consultation.
- `GET  /bat/order/{order_id}` (auth) — BAT history for a given order.

#### Statuts BAT
`PENDING`, `APPROVED`, `REJECTED`, `EXPIRED`

#### Workflow client
1. Admin upload `POST /bat/upload` → email envoyé au client avec `validation_url`.
2. Client ouvre la page → voit l'aperçu + infos commande.
3. Client clique **Valider** ou **Demander une modification** (commentaire obligatoire si refus).
4. L'API met à jour le BAT, la commande, envoie l'email interne à l'équipe, et poste le webhook sortant signé HMAC-SHA256 vers `KANBAN_WEBHOOK_URL`.

#### Webhook sortant
- URL : `KANBAN_WEBHOOK_URL`
- En-têtes : `X-Webhook-Event: bat.approved|bat.rejected`, `X-Webhook-Signature: sha256=<hex>`
- Payload : `{"event": "...", "data": {...}, "timestamp": <unix>}`
- Signature : `hmac_sha256(secret=KANBAN_WEBHOOK_SECRET, msg=raw_body)`

#### Test end-to-end manuel
```bash
# 1. Auth
TOKEN=$(curl -s -X POST http://localhost:8000/auth/login \
  -H 'content-type: application/json' \
  -d '{"email":"admin@example.com","password":"supersecret123"}' | jq -r .access_token)

# 2. Upload BAT (assume ORDER_ID déjà créé)
curl -X POST http://localhost:8000/bat/upload \
  -H "Authorization: Bearer $TOKEN" \
  -F "order_id=$ORDER_ID" \
  -F "message=Merci de valider ce BAT" \
  -F "file=@./mon_bat.pdf"
# → { "bat_id": "...", "validation_url": "http://.../bat/validate/<token>", "expires_at": "..." }

# 3. Côté client : ouvrir validation_url dans un navigateur, cliquer "Valider".
# (ou simulation curl)
curl -X POST http://localhost:8000/bat/validate/<token>/decision \
  -H 'content-type: application/json' \
  -d '{"decision":"approved","comment":""}'

# 4. Vérifier le webhook sortant dans les logs de votre endpoint Kanban
#    (signature = hex(hmac_sha256(KANBAN_WEBHOOK_SECRET, raw_body)))
```

### Statuts ordres
`DRAFT`, `CONFIRMED`, `IN_PRODUCTION`, `BAT_SENT`, `BAT_APPROVED`, `SHIPPED`, `DELIVERED`, `CANCELLED`

### Rôles
`admin`, `operator` — `require_admin` dependency available in `app/core/dependencies.py`.

## Project layout

```
app/
├── main.py              # FastAPI app + CORS + exception handlers
├── config.py            # pydantic-settings
├── database.py          # async engine + get_db
├── logging_config.py    # JSON structured logs
├── models/              # SQLAlchemy ORM (User, Client, Order, Bat)
├── schemas/             # Pydantic v2 Create/Update/Read
├── routes/              # auth, clients, orders, bat
├── services/            # storage_service, email_service, webhook_service
├── templates/           # Jinja2: bat_validation.html + email_bat_*.html
└── core/                # security (JWT, hashing), dependencies
alembic/                 # migrations (0001_initial, 0002_bat)
tests/                   # pytest (conftest + test_auth + test_orders + test_bat)
```

## Environment

See `.env.example`. Required: `DATABASE_URL`, `SECRET_KEY`.

BAT-specific:
- `BAT_EXPIRATION_DAYS` (default 7), `BAT_MAX_UPLOAD_MB` (default 20)
- `BAT_PUBLIC_BASE_URL` — base URL used in emails (`https://api.example.com`)
- `STORAGE_BACKEND` — `local` or `s3` (with `S3_BUCKET`, `S3_REGION`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`, `S3_ENDPOINT_URL`)
- `SMTP_ENABLED`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_TLS`, `SMTP_FROM`, `SMTP_TEAM_ADDRESS`
- `KANBAN_WEBHOOK_URL`, `KANBAN_WEBHOOK_SECRET`, `KANBAN_WEBHOOK_ENABLED`
