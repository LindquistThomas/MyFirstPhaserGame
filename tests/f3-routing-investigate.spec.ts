import { test, expect } from '@playwright/test';
import {
  attachErrorWatchers,
  clearStorage,
  waitForGame,
  waitForScene,
} from './helpers/playwright';

/**
 * TEMPORARY investigation spec — reproduces the F3 step-off bug and dumps
 * diagnostic info. To be deleted once the real regression test is in place.
 */
test('INVESTIGATE: F3 left step-off does not transition', async ({ page }) => {
  const errors = attachErrorWatchers(page);

  await clearStorage(page);
  // Seed a save where BUSINESS is unlocked directly, then launch via Continue.
  await page.addInitScript(() => {
    const save = {
      totalAU: 50,
      floorAU: { 0: 0, 1: 8, 3: 0, 4: 0, 5: 0 },
      unlockedFloors: [0, 1, 3, 4, 5],
      currentFloor: 0,
      collectedTokens: { 0: [], 1: [], 3: [], 4: [], 5: [] },
    };
    try {
      window.localStorage.setItem('architect_default_v1', JSON.stringify(save));
      window.localStorage.setItem(
        'architect_info_seen_v1',
        JSON.stringify(['architecture-elevator']),
      );
    } catch { /* noop */ }
  });

  await page.goto('/');
  await waitForGame(page);
  await waitForScene(page, 'MenuScene');

  // Press Down then Enter to trigger the CONTINUE button (loadSave: true).
  await page.keyboard.press('ArrowDown');
  await page.waitForTimeout(100);
  await page.keyboard.press('Enter');
  await waitForScene(page, 'ElevatorScene');

  // Place the player onto the cab, then programmatically move the cab to F3.
  await page.evaluate(() => {
    const g = window.__game!;
    const scene = g.scene
      .getScenes(true)
      .find((s) => s.sys.settings.key === 'ElevatorScene') as unknown as Record<string, unknown>;
    const elev = scene['elevatorCtrl'] as {
      elevator: {
        platform: Phaser.Physics.Arcade.Image;
        moveToFloor: (id: number) => void;
      };
    };
    const player = scene['player'] as { sprite: Phaser.Physics.Arcade.Sprite };
    // Put player on cab top.
    player.sprite.setPosition(640, elev.elevator.platform.y - 80);
    (player.sprite.body as Phaser.Physics.Arcade.Body).setVelocity(0, 0);
    elev.elevator.moveToFloor(3);
  });
  await page.waitForFunction(
    () => {
      const g = window.__game;
      if (!g) return false;
      const scene = g.scene
        .getScenes(true)
        .find((s) => s.sys.settings.key === 'ElevatorScene') as unknown as Record<string, unknown>;
      const elev = scene?.['elevatorCtrl'] as { elevator: { getFloorAtCurrentPosition: () => number | null } } | undefined;
      return elev?.elevator.getFloorAtCurrentPosition() === 3;
    },
    undefined,
    { timeout: 15_000 },
  );
  await page.waitForTimeout(500);

  // Dump diagnostic state
  const before = await page.evaluate(() => {
    const g = window.__game!;
    const scene = g.scene
      .getScenes(true)
      .find((s) => s.sys.settings.key === 'ElevatorScene') as unknown as Record<string, unknown>;
    const player = scene['player'] as { sprite: Phaser.Physics.Arcade.Sprite };
    const positions = (scene['getFloorYPositions'] as () => Record<number, number>).call(scene);
    const progression = scene['progression'] as {
      isFloorUnlocked: (id: number) => boolean;
      getCurrentFloor: () => number;
      getTotalAU: () => number;
    };
    const elevCtrl = scene['elevatorCtrl'] as { isOnElevator: boolean; elevator: { getY: () => number } };
    const body = player.sprite.body as Phaser.Physics.Arcade.Body;

    // Enumerate all static bodies near the player, sorted by top Y
    const world = (scene['physics'] as Phaser.Physics.Arcade.ArcadePhysics).world;
    const staticBodies: Array<{ x: number; y: number; w: number; h: number; top: number }> = [];
    world.staticBodies.iterate((b) => {
      const bb = b as Phaser.Physics.Arcade.StaticBody;
      if (Math.abs(bb.y - body.bottom) < 200 && bb.x < body.right + 50 && bb.x + bb.width > body.left - 50) {
        staticBodies.push({ x: bb.x, y: bb.y, w: bb.width, h: bb.height, top: bb.y });
      }
      return null;
    });
    staticBodies.sort((a, b) => a.top - b.top);

    return {
      playerX: player.sprite.x,
      playerY: player.sprite.y,
      bodyBottom: body.bottom,
      bodyTop: body.top,
      bodyH: body.height,
      blockedDown: body.blocked.down,
      isOnElevator: elevCtrl.isOnElevator,
      cabY: elevCtrl.elevator.getY(),
      businessWalkY: positions[3] + 256,
      isBusinessUnlocked: progression.isFloorUnlocked(3),
      totalAU: progression.getTotalAU(),
      currentFloor: progression.getCurrentFloor(),
      nearbyStaticBodies: staticBodies.slice(0, 6),
    };
  });
  console.log('BEFORE walk:', JSON.stringify(before, null, 2));

  // Hold left for 1 second — should trigger step-off → ProductLeadershipScene
  await page.keyboard.down('ArrowLeft');
  await page.waitForTimeout(1500);
  await page.keyboard.up('ArrowLeft');

  const activeScenes = await page.evaluate(() => {
    const g = window.__game!;
    return g.scene.getScenes(true).map((s) => s.sys.settings.key);
  });
  console.log('Active scenes after walk:', activeScenes);

  const after = await page.evaluate(() => {
    const g = window.__game!;
    const ev = g.scene.getScenes(true).find((s) => s.sys.settings.key === 'ElevatorScene');
    if (!ev) return { stillInElevator: false };
    const scene = ev as unknown as Record<string, unknown>;
    const player = scene['player'] as { sprite: Phaser.Physics.Arcade.Sprite } | undefined;
    if (!player) return { stillInElevator: true };
    const body = player.sprite.body as Phaser.Physics.Arcade.Body;
    return {
      stillInElevator: true,
      playerX: player.sprite.x,
      playerY: player.sprite.y,
      bodyBottom: body.bottom,
      blockedDown: body.blocked.down,
    };
  });
  console.log('AFTER walk:', JSON.stringify(after, null, 2));

  errors.assertClean();
  // Expect transition to have happened
  expect(activeScenes).toContain('ProductLeadershipScene');
});
