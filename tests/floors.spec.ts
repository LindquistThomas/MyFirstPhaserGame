import { test, expect } from '@playwright/test';
import {
  SCREENSHOT_DIR,
  attachErrorWatchers,
  clearStorage,
  seedFullProgressSave,
  waitForDialogClosed,
  waitForDialogOpen,
  waitForGame,
  waitForScene,
} from './helpers/playwright';

/**
 * Floor-1 (Platform Team) content tests.
 *
 * We pre-seed a save with floor 1 unlocked and drive the player into the
 * scene using the same private `enterFloor()` method the game uses when the
 * player walks off the elevator.
 */
test.describe('Floor 1 (Platform Team)', () => {
  test.beforeEach(async ({ page }) => {
    await clearStorage(page);
    await seedFullProgressSave(page);
  });

  test('platform team floor renders with platforms and tokens', async ({ page }) => {
    const errors = attachErrorWatchers(page);

    await page.goto('/');
    await waitForGame(page);
    await waitForScene(page, 'MenuScene');

    await page.keyboard.press('Enter');
    await waitForScene(page, 'ElevatorScene');

    await page.evaluate(() => {
      const g = window.__game!;
      const scene = g.scene
        .getScenes(true)
        .find((s) => s.sys.settings.key === 'ElevatorScene') as unknown as Record<string, unknown>;
      if (!scene) throw new Error('ElevatorScene not active');
      (scene['enterFloor'] as (id: number) => void)(1);
    });
    await waitForScene(page, 'PlatformTeamScene');
    await page.screenshot({ path: `${SCREENSHOT_DIR}/05-floor1-platform-team.png` });

    // Open the info dialog programmatically through the DialogController.
    // Driving the zone-detection path via arrow keys was the original
    // approach but was timing-sensitive and flaky under parallel CI load;
    // this still exercises the real dialog + keyboard-scroll path.
    await page.evaluate(() => {
      const g = window.__game!;
      const scene = g.scene
        .getScenes(true)
        .find((s) => s.sys.settings.key === 'PlatformTeamScene') as unknown as Record<string, unknown>;
      const dialogs = scene['dialogs'] as { open: (id: string) => void };
      dialogs.open('you-build-you-run');
    });
    await waitForDialogOpen(page, 'PlatformTeamScene');

    // The dialog must actually be open before we test scrolling.
    const openBefore = await page.evaluate(() => {
      const g = window.__game!;
      const scene = g.scene
        .getScenes(true)
        .find((s) => s.sys.settings.key === 'PlatformTeamScene') as unknown as Record<string, unknown>;
      const dialogs = scene?.['dialogs'] as { isOpen: boolean } | undefined;
      return !!dialogs && dialogs.isOpen === true;
    });
    expect(openBefore).toBe(true);

    await page.screenshot({ path: `${SCREENSHOT_DIR}/05b-floor1-info-top.png` });

    // Capture the y-coordinates of every nested Container in the display
    // list — InfoDialog's `scrollContent` is one of them, and pressing
    // PageDown changes its y. Comparing the full signature avoids having to
    // reach into private fields by name.
    const collectContainerYs = async (): Promise<number[]> =>
      page.evaluate(() => {
        const g = window.__game!;
        const scene = g.scene
          .getScenes(true)
          .find((s) => s.sys.settings.key === 'PlatformTeamScene') as unknown as {
            children?: { list: unknown[] };
          };
        const ys: number[] = [];
        const visit = (obj: unknown): void => {
          if (!obj || typeof obj !== 'object') return;
          const o = obj as Record<string, unknown>;
          if (typeof o['y'] === 'number' && Array.isArray(o['list'])) {
            ys.push(o['y'] as number);
            (o['list'] as unknown[]).forEach(visit);
          }
        };
        scene.children?.list.forEach(visit);
        return ys;
      });

    const before = await collectContainerYs();
    await page.keyboard.press('PageDown');
    await page.waitForFunction(
      (prev) => {
        const g = window.__game;
        if (!g) return false;
        const scene = g.scene
          .getScenes(true)
          .find((s) => s.sys.settings.key === 'PlatformTeamScene') as unknown as {
            children?: { list: unknown[] };
          };
        const ys: number[] = [];
        const visit = (obj: unknown): void => {
          if (!obj || typeof obj !== 'object') return;
          const o = obj as Record<string, unknown>;
          if (typeof o['y'] === 'number' && Array.isArray(o['list'])) {
            ys.push(o['y'] as number);
            (o['list'] as unknown[]).forEach(visit);
          }
        };
        scene.children?.list.forEach(visit);
        // Any container y moved → scroll has taken effect.
        return ys.length === prev.length && ys.some((y, i) => y !== prev[i]);
      },
      before,
      { timeout: 5_000 },
    );
    await page.keyboard.press('PageDown');
    const after = await collectContainerYs();
    await page.screenshot({ path: `${SCREENSHOT_DIR}/05c-floor1-info-scrolled.png` });

    // At least one nested Container y must have changed — that's the scroll.
    expect(after).not.toEqual(before);

    await page.keyboard.press('Escape');
    await waitForDialogClosed(page, 'PlatformTeamScene');
    errors.assertClean();
  });
});
