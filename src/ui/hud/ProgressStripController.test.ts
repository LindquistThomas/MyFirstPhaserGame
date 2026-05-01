import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type * as Phaser from 'phaser';
import { eventBus } from '../../systems/EventBus';
import { makeSceneMock } from './testUtils';
import { ProgressionSystem } from '../../systems/ProgressionSystem';
import { setPlayerSlot, setStorage, type KVStorage } from '../../systems/SaveManager';
import { getLayoutTokens } from '../../style/responsive';
import { GAME_WIDTH, FLOORS } from '../../config/gameConfig';

vi.mock('phaser', () => {
  const keyCodes = new Proxy({}, { get: () => 0 });
  class ScenePlugin { constructor(_s: unknown, _pm: unknown) {} boot(): void {} }
  const Phaser = { Math: { Clamp: (v: number, mn: number, mx: number) => Math.min(mx, Math.max(mn, v)) }, Input: { Keyboard: { KeyCodes: keyCodes } }, Plugins: { ScenePlugin } };
  return { ...Phaser, default: Phaser };
});

import { ProgressStripController } from './ProgressStripController';

function memoryStorage(): KVStorage {
  const store = new Map<string, string>();
  return {
    getItem: (k) => store.get(k) ?? null,
    setItem: (k, v) => { store.set(k, v); },
    removeItem: (k) => { store.delete(k); },
  };
}

function makeToastMock() {
  return { show: vi.fn() };
}

describe('ProgressStripController', () => {
  let scene: ReturnType<typeof makeSceneMock>;
  let progression: ProgressionSystem;

  beforeEach(() => {
    setPlayerSlot('progress-test');
    setStorage(memoryStorage());
    progression = new ProgressionSystem();
    progression.reset();
    scene = makeSceneMock();
  });
  afterEach(() => { scene.events.emit('shutdown'); });

  it('creates floorText at (GAME_WIDTH - 48, 10) with empty initial text', () => {
    new ProgressStripController(
      scene as unknown as Phaser.Scene,
      scene.add.container() as unknown as Phaser.GameObjects.Container,
      progression,
      makeToastMock() as unknown as import('../Toast').Toast,
      getLayoutTokens('wide'),
    );
    const call = (scene.add.text as ReturnType<typeof vi.fn>).mock.calls.find(
      ([x, y, t]) => x === GAME_WIDTH - 48 && y === 10 && t === '',
    );
    expect(call).toBeDefined();
  });

  it('update() sets floor text on first call (floorChanged=true)', () => {
    const ctrl = new ProgressStripController(
      scene as unknown as Phaser.Scene,
      scene.add.container() as unknown as Phaser.GameObjects.Container,
      progression,
      makeToastMock() as unknown as import('../Toast').Toast,
      getLayoutTokens('wide'),
    );
    ctrl.update(0, FLOORS.LOBBY, true, false, 0);
    expect(ctrl.floorText.setText).toHaveBeenCalledWith(expect.stringContaining('F0:'));
  });

  it('update() adds a progress tween when au/floor changes', () => {
    const ctrl = new ProgressStripController(
      scene as unknown as Phaser.Scene,
      scene.add.container() as unknown as Phaser.GameObjects.Container,
      progression,
      makeToastMock() as unknown as import('../Toast').Toast,
      getLayoutTokens('wide'),
    );
    ctrl.update(5, FLOORS.LOBBY, false, true, 0);
    expect(scene.tweens.add).toHaveBeenCalled();
  });

  it('update() does not add new progress tweens when state is unchanged', () => {
    const ctrl = new ProgressStripController(
      scene as unknown as Phaser.Scene,
      scene.add.container() as unknown as Phaser.GameObjects.Container,
      progression,
      makeToastMock() as unknown as import('../Toast').Toast,
      getLayoutTokens('wide'),
    );
    // First call — queues a tween
    ctrl.update(0, FLOORS.LOBBY, true, false, 0);
    const tweensAfterFirst = (scene.tweens.add as ReturnType<typeof vi.fn>).mock.calls.length;
    // Subsequent identical calls — no new tween
    ctrl.update(0, FLOORS.LOBBY, false, false, 0);
    ctrl.update(0, FLOORS.LOBBY, false, false, 0);
    expect((scene.tweens.add as ReturnType<typeof vi.fn>).mock.calls.length).toBe(tweensAfterFirst);
  });

  it('shows au_milestone toast when event fires', () => {
    const toast = makeToastMock();
    new ProgressStripController(
      scene as unknown as Phaser.Scene,
      scene.add.container() as unknown as Phaser.GameObjects.Container,
      progression,
      toast as unknown as import('../Toast').Toast,
      getLayoutTokens('wide'),
    );
    eventBus.emit('progression:au_milestone', 10);
    expect(toast.show).toHaveBeenCalledWith(expect.stringContaining('10 AU'));
  });

  it('shows floor_unlocked toast when event fires', () => {
    const toast = makeToastMock();
    new ProgressStripController(
      scene as unknown as Phaser.Scene,
      scene.add.container() as unknown as Phaser.GameObjects.Container,
      progression,
      toast as unknown as import('../Toast').Toast,
      getLayoutTokens('wide'),
    );
    eventBus.emit('progression:floor_unlocked', FLOORS.LOBBY);
    expect(toast.show).toHaveBeenCalledWith(expect.stringContaining('UNLOCKED'));
  });

  it('unsubscribes toast listeners on destroy()', () => {
    const toast = makeToastMock();
    const ctrl = new ProgressStripController(
      scene as unknown as Phaser.Scene,
      scene.add.container() as unknown as Phaser.GameObjects.Container,
      progression,
      toast as unknown as import('../Toast').Toast,
      getLayoutTokens('wide'),
    );
    ctrl.destroy();
    toast.show.mockClear();
    eventBus.emit('progression:au_milestone', 50);
    eventBus.emit('progression:floor_unlocked', FLOORS.LOBBY);
    expect(toast.show).not.toHaveBeenCalled();
  });

  it('relayout() applies new font sizes to floor text and label', () => {
    const ctrl = new ProgressStripController(
      scene as unknown as Phaser.Scene,
      scene.add.container() as unknown as Phaser.GameObjects.Container,
      progression,
      makeToastMock() as unknown as import('../Toast').Toast,
      getLayoutTokens('wide'),
    );
    ctrl.relayout(getLayoutTokens('compact'));
    expect(ctrl.floorText.setStyle).toHaveBeenCalledWith(expect.objectContaining({ fontSize: '22px' }));
    expect(ctrl.floorLabel.setStyle).toHaveBeenCalledWith(expect.objectContaining({ fontSize: '12px' }));
  });

  it('shows nudge toast after 20 s within 2 AU of next unlock', () => {
    const toast = makeToastMock();
    const ctrl = new ProgressStripController(
      scene as unknown as Phaser.Scene,
      scene.add.container() as unknown as Phaser.GameObjects.Container,
      progression,
      toast as unknown as import('../Toast').Toast,
      getLayoutTokens('wide'),
    );
    // The PLATFORM floor requires some AU. Simulate being 1 AU away.
    // Lobby has auRequired=0, platform has auRequired=10.
    // If au=9 and next unlock is platform (auRequired=10), delta=1 ≤ 2.
    ctrl.update(9, FLOORS.LOBBY, true, true, 0);
    // 19 999 ms later — not yet
    ctrl.update(9, FLOORS.LOBBY, false, false, 19_999);
    expect(toast.show).not.toHaveBeenCalledWith(expect.stringContaining('💡'));
    // 20 000 ms later — triggers nudge
    ctrl.update(9, FLOORS.LOBBY, false, false, 20_000);
    expect(toast.show).toHaveBeenCalledWith(expect.stringContaining('💡'));
  });
});
