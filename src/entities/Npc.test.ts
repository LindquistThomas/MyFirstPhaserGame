import { describe, it, expect, vi } from 'vitest';
import type * as Phaser from 'phaser';
import { createFakeBody, createFakeScene } from '../../tests/helpers/phaserMock';

function makeFakeBody() {
  const body = createFakeBody() as ReturnType<typeof createFakeBody> & {
    setCollideWorldBounds: (b: boolean) => unknown;
    setSize: (w: number, h: number) => unknown;
    setOffset: (x: number, y: number) => unknown;
  };
  body.setCollideWorldBounds = vi.fn(() => body);
  body.setSize = vi.fn(() => body);
  body.setOffset = vi.fn(() => body);
  return body;
}

vi.mock('phaser', () => {
  class Sprite {
    scene: unknown;
    x: number;
    y: number;
    body = makeFakeBody();
    flipX = false;

    constructor(scene: unknown, x: number, y: number) {
      this.scene = scene;
      this.x = x;
      this.y = y;
    }

    setDepth() { return this; }
    setOrigin() { return this; }
    setTint() { return this; }
    play() { return this; }
    setVelocityX(v: number) { (this.body as { velocity: { x: number } }).velocity.x = v; return this; }
    setFlipX(v: boolean) { this.flipX = v; return this; }
  }

  const Phaser = {
    Physics: { Arcade: { Sprite } },
    Math: { Distance: { Between: (x1: number, y1: number, x2: number, y2: number) => Math.hypot(x2 - x1, y2 - y1) } },
  };
  return { ...Phaser, default: Phaser };
});

import { Npc } from './Npc';

describe('Npc', () => {
  it('initialises patrol bounds and starts moving', () => {
    const scene = createFakeScene({ anims: { ...createFakeScene().anims, exists: () => true } });
    const npc = new Npc(scene as unknown as Phaser.Scene, {
      id: 'npc-1', name: 'Ada', x: 100, y: 200, topic: 'architecture basics', minX: 80, maxX: 120, speed: 25,
    });
    expect(npc.id).toBe('npc-1');
    expect(npc.minX).toBe(80);
    expect(npc.maxX).toBe(120);
    expect((npc.body as { velocity: { x: number } }).velocity.x).toBe(25);
  });

  it('turns around at patrol bounds', () => {
    const scene = createFakeScene();
    const npc = new Npc(scene as unknown as Phaser.Scene, {
      id: 'npc-1', name: 'Ada', x: 100, y: 200, topic: 'architecture basics', minX: 80, maxX: 120, speed: 25,
    });
    npc.x = 121;
    npc.update(0, 16);
    expect((npc.body as { velocity: { x: number } }).velocity.x).toBe(-25);
    npc.x = 79;
    npc.update(0, 16);
    expect((npc.body as { velocity: { x: number } }).velocity.x).toBe(25);
  });

  it('detects player interaction proximity', () => {
    const scene = createFakeScene();
    const npc = new Npc(scene as unknown as Phaser.Scene, {
      id: 'npc-1', name: 'Ada', x: 100, y: 200, topic: 'architecture basics', speed: 0,
    });
    expect(npc.isPlayerNearby({ x: 100, y: 150 } as Phaser.GameObjects.GameObject & { x: number; y: number })).toBe(true);
    expect(npc.isPlayerNearby({ x: 400, y: 150 } as Phaser.GameObjects.GameObject & { x: number; y: number })).toBe(false);
  });
});
