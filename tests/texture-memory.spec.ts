import { test, expect } from '@playwright/test';
import {
  attachErrorWatchers,
  clearStorage,
  navigateToElevator,
  waitForGame,
  waitForScene,
} from './helpers/playwright';

test.describe('Texture lifecycle regression', () => {
  test.beforeEach(async ({ page }) => {
    await clearStorage(page);
    await page.addInitScript(() => {
      try {
        const save = {
          totalAU: 50,
          floorAU: { 0: 25, 1: 25 },
          unlockedFloors: [0, 1, 3, 4, 5, 6],
          currentFloor: 0,
          collectedTokens: {},
          onboardingComplete: true,
          visitedFloors: [6],
        };
        window.localStorage.setItem('architect_slot1_v1', JSON.stringify(save));
        window.localStorage.setItem(
          'architect_info_seen_v1',
          JSON.stringify(['architecture-elevator']),
        );
      } catch {
        /* localStorage blocked */
      }
    });
  });

  test('texture key count stays bounded across product-room and boss transitions', async ({ page }) => {
    const errors = attachErrorWatchers(page);

    await page.goto('/');
    await waitForGame(page);
    await waitForScene(page, 'MenuScene');

    // Wait for menu deferred warmup so the baseline is stable.
    await page.waitForFunction(() => {
      const g = window.__game;
      if (!g) return false;
      const menu = g.scene.getScenes(true).find((s) => s.sys.settings.key === 'MenuScene') as unknown as {
        _warmupDone?: boolean;
      };
      return menu?._warmupDone === true;
    });

    const baselineTextureKeys = await page.evaluate(() => window.__game!.textures.getTextureKeys());
    const baselineTextureCount = baselineTextureKeys.length;

    await navigateToElevator(page);

    await page.evaluate(() => {
      const g = window.__game!;
      const elevator = g.scene
        .getScenes(true)
        .find((s) => s.sys.settings.key === 'ElevatorScene') as unknown as {
          lazyStartScene: (sceneKey: string) => Promise<void>;
        };
      void elevator.lazyStartScene('ProductIsyRoadScene');
    });
    await waitForScene(page, 'ProductIsyRoadScene');

    await page.evaluate(() => {
      const g = window.__game!;
      const room = g.scene
        .getScenes(true)
        .find((s) => s.sys.settings.key === 'ProductIsyRoadScene') as unknown as {
          returnToElevator: () => void;
        };
      room.returnToElevator();
    });
    await waitForScene(page, 'ElevatorScene');

    await page.evaluate(() => {
      const g = window.__game!;
      const elevator = g.scene
        .getScenes(true)
        .find((s) => s.sys.settings.key === 'ElevatorScene') as unknown as {
          enterFloor: (id: number) => void;
        };
      elevator.enterFloor(6);
    });
    await waitForScene(page, 'BossArenaScene');

    // Use ScenePlugin (this.scene.start) not SceneManager (game.scene.start) so
    // the transition properly stops BossArenaScene (triggering its texture cleanup)
    // before starting ElevatorScene.
    await page.evaluate(() => {
      const g = window.__game!;
      const boss = g.scene
        .getScenes(true)
        .find((s) => s.sys.settings.key === 'BossArenaScene') as unknown as {
          scene: { start: (key: string) => void };
        };
      boss.scene.start('ElevatorScene');
    });
    await waitForScene(page, 'ElevatorScene');

    await page.evaluate(() => {
      const g = window.__game!;
      const elevator = g.scene
        .getScenes(true)
        .find((s) => s.sys.settings.key === 'ElevatorScene') as unknown as {
          scene: { start: (key: string) => void };
        };
      elevator.scene.start('MenuScene');
    });
    await waitForScene(page, 'MenuScene');

    const { finalTextureCount, leakedKeys } = await page.evaluate((baselineKeys) => {
      const allKeys = window.__game!.textures.getTextureKeys();
      const baselineSet = new Set(baselineKeys);
      const leaked = allKeys.filter((k) => !baselineSet.has(k));
      return { finalTextureCount: allKeys.length, leakedKeys: leaked };
    }, baselineTextureKeys);
    expect(finalTextureCount - baselineTextureCount, `Leaked texture keys: ${leakedKeys.join(', ')}`).toBeLessThanOrEqual(5);

    errors.assertClean();
  });
});
