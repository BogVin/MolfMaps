import type { Locator, Page } from '@playwright/test';

/** A single opened map at /maps/:id. */
export class MapViewPage {
  readonly backToMaps: Locator;

  constructor(private readonly page: Page) {
    this.backToMaps = page.getByRole('link', { name: 'Back to maps' });
  }

  title(name: string): Locator {
    return this.page.getByRole('heading', { name, exact: true });
  }
}
