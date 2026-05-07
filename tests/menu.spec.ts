import { test } from '@playwright/test';
import {
  attachErrorWatchers,
  clearStorage,
  navigateToElevator,
  seedFullProgressSave,
  waitForGame,
  waitForScene,
} from './helpers/playwright';

test.describe('Menu scene', () => {
  test('continues from a seeded save into the elevator', async ({ page }) => {
    await clearStorage(page);
    await seedFullProgressSave(page);
    const errors = attachErrorWatchers(page);

    await page.goto('/');
    await waitForGame(page);
    await waitForScene(page, 'MenuScene');

    await navigateToElevator(page);

    errors.assertClean();
  });

  test('keyboard Down Down Enter activates the third menu option', async ({ page }) => {
    await clearStorage(page);
    const errors = attachErrorWatchers(page);

    await page.goto('/');
    await waitForGame(page);
    await waitForScene(page, 'MenuScene');

    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');

    await waitForScene(page, 'SettingsScene');
    errors.assertClean();
  });
});
