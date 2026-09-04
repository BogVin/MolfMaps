import { expect, test } from '@playwright/test';

import { adminCredentials, rejectedCredentials } from '../fixtures/credentials';
import { getApiSessionState, getSessionCookie } from '../fixtures/session';
import { HomePage } from '../pages/home.page';
import { LoginPage } from '../pages/login.page';

const GENERIC_LOGIN_ERROR = 'Invalid username or password.';

// Each test gets a fresh browser context, so the session cookie never leaks
// between tests. Logging in creates no server-side records to clean up.
test.describe('Admin login', () => {
  let loginPage: LoginPage;
  let homePage: HomePage;

  test.beforeEach(async ({ page }) => {
    loginPage = new LoginPage(page);
    homePage = new HomePage(page);
  });

  test('@p1 Login with valid credentials signs the admin in on the home page', async ({
    page,
  }) => {
    await test.step('Open the login form', async () => {
      await loginPage.goto();
      await expect(loginPage.usernameInput).toBeVisible();
    });

    await test.step('Submit the admin credentials', async () => {
      await loginPage.submitCredentials(
        adminCredentials.username,
        adminCredentials.password,
      );
    });

    await test.step('The admin lands on the home page as signed in', async () => {
      await expect(page).toHaveURL('/');
      await expect(homePage.loggedInBadge).toBeVisible();
      await expect(homePage.logoutButton).toBeVisible();
      await expect(homePage.loginLink).toBeHidden();
    });
  });

  test('@p1 Login issues an HttpOnly session cookie the API accepts', async ({
    page,
  }) => {
    await loginPage.loginAsAdmin();
    await expect(homePage.loggedInBadge).toBeVisible();

    const sessionCookie = await getSessionCookie(page);
    expect(sessionCookie?.httpOnly).toBe(true);
    expect(await getApiSessionState(page)).toEqual({ authenticated: true });
  });

  test('@p2 The session survives a page reload', async ({ page }) => {
    await loginPage.loginAsAdmin();
    await expect(homePage.loggedInBadge).toBeVisible();

    await page.reload();

    await expect(homePage.logoutButton).toBeVisible();
    await expect(homePage.loginLink).toBeHidden();
  });

  test('@p2 Opening the login page while signed in redirects to the home page', async ({
    page,
  }) => {
    await loginPage.loginAsAdmin();

    await loginPage.goto();

    await expect(page).toHaveURL('/');
    await expect(homePage.logoutButton).toBeVisible();
  });

  test('@p3 A wrong password is rejected with a generic error', async ({ page }) => {
    await loginPage.goto();

    await loginPage.submitCredentials(
      adminCredentials.username,
      rejectedCredentials.wrongPassword,
    );

    await expect(loginPage.errorMessage).toHaveText(GENERIC_LOGIN_ERROR);
    await expect(page).toHaveURL(/\/login$/);
    expect(await getSessionCookie(page)).toBeUndefined();
  });

  test('@p3 An unknown username is rejected with the same generic error', async ({
    page,
  }) => {
    await loginPage.goto();

    await loginPage.submitCredentials(
      rejectedCredentials.unknownUsername,
      adminCredentials.password,
    );

    // The message must not reveal whether the username exists.
    await expect(loginPage.errorMessage).toHaveText(GENERIC_LOGIN_ERROR);
    await expect(page).toHaveURL(/\/login$/);
  });

  test('@p3 An empty form asks for both fields without calling the API', async ({
    page,
  }) => {
    let loginRequests = 0;
    page.on('request', (request) => {
      if (new URL(request.url()).pathname === '/api/login') {
        loginRequests += 1;
      }
    });
    await loginPage.goto();
    await expect(loginPage.submitButton).toBeEnabled();

    await loginPage.submitEmptyForm();

    await expect(loginPage.errorMessage).toHaveText(
      'Please enter both a username and a password.',
    );
    expect(loginRequests).toBe(0);
  });

  test('@p3 A whitespace-only username is treated as empty', async ({ page }) => {
    await loginPage.goto();

    await loginPage.submitCredentials('   ', adminCredentials.password);

    await expect(loginPage.errorMessage).toHaveText(
      'Please enter both a username and a password.',
    );
    await expect(page).toHaveURL(/\/login$/);
  });

  test('@p4 A failing login API shows a retry message and keeps the admin out', async ({
    page,
  }) => {
    await page.route('**/api/login', (route) =>
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ detail: 'Internal Server Error' }),
      }),
    );
    await loginPage.goto();

    await loginPage.submitCredentials(
      adminCredentials.username,
      adminCredentials.password,
    );

    await expect(loginPage.errorMessage).toHaveText(
      'Something went wrong. Please try again.',
    );
    await expect(loginPage.submitButton).toBeEnabled();
    expect(await getSessionCookie(page)).toBeUndefined();
  });
});
