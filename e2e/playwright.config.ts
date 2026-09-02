import { defineConfig, devices } from '@playwright/test';

// Same-origin as the Angular dev server so that /api requests go through its
// proxy and the HttpOnly `session` cookie is stored by the browser context.
const baseURL = process.env.E2E_BASE_URL ?? 'http://localhost:4200';

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [['list'], ['html', { open: 'never' }]],

  use: {
    baseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],

  webServer: {
    // The root `run` script starts FastAPI (:8000) and Angular (:4200) together.
    command: './run',
    cwd: '..',
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    // First run may create the backend virtualenv and build the Angular app.
    timeout: 240_000,
    stdout: 'pipe',
    stderr: 'pipe',
  },
});
