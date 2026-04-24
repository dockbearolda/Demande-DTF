# Testing OMS Locally

## Quick Start (Recommended)

```bash
cd /Users/charlie/Desktop/DTF\ Matrix

# Start everything (backend + frontend)
./start-dev.sh

# In another terminal, when done:
./stop-dev.sh
```

## Manual Start

### 1. Start Backend (PostgreSQL + API)

```bash
cd oms-api

# Start Docker services
docker-compose up -d

# Wait for PostgreSQL to be ready (check health)
docker-compose ps

# Run migrations
docker-compose exec api alembic upgrade head
```

**API runs on:** http://localhost:8000
- **Swagger Docs:** http://localhost:8000/docs
- **Health check:** http://localhost:8000/health

### 2. Start Frontend

In a new terminal:

```bash
cd oms-frontend

# Install dependencies (first time only)
npm install

# Start dev server
npm run dev
```

**Frontend runs on:** http://localhost:5173

---

## Testing

### Browser
1. Open http://localhost:5173
2. Try to register: `/auth/register`
3. Try to login (use registered email/password)
4. Browse to `/dashboard` (should redirect if not logged in)

### API Testing (curl)
```bash
# Register admin
curl -X POST http://localhost:8000/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@test.com",
    "password": "Test1234!",
    "first_name": "Admin",
    "last_name": "Test",
    "is_admin": true
  }'

# Login
curl -X POST http://localhost:8000/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@test.com",
    "password": "Test1234!"
  }'

# Get health status
curl http://localhost:8000/health
```

### E2E Tests (Playwright)
```bash
cd oms-frontend

# Install Playwright browsers (first time)
npx playwright install chromium

# Run E2E tests
npm run test:e2e

# Or specific test
npx playwright test tests/e2e/login.spec.ts
```

---

## Troubleshooting

### Docker not running
```bash
# macOS
open -a Docker

# Or use Docker Desktop
```

### Port already in use
```bash
# Find process using port 5173 (frontend)
lsof -i :5173
kill -9 <PID>

# Find process using port 8000 (API)
lsof -i :8000
kill -9 <PID>

# Find process using port 5432 (PostgreSQL)
lsof -i :5432
kill -9 <PID>
```

### Database issues
```bash
# Reset database
cd oms-api
docker-compose down -v  # Remove volumes
docker-compose up -d    # Start fresh
docker-compose exec api alembic upgrade head
```

### Frontend build issues
```bash
cd oms-frontend

# Clean install
rm -rf node_modules package-lock.json
npm install
npm run build
```

---

## File Structure
```
DTF Matrix/
├── oms-api/              # FastAPI backend
│   ├── app/              # Application code
│   ├── tests/            # Unit tests
│   ├── alembic/          # Database migrations
│   ├── Dockerfile        # Docker image
│   ├── docker-compose.yml # Local dev compose
│   └── requirements.txt   # Python dependencies
│
├── oms-frontend/         # React + Vite frontend
│   ├── src/              # React components
│   ├── tests/e2e/        # Playwright tests
│   ├── Dockerfile        # Docker image
│   ├── nginx.conf        # Production nginx config
│   └── package.json      # Node dependencies
│
├── .github/workflows/    # GitHub Actions CI/CD
│   ├── ci.yml           # Test pipeline
│   └── deploy.yml       # Deploy pipeline
│
├── railway.json         # Railway deployment config
├── start-dev.sh         # Start dev environment
└── stop-dev.sh          # Stop dev environment
```

---

## Environment Variables

### Backend (.env in oms-api)
```
DATABASE_URL=postgresql+asyncpg://oms:oms@localhost:5432/oms
SECRET_KEY=dev-secret-change-me
CORS_ORIGINS=http://localhost:5173
LOG_LEVEL=INFO
```

### Frontend (.env in oms-frontend)
```
VITE_API_URL=http://localhost:8000
```

---

## Next Steps
- [ ] Register a test user via http://localhost:5173
- [ ] Login and explore dashboard
- [ ] Test BAT upload functionality
- [ ] Run E2E tests: `npm run test:e2e`
- [ ] Review API docs: http://localhost:8000/docs
