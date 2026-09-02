# AGENTS.md

## Cursor Cloud specific instructions

MolfMaps is a small web app: a **FastAPI backend** (`backend/`, port `8000`) serving a
map image + cookie-based admin auth, and an **Angular 22 frontend** (`frontend/`, port
`4200`) that proxies `/api` to the backend. There is no database. Standard commands live
in `frontend/package.json`, `backend/requirements.txt`, and the top-level `./run` script.

Dependencies are installed by the startup update script (backend venv + pip, and
`npm ci` in `frontend/`). Notes below cover only non-obvious gotchas for running things.

- **Node version (important):** Angular 22's CLI hard-requires Node `>= 22.22.3`, but the
  default `/exec-daemon/node` on PATH is `22.14`, which makes `ng build`/`ng serve` fail.
  An nvm-managed Node `22.22.3` is installed and prepended to `PATH` via `~/.bashrc`, so
  **run frontend commands from an interactive/login bash shell** (e.g. a `tmux` session
  started with `bash -l`) to pick up the correct Node. `npm ci`/`npm install` work with
  either Node, so dependency installation is unaffected.
- **Analytics prompt:** running `npm start` (i.e. `ng serve`) directly will hang on an
  interactive Angular analytics prompt. Export `NG_CLI_ANALYTICS=false` first (the
  top-level `./run` script already does this) to avoid it.
- **Dev server host:** `ng serve` binds to `localhost`, so use `http://localhost:4200`
  (not `http://127.0.0.1:4200`) unless you pass `--host 127.0.0.1` (which `./run` does).
- **Backend `.env`:** login requires `backend/.env` (copied from `backend/.env.example`
  by both the update script and `./run`). Default dev credentials are
  `admin` / `change-me`; without a valid `.env` the API boots but rejects all logins.
- **Running everything:** `./run` from the repo root starts backend + frontend together
  (it also frees ports 8000/4200 via `lsof`). Alternatively run them separately:
  `cd backend && source .venv/bin/activate && uvicorn app.main:app --reload --port 8000`
  and `cd frontend && NG_CLI_ANALYTICS=false npm start`.
- **Tests:** backend `cd backend && source .venv/bin/activate && pytest`; frontend
  `cd frontend && npm test` (Vitest). There is no dedicated lint script; Prettier is
  available via `npx prettier --check "src/**/*.{ts,html,css}"` (note: some existing
  files are not Prettier-clean).
- **Don't reinstall frontend deps while `ng serve` is running** — `npm ci` wipes
  `node_modules` and breaks the live watcher; stop the dev server first.
