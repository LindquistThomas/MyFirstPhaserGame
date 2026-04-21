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
 * Regression: pressing Interact (Enter) / ToggleInfo (Up) while the player
 * is walking would previously leave the player sliding and the walk
 * animation looping for ~170ms while the info dialog was visible, because
 * the ground-deceleration path multiplies vx by 0.8 per frame.
 *
 * After the fix, `Player.update()` hard-snaps vx to 0 and switches to
 * `player_idle` as soon as the active input context is not `gameplay`
 * (i.e. a modal or menu is overlaying the scene).
 */

interface PlayerSnapshot {
  vx: number;
  anim: string | null;
}

async function snapshotPlayer(
  page: import('@playwright/test').Page,
): Promise<PlayerSnapshot> {
  return page.evaluate(() => {
    const g = window.__game!;
    const scene = g.scene
      .getScenes(true)
      .find((s) => s.sys.settings.key === 'PlatformTeamScene') as unknown as
      Record<string, unknown>;
    const player = scene['player'] as {
      sprite: {
        body: { velocity: { x: number } };
        anims?: { currentAnim?: { key?: string } | null };
      };
    };
    return {
      vx: player.sprite.body.velocity.x,
      anim: player.sprite.anims?.currentAnim?.key ?? null,
    };
  });
}

test.describe('Player freezes when a dialog opens mid-walk', () => {
  test.beforeEach(async ({ page }) => {
    await clearStorage(page);
    await seedFullProgressSave(page);
  });

  test('holding ArrowRight then opening an info dialog snaps vx to 0 and switches to idle', async ({ page }) => {
    const errors = attachErrorWatchers(page);

    await page.goto('/');
    await waitForGame(page);
    await waitForScene(page, 'MenuScene');
    await page.keyboard.press('Enter');
    await waitForScene(page, 'ElevatorScene');

    // Jump directly into floor 1 via the same private method the cab uses.
    await page.evaluate(() => {
      const g = window.__game!;
      const scene = g.scene
        .getScenes(true)
        .find((s) => s.sys.settings.key === 'ElevatorScene') as unknown as
        Record<string, unknown>;
      (scene['enterFloor'] as (id: number) => void)(1);
    });
    await waitForScene(page, 'PlatformTeamScene');

    // Wait for the player to settle on the spawn platform (spawn drops in
    // briefly under gravity). Without this the player may still be
    // airborne when we start walking, which leaves the post-freeze anim
    // in `player_fall` instead of `player_idle`.
    await page.waitForFunction(() => {
      const g = window.__game!;
      const scene = g.scene
        .getScenes(true)
        .find((s) => s.sys.settings.key === 'PlatformTeamScene') as unknown as
        Record<string, unknown>;
      const player = scene['player'] as {
        sprite: { body: { blocked: { down: boolean }; touching: { down: boolean } } };
      } | undefined;
      if (!player) return false;
      const b = player.sprite.body;
      return b.blocked.down || b.touching.down;
    }, undefined, { timeout: 5_000 });

    // Start walking right — keep the key held for the rest of the test so
    // we can prove the player halts despite ongoing directional input.
    await page.keyboard.down('ArrowRight');

    // Wait until the player is visibly walking on the ground (not still
    // mid-spawn-drop, not mid-landing). Opening the dialog while the
    // player is still airborne would leave them in `player_fall` until
    // they land, which would mask the freeze assertion below.
    await page.waitForFunction(() => {
      const g = window.__game!;
      const scene = g.scene
        .getScenes(true)
        .find((s) => s.sys.settings.key === 'PlatformTeamScene') as unknown as
        Record<string, unknown>;
      const player = scene['player'] as {
        sprite: {
          body: {
            velocity: { x: number };
            blocked: { down: boolean };
            touching: { down: boolean };
          };
          anims?: { currentAnim?: { key?: string } | null };
        };
      } | undefined;
      if (!player) return false;
      const b = player.sprite.body;
      const onGround = b.blocked.down || b.touching.down;
      return (
        onGround &&
        b.velocity.x > 50 &&
        player.sprite.anims?.currentAnim?.key === 'player_walk'
      );
    }, undefined, { timeout: 5_000 });

    const moving = await snapshotPlayer(page);
    expect(moving.vx).toBeGreaterThan(50);
    expect(moving.anim).toBe('player_walk');

    // Open the info dialog through the DialogController — same entry point
    // as pressing Enter/Up on a real info zone, but deterministic. Do this
    // in the same page.evaluate as a final vx/anim read so there's no
    // window for the player to walk off the platform between "observed
    // walking" and "dialog opened" under parallel worker load.
    const atOpen = await page.evaluate(() => {
      const g = window.__game!;
      const scene = g.scene
        .getScenes(true)
        .find((s) => s.sys.settings.key === 'PlatformTeamScene') as unknown as
        Record<string, unknown>;
      const player = scene['player'] as {
        sprite: {
          body: { velocity: { x: number }; blocked: { down: boolean }; touching: { down: boolean } };
          anims?: { currentAnim?: { key?: string } | null };
        };
      };
      const b = player.sprite.body;
      const snapshot = {
        vx: b.velocity.x,
        onGround: b.blocked.down || b.touching.down,
        anim: player.sprite.anims?.currentAnim?.key ?? null,
      };
      const dialogs = scene['dialogs'] as { open: (id: string) => void };
      dialogs.open('you-build-you-run');
      return snapshot;
    });
    // Sanity-check: the player really was walking on the ground the moment
    // the dialog opened.
    expect(atOpen.onGround).toBe(true);
    expect(atOpen.vx).toBeGreaterThan(50);
    expect(atOpen.anim).toBe('player_walk');

    await waitForDialogOpen(page, 'PlatformTeamScene');

    // Wait until the freeze has fully settled — Player.update() snaps vx
    // to 0 immediately, but the `player_land` squash anim (played if the
    // player just finished the initial spawn drop) gates animation
    // updates for up to 120ms. We want to observe the steady state.
    await page.waitForFunction(() => {
      const g = window.__game!;
      const scene = g.scene
        .getScenes(true)
        .find((s) => s.sys.settings.key === 'PlatformTeamScene') as unknown as
        Record<string, unknown>;
      const player = scene['player'] as {
        sprite: {
          body: { velocity: { x: number }; blocked: { down: boolean }; touching: { down: boolean } };
          anims?: { currentAnim?: { key?: string } | null };
        };
      };
      const b = player.sprite.body;
      return (
        b.velocity.x === 0 &&
        (b.blocked.down || b.touching.down) &&
        player.sprite.anims?.currentAnim?.key === 'player_idle'
      );
    }, undefined, { timeout: 5_000 });

    const frozen = await snapshotPlayer(page);
    // ArrowRight is still held — the freeze must come from the input
    // context check, not from the player releasing the key.
    expect(frozen.vx).toBe(0);
    expect(frozen.anim).toBe('player_idle');

    await page.keyboard.up('ArrowRight');
    errors.assertClean();
  });
});
