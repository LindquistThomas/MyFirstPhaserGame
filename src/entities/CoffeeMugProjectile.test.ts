import { describe, it, expect, vi } from 'vitest';
import type * as Phaser from 'phaser';

type WorldListener = (body: unknown) => void;

interface FakeWorld {
  on: ReturnType<typeof vi.fn>;
  off: ReturnType<typeof vi.fn>;
  _emit: (event: string, arg: unknown) => void;
}

function makeWorld(): FakeWorld {
  const listeners = new Map<string, WorldListener[]>();
  const world: FakeWorld = {
    on: vi.fn((event: string, fn: WorldListener) => {
      const list = listeners.get(event) ?? [];
      list.push(fn);
      listeners.set(event, list);
    }),
    off: vi.fn((event: string, fn: WorldListener) => {
      const remaining = (listeners.get(event) ?? []).filter((f) => f !== fn);
      listeners.set(event, remaining);
    }),
    _emit: (event, arg) => {
      const list = listeners.get(event) ?? [];
      list.forEach((fn) => fn(arg));
    },
  };
  return world;
}

interface FakeBody {
  velocity: { x: number; y: number };
  onWorldBounds: boolean;
  gameObject: unknown;
  setAllowGravity: ReturnType<typeof vi.fn>;
  setCollideWorldBounds: ReturnType<typeof vi.fn>;
  setSize: ReturnType<typeof vi.fn>;
  setVelocityX: ReturnType<typeof vi.fn>;
}

function makeFakeBody(): FakeBody {
  const body: FakeBody = {
    velocity: { x: 0, y: 0 },
    onWorldBounds: false,
    gameObject: null,
    setAllowGravity: vi.fn(() => body),
    setCollideWorldBounds: vi.fn(() => body),
    setSize: vi.fn(() => body),
    setVelocityX: vi.fn((v: number) => { body.velocity.x = v; return body; }),
  };
  return body;
}

vi.mock('phaser', () => {
  class Sprite {
    scene: { physics: { world: FakeWorld }; add: { existing: ReturnType<typeof vi.fn> } };
    x: number;
    y: number;
    body: FakeBody;

    constructor(
      scene: { physics: { world: FakeWorld }; add: { existing: ReturnType<typeof vi.fn> } },
      x: number,
      y: number,
    ) {
      this.scene = scene;
      this.x = x;
      this.y = y;
      this.body = makeFakeBody();
      this.body.gameObject = this;
    }

    setDepth() { return this; }
    setFlipX() { return this; }
    destroy = vi.fn();
  }

  const Events = { WORLD_BOUNDS: 'worldbounds' };
  const Phaser = { Physics: { Arcade: { Sprite, Events } } };
  return { ...Phaser, default: Phaser };
});

import { CoffeeMugProjectile } from './CoffeeMugProjectile';

function makeScene() {
  const world = makeWorld();
  return {
    add: { existing: vi.fn() },
    physics: {
      add: { existing: vi.fn() },
      world,
    },
  };
}

describe('CoffeeMugProjectile', () => {
  it('launches right at +400 px/s when facingRight = true', () => {
    const scene = makeScene();
    const p = new CoffeeMugProjectile(scene as unknown as Phaser.Scene, 100, 200, true);
    const body = p.body as unknown as FakeBody;

    expect(body.velocity.x).toBe(400);
    expect(body.setAllowGravity).toHaveBeenCalledWith(false);
    expect(body.setSize).toHaveBeenCalledWith(14, 12);
  });

  it('launches left at -400 px/s when facingRight = false', () => {
    const scene = makeScene();
    const p = new CoffeeMugProjectile(scene as unknown as Phaser.Scene, 100, 200, false);
    expect((p.body as unknown as FakeBody).velocity.x).toBe(-400);
  });

  it('destroySelf() destroys the sprite and removes listener', () => {
    const scene = makeScene();
    const p = new CoffeeMugProjectile(scene as unknown as Phaser.Scene, 100, 200, true);
    p.destroySelf();
    expect((p as unknown as { destroy: ReturnType<typeof vi.fn> }).destroy).toHaveBeenCalled();
    expect(scene.physics.world.off).toHaveBeenCalled();
  });

  it('destroySelf() is a no-op when scene is falsy', () => {
    const scene = makeScene();
    const p = new CoffeeMugProjectile(scene as unknown as Phaser.Scene, 100, 200, true);
    (p as unknown as { scene: null }).scene = null;
    expect(() => p.destroySelf()).not.toThrow();
  });

  it('world-bounds event triggers destroySelf for own body', () => {
    const scene = makeScene();
    const p = new CoffeeMugProjectile(scene as unknown as Phaser.Scene, 100, 200, true);

    scene.physics.world._emit('worldbounds', p.body);

    expect((p as unknown as { destroy: ReturnType<typeof vi.fn> }).destroy).toHaveBeenCalled();
  });
});
