# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: map-compare.spec.ts >> Favorite map comparison >> @p1 Admin can select two favorites and open a side-by-side comparison
- Location: tests/map-compare.spec.ts:58:7

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByRole('button', { name: 'Compare maps' })
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 5000ms
  - waiting for getByRole('button', { name: 'Compare maps' })

```

```yaml
- banner:
  - link "MolfMaps":
    - /url: /
  - navigation "Session":
    - link "Login":
      - /url: /login
- main:
  - heading "Maps" [level=1]
  - region "Organize maps":
    - text: Search maps
    - searchbox "Search maps"
    - group "Filter maps":
      - button "All maps"
      - button "Favorites" [pressed]
    - group "Sort maps":
      - button "Sort A–Z" [pressed]
      - button "Sort Z–A"
    - button "Reset"
    - status: Showing 3 of 4 maps
  - list:
    - listitem:
      - link "Alpine Ridge":
        - /url: /maps/cccccccccccccccccccccccccccccccc
      - button "Unfavorite Alpine Ridge" [pressed]: Favorited
    - listitem:
      - link "Coastal Watch":
        - /url: /maps/dddddddddddddddddddddddddddddddd
      - button "Unfavorite Coastal Watch" [pressed]: Favorited
    - listitem:
      - link "Mountain Pass":
        - /url: /maps/bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb
      - button "Unfavorite Mountain Pass" [pressed]: Favorited
```

# Test source

```ts
  1   | import { expect, test, type Page } from '@playwright/test';
  2   | 
  3   | import { MapsPage } from '../pages/maps.page';
  4   | 
  5   | const CATALOG = [
  6   |   {
  7   |     id: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
  8   |     name: 'Kal Main Map',
  9   |     image_url: '/api/maps/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/image',
  10  |   },
  11  |   {
  12  |     id: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
  13  |     name: 'Mountain Pass',
  14  |     image_url: '/api/maps/bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb/image',
  15  |   },
  16  |   {
  17  |     id: 'cccccccccccccccccccccccccccccccc',
  18  |     name: 'Alpine Ridge',
  19  |     image_url: '/api/maps/cccccccccccccccccccccccccccccccc/image',
  20  |   },
  21  |   {
  22  |     id: 'dddddddddddddddddddddddddddddddd',
  23  |     name: 'Coastal Watch',
  24  |     image_url: '/api/maps/dddddddddddddddddddddddddddddddd/image',
  25  |   },
  26  | ];
  27  | 
  28  | async function installCatalogStub(page: Page): Promise<void> {
  29  |   await page.route('**/api/maps', async (route) => {
  30  |     if (route.request().method() !== 'GET') {
  31  |       await route.continue();
  32  |       return;
  33  |     }
  34  |     await route.fulfill({
  35  |       status: 200,
  36  |       contentType: 'application/json',
  37  |       body: JSON.stringify({ maps: CATALOG }),
  38  |     });
  39  |   });
  40  | }
  41  | 
  42  | async function clearStoredFavorites(page: Page): Promise<void> {
  43  |   await page.goto('/maps');
  44  |   await page.evaluate(() => {
  45  |     window.localStorage.removeItem('molfmaps.catalog.favorites');
  46  |   });
  47  | }
  48  | 
  49  | test.describe('Favorite map comparison', () => {
  50  |   let mapsPage: MapsPage;
  51  | 
  52  |   test.beforeEach(async ({ page }) => {
  53  |     mapsPage = new MapsPage(page);
  54  |     await installCatalogStub(page);
  55  |     await clearStoredFavorites(page);
  56  |   });
  57  | 
  58  |   test('@p1 Admin can select two favorites and open a side-by-side comparison', async ({
  59  |     page,
  60  |   }) => {
  61  |     await test.step('Open the catalog and favorite three maps', async () => {
  62  |       await mapsPage.goto();
  63  |       await mapsPage.favorite('Alpine Ridge');
  64  |       await mapsPage.favorite('Coastal Watch');
  65  |       await mapsPage.favorite('Mountain Pass');
  66  |       await expect(mapsPage.unfavoriteButton('Alpine Ridge')).toBeVisible();
  67  |       await expect(mapsPage.unfavoriteButton('Coastal Watch')).toBeVisible();
  68  |       await expect(mapsPage.unfavoriteButton('Mountain Pass')).toBeVisible();
  69  |     });
  70  | 
  71  |     await test.step('Switch to Favorites so compare mode can appear', async () => {
  72  |       await mapsPage.showFavorites();
  73  |       await expect(mapsPage.favoritesFilter).toHaveAttribute('aria-pressed', 'true');
  74  |       await expect(mapsPage.resultCount).toHaveText('Showing 3 of 4 maps');
  75  |       await expect(await mapsPage.visibleMapNames()).toEqual([
  76  |         'Alpine Ridge',
  77  |         'Coastal Watch',
  78  |         'Mountain Pass',
  79  |       ]);
  80  |     });
  81  | 
  82  |     await test.step('Reveal the Compare maps control required by CT-50', async () => {
  83  |       // Intentionally unimplemented feature: this control does not exist yet.
> 84  |       await expect(page.getByRole('button', { name: 'Compare maps' })).toBeVisible();
      |                                                                        ^ Error: expect(locator).toBeVisible() failed
  85  |     });
  86  | 
  87  |     await test.step('Select exactly two favorites for comparison', async () => {
  88  |       await page.getByRole('button', { name: 'Compare maps' }).click();
  89  |       await page.getByRole('button', { name: 'Select Alpine Ridge for compare' }).click();
  90  |       await page.getByRole('button', { name: 'Select Coastal Watch for compare' }).click();
  91  |       await expect(
  92  |         page.getByRole('button', { name: 'Open comparison' }),
  93  |       ).toBeEnabled();
  94  |     });
  95  | 
  96  |     await test.step('Open the comparison view and return with selection preserved', async () => {
  97  |       await page.getByRole('button', { name: 'Open comparison' }).click();
  98  |       await expect(page.getByRole('heading', { name: 'Compare maps' })).toBeVisible();
  99  |       await expect(page.getByText('Alpine Ridge')).toBeVisible();
  100 |       await expect(page.getByText('Coastal Watch')).toBeVisible();
  101 |       await page.getByRole('link', { name: 'Back to maps' }).click();
  102 |       await expect(page).toHaveURL(/\/maps$/);
  103 |       await expect(mapsPage.favoritesFilter).toHaveAttribute('aria-pressed', 'true');
  104 |       await expect(
  105 |         page.getByRole('button', { name: 'Select Alpine Ridge for compare' }),
  106 |       ).toHaveAttribute('aria-pressed', 'true');
  107 |       await expect(
  108 |         page.getByRole('button', { name: 'Select Coastal Watch for compare' }),
  109 |       ).toHaveAttribute('aria-pressed', 'true');
  110 |     });
  111 |   });
  112 | });
  113 | 
```