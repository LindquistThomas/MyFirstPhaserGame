import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type * as Phaser from 'phaser';
import { eventBus } from '../../systems/EventBus';
import { makeSceneMock } from './testUtils';
import { GAME_WIDTH } from '../../config/gameConfig';

vi.mock('phaser', () => {
  const keyCodes = new Proxy({}, { get: () => 0 });
  class ScenePlugin { constructor(_s: unknown, _pm: unknown) {} boot(): void {} }
  const Phaser = { Math: { Clamp: (v: number, mn: number, mx: number) => Math.min(mx, Math.max(mn, v)) }, Input: { Keyboard: { KeyCodes: keyCodes } }, Plugins: { ScenePlugin } };
  return { ...Phaser, default: Phaser };
});

vi.mock('../AchievementsDialog', () => ({
  AchievementsDialog: vi.fn(),
}));

import { AchievementBadgeController } from './AchievementBadgeController';
import { AchievementsDialog } from '../AchievementsDialog';

function makeToastMock() {
  return { show: vi.fn() };
}

describe('AchievementBadgeController', () => {
  let scene: ReturnType<typeof makeSceneMock>;

  beforeEach(() => { scene = makeSceneMock(); });
  afterEach(() => { scene.events.emit('shutdown'); });

  it('creates a trophy icon positioned at (GAME_WIDTH - 128, 22)', () => {
    new AchievementBadgeController(
      scene as unknown as Phaser.Scene,
      scene.add.container() as unknown as Phaser.GameObjects.Container,
      makeToastMock() as unknown as import('../Toast').Toast,
    );
    const trophyGfx = scene.graphics.find((g) =>
      g.setPosition.mock.calls.some(([x, y]) => x === GAME_WIDTH - 128 && y === 22),
    );
    expect(trophyGfx).toBeDefined();
  });

  it('opens AchievementsDialog on pointerdown', () => {
    new AchievementBadgeController(
      scene as unknown as Phaser.Scene,
      scene.add.container() as unknown as Phaser.GameObjects.Container,
      makeToastMock() as unknown as import('../Toast').Toast,
    );
    const hitZone = scene.zones[scene.zones.length - 1]!;
    const pointerdown = hitZone.zoneHandlers.get('pointerdown');
    expect(pointerdown).toBeDefined();
    pointerdown?.();
    expect(AchievementsDialog).toHaveBeenCalledWith(scene);
  });

  it('shows a toast when achievement:unlocked fires', () => {
    const toast = makeToastMock();
    new AchievementBadgeController(
      scene as unknown as Phaser.Scene,
      scene.add.container() as unknown as Phaser.GameObjects.Container,
      toast as unknown as import('../Toast').Toast,
    );
    eventBus.emit('achievement:unlocked', 'ach_first_au', 'First Steps');
    expect(toast.show).toHaveBeenCalledWith(expect.stringContaining('First Steps'));
  });

  it('unsubscribes achievement:unlocked on destroy()', () => {
    const toast = makeToastMock();
    const ctrl = new AchievementBadgeController(
      scene as unknown as Phaser.Scene,
      scene.add.container() as unknown as Phaser.GameObjects.Container,
      toast as unknown as import('../Toast').Toast,
    );
    ctrl.destroy();
    toast.show.mockClear();
    eventBus.emit('achievement:unlocked', 'ach_first_au', 'First Steps');
    expect(toast.show).not.toHaveBeenCalled();
  });

  it('unsubscribes achievement:unlocked on scene shutdown', () => {
    const toast = makeToastMock();
    new AchievementBadgeController(
      scene as unknown as Phaser.Scene,
      scene.add.container() as unknown as Phaser.GameObjects.Container,
      toast as unknown as import('../Toast').Toast,
    );
    scene.events.emit('shutdown');
    toast.show.mockClear();
    eventBus.emit('achievement:unlocked', 'ach_first_au', 'First Steps');
    expect(toast.show).not.toHaveBeenCalled();
  });

  it('re-renders icon on pointerover and pointerout (hover state)', () => {
    new AchievementBadgeController(
      scene as unknown as Phaser.Scene,
      scene.add.container() as unknown as Phaser.GameObjects.Container,
      makeToastMock() as unknown as import('../Toast').Toast,
    );
    const trophyGfx = scene.graphics.find((g) =>
      g.setPosition.mock.calls.some(([x, y]) => x === GAME_WIDTH - 128 && y === 22),
    )!;
    const hitZone = scene.zones[scene.zones.length - 1]!;
    const clearsBefore = trophyGfx.clear.mock.calls.length;
    hitZone.zoneHandlers.get('pointerover')?.();
    expect(trophyGfx.clear.mock.calls.length).toBeGreaterThan(clearsBefore);
    const clearsAfterOver = trophyGfx.clear.mock.calls.length;
    hitZone.zoneHandlers.get('pointerout')?.();
    expect(trophyGfx.clear.mock.calls.length).toBeGreaterThan(clearsAfterOver);
  });
});
