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
      .find((s) => s.sys.settings.key === 'PlatformTeamScene') as unknown as { scene: { start: (key: string) => void } };
    if (!scene) throw new Error('PlatformTeamScene not active');
    scene.scene.start('ElevatorScene');
  });
  await waitForScene(page, 'ElevatorScene');
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
    jumpButton.dispatchEvent(new Event('touchstart', { bubbles: true, cancelable: true }));
    jumpButton.dispatchEvent(new Event('touchend', { bubbles: true, cancelable: true }));
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
