import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createFakeScene, createFakeSprite, type FakeScene } from '../../tests/helpers/phaserMock';
import type * as Phaser from 'phaser';

// --- Minimal Phaser mock ---
vi.mock('phaser', () => {
  class Image {
    x: number; y: number;
    body = {
      setAllowGravity: vi.fn(),
      setSize: vi.fn(),
      setOffset: vi.fn(),
    };
    visible = true;
    constructor(x: number, y: number) { this.x = x; this.y = y; }
    setVisible(v: boolean) { this.visible = v; return this; }
    setImmovable() { return this; }
    setData(_k: string, _v: unknown) { return this; }
    destroy() { /* no-op */ }
  }

  const Phaser = {
    Physics: {
      Arcade: {
        Image,
      },
    },
  };
  return { ...Phaser, default: Phaser };
});

import { Checkpoint } from './Checkpoint';

function makeFakePhysics(scene: FakeScene) {
  return {
    add: {
      ...scene.physics.add,
      image: vi.fn((x: number, y: number) => {
        const sprite = createFakeSprite(x, y);
        const img = Object.assign(sprite, {
          setVisible: vi.fn(() => img),
          getData: vi.fn((_k: string) => undefined as unknown),
          setData: vi.fn((_k: string, v: unknown) => {
            (img as unknown as Record<string, unknown>)['__data_' + _k] = v;
            return img;
          }),
        });
        // Make getData return values stored by setData
        img.getData = vi.fn((k: string) => {
          return (img as unknown as Record<string, unknown>)['__data_' + k];
        });
        (img as unknown as { body: { setAllowGravity: ReturnType<typeof vi.fn>; setSize: ReturnType<typeof vi.fn>; setOffset: ReturnType<typeof vi.fn> } }).body = {
          setAllowGravity: vi.fn(),
          setSize: vi.fn(),
          setOffset: vi.fn(),
        };
        return img;
      }),
      overlap: vi.fn(),
      staticGroup: vi.fn(() => ({})),
    },
  };
}

interface FakeSceneWithGraphics extends FakeScene {
  add: FakeScene['add'] & {
    graphics: () => {
      setDepth: ReturnType<typeof vi.fn>;
      setScrollFactor: ReturnType<typeof vi.fn>;
      setVisible: ReturnType<typeof vi.fn>;
      clear: ReturnType<typeof vi.fn>;
      fillStyle: ReturnType<typeof vi.fn>;
      fillRect: ReturnType<typeof vi.fn>;
      lineStyle: ReturnType<typeof vi.fn>;
      strokeCircle: ReturnType<typeof vi.fn>;
      y: number;
    };
  };
}

function makeScene(): { scene: FakeSceneWithGraphics; graphicsObj: ReturnType<FakeSceneWithGraphics['add']['graphics']> } {
  const graphicsObj = {
    depth: 0,
    y: 0,
    setDepth: vi.fn(function (this: typeof graphicsObj, d: number) { this.depth = d; return this; }),
    setScrollFactor: vi.fn(() => graphicsObj),
    setVisible: vi.fn(() => graphicsObj),
    clear: vi.fn(() => graphicsObj),
    fillStyle: vi.fn(() => graphicsObj),
    fillRect: vi.fn(() => graphicsObj),
    lineStyle: vi.fn(() => graphicsObj),
    strokeCircle: vi.fn(() => graphicsObj),
  };

  const base = createFakeScene();
  const scene = {
    ...base,
    add: {
      ...base.add,
      graphics: vi.fn(() => graphicsObj),
    },
    physics: makeFakePhysics(base),
    tweens: {
      ...base.tweens,
      add: vi.fn(() => ({ stop: vi.fn() })),
    },
  } as unknown as FakeSceneWithGraphics;

  return { scene, graphicsObj };
}

describe('Checkpoint', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('creates a trigger at the given coordinates and calls onActivate exactly once', () => {
    const { scene } = makeScene();
    const onActivate = vi.fn();

    const cp = new Checkpoint(
      scene as unknown as Phaser.Scene,
      300, 400,
      'test-cp',
      onActivate,
    );

    // Before wireOverlap the overlap hasn't fired.
    expect(cp.activated).toBe(false);
    expect(onActivate).not.toHaveBeenCalled();

    // Wire the overlap and simulate the overlap callback firing.
    const overlapSpy = vi.fn();
    const fakePhysics = {
      add: { overlap: overlapSpy },
    } as unknown as Phaser.Physics.Arcade.ArcadePhysics;
    const fakePlayer = createFakeSprite(100, 100) as unknown as Phaser.Physics.Arcade.Sprite;

    cp.wireOverlap(fakePhysics, fakePlayer);
    expect(overlapSpy).toHaveBeenCalledTimes(1);

    // Simulate overlap: extract the callback Phaser would call and invoke it.
    const overlapCallback = overlapSpy.mock.calls[0]?.[2] as (() => void) | undefined;
    expect(overlapCallback).toBeDefined();

    overlapCallback?.();
    expect(cp.activated).toBe(true);
    expect(onActivate).toHaveBeenCalledTimes(1);

    // Second overlap call must be a no-op (idempotent).
    overlapCallback?.();
    expect(onActivate).toHaveBeenCalledTimes(1);
  });

  it('stores the checkpoint id on the trigger game object', () => {
    const { scene } = makeScene();
    const cp = new Checkpoint(
      scene as unknown as Phaser.Scene,
      0, 0,
      'my-checkpoint-id',
      vi.fn(),
    );
    expect(cp.trigger.getData('checkpointId')).toBe('my-checkpoint-id');
  });

  it('starts activated when created from persisted state and ignores overlap callbacks', () => {
    const { scene } = makeScene();
    const onActivate = vi.fn();
    const cp = new Checkpoint(
      scene as unknown as Phaser.Scene,
      100, 120,
      'persisted-cp',
      onActivate,
      true,
    );

    expect(cp.activated).toBe(true);

    const overlapSpy = vi.fn();
    const fakePhysics = {
      add: { overlap: overlapSpy },
    } as unknown as Phaser.Physics.Arcade.ArcadePhysics;
    const fakePlayer = createFakeSprite(100, 100) as unknown as Phaser.Physics.Arcade.Sprite;
    cp.wireOverlap(fakePhysics, fakePlayer);
    const overlapCallback = overlapSpy.mock.calls[0]?.[2] as (() => void) | undefined;
    overlapCallback?.();
    expect(onActivate).not.toHaveBeenCalled();
  });
});
