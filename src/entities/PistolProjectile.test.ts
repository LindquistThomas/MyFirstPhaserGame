import { describe, it, expect, vi } from 'vitest';
import type * as Phaser from 'phaser';

type WorldListener = (body: unknown) => void;

interface FakeWorld {
  once: ReturnType<typeof vi.fn>;
  off: ReturnType<typeof vi.fn>;
  _emit: (event: string, arg: unknown) => void;
}

function makeWorld(): FakeWorld {
  const listeners = new Map<string, WorldListener[]>();
  const onceSet = new Set<WorldListener>();

  const world: FakeWorld = {
    once: vi.fn((event: string, fn: WorldListener) => {
      onceSet.add(fn);
      const list = listeners.get(event) ?? [];
      list.push(fn);
      listeners.set(event, list);
    }),
    off: vi.fn((event: string, fn: WorldListener) => {
      const remaining = (listeners.get(event) ?? []).filter((f) => f !== fn);
      listeners.set(event, remaining);
      onceSet.delete(fn);
    }),
    _emit: (event, arg) => {
      const list = listeners.get(event) ?? [];
      // Remove once-listeners before firing so they can't be called twice.
      const remaining = list.filter((fn) => !onceSet.has(fn));
      listeners.set(event, remaining);
      list.forEach((fn) => fn(arg));
    },
  };
  return world;
}

interface FakeBody {
  velocity: { x: number; y: number };
  active: boolean;
  onWorldBounds: boolean;
  gameObject: unknown;
  setAllowGravity: ReturnType<typeof vi.fn>;
  setCollideWorldBounds: ReturnType<typeof vi.fn>;
  setVelocityX: ReturnType<typeof vi.fn>;
}

function makeFakeBody(): FakeBody {
  const body: FakeBody = {
    velocity: { x: 0, y: 0 },
    active: true,
    onWorldBounds: false,
    gameObject: null,
    setAllowGravity: vi.fn(() => body),
    setCollideWorldBounds: vi.fn(() => body),
    setVelocityX: vi.fn((v: number) => { body.velocity.x = v; return body; }),
  };
  return body;
}

vi.mock('phaser', () => {
  class Sprite {
    scene: { physics: { world: FakeWorld }; add: { existing: ReturnType<typeof vi.fn> } } | null;
    x: number;
    y: number;
    active = true;
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
    setScale() { return this; }
    destroy = vi.fn(() => { this.active = false; });
  }

  const Events = { WORLD_BOUNDS: 'worldbounds' };
  const Phaser = { Physics: { Arcade: { Sprite, Events } } };
  return { ...Phaser, default: Phaser };
});

import { PistolProjectile } from './PistolProjectile';

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

describe('PistolProjectile', () => {
  it('launches right at +500 px/s when toRight = true', () => {
    const scene = makeScene();
    const p = new PistolProjectile(scene as unknown as Phaser.Scene, 300, 400, true);
    const body = p.body as unknown as FakeBody;

    expect(body.velocity.x).toBe(500);
    expect(body.setAllowGravity).toHaveBeenCalledWith(false);
  });

  it('launches left at -500 px/s when toRight = false', () => {
    const scene = makeScene();
    const p = new PistolProjectile(scene as unknown as Phaser.Scene, 300, 400, false);
    expect((p.body as unknown as FakeBody).velocity.x).toBe(-500);
  });

  it('destroySelf() destroys the sprite', () => {
    const scene = makeScene();
    const p = new PistolProjectile(scene as unknown as Phaser.Scene, 300, 400, true);
    p.destroySelf();
    expect((p as unknown as { destroy: ReturnType<typeof vi.fn> }).destroy).toHaveBeenCalled();
  });

  it('destroySelf() is a no-op when not active', () => {
    const scene = makeScene();
    const p = new PistolProjectile(scene as unknown as Phaser.Scene, 300, 400, true);
    p.destroySelf(); // first call destroys
    const destroyMock = (p as unknown as { destroy: ReturnType<typeof vi.fn> }).destroy;
    destroyMock.mockClear();
    p.destroySelf(); // second call — already inactive
    expect(destroyMock).not.toHaveBeenCalled();
  });

  it('world-bounds event triggers destroySelf', () => {
    const scene = makeScene();
    const p = new PistolProjectile(scene as unknown as Phaser.Scene, 300, 400, true);

    scene.physics.world._emit('worldbounds', p.body);

    expect((p as unknown as { destroy: ReturnType<typeof vi.fn> }).destroy).toHaveBeenCalled();
  });
});
