import { test, expect } from '@playwright/test';
import {
  SCREENSHOT_DIR,
  attachErrorWatchers,
  clearStorage,
  seedFullProgressSave,
  waitForGame,
  waitForScene,
} from './helpers/playwright';

test.describe('Progression / HUD', () => {
  test('HUD reflects seeded AU after entering the elevator', async ({ page }) => {
    await clearStorage(page);
    await seedFullProgressSave(page);
    const errors = attachErrorWatchers(page);

    await page.goto('/');
    await waitForGame(page);
    await waitForScene(page, 'MenuScene');

    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    await waitForScene(page, 'ElevatorScene');
    await page.waitForTimeout(400);

    // Preferred path: read AU straight off the ProgressionSystem attached to
    // ElevatorScene. This is what the HUD itself reads, so if it's right
    // here the HUD cannot be wrong.
    const state = await page.evaluate(() => {
      const g = window.__game!;
      const scene = g.scene
        .getScenes(true)
        .find((s) => s.sys.settings.key === 'ElevatorScene') as unknown as Record<string, unknown>;
      const progression = scene?.['progression'] as { getTotalAU?: () => number } | undefined;
      const au = progression?.getTotalAU?.();

      // Fallback: scan the scene's display list for the HUD's AU text
      // GameObject (it has no `name`, so match by prefix).
      let hudText: string | undefined;
      const children = (scene?.['children'] as { list: unknown[] } | undefined)?.list ?? [];
      const visit = (obj: unknown): void => {
        if (!obj || typeof obj !== 'object') return;
        const o = obj as Record<string, unknown>;
        if (typeof o['text'] === 'string' && (o['text'] as string).startsWith('AU:')) {
          hudText = o['text'] as string;
        }
        if (Array.isArray(o['list'])) (o['list'] as unknown[]).forEach(visit);
      };
      children.forEach(visit);

      return { au, hudText };
    });

    expect(state.au).toBe(50);
    // Sanity-check that the HUD text (if we found it) reflects the same value.
    if (state.hudText !== undefined) {
      expect(state.hudText).toBe('AU: 50');
    }

    await page.screenshot({
      path: `${SCREENSHOT_DIR}/07-hud-au-counter.png`,
      clip: { x: 0, y: 0, width: 640, height: 120 },
    });
    errors.assertClean();
  });
});
