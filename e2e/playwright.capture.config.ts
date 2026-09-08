import { defineConfig } from '@playwright/test';

import baseConfig from './playwright.config';

// How long Playwright holds each input action on screen. Stretching the run is
// the point: a spec has no think-time — `fill()` sets a whole value at once and
// `click()` fires the moment the element is actionable — so an unpaced login
// flow is over in about three seconds, which is too fast to follow.
const ACTION_ANNOTATION_MS = 1_000;

// Used to run specs authored from a Jira ticket so a reviewer can watch how
// they behave. The shared config keeps video and screenshots only on failure,
// which leaves a passing new test with nothing to show — here everything is
// captured whatever the outcome. Retries stay off so each test produces
// exactly one video instead of one per attempt.
export default defineConfig({
  ...baseConfig,
  outputDir: './test-results-new',
  retries: 0,
  // The annotation delay is charged to the test's own budget, so a spec with
  // many actions would run out of the default 30s. Genuine hangs still surface
  // in the unpaced run that uses the shared config.
  timeout: 120_000,
  reporter: [
    ['list'],
    ['html', { open: 'never', outputFolder: 'playwright-report-new' }],
  ],
  use: {
    ...baseConfig.use,
    trace: 'on',
    screenshot: 'on',
    video: {
      mode: 'on',
      // Matches the Desktop Chrome viewport. Left unset, a 1280x720 viewport is
      // scaled down to fit 800x800 and lands at 800x450, which makes the app's
      // own text hard to read back.
      size: { width: 1280, height: 720 },
      show: {
        // Pauses before each input action to highlight the target element and
        // name the call, so a reviewer sees what was clicked instead of
        // inferring it from a blur. `pointer` draws a cursor that travels from
        // the previous action to the next one.
        actions: { duration: ACTION_ANNOTATION_MS, cursor: 'pointer' },
        // Burns the current `test.step()` title into the frame. The specs
        // already wrap their flows in reviewer-readable steps, so this makes
        // each video narrate itself.
        test: { level: 'step' },
      },
    },
  },
});
