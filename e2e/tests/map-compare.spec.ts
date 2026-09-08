import { expect, test, type Page } from '@playwright/test';

import { MapsPage } from '../pages/maps.page';

const CATALOG = [
  {
    id: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    name: 'Kal Main Map',
    image_url: '/api/maps/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/image',
  },
  {
    id: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
    name: 'Mountain Pass',
    image_url: '/api/maps/bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb/image',
  },
  {
    id: 'cccccccccccccccccccccccccccccccc',
    name: 'Alpine Ridge',
    image_url: '/api/maps/cccccccccccccccccccccccccccccccc/image',
  },
  {
    id: 'dddddddddddddddddddddddddddddddd',
    name: 'Coastal Watch',
    image_url: '/api/maps/dddddddddddddddddddddddddddddddd/image',
  },
];

async function installCatalogStub(page: Page): Promise<void> {
  await page.route('**/api/maps', async (route) => {
    if (route.request().method() !== 'GET') {
      await route.continue();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ maps: CATALOG }),
    });
  });
}

async function clearStoredFavorites(page: Page): Promise<void> {
  await page.goto('/maps');
  await page.evaluate(() => {
    window.localStorage.removeItem('molfmaps.catalog.favorites');
  });
}

test.describe('Favorite map comparison', () => {
  let mapsPage: MapsPage;

  test.beforeEach(async ({ page }) => {
    mapsPage = new MapsPage(page);
    await installCatalogStub(page);
    await clearStoredFavorites(page);
  });

  test('@p1 Admin can select two favorites and open a side-by-side comparison', async ({
    page,
  }) => {
    await test.step('Open the catalog and favorite three maps', async () => {
      await mapsPage.goto();
      await mapsPage.favorite('Alpine Ridge');
      await mapsPage.favorite('Coastal Watch');
      await mapsPage.favorite('Mountain Pass');
      await expect(mapsPage.unfavoriteButton('Alpine Ridge')).toBeVisible();
      await expect(mapsPage.unfavoriteButton('Coastal Watch')).toBeVisible();
      await expect(mapsPage.unfavoriteButton('Mountain Pass')).toBeVisible();
    });

    await test.step('Switch to Favorites so compare mode can appear', async () => {
      await mapsPage.showFavorites();
      await expect(mapsPage.favoritesFilter).toHaveAttribute('aria-pressed', 'true');
      await expect(mapsPage.resultCount).toHaveText('Showing 3 of 4 maps');
      await expect(await mapsPage.visibleMapNames()).toEqual([
        'Alpine Ridge',
        'Coastal Watch',
        'Mountain Pass',
      ]);
    });

    await test.step('Reveal the Compare maps control required by CT-50', async () => {
      // Intentionally unimplemented feature: this control does not exist yet.
      await expect(page.getByRole('button', { name: 'Compare maps' })).toBeVisible();
    });

    await test.step('Select exactly two favorites for comparison', async () => {
      await page.getByRole('button', { name: 'Compare maps' }).click();
      await page.getByRole('button', { name: 'Select Alpine Ridge for compare' }).click();
      await page.getByRole('button', { name: 'Select Coastal Watch for compare' }).click();
      await expect(
        page.getByRole('button', { name: 'Open comparison' }),
      ).toBeEnabled();
    });

    await test.step('Open the comparison view and return with selection preserved', async () => {
      await page.getByRole('button', { name: 'Open comparison' }).click();
      await expect(page.getByRole('heading', { name: 'Compare maps' })).toBeVisible();
      await expect(page.getByText('Alpine Ridge')).toBeVisible();
      await expect(page.getByText('Coastal Watch')).toBeVisible();
      await page.getByRole('link', { name: 'Back to maps' }).click();
      await expect(page).toHaveURL(/\/maps$/);
      await expect(mapsPage.favoritesFilter).toHaveAttribute('aria-pressed', 'true');
      await expect(
        page.getByRole('button', { name: 'Select Alpine Ridge for compare' }),
      ).toHaveAttribute('aria-pressed', 'true');
      await expect(
        page.getByRole('button', { name: 'Select Coastal Watch for compare' }),
      ).toHaveAttribute('aria-pressed', 'true');
    });
  });
});
