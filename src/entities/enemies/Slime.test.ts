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
    setFlipX(flipped: boolean) { this.flipped = flipped; return this; }
    setTintFill() { return this; }
    clearTint() { return this; }
    setVelocityX(v: number) { this.body.velocity.x = v; return this; }
    destroy() { /* no-op */ }
  }

  const Phaser = { Physics: { Arcade: { Sprite } } };
  return { ...Phaser, default: Phaser };
});

import { Slime } from './Slime';

describe('Slime', () => {
  it('spawns stompable with slime body size and default patrol speed', () => {
    const scene = createFakeScene();
    const slime = new Slime(scene as unknown as Phaser.Scene, 500, 800, { minX: 400, maxX: 600 });
    const body = slime.body as ReturnType<typeof makeFakeBody>;

    expect(slime.canBeStomped).toBe(true);
    expect(slime.hitCost).toBe(1);
    expect(body.setSize).toHaveBeenCalledWith(42, 26);
    expect(body.setOffset).toHaveBeenCalledWith(3, 6);
    expect(body.velocity.x).toBe(50);
    expect(scene.tweens.add).toHaveBeenCalled();
  });

  it('turns around at patrol bounds', () => {
    const scene = createFakeScene();
    const slime = new Slime(scene as unknown as Phaser.Scene, 500, 800, { minX: 400, maxX: 600, speed: 65 });

    slime.x = 600;
    (slime.body as { velocity: { x: number } }).velocity.x = 65;
    slime.update();
    expect((slime.body as { velocity: { x: number } }).velocity.x).toBe(-65);
    expect((slime as unknown as { flipped: boolean }).flipped).toBe(true);

    slime.x = 400;
    (slime.body as { velocity: { x: number } }).velocity.x = -65;
    slime.update();
    expect((slime.body as { velocity: { x: number } }).velocity.x).toBe(65);
    expect((slime as unknown as { flipped: boolean }).flipped).toBe(false);
  });

  it('update() and onStomp() are idempotent after defeat', () => {
    const scene = createFakeScene();
    const slime = new Slime(scene as unknown as Phaser.Scene, 500, 800, { minX: 400, maxX: 600 });

    slime.onStomp();
    slime.onStomp();
    slime.x = 600;
    (slime.body as { velocity: { x: number } }).velocity.x = 50;
    slime.update();

    expect(slime.defeated).toBe(true);
    expect((slime.body as { enable: boolean }).enable).toBe(false);
    expect(scene.tweens.killTweensOf).toHaveBeenCalledTimes(1);
    expect((slime.body as { velocity: { x: number } }).velocity.x).toBe(50);
  });
});
