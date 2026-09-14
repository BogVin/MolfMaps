import { expect, test, type Page } from '@playwright/test';

import { LoginPage } from '../pages/login.page';
import { MapViewPage } from '../pages/map-view.page';
import { MapsPage } from '../pages/maps.page';

const TINY_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

const SOURCE_MAP_NAME = 'Kal Main Map';

type CatalogMap = { id: string; name: string };

async function listMaps(page: Page): Promise<CatalogMap[]> {
  const response = await page.request.get('/api/maps');
  expect(response.ok()).toBeTruthy();
  const body = (await response.json()) as { maps: CatalogMap[] };
  return body.maps;
}

async function createMap(page: Page, name: string): Promise<CatalogMap> {
  const response = await page.request.post('/api/maps', {
    multipart: {
      name,
      image: {
        name: 'target.png',
        mimeType: 'image/png',
        buffer: TINY_PNG,
      },
    },
  });
  expect(response.status()).toBe(201);
  return response.json() as Promise<CatalogMap>;
}

async function deleteMap(page: Page, mapId: string): Promise<void> {
  await page.request.delete(`/api/maps/${mapId}`);
}

async function deleteAnnotationsOnMap(page: Page, mapId: string): Promise<void> {
  const response = await page.request.get(`/api/maps/${mapId}/annotations`);
  if (!response.ok()) {
    return;
  }
  const body = (await response.json()) as { annotations: Array<{ id: string }> };
  for (const annotation of body.annotations) {
    await page.request.delete(`/api/maps/${mapId}/annotations/${annotation.id}`);
  }
}

test.describe('Styled text-link annotations', () => {
  // Both specs mutate annotations on the seeded source map; run one at a time.
  test.describe.configure({ mode: 'serial' });

  let loginPage: LoginPage;
  let mapsPage: MapsPage;
  let mapView: MapViewPage;
  let sourceMapId = '';
  let targetMapId = '';
  let targetMapName = '';
  let labelText = '';

  test.beforeEach(async ({ page }) => {
    loginPage = new LoginPage(page);
    mapsPage = new MapsPage(page);
    mapView = new MapViewPage(page);
    targetMapName = `CT-53 Target ${Date.now()}`;
    labelText = `Trailhead ${Date.now()}`;

    await loginPage.loginAsAdmin();

    const maps = await listMaps(page);
    const source = maps.find((map) => map.name === SOURCE_MAP_NAME) ?? maps[0];
    expect(source).toBeTruthy();
    sourceMapId = source!.id;

    const target = await createMap(page, targetMapName);
    targetMapId = target.id;

    await deleteAnnotationsOnMap(page, sourceMapId);
  });

  test.afterEach(async ({ page }) => {
    try {
      if (sourceMapId) {
        await deleteAnnotationsOnMap(page, sourceMapId);
      }
      if (targetMapId) {
        await deleteMap(page, targetMapId);
      }
    } catch {
      // Cleanup must not mask the assertion that failed.
    }
  });

  test('@p1 Admin can place a styled text link, follow it, and visitors can only view it', async ({
    page,
    browser,
  }) => {
    await test.step('Open the source map from the catalog with placement controls', async () => {
      await mapsPage.goto();
      await mapsPage.mapLink(SOURCE_MAP_NAME).click();
      await mapView.waitForMapReady(SOURCE_MAP_NAME);
      await expect(mapView.labelToggle).toBeVisible();
      await expect(mapView.pointToggle).toBeVisible();
      await expect(mapView.regionToggle).toBeVisible();
    });

    await test.step('Arm Label placement and open the editor by clicking the map', async () => {
      await mapView.armLabelPlacement();
      await expect(mapView.labelToggle).toHaveAttribute('aria-pressed', 'true');
      await expect(mapView.placementHint).toBeVisible();
      await mapView.clickMapCenter();
      await expect(mapView.editorTitle).toHaveText('Add a text label');
    });

    await test.step('Fill label text, target, size, color, and typeface, then Save', async () => {
      await mapView.fillTextLink({
        text: labelText,
        targetMapName,
        color: '#ff6600',
        typeface: 'serif',
        textSize: '0.05',
      });
      await mapView.saveDraft();
      await expect(mapView.labelButton(labelText)).toBeVisible();
      await expect(mapView.editor).toBeHidden();
      // Placement stays armed after save; disarm so the label follows the link.
      await mapView.disarmPlacement();
    });

    await test.step('Activate the saved label and land on the linked map', async () => {
      await mapView.labelButton(labelText).click();
      await mapView.waitForMapReady(targetMapName);
      await expect(page).toHaveURL(new RegExp(`/maps/${targetMapId}$`));
      await expect(mapView.title).toHaveText(targetMapName);
    });

    await test.step('A signed-out visitor sees the label but not placement controls', async () => {
      const visitorContext = await browser.newContext();
      const visitorPage = await visitorContext.newPage();
      const visitorView = new MapViewPage(visitorPage);
      try {
        await visitorPage.goto(`/maps/${sourceMapId}`);
        await visitorView.waitForMapReady(SOURCE_MAP_NAME);
        await expect(visitorView.labelButton(labelText)).toBeVisible();
        await expect(visitorView.labelToggle).toBeHidden();
        await expect(visitorView.pointToggle).toBeHidden();
        await expect(visitorView.regionToggle).toBeHidden();
      } finally {
        await visitorContext.close();
      }
    });
  });

  test('@p2 Canceling the label editor creates no annotation', async ({ page }) => {
    await test.step('Open the source map and start a label draft', async () => {
      await page.goto(`/maps/${sourceMapId}`);
      await mapView.waitForMapReady(SOURCE_MAP_NAME);
      await mapView.armLabelPlacement();
      await mapView.clickMapCenter();
      await expect(mapView.editorTitle).toHaveText('Add a text label');
    });

    await test.step('Fill the draft then Cancel and confirm no label remains', async () => {
      const canceledText = `Canceled ${Date.now()}`;
      await mapView.fillTextLink({
        text: canceledText,
        targetMapName,
        color: '#00aaff',
        typeface: 'condensed',
        textSize: '0.04',
      });
      await mapView.cancelDraft();
      await expect(
        page.getByRole('button', { name: `${canceledText} — opens the linked map` }),
      ).toHaveCount(0);
    });
  });
});
