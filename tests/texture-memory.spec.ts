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

  async function runLazySceneCycle(page: import('@playwright/test').Page): Promise<void> {
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

    await page.evaluate(() => {
      const scenes = window.__game!.scene;
      scenes.stop('BossArenaScene');
      scenes.start('ElevatorScene');
    });
    await waitForScene(page, 'ElevatorScene');
  }

  test('texture key count stays bounded across product-room and boss transitions', async ({ page }) => {
    const errors = attachErrorWatchers(page);

    await page.goto('/');
    await waitForGame(page);
    await waitForScene(page, 'MenuScene');
    await navigateToElevator(page);
    await runLazySceneCycle(page);
    const baselineTextureCount = await page.evaluate(() => window.__game!.textures.getTextureKeys().length);

    await runLazySceneCycle(page);

    const finalTextureCount = await page.evaluate(() => window.__game!.textures.getTextureKeys().length);
    expect(finalTextureCount - baselineTextureCount).toBeLessThanOrEqual(5);

    errors.assertClean();
  });
});
