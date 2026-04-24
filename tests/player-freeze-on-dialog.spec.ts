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
    }, undefined, { timeout: 15_000 });

    // Start walking right — keep the key held for the rest of the test so
    // we can prove the player halts despite ongoing directional input.
    await page.keyboard.down('ArrowRight');

    // Wait until the player is visibly walking on the ground: onGround +
    // vx > 50 proves the ArrowRight keypress is reaching the game and
    // physics is responding. The `player_walk` anim is deliberately NOT
    // part of the precondition — on CI's starved frame loop the
    // airborne-anim grace / player_land squash can keep the anim out of
    // `walk` for seconds at a time, while the freeze regression the
    // test targets is about what happens AFTER `dialogs.open()` fires.
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
        };
      } | undefined;
      if (!player) return false;
      const b = player.sprite.body;
      const onGround = b.blocked.down || b.touching.down;
      return onGround && b.velocity.x > 50;
    }, undefined, { timeout: 15_000 });

    const moving = await snapshotPlayer(page);
    expect(moving.vx).toBeGreaterThan(50);

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
    // the dialog opened. `anim` isn't checked here — under CI's starved
    // frame loop the animation controller can lag the physics by several
    // hundred ms (airborne grace + player_land squash + slope jitter), so
    // the precondition the regression cares about is vx > 0 while
    // ArrowRight is held.
    expect(atOpen.onGround).toBe(true);
    expect(atOpen.vx).toBeGreaterThan(50);

    await waitForDialogOpen(page, 'PlatformTeamScene');

    // Wait until the freeze has fully settled — Player.update() snaps vx
    // to 0 immediately, but the `player_land` squash anim (played if the
    // player just finished the initial spawn drop) gates animation
    // updates for up to 120ms. We want to observe the steady state.
    //
    // Read the snapshot INSIDE the wait and return it when the freeze
    // condition holds. This avoids a flake where the wait succeeds, then
    // between ticks a 1-frame onGround/touching jitter or anim swap leaks
    // into the follow-up `snapshotPlayer(page)` roundtrip and the final
    // asserts see stale/other values.
    const frozenHandle = await page.waitForFunction(() => {
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
      const animKey = player.sprite.anims?.currentAnim?.key ?? null;
      if (
        b.velocity.x === 0 &&
        (b.blocked.down || b.touching.down) &&
        animKey === 'player_idle'
      ) {
        return { vx: b.velocity.x, anim: animKey };
      }
      return null;
    }, undefined, { timeout: 15_000 });
    const frozen = (await frozenHandle.jsonValue()) as { vx: number; anim: string };

    // ArrowRight is still held — the freeze must come from the input
    // context check, not from the player releasing the key.
    expect(frozen.vx).toBe(0);
    expect(frozen.anim).toBe('player_idle');

    await page.keyboard.up('ArrowRight');
    errors.assertClean();
  });
});
