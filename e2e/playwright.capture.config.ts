import { defineConfig } from '@playwright/test';

import baseConfig from './playwright.config';

// Used to run specs that were just authored for a pull request, so a reviewer
// can watch how they behave. The shared config keeps video and screenshots
// only on failure, which leaves a passing new test with nothing to show — here
// everything is captured whatever the outcome. Retries stay off so each test
// produces exactly one video instead of one per attempt.
export default defineConfig({
  ...baseConfig,
  outputDir: './test-results-new',
  retries: 0,
  reporter: [
    ['list'],
    ['html', { open: 'never', outputFolder: 'playwright-report-new' }],
  ],
  use: {
    ...baseConfig.use,
    trace: 'on',
    video: 'on',
    screenshot: 'on',
  },
});
