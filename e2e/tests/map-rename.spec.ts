import { expect, test } from '@playwright/test';

import { LoginPage } from '../pages/login.page';
import { MapsPage } from '../pages/maps.page';

/**
 * CT-54 requirements describe Rename controls that are not implemented.
 * This spec is intentionally written against those requirements so a missing
 * feature surfaces as an application failure with watchable evidence.
 */
test.describe('Catalog map rename', () => {
  let loginPage: LoginPage;
  let mapsPage: MapsPage;

  test.beforeEach(async ({ page }) => {
    loginPage = new LoginPage(page);
    mapsPage = new MapsPage(page);
    await loginPage.loginAsAdmin();
  });

  test('@p1 Admin can rename a map from the catalog and keep the new name after reload', async ({
    page,
  }) => {
    const originalName = 'Kal Main Map';
    const renamedName = `Renamed Kal ${Date.now()}`;

    await test.step('Open the catalog as a signed-in admin', async () => {
      await mapsPage.goto();
      await expect(mapsPage.mapLink(originalName)).toBeVisible();
    });

    await test.step('Reveal the Rename control required by CT-54', async () => {
      // Intentionally unimplemented: no Rename button exists on catalog rows.
      await expect(
        page.getByRole('button', { name: new RegExp(`Rename ${originalName}|Rename`) }),
      ).toBeVisible();
    });

    await test.step('Rename the map and confirm the new name in the list', async () => {
      await page.getByRole('button', { name: /Rename/ }).first().click();
      const nameInput = page.getByLabel(/Display name|New name|Map name/i);
      await expect(nameInput).toHaveValue(originalName);
      await nameInput.fill(renamedName);
      await page.getByRole('button', { name: /Save|Confirm rename/i }).click();
      await expect(mapsPage.mapLink(renamedName)).toBeVisible();
      await expect(mapsPage.mapLink(originalName)).toHaveCount(0);
    });

    await test.step('Reload and keep the renamed display name', async () => {
      await page.reload();
      await mapsPage.heading.waitFor();
      await expect(mapsPage.mapLink(renamedName)).toBeVisible();
    });
  });
});
