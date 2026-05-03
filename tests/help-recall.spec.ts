import { test, expect } from '@playwright/test';
import {
  attachErrorWatchers,
  seedFullProgressSave,
  waitForGame,
  waitForScene,
} from './helpers/playwright';

test.describe('Help / How to Play recall', () => {
  test('Settings scene has a How to Play button that opens the welcome modal without altering the first-run flag', async ({ page }) => {
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

    // Confirm onboardingComplete is still true before we interact with Help.
    const beforeHelp = await page.evaluate(() => {
      try {
        const raw = window.localStorage.getItem('architect_slot1_v1');
        if (!raw) return null;
        return JSON.parse(raw) as { onboardingComplete?: boolean };
      } catch { return null; }
    });
    expect(beforeHelp?.onboardingComplete).toBe(true);

    // Navigate to [ HOW TO PLAY ] — it is the 12th item (index 11).
    // From the default selected index 0, pressing ArrowUp wraps to the last
    // item ([ BACK ]), then four more presses reach [ HOW TO PLAY ].
    // 1 → BACK (last), 2 → REPLAY TUTORIAL, 3 → CONTROLS, 4 → SHOW TOUCH HINT, 5 → HOW TO PLAY
    for (let i = 0; i < 5; i++) {
      await page.keyboard.press('ArrowUp');
    }
    // Activate [ HOW TO PLAY ].
    await page.keyboard.press('Enter');

    // Wait briefly for the modal open animation (200 ms fade-in).
    await page.waitForTimeout(300);

    // onboardingComplete must still be true — the Help modal must not reset it.
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

    // Wait for the close tween to finish.
    await page.waitForTimeout(300);

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
