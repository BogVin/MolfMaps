---
name: orchestrator
description: Workflow orchestrator for autonomous multi-agent development. Use when coordinating complex features across planning, development, testing, and review phases, or when the user asks to orchestrate a full feature workflow.
---

# Orchestrator

Coordinate full feature development through sequential phases with quality gates between each.

## When to Use
- A complete feature needs planning, implementation, testing, and review
- The user wants an end-to-end autonomous workflow
- Multiple skills need to be coordinated in sequence
- A complex task would benefit from structured phased execution

## Workflow

### Phase 1: Plan (invoke 'planner' skill)
Analyze requirements and break the feature into atomic tasks. Each task should touch 1-3 files with clear dependencies mapped.
Take into account the implementation details attached to the requirements if any. 
**Quality Gate:** Tasks are atomic, dependencies are mapped, risks are documented. Do not proceed if tasks are too broad or dependencies are missing.

### Approval Gate (after Phase 1, before Phase 2)
**Stop here and wait for the user.** This gate is mandatory and cannot be skipped or auto-approved.

1. Present the plan for review: the ordered task list (files, dependencies, pattern references), key design decisions, documented risks with mitigations, the testing strategy, and which of Phases 2-8 are expected to run or be skipped with justification.
2. Ask the user to approve the plan, request changes, or cancel the run.
3. Wait for an explicit response. Do not start Phase 2 while waiting, and do not treat silence, a plan-clarifying question, or general acknowledgement as approval.

**Decision:**
- **Approved** — proceed to Phase 2 with the plan as presented.
- **Changes requested** — re-invoke the `planner` skill with the feedback, then return to this gate with the revised plan. Repeat until approved or cancelled.
- **Cancelled** — halt and generate the execution summary with Phase 1 complete and Phases 2-8 marked as not run.

### Phase 2: Develop (invoke 'developer' skill)
Execute each task from the plan in dependency order. After each task, verify the project builds and lints.
**Quality Gate:** Project builds without errors, linter passes. Do not proceed if build is broken.

### Phase 3: Unit Test (invoke 'unit tester' skill)
Write unit tests for all new business logic. Target at least 80% coverage on new code.
**Quality Gate:** All tests pass, coverage target met. Do not proceed if tests fail.

### E2E Detection Gate (before Phases 4-6)
Before entering E2E phases, check the project for a Playwright marker across the supported stacks. The project may be JS/TS, .NET, or Java — check each accordingly.

**JS / TypeScript / Node**
1. `playwright.config.ts`, `playwright.config.js`, or `playwright.config.mjs` in the project root or common subdirectories.
2. `@playwright/test` listed in `package.json` `dependencies` or `devDependencies` (root and any workspace packages).

**.NET**
1. Any `.csproj` file containing a `<PackageReference>` for `Microsoft.Playwright`, `Microsoft.Playwright.NUnit`, `Microsoft.Playwright.MSTest`, or `Microsoft.Playwright.Xunit`.

**Java**
1. `pom.xml` declaring the `com.microsoft.playwright:playwright` dependency (Maven).
2. `build.gradle` or `build.gradle.kts` referencing `com.microsoft.playwright:playwright` (Gradle).

**Decision:**
- If **at least one** marker is found in any stack: proceed to Phase 4 and evaluate the content-based skip conditions below.
- If **no** markers are found across all stacks: skip Phases 4, 5, and 6 entirely. Log the justification in the execution summary (e.g., "Phases 4-6 skipped: no Playwright configuration detected in JS/.NET/Java").

Important: If Playwright is not present, check whether other E2E frameworks are present (e.g., Selenium, Cypress, TestCafe). Note the framework in the execution summary; do not auto-invoke the Playwright-specific phases for non-Playwright stacks.

### Phase 4: E2E Test ( invoke 'playwright-tester' skill)
Write Playwright tests for user-facing flows introduced by the feature. Skip this phase if the E2E Detection Gate found no Playwright presence, or if the changes are internal-only with no UI/API surface.
**Quality Gate:** All E2E tests pass, cleanup verified.

### Phase 5: E2E Review (invoke 'playwright-reviewer' skill)
Review the E2E tests for patterns compliance. Skip this phase if Phase 4 was skipped.
**Quality Gate:** No critical findings, all patterns followed.

### Phase 6: Test Iteration (invoke 'test-iterator' skill)
Run all E2E tests, diagnose failures, apply fixes, and retry until passing. **This phase runs by default.** The user opts out only by explicitly stating so in the orchestrator invocation (e.g., "skip test iteration", "no test iteration").
**Quality Gate:** All E2E tests pass after iteration. If max retries are reached without success, report failures and halt.

### Phase 7: Code Review (invoke @code-reviewer agent)
Review all changes for quality, patterns compliance, and security.
**Quality Gate:** No critical issues. Important issues should be addressed before proceeding.

### Phase 8: Security Audit (invoke @security-analyst agent)
Audit all changes against OWASP Top 10. Skip this phase for test-only changes with no production code.
**Quality Gate:** No critical vulnerabilities. High-severity issues must be addressed.

### Final: Generate Execution Summary
Produce a summary listing each phase, its status (passed/skipped/failed), findings count, and any items that need follow-up.

## Skip Conditions

All phases run by default. Users opt out by stating it explicitly at orchestrator invocation. Auto-skip happens only for the conditions below. The Approval Gate after Phase 1 is never skipped, even when the user asks for a fully autonomous run.

- **Skip E2E (Phases 4-6) — project detection:** No Playwright marker found in any supported stack — no `playwright.config.*` or `@playwright/test` (JS/TS), no `Microsoft.Playwright*` `<PackageReference>` in any `.csproj` (.NET), and no `com.microsoft.playwright:playwright` in `pom.xml` / `build.gradle*` (Java). Checked automatically by the E2E Detection Gate before Phase 4.
- **Skip E2E (Phases 4-6) — content-based:** Internal-only features, background jobs, database migrations, or changes with no UI/API surface (even when Playwright is present in the project).
- **Auto-skip Test Iteration (Phase 6):** When E2E phases (4-5) were skipped for any reason, or when the user explicitly opts out at invocation.
- **Skip Security (Phase 8):** Test-only changes, documentation updates, or style/formatting changes.

## DO NOT
- Start Phase 2 before the user has explicitly approved the Phase 1 plan
- Skip phases without documenting the justification
- Skip Test Iteration silently — if the user did not opt out and E2E phases ran, this phase must execute
- Proceed past a failed quality gate — fix the issue first
- Run all 8 phases when the scope is trivial (use judgment to skip where appropriate)
- Execute tasks out of dependency order
- Combine multiple plan tasks into a single development step

## Definition of Done
- [ ] Phase 1 plan was presented and explicitly approved by the user before Phase 2 began
- [ ] All included phases completed with quality gates passed
- [ ] All tests passing (unit and E2E where applicable)
- [ ] No critical code review issues or security vulnerabilities remain
- [ ] Execution summary generated with phase-by-phase status
- [ ] Skipped phases have documented justification
