import { test, expect } from '@playwright/test';
import {
  SCREENSHOT_DIR,
  attachErrorWatchers,
  clearStorage,
  waitForGame,
  waitForScene,
} from './helpers/playwright';

test.describe('Elevator scene', () => {
  test.beforeEach(async ({ page }) => {
    await clearStorage(page);
    // Mark the elevator info point as seen so it doesn't auto-popup and
    // swallow keyboard input in the first-ride flow.
    await page.addInitScript(() => {
      try {
        window.localStorage.setItem(
          'architect_info_seen_v1',
          JSON.stringify(['architecture-elevator']),
        );
      } catch { /* noop */ }
    });
  });

  test('renders with lobby in view after starting from the menu', async ({ page }) => {
    const errors = attachErrorWatchers(page);

    await page.goto('/');
    await waitForGame(page);
    await waitForScene(page, 'MenuScene');

    await page.keyboard.press('Enter');
    await waitForScene(page, 'ElevatorScene');

    await page.screenshot({ path: `${SCREENSHOT_DIR}/02-elevator-lobby.png` });
    errors.assertClean();
  });

  test('info dialog opens from the elevator info action', async ({ page }) => {
    const errors = attachErrorWatchers(page);

    await page.goto('/');
    await waitForGame(page);
    await waitForScene(page, 'MenuScene');

    await page.keyboard.press('Enter');
    await waitForScene(page, 'ElevatorScene');

    // The DialogController lives at `scene.dialogs` (private in TS, reachable
    // via bracket notation at runtime). Opening through it exercises the same
    // path as a real player pressing I in the info zone.
    await page.evaluate(() => {
      const g = window.__game!;
      const scene = g.scene
        .getScenes(true)
        .find((s) => s.sys.settings.key === 'ElevatorScene') as unknown as Record<string, unknown>;
      if (!scene) throw new Error('ElevatorScene not active');
      const dialogs = scene['dialogs'] as { open: (id: string) => void };
      dialogs.open('architecture-elevator');
    });

    await page.waitForFunction(
      () => {
        const g = window.__game;
        if (!g) return false;
        const scene = g.scene
          .getScenes(true)
          .find((s) => s.sys.settings.key === 'ElevatorScene') as unknown as Record<string, unknown>;
        if (!scene) return false;
        const dialogs = scene['dialogs'] as { isOpen: boolean } | undefined;
        return !!dialogs && dialogs.isOpen === true;
      },
      undefined,
      { timeout: 15_000 },
    );

    const dialogOpen = await page.evaluate(() => {
      const g = window.__game!;
      const scene = g.scene
        .getScenes(true)
        .find((s) => s.sys.settings.key === 'ElevatorScene') as unknown as Record<string, unknown>;
      const dialogs = scene['dialogs'] as { isOpen: boolean };
      return dialogs.isOpen;
    });
    expect(dialogOpen).toBe(true);

    await page.screenshot({ path: `${SCREENSHOT_DIR}/04-elevator-info-dialog.png` });
    errors.assertClean();
  });

  test('floor 0 placeholder scene opens and returns to the elevator', async ({ page }) => {
    const errors = attachErrorWatchers(page);

    await page.goto('/');
    await waitForGame(page);
    await waitForScene(page, 'MenuScene');

    await page.keyboard.press('Enter');
    await waitForScene(page, 'ElevatorScene');

    // LobbyScene is the floor-0 placeholder. ElevatorScene doesn't route to
    // it via enterFloor() today, so start it directly — this is exactly what
    // the scene registration exposes.
    await page.evaluate(() => {
      window.__game!.scene.start('LobbyScene');
    });
    await waitForScene(page, 'LobbyScene');
    await page.screenshot({ path: `${SCREENSHOT_DIR}/03-floor0-test-scene.png` });

    // Enter is bound to "Confirm" which returns to ElevatorScene.
    await page.keyboard.press('Enter');
    await waitForScene(page, 'ElevatorScene');
    errors.assertClean();
  });
});
