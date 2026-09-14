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
  {
    id: 'eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
    name: 'Desert Crossing',
    image_url: '/api/maps/eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee/image',
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

test.describe('Map catalog organization', () => {
  let mapsPage: MapsPage;

  test.beforeEach(async ({ page }) => {
    mapsPage = new MapsPage(page);
    await installCatalogStub(page);
    await clearStoredFavorites(page);
  });

  test('@p1 Visitor can favorite, filter, sort, search, reset, and keep favorites after reload', async ({
    page,
  }) => {
    await test.step('Open the maps catalog with five seeded maps', async () => {
      await mapsPage.goto();
      await expect(mapsPage.resultCount).toHaveText('Showing 5 of 5 maps');
      await expect(mapsPage.mapLinks).toHaveCount(5);
    });

    await test.step('Favorite three maps across the list', async () => {
      await mapsPage.favorite('Alpine Ridge');
      await mapsPage.favorite('Coastal Watch');
      await mapsPage.favorite('Mountain Pass');
      await expect(mapsPage.unfavoriteButton('Alpine Ridge')).toBeVisible();
      await expect(mapsPage.unfavoriteButton('Coastal Watch')).toBeVisible();
      await expect(mapsPage.unfavoriteButton('Mountain Pass')).toBeVisible();
    });

    await test.step('Switch to Favorites and confirm only those three remain', async () => {
      await mapsPage.showFavorites();
      await expect(mapsPage.favoritesFilter).toHaveAttribute('aria-pressed', 'true');
      await expect(mapsPage.resultCount).toHaveText('Showing 3 of 5 maps');
      await expect(await mapsPage.visibleMapNames()).toEqual([
        'Alpine Ridge',
        'Coastal Watch',
        'Mountain Pass',
      ]);
    });

    await test.step('Sort favorites Z–A', async () => {
      await mapsPage.sortDescending();
      await expect(mapsPage.sortDescButton).toHaveAttribute('aria-pressed', 'true');
      await expect(await mapsPage.visibleMapNames()).toEqual([
        'Mountain Pass',
        'Coastal Watch',
        'Alpine Ridge',
      ]);
    });

    await test.step('Search within favorites for Coastal', async () => {
      await mapsPage.search('Coastal');
      await expect(mapsPage.resultCount).toHaveText('Showing 1 of 5 maps');
      await expect(await mapsPage.visibleMapNames()).toEqual(['Coastal Watch']);
    });

    await test.step('Reset organization without clearing favorites', async () => {
      await mapsPage.resetOrganization();
      await expect(mapsPage.searchInput).toHaveValue('');
      await expect(mapsPage.allMapsFilter).toHaveAttribute('aria-pressed', 'true');
      await expect(mapsPage.sortAscButton).toHaveAttribute('aria-pressed', 'true');
      await expect(mapsPage.resultCount).toHaveText('Showing 5 of 5 maps');
      await expect(await mapsPage.visibleMapNames()).toEqual([
        'Alpine Ridge',
        'Coastal Watch',
        'Desert Crossing',
        'Kal Main Map',
        'Mountain Pass',
      ]);
      await expect(mapsPage.unfavoriteButton('Alpine Ridge')).toBeVisible();
      await expect(mapsPage.unfavoriteButton('Coastal Watch')).toBeVisible();
      await expect(mapsPage.unfavoriteButton('Mountain Pass')).toBeVisible();
    });

    await test.step('Reload the page and keep the same favorites', async () => {
      await page.reload();
      await expect(mapsPage.heading).toBeVisible();
      await expect(mapsPage.unfavoriteButton('Alpine Ridge')).toBeVisible();
      await expect(mapsPage.unfavoriteButton('Coastal Watch')).toBeVisible();
      await expect(mapsPage.unfavoriteButton('Mountain Pass')).toBeVisible();
      await expect(mapsPage.favoriteButton('Desert Crossing')).toBeVisible();
      await expect(mapsPage.favoriteButton('Kal Main Map')).toBeVisible();
    });

    await test.step('Unfavorite one map and confirm Favorites updates', async () => {
      await mapsPage.unfavorite('Coastal Watch');
      await mapsPage.showFavorites();
      await expect(mapsPage.resultCount).toHaveText('Showing 2 of 5 maps');
      await expect(await mapsPage.visibleMapNames()).toEqual([
        'Alpine Ridge',
        'Mountain Pass',
      ]);
    });
  });

  test('@p2 Favorites empty state appears when no maps are favorited', async () => {
    await test.step('Open the catalog and switch to Favorites with none selected', async () => {
      await mapsPage.goto();
      await mapsPage.showFavorites();
    });

    await test.step('Show the dedicated empty-favorites message', async () => {
      await expect(mapsPage.emptyState).toHaveText(
        'No favorite maps yet. Mark a map as a favorite to see it here.',
      );
      await expect(mapsPage.mapLinks).toHaveCount(0);
      await expect(mapsPage.resultCount).toHaveText('Showing 0 of 5 maps');
    });
  });
});
