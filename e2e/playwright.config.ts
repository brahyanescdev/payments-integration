import { defineConfig, devices } from '@playwright/test';

import { apiBaseUrl, apiProcessEnv, harness, webBaseUrl } from './harness.config';

/**
 * End-to-end and integration harness.
 *
 * Playwright drives the same artefacts that get deployed: the compiled API and the
 * production build of the SPA. It does not contribute to the Jest coverage gate —
 * it exists to prove the system works together and to capture the screenshots that
 * accompany every pull request.
 */
export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  forbidOnly: harness.isCi,
  retries: harness.isCi ? 1 : 0,
  workers: 1,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: harness.isCi
    ? [['list'], ['html', { open: 'never' }]]
    : [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: webBaseUrl,
    trace: 'on-first-retry',
    video: 'retain-on-failure',
    // Screenshots are evidence, not retina wallpaper: keeping the scale at 1 keeps
    // the committed PNGs small enough to live in the repository.
    deviceScaleFactor: 1,
  },
  projects: [
    {
      name: 'mobile',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 375, height: 667 },
        isMobile: false,
      },
    },
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } },
    },
  ],
  webServer: [
    {
      command: 'pnpm --filter @payments/api start',
      url: `${apiBaseUrl}/health`,
      cwd: '..',
      reuseExistingServer: !harness.isCi,
      timeout: 120_000,
      env: apiProcessEnv,
      stdout: 'pipe',
      stderr: 'pipe',
    },
    {
      command: 'pnpm --filter @payments/web preview',
      url: webBaseUrl,
      cwd: '..',
      reuseExistingServer: !harness.isCi,
      timeout: 120_000,
      stdout: 'pipe',
      stderr: 'pipe',
    },
  ],
});
