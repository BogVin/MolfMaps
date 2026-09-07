import type { Locator, Page } from '@playwright/test';

/** The public map viewer at /maps/:id. */
export class MapViewPage {
  readonly title: Locator;
  readonly backToMaps: Locator;

  constructor(private readonly page: Page) {
    this.title = page.getByRole('heading', { level: 1 });
    this.backToMaps = page.getByRole('link', { name: 'Back to maps' });
  }
}
