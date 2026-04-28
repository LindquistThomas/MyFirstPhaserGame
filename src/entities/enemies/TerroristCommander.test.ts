import { describe, it, expect, vi } from 'vitest';
import { createFakeBody, createFakeScene } from '../../../tests/helpers/phaserMock';
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

type FakeBodyType = ReturnType<typeof makeFakeBody>;

vi.mock('phaser', () => {
  class Sprite {
    scene: unknown;
    x: number;
    y: number;
    body = makeFakeBody();
    flipped = false;

    constructor(scene: unknown, x: number, y: number) {
      this.scene = scene;
      this.x = x;
      this.y = y;
    }

    setDepth() { return this; }
    setAlpha() { return this; }
    setScale() { return this; }
    setVelocity(x: number, y: number) { this.body.velocity.x = x; this.body.velocity.y = y; return this; }
    setVelocityX(v: number) { this.body.velocity.x = v; return this; }
    setVelocityY(v: number) { this.body.velocity.y = v; return this; }
    setFlipX(flipped: boolean) { this.flipped = flipped; return this; }
    setTintFill() { return this; }
    clearTint() { return this; }
    destroy() { /* no-op */ }
  }

  const Phaser = { Physics: { Arcade: { Sprite } } };
  return { ...Phaser, default: Phaser };
});

import { TerroristCommander } from './TerroristCommander';

describe('TerroristCommander', () => {
  it('is not stompable, has higher hit cost and knockback, and patrols forward', () => {
    const scene = createFakeScene();
    const tc = new TerroristCommander(scene as unknown as Phaser.Scene, 500, 800, {
      minX: 400, maxX: 600, speed: 90,
    });
    const body = tc.body as unknown as FakeBodyType;

    expect(tc.canBeStomped).toBe(false);
    expect(tc.hitCost).toBe(2);
    expect(tc.knockbackX).toBe(300);
    expect(tc.knockbackY).toBe(-280);
    expect(body.setSize).toHaveBeenCalledWith(36, 50);
    expect(body.setOffset).toHaveBeenCalledWith(2, 6);
    expect(body.velocity.x).toBe(90);
  });

  it('uses default patrol bounds when opts omitted', () => {
    const scene = createFakeScene();
    const tc = new TerroristCommander(scene as unknown as Phaser.Scene, 500, 800);
    // Default speed is 90 and patrol is x ± 160
    expect((tc.body as unknown as FakeBodyType).velocity.x).toBe(90);
  });

  it('turns around at patrol bounds', () => {
    const scene = createFakeScene();
    const tc = new TerroristCommander(scene as unknown as Phaser.Scene, 500, 800, {
      minX: 400, maxX: 600, speed: 90,
    });

    tc.x = 600;
    (tc.body as unknown as FakeBodyType).velocity.x = 90;
    tc.update();
    expect((tc.body as unknown as FakeBodyType).velocity.x).toBe(-90);
    expect((tc as unknown as { flipped: boolean }).flipped).toBe(true);

    tc.x = 400;
    (tc.body as unknown as FakeBodyType).velocity.x = -90;
    tc.update();
    expect((tc.body as unknown as FakeBodyType).velocity.x).toBe(90);
    expect((tc as unknown as { flipped: boolean }).flipped).toBe(false);
  });

  it('update() is no-op when defeated', () => {
    const scene = createFakeScene();
    const tc = new TerroristCommander(scene as unknown as Phaser.Scene, 500, 800, {
      minX: 400, maxX: 600, speed: 90,
    });
    tc.x = 600;
    (tc.body as unknown as FakeBodyType).velocity.x = 90;
    tc.defeated = true;
    tc.update();
    // velocity unchanged — patrol logic skipped
    expect((tc.body as unknown as FakeBodyType).velocity.x).toBe(90);
  });

  it('defeat() marks defeated, disables body, and triggers tween', () => {
    const scene = createFakeScene();
    const tc = new TerroristCommander(scene as unknown as Phaser.Scene, 500, 800, {
      minX: 400, maxX: 600,
    });

    tc.defeat();

    expect(tc.defeated).toBe(true);
    expect((tc.body as unknown as FakeBodyType).enable).toBe(false);
    expect(scene.tweens.killTweensOf).toHaveBeenCalledWith(tc);
    expect(scene.tweens.add).toHaveBeenCalled();
  });

  it('defeat() is idempotent', () => {
    const scene = createFakeScene();
    const tc = new TerroristCommander(scene as unknown as Phaser.Scene, 500, 800, {
      minX: 400, maxX: 600,
    });

    tc.defeat();
    tc.defeat();

    expect(scene.tweens.add).toHaveBeenCalledTimes(1);
  });
});
