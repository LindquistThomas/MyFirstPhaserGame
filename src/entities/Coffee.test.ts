import { describe, it, expect, vi } from 'vitest';
import { createFakeScene, type FakeScene } from '../../tests/helpers/phaserMock';
import type * as Phaser from 'phaser';

vi.mock('phaser', () => {
  class Sprite {
    scene: unknown;
    x: number;
    y: number;
    body: { enable: boolean } = { enable: true };
    depth = 0;
    alpha = 1;

    constructor(scene: unknown, x: number, y: number) {
      this.scene = scene;
      this.x = x;
      this.y = y;
    }

    preUpdate() { /* no-op */ }
    setDepth(depth: number) { this.depth = depth; return this; }
    setAlpha(alpha: number) { this.alpha = alpha; return this; }
    setScale() { return this; }
    setPosition(x: number, y: number) { this.x = x; this.y = y; return this; }
    destroy() { /* no-op */ }
  }

  const Phaser = { Physics: { Arcade: { Sprite } } };
  return { ...Phaser, default: Phaser };
});

import { Coffee } from './Coffee';

function makeCoffee(textureExists = true): { scene: FakeScene; coffee: Coffee } {
  const scene = createFakeScene({ textures: { exists: () => textureExists } });
  const coffee = new Coffee(scene as unknown as Phaser.Scene, 200, 300);
  return { scene, coffee };
}

describe('Coffee', () => {
  it('creates a static body, bob tween, pulse tween, and steam when texture exists', () => {
    const { scene, coffee } = makeCoffee(true);
    const addTween = scene.tweens.add as unknown as ReturnType<typeof vi.fn>;

    expect(scene.add.existing).toHaveBeenCalledWith(coffee);
    expect(scene.physics.add.existing).toHaveBeenCalledWith(coffee, true);
    expect((coffee as unknown as { depth: number }).depth).toBe(5);
    expect(addTween).toHaveBeenCalledTimes(3);
    expect((coffee as unknown as { steam?: unknown }).steam).toBeDefined();
  });

  it('skips steam-specific tween when steam texture is missing', () => {
    const { scene, coffee } = makeCoffee(false);
    const addTween = scene.tweens.add as unknown as ReturnType<typeof vi.fn>;

    expect((coffee as unknown as { steam?: unknown }).steam).toBeUndefined();
    expect(addTween).toHaveBeenCalledTimes(2);
  });

  it('preUpdate keeps steam horizontally aligned while uncollected', () => {
    const { coffee } = makeCoffee(true);
    const steam = (coffee as unknown as { steam: { x: number; setX?: (x: number) => unknown } }).steam;
    steam.setX = vi.fn((x: number) => { steam.x = x; return steam; });

    coffee.x = 260;
    coffee.preUpdate(0, 16);

    expect(steam.setX).toHaveBeenCalledWith(260);
  });

  it('collect() disables body, stops tweens, fades steam, and destroys the mug', () => {
    const { scene, coffee } = makeCoffee(true);
    const addTween = scene.tweens.add as unknown as ReturnType<typeof vi.fn>;
    const destroy = vi.spyOn(coffee as unknown as { destroy: () => void }, 'destroy');
    const countBefore = addTween.mock.calls.length;

    coffee.collect();

    expect((coffee as unknown as { collected: boolean }).collected).toBe(true);
    expect((coffee.body as { enable: boolean }).enable).toBe(false);
    expect(scene.tweens.killTweensOf).toHaveBeenCalledWith(coffee);
    expect(addTween.mock.calls.length).toBe(countBefore + 2);
    expect(addTween.mock.results.length).toBeGreaterThan(0);
    const lastResult = addTween.mock.results[addTween.mock.results.length - 1];
    const mugTween = lastResult?.value as { onComplete?: () => void } | undefined;
    expect(mugTween).toBeDefined();
    mugTween?.onComplete?.();
    expect(destroy).toHaveBeenCalledTimes(1);
  });

  it('collect() is idempotent', () => {
    const { scene, coffee } = makeCoffee(true);
    const addTween = scene.tweens.add as unknown as ReturnType<typeof vi.fn>;

    coffee.collect();
    const countAfterFirst = addTween.mock.calls.length;
    coffee.collect();

    expect(addTween.mock.calls.length).toBe(countAfterFirst);
  });
});
