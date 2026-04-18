import { test, expect } from '@playwright/test';
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
    await page.waitForTimeout(500);

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
    await page.waitForTimeout(500);

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
    await page.waitForTimeout(500);

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
    await page.waitForTimeout(500);

    await expect(page).toHaveScreenshot('quiz-dialog-architecture-elevator.png', SNAPSHOT_OPTS);
    errors.assertClean();
  });
});
