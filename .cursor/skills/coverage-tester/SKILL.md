---
name: coverage-tester
description: Measures test coverage, finds risky gaps, and adds new tests that match existing pytest, Vitest, and Playwright style. Invoke only via the coverage-tester command or by naming this skill.
disable-model-invocation: true
---

# Coverage Tester

Measure coverage (or scan behavior gaps), then add tests that copy the nearest existing MolfMaps test file. Follow Constitution Principle V: cover silently-breaking paths; do not pad trivial code.

## When to Use
Do not apply this skill unless the user explicitly invoked it (slash command, `@coverage-tester`, or “use the coverage tester”).
- User ran the coverage-tester command
- User named this skill in the prompt

## Stacks

| Layer | Where | How to run | Style to copy |
|-------|-------|------------|----------------|
| Backend | `backend/tests/test_*.py` | venv + `python -m pytest` from `backend/` | `test_*` functions, `conftest.py` fixtures, FastAPI `TestClient` |
| Frontend | `frontend/src/**/*.spec.ts` beside source | `npx vitest run` from `frontend/` | vitest `describe` / `it` / `expect` |
| E2E | `e2e/tests/*.spec.ts` | Playwright from `e2e/` | page objects, fixtures, `test.step`, `@p1` on critical flows |

Extend an existing sibling test file when one exists. Create a new file only when that is already the repo convention for that unit.

## Workflow

### 1. Scope
Use the user’s path, or `git diff` plus the current feature under `specs/`.

### 2. Measure
From `backend/` with venv: `python -m pytest --cov=app --cov-report=term-missing`. If `pytest-cov` is missing, run pytest and map `backend/app/` public behavior to `backend/tests/`. Do not add coverage packages unless asked.

From `frontend/`: `npx vitest run --coverage`. If the provider is missing, run vitest and map exports to colocated `*.spec.ts`. Do not add `@vitest/coverage-v8` unless asked.

Do not use Playwright for line coverage. Add E2E only for uncovered user-facing auth/write flows that similar files in `e2e/tests/` already pattern, or when the user asked for E2E.

### 3. Classify gaps
**Must cover:** auth/session, validation that fails silently, persistence/cascade, non-obvious helpers (clamp, zoom, typeface fallback).

**Skip:** trivial getters, template-only UI, hover/touch already in `quickstart.md`, cases already asserted nearby.

### 4. Match style, then add tests
Clone imports, fixtures, names, and assertion style from the closest test file. Reuse `configured_client` / `admin_client` / `make_map` and existing page objects. AAA, one behavior per test, no sleeps, no new hardcoded secrets.

### 5. Verify
Re-run the suite you touched until it passes. Confirm targeted gaps are gone.

## Output Format
1. **Coverage snapshot** — command and % or “manual gap scan”
2. **Gaps closed** — file + behavior
3. **Gaps skipped** — with reason
4. **Commands run** — pass/fail

## DO NOT
- Test private implementation details
- Invent a different framework or naming style
- Exhaustively test presentation-only templates
- Add coverage dependencies unasked
- Leave failing tests

## Definition of Done
- [ ] Coverage measured or gap scan completed
- [ ] New tests match nearest existing style
- [ ] Only Principle V gaps were added
- [ ] Relevant suite passes
- [ ] Results reported in the output format
