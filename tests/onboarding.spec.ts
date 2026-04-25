import { test, expect } from '@playwright/test';
import {
  SCREENSHOT_DIR,
  attachErrorWatchers,
  clearStorage,
  seedFullProgressSave,
  waitForGame,
  waitForScene,
} from './helpers/playwright';

test.describe('Onboarding flow', () => {
  test('fresh save shows welcome modal — confirm dismisses it', async ({ page }) => {
    await clearStorage(page);
    const errors = attachErrorWatchers(page);

    await page.goto('/');
    await waitForGame(page);
    await waitForScene(page, 'MenuScene');

    // Start a new game (no save → fresh state).
    await page.keyboard.press('Enter');
    await waitForScene(page, 'ElevatorScene');

    // On a fresh save the welcome modal should appear; onboardingComplete is
    // not yet set in localStorage at this point.
    const beforeConfirm = await page.evaluate(() => {
      try {
        const raw = window.localStorage.getItem('architect_default_v1');
        if (!raw) return null;
        return JSON.parse(raw) as { onboardingComplete?: boolean };
      } catch { return null; }
    });
    // Either the save hasn't been written yet (null) or onboardingComplete is
    // false / absent — the welcome modal was shown.
    expect(beforeConfirm?.onboardingComplete).not.toBe(true);

    // Dismiss the welcome modal via Enter (Confirm action, mapped in WelcomeModal).
    await page.keyboard.press('Enter');

    // After confirming, onboardingComplete should be persisted as true.
    await page.waitForFunction(() => {
      try {
        const raw = window.localStorage.getItem('architect_default_v1');
        if (!raw) return false;
        const data = JSON.parse(raw) as { onboardingComplete?: boolean };
        return data.onboardingComplete === true;
      } catch { return false; }
    }, undefined, { timeout: 5_000 });

    await page.screenshot({ path: `${SCREENSHOT_DIR}/onboarding-after-confirm.png` });
    errors.assertClean();
  });

  test('second load (existing save with onboardingComplete=true) skips tutorial', async ({ page }) => {
    // Seed a save with onboardingComplete already set.
    await page.addInitScript(() => {
      try {
        const save = {
          totalAU: 5,
          floorAU: { 0: 5, 1: 0 },
          unlockedFloors: [0, 1],
          currentFloor: 0,
          collectedTokens: { 0: [], 1: [] },
          onboardingComplete: true,
        };
        window.localStorage.setItem('architect_default_v1', JSON.stringify(save));
        window.localStorage.setItem('architect_info_seen_v1', JSON.stringify(['welcome-board']));
      } catch { /* noop */ }
    });
    const errors = attachErrorWatchers(page);

    await page.goto('/');
    await waitForGame(page);
    await waitForScene(page, 'MenuScene');

    // Load existing save: index 0 is [ START GAME ], [ CONTINUE ] is index 1.
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    await waitForScene(page, 'ElevatorScene');

    // onboardingComplete is true — no welcome modal should have reset it.
    const afterLoad = await page.evaluate(() => {
      try {
        const raw = window.localStorage.getItem('architect_default_v1');
        if (!raw) return null;
        return JSON.parse(raw) as { onboardingComplete?: boolean };
      } catch { return null; }
    });
    expect(afterLoad?.onboardingComplete).toBe(true);

    errors.assertClean();
  });

  test('Settings scene has a Replay Tutorial button that resets onboarding', async ({ page }) => {
    await seedFullProgressSave(page);
    // Mark onboarding as complete so it's already set.
    await page.addInitScript(() => {
      try {
        const raw = window.localStorage.getItem('architect_default_v1');
        if (!raw) return;
        const data = JSON.parse(raw) as Record<string, unknown>;
        data['onboardingComplete'] = true;
        window.localStorage.setItem('architect_default_v1', JSON.stringify(data));
      } catch { /* noop */ }
    });
    const errors = attachErrorWatchers(page);

    await page.goto('/');
    await waitForGame(page);
    await waitForScene(page, 'MenuScene');

    // Navigate to settings via wrap-around: ArrowUp from index 0 wraps to the
    // last item ([ SETTINGS ]), regardless of how many conditional buttons exist.
    await page.keyboard.press('ArrowUp');
    await page.keyboard.press('Enter');
    await waitForScene(page, 'SettingsScene');

    // Press Enter to activate "Replay Tutorial" (first item = index 0).
    await page.keyboard.press('Enter');

    // Should return to MenuScene.
    await waitForScene(page, 'MenuScene');

    // onboardingComplete should now be false in localStorage.
    const afterReset = await page.evaluate(() => {
      try {
        const raw = window.localStorage.getItem('architect_default_v1');
        if (!raw) return null;
        return JSON.parse(raw) as { onboardingComplete?: boolean };
      } catch { return null; }
    });
    expect(afterReset?.onboardingComplete).toBe(false);

    errors.assertClean();
  });
});
