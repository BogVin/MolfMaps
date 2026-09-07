import type { Locator, Page } from '@playwright/test';

/** The public map catalog at /maps, including the client-side search field. */
export class MapsPage {
  readonly heading: Locator;
  readonly searchInput: Locator;
  readonly emptyCatalog: Locator;
  readonly emptySearch: Locator;
  readonly loadError: Locator;
  readonly tryAgainButton: Locator;
  readonly mapLinks: Locator;

  constructor(private readonly page: Page) {
    this.heading = page.getByRole('heading', { name: 'Maps', exact: true });
    this.searchInput = page.getByLabel('Search maps');
    this.emptyCatalog = page.getByText('No maps available yet.');
    this.emptySearch = page.getByRole('status');
    this.loadError = page.getByRole('alert');
    this.tryAgainButton = page.getByRole('button', { name: 'Try again' });
    this.mapLinks = page.locator('.maps-list__link');
  }

  async goto(): Promise<void> {
    await this.page.goto('/maps');
  }

  mapLink(name: string): Locator {
    return this.page.getByRole('link', { name, exact: true });
  }

  async search(query: string): Promise<void> {
    await this.searchInput.fill(query);
  }

  async clearSearch(): Promise<void> {
    await this.searchInput.fill('');
  }
}
