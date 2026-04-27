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

import { TerroristCommander } from './TerroristCommander';

describe('TerroristCommander', () => {
  it('spawns as non-stompable with hitCost=2 and default speed=100', () => {
    const scene = createFakeScene();
    const cmd = new TerroristCommander(scene as unknown as Phaser.Scene, 500, 800, { minX: 400, maxX: 600 });
    const body = cmd.body as ReturnType<typeof makeFakeBody>;

    expect(cmd.canBeStomped).toBe(false);
    expect(cmd.hitCost).toBe(2);
    expect(body.setSize).toHaveBeenCalledWith(36, 52);
    expect(body.setOffset).toHaveBeenCalledWith(4, 4);
    expect(body.velocity.x).toBe(100);
  });

  it('accepts custom speed', () => {
    const scene = createFakeScene();
    const cmd = new TerroristCommander(scene as unknown as Phaser.Scene, 500, 800, { minX: 400, maxX: 600, speed: 150 });
    expect((cmd.body as { velocity: { x: number } }).velocity.x).toBe(150);
  });

  it('turns around at patrol bounds', () => {
    const scene = createFakeScene();
    const cmd = new TerroristCommander(scene as unknown as Phaser.Scene, 500, 800, { minX: 400, maxX: 600, speed: 100 });

    // Hit right bound
    cmd.x = 600;
    (cmd.body as { velocity: { x: number } }).velocity.x = 100;
    cmd.update();
    expect((cmd.body as { velocity: { x: number } }).velocity.x).toBe(-100);
    expect((cmd as unknown as { flipped: boolean }).flipped).toBe(true);

    // Hit left bound
    cmd.x = 400;
    (cmd.body as { velocity: { x: number } }).velocity.x = -100;
    cmd.update();
    expect((cmd.body as { velocity: { x: number } }).velocity.x).toBe(100);
    expect((cmd as unknown as { flipped: boolean }).flipped).toBe(false);
  });

  it('update() is a no-op once defeated', () => {
    const scene = createFakeScene();
    const cmd = new TerroristCommander(scene as unknown as Phaser.Scene, 500, 800, { minX: 400, maxX: 600 });

    cmd.defeated = true;
    cmd.x = 600;
    (cmd.body as { velocity: { x: number } }).velocity.x = 100;
    cmd.update();
    expect((cmd.body as { velocity: { x: number } }).velocity.x).toBe(100);
  });

  it('defeatByWeapon() sets defeated=true and returns true', () => {
    const scene = createFakeScene();
    const cmd = new TerroristCommander(scene as unknown as Phaser.Scene, 500, 800, { minX: 400, maxX: 600 });

    expect(cmd.defeated).toBe(false);
    const result = cmd.defeatByWeapon();
    expect(result).toBe(true);
    expect(cmd.defeated).toBe(true);
  });

  it('defeatByWeapon() returns false when already defeated', () => {
    const scene = createFakeScene();
    const cmd = new TerroristCommander(scene as unknown as Phaser.Scene, 500, 800, { minX: 400, maxX: 600 });

    cmd.defeatByWeapon();
    const result = cmd.defeatByWeapon();
    expect(result).toBe(false);
  });

  it('defeatByWeapon() disables body', () => {
    const scene = createFakeScene();
    const cmd = new TerroristCommander(scene as unknown as Phaser.Scene, 500, 800, { minX: 400, maxX: 600 });

    cmd.defeatByWeapon();
    expect((cmd.body as { enable: boolean }).enable).toBe(false);
  });

  it('onStomp() delegates to defeatByWeapon() — sets defeated=true', () => {
    const scene = createFakeScene();
    const cmd = new TerroristCommander(scene as unknown as Phaser.Scene, 500, 800, { minX: 400, maxX: 600 });

    expect(cmd.defeated).toBe(false);
    cmd.onStomp();
    expect(cmd.defeated).toBe(true);
  });
});
