import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright configuration for gameplay screenshot tests.
 *
 * The `webServer` entry boots the Vite dev server on port 3000 before the
 * tests run, and tears it down afterwards. Tests capture PNG screenshots of
 * each scene into `tests/screenshots/` so reviewers can see how the game
 * actually looks when a feature is implemented.
 */
export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  workers: 2,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
  timeout: 60_000,
  expect: { timeout: 10_000 },

  use: {
    baseURL: 'http://localhost:3000',
    viewport: { width: 1280, height: 960 },
    trace: 'retain-on-failure',
    video: 'retain-on-failure',
    screenshot: 'only-on-failure',
    // Headless by default — deterministic pixel output for snapshots.
    headless: true,
  },

  projects: [
    {
      name: 'chromium',
      // Spread the Desktop Chrome preset for its user-agent, then re-assert
      // the viewport — the preset bundles `viewport: 1280×720` which would
      // otherwise override the global 1280×960 and letterbox the 4:3 canvas.
      use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 960 } },
    },
  ],

  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    stdout: 'ignore',
    stderr: 'pipe',
  },
});
