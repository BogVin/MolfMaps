import type { Page } from '@playwright/test';

export const SESSION_COOKIE_NAME = 'session';

/**
 * Ask the API who it thinks is signed in. `page.request` shares the browser
 * context's cookie jar, so this reflects the session the UI is actually using.
 */
export async function getApiSessionState(page: Page): Promise<unknown> {
  const response = await page.request.get('/api/session');
  return response.json();
}

export async function getSessionCookie(page: Page) {
  const cookies = await page.context().cookies();
  return cookies.find((cookie) => cookie.name === SESSION_COOKIE_NAME);
}
