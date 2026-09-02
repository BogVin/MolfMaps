import type { Locator, Page } from '@playwright/test';

/** The public home page, whose header holds the only Logout control. */
export class HomePage {
  readonly sessionNav: Locator;
  readonly loggedInBadge: Locator;
  readonly logoutButton: Locator;
  readonly loginLink: Locator;
  readonly sessionError: Locator;

  constructor(private readonly page: Page) {
    this.sessionNav = page.getByRole('navigation', { name: 'Session' });
    this.loggedInBadge = this.sessionNav.getByText('Logged in', { exact: true });
    this.logoutButton = this.sessionNav.getByRole('button', { name: 'Logout' });
    this.loginLink = this.sessionNav.getByRole('link', { name: 'Login' });
    this.sessionError = this.sessionNav.getByRole('status');
  }

  async goto(): Promise<void> {
    await this.page.goto('/');
  }

  async logout(): Promise<void> {
    await this.logoutButton.click();
  }
}
