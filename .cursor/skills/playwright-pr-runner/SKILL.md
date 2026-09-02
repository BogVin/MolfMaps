---
name: playwright-pr-runner
description: Runs the MolfMaps Playwright E2E suite, publishes HTML report/traces/screenshots as artifacts, and posts pass/fail feedback. Use when a Cloud Agent is triggered on a pull request, when asked to run Playwright or e2e tests and report results, or when producing a Playwright test artifact for a PR.
---

# Playwright PR Runner

Run the E2E suite against the current branch, attach Playwright artifacts, and report pass/fail feedback. Do not write tests, do not fix product code, and do not push commits.

## When to Use
- A Cloud Agent is running because a pull request was opened or updated
- The user or automation asks to run Playwright / e2e tests and give feedback
- A PR needs a Playwright report artifact (HTML report, traces, failure screenshots)

## Workflow

### 1. Identify the PR and test scope
From the repo root:

```bash
git rev-parse --abbrev-ref HEAD
git log -1 --oneline
gh pr view --json number,title,url,baseRefName 2>/dev/null || true
```

Default scope is the **full** suite under `e2e/`. Use `npm run test:p1` only when the prompt explicitly asks for a smoke / `@p1` run.

### 2. Prepare the environment
Playwright starts `./run` itself (`e2e/playwright.config.ts` `webServer`). Do not start backend/frontend separately.

```bash
test -f backend/.env || cp backend/.env.example backend/.env
cd e2e
npm ci
npx playwright install --with-deps chromium
```

`ADMIN_USERNAME` and `ADMIN_PASSWORD` must come from Cloud Agent secrets or `backend/.env`. If either is missing after setup, stop and report an infrastructure failure — do not invent credentials.

### 3. Run Playwright
From `e2e/`, with `CI=true` so retries, workers, and `webServer.reuseExistingServer` match CI:

```bash
cd e2e
CI=true PLAYWRIGHT_HTML_OPEN=never PLAYWRIGHT_JSON_OUTPUT_NAME=test-results/results.json \
  npx playwright test --reporter=list --reporter=html --reporter=json
```

Capture the exit code. Do not treat a non-zero exit as a reason to skip artifact collection.

First-run timeout is high: `webServer` may create the backend venv and install frontend deps (up to 240s before tests start).

### 4. Collect artifacts
From the repo root, execute the skill script (do not rewrite it):

```bash
python3 .cursor/skills/playwright-pr-runner/collect-artifacts.py
```

This writes `artifacts/playwright/`:

| Path | Contents |
|------|----------|
| `summary.md` | Pass/fail feedback for the PR comment |
| `results.json` | Playwright JSON report (if produced) |
| `html-report/` | Playwright HTML report |
| `failures/` | Screenshots, videos, traces, `error-context.md` from failed tests |

Read `artifacts/playwright/summary.md`. For each failed test, Read up to 3 failure screenshots so they attach to the Cloud Agent run.

### 5. Publish feedback
Use `artifacts/playwright/summary.md` as the body.

- Final assistant message **must** be that summary (Cloud Agent run + automation `prComment` tool).
- If `gh` can see the PR, also post it:

```bash
gh pr comment --body-file artifacts/playwright/summary.md
```

If `gh` fails, still return the summary as the final message. Do not mention secret values, `.env` contents, or credential names with values.

## Feedback rules
- **Pass** — every test passed (retries that eventually passed count as pass; mention flakes).
- **Fail** — any test failed or the suite could not start. Name the test, the error, and the most likely cause (app bug vs test bug vs infrastructure).
- **Infra fail** — missing secrets, app did not boot, browsers failed to install. Do not blame product code.
- Do not request changes on style or coverage in this run. This skill reports E2E results only.

## DO NOT
- Modify application or test code
- Push commits, open extra PRs, or "heal" failing tests (`test-iterator` / `playwright-tester` own that)
- Start `./run` yourself — Playwright `webServer` owns the app lifecycle
- Use `waitForTimeout` debugging or headed / UI mode
- Paste credentials, tokens, or `.env` contents into comments or artifacts
- Skip artifact collection when tests fail
- Invent a pass if the process exited non-zero

## Definition of Done
- [ ] Playwright ran with `CI=true` from `e2e/`
- [ ] `artifacts/playwright/summary.md` exists and matches the run
- [ ] HTML report and failure media are under `artifacts/playwright/`
- [ ] Final message is the PR feedback summary
- [ ] No code changes and no commits

## Automation prompt (paste later)

When you create the Cursor Automation (trigger: pull request opened / pushed), use this as the agent prompt:

```
Follow the playwright-pr-runner skill. Run the Playwright E2E suite on this pull request, collect artifacts under artifacts/playwright/, and comment the summary on the PR. Do not change code or push commits.
```

Enable **Comment on pull requests**. In the Cloud Agent environment, set secrets `ADMIN_USERNAME`, `ADMIN_PASSWORD`, and `SESSION_SECRET` (same values as local `backend/.env`).

## Additional resources
- Artifact layout, secrets, and commands: [reference.md](reference.md)
