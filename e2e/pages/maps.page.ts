import type { Locator, Page } from '@playwright/test';

/** The public map catalog at /maps, including the name search field. */
export class MapsPage {
  readonly heading: Locator;
  readonly searchInput: Locator;
  readonly emptyStatus: Locator;
  readonly loadError: Locator;
  readonly tryAgainButton: Locator;

  constructor(private readonly page: Page) {
    this.heading = page.getByRole('heading', { name: 'Maps', exact: true });
    this.searchInput = page.getByLabel('Search maps');
    this.emptyStatus = page.getByRole('status');
    this.loadError = page.getByRole('alert');
    this.tryAgainButton = page.getByRole('button', { name: 'Try again' });
  }

  async goto(): Promise<void> {
    await this.page.goto('/maps');
    await this.heading.waitFor();
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
