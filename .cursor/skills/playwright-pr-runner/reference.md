# Playwright PR runner — extra reference

## Coverage tags

The runner decides which specs are "related" to a PR by reading a header from each spec. Line 1 of every file in `e2e/tests/` declares the UI it covers:

```ts
// COVERAGE_TAG: frontend/src/app/login/**, frontend/src/app/home/**
```

- Paths are repo-relative globs, comma separated. `*` stops at `/`, `**` spans directories.
- `select-tests.py` scans the first 5 lines, so the header can sit above or below a file comment.
- A changed UI file selects every spec whose globs match it. A changed UI file that matches nothing becomes a **coverage gap**, and the runner authors a spec for it.
- A spec with no header cannot be matched. It is added to the run set defensively and reported under `untagged_specs` — treat that as a bug to fix in the same PR.

Keep the tag honest: if a spec starts asserting on a new screen, widen its tag. Overly broad tags waste CI time; missing ones cause duplicate tests to be generated.

## How changed files are classified

| Path | Classification | Effect |
|------|----------------|--------|
| `frontend/src/app/<surface>/**` (not `*.spec.ts`) | UI surface | Selects covering specs, or opens a coverage gap |
| `frontend/src/app/core/**`, `frontend/src/app/*.ts\|html\|css`, `frontend/src/main.ts`, `frontend/src/styles.css`, `frontend/src/index.html`, `frontend/angular.json`, `frontend/proxy.conf.json`, `frontend/package.json` | Broad UI | Full suite, no generation — no single spec owns these |
| `frontend/**/*.spec.ts` | Angular unit test | Ignored; not an E2E surface |
| `e2e/tests/*.spec.ts` | Changed spec | Added to the run set |
| `e2e/playwright.config.ts`, `e2e/package.json`, `e2e/fixtures/**`, `e2e/pages/**` | e2e scaffolding | Full suite |
| Everything else (`backend/**`, `specs/**`, docs, CI) | Non-UI | `@p1` smoke run, no generation |

Backend changes deliberately do not trigger UI test generation. If a backend change breaks a screen, the smoke run is the safety net.

## Run modes

`select-tests.py` writes `artifacts/playwright/selection.json`:

| Field | Use |
|-------|-----|
| `mode` | `targeted` / `generate` / `full` / `smoke` |
| `playwright_args` | Pass straight to `npx playwright test`; empty means the full suite |
| `specs_to_run` | Repo-relative specs the plan selected |
| `coverage_gaps` | Surfaces needing a spec, with `suggested_spec` / `existing_spec` |
| `needs_generation` | True when at least one gap is open |
| `untagged_specs` | Specs missing a `COVERAGE_TAG` |
| `coverage_map` | Every spec and the globs it claims |

Re-run the script after writing specs — that is how new files enter `specs_to_run`, and how `collect-artifacts.py` learns what the new specs cover.

Useful overrides:

```bash
# Diff against an explicit base instead of the PR base
python3 .cursor/skills/playwright-pr-runner/select-tests.py --base origin/main

# Machine-readable plan
python3 .cursor/skills/playwright-pr-runner/select-tests.py --json
```

## Artifact layout

`python3 .cursor/skills/playwright-pr-runner/collect-artifacts.py` writes:

| Path | Contents |
|------|----------|
| `artifacts/playwright/summary.md` | Pass/fail body for the PR comment |
| `artifacts/playwright/selection.json` | The scope plan the run used |
| `artifacts/playwright/results.json` | Playwright JSON report, if produced |
| `artifacts/playwright/html-report/` | Playwright HTML report |
| `artifacts/playwright/failures/` | Screenshots, videos, traces, `error-context.md` |
| `artifacts/playwright/new-tests/` | Copies of every spec this run wrote |
| `artifacts/playwright/new-tests/new-tests.patch` | `git diff` of `e2e/`, including untracked specs |
| `artifacts/playwright/new-tests/manifest.md` | Each new spec, what it covers, and per-test results |

The new-tests artifact is built from `git status`, so **collect before committing**. The script uses `git add --intent-to-add -- e2e` so untracked specs appear in the patch; that stages intent only, never content.

Cloud Agents attach media from the run. Read up to 3 failure screenshots after collection so they show on the agent run / PR.

## Why this is a skill, not a subagent

The Cloud Agent *is* the runner. A skill loads into that session so it can shell out, write `artifacts/`, commit, and comment on the PR. A nested subagent would isolate that work and often lose PR-comment and artifact upload.

## Cloud environment secrets

Set these on the Cloud Agent environment (same values as local `backend/.env`):

- `ADMIN_USERNAME`
- `ADMIN_PASSWORD`
- `SESSION_SECRET`

MolfMaps has one admin and no registration endpoint, so `e2e/fixtures/credentials.ts` reads these from the environment or `backend/.env`. Do not commit `backend/.env`. Do not paste secret values into `summary.md` or PR comments.

## Playwright entrypoints

All from `e2e/`:

| Intent | Command |
|--------|---------|
| Plan-driven (default) | `CI=true PLAYWRIGHT_HTML_OPEN=never PLAYWRIGHT_JSON_OUTPUT_NAME=test-results/results.json npx playwright test $ARGS --reporter=list --reporter=html --reporter=json` |
| Full suite | same, with `$ARGS` empty |
| Smoke / `@p1` only | same, with `$ARGS="--grep @p1"` |
| One spec while fixing it | `npx playwright test tests/<surface>.spec.ts` |

The config `webServer` starts `./run` (FastAPI :8000 + Angular :4200). Do not start those processes yourself.

## Current UI surfaces

Routes come from `frontend/src/app/app.routes.ts`:

| Route | Surface | Covered by |
|-------|---------|------------|
| `/` | `home` | `login.spec.ts`, `logout.spec.ts` (session header) |
| `/login` | `login` | `login.spec.ts` |
| `/maps` | `maps` | none yet |
| `/maps/:id` | `maps` | none yet |

A PR touching `frontend/src/app/maps/**` is therefore the first case that will trigger generation.
