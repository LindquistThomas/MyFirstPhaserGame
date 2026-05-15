import { test, expect } from '@playwright/test';
import {
  attachErrorWatchers,
  clearStorage,
  navigateToElevator,
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

  test('info dialog opens from the elevator info action', async ({ page }) => {
    const errors = attachErrorWatchers(page);

    await page.goto('/');
    await waitForGame(page);
    await waitForScene(page, 'MenuScene');

    await navigateToElevator(page);

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

    errors.assertClean();
  });

  test('locked floor call shows AU requirement toast at 0 AU', async ({ page }) => {
    const errors = attachErrorWatchers(page);

    await page.goto('/');
    await waitForGame(page);
    await waitForScene(page, 'MenuScene');
    await navigateToElevator(page);
    await waitForScene(page, 'ElevatorScene');

    // Products floor is locked on a fresh save (requires 9 AU).
    await page.evaluate(() => {
      const g = window.__game!;
      const scene = g.scene
        .getScenes(true)
        .find((s) => s.sys.settings.key === 'ElevatorScene') as unknown as Record<string, unknown>;
      if (!scene) throw new Error('ElevatorScene not active');
      const ctrl = scene['elevatorCtrl'] as { requestFloor: (floorId: number) => boolean };
      ctrl.requestFloor(5);
    });

    const expectedToast = 'Products locked — need 9 AU (you have 0/9)';
    await page.waitForFunction(
      (expected) => {
        const g = window.__game;
        if (!g) return false;
        const scene = g.scene
          .getScenes(true)
          .find((s) => s.sys.settings.key === 'ElevatorScene') as unknown as Record<string, unknown>;
        if (!scene) return false;
        const lockedToast = scene['lockedFloorToast'] as { toast?: { getMessage: () => string; isVisible: () => boolean } };
        const toast = lockedToast?.toast;
        return !!toast && toast.isVisible() && toast.getMessage() === expected;
      },
      expectedToast,
      { timeout: 10_000 },
    );

    errors.assertClean();
  });

});
