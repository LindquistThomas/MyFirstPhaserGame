import { test, expect } from '@playwright/test';
import {
  clearStorage,
  navigateToElevator,
  seedFullProgressSave,
  waitForGame,
  waitForScene,
} from './helpers/playwright';

test.describe('Speedrun PB persistence', () => {
  test.beforeEach(async ({ page }) => {
    await clearStorage(page);
    await seedFullProgressSave(page);
  });

  test('completing a floor persists bestFloorMs to slot save', async ({ page }) => {
    await page.goto('/');
    await waitForGame(page);
    await waitForScene(page, 'MenuScene');
    await navigateToElevator(page);

    await page.evaluate(() => {
      const g = window.__game!;
      const elevator = g.scene
        .getScenes(true)
        .find((s) => s.sys.settings.key === 'ElevatorScene') as unknown as Record<string, unknown>;
      if (!elevator) throw new Error('ElevatorScene not active');
      (elevator['enterFloor'] as (id: number) => void)(1);
    });
    await waitForScene(page, 'PlatformTeamScene');

    await page.evaluate(() => {
      const g = window.__game!;
      const floor = g.scene
        .getScenes(true)
        .find((s) => s.sys.settings.key === 'PlatformTeamScene') as unknown as Record<string, unknown>;
      if (!floor) throw new Error('PlatformTeamScene not active');

      // Force deterministic "fast" floor time via direct tracker test hooks.
      const gameState = (floor['registry'] as { get: (k: string) => unknown }).get('gameState') as {
        playtime: { setTestFloorVisit: (floorId: number, elapsedMs: number) => void };
      };
      gameState.playtime.setTestFloorVisit(1, 1_500);
      (floor['returnToElevator'] as () => void)();
    });

    await waitForScene(page, 'ElevatorScene');

    const bestFloorMs = await page.evaluate(() => {
      const raw = window.localStorage.getItem('architect_slot1_v1');
      if (!raw) return null;
      const save = JSON.parse(raw) as { bestFloorMs?: Record<string, number> };
      return save.bestFloorMs?.['1'] ?? null;
    });
    expect(bestFloorMs).not.toBeNull();
    expect(bestFloorMs!).toBeGreaterThan(0);
  });
});
