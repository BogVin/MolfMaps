# Playwright PR runner — extra reference

## Artifact layout

`python3 .cursor/skills/playwright-pr-runner/collect-artifacts.py` writes:

| Path | Contents |
|------|----------|
| `artifacts/playwright/summary.md` | Pass/fail body for the PR comment |
| `artifacts/playwright/results.json` | Playwright JSON report, if produced |
| `artifacts/playwright/html-report/` | Playwright HTML report |
| `artifacts/playwright/failures/` | Screenshots, videos, traces, `error-context.md` |

Cloud Agents attach media from the run. Read up to 3 failure screenshots after collection so they show on the agent run / PR.

## Why this is a skill, not a subagent

The Cloud Agent *is* the runner. A skill loads into that session so it can shell out, write `artifacts/`, and comment on the PR. A nested subagent would isolate that work and often lose PR-comment and artifact upload.

## Cloud environment secrets

Set these on the Cloud Agent environment (same values as local `backend/.env`):

- `ADMIN_USERNAME`
- `ADMIN_PASSWORD`
- `SESSION_SECRET`

Do not commit `backend/.env`. Do not paste secret values into `summary.md` or PR comments.

## Playwright entrypoints

| Intent | Command (from `e2e/`) |
|--------|------------------------|
| Full suite (default) | `CI=true PLAYWRIGHT_HTML_OPEN=never PLAYWRIGHT_JSON_OUTPUT_NAME=test-results/results.json npx playwright test --reporter=list --reporter=html --reporter=json` |
| Smoke / `@p1` only | same, plus `--grep @p1` |

The config `webServer` starts `./run` (FastAPI :8000 + Angular :4200). Do not start those processes yourself.
