import { test, expect } from '@playwright/test';
import {
  attachErrorWatchers,
  clearStorage,
  navigateToElevator,
  seedFullProgressSave,
  waitForGame,
  waitForScene,
} from './helpers/playwright';

test.describe('Menu scene', () => {
  test('continues from a seeded save into the elevator', async ({ page }) => {
    await clearStorage(page);
    await seedFullProgressSave(page);
    const errors = attachErrorWatchers(page);

    await page.goto('/');
    await waitForGame(page);
    await waitForScene(page, 'MenuScene');

    await navigateToElevator(page);

    errors.assertClean();
  });

  test('keyboard Down Down Enter activates the third menu option', async ({ page }) => {
    await clearStorage(page);
    const errors = attachErrorWatchers(page);

    await page.goto('/');
    await waitForGame(page);
    await waitForScene(page, 'MenuScene');

    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');

    await waitForScene(page, 'SettingsScene');

    errors.assertClean();
  });

  test('eager boot tracks are cached before menu -> elevator navigation', async ({ page }) => {
    await clearStorage(page);
    const errors = attachErrorWatchers(page);

    await page.goto('/');
    await waitForGame(page);
    await waitForScene(page, 'MenuScene');

    const menuAudioState = await page.evaluate(() => {
      const game = window.__game as unknown as {
        cache: { audio: { exists: (key: string) => boolean } };
        scene: {
          getScenes: (active?: boolean) => Array<{
            sys: { settings: { key: string } };
            sound?: { get?: (key: string) => { isPlaying?: boolean } | null };
          }>;
        };
      };
      const menuScene = game.scene.getScenes(true).find((s) => s.sys.settings.key === 'MenuScene');
      const menuSound = menuScene?.sound?.get?.('music_menu');
      return {
        menuCached: game.cache.audio.exists('music_menu'),
        elevatorJazzCached: game.cache.audio.exists('music_elevator_jazz'),
        menuPlaying: menuSound?.isPlaying === true,
      };
    });

    expect(menuAudioState.menuCached).toBe(true);
    expect(menuAudioState.menuPlaying).toBe(true);
    expect(menuAudioState.elevatorJazzCached).toBe(true);

    const transitionRequests: string[] = [];
    const requestListener = (request: { url: () => string }) => {
      transitionRequests.push(request.url());
    };
    page.on('request', requestListener);
    try {
      await navigateToElevator(page);
    } finally {
      page.off('request', requestListener);
    }

    expect(transitionRequests.some((url) => url.includes('elevator_jazz'))).toBe(false);

    const stillCached = await page.evaluate(
      () => (window.__game as unknown as { cache: { audio: { exists: (key: string) => boolean } } })
        .cache.audio.exists('music_elevator_jazz'),
    );
    expect(stillCached).toBe(true);
    errors.assertClean();
  });

});
