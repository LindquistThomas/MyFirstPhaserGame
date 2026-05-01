import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type * as Phaser from 'phaser';
import { eventBus } from '../../systems/EventBus';
import { GAME_WIDTH } from '../../config/gameConfig';
import { makeSceneMock } from './testUtils';

vi.mock('phaser', () => {
  const keyCodes = new Proxy({}, { get: () => 0 });
  class ScenePlugin { constructor(_s: unknown, _pm: unknown) {} boot(): void {} }
  const Phaser = { Math: { Clamp: (v: number, mn: number, mx: number) => Math.min(mx, Math.max(mn, v)) }, Input: { Keyboard: { KeyCodes: keyCodes } }, Plugins: { ScenePlugin } };
  return { ...Phaser, default: Phaser };
});

import { MuteIconController } from './MuteIconController';

describe('MuteIconController', () => {
  let scene: ReturnType<typeof makeSceneMock>;

  beforeEach(() => { scene = makeSceneMock(false); });
  afterEach(() => { scene.events.emit('shutdown'); });

  it('creates a graphics object positioned at the mute icon location', () => {
    new MuteIconController(scene as unknown as Phaser.Scene, scene.add.container() as unknown as Phaser.GameObjects.Container);
    const muteGfx = scene.graphics.find((g) =>
      g.setPosition.mock.calls.some(([x, y]) => x === GAME_WIDTH - 24 && y === 22),
    );
    expect(muteGfx).toBeDefined();
  });

  it('emits audio:toggle-mute when the hit zone fires pointerup', () => {
    new MuteIconController(scene as unknown as Phaser.Scene, scene.add.container() as unknown as Phaser.GameObjects.Container);
    const spy = vi.fn<() => void>();
    eventBus.on('audio:toggle-mute', spy);
    try {
      const hitZone = scene.zones[scene.zones.length - 1]!;
      const pointerup = hitZone.zoneHandlers.get('pointerup');
      expect(pointerup).toBeDefined();
      pointerup?.();
      expect(spy).toHaveBeenCalledTimes(1);
    } finally {
      eventBus.off('audio:toggle-mute', spy);
    }
  });

  it('re-renders icon when audio:mute-changed fires', () => {
    new MuteIconController(scene as unknown as Phaser.Scene, scene.add.container() as unknown as Phaser.GameObjects.Container);
    const muteGfx = scene.graphics.find((g) =>
      g.setPosition.mock.calls.some(([x, y]) => x === GAME_WIDTH - 24 && y === 22),
    )!;
    const clearsBefore = muteGfx.clear.mock.calls.length;
    eventBus.emit('audio:mute-changed', true);
    expect(muteGfx.clear.mock.calls.length).toBeGreaterThan(clearsBefore);
  });

  it('does not re-render after destroy() is called', () => {
    const ctrl = new MuteIconController(scene as unknown as Phaser.Scene, scene.add.container() as unknown as Phaser.GameObjects.Container);
    const muteGfx = scene.graphics.find((g) =>
      g.setPosition.mock.calls.some(([x, y]) => x === GAME_WIDTH - 24 && y === 22),
    )!;
    ctrl.destroy();
    const clearsAfter = muteGfx.clear.mock.calls.length;
    eventBus.emit('audio:mute-changed', false);
    expect(muteGfx.clear.mock.calls.length).toBe(clearsAfter);
  });

  it('renders a strikethrough when starting in a muted scene', () => {
    const mutedScene = makeSceneMock(true);
    new MuteIconController(mutedScene as unknown as Phaser.Scene, mutedScene.add.container() as unknown as Phaser.GameObjects.Container);
    const muteGfx = mutedScene.graphics.find((g) =>
      g.setPosition.mock.calls.some(([x, y]) => x === GAME_WIDTH - 24 && y === 22),
    )!;
    // lineStyle(2.5, 0xff4444, 1) is only called for the strikethrough
    expect(muteGfx.lineStyle.mock.calls).toContainEqual([2.5, 0xff4444, 1]);
    mutedScene.events.emit('shutdown');
  });

  it('unsubscribes audio:mute-changed on scene shutdown', () => {
    new MuteIconController(scene as unknown as Phaser.Scene, scene.add.container() as unknown as Phaser.GameObjects.Container);
    const muteGfx = scene.graphics.find((g) =>
      g.setPosition.mock.calls.some(([x, y]) => x === GAME_WIDTH - 24 && y === 22),
    )!;
    scene.events.emit('shutdown');
    const clearsAfterShutdown = muteGfx.clear.mock.calls.length;
    eventBus.emit('audio:mute-changed', true);
    expect(muteGfx.clear.mock.calls.length).toBe(clearsAfterShutdown);
  });
});
