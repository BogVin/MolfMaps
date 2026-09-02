import type { Locator, Page } from '@playwright/test';

import { adminCredentials } from '../fixtures/credentials';

/** The admin login form at /login. */
export class LoginPage {
  readonly usernameInput: Locator;
  readonly passwordInput: Locator;
  readonly submitButton: Locator;
  readonly errorMessage: Locator;

  constructor(private readonly page: Page) {
    // The app ships no data-testid attributes, so rely on roles and labels.
    this.usernameInput = page.getByLabel('Username');
    this.passwordInput = page.getByLabel('Password');
    this.submitButton = page.getByRole('button', { name: 'Log in' });
    this.errorMessage = page.getByRole('alert');
  }

  async goto(): Promise<void> {
    await this.page.goto('/login');
  }

  async submitCredentials(username: string, password: string): Promise<void> {
    await this.usernameInput.fill(username);
    await this.passwordInput.fill(password);
    await this.submitButton.click();
  }

  async submitEmptyForm(): Promise<void> {
    await this.submitButton.click();
  }

  /** Signs in as the admin and waits for the redirect to the home page. */
  async loginAsAdmin(): Promise<void> {
    await this.goto();
    await this.submitCredentials(
      adminCredentials.username,
      adminCredentials.password,
    );
    await this.page.waitForURL('/');
  }
}
