import { test, expect } from '@playwright/test';
import {
  attachErrorWatchers,
  clearStorage,
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

    await page.keyboard.press('Enter');
    await waitForScene(page, 'ElevatorScene');

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

  test('Geir Harald OKR dialog opens from ElevatorScene at floor 4', async ({ page }) => {
    const errors = attachErrorWatchers(page);

    await page.goto('/');
    await waitForGame(page);
    await waitForScene(page, 'MenuScene');

    await page.keyboard.press('Enter');
    await waitForScene(page, 'ElevatorScene');

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

  test('Geir zone takes priority over elevator info when cab is at F4', async ({ page }) => {
    const errors = attachErrorWatchers(page);

    await page.goto('/');
    await waitForGame(page);
    await waitForScene(page, 'MenuScene');

    await page.keyboard.press('Enter');
    await waitForScene(page, 'ElevatorScene');

    // Force cab docked at F4 and mark the player as on the cab, then tick
    // zone detection and read the active zone.
    const activeZone = await page.evaluate(() => {
      const g = window.__game!;
      const scene = g.scene
        .getScenes(true)
        .find((s) => s.sys.settings.key === 'ElevatorScene') as unknown as {
          elevatorCtrl: {
            elevator: { platform: { y: number } };
          };
          player: { sprite: { x: number; y: number } };
          zoneManager: { update: () => void; getActiveZone: () => string | null };
        };
      // Snap the cab to F4's docked y and fake player-on-cab by writing to
      // the controller's private backing field (isOnElevator is a getter).
      const floorStops = (scene.elevatorCtrl.elevator as unknown as {
        floorStops: Map<number, number>;
      }).floorStops;
      const f4Y = floorStops.get(4);
      if (f4Y !== undefined) scene.elevatorCtrl.elevator.platform.y = f4Y;
      scene.player.sprite.x = 640;
      if (f4Y !== undefined) scene.player.sprite.y = f4Y - 40;
      (scene.elevatorCtrl as unknown as { playerOnElevator: boolean }).playerOnElevator = true;
      scene.zoneManager.update();
      return scene.zoneManager.getActiveZone();
    });

    expect(activeZone).toBe('exec-geir-harald');

    errors.assertClean();
  });
});
