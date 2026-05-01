import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type * as Phaser from 'phaser';
import { makeSceneMock } from './testUtils';
import { ProgressionSystem } from '../../systems/ProgressionSystem';
import { setPlayerSlot, setStorage, type KVStorage } from '../../systems/SaveManager';
import { getLayoutTokens } from '../../style/responsive';

vi.mock('phaser', () => {
  const keyCodes = new Proxy({}, { get: () => 0 });
  class ScenePlugin { constructor(_s: unknown, _pm: unknown) {} boot(): void {} }
  const Phaser = { Math: { Clamp: (v: number, mn: number, mx: number) => Math.min(mx, Math.max(mn, v)) }, Input: { Keyboard: { KeyCodes: keyCodes } }, Plugins: { ScenePlugin } };
  return { ...Phaser, default: Phaser };
});

import { CoinCounterController } from './CoinCounterController';

function memoryStorage(): KVStorage {
  const store = new Map<string, string>();
  return {
    getItem: (k) => store.get(k) ?? null,
    setItem: (k, v) => { store.set(k, v); },
    removeItem: (k) => { store.delete(k); },
  };
}

describe('CoinCounterController', () => {
  let scene: ReturnType<typeof makeSceneMock>;
  let progression: ProgressionSystem;

  beforeEach(() => {
    setPlayerSlot('coin-test');
    setStorage(memoryStorage());
    progression = new ProgressionSystem();
    progression.reset();
    scene = makeSceneMock();
  });
  afterEach(() => { scene.events.emit('shutdown'); });

  it('creates an AU text element at (46, 6) with initial "AU: 0"', () => {
    new CoinCounterController(
      scene as unknown as Phaser.Scene,
      scene.add.container() as unknown as Phaser.GameObjects.Container,
      progression,
      getLayoutTokens('wide'),
    );
    const call = (scene.add.text as ReturnType<typeof vi.fn>).mock.calls.find(
      ([x, y, t]) => x === 46 && y === 6 && t === 'AU: 0',
    );
    expect(call).toBeDefined();
  });

  it('update() sets AU text to current AU value', () => {
    const ctrl = new CoinCounterController(
      scene as unknown as Phaser.Scene,
      scene.add.container() as unknown as Phaser.GameObjects.Container,
      progression,
      getLayoutTokens('wide'),
    );
    ctrl.update(5, 0);
    expect(ctrl.auText.setText).toHaveBeenCalledWith('AU: 5');
  });

  it('update() triggers coin-punch tween when AU increases', () => {
    const ctrl = new CoinCounterController(
      scene as unknown as Phaser.Scene,
      scene.add.container() as unknown as Phaser.GameObjects.Container,
      progression,
      getLayoutTokens('wide'),
    );
    ctrl.update(3, 0);
    expect(scene.tweens.add).toHaveBeenCalled();
  });

  it('update() does not trigger coin-punch when AU is unchanged', () => {
    const ctrl = new CoinCounterController(
      scene as unknown as Phaser.Scene,
      scene.add.container() as unknown as Phaser.GameObjects.Container,
      progression,
      getLayoutTokens('wide'),
    );
    const callsBefore = (scene.tweens.add as ReturnType<typeof vi.fn>).mock.calls.length;
    ctrl.update(0, 0);
    expect((scene.tweens.add as ReturnType<typeof vi.fn>).mock.calls.length).toBe(callsBefore);
  });

  it('relayout() applies the new font size to auText', () => {
    const ctrl = new CoinCounterController(
      scene as unknown as Phaser.Scene,
      scene.add.container() as unknown as Phaser.GameObjects.Container,
      progression,
      getLayoutTokens('wide'),
    );
    ctrl.relayout(getLayoutTokens('compact'));
    expect(ctrl.auText.setStyle).toHaveBeenCalledWith(expect.objectContaining({ fontSize: '28px' }));
  });
});
