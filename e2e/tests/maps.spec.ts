import { expect, test } from '@playwright/test';

import {
  createCatalogMap,
  deleteCatalogMap,
  loginAdminApi,
  uniqueMapName,
  type CreatedMap,
} from '../fixtures/maps';
import { MapViewPage } from '../pages/map-view.page';
import { MapsPage } from '../pages/maps.page';

const LOAD_ERROR = 'Could not load the maps. Please try again.';

test.describe('Map catalog search', () => {
  let mapsPage: MapsPage;
  let mapViewPage: MapViewPage;
  let harbor: CreatedMap;
  let ridge: CreatedMap;

  test.beforeEach(async ({ page, request }) => {
    mapsPage = new MapsPage(page);
    mapViewPage = new MapViewPage(page);
    await loginAdminApi(request);
    harbor = await createCatalogMap(request, uniqueMapName('Harbor'));
    ridge = await createCatalogMap(request, uniqueMapName('Ridge'));
  });

  test.afterEach(async ({ request }) => {
    for (const map of [harbor, ridge]) {
      if (!map) {
        continue;
      }
      try {
        await deleteCatalogMap(request, map.id);
      } catch {
        // A failed test must still leave the catalog clean.
      }
    }
  });

  test('@p1 Searching the catalog keeps only matching map names', async () => {
    await test.step('Open the public catalog with two named maps', async () => {
      await mapsPage.goto();
      await expect(mapsPage.searchInput).toBeVisible();
      await expect(mapsPage.mapLink(harbor.name)).toBeVisible();
      await expect(mapsPage.mapLink(ridge.name)).toBeVisible();
    });

    await test.step('Type part of one map name into Search maps', async () => {
      await mapsPage.search('harbor');
    });

    await test.step('Only the matching map stays in the list', async () => {
      await expect(mapsPage.mapLink(harbor.name)).toBeVisible();
      await expect(mapsPage.mapLink(ridge.name)).toBeHidden();
    });
  });

  test('@p1 Opening a filtered map goes to that map view', async ({ page }) => {
    await test.step('Filter the catalog to one map', async () => {
      await mapsPage.goto();
      await mapsPage.search('ridge');
      await expect(mapsPage.mapLink(ridge.name)).toBeVisible();
    });

    await test.step('Open the remaining map', async () => {
      await mapsPage.mapLink(ridge.name).click();
    });

    await test.step('The map view shows that map', async () => {
      await expect(page).toHaveURL(new RegExp(`/maps/${ridge.id}$`));
      await expect(mapViewPage.title(ridge.name)).toBeVisible();
    });
  });

  test('@p2 A search with no matches shows a specific empty state', async () => {
    await test.step('Open the catalog', async () => {
      await mapsPage.goto();
      await expect(mapsPage.mapLink(harbor.name)).toBeVisible();
    });

    await test.step('Search for a name that matches nothing', async () => {
      await mapsPage.search('no-such-catalog-map');
    });

    await test.step('The list is replaced by the no-match status', async () => {
      await expect(mapsPage.emptyStatus).toContainText(
        'No maps match “no-such-catalog-map”.',
      );
      await expect(mapsPage.mapLink(harbor.name)).toBeHidden();
      await expect(mapsPage.mapLink(ridge.name)).toBeHidden();
    });
  });

  test('@p2 Clearing the search restores the full catalog', async () => {
    await test.step('Filter the catalog down to one map', async () => {
      await mapsPage.goto();
      await mapsPage.search('HARBOR');
      await expect(mapsPage.mapLink(ridge.name)).toBeHidden();
    });

    await test.step('Clear the search field', async () => {
      await mapsPage.clearSearch();
    });

    await test.step('Both maps are listed again', async () => {
      await expect(mapsPage.mapLink(harbor.name)).toBeVisible();
      await expect(mapsPage.mapLink(ridge.name)).toBeVisible();
    });
  });

  test('@p3 A catalog load failure shows a retry message', async ({ page }) => {
    await test.step('Block the catalog API', async () => {
      await page.route('**/api/maps', (route) => {
        if (route.request().method() !== 'GET') {
          return route.continue();
        }
        return route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ detail: 'Internal Server Error' }),
        });
      });
    });

    await test.step('Open the catalog while the API is down', async () => {
      await mapsPage.goto();
    });

    await test.step('The page asks the visitor to try again', async () => {
      await expect(mapsPage.loadError).toHaveText(LOAD_ERROR);
      await expect(mapsPage.tryAgainButton).toBeVisible();
      await expect(mapsPage.searchInput).toBeHidden();
    });
  });
});
