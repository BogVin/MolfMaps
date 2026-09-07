import { expect, test } from '@playwright/test';

import {
  createMapViaApi,
  deleteMapViaApi,
  loginAdminApi,
  type CreatedMap,
} from '../fixtures/maps';
import { MapViewPage } from '../pages/map-view.page';
import { MapsPage } from '../pages/maps.page';

// Catalog search is client-side and public. Maps are created through the API
// so the tests do not depend on whatever is already on disk.
test.describe('Map catalog search', () => {
  const token = `e2e-${Date.now()}`;
  const harborName = `E2E Harbor ${token}`;
  const ridgeName = `E2E Ridge ${token}`;
  const created: CreatedMap[] = [];

  test.beforeAll(async ({ request }) => {
    await loginAdminApi(request);
    created.push(await createMapViaApi(request, harborName));
    created.push(await createMapViaApi(request, ridgeName));
  });

  test.afterAll(async ({ request }) => {
    try {
      await loginAdminApi(request);
      for (const map of [...created].reverse()) {
        try {
          await deleteMapViaApi(request, map.id);
        } catch {
          // Keep deleting the rest even if one id is already gone.
        }
      }
    } catch {
      // Teardown must not hide a test failure.
    }
  });

  test('@p1 Searching by name fragment shows only matching maps', async ({
    page,
  }) => {
    const mapsPage = new MapsPage(page);

    await test.step('Open the map catalog', async () => {
      await mapsPage.goto();
      await expect(mapsPage.searchInput).toBeVisible();
      await expect(mapsPage.mapLink(harborName)).toBeVisible();
      await expect(mapsPage.mapLink(ridgeName)).toBeVisible();
    });

    await test.step('Type a fragment of one map name', async () => {
      await mapsPage.search('harbor');
    });

    await test.step('Only the matching map stays in the list', async () => {
      await expect(mapsPage.mapLink(harborName)).toBeVisible();
      await expect(mapsPage.mapLink(ridgeName)).toBeHidden();
    });
  });

  test('@p2 Search matching is case-insensitive', async ({ page }) => {
    const mapsPage = new MapsPage(page);

    await test.step('Open the catalog and search in a different case', async () => {
      await mapsPage.goto();
      await expect(mapsPage.searchInput).toBeVisible();
      await mapsPage.search('RIDGE');
    });

    await test.step('The lowercase catalog name still matches', async () => {
      await expect(mapsPage.mapLink(ridgeName)).toBeVisible();
      await expect(mapsPage.mapLink(harborName)).toBeHidden();
    });
  });

  test('@p2 A query that matches nothing shows the empty-search state', async ({
    page,
  }) => {
    const mapsPage = new MapsPage(page);
    const query = `zzz-no-match-${token}`;

    await test.step('Open the catalog and search for a name that does not exist', async () => {
      await mapsPage.goto();
      await expect(mapsPage.searchInput).toBeVisible();
      await mapsPage.search(query);
    });

    await test.step('The catalog explains that nothing matches', async () => {
      await expect(mapsPage.emptySearch).toHaveText(`No maps match “${query}”.`);
      await expect(mapsPage.mapLink(harborName)).toBeHidden();
      await expect(mapsPage.mapLink(ridgeName)).toBeHidden();
    });
  });

  test('@p2 Clearing the search restores maps that were filtered out', async ({
    page,
  }) => {
    const mapsPage = new MapsPage(page);

    await test.step('Filter the catalog down to one map', async () => {
      await mapsPage.goto();
      await expect(mapsPage.searchInput).toBeVisible();
      await mapsPage.search('harbor');
      await expect(mapsPage.mapLink(ridgeName)).toBeHidden();
    });

    await test.step('Clear the search field', async () => {
      await mapsPage.clearSearch();
    });

    await test.step('Every catalog map seeded for this test is visible again', async () => {
      await expect(mapsPage.mapLink(harborName)).toBeVisible();
      await expect(mapsPage.mapLink(ridgeName)).toBeVisible();
    });
  });

  test('@p3 Opening a filtered map goes to that map view', async ({ page }) => {
    const mapsPage = new MapsPage(page);
    const mapView = new MapViewPage(page);
    const harbor = created[0];

    await test.step('Filter the catalog to the harbor map', async () => {
      await mapsPage.goto();
      await expect(mapsPage.searchInput).toBeVisible();
      await mapsPage.search('harbor');
      await expect(mapsPage.mapLink(harborName)).toBeVisible();
    });

    await test.step('Open the matching map', async () => {
      await mapsPage.mapLink(harborName).click();
    });

    await test.step('The map view shows that map', async () => {
      await expect(page).toHaveURL(new RegExp(`/maps/${harbor.id}$`));
      await expect(mapView.title).toHaveText(harborName);
    });
  });

  test('@p4 Search is hidden when the catalog has no maps', async ({ page }) => {
    const mapsPage = new MapsPage(page);

    await page.route('**/api/maps', (route) => {
      const url = new URL(route.request().url());
      if (url.pathname === '/api/maps' && route.request().method() === 'GET') {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ maps: [] }),
        });
      }
      return route.continue();
    });

    await test.step('Open an empty catalog', async () => {
      await mapsPage.goto();
      await expect(mapsPage.emptyCatalog).toBeVisible();
    });

    await test.step('The search field is not offered', async () => {
      await expect(mapsPage.searchInput).toBeHidden();
    });
  });
});
