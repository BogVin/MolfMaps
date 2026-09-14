# CT-51 Playwright evidence

**Summary:** Organize the map catalog with favorites, filtering, and sorting  
**Mode:** No tests added — requirements already covered by `e2e/tests/maps.spec.ts`  
**Outcome:** Passed

## Requirements → tests

| Requirement | Test |
|---|---|
| Favorite / unfavorite, persist, filter, sort, search compose, result count, reset | `@p1 Visitor can favorite, filter, sort, search, reset, and keep favorites after reload` |
| Empty favorites state | `@p2 Favorites empty state appears when no maps are favorited` |

## Evidence

- Videos: `artifacts/playwright/CT-51/videos/`
- Trace/report: `artifacts/playwright/CT-51/runs/`, `artifacts/playwright/CT-51/report/`
- Log: `artifacts/playwright/CT-51/run.log`

```text
Watch:       open artifacts/playwright/CT-51/videos/
Trace:       npx playwright show-trace artifacts/playwright/CT-51/runs/<run>/trace.zip
Full report: npx playwright show-report artifacts/playwright/CT-51/report
```
