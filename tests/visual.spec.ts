import { test, expect, type Page } from '@playwright/test';
import {
  attachErrorWatchers,
  clearStorage,
  seedFullProgressSave,
  waitForGame,
  waitForScene,
} from './helpers/playwright';

/**
 * Visual-regression snapshots for *static UI only* — menus, HUD, dialogs.
 *
 * Procedural gameplay sprites (platforms, enemies, etc.) are intentionally
 * excluded because small frame-timing differences make them too noisy for
 * pixel diffs. Tolerances below are tuned for procedurally-rendered panels
 * that have small anti-aliasing / font-hinting variance between runs.
 */

const SNAPSHOT_OPTS = {
  maxDiffPixelRatio: 0.02,
  threshold: 0.2,
  animations: 'disabled' as const,
};

test.describe('Visual regression (static UI)', () => {
  test.beforeEach(async ({ page }) => {
    await clearStorage(page);
  });

  test('MenuScene — full viewport', async ({ page }) => {
    const errors = attachErrorWatchers(page);

    await page.goto('/');
    await waitForGame(page);
    await waitForScene(page, 'MenuScene');

    await expect(page).toHaveScreenshot('menu.png', SNAPSHOT_OPTS);
    errors.assertClean();
  });

  test('HUD — ElevatorScene HUD overlay clip', async ({ page }) => {
    const errors = attachErrorWatchers(page);

    await seedFullProgressSave(page);
    // Override the default seed with the AU value this test asserts against.
    await page.addInitScript(() => {
      const save = {
        totalAU: 25,
        floorAU: { 0: 0, 1: 25 },
        unlockedFloors: [0, 1],
        currentFloor: 0,
        collectedTokens: { 0: [], 1: [] },
      };
      try {
        window.localStorage.setItem('architect_default_v1', JSON.stringify(save));
      } catch { /* noop */ }
    });

    await page.goto('/');
    await waitForGame(page);
    await waitForScene(page, 'MenuScene');
    await page.keyboard.press('Enter');
    await waitForScene(page, 'ElevatorScene');

    await expect(page).toHaveScreenshot('hud-elevator.png', {
      ...SNAPSHOT_OPTS,
      clip: { x: 0, y: 0, width: 640, height: 120 },
    });
    errors.assertClean();
  });

  test('InfoDialog — architecture-elevator in ElevatorScene', async ({ page }) => {
    const errors = attachErrorWatchers(page);

    await seedFullProgressSave(page);

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
      const dialogs = scene['dialogs'] as { open: (id: string) => void };
      dialogs.open('architecture-elevator');
    });

    await page.waitForFunction(() => {
      const g = window.__game;
      if (!g) return false;
      const scene = g.scene
        .getScenes(true)
        .find((s) => s.sys.settings.key === 'ElevatorScene') as unknown as Record<string, unknown>;
      if (!scene) return false;
      const dialogs = scene['dialogs'] as { isOpen: boolean } | undefined;
      return !!dialogs && dialogs.isOpen === true;
    }, undefined, { timeout: 15_000 });

    await expect(page).toHaveScreenshot('info-dialog-architecture-elevator.png', SNAPSHOT_OPTS);
    errors.assertClean();
  });

  test('QuizDialog — architecture-elevator quiz', async ({ page }) => {
    const errors = attachErrorWatchers(page);

    await seedFullProgressSave(page);

    await page.goto('/');
    await waitForGame(page);
    await waitForScene(page, 'MenuScene');
    await page.keyboard.press('Enter');
    await waitForScene(page, 'ElevatorScene');

    // DialogController.openQuiz is private; reach it by bracket notation at
    // runtime. Calling it directly (no info dialog open first) bypasses the
    // `if (this.dialogOpen) return` guard because the flag is still false.
    await page.evaluate(() => {
      const g = window.__game!;
      const scene = g.scene
        .getScenes(true)
        .find((s) => s.sys.settings.key === 'ElevatorScene') as unknown as Record<string, unknown>;
      if (!scene) throw new Error('ElevatorScene not active');
      const dialogs = scene['dialogs'] as Record<string, unknown>;
      (dialogs['openQuiz'] as (id: string) => void).call(dialogs, 'architecture-elevator');
    });

    await page.waitForFunction(() => {
      const g = window.__game;
      if (!g) return false;
      const scene = g.scene
        .getScenes(true)
        .find((s) => s.sys.settings.key === 'ElevatorScene') as unknown as Record<string, unknown>;
      if (!scene) return false;
      const dialogs = scene['dialogs'] as { isOpen: boolean } | undefined;
      return !!dialogs && dialogs.isOpen === true;
    }, undefined, { timeout: 15_000 });

    await expect(page).toHaveScreenshot('quiz-dialog-architecture-elevator.png', SNAPSHOT_OPTS);
    errors.assertClean();
  });
});

/**
 * Floor-layout snapshot options.
 *
 * Looser pixel tolerance than static-UI because procedural sprites and the
 * Phaser game loop introduce small per-frame variance in enemy / token
 * positions. The critical invariant is that platform / catwalk geometry
 * (driven by LevelConfig constants) stays pixel-stable between runs.
 */
const FLOOR_SNAPSHOT_OPTS = {
  maxDiffPixelRatio: 0.05,
  threshold: 0.3,
  animations: 'disabled' as const,
};

/**
 * Call ElevatorScene's private `enterFloor` method via bracket notation
 * (same approach used in floors.spec.ts) and wait for the target scene to
 * reach RUNNING status.
 */
async function navigateToFloor(
  page: Page,
  floorId: number,
  sceneKey: string,
  side: 'left' | 'right' = 'left',
): Promise<void> {
  await page.evaluate(
    ({ id, s }) => {
      const g = window.__game!;
      const scene = g.scene
        .getScenes(true)
        .find((sc) => sc.sys.settings.key === 'ElevatorScene') as unknown as Record<
          string,
          unknown
        >;
      if (!scene) throw new Error('ElevatorScene not active');
      (scene['enterFloor'] as (id: number, side: 'left' | 'right') => void)(id, s);
    },
    { id: floorId, s: side },
  );
  await waitForScene(page, sceneKey);
}

/**
 * Visual-regression snapshots for floor layouts.
 *
 * One screenshot per floor scene at a fully-seeded progress state. The
 * purpose is to guard platform / catwalk geometry against accidental
 * breakage during LevelScene refactors — not to pixel-lock dynamic
 * elements like enemies or token bobbing.
 *
 * To regenerate baselines after intentional geometry changes:
 *   npm run test:visual:update
 *
 * Snapshots are skipped on CI (testIgnore in playwright.config.ts) because
 * they are platform-specific (only local / win32 baselines are committed).
 */
test.describe('Visual regression (floor layouts)', () => {
  test.beforeEach(async ({ page }) => {
    await clearStorage(page);
    // Seed a save with all floors unlocked and enough AU. Using addInitScript
    // rather than seedFullProgressSave so we can set unlockedFloors explicitly
    // for floors beyond the default [0, 1] pair.
    await page.addInitScript(() => {
      // Floor IDs: LOBBY=0, PLATFORM_TEAM=1, BUSINESS=3, EXECUTIVE=4, PRODUCTS=5.
      // Floor 2 does not exist in the game's numbering scheme (intentional gap).
      const save = {
        totalAU: 50,
        floorAU: { 0: 0, 1: 25, 3: 10, 4: 15, 5: 0 },
        unlockedFloors: [0, 1, 3, 4, 5],
        currentFloor: 0,
        collectedTokens: { 0: [], 1: [], 3: [], 4: [], 5: [] },
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
  });

  test('floor 1 left — PlatformTeamScene', async ({ page }) => {
    const errors = attachErrorWatchers(page);

    await page.goto('/');
    await waitForGame(page);
    await waitForScene(page, 'MenuScene');
    await page.keyboard.press('Enter');
    await waitForScene(page, 'ElevatorScene');
    await navigateToFloor(page, 1, 'PlatformTeamScene', 'left');

    await expect(page).toHaveScreenshot('floor-1-platform-team.png', FLOOR_SNAPSHOT_OPTS);
    errors.assertClean();
  });

  test('floor 1 right — ArchitectureTeamScene', async ({ page }) => {
    const errors = attachErrorWatchers(page);

    await page.goto('/');
    await waitForGame(page);
    await waitForScene(page, 'MenuScene');
    await page.keyboard.press('Enter');
    await waitForScene(page, 'ElevatorScene');
    await navigateToFloor(page, 1, 'ArchitectureTeamScene', 'right');

    await expect(page).toHaveScreenshot('floor-1-architecture-team.png', FLOOR_SNAPSHOT_OPTS);
    errors.assertClean();
  });

  test('floor 3 left — ProductLeadershipScene', async ({ page }) => {
    const errors = attachErrorWatchers(page);

    await page.goto('/');
    await waitForGame(page);
    await waitForScene(page, 'MenuScene');
    await page.keyboard.press('Enter');
    await waitForScene(page, 'ElevatorScene');
    await navigateToFloor(page, 3, 'ProductLeadershipScene', 'left');

    await expect(page).toHaveScreenshot('floor-3-product-leadership.png', FLOOR_SNAPSHOT_OPTS);
    errors.assertClean();
  });

  test('floor 3 right — CustomerSuccessScene', async ({ page }) => {
    const errors = attachErrorWatchers(page);

    await page.goto('/');
    await waitForGame(page);
    await waitForScene(page, 'MenuScene');
    await page.keyboard.press('Enter');
    await waitForScene(page, 'ElevatorScene');
    await navigateToFloor(page, 3, 'CustomerSuccessScene', 'right');

    await expect(page).toHaveScreenshot('floor-3-customer-success.png', FLOOR_SNAPSHOT_OPTS);
    errors.assertClean();
  });

  test('floor 4 — ExecutiveSuiteScene', async ({ page }) => {
    const errors = attachErrorWatchers(page);

    await page.goto('/');
    await waitForGame(page);
    await waitForScene(page, 'MenuScene');
    await page.keyboard.press('Enter');
    await waitForScene(page, 'ElevatorScene');
    await navigateToFloor(page, 4, 'ExecutiveSuiteScene', 'left');

    await expect(page).toHaveScreenshot('floor-4-executive-suite.png', FLOOR_SNAPSHOT_OPTS);
    errors.assertClean();
  });

  test('floor 4 sub-room — FinanceTeamScene', async ({ page }) => {
    const errors = attachErrorWatchers(page);

    await page.goto('/');
    await waitForGame(page);
    await waitForScene(page, 'MenuScene');
    await page.keyboard.press('Enter');
    await waitForScene(page, 'ElevatorScene');
    // First enter the Executive Suite (the parent floor that hosts the Finance door)
    await navigateToFloor(page, 4, 'ExecutiveSuiteScene', 'left');
    // Then start FinanceTeamScene directly — mirrors the in-game door transition
    await page.evaluate(() => {
      const g = window.__game!;
      const scene = g.scene
        .getScenes(true)
        .find((sc) => sc.sys.settings.key === 'ExecutiveSuiteScene') as unknown as Record<
          string,
          unknown
        >;
      if (!scene) throw new Error('ExecutiveSuiteScene not active');
      (scene['scene'] as { start: (key: string) => void }).start('FinanceTeamScene');
    });
    await waitForScene(page, 'FinanceTeamScene');

    await expect(page).toHaveScreenshot('floor-4-finance-team.png', FLOOR_SNAPSHOT_OPTS);
    errors.assertClean();
  });
});
