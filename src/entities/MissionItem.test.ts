import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createFakeScene } from '../../tests/helpers/phaserMock';
import type * as Phaser from 'phaser';
import { eventBus } from '../systems/EventBus';

vi.mock('phaser', () => {
  class Sprite {
    scene: unknown;
    x: number;
    y: number;
    alpha = 1;

    constructor(scene: unknown, x: number, y: number) {
      this.scene = scene;
      this.x = x;
      this.y = y;
    }

    setDepth() { return this; }
    destroy = vi.fn();
  }

  const Phaser = { Physics: { Arcade: { Sprite } } };
  return { ...Phaser, default: Phaser };
});

import { MissionItem } from './MissionItem';

describe('MissionItem', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates with the correct itemId and starts a pulse tween', () => {
    const scene = createFakeScene();
    const cb = vi.fn();
    const item = new MissionItem(
      scene as unknown as Phaser.Scene, 400, 500, 'pistol', cb,
    );

    expect(item.itemId).toBe('pistol');
    expect(scene.tweens.add).toHaveBeenCalled();
  });

  it('supports all three MissionItemId values', () => {
    const scene = createFakeScene();
    const cb = vi.fn();
    const pistol = new MissionItem(scene as unknown as Phaser.Scene, 0, 0, 'pistol', cb);
    const keycard = new MissionItem(scene as unknown as Phaser.Scene, 0, 0, 'keycard', cb);
    const bombCode = new MissionItem(scene as unknown as Phaser.Scene, 0, 0, 'bomb_code', cb);

    expect(pistol.itemId).toBe('pistol');
    expect(keycard.itemId).toBe('keycard');
    expect(bombCode.itemId).toBe('bomb_code');
  });

  it('collect() emits sfx:item_pickup and calls the callback', () => {
    const scene = createFakeScene();
    const cb = vi.fn();
    const item = new MissionItem(
      scene as unknown as Phaser.Scene, 400, 500, 'keycard', cb,
    );

    const sfxSpy = vi.fn();
    eventBus.on('sfx:item_pickup', sfxSpy);

    item.collect();

    expect(sfxSpy).toHaveBeenCalledTimes(1);
    expect(cb).toHaveBeenCalledWith('keycard');

    eventBus.off('sfx:item_pickup', sfxSpy);
  });

  it('collect() triggers a fly-up tween', () => {
    const scene = createFakeScene();
    const cb = vi.fn();
    const item = new MissionItem(
      scene as unknown as Phaser.Scene, 400, 500, 'bomb_code', cb,
    );

    // pulse tween already added in constructor
    const addCallsBefore = (scene.tweens.add as ReturnType<typeof vi.fn>).mock.calls.length;
    item.collect();
    const addCallsAfter = (scene.tweens.add as ReturnType<typeof vi.fn>).mock.calls.length;

    expect(addCallsAfter).toBeGreaterThan(addCallsBefore);
  });

  it('collect() is idempotent — second call does nothing', () => {
    const scene = createFakeScene();
    const cb = vi.fn();
    const item = new MissionItem(
      scene as unknown as Phaser.Scene, 400, 500, 'pistol', cb,
    );

    item.collect();
    item.collect();

    expect(cb).toHaveBeenCalledTimes(1);
  });
});
