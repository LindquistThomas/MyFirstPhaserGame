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

    // Navigate to [ HOW TO PLAY ] — from the default selection (index 0),
    // pressing ArrowUp wraps to the last item ([ BACK ]), then four more
    // presses arrive at [ HOW TO PLAY ]:
    //   1 → BACK, 2 → REPLAY TUTORIAL, 3 → CONTROLS, 4 → SHOW TOUCH HINT, 5 → HOW TO PLAY
    for (let i = 0; i < 5; i++) {
      await page.keyboard.press('ArrowUp');
    }

    // Assert the correct item is selected before pressing Enter, so failures
    // surface as "wrong item selected" rather than silently exercising the wrong action.
    await page.waitForFunction(
      () => {
        const g = window.__game;
        if (!g) return false;
        const settings = g.scene
          .getScenes(true)
          .find((s) => s.sys.settings.key === 'SettingsScene') as unknown as Record<string, unknown>;
        if (!settings) return false;
        const items = settings['items'] as Array<{ label?: string }> | undefined;
        const selectedIndex = settings['selectedIndex'] as number | undefined;
        if (!items || selectedIndex === undefined) return false;
        return items[selectedIndex]?.label === '[ HOW TO PLAY ]';
      },
      undefined,
      { timeout: 5_000 },
    );

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

    // Wait deterministically until helpModalOpen guard is cleared — this is
    // set to false by the WelcomeModal onComplete callback and proves both
    // that the modal closed and that SettingsScene resumed correctly.
    await page.waitForFunction(
      () => {
        const g = window.__game;
        if (!g) return false;
        const settings = g.scene
          .getScenes(true)
          .find((s) => s.sys.settings.key === 'SettingsScene') as unknown as Record<string, unknown>;
        if (!settings) return false;
        return settings['helpModalOpen'] === false;
      },
      undefined,
      { timeout: 5_000 },
    );

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
