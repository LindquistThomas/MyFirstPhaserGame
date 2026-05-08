import { test, expect } from '@playwright/test';
import { attachErrorWatchers, clearStorage, waitForGame, waitForScene } from './helpers/playwright';

test.describe('Daily Challenge', () => {
  test('persists daily result after completing one floor', async ({ page }) => {
    await clearStorage(page);
    const errors = attachErrorWatchers(page);

    await page.goto('/');
    await waitForGame(page);
    await waitForScene(page, 'MenuScene');

    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    await waitForScene(page, 'ElevatorScene');

    await page.evaluate(() => {
      const g = window.__game!;
      const elevator = g.scene.getScenes(true).find((s) => s.sys.settings.key === 'ElevatorScene') as any;
      elevator.enterFloor(1, 'left');
    });
    await waitForScene(page, 'PlatformTeamScene');

    await page.evaluate(() => {
      const g = window.__game!;
      const floor = g.scene.getScenes(true).find((s) => s.sys.settings.key === 'PlatformTeamScene') as any;
      floor.returnToElevator();
    });
    await waitForScene(page, 'ElevatorScene');

    const payload = await page.evaluate(() => {
      const now = new Date();
      const y = now.getUTCFullYear().toString().padStart(4, '0');
      const m = `${now.getUTCMonth() + 1}`.padStart(2, '0');
      const d = `${now.getUTCDate()}`.padStart(2, '0');
      const dateKey = `${y}${m}${d}`;
      const raw = window.localStorage.getItem('architect_daily_results_v1');
      return { dateKey, raw };
    });

    expect(payload.raw).not.toBeNull();
    const parsed = JSON.parse(payload.raw!);
    expect(parsed[payload.dateKey]).toBeTruthy();
    expect(parsed[payload.dateKey].runMs).toBeGreaterThan(0);

    errors.assertClean();
  });
});

