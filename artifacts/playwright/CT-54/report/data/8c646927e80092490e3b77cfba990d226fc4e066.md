# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: map-rename.spec.ts >> Catalog map rename >> @p1 Admin can rename a map from the catalog and keep the new name after reload
- Location: tests/map-rename.spec.ts:21:7

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByRole('button', { name: /Rename Kal Main Map|Rename/ })
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 5000ms
  - waiting for getByRole('button', { name: /Rename Kal Main Map|Rename/ })

```

```yaml
- banner:
  - link "MolfMaps":
    - /url: /
  - navigation "Session": Logged in
- main:
  - heading "Maps" [level=1]
  - heading "Add a map" [level=2]
  - text: Display name
  - textbox "Display name"
  - text: Image file
  - button "Image file"
  - button "Add map"
  - region "Organize maps":
    - text: Search maps
    - searchbox "Search maps"
    - group "Filter maps":
      - button "All maps" [pressed]
      - button "Favorites"
    - group "Sort maps":
      - button "Sort A–Z" [pressed]
      - button "Sort Z–A"
    - button "Reset"
    - status: Showing 3 of 3 maps
  - list:
    - listitem:
      - link "east":
        - /url: /maps/0c40174835984ecb91a1e6c07df72113
      - button "Favorite east": Favorite
      - button "Delete east": Delete
    - listitem:
      - link "kal 2":
        - /url: /maps/138ac583209b44d5ab3ef6a4f3c184bb
      - button "Favorite kal 2": Favorite
      - button "Delete kal 2": Delete
    - listitem:
      - link "Kal Main Map":
        - /url: /maps/ba8c01632e074e9996b72e422f70a175
      - button "Favorite Kal Main Map": Favorite
      - button "Delete Kal Main Map": Delete
```

# Test source

```ts
  1  | import { expect, test } from '@playwright/test';
  2  | 
  3  | import { LoginPage } from '../pages/login.page';
  4  | import { MapsPage } from '../pages/maps.page';
  5  | 
  6  | /**
  7  |  * CT-54 requirements describe Rename controls that are not implemented.
  8  |  * This spec is intentionally written against those requirements so a missing
  9  |  * feature surfaces as an application failure with watchable evidence.
  10 |  */
  11 | test.describe('Catalog map rename', () => {
  12 |   let loginPage: LoginPage;
  13 |   let mapsPage: MapsPage;
  14 | 
  15 |   test.beforeEach(async ({ page }) => {
  16 |     loginPage = new LoginPage(page);
  17 |     mapsPage = new MapsPage(page);
  18 |     await loginPage.loginAsAdmin();
  19 |   });
  20 | 
  21 |   test('@p1 Admin can rename a map from the catalog and keep the new name after reload', async ({
  22 |     page,
  23 |   }) => {
  24 |     const originalName = 'Kal Main Map';
  25 |     const renamedName = `Renamed Kal ${Date.now()}`;
  26 | 
  27 |     await test.step('Open the catalog as a signed-in admin', async () => {
  28 |       await mapsPage.goto();
  29 |       await expect(mapsPage.mapLink(originalName)).toBeVisible();
  30 |     });
  31 | 
  32 |     await test.step('Reveal the Rename control required by CT-54', async () => {
  33 |       // Intentionally unimplemented: no Rename button exists on catalog rows.
  34 |       await expect(
  35 |         page.getByRole('button', { name: new RegExp(`Rename ${originalName}|Rename`) }),
> 36 |       ).toBeVisible();
     |         ^ Error: expect(locator).toBeVisible() failed
  37 |     });
  38 | 
  39 |     await test.step('Rename the map and confirm the new name in the list', async () => {
  40 |       await page.getByRole('button', { name: /Rename/ }).first().click();
  41 |       const nameInput = page.getByLabel(/Display name|New name|Map name/i);
  42 |       await expect(nameInput).toHaveValue(originalName);
  43 |       await nameInput.fill(renamedName);
  44 |       await page.getByRole('button', { name: /Save|Confirm rename/i }).click();
  45 |       await expect(mapsPage.mapLink(renamedName)).toBeVisible();
  46 |       await expect(mapsPage.mapLink(originalName)).toHaveCount(0);
  47 |     });
  48 | 
  49 |     await test.step('Reload and keep the renamed display name', async () => {
  50 |       await page.reload();
  51 |       await mapsPage.heading.waitFor();
  52 |       await expect(mapsPage.mapLink(renamedName)).toBeVisible();
  53 |     });
  54 |   });
  55 | });
  56 | 
```