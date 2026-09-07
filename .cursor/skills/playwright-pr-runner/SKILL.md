---
name: playwright-pr-runner
description: Runs the Playwright UI tests related to a pull request, writes new UI specs when a changed screen has no coverage, publishes a watchable video/trace artifact of every new test, and posts pass/fail feedback. Use when a Cloud Agent is triggered on a pull request, when asked to run Playwright or e2e tests and give feedback, or when producing a Playwright test artifact for a PR.
---

# Playwright PR Runner

Run the Playwright specs related to a pull request. When the PR changes a screen no spec covers, write that spec, run it with full capture so a reviewer can watch it work, publish that as an artifact, and commit it to the PR branch. Never change application code.

## When to Use
- A Cloud Agent is running because a pull request was opened or updated
- The user or automation asks to run Playwright / e2e tests and give feedback
- A PR needs a Playwright artifact (HTML report, videos, traces, failure screenshots)

## Scope: UI only
Only `frontend/src/**` counts as a UI surface. A PR that touches no UI file gets a `@p1` smoke run and no new tests.

Never author API-only or backend specs. A UI test may call the API through `e2e/fixtures/` to set up or verify data, but the browser flow must be the subject of the test.

## 1. Find the scope
```bash
BASE=$(gh pr view --json baseRefName -q .baseRefName 2>/dev/null || echo main)
git diff --name-only "origin/$BASE...HEAD"
ls e2e/tests
```

Read the spec files — there are only a few and they are short. Then decide, for each changed screen:

| What changed | What to run |
|---|---|
| A screen an existing spec covers | Just those specs |
| A screen no spec covers | Write the spec, then run it |
| Shared e2e scaffolding (`e2e/playwright.config.ts`, `e2e/pages/**`, `e2e/fixtures/**`) or app-wide UI (`frontend/src/app/app.*`, global styles) | The whole suite |
| Nothing under `frontend/src/**` | `--grep @p1`, and write nothing |

Screens are the route components in `frontend/src/app/app.routes.ts`: `home`, `login`, `maps` (catalog), and `maps/:id` (`map-view`). Say in the summary which of these the PR touched and which spec covers each.

## 2. Prepare the environment
Playwright starts `./run` itself (`e2e/playwright.config.ts` `webServer`). Do not start backend/frontend separately.

```bash
test -f backend/.env || cp backend/.env.example backend/.env
cd e2e && npm ci && npx playwright install --with-deps chromium
```

`ADMIN_USERNAME` and `ADMIN_PASSWORD` must come from Cloud Agent secrets or `backend/.env`. If either is missing after setup, stop and report an infrastructure failure — do not invent credentials.

## 3. Write the missing specs
Skip this entirely when every changed screen is already covered, or when no UI changed.

Read the changed components and their templates first, then follow the `playwright-tester` skill and `.cursor/rules/playwright-testing.mdc`. On top of those:

- One spec per screen: `e2e/tests/<screen>.spec.ts`. Extend the existing file when one already covers part of that screen.
- Reuse `e2e/pages/` page objects and add new ones there — no locators inline in specs. Credentials come from `e2e/fixtures/credentials.ts`, never hardcoded.
- The app ships no `data-testid`, so locate by role and label as the existing page objects do.
- Cover the happy path plus at least one failure or edge case, roughly 3-6 tests per screen. Tag every test `@p1`-`@p4`.
- Condition-based waits only. Clean up anything the test creates in `afterEach`/`afterAll` inside `try/catch`.
- Wrap each meaningful action in `test.step()` with a reviewer-readable title. Those titles become the trace timeline, the run log, and the caption burnt into the video, so they are how the test explains itself to a human.

## 4. Run the tests in scope
From `e2e/`, with `CI=true` so retries, workers, and `webServer.reuseExistingServer` match CI:

```bash
cd e2e
CI=true PLAYWRIGHT_HTML_OPEN=never \
  npx playwright test <spec paths, or --grep @p1, or nothing for the full suite> \
  --reporter=list --reporter=html
```

Leave out the specs you just wrote — step 5 runs those, so nothing runs twice. Capture the exit code. A non-zero exit is never a reason to skip artifact collection.

First-run timeout is high: `webServer` may create the backend venv and install frontend deps (up to 240s before tests start).

## 5. Run the new specs with full capture
Skip when this run wrote nothing.

The point of this second invocation is evidence. The shared config keeps video, screenshots, and traces **only on failure**, so a passing new test would leave a reviewer nothing to look at. `e2e/playwright.capture.config.ts` forces all three on for every outcome and writes to its own report and output directories, so it cannot clobber step 4.

```bash
cd e2e
mkdir -p ../artifacts/playwright/new-tests
set -o pipefail
CI=true PLAYWRIGHT_HTML_OPEN=never PLAYWRIGHT_LIST_PRINT_STEPS=1 \
  npx playwright test tests/<new>.spec.ts --config=playwright.capture.config.ts \
  2>&1 | tee ../artifacts/playwright/new-tests/run.log
```

`PLAYWRIGHT_LIST_PRINT_STEPS=1` prints every `test.step` title, which makes `run.log` a readable walkthrough of what each test did. Keep the log outside `test-results-new/` — Playwright wipes that directory when a run starts, so a log written into it disappears. These results count toward the PR verdict exactly like any other test.

There are no `--video` or `--screenshot` CLI flags — that is why this step uses a config file rather than flags.

The capture config also paces and captions the recording, because a raw Playwright video is unwatchable: with no think-time between actions, a login flow finishes in about three seconds. It holds each input action on screen for a second while highlighting the target element and naming the call, draws a cursor that travels between actions, overlays the current `test.step()` title, and records at the full 1280x720 viewport instead of the 800x450 Playwright would otherwise scale down to. That padding is charged to the test timeout, which is why the capture config raises it — expect these runs to take noticeably longer than step 4, and never point the capture config at the whole suite.

## 6. Triage failures in specs you just wrote
A test you authored carries the same verdict weight as any other, so a bad locator would fail the PR for no reason. For each failure in a new spec, open its trace, screenshot, and the component source, then decide:

- **Test bug** (wrong locator, wrong copy, missing wait) — fix the spec and re-run step 5. At most **2** fix attempts, then leave it failing and say so.
- **App bug** — leave the test failing. That is a real finding; report it as one.

Never edit application code, and never weaken an assertion to make a test pass.

## 7. Collect artifacts
Run this **before committing**, so the new specs are read from the working tree.

```bash
mkdir -p artifacts/playwright
cp -R e2e/playwright-report artifacts/playwright/html-report
cp -R e2e/test-results artifacts/playwright/test-results
```

If this run wrote any spec, publish those tests as their own bundle — the code *and* the recording of it running:

```bash
mkdir -p artifacts/playwright/new-tests/specs
cp e2e/tests/<new>.spec.ts e2e/pages/<new>.page.ts artifacts/playwright/new-tests/specs/
cp -R e2e/playwright-report-new artifacts/playwright/new-tests/report
cp -R e2e/test-results-new artifacts/playwright/new-tests/runs
```

`runs/` holds one directory per test with `video.webm`, `trace.zip`, and an end-of-test screenshot — for passing and failing tests alike. `run.log` is already in place from step 5.

`report/` embeds those same files under hashed names, so the bundle carries each recording twice — roughly 6 MB per test all in. That is deliberate: `runs/` files open in anything, while `report/` is the richer view but needs `npx playwright show-report` to render. If a PR ever authors enough tests for the size to matter, drop `runs/` and keep the report plus `videos/`.

Playwright names its output directories after the test but truncates them with a hash. Copy each video out under a name a reviewer can read, because that filename is what appears in the PR description:

```bash
mkdir -p artifacts/playwright/new-tests/videos
cp e2e/test-results-new/<playwright-dir>/video.webm \
   artifacts/playwright/new-tests/videos/<screen>-<short-test-title>.webm
```

Then write `artifacts/playwright/new-tests/README.md` so a human can act on it without hunting through directories. Lead with how to view things:

```
Watch a test:   open new-tests/videos/<screen>-<short-test-title>.webm
Step through:   npx playwright show-trace new-tests/runs/<test-dir>/trace.zip
Everything:     npx playwright show-report new-tests/report
Read the steps: new-tests/run.log
```

Then list every new test with its title, its result, one line on what it proves, and the path to its video and trace. Group them honestly:

- **Passing — new coverage.** The video shows the flow this PR now has locked down.
- **Failing — found a bug.** The app is wrong, not the test. Point at the step in the trace where it diverges; that is the bug report.
- **Failing — unresolved.** You could not get it working in 2 attempts. Say what is unresolved instead of presenting it as coverage.

Write `artifacts/playwright/summary.md` for the PR comment: scope from step 1, what ran, pass/fail counts, each failure with its likely cause, and the new-test grouping above. Read up to 3 failure screenshots so they attach to the Cloud Agent run.

### Where these artifacts end up
`artifacts/` at the repo root is the Cloud Agent artifact directory, which is why everything above is written there. Files placed in it are uploaded off the VM and outlive the run; the rest of the workspace is recycled once the run goes idle. With **Allow posting artifacts to GitHub** enabled in the Cloud Agents dashboard, Cursor embeds them into the PR description using long unguessable URLs that need no login, so a reviewer opens them straight from the PR. Without that setting the artifacts are still stored, but only reachable through the agent run — which requires a Cursor account with access to this repo — or through the Cloud Agents API.

Two constraints come with that:

- **Never commit artifacts into the repo.** A committed video stays in git history forever, even after a later cleanup commit deletes the file. `artifacts/` is gitignored; keep it that way.
- If the environment uses restricted network egress, allowlist `cloud-agent-artifacts.s3.us-east-1.amazonaws.com` exactly. Without it the upload fails while the rest of the run looks fine. Do not widen it to `*.s3.us-east-1.amazonaws.com`.

Cursor documents this embedding for screenshots, videos, and log references. Whether a `trace.zip` or the multi-file `report/` directory is served the same way is **not** documented — check the first real run. If they do not appear in the description, treat the videos, screenshots, and `run.log` as the reviewer-facing artifacts and leave the trace and report for whoever opens the run itself.

## 8. Commit and push the new specs
Only when step 3 or 6 changed files, and only test paths:

```bash
git add e2e/tests e2e/pages e2e/fixtures
git commit -m "test(e2e): add Playwright UI coverage for <screen>"
git push origin HEAD
```

Never `git add -A` — `backend/.env`, `artifacts/`, and the `test-results-new/` / `playwright-report-new/` scratch dirs must stay out of the commit. If the push is rejected (protected branch, fork PR), keep the artifact, report the push failure in the summary, and do not retry with force.

## 9. Publish feedback
Use `artifacts/playwright/summary.md` as the body.

- Final assistant message **must** be that summary (Cloud Agent run + automation `prComment` tool).
- When this run wrote tests, name each new test with its result **and the exact artifact filename** for its video. Cursor attaches the artifacts to the PR description on its own; your job is to give the reviewer the mapping from test name to file, so the embedded media is identifiable.
- Do not rewrite the PR description yourself. The artifact links land there through the dashboard setting, and hand-editing the body risks clobbering them.
- If `gh` can see the PR, also post it: `gh pr comment --body-file artifacts/playwright/summary.md`. If `gh` fails, still return the summary as the final message.
- Never mention secret values or `.env` contents.

## Feedback rules
- **Pass** — every test in scope passed (retries that eventually passed count as pass; mention flakes).
- **Fail** — any test failed, including one this run authored, or the suite could not start. Name the test, the error, and the likely cause (app bug vs test bug vs infrastructure).
- **Infra fail** — missing secrets, app did not boot, browsers failed to install. Do not blame product code.
- Always state what was run and why, and name any screen you left uncovered.
- Do not request changes on style or on coverage beyond the screens this PR changed.

## DO NOT
- Modify application code under `frontend/` or `backend/` — this skill writes tests only
- Author API-only, backend, or Angular unit tests
- Write UI tests for a PR that changed no `frontend/src/**` file
- Ship a new test without its video and trace — the code alone is not the artifact
- Commit anything from `artifacts/` into the repo; binaries in git history are permanent
- Run the capture config against the whole suite; it is for newly written specs only
- Weaken or delete an assertion to turn a failure green
- Commit anything outside `e2e/`, or force-push
- Start `./run` yourself — Playwright `webServer` owns the app lifecycle
- Use `waitForTimeout` debugging or headed / UI mode
- Paste credentials, tokens, or `.env` contents into comments or artifacts
- Skip artifact collection when tests fail, or collect after committing

## Definition of Done
- [ ] Scope came from the PR diff and is stated in the summary
- [ ] Every changed screen is covered by a spec, or the gap is explained
- [ ] New specs carry priority tags, `test.step()` titles, and cleanup
- [ ] Playwright ran with `CI=true` from `e2e/`
- [ ] HTML report and failure media are under `artifacts/playwright/`
- [ ] Every new test has a video and a trace under `new-tests/`, passing ones included
- [ ] Each video is named after its test, so the PR description is readable
- [ ] `new-tests/README.md` lists each new test, its result, and how to view it
- [ ] Artifacts live under `artifacts/` and none of them were committed
- [ ] New specs are committed and pushed to the PR branch, or the push failure is reported
- [ ] No application code changed
- [ ] Final message is the PR feedback summary

## Automation prompt

When you create the Cursor Automation (trigger: pull request opened / pushed), use this as the agent prompt:

```
Follow the playwright-pr-runner skill. Run the Playwright UI tests related to this pull request, write UI specs for any changed screen that has no coverage, run those new specs through playwright.capture.config.ts so each one has a video and trace, collect artifacts under artifacts/playwright/ including the new-tests bundle, commit and push the new specs, and comment the summary on the PR. Do not change application code, and do not commit artifacts.
```

Dashboard settings this skill depends on:

- **Comment on pull requests**, plus write access to the branch, so new specs can be pushed.
- **Allow posting artifacts to GitHub** — without it, nothing from `artifacts/` reaches the PR description and the videos are only visible to whoever opens the agent run.
- If egress is restricted, allowlist `cloud-agent-artifacts.s3.us-east-1.amazonaws.com`.

In the Cloud Agent environment, set secrets `ADMIN_USERNAME`, `ADMIN_PASSWORD`, and `SESSION_SECRET` (same values as local `backend/.env`). Prefer Runtime Secrets so the values are redacted from the transcript and from anything the agent commits.
