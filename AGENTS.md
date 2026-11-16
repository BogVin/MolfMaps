# AGENTS.md

## Cursor Cloud specific instructions

MolfMaps is a two-service web app: a **FastAPI backend** (`backend/`, port **8000**)
and an **Angular 22 frontend** (`frontend/`, port **4200**). The Angular dev server
proxies `/api/*` to the backend (`frontend/proxy.conf.json`) so the HttpOnly session
cookie works same-origin. Standard commands live in `frontend/README.md`,
`frontend/package.json` scripts, and `backend/.env.example`; the root `./run` script
starts both services together.

### Running everything

- `./run` (from repo root) creates the backend venv if missing, copies
  `backend/.env` from `backend/.env.example` if missing, then starts the backend
  (`uvicorn app.main:app --reload`) and frontend (`npm start`) together. This is the
  normal dev workflow. Run it inside a tmux session (long-running).
- Backend only: `cd backend && source .venv/bin/activate && uvicorn app.main:app --reload --port 8000`
- Frontend only: `cd frontend && npm start` (needs the backend on :8000 for `/api`).

### Node version gotcha (important, non-obvious)

Angular 22's CLI hard-requires Node **>= 22.22.3**. The base image's default
`node` (`/exec-daemon/node`) is **v22.14.0**, which makes `ng serve`/`ng build`/`ng test`
fail with a "minimum Node.js version" error. A compatible Node is installed via
**nvm** and set as the default, and `~/.bashrc` runs `nvm use default` so a fresh
login shell resolves `node` to the correct version. If you ever see the Angular Node
version error, run `nvm use default` (or open a fresh login shell) before invoking any
Angular CLI command. `npm ci` itself works on either Node version.

### Tests / lint / build

- Backend tests: `cd backend && source .venv/bin/activate && pytest` (uses
  `fastapi.testclient`; no running server needed). `conftest.py` sets
  `MOLFMAPS_DISABLE_DOTENV=1` so a local `backend/.env` never leaks into tests.
- Backend lint: none configured.
- Frontend tests: `cd frontend && npx ng test --watch=false` (Vitest via
  `@angular/build:unit-test`, jsdom).
- Frontend build: `cd frontend && npm run build` → `frontend/dist/frontend/browser`.
  If that dist dir exists, the backend will also serve the built SPA at `/`
  (single-origin mode); delete `frontend/dist` to return to API-only backend.
- Frontend "lint": no npm `lint` script. Prettier is configured but the committed
  source is **not** Prettier-clean, so `npx prettier --check .` reports pre-existing
  warnings — do not treat that as a regression.

### Auth / hello-world

Default dev credentials come from `backend/.env` (from the example: `admin` /
`change-me`). If any of `ADMIN_USERNAME` / `ADMIN_PASSWORD` / `SESSION_SECRET` are
empty, the app still serves the map but **refuses all logins** (logs a startup
warning). A smoke test of the core flow: `POST /api/login` then `GET /api/session`
should return `{"authenticated": true}`.
