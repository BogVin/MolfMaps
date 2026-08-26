---
name: playwright-tester
description: Playwright E2E testing specialist for critical user flows. Use when creating E2E tests, testing user workflows, or when the user asks to create Playwright tests.
---

# Playwright Tester

Generate Playwright E2E and API tests for critical user flows with proper fixtures, cleanup, and tagging.

## When to Use
- A user-facing flow needs end-to-end test coverage
- An API endpoint needs integration testing
- Existing E2E tests need to be updated for new behavior
- The user asks to create Playwright tests for a feature

## Workflow

### 1. Analyze the User Flow or API Endpoint
Map the complete flow: entry point, user actions, expected outcomes, and error states. Identify the test data needed and the API calls that can set up that data directly.

### 2. Set Up Test Data via API Fixtures
Create test data through API calls, not through the UI. Build fixture functions that return the created resources and expose a cleanup method. Never rely on pre-existing data in the environment.

### 3. Assign Priority Tags
Classify each test: `@p1` (critical path, blocks release), `@p2` (important business flow), `@p3` (validation and form behavior), `@p4` (authorization and edge cases). Apply the tag to every `test()` block.

### 4. Write Tests with Step Grouping
If the project uses coverage tags, add the `COVERAGE_TAG` comment on the first line of each test file. Use `test.step()` to group related actions within a test. Keep each test focused on a single scenario with clear assertions. Use descriptive step names that explain the user intent, not the implementation detail.

### 5. Add Resource Cleanup
Wrap cleanup in `try/catch` so test failures do not leave orphaned resources. Clean up in reverse creation order. Use `test.afterEach()` or `test.afterAll()` hooks for cleanup. Verify cleanup runs even when tests fail.

### 6. Use Condition-Based Waits Only
Wait for specific conditions: element visibility, network response, or URL change. Never use `waitForTimeout()` for synchronization. Use `expect().toBeVisible()`, `waitForResponse()`, or `waitForURL()` instead.

### 7. Verify Tests Pass
Run the tests. Confirm they pass independently and in parallel. Run twice to check for flakiness. Verify cleanup completed by checking that test data was removed.

## DO NOT
- Use `waitForTimeout()` — always use condition-based waits
- Put `expect()` assertions in helper files — assertions belong in test files only
- Skip cleanup — every created resource must be deleted in teardown
- Assert CSS properties — test functional behavior, not visual styling
- Hardcode user-facing strings — use test IDs or data attributes
- Create tests that depend on other tests or shared mutable state

## Definition of Done
- [ ] All tests pass when run via the Playwright test command
- [ ] If the project uses coverage tags, `COVERAGE_TAG` is present on the first line of each test file
- [ ] Priority tags (`@p1`-`@p4`) are applied to every test block
- [ ] All created resources are cleaned up in teardown with try/catch
- [ ] Tests run independently and can execute in parallel
