# CT-49 Playwright artifacts

**Ticket:** Organize the map catalog with favorites, filtering, and sorting  
**Outcome:** Passed

## Requirements covered

1. Favorite / unfavorite → `@p1 Visitor can favorite...`
2. Persistence across reload → `@p1 ... keep favorites after reload`
3. All / Favorites filter → `@p1` and `@p2`
4. Sort A–Z / Z–A → `@p1`
5. Compose with search → `@p1`
6. Result count → `@p1` and `@p2`
7. Reset organization → `@p1`
8. Empty favorites state → `@p2 Favorites empty state...`

## Tests

### Passing — new coverage

- `@p1 Visitor can favorite, filter, sort, search, reset, and keep favorites after reload`
  - Spec: `specs/maps.spec.ts`
  - Video: `videos/maps-favorite-filter-sort-search-reset-reload.webm`
  - Trace: `runs/maps-Map-catalog-organizat-60b68-keep-favorites-after-reload-chromium/trace.zip`
- `@p2 Favorites empty state appears when no maps are favorited`
  - Spec: `specs/maps.spec.ts`
  - Video: `videos/maps-favorites-empty-state.webm`
  - Trace: `runs/maps-Map-catalog-organizat-9ec3f--when-no-maps-are-favorited-chromium/trace.zip`

## How to view

```
Watch:       open artifacts/playwright/CT-49/videos/<test>.webm
Trace:       npx playwright show-trace artifacts/playwright/CT-49/runs/<run>/trace.zip
Full report: npx playwright show-report artifacts/playwright/CT-49/report
Steps:       artifacts/playwright/CT-49/run.log
```
