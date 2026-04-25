import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createFakeBody, createFakeScene, type FakeScene } from '../../tests/helpers/phaserMock';
import { eventBus } from '../systems/EventBus';
import type * as Phaser from 'phaser';

function makeFakeBody() {
  const body = createFakeBody() as ReturnType<typeof createFakeBody> & {
    setCollideWorldBounds: (b: boolean) => unknown;
    setBounce: (x: number, y: number) => unknown;
    setDragX: (drag: number) => unknown;
  };
  body.setCollideWorldBounds = vi.fn(() => body);
  body.setBounce = vi.fn(() => body);
  body.setDragX = vi.fn(() => body);
  return body;
}

vi.mock('phaser', () => {
  class Sprite {
    scene: unknown;
    x: number;
    y: number;
    body = makeFakeBody();
    depth = 0;

    constructor(scene: unknown, x: number, y: number) {
      this.scene = scene;
      this.x = x;
      this.y = y;
    }

    setDepth(depth: number) { this.depth = depth; return this; }
    setVelocity(x: number, y: number) { this.body.velocity.x = x; this.body.velocity.y = y; return this; }
    destroy() { /* no-op */ }
  }

  const Phaser = {
    Physics: { Arcade: { Sprite } },
    Math: {
      FloatBetween: vi.fn(() => -Math.PI / 2),
      Between: vi.fn(() => 200),
    },
  };
  return { ...Phaser, default: Phaser };
});

import { DroppedAU } from './DroppedAU';

function makeDroppedAU(): { scene: FakeScene; dropped: DroppedAU } {
  const scene = createFakeScene();
  const dropped = new DroppedAU(scene as unknown as Phaser.Scene, 100, 200);
  return { scene, dropped };
}

describe('DroppedAU', () => {
  beforeEach(() => {
    eventBus.removeAllListeners();
  });

  it('configures a physics pickup with burst velocity and delayed readiness', () => {
    const { scene, dropped } = makeDroppedAU();
    const body = dropped.body as ReturnType<typeof makeFakeBody>;

    expect(scene.add.existing).toHaveBeenCalledWith(dropped);
    expect(scene.physics.add.existing).toHaveBeenCalledWith(dropped);
    expect(body.setCollideWorldBounds).toHaveBeenCalledWith(true);
    expect(body.setBounce).toHaveBeenCalledWith(0.4, 0.4);
    expect(body.setDragX).toHaveBeenCalledWith(120);
    expect(body.setAllowGravity).toHaveBeenCalledWith(true);
    expect(body.velocity.x).toBeCloseTo(0);
    expect(body.velocity.y).toBe(-200);
    expect(dropped.ready).toBe(false);

    scene.advanceTime(450);
    scene.runDelayedCalls();
    expect(dropped.ready).toBe(true);
  });

  it('recover() emits SFX, disables body, and destroys after collection tween', () => {
    const { scene, dropped } = makeDroppedAU();
    const recovered = vi.fn();
    eventBus.on('sfx:recover_au', recovered);
    const destroy = vi.spyOn(dropped as unknown as { destroy: () => void }, 'destroy');

    dropped.recover();

    expect(dropped.collected).toBe(true);
    expect((dropped.body as { enable: boolean }).enable).toBe(false);
    expect(recovered).toHaveBeenCalledTimes(1);
    const addTween = scene.tweens.add as unknown as ReturnType<typeof vi.fn>;
    expect(addTween.mock.results.length).toBeGreaterThan(0);
    const lastResult = addTween.mock.results[addTween.mock.results.length - 1];
    const tween = lastResult?.value as { onComplete?: () => void } | undefined;
    expect(tween).toBeDefined();
    tween?.onComplete?.();
    expect(destroy).toHaveBeenCalledTimes(1);
  });

  it('recover() is idempotent', () => {
    const { scene, dropped } = makeDroppedAU();
    const recovered = vi.fn();
    eventBus.on('sfx:recover_au', recovered);

    dropped.recover();
    const addTween = scene.tweens.add as unknown as ReturnType<typeof vi.fn>;
    const countAfterFirst = addTween.mock.calls.length;
    dropped.recover();

    expect(recovered).toHaveBeenCalledTimes(1);
    expect(addTween.mock.calls.length).toBe(countAfterFirst);
  });
});
