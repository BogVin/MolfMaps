# CT-50 Playwright artifacts

**Ticket:** Compare two favorite maps side by side  
**Outcome:** Failed

## Requirements covered by the new test

1. Enter compare mode from Favorites when at least two maps are favorited
2. Select exactly two favorites for comparison
3. Open a side-by-side comparison view
4. Return to `/maps` with Favorites and selection preserved

## Tests

### Failing — application failure

- `@p1 Admin can select two favorites and open a side-by-side comparison`
  - Spec: `specs/map-compare.spec.ts`
  - Video: `videos/maps-compare-two-favorites.webm`
  - Trace: `runs/map-compare-Favorite-map-c-06cb0-n-a-side-by-side-comparison-chromium/trace.zip`
  - Screenshot: `runs/map-compare-Favorite-map-c-06cb0-n-a-side-by-side-comparison-chromium/test-failed-1.png`
  - Failed step: `Reveal the Compare maps control required by CT-50`
  - Observed: `getByRole('button', { name: 'Compare maps' })` not found after favoriting three maps and switching to Favorites
  - Cause: Application failure — CT-50 comparison UI is intentionally unimplemented; favorites/filter from CT-49 work, but no Compare maps control exists

## How to view

```
Watch:       open artifacts/playwright/CT-50/videos/maps-compare-two-favorites.webm
Trace:       npx playwright show-trace artifacts/playwright/CT-50/runs/map-compare-Favorite-map-c-06cb0-n-a-side-by-side-comparison-chromium/trace.zip
Full report: npx playwright show-report artifacts/playwright/CT-50/report
Steps:       artifacts/playwright/CT-50/run.log
```
