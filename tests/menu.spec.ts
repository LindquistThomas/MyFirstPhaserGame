import { test, expect } from '@playwright/test';
import {
  SCREENSHOT_DIR,
  attachErrorWatchers,
  clearStorage,
  seedFullProgressSave,
  waitForGame,
  waitForScene,
} from './helpers/playwright';

test.describe('Menu scene', () => {
  test('renders the title and start button', async ({ page }) => {
    await clearStorage(page);
    const errors = attachErrorWatchers(page);

    await page.goto('/');
    await waitForGame(page);
    await waitForScene(page, 'MenuScene');

    await expect(page).toHaveTitle(/Architect/i);
    await expect(page.locator('canvas').first()).toBeVisible();

    await page.screenshot({ path: `${SCREENSHOT_DIR}/01-menu.png`, fullPage: false });
    errors.assertClean();
  });

  test('continues from a seeded save into the elevator', async ({ page }) => {
    await clearStorage(page);
    await seedFullProgressSave(page);
    const errors = attachErrorWatchers(page);

    await page.goto('/');
    await waitForGame(page);
    await waitForScene(page, 'MenuScene');

    // Down + Enter selects the Continue button (Start Game is the default).
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    await waitForScene(page, 'ElevatorScene');

    errors.assertClean();
  });
});
