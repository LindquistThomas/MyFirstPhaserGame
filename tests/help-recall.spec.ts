import { test, expect } from '@playwright/test';
import {
  attachErrorWatchers,
  seedFullProgressSave,
  waitForGame,
  waitForScene,
} from './helpers/playwright';

test.describe('Help / How to Play recall', () => {
  test('opens welcome modal without altering onboardingComplete flag', async ({ page }) => {
    // Seed a fully-progressed save (onboardingComplete: true) so no modal
    // appears automatically on elevator entry.
    await seedFullProgressSave(page);
    const errors = attachErrorWatchers(page);

    await page.goto('/');
    await waitForGame(page);
    await waitForScene(page, 'MenuScene');

    // Navigate to Settings via the wrap-around shortcut (last button = SETTINGS).
    await page.keyboard.press('ArrowUp');
    await page.keyboard.press('Enter');
    await waitForScene(page, 'SettingsScene');

    // Navigate to [ HOW TO PLAY ] — it is index 11 in the items list.
    // From the default selected index 0, pressing ArrowUp wraps to the last
    // item ([ BACK ]), then four more presses arrive at [ HOW TO PLAY ]:
    //   1 → BACK, 2 → REPLAY TUTORIAL, 3 → CONTROLS, 4 → SHOW TOUCH HINT, 5 → HOW TO PLAY
    for (let i = 0; i < 5; i++) {
      await page.keyboard.press('ArrowUp');
    }
    // Activate [ HOW TO PLAY ] — the WelcomeModal overlays SettingsScene.
    await page.keyboard.press('Enter');

    // onboardingComplete must still be true — the Help modal must not mutate it.
    const duringModal = await page.evaluate(() => {
      try {
        const raw = window.localStorage.getItem('architect_slot1_v1');
        if (!raw) return null;
        return JSON.parse(raw) as { onboardingComplete?: boolean };
      } catch { return null; }
    });
    expect(duringModal?.onboardingComplete).toBe(true);

    // Dismiss the modal with Enter (Confirm binding).
    await page.keyboard.press('Enter');

    // Wait for the SettingsScene to resume (modal close tween + guard reset).
    await page.waitForTimeout(500);

    // onboardingComplete must still be true after dismissal.
    const afterModal = await page.evaluate(() => {
      try {
        const raw = window.localStorage.getItem('architect_slot1_v1');
        if (!raw) return null;
        return JSON.parse(raw) as { onboardingComplete?: boolean };
      } catch { return null; }
    });
    expect(afterModal?.onboardingComplete).toBe(true);

    errors.assertClean();
  });
});
