import { describe, it, expect, vi } from 'vitest';
import { createFakeBody, createFakeScene } from '../../tests/helpers/phaserMock';
import type * as Phaser from 'phaser';

function makeFakeBody() {
  const body = createFakeBody() as ReturnType<typeof createFakeBody> & {
    setSize: (w: number, h: number) => unknown;
    setOffset: (x: number, y: number) => unknown;
    setCollideWorldBounds: (b: boolean) => unknown;
  };
  body.setSize = vi.fn(() => body);
  body.setOffset = vi.fn(() => body);
  body.setCollideWorldBounds = vi.fn(() => body);
  return body;
}

vi.mock('phaser', () => {
  class Sprite {
    scene: unknown;
    x: number;
    y: number;
    body = makeFakeBody();

    constructor(scene: unknown, x: number, y: number) {
      this.scene = scene;
      this.x = x;
      this.y = y;
    }

    setDepth() { return this; }
    setTintFill() { return this; }
    clearTint() { return this; }
    setVelocityX(v: number) { (this.body as { velocity: { x: number } }).velocity.x = v; return this; }
    setVelocityY(v: number) { (this.body as { velocity: { y: number } }).velocity.y = v; return this; }
    destroy() { /* no-op */ }
  }

  const Phaser = { Physics: { Arcade: { Sprite } } };
  return { ...Phaser, default: Phaser };
});

import { Enemy } from './Enemy';

/** Minimal concrete enemy — no patrol logic; only the base class is under test. */
class MinimalEnemy extends Enemy {
  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, 'minimal_enemy');
  }
}

describe('Enemy (base class)', () => {
  it('initialises with default flags: not stomped, collidesWithLevel, not defeated', () => {
    const scene = createFakeScene();
    const e = new MinimalEnemy(scene as unknown as Phaser.Scene, 500, 800);
    expect(e.canBeStomped).toBe(false);
    expect(e.collidesWithLevel).toBe(true);
    expect(e.defeated).toBe(false);
    expect(e.hitCost).toBe(1);
  });

  it('update() is a no-op on the base class', () => {
    const scene = createFakeScene();
    const e = new MinimalEnemy(scene as unknown as Phaser.Scene, 500, 800);
    // Should not throw and should not change any state.
    expect(() => e.update(0, 16)).not.toThrow();
    expect(e.defeated).toBe(false);
  });

  describe('onStomp()', () => {
    it('marks defeated and disables the physics body', () => {
      const scene = createFakeScene();
      const e = new MinimalEnemy(scene as unknown as Phaser.Scene, 500, 800);
      e.onStomp();
      expect(e.defeated).toBe(true);
      expect((e.body as { enable: boolean }).enable).toBe(false);
    });

    it('kills all existing tweens on the enemy', () => {
      const scene = createFakeScene();
      const e = new MinimalEnemy(scene as unknown as Phaser.Scene, 500, 800);
      e.onStomp();
      expect(scene.tweens.killTweensOf).toHaveBeenCalledWith(e);
    });

    it('calls setTintFill immediately for impact flash', () => {
      const scene = createFakeScene();
      const e = new MinimalEnemy(scene as unknown as Phaser.Scene, 500, 800);
      const setTintFill = vi.spyOn(e, 'setTintFill');
      e.onStomp();
      expect(setTintFill).toHaveBeenCalledWith(0xffffff);
    });

    it('calls clearTint after the 60 ms delayed call', () => {
      const scene = createFakeScene();
      const e = new MinimalEnemy(scene as unknown as Phaser.Scene, 500, 800);
      const clearTint = vi.spyOn(e, 'clearTint');

      e.onStomp();
      expect(clearTint).not.toHaveBeenCalled(); // not immediate

      scene.advanceTime(60);
      scene.runDelayedCalls();
      expect(clearTint).toHaveBeenCalled();
    });

    it('clearTint callback skips when scene is gone (null-guard branch)', () => {
      const scene = createFakeScene();
      const e = new MinimalEnemy(scene as unknown as Phaser.Scene, 500, 800);
      const clearTint = vi.spyOn(e, 'clearTint');

      e.onStomp();
      // Simulate the scene being torn down before the delayed call fires.
      (e as unknown as { scene: null }).scene = null;

      scene.advanceTime(60);
      expect(() => scene.runDelayedCalls()).not.toThrow();
      expect(clearTint).not.toHaveBeenCalled();
    });

    it('adds a squash tween whose onComplete destroys the enemy', () => {
      const scene = createFakeScene();
      const e = new MinimalEnemy(scene as unknown as Phaser.Scene, 500, 800);
      const destroy = vi.spyOn(e, 'destroy');

      e.onStomp();

      // Retrieve the last tween added and fire its onComplete manually.
      const tweenAdd = scene.tweens.add as ReturnType<typeof vi.fn>;
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const lastTween = tweenAdd.mock.results[tweenAdd.mock.results.length - 1]!.value as {
        onComplete?: () => void;
      };
      lastTween.onComplete?.();

      expect(destroy).toHaveBeenCalled();
    });

    it('is idempotent — second call is a no-op', () => {
      const scene = createFakeScene();
      const e = new MinimalEnemy(scene as unknown as Phaser.Scene, 500, 800);

      e.onStomp();
      const callCountAfterFirst = (scene.tweens.killTweensOf as ReturnType<typeof vi.fn>).mock.calls.length;

      e.onStomp();
      expect((scene.tweens.killTweensOf as ReturnType<typeof vi.fn>).mock.calls.length).toBe(callCountAfterFirst);
    });
  });
});
