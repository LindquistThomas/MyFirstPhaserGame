import { test, expect } from '@playwright/test';
import {
  SCREENSHOT_DIR,
  attachErrorWatchers,
  clearStorage,
  navigateToElevator,
  seedFullProgressSave,
  waitForGame,
  waitForScene,
} from './helpers/playwright';

/**
 * Pause / Resume — happy-path spec.
 *
 * Seeds a save with Floor 1 unlocked, enters PlatformTeamScene directly
 * (same technique as floors.spec.ts), then drives the pause/resume flow.
 */
test.describe('Pause / Resume', () => {
  test.beforeEach(async ({ page }) => {
    await clearStorage(page);
    await seedFullProgressSave(page);
  });

  test('Esc pauses the level and PauseScene overlay appears', async ({ page }) => {
    const errors = attachErrorWatchers(page);

    await page.goto('/');
    await waitForGame(page);
    await waitForScene(page, 'MenuScene');

    await navigateToElevator(page);

    // Enter Floor 1 programmatically.
    await page.evaluate(() => {
      const g = window.__game!;
      const scene = g.scene
        .getScenes(true)
        .find((s) => s.sys.settings.key === 'ElevatorScene') as unknown as Record<string, unknown>;
      if (!scene) throw new Error('ElevatorScene not active');
      (scene['enterFloor'] as (id: number) => void)(1);
    });
    await waitForScene(page, 'PlatformTeamScene');

    // Press Esc — should launch PauseScene.
    await page.keyboard.press('Escape');

    // Wait for PauseScene to become active.
    await page.waitForFunction(
      () => {
        const g = window.__game;
        if (!g) return false;
        return g.scene.isActive('PauseScene');
      },
      undefined,
      { timeout: 5_000 },
    );

    await page.screenshot({ path: `${SCREENSHOT_DIR}/pause-overlay.png` });

    // The level scene should now be paused (status 6 = PAUSED in Phaser).
    const levelPaused = await page.evaluate(() => {
      const g = window.__game!;
      const scene = g.scene.getScenes(true).find((s) => s.sys.settings.key === 'PlatformTeamScene');
      // Phaser status 6 = PAUSED, 7 = SLEEPING. Both mean "not running".
      return !!scene && (scene.sys.settings.status === 6 || scene.sys.settings.status === 7);
    });
    expect(levelPaused).toBe(true);

    errors.assertClean();
  });

  test('pressing Esc again (Pause action) resumes gameplay', async ({ page }) => {
    const errors = attachErrorWatchers(page);

    await page.goto('/');
    await waitForGame(page);
    await waitForScene(page, 'MenuScene');

    await navigateToElevator(page);

    await page.evaluate(() => {
      const g = window.__game!;
      const scene = g.scene
        .getScenes(true)
        .find((s) => s.sys.settings.key === 'ElevatorScene') as unknown as Record<string, unknown>;
      if (!scene) throw new Error('ElevatorScene not active');
      (scene['enterFloor'] as (id: number) => void)(1);
    });
    await waitForScene(page, 'PlatformTeamScene');

    // Pause.
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => window.__game?.scene.isActive('PauseScene'), undefined, { timeout: 5_000 });

    // Resume via Esc again.
    await page.keyboard.press('Escape');

    // PauseScene should stop.
    await page.waitForFunction(
      () => !window.__game?.scene.isActive('PauseScene'),
      undefined,
      { timeout: 5_000 },
    );

    // Level scene should be running again (status 5 = RUNNING).
    await waitForScene(page, 'PlatformTeamScene');

    errors.assertClean();
  });

  test('window blur auto-pauses the level scene', async ({ page }) => {
    const errors = attachErrorWatchers(page);

    await page.goto('/');
    await waitForGame(page);
    await waitForScene(page, 'MenuScene');

    await navigateToElevator(page);

    // Enter Floor 1 programmatically.
    await page.evaluate(() => {
      const g = window.__game!;
      const scene = g.scene
        .getScenes(true)
        .find((s) => s.sys.settings.key === 'ElevatorScene') as unknown as Record<string, unknown>;
      if (!scene) throw new Error('ElevatorScene not active');
      (scene['enterFloor'] as (id: number) => void)(1);
    });
    await waitForScene(page, 'PlatformTeamScene');

    // Simulate the window losing focus (alt-tab / click another window).
    await page.evaluate(() => window.dispatchEvent(new Event('blur')));

    // PauseScene should launch.
    await page.waitForFunction(
      () => {
        const g = window.__game;
        if (!g) return false;
        return g.scene.isActive('PauseScene');
      },
      undefined,
      { timeout: 5_000 },
    );

    // The level scene should be paused.
    const levelPaused = await page.evaluate(() => {
      const g = window.__game!;
      const scene = g.scene.getScenes(true).find((s) => s.sys.settings.key === 'PlatformTeamScene');
      return !!scene && (scene.sys.settings.status === 6 || scene.sys.settings.status === 7);
    });
    expect(levelPaused).toBe(true);

    errors.assertClean();
  });

  test('Quit to Menu returns to MenuScene with progression intact', async ({ page }) => {
    const errors = attachErrorWatchers(page);

    await page.goto('/');
    await waitForGame(page);
    await waitForScene(page, 'MenuScene');

    await navigateToElevator(page);

    await page.evaluate(() => {
      const g = window.__game!;
      const scene = g.scene
        .getScenes(true)
        .find((s) => s.sys.settings.key === 'ElevatorScene') as unknown as Record<string, unknown>;
      if (!scene) throw new Error('ElevatorScene not active');
      (scene['enterFloor'] as (id: number) => void)(1);
    });
    await waitForScene(page, 'PlatformTeamScene');

    // Pause.
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => window.__game?.scene.isActive('PauseScene'), undefined, { timeout: 5_000 });

    // Click Quit to Menu button.
    await page.evaluate(() => {
      const g = window.__game!;
      const pauseScene = g.scene.getScenes(true)
        .find((s) => s.sys.settings.key === 'PauseScene') as unknown as { quitToMenu?: () => void } | undefined;
      if (!pauseScene || typeof pauseScene['quitToMenu'] !== 'function') {
        throw new Error('PauseScene.quitToMenu not found');
      }
      (pauseScene as { quitToMenu: () => void }).quitToMenu();
    });

    await waitForScene(page, 'MenuScene');

    // Progression state (save slot) should still exist.
    const saveExists = await page.evaluate(() => {
      try {
        const raw = window.localStorage.getItem('architect_slot1_v1');
        return raw !== null;
      } catch {
        return false;
      }
    });
    expect(saveExists).toBe(true);

    errors.assertClean();
  });
});
