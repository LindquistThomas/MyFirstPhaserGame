import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createFakeScene, type FakeScene } from '../../tests/helpers/phaserMock';
import type * as Phaser from 'phaser';

// Token extends Phaser.Physics.Arcade.Sprite at runtime, so we need a real
// (mocked) class to inherit from. Keep it minimal — only the methods the
// Token constructor / collect() actually touch on `this`.
vi.mock('phaser', () => {
  class Sprite {
    scene: unknown;
    x: number;
    y: number;
    body: { enable: boolean } = { enable: true };
    constructor(scene: unknown, x: number, y: number) {
      this.scene = scene;
      this.x = x;
      this.y = y;
    }
    setDepth() { return this; }
    setAlpha() { return this; }
    setScale() { return this; }
    setPosition(x: number, y: number) { this.x = x; this.y = y; return this; }
    destroy() { /* no-op */ }
  }
  const Phaser = {
    Physics: { Arcade: { Sprite } },
    Animations: { Events: { ANIMATION_UPDATE: 'animationupdate' } },
  };
  return { ...Phaser, default: Phaser };
});

import { Token } from './Token';

function makeToken(): { scene: FakeScene; token: Token } {
  const scene = createFakeScene();
  const token = new Token(scene as unknown as Phaser.Scene, 200, 300);
  return { scene, token };
}

describe('Token', () => {
  let scene: FakeScene;
  let token: Token;

  beforeEach(() => {
    ({ scene, token } = makeToken());
  });

  it('creates float + pulse tweens on construction', () => {
    const add = scene.tweens.add as unknown as ReturnType<typeof vi.fn>;
    // At minimum: float (yoyo y), scale pulse, and halo alpha/scale pulse.
    expect(add.mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  it('is not collected initially', () => {
    expect((token as unknown as { collected: boolean }).collected).toBe(false);
    expect(token.body).toBeDefined();
    expect((token.body as { enable: boolean }).enable).toBe(true);
  });

  it('collect() marks collected, disables body, stops float, creates fade tween', () => {
    const add = scene.tweens.add as unknown as ReturnType<typeof vi.fn>;
    const floatTween = (token as unknown as { floatTween: { stop: ReturnType<typeof vi.fn> } }).floatTween;
    const stopSpy = floatTween.stop as ReturnType<typeof vi.fn>;

    const countBefore = add.mock.calls.length;
    token.collect();

    expect((token as unknown as { collected: boolean }).collected).toBe(true);
    expect((token.body as { enable: boolean }).enable).toBe(false);
    expect(stopSpy).toHaveBeenCalledTimes(1);
    // collect() adds a halo-fade tween (if halo exists) + the coin fade tween.
    expect(add.mock.calls.length).toBeGreaterThan(countBefore);
  });

  it('collect() is idempotent — second call is a no-op', () => {
    const add = scene.tweens.add as unknown as ReturnType<typeof vi.fn>;

    token.collect();
    const countAfterFirst = add.mock.calls.length;

    token.collect();
    expect(add.mock.calls.length).toBe(countAfterFirst);
  });

  it('fade tween targets the token and destroys it onComplete', () => {
    const add = scene.tweens.add as unknown as ReturnType<typeof vi.fn>;
    const destroySpy = vi.fn();
    (token as unknown as { destroy: () => void }).destroy = destroySpy;

    token.collect();

    const lastAdd = add.mock.calls[add.mock.calls.length - 1]![0] as Record<string, unknown>;
    expect(lastAdd['targets']).toBe(token);
    // The fake tween exposes the onComplete passed in — invoke it.
    const lastResult = add.mock.results[add.mock.results.length - 1]!.value as {
      onComplete?: () => void;
    };
    lastResult.onComplete?.();
    expect(destroySpy).toHaveBeenCalledTimes(1);
  });
});
