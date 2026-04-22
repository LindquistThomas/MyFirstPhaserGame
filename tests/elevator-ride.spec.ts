import { test, expect } from '@playwright/test';
import {
  waitForGame,
  waitForScene,
  clearStorage,
  attachErrorWatchers,
} from './helpers/playwright';

/**
 * Regression: stepping onto the cab and pressing Up must ride the cab.
 *
 * The previous bug: ArrowUp is bound to both `MoveUp` and `ToggleInfo`, and
 * the elevator info zone predicate is `isPlayerOnElevator()`. So pressing
 * Up on the cab opened the info dialog, which then early-returned from
 * the scene update — the cab never moved. Fix gates the info-open branch
 * so ELEVATOR_INFO_ID only opens on Interact (Enter) / pointer.
 */
test.describe('elevator ride controls', () => {
  test.beforeEach(async ({ page }) => {
    await clearStorage(page);
    // Mark the elevator info dialog as seen so it wouldn't have auto-popped
    // regardless of the bug — this keeps the test checking the key binding,
    // not the first-visit auto-open.
    await page.addInitScript(() => {
      try {
        window.localStorage.setItem(
          'architect_info_seen_v1',
          JSON.stringify(['architecture-elevator']),
        );
      } catch { /* noop */ }
    });
  });

  test('pressing Up on the cab rides it upward without opening the info dialog', async ({ page }) => {
    const errors = attachErrorWatchers(page);

    await page.goto('/');
    await waitForGame(page);
    await waitForScene(page, 'MenuScene');
    await page.keyboard.press('Enter');
    await waitForScene(page, 'ElevatorScene');

    // Teleport the player onto the cab and force the latch on directly —
    // avoids flakiness from walking across the lobby + onto the shaft.
    await page.evaluate(() => {
      const g = window.__game as unknown as {
        scene: { getScenes: (a?: boolean) => { sys: { settings: { key: string } } }[] };
      };
      const scene = g.scene
        .getScenes(true)
        .find((s) => s.sys.settings.key === 'ElevatorScene') as unknown as Record<string, unknown>;
      const ctrl = scene['elevatorCtrl'] as {
        elevator: { platform: { x: number; y: number } };
      } & Record<string, unknown>;
      const player = scene['player'] as { sprite: { x: number; y: number; body: { y: number } } };
      // Park the player dead center of the cab.
      player.sprite.x = ctrl.elevator.platform.x;
      player.sprite.y = ctrl.elevator.platform.y - 60;
      // Force the sticky on-elevator latch on so the first update tick
      // treats the rider as mounted without needing a collision step.
      (ctrl as Record<string, unknown>)['playerOnElevator'] = true;
    });

    const cabYBefore = await page.evaluate(() => {
      const g = window.__game as unknown as {
        scene: { getScenes: (a?: boolean) => { sys: { settings: { key: string } } }[] };
      };
      const scene = g.scene
        .getScenes(true)
        .find((s) => s.sys.settings.key === 'ElevatorScene') as unknown as Record<string, unknown>;
      const ctrl = scene['elevatorCtrl'] as { elevator: { platform: { y: number } } };
      return ctrl.elevator.platform.y;
    });

    // Hold ArrowUp for long enough to ramp past the commit threshold.
    await page.keyboard.down('ArrowUp');
    await page.waitForTimeout(800);
    await page.keyboard.up('ArrowUp');

    const state = await page.evaluate(() => {
      const g = window.__game as unknown as {
        scene: { getScenes: (a?: boolean) => { sys: { settings: { key: string } } }[] };
      };
      const scene = g.scene
        .getScenes(true)
        .find((s) => s.sys.settings.key === 'ElevatorScene') as unknown as Record<string, unknown>;
      const ctrl = scene['elevatorCtrl'] as { elevator: { platform: { y: number } } };
      const dialogs = scene['dialogs'] as { isOpen: boolean };
      return { cabY: ctrl.elevator.platform.y, dialogOpen: dialogs.isOpen };
    });

    expect(state.dialogOpen, 'Up on cab must not open the info dialog').toBe(false);
    expect(state.cabY, 'Cab must have moved upward (decreased Y)').toBeLessThan(cabYBefore - 50);

    errors.assertClean();
  });

  test('pressing Enter on the cab opens the elevator info dialog', async ({ page }) => {
    const errors = attachErrorWatchers(page);

    await page.goto('/');
    await waitForGame(page);
    await waitForScene(page, 'MenuScene');
    await page.keyboard.press('Enter');
    await waitForScene(page, 'ElevatorScene');

    await page.evaluate(() => {
      const g = window.__game as unknown as {
        scene: { getScenes: (a?: boolean) => { sys: { settings: { key: string } } }[] };
      };
      const scene = g.scene
        .getScenes(true)
        .find((s) => s.sys.settings.key === 'ElevatorScene') as unknown as Record<string, unknown>;
      const ctrl = scene['elevatorCtrl'] as { elevator: { platform: { x: number; y: number } } };
      const player = scene['player'] as { sprite: { x: number; y: number } };
      player.sprite.x = ctrl.elevator.platform.x;
      player.sprite.y = ctrl.elevator.platform.y - 60;
      (ctrl as Record<string, unknown>)['playerOnElevator'] = true;
    });

    await page.keyboard.press('Enter');
    await page.waitForFunction(() => {
      const g = window.__game;
      if (!g) return false;
      const scene = g.scene
        .getScenes(true)
        .find((s) => s.sys.settings.key === 'ElevatorScene') as unknown as Record<string, unknown>;
      const dialogs = scene?.['dialogs'] as { isOpen: boolean } | undefined;
      return !!dialogs && dialogs.isOpen === true;
    }, undefined, { timeout: 5000 });

    errors.assertClean();
  });
});
