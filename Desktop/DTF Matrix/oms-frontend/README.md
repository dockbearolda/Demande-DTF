# oms-frontend

Frontend Vite + React 18 + TypeScript pour l'API OMS (FastAPI sur `http://localhost:8000`).

## Stack

- Vite 5 + React 18 + TypeScript
- Tailwind v3 (darkMode `class`)
- React Router v6 (`createBrowserRouter`)
- TanStack Query v5 (staleTime 30 s, invalidation après mutation)
- axios avec interceptor qui attache `Bearer` + refresh auto sur 401 via `/auth/refresh`
- @dnd-kit/core pour le Kanban
- Playwright (config Chromium + WebKit + MSEdge)

## Démarrage

```bash
cp .env.example .env          # ajuster VITE_API_URL si besoin
npm install
npm run dev                   # http://localhost:5173
```

Le frontend attend l'API OMS sur `http://localhost:8000` par défaut. Changer via
`VITE_API_URL` dans `.env`.

## Scripts

| Commande            | Description                                    |
| ------------------- | ---------------------------------------------- |
| `npm run dev`       | Dev server Vite sur `:5173`                    |
| `npm run build`     | Typecheck + build production (dans `dist/`)    |
| `npm run preview`   | Preview du build                               |
| `npm run typecheck` | Vérification TypeScript sans émettre de fichier|
| `npm run test:e2e`  | Playwright (Chromium + WebKit + MSEdge)        |

## Structure

```
src/
  main.tsx, App.tsx, router.tsx
  lib/
    api.ts      axios + refresh interceptor
    auth.tsx    AuthContext (login/logout, tokens en localStorage)
    types.ts    Order, Client, BAT, Kanban, labels/couleurs FR
  hooks/
    useOrders.ts, useKanban.ts, useMetrics.ts, useClients.ts, useBats.ts
  pages/
    Login.tsx, Dashboard.tsx, Orders.tsx, Kanban.tsx, Clients.tsx, Bat.tsx
  components/
    Layout.tsx, ProtectedRoute.tsx, KpiCard.tsx, StatusBadge.tsx,
    OrderTable.tsx, KanbanColumn.tsx, KanbanCard.tsx, Toast.tsx
```

## Règles métier

- **SLA** : une commande est « en retard » si `date_livraison_prevue < aujourd'hui`
  **et** statut ∈ `CONFIRMED | IN_PRODUCTION | BAT_SENT | BAT_APPROVED`.
- **Couleurs statuts** : DRAFT=slate, CONFIRMED=blue, IN_PRODUCTION=amber,
  BAT_SENT=purple, BAT_APPROVED=indigo, SHIPPED=teal, DELIVERED=green, CANCELLED=red.
- **Labels FR** : Brouillon, Confirmée, En production, BAT envoyé, BAT validé,
  Expédiée, Livrée, Annulée.
- **Pas de persistance** des commandes en `localStorage` : tout passe par TanStack
  Query (`staleTime: 30_000`) avec `invalidateQueries` après mutation.

## Authentification

- Tokens stockés en `localStorage` (`oms_access`, `oms_refresh`).
- L'intercepteur axios attache `Authorization: Bearer <access>` sur chaque requête.
- Sur `401`, tentative de refresh via `POST /auth/refresh`, puis replay de la
  requête. Si le refresh échoue → redirect `/login`.

## Tests E2E

Specs non incluses. `playwright.config.ts` définit 3 projects :

- `chromium` (Desktop Chrome)
- `webkit` (Desktop Safari) — couverture macOS
- `msedge` (`channel: "msedge"`) — couverture Windows/Edge

`baseURL` : `PLAYWRIGHT_BASE_URL` (défaut `http://localhost:5173`).
`VITE_API_URL` propagé au webServer.

Première exécution :

```bash
npx playwright install
npm run test:e2e
```
