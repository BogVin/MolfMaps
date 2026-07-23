# MolfMaps Frontend (Angular)

This Angular application is the **sole active frontend** for MolfMaps. It
provides the public map landing and catalog pages plus admin login/logout against
the FastAPI backend (`GET /api/map`, `GET /api/maps`, `POST /api/login`,
`POST /api/logout`, `GET /api/session`).

## Prerequisites

- Node.js LTS (Angular 22 requires Node `^22.22.3` or newer compatible release)
- npm (comes with Node)
- Backend running on port 8000 for local API calls (see `backend/`)

## Setup

```bash
cd frontend
npm ci
```

## Development (recommended)

Terminal 1 — API:

```bash
cd backend
source .venv/bin/activate
uvicorn app.main:app --reload --port 8000
```

Terminal 2 — Angular (proxies `/api` → `http://localhost:8000`):

```bash
cd frontend
npm start
```

Open the URL printed by the CLI (typically <http://localhost:4200/>).

Cookie-based sessions work because the browser talks to same-origin `/api/*`
via the Angular dev proxy (`proxy.conf.json`).

### Routes

| Path     | Purpose                          |
| -------- | -------------------------------- |
| `/`      | Public home — main map landing   |
| `/maps`  | Public catalog of available maps |
| `/login` | Admin login form                 |

## Optional: single-origin production build

Build the app, then serve it from FastAPI (no separate `ng serve`):

```bash
cd frontend
npm run build
cd ../backend
source .venv/bin/activate
uvicorn app.main:app --reload --port 8000
```

Open <http://localhost:8000/>. FastAPI serves `dist/frontend/browser` at `/`
while `/api/*` remains the API. Prefer the separated `npm start` + proxy workflow
for day-to-day development.

## Scripts

| Command         | Description                             |
| --------------- | --------------------------------------- |
| `npm start`     | Dev server with `/api` proxy to `:8000` |
| `npm run build` | Production build → `dist/frontend/`     |
| `npm test`      | Unit tests (Vitest)                     |

## Notes

- Admin credentials live only in `backend/.env` — never in frontend source or
  build artifacts.
- Visual/interaction behavior matches the pre-migration product (parity, not a
  redesign).
