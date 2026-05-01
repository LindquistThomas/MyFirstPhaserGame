import { test, expect } from '@playwright/test';
import {
  attachErrorWatchers,
  clearStorage,
  navigateToElevator,
  seedFullProgressSave,
  waitForDialogOpen,
  waitForGame,
  waitForScene,
} from './helpers/playwright';

/**
 * Executive Suite (floor 4) — Geir Harald NPC + OKR dialog.
 *
 * We seed a save, drive the ElevatorScene into the executive floor via its
 * private `enterFloor(4)` (same code path the elevator buttons use), then
 * open Geir's info dialog through the shared `dialogs` controller. Driving
 * the scene-level zone detection via simulated arrow keys is timing-sensitive
 * in parallel test runs; `dialogs.open('exec-geir-harald')` exercises the
 * same DialogController → InfoDialog path while staying deterministic.
 */
test.describe('Executive Suite — Geir Harald', () => {
  test.beforeEach(async ({ page }) => {
    await clearStorage(page);
    await seedFullProgressSave(page, { totalAU: 50 });
  });

  test('Geir Harald OKR dialog opens with structured content', async ({ page }) => {
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
      (scene['enterFloor'] as (id: number) => void)(4);
    });
    await waitForScene(page, 'ExecutiveSuiteScene');

    // Open Geir's dialog through the level's DialogController — same path
    // the Enter key would take via the zone system.
    await page.evaluate(() => {
      const g = window.__game!;
      const scene = g.scene
        .getScenes(true)
        .find((s) => s.sys.settings.key === 'ExecutiveSuiteScene') as unknown as Record<string, unknown>;
      const dialogs = scene['dialogs'] as { open: (id: string) => void };
      dialogs.open('exec-geir-harald');
    });
    await waitForDialogOpen(page, 'ExecutiveSuiteScene');

    // Collect every Text object in the scene and assert the title + all 5
    // OKR section headings are present.
    const texts = await page.evaluate(() => {
      const g = window.__game!;
      const scene = g.scene
        .getScenes(true)
        .find((s) => s.sys.settings.key === 'ExecutiveSuiteScene') as unknown as {
          children?: { list: unknown[] };
        };
      const out: string[] = [];
      const visit = (obj: unknown): void => {
        if (!obj || typeof obj !== 'object') return;
        const o = obj as Record<string, unknown>;
        if (typeof o['text'] === 'string') out.push(o['text'] as string);
        if (Array.isArray(o['list'])) (o['list'] as unknown[]).forEach(visit);
      };
      scene.children?.list.forEach(visit);
      return out;
    });

    const joined = texts.join('\n');
    expect(joined).toContain('Geir Harald');
    expect(joined).toContain('OKR 1:');
    expect(joined).toContain('OKR 2:');
    expect(joined).toContain('OKR 3:');
    expect(joined).toContain('OKR 4:');
    expect(joined).toContain('OKR 5:');
    expect(joined).toContain('Norconsult');

    errors.assertClean();
  });

  test('Geir F4 proximity zone activates in elevator scene and blocks auto-transition', async ({ page }) => {
    const errors = attachErrorWatchers(page);

    await page.goto('/');
    await waitForGame(page);
    await waitForScene(page, 'MenuScene');

    await navigateToElevator(page);

    // Teleport the player into Geir's walkway rect on F4 — off the cab,
    // standing on the F4 walking surface — and verify (a) the active zone
    // is Geir, and (b) ElevatorFloorTransitionManager refuses to hand off
    // to ExecutiveSuiteScene while the zone is active.
    const result = await page.evaluate(() => {
      const g = window.__game!;
      const scene = g.scene
        .getScenes(true)
        .find((s) => s.sys.settings.key === 'ElevatorScene') as unknown as {
          layout: { getGeirBounds: () => { x: number; y: number; width: number; height: number } | undefined };
          player: { sprite: { x: number; y: number; body: { blocked: { down: boolean }; bottom: number } } };
          elevatorCtrl: unknown;
          zoneManager: { update: () => void; getActiveZone: () => string | null };
          transitions: { checkFloorEntry: () => void };
        };
      const bounds = scene.layout.getGeirBounds();
      if (!bounds) throw new Error('Geir bounds missing');
      // Step off the cab.
      (scene.elevatorCtrl as unknown as { playerOnElevator: boolean }).playerOnElevator = false;
      // Center the player in Geir's rect at walkway height.
      scene.player.sprite.x = bounds.x + bounds.width / 2;
      scene.player.sprite.y = bounds.y + bounds.height - 1;
      // Simulate the body being grounded on the F4 walking surface so the
      // transition manager's grounded check passes.
      scene.player.sprite.body.blocked.down = true;
      (scene.player.sprite.body as unknown as { bottom: number }).bottom =
        bounds.y + bounds.height;
      scene.zoneManager.update();
      const activeZone = scene.zoneManager.getActiveZone();
      scene.transitions.checkFloorEntry();
      const stillElevator = g.scene.isActive('ElevatorScene')
        && !g.scene.isActive('ExecutiveSuiteScene');
      return { activeZone, stillElevator };
    });

    expect(result.activeZone).toBe('exec-geir-harald');
    expect(result.stillElevator).toBe(true);

    errors.assertClean();
  });

  test('Geir OKR dialog opens from elevator scene proximity zone', async ({ page }) => {
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
      const dialogs = scene['dialogs'] as { open: (id: string) => void };
      dialogs.open('exec-geir-harald');
    });
    await waitForDialogOpen(page, 'ElevatorScene');

    const texts = await page.evaluate(() => {
      const g = window.__game!;
      const scene = g.scene
        .getScenes(true)
        .find((s) => s.sys.settings.key === 'ElevatorScene') as unknown as {
          children?: { list: unknown[] };
        };
      const out: string[] = [];
      const visit = (obj: unknown): void => {
        if (!obj || typeof obj !== 'object') return;
        const o = obj as Record<string, unknown>;
        if (typeof o['text'] === 'string') out.push(o['text'] as string);
        if (Array.isArray(o['list'])) (o['list'] as unknown[]).forEach(visit);
      };
      scene.children?.list.forEach(visit);
      return out;
    });

    const joined = texts.join('\n');
    expect(joined).toContain('Geir Harald');
    expect(joined).toContain('OKR 1:');
    expect(joined).toContain('OKR 5:');

    errors.assertClean();
  });
});

/**
 * Executive Suite — Hostage Rescue (Die Hard mode) — E2E happy path.
 *
 * Exercises the full rescue state machine introduced in #242:
 *   1. All three mission items collected (pistol, keycard, bomb_code).
 *   2. TerroristCommander defeated (requires pistol).
 *   3. Bomb disarmed.
 *   4. Inner sanctum opened and rescue dialog shown.
 *
 * We drive the scene's state directly via `page.evaluate` rather than
 * simulating keyboard input.  This mirrors the approach used by the
 * existing floor / dialog specs and stays deterministic under CPU
 * pressure on CI runners.
 */
test.describe('Executive Suite — Hostage Rescue', () => {
  test.beforeEach(async ({ page }) => {
    await clearStorage(page);
    // totalAU: 50 matches what the Geir Harald tests use.  enterFloor(4)
    // bypasses the AU gate, so the exact value doesn't matter here.
    await seedFullProgressSave(page, { totalAU: 50 });
  });

  test('happy path: collect all items, defeat commander, disarm bomb, free leadership', async ({ page }) => {
    const errors = attachErrorWatchers(page);

    await page.goto('/');
    await waitForGame(page);
    await waitForScene(page, 'MenuScene');

    await navigateToElevator(page);

    // Enter the Executive Suite (floor 4) using the same private method
    // that the elevator cab uses when the player walks off.
    await page.evaluate(() => {
      const g = window.__game!;
      const scene = g.scene
        .getScenes(true)
        .find((s) => s.sys.settings.key === 'ElevatorScene') as unknown as Record<string, unknown>;
      if (!scene) throw new Error('ElevatorScene not active');
      (scene['enterFloor'] as (id: number) => void)(4);
    });
    await waitForScene(page, 'ExecutiveSuiteScene');

    // ── Step 1: Collect all three mission items ───────────────────────────
    // Call collect() directly on each MissionItem — the same method the
    // physics overlap callback invokes when the player touches the sprite.
    const itemCount = await page.evaluate(() => {
      const g = window.__game!;
      const scene = g.scene
        .getScenes(true)
        .find((s) => s.sys.settings.key === 'ExecutiveSuiteScene') as unknown as {
          missionItems: Array<{ collect: () => void }>;
        };
      if (!scene.missionItems?.length) throw new Error('missionItems not found');
      scene.missionItems.forEach((item) => item.collect());
      return scene.missionItems.length;
    });
    expect(itemCount).toBe(3);

    // Confirm all three IDs are now in rescueState.collected.
    const allCollected = await page.evaluate(() => {
      const g = window.__game!;
      const scene = g.scene
        .getScenes(true)
        .find((s) => s.sys.settings.key === 'ExecutiveSuiteScene') as unknown as {
          rescueState: { collected: { has: (id: string) => boolean } };
        };
      return (
        scene.rescueState.collected.has('pistol') &&
        scene.rescueState.collected.has('keycard') &&
        scene.rescueState.collected.has('bomb_code')
      );
    });
    expect(allCollected).toBe(true);

    // ── Step 2: Defeat the TerroristCommander ────────────────────────────
    // onCommanderOverlap() checks rescueState.collected.has('pistol') before
    // calling commander.defeat(), so calling it after step 1 is correct.
    await page.evaluate(() => {
      const g = window.__game!;
      const scene = g.scene
        .getScenes(true)
        .find((s) => s.sys.settings.key === 'ExecutiveSuiteScene') as unknown as Record<string, unknown>;
      (scene['onCommanderOverlap'] as () => void)();
    });

    const commanderDefeated = await page.evaluate(() => {
      const g = window.__game!;
      const scene = g.scene
        .getScenes(true)
        .find((s) => s.sys.settings.key === 'ExecutiveSuiteScene') as unknown as {
          rescueState: { commanderDefeated: boolean };
        };
      return scene.rescueState.commanderDefeated;
    });
    expect(commanderDefeated).toBe(true);

    // ── Step 3: Disarm the bomb ───────────────────────────────────────────
    // Set the bomb as disarmed and call checkSanctumUnlock() — this is what
    // checkBombDisarm() does when the mini-game success accumulator reaches
    // its threshold.  With all five conditions met (3 items + commander +
    // bomb) the sanctum opens immediately.
    await page.evaluate(() => {
      const g = window.__game!;
      const scene = g.scene
        .getScenes(true)
        .find((s) => s.sys.settings.key === 'ExecutiveSuiteScene') as unknown as Record<string, unknown>;
      (scene['rescueState'] as { bombDisarmed: boolean }).bombDisarmed = true;
      (scene['checkSanctumUnlock'] as () => void)();
    });

    // ── Step 4: Verify leadership freed ───────────────────────────────────
    const leadershipFreed = await page.evaluate(() => {
      const g = window.__game!;
      const scene = g.scene
        .getScenes(true)
        .find((s) => s.sys.settings.key === 'ExecutiveSuiteScene') as unknown as {
          rescueState: { leadershipFreed: boolean };
        };
      return scene.rescueState.leadershipFreed;
    });
    expect(leadershipFreed).toBe(true);

    errors.assertClean();
  });
});
