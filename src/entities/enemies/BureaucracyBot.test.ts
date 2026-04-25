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

import { BureaucracyBot } from './BureaucracyBot';

describe('BureaucracyBot', () => {
  it('spawns as an avoid-only hazard with bot body size and default speed', () => {
    const scene = createFakeScene();
    const bot = new BureaucracyBot(scene as unknown as Phaser.Scene, 500, 800, { minX: 400, maxX: 600 });
    const body = bot.body as ReturnType<typeof makeFakeBody>;

    expect(bot.canBeStomped).toBe(false);
    expect(bot.hitCost).toBe(1);
    expect(body.setSize).toHaveBeenCalledWith(28, 52);
    expect(body.setOffset).toHaveBeenCalledWith(6, 2);
    expect(body.velocity.x).toBe(75);
  });

  it('turns around at patrol bounds with bot-facing flips', () => {
    const scene = createFakeScene();
    const bot = new BureaucracyBot(scene as unknown as Phaser.Scene, 500, 800, { minX: 400, maxX: 600, speed: 90 });

    bot.x = 600;
    (bot.body as { velocity: { x: number } }).velocity.x = 90;
    bot.update();
    expect((bot.body as { velocity: { x: number } }).velocity.x).toBe(-90);
    expect((bot as unknown as { flipped: boolean }).flipped).toBe(false);

    bot.x = 400;
    (bot.body as { velocity: { x: number } }).velocity.x = -90;
    bot.update();
    expect((bot.body as { velocity: { x: number } }).velocity.x).toBe(90);
    expect((bot as unknown as { flipped: boolean }).flipped).toBe(true);
  });

  it('update() is a no-op once defeated', () => {
    const scene = createFakeScene();
    const bot = new BureaucracyBot(scene as unknown as Phaser.Scene, 500, 800, { minX: 400, maxX: 600 });

    bot.defeated = true;
    bot.x = 600;
    (bot.body as { velocity: { x: number } }).velocity.x = 75;
    bot.update();

    expect((bot.body as { velocity: { x: number } }).velocity.x).toBe(75);
  });
});
