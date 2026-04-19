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

  test('F1 decor is side-specific, non-overlapping, and animated on both sides', async ({ page }) => {
    const errors = attachErrorWatchers(page);

    await page.goto('/');
    await waitForGame(page);
    await waitForScene(page, 'MenuScene');

    await page.keyboard.press('Enter');
    await waitForScene(page, 'ElevatorScene');

    const result = await page.evaluate(() => {
      type Bounds = { left: number; right: number; top: number; bottom: number };
      type Decor = { name: string; bounds: Bounds; hasTween: boolean };

      const g = window.__game!;
      const scene = g.scene
        .getScenes(true)
        .find((s) => s.sys.settings.key === 'ElevatorScene') as unknown as Record<string, unknown>;
      if (!scene) throw new Error('ElevatorScene not active');

      const children = (scene['children'] as { list: unknown[] }).list;
      const tweens = scene['tweens'] as { getTweensOf: (target: unknown) => unknown[] };

      const toDecor = (prefix: string): Decor[] => children
        .filter((obj): obj is Record<string, unknown> => {
          const name = obj['name'];
          return typeof name === 'string' && name.startsWith(prefix);
        })
        .map((obj) => {
          const getBounds = obj['getBounds'] as (() => { x: number; y: number; width: number; height: number });
          const b = getBounds.call(obj);
          return {
            name: String(obj['name']),
            bounds: { left: b.x, right: b.x + b.width, top: b.y, bottom: b.y + b.height },
            hasTween: tweens.getTweensOf(obj).length > 0,
          };
        });

      const left = toDecor('f1-left-');
      const right = toDecor('f1-right-');
      const excludedSpatialDecor = new Set(['f1-right-adr-cursor', 'f1-right-slice-highlight']);
      const leftSpatialDecor = left.filter((d) => !excludedSpatialDecor.has(d.name));
      const rightSpatialDecor = right.filter((d) => !excludedSpatialDecor.has(d.name));

      const intersects = (a: Bounds, b: Bounds): boolean =>
        a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;

      const findOverlaps = (items: Decor[]): Array<[string, string]> => {
        const out: Array<[string, string]> = [];
        for (let i = 0; i < items.length; i++) {
          for (let j = i + 1; j < items.length; j++) {
            if (intersects(items[i].bounds, items[j].bounds)) {
              out.push([items[i].name, items[j].name]);
            }
          }
        }
        return out;
      };

      const gameWidth = (scene['scale'] as { width: number }).width;
      const layout = scene['layout'] as { deps?: { shaftWidth?: unknown } } | undefined;
      const shaftWidth = layout?.deps?.shaftWidth;
      if (typeof shaftWidth !== 'number') {
        throw new Error('ElevatorScene layout.deps.shaftWidth is unavailable');
      }
      const cx = gameWidth / 2;
      const leftEdge = cx - shaftWidth / 2;
      const rightEdge = cx + shaftWidth / 2;
      const leftNames = left.map((d) => d.name);
      const rightNames = right.map((d) => d.name);
      const expectedLeft = ['f1-left-server-rack-1', 'f1-left-router'];
      const expectedRight = ['f1-right-c4-board', 'f1-right-adr-terminal', 'f1-right-slice-panel'];

      return {
        leftCount: left.length,
        rightCount: right.length,
        leftOverlaps: findOverlaps(leftSpatialDecor),
        rightOverlaps: findOverlaps(rightSpatialDecor),
        leftOutOfSide: leftSpatialDecor.filter((d) => d.bounds.right > leftEdge).map((d) => d.name),
        rightOutOfSide: rightSpatialDecor.filter((d) => d.bounds.left < rightEdge).map((d) => d.name),
        missingExpectedLeft: expectedLeft.filter((name) => !leftNames.includes(name)),
        missingExpectedRight: expectedRight.filter((name) => !rightNames.includes(name)),
        leftAnimated: left.filter((d) => d.hasTween).map((d) => d.name),
        rightAnimated: right.filter((d) => d.hasTween).map((d) => d.name),
      };
    });

    expect(result.leftCount).toBeGreaterThan(0);
    expect(result.rightCount).toBeGreaterThan(0);
    expect(result.leftOverlaps).toEqual([]);
    expect(result.rightOverlaps).toEqual([]);
    expect(result.leftOutOfSide).toEqual([]);
    expect(result.rightOutOfSide).toEqual([]);
    expect(result.missingExpectedLeft).toEqual([]);
    expect(result.missingExpectedRight).toEqual([]);
    expect(result.leftAnimated.length).toBeGreaterThan(0);
    expect(result.rightAnimated.length).toBeGreaterThan(0);

    await page.screenshot({ path: `${SCREENSHOT_DIR}/05-elevator-f1-decor-layout.png` });
    errors.assertClean();
  });
});
