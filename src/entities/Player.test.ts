import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createFakeScene, type FakeScene, type FakeSprite } from '../../tests/helpers/phaserMock';
import type * as Phaser from 'phaser';
import { eventBus } from '../systems/EventBus';

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
});
