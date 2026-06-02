import { test, expect } from '@playwright/test';
import {
  attachErrorWatchers,
  clearStorage,
  navigateToElevator,
  seedFullProgressSave,
  waitForGame,
  waitForScene,
} from './helpers/playwright';

async function enterPlatformFloor(page: import('@playwright/test').Page): Promise<void> {
  await page.evaluate(() => {
    const g = window.__game!;
    const scene = g.scene
      .getScenes(true)
      .find((s) => s.sys.settings.key === 'ElevatorScene') as unknown as Record<string, unknown>;
    if (!scene) throw new Error('ElevatorScene not active');
    (scene['enterFloor'] as (id: number) => void)(1);
  });
  await waitForScene(page, 'PlatformTeamScene');
}

async function returnToElevator(page: import('@playwright/test').Page): Promise<void> {
  await page.evaluate(() => {
    const g = window.__game!;
    const scene = g.scene
      .getScenes(true)
      .find((s) => s.sys.settings.key === 'PlatformTeamScene');
    if (!scene) throw new Error('PlatformTeamScene not active');
    g.scene.stop('PlatformTeamScene');
    g.scene.start('ElevatorScene');
  });
  await page.waitForFunction(() => window.__game?.scene.isActive('ElevatorScene') === true);
}

async function expectSingleVirtualTapAction(page: import('@playwright/test').Page): Promise<void> {
  await page.evaluate(() => {
    const g = window.__game!;
    const scene = g.scene
      .getScenes(true)
      .find((s) => s.sys.settings.key === 'PlatformTeamScene') as unknown as {
        inputs: {
          on: (action: string, handler: () => void) => void;
          off: (action: string, handler: () => void) => void;
        };
      };
    if (!scene) throw new Error('PlatformTeamScene not active');

    const w = window as unknown as {
      __touchTest?: { jumpTapEvents: number; cleanup?: () => void };
    };
    w.__touchTest?.cleanup?.();
    const handler = (): void => {
      w.__touchTest!.jumpTapEvents += 1;
    };
    w.__touchTest = { jumpTapEvents: 0, cleanup: () => scene.inputs.off('Jump', handler) };
    scene.inputs.on('Jump', handler);
  });

  await page.evaluate(() => {
    const jumpButton = document.querySelector<HTMLElement>('#virtual-pad [data-actions="Jump"]');
    if (!jumpButton) throw new Error('Virtual Jump button not found');
    const touch = new Touch({ identifier: Date.now(), target: jumpButton, clientX: 8, clientY: 8 });
    jumpButton.dispatchEvent(new TouchEvent('touchstart', {
      bubbles: true,
      cancelable: true,
      touches: [touch],
      changedTouches: [touch],
      targetTouches: [touch],
    }));
    jumpButton.dispatchEvent(new TouchEvent('touchend', {
      bubbles: true,
      cancelable: true,
      touches: [],
      changedTouches: [touch],
      targetTouches: [],
    }));
  });

  await page.waitForFunction(() => {
    const w = window as unknown as { __touchTest?: { jumpTapEvents: number } };
    return (w.__touchTest?.jumpTapEvents ?? 0) === 1;
  });

  const jumpTapEvents = await page.evaluate(() => {
    const w = window as unknown as { __touchTest?: { jumpTapEvents: number; cleanup?: () => void } };
    const count = w.__touchTest?.jumpTapEvents ?? 0;
    w.__touchTest?.cleanup?.();
    w.__touchTest = undefined;
    return count;
  });
  expect(jumpTapEvents).toBe(1);
}

/** Call `window.__testHooks.forceShowVirtualGamepad(visible)` from the browser context. */
async function forceGamepad(page: import('@playwright/test').Page, visible: boolean): Promise<void> {
  await page.evaluate((v) => {
    const hooks = (window as unknown as {
      __testHooks?: { forceShowVirtualGamepad: (visible: boolean) => void };
    }).__testHooks;
    if (!hooks) throw new Error('__testHooks not available');
    hooks.forceShowVirtualGamepad(v);
  }, visible);
}

test.describe('Touch controls lifecycle', () => {
  test.beforeEach(async ({ page }) => {
    await clearStorage(page);
    await seedFullProgressSave(page);
    await page.addInitScript(() => {
      try {
        window.localStorage.setItem('architect_touch_override_v1', 'true');
        window.localStorage.setItem('architect_touch_hint_seen_v1', JSON.stringify(true));
      } catch {
        /* noop */
      }
    });
  });

  test('virtual tap dispatches one action per tap across repeated floor round-trips', async ({ page }) => {
    const errors = attachErrorWatchers(page);

    await page.goto('/');
    await waitForGame(page);
    await waitForScene(page, 'MenuScene');
    await navigateToElevator(page);

    await enterPlatformFloor(page);
    await expectSingleVirtualTapAction(page);
    await returnToElevator(page);

    await enterPlatformFloor(page);
    await expectSingleVirtualTapAction(page);

    errors.assertClean();
  });
});

// ---------------------------------------------------------------------------
// Visual regression: gamepad overlay appearance
// ---------------------------------------------------------------------------

/**
 * Snapshot options for touch-gamepad visual tests — looser tolerance than
 * static UI because the game canvas beneath the DOM pad may have minor
 * per-frame variance.
 */
const TOUCH_SNAPSHOT_OPTS = {
  maxDiffPixelRatio: 0.05,
  threshold: 0.3,
  animations: 'disabled' as const,
};

test.describe('@visual Touch gamepad snapshots', () => {
  test.beforeEach(async ({ page }) => {
    // Visual baselines are platform-specific (win32 only) and not committed for
    // CI; skip so the non-visual E2E suite stays green everywhere.
    test.skip(!!process.env.CI, 'Visual baselines generated locally via npm run test:visual:update');
    await clearStorage(page);
    await seedFullProgressSave(page);
    // Mark hint as seen so the overlay doesn't appear in snapshots.
    await page.addInitScript(() => {
      try {
        window.localStorage.setItem('architect_touch_hint_seen_v1', JSON.stringify(true));
      } catch { /* noop */ }
    });
  });

  test('MenuScene with virtual gamepad mounted', async ({ page }) => {
    const errors = attachErrorWatchers(page);

    await page.goto('/');
    await waitForGame(page);
    await waitForScene(page, 'MenuScene');

    await forceGamepad(page, true);
    // Allow the pad CSS transition (opacity fade-in) to settle before snapping.
    await page.waitForTimeout(200);

    await expect(page).toHaveScreenshot('touch-gamepad-menu.png', TOUCH_SNAPSHOT_OPTS);
    errors.assertClean();
  });

  test('PlatformTeamScene with virtual gamepad mounted', async ({ page }) => {
    const errors = attachErrorWatchers(page);

    await page.goto('/');
    await waitForGame(page);
    await waitForScene(page, 'MenuScene');
    await navigateToElevator(page);
    await enterPlatformFloor(page);

    await forceGamepad(page, true);
    await page.waitForTimeout(200);

    await expect(page).toHaveScreenshot('touch-gamepad-platform-team.png', TOUCH_SNAPSHOT_OPTS);
    errors.assertClean();
  });
});

// ---------------------------------------------------------------------------
// First-run hint flow
// ---------------------------------------------------------------------------

test.describe('@touch first-run hint', () => {
  test('shows hint on first session, persists seen-flag on dismiss, suppresses on reload', async ({ page }) => {
    // Start with cleared storage so hasSeen = false.
    await clearStorage(page);
    await seedFullProgressSave(page);
    const errors = attachErrorWatchers(page);

    await page.goto('/');
    await waitForGame(page);
    await waitForScene(page, 'MenuScene');

    // Force-mount the gamepad; hint should appear because hasSeen = false.
    await forceGamepad(page, true);

    // Wait for the hint overlay to mount in the DOM.
    await page.waitForSelector('#touch-hint-overlay', { state: 'attached', timeout: 5_000 });

    // Dismiss by dispatching a touchstart on the Jump vpad button
    // (the overlay listens for touchstart on any .vpad-btn via delegation).
    await page.evaluate(() => {
      const btn = document.querySelector<HTMLElement>('#virtual-pad [data-actions~="Jump"]');
      if (!btn) throw new Error('Jump button not found in #virtual-pad');
      const touch = new Touch({ identifier: Date.now(), target: btn, clientX: 4, clientY: 4 });
      btn.dispatchEvent(new TouchEvent('touchstart', {
        bubbles: true, cancelable: true,
        touches: [touch], changedTouches: [touch], targetTouches: [touch],
      }));
    });

    // The overlay fades out (or removes immediately when animations are off).
    await page.waitForSelector('#touch-hint-overlay', { state: 'detached', timeout: 5_000 });

    // The seen flag must be written to localStorage on dismiss.
    const rawFlag = await page.evaluate(() => window.localStorage.getItem('architect_touch_hint_seen_v1'));
    expect(rawFlag).toBe(JSON.stringify(true));

    // On reload, force-mounting again must NOT re-show the hint (hasSeen = true).
    await page.reload();
    await waitForGame(page);
    await waitForScene(page, 'MenuScene');

    await forceGamepad(page, true);
    // Give the hint a chance to appear (it should not).
    await page.waitForTimeout(300);

    const hintVisible = await page.evaluate(() => !!document.getElementById('touch-hint-overlay'));
    expect(hintVisible).toBe(false);

    errors.assertClean();
  });
});

// ---------------------------------------------------------------------------
// D-pad input
// ---------------------------------------------------------------------------

test.describe('@touch d-pad input', () => {
  test.beforeEach(async ({ page }) => {
    await clearStorage(page);
    await seedFullProgressSave(page);
    // Suppress the hint so it doesn't interfere with gameplay.
    await page.addInitScript(() => {
      try {
        window.localStorage.setItem('architect_touch_hint_seen_v1', JSON.stringify(true));
      } catch { /* noop */ }
    });
  });

  test('right d-pad tap moves player rightward in PlatformTeamScene', async ({ page }) => {
    const errors = attachErrorWatchers(page);

    await page.goto('/');
    await waitForGame(page);
    await waitForScene(page, 'MenuScene');
    await navigateToElevator(page);
    await enterPlatformFloor(page);

    // Force-mount the virtual gamepad (no localStorage write).
    await forceGamepad(page, true);

    // Record initial player x position.
    const initialX = await page.evaluate(() => {
      const g = window.__game!;
      const scene = g.scene
        .getScenes(true)
        .find((s) => s.sys.settings.key === 'PlatformTeamScene') as unknown as {
          player: { sprite: { x: number } };
        };
      if (!scene?.player?.sprite) throw new Error('Player sprite not found');
      return scene.player.sprite.x;
    });

    // Hold down the right d-pad button via touchstart.
    await page.evaluate(() => {
      const btn = document.querySelector<HTMLElement>(
        '#virtual-pad [data-actions*="MoveRight"]',
      );
      if (!btn) throw new Error('Right d-pad button not found in #virtual-pad');
      const touch = new Touch({ identifier: Date.now(), target: btn, clientX: 4, clientY: 4 });
      btn.dispatchEvent(new TouchEvent('touchstart', {
        bubbles: true, cancelable: true,
        touches: [touch], changedTouches: [touch], targetTouches: [touch],
      }));
    });

    // Wait until the player has moved at least 5 px to the right.
    await page.waitForFunction(
      (startX: number) => {
        const g = window.__game;
        if (!g) return false;
        const scene = g.scene
          .getScenes(true)
          .find((s) => s.sys.settings.key === 'PlatformTeamScene') as unknown as {
            player?: { sprite?: { x?: number } };
          };
        const x = scene?.player?.sprite?.x;
        return typeof x === 'number' && x > startX + 5;
      },
      initialX,
      { timeout: 5_000 },
    );

    // Release the button.
    await page.evaluate(() => {
      const btn = document.querySelector<HTMLElement>(
        '#virtual-pad [data-actions*="MoveRight"]',
      );
      if (!btn) throw new Error('Right d-pad button not found');
      const touch = new Touch({ identifier: Date.now(), target: btn, clientX: 4, clientY: 4 });
      btn.dispatchEvent(new TouchEvent('touchend', {
        bubbles: true, cancelable: true,
        touches: [], changedTouches: [touch], targetTouches: [],
      }));
    });

    // Confirm final x is greater than initial x.
    const finalX = await page.evaluate(() => {
      const g = window.__game!;
      const scene = g.scene
        .getScenes(true)
        .find((s) => s.sys.settings.key === 'PlatformTeamScene') as unknown as {
          player: { sprite: { x: number } };
        };
      return scene.player.sprite.x;
    });
    expect(finalX).toBeGreaterThan(initialX);

    errors.assertClean();
  });
});
