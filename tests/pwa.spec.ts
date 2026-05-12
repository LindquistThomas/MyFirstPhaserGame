import { expect, test } from '@playwright/test';
import { waitForGame } from './helpers/playwright';

test.describe('PWA service worker', () => {
  test.skip(!process.env.CI, 'Runs against preview server on CI.');

  test('registers and controls the page', async ({ page }) => {
    await page.goto('/');
    await waitForGame(page);
    await page.waitForFunction(() => navigator.serviceWorker.controller !== null, undefined, {
      timeout: 30_000,
    });
    expect(await page.evaluate(() => navigator.serviceWorker.controller !== null)).toBe(true);
  });

  test('unregisters with nosw=1', async ({ page }) => {
    await page.goto('/');
    await waitForGame(page);
    await page.waitForFunction(() => navigator.serviceWorker.controller !== null, undefined, {
      timeout: 30_000,
    });

    await page.goto('/?nosw=1');
    await waitForGame(page);
    await expect
      .poll(() =>
        page.evaluate(async () => {
          const registrations = await navigator.serviceWorker.getRegistrations();
          return registrations.length === 0;
        }),
      )
      .toBe(true);
  });
});
