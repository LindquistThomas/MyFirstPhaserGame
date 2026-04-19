import { test, expect } from '@playwright/test';
import {
  SCREENSHOT_DIR,
  attachErrorWatchers,
  clearStorage,
  seedFullProgressSave,
  waitForGame,
  waitForScene,
} from './helpers/playwright';

/**
 * Token collection test — proves the AU increment side of the progression
 * loop. We seed an empty-AU save, jump the player into the Platform Team
 * floor, and invoke the scene's own overlap handler with a real token.
 * The handler is the same one the physics engine calls on overlap, so this
 * exercises the production collection flow end-to-end.
 */
test.describe('Token collection', () => {
  test.beforeEach(async ({ page }) => {
    await clearStorage(page);
    await seedFullProgressSave(page, { totalAU: 0, floorAU: { 0: 0, 1: 0 } });
  });

  test('collecting a token increments total AU and disables the token', async ({ page }) => {
    const errors = attachErrorWatchers(page);

    await page.goto('/');
    await waitForGame(page);
    await waitForScene(page, 'MenuScene');

    // Continue (seeded save present).
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    await waitForScene(page, 'ElevatorScene');
    await page.waitForTimeout(400);

    await page.evaluate(() => {
      const g = window.__game!;
      const scene = g.scene
        .getScenes(true)
        .find((s) => s.sys.settings.key === 'ElevatorScene') as unknown as Record<string, unknown>;
      if (!scene) throw new Error('ElevatorScene not active');
      (scene['enterFloor'] as (id: number) => void)(1);
    });
    await waitForScene(page, 'PlatformTeamScene');
    await page.waitForTimeout(800);

    // Snapshot state before, then drive the scene's real onAUCollect handler
    // — the same handler physics dispatches on player↔token overlap.
    const result = await page.evaluate(() => {
      const g = window.__game!;
      const scene = g.scene
        .getScenes(true)
        .find((s) => s.sys.settings.key === 'PlatformTeamScene') as unknown as Record<string, unknown>;
      if (!scene) throw new Error('PlatformTeamScene not active');

      const progression = scene['progression'] as { getTotalAU: () => number };
      const before = progression.getTotalAU();

      const tokenGroup = scene['tokenGroup'] as { getChildren: () => unknown[] };
      const tokens = tokenGroup.getChildren() as Array<{
        active: boolean;
        body: { enable: boolean } | null;
        getData: (k: string) => unknown;
      }>;
      const token = tokens.find((t) => t.active);
      if (!token) throw new Error('No active token found on PlatformTeamScene');
      const tokenIndex = token.getData('tokenIndex') as number;

      const player = scene['player'] as { sprite: unknown };
      // The collection handler lives on LevelTokenManager (private arrow fn).
      const tokenMgr = scene['tokenMgr'] as { onCollect: (p: unknown, t: unknown) => void };
      tokenMgr.onCollect(player.sprite, token);

      const after = progression.getTotalAU();
      return {
        before,
        after,
        tokenIndex,
        bodyEnabled: token.body?.enable ?? false,
      };
    });

    expect(result.before).toBe(0);
    expect(result.after).toBe(1);
    expect(result.bodyEnabled).toBe(false);

    // Give the collection animation a moment to play before the screenshot.
    await page.waitForTimeout(400);
    await page.screenshot({ path: `${SCREENSHOT_DIR}/08-token-collected.png` });

    // Persistence: the collected index made it into localStorage.
    const saved = await page.evaluate(() => window.localStorage.getItem('architect_default_v1'));
    expect(saved).toBeTruthy();
    const parsed = JSON.parse(saved!) as {
      totalAU: number;
      collectedTokens: Record<string, number[]>;
    };
    expect(parsed.totalAU).toBe(1);
    expect(parsed.collectedTokens['1']).toContain(result.tokenIndex);

    errors.assertClean();
  });
});
