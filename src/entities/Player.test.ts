import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createFakeScene, type FakeScene, type FakeSprite } from '../../tests/helpers/phaserMock';
import type * as Phaser from 'phaser';
import { eventBus } from '../systems/EventBus';
import * as MotionPreference from '../systems/MotionPreference';

vi.mock('phaser', () => {
  class Sprite {}
  class ScenePlugin {
    constructor() {}
  }
  const KeyCodes = {
    LEFT: 37, UP: 38, RIGHT: 39, DOWN: 40,
    SPACE: 32, ENTER: 13, ESC: 27,
    PAGE_UP: 33, PAGE_DOWN: 34,
    A: 65, B: 66, C: 67, D: 68, I: 73, S: 83, W: 87,
    ONE: 49, TWO: 50, THREE: 51, FOUR: 52,
    F12: 123,
  };
  const Phaser = {
    Physics: { Arcade: { Sprite } },
    Animations: { Events: { ANIMATION_UPDATE: 'animationupdate' } },
    Input: { Keyboard: { KeyCodes } },
    Plugins: { ScenePlugin },
  };
  return { ...Phaser, default: Phaser };
});

import { Player } from './Player';

function makePlayer(): { scene: FakeScene; player: Player; sprite: FakeSprite } {
  const scene = createFakeScene();
  const player = new Player(scene as unknown as Phaser.Scene, 100, 400);
  const sprite = player.sprite as unknown as FakeSprite;
  return { scene, player, sprite };
}

// Register no-op listeners for sfx events Player emits so the event bus
// singleton doesn't accumulate handler state across tests.
const noop = () => {};

describe('Player', () => {
  let scene: FakeScene;
  let player: Player;
  let sprite: FakeSprite;

  beforeEach(() => {
    eventBus.on('sfx:jump', noop);
    eventBus.on('sfx:footstep_a', noop);
    eventBus.on('sfx:footstep_b', noop);
    ({ scene, player, sprite } = makePlayer());
  });

  afterEach(() => {
    eventBus.off('sfx:jump', noop);
    eventBus.off('sfx:footstep_a', noop);
    eventBus.off('sfx:footstep_b', noop);
  });

  it('does not play any animation until first update (starts in idle state)', () => {
    expect(sprite.lastAnimKey).toBeNull();
  });

  it('plays player_walk when horizontal input > 0 on ground', () => {
    scene.inputs.horizontal = () => 1;
    sprite.body.blocked.down = true;

    player.update(16.67);

    expect(sprite.lastAnimKey).toBe('player_walk');
  });

  it('plays player_fall once airborne past AIRBORNE_ANIM_GRACE_MS', () => {
    sprite.body.blocked.down = false;
    sprite.body.touching.down = false;

    // First update: registers airborneSince (transition grounded→airborne).
    player.update(16.67);
    // Still within grace window — no fall switch.
    expect(sprite.lastAnimKey).not.toBe('player_fall');

    // Advance scene clock past AIRBORNE_ANIM_GRACE_MS (80ms).
    scene.advanceTime(120);
    player.update(16.67);
    expect(sprite.lastAnimKey).toBe('player_fall');
  });

  it('does NOT switch to fall within the airborne grace window', () => {
    sprite.body.blocked.down = false;
    sprite.body.touching.down = false;

    // First airborne frame sets airborneSince = scene.time.now (0).
    player.update(16.67);
    // 50ms later — still under 80ms grace.
    scene.advanceTime(50);
    player.update(16.67);

    expect(sprite.lastAnimKey).not.toBe('player_fall');
  });

  it('setFlipEnabled(false) blocks Jump from starting a flip', () => {
    scene.inputs.justPressed = () => true;
    sprite.body.blocked.down = true;
    player.setFlipEnabled(false);

    player.update(16.67);

    expect(player.getIsFlipping()).toBe(false);
  });

  it('Jump starts a flip when enabled and on ground', () => {
    scene.inputs.justPressed = () => true;
    sprite.body.blocked.down = true;

    player.update(16.67);

    expect(player.getIsFlipping()).toBe(true);
  });

  it('takeHit applies knockback velocity and sets invulnerability', () => {
    const setVelocity = sprite.setVelocity as unknown as ReturnType<typeof vi.fn>;
    setVelocity.mockClear();

    player.takeHit(100, -200, 500);

    expect(setVelocity).toHaveBeenCalledWith(100, -200);
    expect(player.isInvulnerable()).toBe(true);
  });

  it('takeHit is a no-op while still invulnerable', () => {
    const setVelocity = sprite.setVelocity as unknown as ReturnType<typeof vi.fn>;

    player.takeHit(100, -200, 1000);
    setVelocity.mockClear();

    // Second hit within the invulnerability window — should not apply.
    player.takeHit(50, -50, 1000);
    expect(setVelocity).not.toHaveBeenCalled();
  });

  it('destroy() stops and clears hit-flash tween', () => {
    player.takeHit(100, -200, 1000);
    const tween = (player as unknown as { hitFlashTween?: { stop: ReturnType<typeof vi.fn> } }).hitFlashTween;
    expect(tween).toBeDefined();

    player.destroy();

    expect(tween?.stop).toHaveBeenCalledTimes(1);
    expect((player as unknown as { hitFlashTween?: unknown }).hitFlashTween).toBeUndefined();
  });

  it('getIsFlipping clears once the player touches the ground again', () => {
    scene.inputs.justPressed = () => true;
    sprite.body.blocked.down = true;

    // Start the jump.
    player.update(16.67);
    expect(player.getIsFlipping()).toBe(true);

    // Stop pressing Jump, go airborne, and advance past the grace window.
    scene.inputs.justPressed = () => false;
    sprite.body.blocked.down = false;
    sprite.body.touching.down = false;
    sprite.body.velocity.y = -100; // still ascending
    scene.advanceTime(120);
    player.update(16.67);
    expect(player.getIsFlipping()).toBe(true);

    // Descending phase.
    sprite.body.velocity.y = 400;
    player.update(16.67);
    expect(player.getIsFlipping()).toBe(true);

    // Land — next update should clear the flipping flag.
    sprite.body.blocked.down = true;
    player.update(16.67);

    expect(player.getIsFlipping()).toBe(false);
  });

  it('snaps horizontal velocity to 0 and plays idle when input context becomes non-gameplay', async () => {
    // Player is running right on the ground.
    scene.inputs.horizontal = () => 1;
    sprite.body.blocked.down = true;
    player.update(16.67);
    expect(sprite.lastAnimKey).toBe('player_walk');
    expect(sprite.body.velocity.x).toBeGreaterThan(0);

    // A modal (info dialog) opens — input context is now 'modal', so
    // gameplay actions no longer dispatch and horizontal() would return 0
    // in real code. Simulate that at the API level while also pushing the
    // real context so the Player's activeContext() check fires.
    scene.inputs.horizontal = () => 0;
    const { pushContext, popContext } = await import('../input');
    const token = pushContext('modal');
    try {
      player.update(16.67);
      // Hard-snap, not gradual deceleration.
      expect(sprite.body.velocity.x).toBe(0);
      // And the walk animation has stopped in favour of idle.
      expect(sprite.lastAnimKey).toBe('player_idle');
    } finally {
      popContext(token);
    }
  });

  // ── FSM transition tests ──────────────────────────────────────────────────

  describe('FSM transitions', () => {
    it('grounded → airborne when player walks off a ledge', () => {
      // Start confirmed on ground.
      sprite.body.blocked.down = true;
      player.update(16.67);
      expect(player.getPlayerState()).toBe('grounded');

      // Walk off ledge: no longer on ground.
      sprite.body.blocked.down = false;
      sprite.body.touching.down = false;
      player.update(16.67);
      expect(player.getPlayerState()).toBe('airborne');
    });

    it('airborne → grounded when landed within grace window (no squash)', () => {
      // Go airborne.
      sprite.body.blocked.down = false;
      sprite.body.touching.down = false;
      player.update(16.67);
      expect(player.getPlayerState()).toBe('airborne');

      // Land immediately — airborne duration is under AIRBORNE_ANIM_GRACE_MS
      // so no landing squash; state goes straight to grounded.
      sprite.body.blocked.down = true;
      player.update(16.67);
      expect(player.getPlayerState()).toBe('grounded');
    });

    it('airborne → landing → grounded when landed after grace window', () => {
      // Go airborne.
      sprite.body.blocked.down = false;
      sprite.body.touching.down = false;
      player.update(16.67);
      expect(player.getPlayerState()).toBe('airborne');

      // Advance past AIRBORNE_ANIM_GRACE_MS (80 ms).
      scene.advanceTime(120);
      player.update(16.67);
      expect(player.getPlayerState()).toBe('airborne');

      // Land — triggers squash → landing state.
      sprite.body.blocked.down = true;
      player.update(16.67);
      expect(player.getPlayerState()).toBe('landing');

      // Squash anim completes (120 ms delayed call) → grounded.
      scene.advanceTime(120);
      scene.runDelayedCalls();
      expect(player.getPlayerState()).toBe('grounded');
    });

    it('skips landing squash tween when reduced motion is enabled', () => {
      const reducedMotionSpy = vi.spyOn(MotionPreference, 'isReducedMotion').mockReturnValue(true);
      const tweenAdd = scene.tweens.add as ReturnType<typeof vi.fn>;

      sprite.body.blocked.down = false;
      sprite.body.touching.down = false;
      player.update(16.67);
      scene.advanceTime(120);
      player.update(16.67);

      tweenAdd.mockClear();
      sprite.body.blocked.down = true;
      player.update(16.67);

      expect(tweenAdd).not.toHaveBeenCalled();
      reducedMotionSpy.mockRestore();
    });

    it('grounded → flipping on jump input', () => {
      scene.inputs.justPressed = () => true;
      sprite.body.blocked.down = true;

      player.update(16.67);
      expect(player.getPlayerState()).toBe('flipping');
    });

    it('flipping → grounded on land within grace window (no squash)', () => {
      // Initiate jump while on ground.
      scene.inputs.justPressed = () => true;
      sprite.body.blocked.down = true;
      player.update(16.67);
      expect(player.getPlayerState()).toBe('flipping');

      // Go airborne with descending velocity (simulate apex + descent in
      // the same frame to keep the test simple).
      scene.inputs.justPressed = () => false;
      sprite.body.blocked.down = false;
      sprite.body.touching.down = false;
      sprite.body.velocity.y = 100; // descending

      // Land immediately (under grace window) → grounded directly.
      sprite.body.blocked.down = true;
      player.update(16.67);
      expect(player.getPlayerState()).toBe('grounded');
    });

    it('flipping → landing → grounded after full arc', () => {
      // Initiate jump.
      scene.inputs.justPressed = () => true;
      sprite.body.blocked.down = true;
      player.update(16.67);
      expect(player.getPlayerState()).toBe('flipping');

      // Go airborne past grace window.
      scene.inputs.justPressed = () => false;
      sprite.body.blocked.down = false;
      sprite.body.touching.down = false;
      sprite.body.velocity.y = -400; // ascending
      scene.advanceTime(120);
      player.update(16.67);
      expect(player.getPlayerState()).toBe('flipping');

      // Descend and land → should go to landing (squash).
      sprite.body.velocity.y = 400;
      sprite.body.blocked.down = true;
      player.update(16.67);
      expect(player.getPlayerState()).toBe('landing');

      // Squash completes → grounded.
      scene.advanceTime(120);
      scene.runDelayedCalls();
      expect(player.getPlayerState()).toBe('grounded');
    });

    it('any state → hitStun on takeHit (not while flipping)', () => {
      // Start grounded.
      sprite.body.blocked.down = true;
      player.update(16.67);
      expect(player.getPlayerState()).toBe('grounded');

      player.takeHit(100, -200, 500);
      expect(player.getPlayerState()).toBe('hitStun');
    });

    it('hitStun → grounded when stun expires while on ground', () => {
      sprite.body.blocked.down = true;
      player.update(16.67);

      // scene.time.now = 0; takeHit sets hitStunUntil = 220.
      player.takeHit(100, -200, 500);
      expect(player.getPlayerState()).toBe('hitStun');

      // Advance past hitStunUntil (220 ms).
      scene.advanceTime(250);
      player.update(16.67);
      expect(player.getPlayerState()).toBe('grounded');
    });

    it('hitStun → airborne when stun expires while airborne', () => {
      sprite.body.blocked.down = true;
      player.update(16.67);

      player.takeHit(100, -400, 500);
      expect(player.getPlayerState()).toBe('hitStun');

      // Player is now airborne (knocked upward).
      sprite.body.blocked.down = false;
      sprite.body.touching.down = false;

      // Advance past hitStunUntil.
      scene.advanceTime(250);
      player.update(16.67);
      expect(player.getPlayerState()).toBe('airborne');
    });

    it('takeHit is blocked while in flipping state', () => {
      // Initiate a jump → enter flipping state.
      scene.inputs.justPressed = () => true;
      sprite.body.blocked.down = true;
      player.update(16.67);
      expect(player.getPlayerState()).toBe('flipping');

      // takeHit should be ignored mid-flip.
      player.takeHit(100, -200, 500);
      expect(player.getPlayerState()).toBe('flipping');
    });
  });

  // ── Caffeine buff ──────────────────────────────────────────────────────────

  describe('caffeine buff', () => {
    it('isCaffeinated returns false before applyCaffeine', () => {
      expect(player.isCaffeinated()).toBe(false);
    });

    it('applyCaffeine activates the buff and isCaffeinated returns true', () => {
      player.applyCaffeine(2000);
      expect(player.isCaffeinated()).toBe(true);
    });

    it('isCaffeinated returns false after the buff duration expires', () => {
      player.applyCaffeine(500);
      scene.advanceTime(600);
      expect(player.isCaffeinated()).toBe(false);
    });

    it('applyCaffeine emits buff:caffeine_start with the duration', () => {
      const handler = vi.fn();
      eventBus.on('buff:caffeine_start', handler);
      try {
        player.applyCaffeine(3000);
        expect(handler).toHaveBeenCalledWith(3000);
      } finally {
        eventBus.off('buff:caffeine_start', handler);
      }
    });

    it('caffeinated jump uses a higher Y velocity', () => {
      const setVelocityY = sprite.setVelocityY as unknown as ReturnType<typeof vi.fn>;

      // Baseline jump without caffeine.
      sprite.body.blocked.down = true;
      scene.inputs.justPressed = () => true;
      player.update(16.67);
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const baseJumpVy = setVelocityY.mock.calls[setVelocityY.mock.calls.length - 1]![0] as number;

      // Reset and apply caffeine then jump again.
      const { scene: s2, player: p2, sprite: spr2 } = makePlayer();
      eventBus.on('sfx:jump', noop);
      p2.applyCaffeine(5000);
      spr2.body.blocked.down = true;
      s2.inputs.justPressed = () => true;
      const setVelocityY2 = spr2.setVelocityY as unknown as ReturnType<typeof vi.fn>;
      p2.update(16.67);
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const caffJumpVy = setVelocityY2.mock.calls[setVelocityY2.mock.calls.length - 1]![0] as number;
      eventBus.off('sfx:jump', noop);

      // Caffeinated jump velocity should have a larger magnitude (more negative).
      expect(caffJumpVy).toBeLessThan(baseJumpVy);
    });

    it('caffeinated ground movement uses a higher X speed', () => {
      const setVelocityX = sprite.setVelocityX as unknown as ReturnType<typeof vi.fn>;

      // Baseline ground speed without caffeine.
      sprite.body.blocked.down = true;
      scene.inputs.horizontal = () => 1;
      player.update(16.67);
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const baseVx = setVelocityX.mock.calls[setVelocityX.mock.calls.length - 1]![0] as number;

      // Reset and apply caffeine then move again.
      const { scene: s2, player: p2, sprite: spr2 } = makePlayer();
      p2.applyCaffeine(5000);
      spr2.body.blocked.down = true;
      s2.inputs.horizontal = () => 1;
      const setVelocityX2 = spr2.setVelocityX as unknown as ReturnType<typeof vi.fn>;
      p2.update(16.67);
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const caffVx = setVelocityX2.mock.calls[setVelocityX2.mock.calls.length - 1]![0] as number;

      expect(caffVx).toBeGreaterThan(baseVx);
    });

    it('tickCaffeine emits buff:caffeine_end and stops steam when buff expires', () => {
      const endHandler = vi.fn();
      eventBus.on('buff:caffeine_end', endHandler);
      try {
        // Apply a short buff; applyCaffeine calls start() → emitting becomes true.
        player.applyCaffeine(300);
        // Advance past the buff window; next update() calls tickCaffeine().
        scene.advanceTime(400);
        // Drive an update so tickCaffeine fires the expiry branch.
        sprite.body.blocked.down = true;
        player.update(16.67);
        expect(endHandler).toHaveBeenCalled();
      } finally {
        eventBus.off('buff:caffeine_end', endHandler);
      }
    });
  });

  // ── Utility API ────────────────────────────────────────────────────────────

  describe('setPosition', () => {
    it('snaps sprite to new coordinates and zeroes velocity', () => {
      sprite.body.velocity.x = 200;
      sprite.body.velocity.y = -300;
      player.setPosition(50, 150);
      expect(sprite.x).toBe(50);
      expect(sprite.y).toBe(150);
      expect(sprite.body.velocity.x).toBe(0);
      expect(sprite.body.velocity.y).toBe(0);
    });
  });

  describe('isHitStunned', () => {
    it('returns false before any hit', () => {
      expect(player.isHitStunned()).toBe(false);
    });

    it('returns true immediately after takeHit', () => {
      sprite.body.blocked.down = true;
      player.update(16.67);
      player.takeHit(100, -200, 500);
      expect(player.isHitStunned()).toBe(true);
    });

    it('returns false after the 220 ms input-lock window expires', () => {
      sprite.body.blocked.down = true;
      player.update(16.67);
      player.takeHit(100, -200, 500);
      scene.advanceTime(250);
      expect(player.isHitStunned()).toBe(false);
    });
  });

  describe('FSM edge cases', () => {
    it('landing → airborne when player falls off during squash', () => {
      // Put player into landing state (airborne > grace window, then land).
      sprite.body.blocked.down = false;
      sprite.body.touching.down = false;
      player.update(16.67);
      expect(player.getPlayerState()).toBe('airborne');

      scene.advanceTime(120);
      player.update(16.67);
      sprite.body.blocked.down = true;
      player.update(16.67);
      expect(player.getPlayerState()).toBe('landing');

      // Walk off the ledge while the squash animation is still playing.
      sprite.body.blocked.down = false;
      sprite.body.touching.down = false;
      player.update(16.67);
      expect(player.getPlayerState()).toBe('airborne');
    });
  });
});
