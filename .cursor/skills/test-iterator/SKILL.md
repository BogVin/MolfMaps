---
name: test-iterator
description: Autonomous test iteration specialist that runs, diagnoses, fixes, and retries failing tests. Use when bootstrapping and iterating on test failures, running tests autonomously until they pass, or when the user asks to fix failing tests.
---

# Test Iterator

Run E2E tests, diagnose failures, apply targeted fixes, and retry until all tests pass or are quarantined.

## When to Use
- E2E tests are failing and need autonomous diagnosis and fixing
- A dev server needs to be started and tests run against it
- The user wants tests run, fixed, and retried without manual intervention
- Failing tests need to be triaged as real bugs vs. flaky tests

## Workflow

### Phase 0: Bootstrap
Create a git checkpoint (`git stash` or tag) for rollback. Verify environment prerequisites (dependencies installed, environment config files present, ports available). Install dependencies if needed. Allocate a port for the dev server if running locally.

### Phase 1: Start Application
Start the dev server in the background. Wait for the health check endpoint to respond (poll with timeout). If the server fails to start, check logs and report the error — do not proceed.

### Phase 2: Smoke Test
Run a quick HTTP check against the running application to verify it is responding. Validate authentication is working if tests require it. If smoke test fails, diagnose and fix before running the full suite.

### Phase 3: Run Tests
Determine test scope: if running `targeted`, diff the current branch against main to find changed files and run related tests. If explicit files are provided, run those. If `full`, run the entire suite. Capture stdout, stderr, and any trace/report output.

### Phase 4: Analyze Failures
For each failing test, collect: error message, stack trace, screenshot (if available), and recent code changes. Classify failures as: app bug (production code is wrong), test bug (test code is wrong), flaky (intermittent, non-deterministic), or infrastructure (auth, network, environment). Use multiple signals — do not rely on error message alone.

### Phase 5: Fix
For app bugs, invoke @developer to fix the production code. For test bugs, invoke @playwright-tester to fix the test code. For flaky tests, retry first before attempting a fix. For infrastructure issues, report and stop — do not attempt to fix auth or environment problems.

### Phase 6: Reload/Restart
If source code changed, check if the running application picks up changes automatically (e.g., HMR, `dotnet watch`, or similar auto-reload). For auto-reloading servers, wait for the reload to complete. For config or dependency changes, do a full server restart. Verify the health check passes after reload.

### Phase 7: Report
Generate a session report: total tests, passed, failed, flaky, quarantined. List files modified during the session. Include a rollback command (`git stash pop` or `git checkout <tag>`). Note any tests quarantined and the reason.

### Phase 8: Cleanup
Stop the dev server process. Verify the port is released. Leave the git checkpoint in place for potential rollback.

## Retry Policy
- Maximum 3 retry cycles for any single test
- Flaky test retries (same test passes on re-run) do not count toward the retry limit
- Selector-only fixes (updating a locator) do not count toward the retry limit
- After 2 consecutive failures with different errors, quarantine the test and move on
- After 2 consecutive failures with the same error, attempt one fix then quarantine if it fails again

## DO NOT
- Burn retries on flaky tests — if a test passes on re-run, mark it flaky and continue
- Skip cleanup — always stop the dev server, even if tests fail
- Attempt to fix authentication infrastructure bugs — report them and stop
- Apply fixes without understanding the root cause
- Continue iterating after 3 failed fix attempts for the same test

## Definition of Done
- [ ] All tests are passing or quarantined with documented justification
- [ ] Session report is generated with pass/fail counts, files modified, and rollback command
- [ ] Dev server is stopped and port is released
- [ ] Git rollback checkpoint is available
- [ ] Any quarantined tests have clear next-step recommendations
