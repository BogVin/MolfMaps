# CT-52 Playwright evidence

**Summary:** Compare two favorite maps side by side  
**Mode:** No tests added — requirements already covered by `e2e/tests/map-compare.spec.ts`  
**Outcome:** Failed (application failure)

## Failure

- Test: `@p1 Admin can select two favorites and open a side-by-side comparison`
- Classification: Application failure
- Observed: `getByRole('button', { name: 'Compare maps' })` not found after 5s
- Failed step: Reveal the Compare maps control required by CT-50
- Cause: Compare-mode UI is not implemented in the maps catalog
- Trace: `runs/map-compare-Favorite-map-c-06cb0-n-a-side-by-side-comparison-chromium/trace.zip`

## Evidence

```text
Watch:       open artifacts/playwright/CT-52/videos/
Trace:       npx playwright show-trace artifacts/playwright/CT-52/runs/.../trace.zip
Full report: npx playwright show-report artifacts/playwright/CT-52/report
```
