---
name: playwright-pr-runner
description: Runs the Playwright UI tests related to a pull request, writes new UI specs when a changed screen has no coverage, publishes the report plus a new-tests artifact, and posts pass/fail feedback. Use when a Cloud Agent is triggered on a pull request, when asked to run Playwright or e2e tests and give feedback, or when producing a Playwright test artifact for a PR.
---

# Playwright PR Runner

Run the Playwright specs related to a pull request. When the PR changes a UI surface that no spec covers, write that spec, run it, publish it as an artifact, and commit it to the PR branch. Never change application code.

## When to Use
- A Cloud Agent is running because a pull request was opened or updated
- The user or automation asks to run Playwright / e2e tests and give feedback
- A PR needs a Playwright report artifact (HTML report, traces, failure screenshots)

## Scope: UI only
This skill runs and authors **UI** tests — specs that drive the Angular app in a browser. Only `frontend/src/**` counts as a UI surface.

- Backend, spec, docs, and CI-only PRs get a `@p1` smoke run and **no** new tests.
- Never author API-only or backend specs here. A UI test may call the API through fixtures to set up or verify data, but the browser flow must be the subject of the test.

## Workflow

### 1. Resolve the scope
From the repo root:

```bash
git rev-parse --abbrev-ref HEAD
gh pr view --json number,title,url,baseRefName 2>/dev/null || true
python3 .cursor/skills/playwright-pr-runner/select-tests.py
```

This diffs the PR against its base, maps each changed UI file onto the specs that declare it in their `COVERAGE_TAG` header, and writes the plan to `artifacts/playwright/selection.json`.

| `mode` | What it means | What to run |
|--------|---------------|-------------|
| `targeted` | Existing specs cover the changed UI | Only the specs in `specs_to_run` |
| `generate` | UI changed and no spec covers it | Author the specs first, then re-run the selector |
| `full` | App-wide UI change or shared e2e scaffolding changed | The whole suite |
| `smoke` | No UI change in this PR | `--grep @p1`, and author nothing |

`coverage_gaps` can appear in any mode except `smoke`. Each gap names a UI surface and the spec file to create or extend.

If `untagged_specs` is non-empty, those specs could not be matched and were added to the run set defensively. Read them before authoring anything so you do not duplicate coverage that already exists, and add a `COVERAGE_TAG` to each one you touch.

### 2. Prepare the environment
Playwright starts `./run` itself (`e2e/playwright.config.ts` `webServer`). Do not start backend/frontend separately.

```bash
test -f backend/.env || cp backend/.env.example backend/.env
cd e2e
npm ci
npx playwright install --with-deps chromium
```

`ADMIN_USERNAME` and `ADMIN_PASSWORD` must come from Cloud Agent secrets or `backend/.env`. If either is missing after setup, stop and report an infrastructure failure — do not invent credentials.

### 3. Author the missing UI specs
Skip this step entirely when `coverage_gaps` is empty or `mode` is `smoke`.

Read the changed components and their templates first, then follow the `playwright-tester` skill and `.cursor/rules/playwright-testing.mdc`. On top of those:

- One spec per surface: `e2e/tests/<surface>.spec.ts`, matching the gap's `suggested_spec`. Extend the file instead of creating it when `existing_spec` is set.
- **Line 1 must be the coverage header**, so the next PR can find the spec:
  `// COVERAGE_TAG: frontend/src/app/<surface>/**`
- Reuse `e2e/pages/` page objects and add new ones there — no locators inline in specs. Credentials come from `e2e/fixtures/credentials.ts`, never hardcoded.
- The app ships no `data-testid`, so locate by role and label as the existing page objects do.
- Cover the happy path plus at least one failure or edge case, roughly 3-6 tests per surface. Tag every test `@p1`-`@p4`.
- Condition-based waits only. Clean up anything the test creates in `afterEach`/`afterAll` inside `try/catch`.

Then re-run the selector so the new specs join the run set:

```bash
python3 .cursor/skills/playwright-pr-runner/select-tests.py
```

### 4. Run Playwright
From `e2e/`, with `CI=true` so retries, workers, and `webServer.reuseExistingServer` match CI:

```bash
cd e2e
ARGS=$(python3 -c "import json; print(' '.join(json.load(open('../artifacts/playwright/selection.json'))['playwright_args']))")
CI=true PLAYWRIGHT_HTML_OPEN=never PLAYWRIGHT_JSON_OUTPUT_NAME=test-results/results.json \
  npx playwright test $ARGS --reporter=list --reporter=html --reporter=json
```

An empty `$ARGS` runs the full suite, which is what `full` mode wants. Capture the exit code. A non-zero exit is never a reason to skip artifact collection.

First-run timeout is high: `webServer` may create the backend venv and install frontend deps (up to 240s before tests start).

### 5. Triage failures in specs you just wrote
A test you authored gets the same verdict weight as any other test, so a bad locator would fail the PR for no reason. For each failure in a new spec, read the trace, screenshot, and the component source, then decide:

- **Test bug** (wrong locator, wrong copy, missing wait) — fix the spec and re-run that spec alone. At most **2** fix attempts, then leave it failing and say so.
- **App bug** — leave the test failing. That is a real finding; report it as one.

Never edit application code, and never weaken an assertion to make a test pass.

### 6. Collect artifacts
Run this **before committing** — it reads the new specs from the working tree.

```bash
python3 .cursor/skills/playwright-pr-runner/collect-artifacts.py
```

This writes `artifacts/playwright/`:

| Path | Contents |
|------|----------|
| `summary.md` | Pass/fail feedback for the PR comment |
| `selection.json` | The scope plan this run used |
| `results.json` | Playwright JSON report (if produced) |
| `html-report/` | Playwright HTML report |
| `failures/` | Screenshots, videos, traces, `error-context.md` from failed tests |
| `new-tests/` | Sources of every spec this run wrote, plus `new-tests.patch` and `manifest.md` |

Read `artifacts/playwright/summary.md`. For each failed test, Read up to 3 failure screenshots so they attach to the Cloud Agent run.

### 7. Commit and push the new specs
Only when step 3 or 5 changed files, and only test paths:

```bash
git add e2e/tests e2e/pages e2e/fixtures
git commit -m "test(e2e): add Playwright UI coverage for <surface>"
git push origin HEAD
```

Never `git add -A` — `backend/.env` and `artifacts/` must stay out of the commit. If the push is rejected (protected branch, fork PR), keep the artifact, report the push failure in the summary, and do not retry with force.

### 8. Publish feedback
Use `artifacts/playwright/summary.md` as the body.

- Final assistant message **must** be that summary (Cloud Agent run + automation `prComment` tool).
- If `gh` can see the PR, also post it:

```bash
gh pr comment --body-file artifacts/playwright/summary.md
```

If `gh` fails, still return the summary as the final message. Do not mention secret values, `.env` contents, or credential names with values.

## Feedback rules
- **Pass** — every test in scope passed (retries that eventually passed count as pass; mention flakes).
- **Fail** — any test failed, including one this run authored, or the suite could not start. Name the test, the error, and the most likely cause (app bug vs test bug vs infrastructure).
- **Infra fail** — missing secrets, app did not boot, browsers failed to install. Do not blame product code.
- Always state what was run and why: the scope line from `summary.md` tells the reviewer whether this was a targeted, full, or smoke run.
- If a gap was left unfilled, say which surface and why.
- Do not request changes on style or coverage beyond the gaps the plan reported.

## DO NOT
- Modify application code under `frontend/` or `backend/` — this skill writes tests only
- Author API-only, backend, or Angular unit tests
- Generate tests when `mode` is `smoke` — a PR with no UI change gets no new UI tests
- Weaken or delete an assertion to turn a failure green
- Commit anything outside `e2e/`, or force-push
- Start `./run` yourself — Playwright `webServer` owns the app lifecycle
- Use `waitForTimeout` debugging or headed / UI mode
- Paste credentials, tokens, or `.env` contents into comments or artifacts
- Skip artifact collection when tests fail, or collect after committing

## Definition of Done
- [ ] `select-tests.py` ran and its plan drove the run
- [ ] Every UI coverage gap is filled by a new spec, or explained in the summary
- [ ] New specs carry a `COVERAGE_TAG`, priority tags, and cleanup
- [ ] Playwright ran with `CI=true` from `e2e/`
- [ ] `artifacts/playwright/summary.md` exists and matches the run
- [ ] HTML report, failure media, and `new-tests/` are under `artifacts/playwright/`
- [ ] New specs are committed and pushed to the PR branch, or the push failure is reported
- [ ] No application code changed
- [ ] Final message is the PR feedback summary

## Automation prompt (paste later)

When you create the Cursor Automation (trigger: pull request opened / pushed), use this as the agent prompt:

```
Follow the playwright-pr-runner skill. Resolve the Playwright scope for this pull request, write UI specs for any changed screen that has no coverage, run the related tests, collect artifacts under artifacts/playwright/, commit and push the new specs, and comment the summary on the PR. Do not change application code.
```

Enable **Comment on pull requests** and write access to the branch. In the Cloud Agent environment, set secrets `ADMIN_USERNAME`, `ADMIN_PASSWORD`, and `SESSION_SECRET` (same values as local `backend/.env`).

## Additional resources
- Coverage tags, scope rules, artifact layout, and commands: [reference.md](reference.md)
