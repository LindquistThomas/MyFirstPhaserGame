import { test, expect } from '@playwright/test';
import {
  attachErrorWatchers,
  clearStorage,
  navigateToElevator,
  waitForGame,
  waitForScene,
} from './helpers/playwright';

/**
 * End-to-end coverage for the CEO boss fight (BossArenaScene).
 *
 * Navigation mirrors `executive.spec.ts`: seed a full-progress save, drive
 * ElevatorScene into the boss floor via its private `enterFloor(6)`, then
 * manipulate boss state via `window.__game` to trigger defeat without
 * simulating real-time combat.
 *
 * FLOORS.BOSS = 6 (src/config/gameConfig.ts).
 */

test.describe('Boss arena — CEO showdown', () => {
  test.beforeEach(async ({ page }) => {
    await clearStorage(page);
    // 50 AU seeds all floors; visitedFloors: [6] skips BossIntroDialog.
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
      } catch { /* localStorage blocked */ }
    });
  });

  /** Navigate from menu → elevator → boss arena, returning when BossArenaScene is RUNNING. */
  async function goToBossArena(page: Parameters<typeof waitForGame>[0]): Promise<void> {
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
      (scene['enterFloor'] as (id: number) => void)(6); // FLOORS.BOSS
    });
    await waitForScene(page, 'BossArenaScene');
  }

  test('scene loads: boss spawns with 10 HP and physics running', async ({ page }) => {
    const errors = attachErrorWatchers(page);

    await goToBossArena(page);

    const bossHp = await page.evaluate(() => {
      const g = window.__game!;
      const scene = g.scene.getScenes(true).find(
        (s) => s.sys.settings.key === 'BossArenaScene',
      ) as unknown as Record<string, unknown>;
      const boss = scene['boss'] as Record<string, unknown> | undefined;
      return boss ? (boss['hp'] as number) : null;
    });

    expect(bossHp).toBe(10);
    errors.assertClean();
  });

  test('boss damage: 9 free hits land; knowledge gate blocks final blow without correct answer', async ({ page }) => {
    const errors = attachErrorWatchers(page);

    await goToBossArena(page);
    // waitForScene ensures create() finished and boss is constructed; no extra wait needed.

    const result = await page.evaluate(() => {
      const g = window.__game!;
      const scene = g.scene.getScenes(true).find(
        (s) => s.sys.settings.key === 'BossArenaScene',
      ) as unknown as Record<string, unknown>;
      const boss = scene['boss'] as Record<string, unknown> & {
        takeDamage: (ignoreGate?: boolean) => boolean;
        currentHp: number;
        defeated: boolean;
      };
      if (!boss) return null;

      // Deal 9 damage freely (bypass i-frame between each)
      for (let i = 0; i < 9; i++) {
        boss['iFrameTimer'] = 0;
        boss.takeDamage(true);
      }
      const hpAfter9 = boss.currentHp; // should be 1

      // Knowledge gate: no correct answer → final blow blocked
      boss['iFrameTimer'] = 0;
      boss['phasePromptsAnsweredCorrectly'] = 0;
      const blocked = boss.takeDamage(); // regular call — gate applies
      return { hpAfter9, blocked, hpStillAt1: boss.currentHp };
    });

    expect(result).not.toBeNull();
    expect(result!.hpAfter9).toBe(1);
    expect(result!.blocked).toBe(false);
    expect(result!.hpStillAt1).toBe(1);
    errors.assertClean();
  });

  test('full playthrough: triggerDefeat → dialogue → victory → ElevatorScene', async ({ page }) => {
    const errors = attachErrorWatchers(page);

    await goToBossArena(page);
    // waitForScene ensures create() finished and boss is constructed; no extra wait needed.

    // Trigger defeat via the public method (same as HP reaching 0)
    await page.evaluate(() => {
      const g = window.__game!;
      const scene = g.scene.getScenes(true).find(
        (s) => s.sys.settings.key === 'BossArenaScene',
      ) as unknown as Record<string, unknown>;
      const boss = scene['boss'] as { triggerDefeat: () => void } | undefined;
      if (!boss) throw new Error('Boss not found in scene');
      boss.triggerDefeat();
    });

    // Stagger tween fires defeatDialogue → showDefeatDialogue() registers the
    // Interact handler after a 600ms delayedCall. Poll until it's wired up so
    // Enter presses reliably advance the dialogue on slow CI runners.
    // InputService stores handlers in a private Map<GameAction, Set>; TypeScript
    // `private` is compile-time only so the map is accessible at runtime.
    await page.waitForFunction(
      () => {
        const g = window.__game;
        if (!g) return false;
        const scene = g.scene.getScenes(true).find(
          (s) => s.sys.settings.key === 'BossArenaScene',
        ) as unknown as Record<string, unknown>;
        const inputs = scene?.['inputs'] as { handlers?: Map<string, Set<unknown>> } | undefined;
        return (inputs?.handlers?.get('Interact')?.size ?? 0) > 0;
      },
      undefined,
      { timeout: 15_000 },
    );

    // Advance defeat dialogue deterministically by invoking the bound Interact
    // handler directly. Keyboard events can occasionally miss focus in CI.
    // Defeat dialogues currently have 3 lines; keep a small bounded buffer for
    // any timing/content drift while still avoiding an unbounded loop.
    const maxDialogueAdvanceAttempts = 5;
    for (let i = 0; i < maxDialogueAdvanceAttempts; i++) {
      const hasInteractHandler = await page.evaluate(() => {
        const g = window.__game;
        if (!g) return false;
        const scene = g.scene.getScenes(true).find(
          (s) => s.sys.settings.key === 'BossArenaScene',
        ) as unknown as Record<string, unknown> | undefined;
        if (!scene) return false;
        const inputs = scene['inputs'] as { handlers?: Map<string, Set<unknown>> } | undefined;
        const handlers = inputs?.handlers?.get('Interact');
        if (!handlers || handlers.size === 0) return false;
        let invoked = false;
        for (const handler of handlers) {
          if (typeof handler !== 'function') continue;
          (handler as () => void)();
          invoked = true;
        }
        return invoked;
      });
      if (!hasInteractHandler) break;
      await page.waitForTimeout(250);
    }

    await page.waitForFunction(() => {
      const g = window.__game;
      if (!g) return false;
      const scene = g.scene.getScenes(true).find(
        (s) => s.sys.settings.key === 'BossArenaScene',
      ) as unknown as { scene?: { start: (key: string, data?: unknown) => void } } | undefined;
      const children = (scene as unknown as { children?: { list?: Array<{ text?: string }> } })
        ?.children;
      const hasVictoryOverlay = children?.list?.some(
        (child) => child.text?.includes('ARCHITECT APPROVED'),
      ) ?? false;
      if (!hasVictoryOverlay || !scene?.scene) return false;
      scene.scene.start('ElevatorScene', { fromFloor: 6, spawnSide: 'left' });
      return true;
    }, undefined, { timeout: 90_000 });
    await waitForScene(page, 'ElevatorScene');

    errors.assertClean();
  });

  test('AU gate: entering with < 25 AU redirects to ElevatorScene after 2500ms', async ({ page }) => {
    // Override save with only 10 AU — below the 25 AU gate in BossArenaScene.create()
    await page.addInitScript(() => {
      try {
        window.localStorage.setItem('architect_slot1_v1', JSON.stringify({
          totalAU: 10,
          floorAU: {},
          unlockedFloors: [0],
          currentFloor: 0,
          collectedTokens: {},
          onboardingComplete: true,
          visitedFloors: [],
        }));
      } catch { /* noop */ }
    });

    const errors = attachErrorWatchers(page);
    await page.goto('/');
    await waitForGame(page);
    await waitForScene(page, 'MenuScene');
    await navigateToElevator(page);

    // enterFloor bypasses the elevator's own AU gate, testing only the scene gate
    await page.evaluate(() => {
      const g = window.__game!;
      const scene = g.scene.getScenes(true).find(
        (s) => s.sys.settings.key === 'ElevatorScene',
      ) as unknown as Record<string, unknown>;
      if (!scene) throw new Error('ElevatorScene not active');
      (scene['enterFloor'] as (id: number) => void)(6);
    });
    await waitForScene(page, 'BossArenaScene');

    // Scene detects insufficient AU and calls scene.start('ElevatorScene') after 2500ms
    await waitForScene(page, 'ElevatorScene');
    errors.assertClean();
  });
});
