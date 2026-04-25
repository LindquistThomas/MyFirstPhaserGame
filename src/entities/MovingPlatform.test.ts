import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createFakeScene, createFakeBody } from '../../tests/helpers/phaserMock';
import type * as Phaser from 'phaser';

// Minimal Phaser.Physics.Arcade.Image stand-in — MovingPlatform extends it at
// runtime. The fake body extends phaserMock's body with the extra methods
// Arcade.Body exposes and MovingPlatform calls: setSize / setVelocity.
function makeFakeBody() {
  const body = createFakeBody() as ReturnType<typeof createFakeBody> & {
    setSize: (w: number, h: number, center?: boolean) => unknown;
    setVelocity: (x: number, y: number) => unknown;
    setVelocityX: (x: number) => unknown;
    setVelocityY: (y: number) => unknown;
    checkCollision: { up: boolean; down: boolean; left: boolean; right: boolean };
  };
  body.checkCollision = { up: true, down: true, left: true, right: true };
  body.setSize = vi.fn(() => body);
  body.setVelocity = vi.fn((x: number, y: number) => {
    body.velocity.x = x;
    body.velocity.y = y;
    return body;
  });
  body.setVelocityX = vi.fn((x: number) => {
    body.velocity.x = x;
    return body;
  });
  body.setVelocityY = vi.fn((y: number) => {
    body.velocity.y = y;
    return body;
  });
  return body;
}

vi.mock('phaser', () => {
  class Image {
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
    setDisplaySize() { return this; }
    destroy() { /* no-op */ }
  }
  const Phaser = {
    Physics: { Arcade: { Image } },
    Math: {
      Clamp: (v: number, min: number, max: number) => Math.min(Math.max(v, min), max),
    },
  };
  return { ...Phaser, default: Phaser };
});

import { MovingPlatform } from './MovingPlatform';

function makePlatform(overrides: Partial<ConstructorParameters<typeof MovingPlatform>[1]> = {}) {
  const scene = createFakeScene();
  const cfg = {
    x: 100,
    y: 500,
    width: 80,
    axis: 'x' as const,
    distance: 200,
    mode: 'bounce' as const,
    speed: 60,
    ...overrides,
  };
  const platform = new MovingPlatform(scene as unknown as Phaser.Scene, cfg);
  return { scene, platform };
}

describe('MovingPlatform', () => {
  describe('bounce mode', () => {
    let platform: MovingPlatform;

    beforeEach(() => {
      ({ platform } = makePlatform());
    });

    it('starts immovable, gravity-free, with forward velocity', () => {
      const body = platform.body as ReturnType<typeof createFakeBody>;
      expect(body.setImmovable).toHaveBeenCalledWith(true);
      expect(body.setAllowGravity).toHaveBeenCalledWith(false);
      expect(body.velocity.x).toBe(60);
    });

    it('is one-way: solid from above, pass-through from below/sides', () => {
      const body = platform.body as unknown as {
        checkCollision: { up: boolean; down: boolean; left: boolean; right: boolean };
      };
      expect(body.checkCollision.up).toBe(true);
      expect(body.checkCollision.down).toBe(false);
      expect(body.checkCollision.left).toBe(false);
      expect(body.checkCollision.right).toBe(false);
    });

    it('flips velocity when it passes the max bound', () => {
      const body = platform.body as ReturnType<typeof createFakeBody>;
      platform.x = 400;
      body.velocity.x = 60;
      platform.update();
      expect(body.velocity.x).toBe(-60);
    });

    it('flips velocity when it passes the min bound', () => {
      const body = platform.body as ReturnType<typeof createFakeBody>;
      platform.x = 100;
      body.velocity.x = -60;
      platform.update();
      expect(body.velocity.x).toBe(60);
    });

    it('negative distance starts backwards', () => {
      const { platform: p } = makePlatform({ distance: -120 });
      const body = p.body as ReturnType<typeof createFakeBody>;
      expect(body.velocity.x).toBe(-60);
    });

    it('axis=y bouncer drives vertical velocity', () => {
      const { platform: p } = makePlatform({ axis: 'y', distance: -140, y: 600 });
      const body = p.body as ReturnType<typeof createFakeBody>;
      expect(body.velocity.y).toBe(-60);
      // Simulate reaching the top bound.
      p.y -= 140;
      body.velocity.y = -60;
      p.update();
      expect(body.velocity.y).toBe(60);
    });

    it('pause() zeros velocity and resume() restores it', () => {
      const body = platform.body as ReturnType<typeof createFakeBody>;
      body.velocity.x = 60;
      platform.pause();
      expect(body.velocity.x).toBe(0);
      platform.resume();
      expect(body.velocity.x).toBe(60);
    });

    it('pause() and resume() are idempotent', () => {
      const body = platform.body as ReturnType<typeof createFakeBody>;
      body.velocity.x = 60;
      platform.pause();
      platform.pause();
      expect(body.velocity.x).toBe(0);
      platform.resume();
      platform.resume();
      expect(body.velocity.x).toBe(60);
    });

    it('update() is a no-op while paused', () => {
      const body = platform.body as ReturnType<typeof createFakeBody>;
      platform.x = 400; // would flip if not paused
      body.velocity.x = 60;
      platform.pause();
      platform.update();
      // Still zero (update didn't run flip logic because paused).
      expect(body.velocity.x).toBe(0);
    });

    // Scenes mark MovingPlatform shutdown.
    it('destroy() stops the (non-existent) tween without throwing', () => {
      expect(() => platform.destroy()).not.toThrow();
    });
  });

  describe('tween mode', () => {
    it('registers a yoyo tween on the axis property', () => {
      const { scene } = makePlatform({ mode: 'tween', duration: 1500, ease: 'Linear' });
      const add = scene.tweens.add as unknown as ReturnType<typeof vi.fn>;
      expect(add).toHaveBeenCalled();
      const cfg = add.mock.calls[0]![0] as Record<string, unknown>;
      expect(cfg['duration']).toBe(1500);
      expect(cfg['ease']).toBe('Linear');
      expect(cfg['yoyo']).toBe(true);
      expect(cfg['repeat']).toBe(-1);
    });

    it('update() does nothing for tween-mode platforms', () => {
      const { platform } = makePlatform({ mode: 'tween' });
      const body = platform.body as ReturnType<typeof createFakeBody>;
      // Place past the max bound — bounce mode would flip, tween mode shouldn't.
      platform.x = 9999;
      body.velocity.x = 0;
      expect(() => platform.update()).not.toThrow();
      expect(body.velocity.x).toBe(0);
    });

    it('phase delays the tween start', () => {
      const { scene } = makePlatform({ mode: 'tween', duration: 2000, phase: 0.5 });
      const add = scene.tweens.add as unknown as ReturnType<typeof vi.fn>;
      const cfg = add.mock.calls[0]![0] as Record<string, unknown>;
      expect(cfg['delay']).toBe(1000);
    });
  });
});
