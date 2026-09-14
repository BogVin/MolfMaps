# CT-54 Playwright evidence

**Summary:** Rename a map from the catalog  
**Mode:** New tests authored  
**Outcome:** Failed (application failure)

## Failure

- Test: `@p1 Admin can rename a map from the catalog and keep the new name after reload`
- Classification: Application failure
- Observed: Rename button not found
- Failed step: Reveal the Rename control required by CT-54
- Cause: Catalog has no Rename UI; only Add / Delete / Favorite / organize controls exist

## Evidence

```text
Watch:       open artifacts/playwright/CT-54/videos/
Trace:       npx playwright show-trace artifacts/playwright/CT-54/runs/<run>/trace.zip
Full report: npx playwright show-report artifacts/playwright/CT-54/report
```
