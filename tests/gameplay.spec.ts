import { test, expect, Page } from '@playwright/test';

/**
 * Gameplay screenshot tests.
 *
 * These tests walk through the main scenes of the game and capture PNG
 * screenshots of each one into `tests/screenshots/`. They are intended as
 * a visual sanity-check that implemented features actually render — they
 * deliberately do NOT use snapshot/pixel-diff assertions because sprites
 * are generated procedurally and small differences between runs are
 * expected. If you want pixel-perfect regressions, swap the `toHaveScreenshot`
 * calls back in — the scaffolding is ready.
 */

const SCREENSHOT_DIR = 'tests/screenshots';

/** Minimal shape of the bits of the Phaser Game we touch from tests. */
interface PhaserSceneLike {
  sys: { settings: { key: string } };
  scene: { start: (key: string, data?: unknown) => void };
}
interface PhaserLike {
  scene: {
    getScenes: (active?: boolean) => PhaserSceneLike[];
    isActive: (key: string) => boolean;
    stop: (key: string) => void;
    start: (key: string, data?: unknown) => void;
  };
  registry: {
    get: (key: string) => unknown;
    set: (key: string, value: unknown) => void;
  };
}

declare global {
  interface Window {
    __game?: PhaserLike;
  }
}

/** Wait until the Phaser game instance has been attached to `window.__game`. */
async function waitForGame(page: Page): Promise<void> {
  await page.waitForFunction(() => !!window.__game, undefined, { timeout: 30_000 });
  // Ensure the game canvas has focus so keyboard input reaches Phaser.
  await page.locator('canvas').first().click({ position: { x: 10, y: 10 } });
}

/** Wait until a specific Phaser scene is active (its `create()` has run). */
async function waitForScene(page: Page, sceneKey: string): Promise<void> {
  await page.waitForFunction(
    (key) => !!window.__game && window.__game.scene.isActive(key),
    sceneKey,
    { timeout: 30_000 },
  );
  // Give Phaser a few frames to finish fading in / rendering.
  await page.waitForTimeout(800);
}

/**
 * Jump to a scene from the currently-active scene using Phaser's
 * ScenePlugin — this follows the same path the game itself uses for
 * in-game transitions (e.g. `this.scene.start(fd.sceneKey)` in HubScene).
 */
async function gotoScene(page: Page, sceneKey: string, data?: unknown): Promise<void> {
  await page.evaluate(
    ({ key, payload }) => {
      const g = window.__game;
      if (!g) throw new Error('game not ready');
      const active = g.scene
        .getScenes(true)
        .filter((s) => s.sys.settings.key !== 'BootScene');
      const from = active[active.length - 1];
      if (!from) throw new Error('no active scene to transition from');
      from.scene.start(key, payload);
    },
    { key: sceneKey, payload: data },
  );
  await waitForScene(page, sceneKey);
}

/**
 * Pre-populate a save slot so floors unlock without having to grind tokens,
 * and mark the elevator info point as already seen so it doesn't pop a
 * dialog on first ride (which would block keyboard input in tests).
 */
async function seedFullProgressSave(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const save = {
      totalAU: 50,
      floorAU: { 0: 0, 1: 25, 2: 25 },
      unlockedFloors: [0, 1, 2],
      currentFloor: 0,
      collectedTokens: { 0: [], 1: [], 2: [] },
    };
    try {
      window.localStorage.setItem('architect_default_v1', JSON.stringify(save));
      window.localStorage.setItem(
        'architect_info_seen_v1',
        JSON.stringify(['architecture-elevator']),
      );
    } catch {
      /* localStorage blocked — ignore */
    }
  });
}

test.describe('Gameplay screenshots', () => {
  test.beforeEach(async ({ page }) => {
    // Fresh slate for each test.
    await page.addInitScript(() => {
      try { window.localStorage.clear(); } catch { /* noop */ }
    });
    // Surface runtime errors in the Playwright output so failures are easy to
    // diagnose — Phaser swallows a lot of errors inside its own callbacks.
    page.on('pageerror', (err) => console.error('[page error]', err.message));
    page.on('console', (msg) => {
      if (msg.type() === 'error') console.error('[console]', msg.text());
    });
  });

  test('menu scene renders the title and start button', async ({ page }) => {
    await page.goto('/');
    await waitForGame(page);
    await waitForScene(page, 'MenuScene');

    await expect(page).toHaveTitle(/Architect/i);
    await page.screenshot({ path: `${SCREENSHOT_DIR}/01-menu.png`, fullPage: false });
  });

  test('hub (elevator shaft) renders with lobby in view', async ({ page }) => {
    await page.goto('/');
    await waitForGame(page);
    await waitForScene(page, 'MenuScene');

    // Click START GAME to enter the hub.
    await page.keyboard.press('Space');
    await waitForScene(page, 'HubScene');

    await page.screenshot({ path: `${SCREENSHOT_DIR}/02-hub-lobby.png` });
  });

  test('elevator info dialog pops on first ride', async ({ page }) => {
    await page.goto('/');
    await waitForGame(page);
    await waitForScene(page, 'MenuScene');

    await page.keyboard.press('Space');
    await waitForScene(page, 'HubScene');

    // Step onto the elevator and wait for the first-time info dialog.
    await page.waitForTimeout(500);
    await page.keyboard.down('ArrowUp');
    await page.waitForTimeout(600);
    await page.keyboard.up('ArrowUp');
    await page.waitForTimeout(1000);

    await page.screenshot({ path: `${SCREENSHOT_DIR}/03-elevator-info-dialog.png` });
  });

  test('floor 1 (platform team) renders with platforms and tokens', async ({ page }) => {
    await seedFullProgressSave(page);
    await page.goto('/');
    await waitForGame(page);
    await waitForScene(page, 'MenuScene');

    // Continue so Floor 1 is already unlocked via the pre-seeded save.
    await page.keyboard.press('Enter');
    await waitForScene(page, 'HubScene');
    await page.waitForTimeout(600);

    // Use HubScene's own private enterFloor() method (accessible via bracket
    // notation in compiled JS) — mirrors exactly what the game does when the
    // player walks off the elevator, including the fade-out transition.
    await page.evaluate(() => {
      const g = window.__game!;
      const hub = g.scene
        .getScenes(true)
        .find((s) => s.sys.settings.key === 'HubScene') as unknown as Record<string, unknown>;
      if (!hub) throw new Error('HubScene not active');
      (hub['enterFloor'] as (id: number) => void)(1);
    });
    await waitForScene(page, 'Floor1Scene');
    await page.waitForTimeout(900);
    await page.screenshot({ path: `${SCREENSHOT_DIR}/04-floor1-platform-team.png` });
  });

  test('floor 2 (cloud team) renders after progression unlock', async ({ page }) => {
    await seedFullProgressSave(page);
    await page.goto('/');
    await waitForGame(page);
    await waitForScene(page, 'MenuScene');

    await page.keyboard.press('Enter');
    await waitForScene(page, 'HubScene');
    await page.waitForTimeout(600);

    await page.evaluate(() => {
      const g = window.__game!;
      const hub = g.scene
        .getScenes(true)
        .find((s) => s.sys.settings.key === 'HubScene') as unknown as Record<string, unknown>;
      if (!hub) throw new Error('HubScene not active');
      (hub['enterFloor'] as (id: number) => void)(2);
    });
    await waitForScene(page, 'Floor2Scene');
    await page.waitForTimeout(900);
    await page.screenshot({ path: `${SCREENSHOT_DIR}/05-floor2-cloud-team.png` });
  });

  test('HUD shows AU counter after some progress', async ({ page }) => {
    await seedFullProgressSave(page);
    await page.goto('/');
    await waitForGame(page);
    await waitForScene(page, 'MenuScene');

    await page.keyboard.press('Enter');
    await waitForScene(page, 'HubScene');
    await page.waitForTimeout(400);
    // The HUD is a scroll-fixed overlay; a fresh screenshot focused on the
    // top-left captures it clearly.
    await page.screenshot({
      path: `${SCREENSHOT_DIR}/06-hud-au-counter.png`,
      clip: { x: 0, y: 0, width: 640, height: 120 },
    });
  });
});
