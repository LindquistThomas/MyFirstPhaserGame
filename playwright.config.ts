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
  // Visual snapshots are platform-specific (only win32 baselines are committed)
  // and intended as a local dev tool. Skip them in CI to keep the pipeline green.
  testIgnore: process.env.CI ? ['**/visual.spec.ts'] : [],
  fullyParallel: true,
  // CI runners (ubuntu-latest) have 4 vCPU. 3 workers over-subscribes and can
  // starve Phaser's frame loop; 1 worker is stable but too slow. 2 workers is
  // the balance point for both reliability and runtime on CI.
  workers: process.env.CI ? 2 : '50%',
  // One retry on CI absorbs rare flake (worker eviction, cold cache miss)
  // without hiding bugs locally where retries stay at 0.
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI
    // On CI, add the `github` reporter so Playwright failures surface as
    // GitHub Actions annotations on the PR check — gives test+line context
    // without needing admin access to download the raw job log.
    ? [['list'], ['github'], ['html', { open: 'never', outputFolder: 'playwright-report' }]]
    : [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
  // 60s is comfortable locally (most tests finish in 5-12s), but CI
  // runners (ubuntu-latest, 4 hyperthreaded vCPU) clock in ~3-5x slower
  // per test — and a few tests that drive through menu → elevator →
  // floor → dialog flows already run 30-35s locally, which at the upper
  // end of that slowdown lands within a few seconds of the 120s
  // ceiling. 180s on CI keeps fast-path local iteration honest while
  // absorbing the legitimate compute gap on the runner.
  timeout: process.env.CI ? 180_000 : 60_000,
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
    // On CI we serve the already-built bundle via `vite preview` —
    // dramatically faster and more stable than `npm run dev`, because Vite
    // in dev mode does on-demand TypeScript transforms per request, and
    // under parallel Playwright workers that would frequently push
    // per-test time uncomfortably close to the CI per-test timeout. The CI
    // workflow runs `npm run build` as its own step before Playwright
    // starts (see ci.yml), so
    // we deliberately do NOT rebuild here — doing so would double the
    // build cost (~15s wasted per run). Locally we keep `npm run dev` so
    // hot-reload works while iterating on tests.
    command: process.env.CI ? 'npm run preview -- --port 3000 --strictPort' : 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    stdout: 'ignore',
    stderr: 'pipe',
  },
});
