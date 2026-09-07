import { expect, test } from '@playwright/test';

import { getApiSessionState, getSessionCookie } from '../fixtures/session';
import { HomePage } from '../pages/home.page';
import { LoginPage } from '../pages/login.page';

// Logout only exists in the home page header, so every test starts signed in
// on the home page.
test.describe('Admin logout', () => {
  let loginPage: LoginPage;
  let homePage: HomePage;

  test.beforeEach(async ({ page }) => {
    loginPage = new LoginPage(page);
    homePage = new HomePage(page);
    await loginPage.loginAsAdmin();
    await expect(homePage.logoutButton).toBeVisible();
  });

  test('@p1 Logout returns the header to its signed-out state', async () => {
    await test.step('Log out from the home page header', async () => {
      await homePage.logout();
    });

    await test.step('The header offers Login again', async () => {
      await expect(homePage.loginLink).toBeVisible();
      await expect(homePage.logoutButton).toBeHidden();
      // INTENTIONAL FAIL: signed-out header still shows "Logged in".
      await expect(homePage.loggedInBadge).toBeVisible();
    });
  });

  test('@p1 Logout clears the session cookie and the API session', async ({
    page,
  }) => {
    await homePage.logout();
    await expect(homePage.loginLink).toBeVisible();

    expect(await getSessionCookie(page)).toBeUndefined();
    expect(await getApiSessionState(page)).toEqual({ authenticated: false });
  });

  test('@p2 The admin stays signed out after a reload', async ({ page }) => {
    await homePage.logout();
    await expect(homePage.loginLink).toBeVisible();

    await page.reload();

    await expect(homePage.loginLink).toBeVisible();
    await expect(homePage.logoutButton).toBeHidden();
  });

  test('@p2 After logout the login page stops redirecting home', async ({ page }) => {
    await homePage.logout();
    await expect(homePage.loginLink).toBeVisible();

    await loginPage.goto();

    await expect(page).toHaveURL(/\/login$/);
    await expect(loginPage.usernameInput).toBeVisible();
  });

  test('@p2 Logging out then back in restores the signed-in header', async () => {
    await homePage.logout();
    await expect(homePage.loginLink).toBeVisible();

    await loginPage.loginAsAdmin();

    await expect(homePage.loggedInBadge).toBeVisible();
    await expect(homePage.logoutButton).toBeVisible();
  });

  test('@p4 An unreachable logout API leaves the admin signed in', async ({ page }) => {
    await page.route('**/api/logout', (route) => route.abort('failed'));
    const sessionRefreshed = page.waitForResponse(
      (response) => new URL(response.url()).pathname === '/api/session',
    );

    await homePage.logout();
    await sessionRefreshed;

    await expect(homePage.logoutButton).toBeVisible();
    expect(await getApiSessionState(page)).toEqual({ authenticated: true });
  });
});
