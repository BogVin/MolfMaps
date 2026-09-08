import type { Locator, Page } from '@playwright/test';

/** The public Maps catalog at /maps. */
export class MapsPage {
  readonly heading: Locator;
  readonly searchInput: Locator;
  readonly allMapsFilter: Locator;
  readonly favoritesFilter: Locator;
  readonly sortAscButton: Locator;
  readonly sortDescButton: Locator;
  readonly resetButton: Locator;
  readonly resultCount: Locator;
  readonly emptyState: Locator;
  readonly mapLinks: Locator;

  constructor(private readonly page: Page) {
    this.heading = page.getByRole('heading', { name: 'Maps', exact: true });
    this.searchInput = page.getByLabel('Search maps');
    this.allMapsFilter = page.getByRole('button', { name: 'All maps' });
    this.favoritesFilter = page.getByRole('button', { name: 'Favorites' });
    this.sortAscButton = page.getByRole('button', { name: 'Sort A–Z' });
    this.sortDescButton = page.getByRole('button', { name: 'Sort Z–A' });
    this.resetButton = page.getByRole('button', { name: 'Reset' });
    this.resultCount = page.getByRole('status').filter({ hasText: /Showing \d+ of \d+ maps/ });
    this.emptyState = page.locator('.maps-empty');
    this.mapLinks = page.locator('.maps-list__link');
  }

  async goto(): Promise<void> {
    await this.page.goto('/maps');
    await this.heading.waitFor();
  }

  favoriteButton(mapName: string): Locator {
    return this.page.getByRole('button', { name: `Favorite ${mapName}` });
  }

  unfavoriteButton(mapName: string): Locator {
    return this.page.getByRole('button', { name: `Unfavorite ${mapName}` });
  }

  mapLink(mapName: string): Locator {
    return this.page.getByRole('link', { name: mapName, exact: true });
  }

  async visibleMapNames(): Promise<string[]> {
    return this.mapLinks.allTextContents().then((names) =>
      names.map((name) => name.trim()),
    );
  }

  async favorite(mapName: string): Promise<void> {
    await this.favoriteButton(mapName).click();
  }

  async unfavorite(mapName: string): Promise<void> {
    await this.unfavoriteButton(mapName).click();
  }

  async showFavorites(): Promise<void> {
    await this.favoritesFilter.click();
  }

  async showAllMaps(): Promise<void> {
    await this.allMapsFilter.click();
  }

  async sortAscending(): Promise<void> {
    await this.sortAscButton.click();
  }

  async sortDescending(): Promise<void> {
    await this.sortDescButton.click();
  }

  async search(query: string): Promise<void> {
    await this.searchInput.fill(query);
  }

  async resetOrganization(): Promise<void> {
    await this.resetButton.click();
  }
}
