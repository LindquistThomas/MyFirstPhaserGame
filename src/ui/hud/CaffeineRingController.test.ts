import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type * as Phaser from 'phaser';
import { eventBus } from '../../systems/EventBus';
import { makeSceneMock } from './testUtils';

vi.mock('phaser', () => {
  const keyCodes = new Proxy({}, { get: () => 0 });
  class ScenePlugin { constructor(_s: unknown, _pm: unknown) {} boot(): void {} }
  const Phaser = { Math: { Clamp: (v: number, mn: number, mx: number) => Math.min(mx, Math.max(mn, v)) }, Input: { Keyboard: { KeyCodes: keyCodes } }, Plugins: { ScenePlugin } };
  return { ...Phaser, default: Phaser };
});

import { CaffeineRingController } from './CaffeineRingController';

describe('CaffeineRingController', () => {
  let scene: ReturnType<typeof makeSceneMock>;

  beforeEach(() => { scene = makeSceneMock(); });
  afterEach(() => { scene.events.emit('shutdown'); });

  it('icon and ring start hidden', () => {
    new CaffeineRingController(
      scene as unknown as Phaser.Scene,
      scene.add.container() as unknown as Phaser.GameObjects.Container,
    );
    // Both ring and icon are created with setVisible(false)
    const hiddenCalls = scene.graphics.flatMap((g) =>
      g.setVisible.mock.calls.filter(([v]) => v === false),
    );
    expect(hiddenCalls.length).toBeGreaterThanOrEqual(2);
  });

  it('shows icon and ring on buff:caffeine_start', () => {
    new CaffeineRingController(
      scene as unknown as Phaser.Scene,
      scene.add.container() as unknown as Phaser.GameObjects.Container,
    );
    eventBus.emit('buff:caffeine_start', 5000);
    const visibleCalls = scene.graphics.flatMap((g) =>
      g.setVisible.mock.calls.filter(([v]) => v === true),
    );
    expect(visibleCalls.length).toBeGreaterThanOrEqual(2);
  });

  it('hides icon and ring on buff:caffeine_end', () => {
    new CaffeineRingController(
      scene as unknown as Phaser.Scene,
      scene.add.container() as unknown as Phaser.GameObjects.Container,
    );
    eventBus.emit('buff:caffeine_start', 5000);
    eventBus.emit('buff:caffeine_end');
    // After end, setVisible(false) should have been called again on both
    const hiddenCalls = scene.graphics.flatMap((g) =>
      g.setVisible.mock.calls.filter(([v]) => v === false),
    );
    expect(hiddenCalls.length).toBeGreaterThanOrEqual(4);
  });

  it('update() hides icon and ring when time expires', () => {
    const ctrl = new CaffeineRingController(
      scene as unknown as Phaser.Scene,
      scene.add.container() as unknown as Phaser.GameObjects.Container,
    );
    (scene.time as { now: number }).now = 0;
    eventBus.emit('buff:caffeine_start', 1000);
    // Before expiry: icon still visible (renders with ratio > 0)
    ctrl.update(500);
    const hiddensBefore = scene.graphics.flatMap((g) =>
      g.setVisible.mock.calls.filter(([v]) => v === false),
    ).length;
    // After expiry
    ctrl.update(1001);
    const hiddensAfter = scene.graphics.flatMap((g) =>
      g.setVisible.mock.calls.filter(([v]) => v === false),
    ).length;
    expect(hiddensAfter).toBeGreaterThan(hiddensBefore);
  });

  it('unsubscribes caffeine events on destroy()', () => {
    const ctrl = new CaffeineRingController(
      scene as unknown as Phaser.Scene,
      scene.add.container() as unknown as Phaser.GameObjects.Container,
    );
    ctrl.destroy();
    const gfxBefore = scene.graphics.flatMap((g) => g.setVisible.mock.calls.length);
    eventBus.emit('buff:caffeine_start', 3000);
    eventBus.emit('buff:caffeine_end');
    // No new setVisible calls since destroy() removed the listeners
    const gfxAfter = scene.graphics.flatMap((g) => g.setVisible.mock.calls.length);
    expect(gfxAfter).toEqual(gfxBefore);
  });

  it('unsubscribes caffeine events on scene shutdown', () => {
    new CaffeineRingController(
      scene as unknown as Phaser.Scene,
      scene.add.container() as unknown as Phaser.GameObjects.Container,
    );
    scene.events.emit('shutdown');
    const callsBefore = scene.graphics.flatMap((g) => g.clear.mock.calls.length).reduce((a, b) => a + b, 0);
    eventBus.emit('buff:caffeine_start', 3000);
    const callsAfter = scene.graphics.flatMap((g) => g.clear.mock.calls.length).reduce((a, b) => a + b, 0);
    expect(callsAfter).toBe(callsBefore);
  });
});
