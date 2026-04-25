import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type * as Phaser from 'phaser';
import { eventBus } from '../systems/EventBus';
import { ProgressionSystem } from '../systems/ProgressionSystem';
import { FLOORS, GAME_WIDTH } from '../config/gameConfig';
import { setPlayerSlot, setStorage, type KVStorage } from '../systems/SaveManager';

vi.mock('phaser', () => {
  const Phaser = {
    Math: {
      Clamp: (value: number, min: number, max: number) => Math.min(max, Math.max(min, value)),
    },
  };
  return { ...Phaser, default: Phaser };
});

import { HUD } from './HUD';

type Listener = (...args: unknown[]) => void;

function makeGraphics() {
  const g: Record<string, unknown> = {};
  const chained = [
    'clear',
    'fillStyle',
    'fillCircle',
    'fillRect',
    'fillRoundedRect',
    'fillGradientStyle',
    'lineStyle',
    'beginPath',
    'moveTo',
    'lineTo',
    'strokePath',
    'fillEllipse',
    'arc',
    'setPosition',
    'setAlpha',
    'setVisible',
    'setX',
    'setScale',
  ];
  for (const name of chained) {
    g[name] = vi.fn().mockReturnThis();
  }
  (g as unknown as { scene: unknown }).scene = {};
  return g as unknown as ReturnType<typeof vi.fn> & {
    clear: ReturnType<typeof vi.fn>;
    setPosition: ReturnType<typeof vi.fn>;
  };
}

function makeText(text: string) {
  const t: Record<string, unknown> = {
    text,
    x: 0,
    y: 0,
  };
  t.setOrigin = vi.fn().mockReturnValue(t);
  t.setText = vi.fn((s: string) => {
    (t as { text: string }).text = s;
    return t;
  });
  t.setScrollFactor = vi.fn().mockReturnValue(t);
  t.setDepth = vi.fn().mockReturnValue(t);
  t.setY = vi.fn((y: number) => {
    (t as { y: number }).y = y;
    return t;
  });
  t.setAlpha = vi.fn().mockReturnValue(t);
  t.destroy = vi.fn();
  return t as unknown as {
    text: string;
    x: number;
    y: number;
    setOrigin: ReturnType<typeof vi.fn>;
    setText: ReturnType<typeof vi.fn>;
    setScrollFactor: ReturnType<typeof vi.fn>;
    setDepth: ReturnType<typeof vi.fn>;
    setY: ReturnType<typeof vi.fn>;
    setAlpha: ReturnType<typeof vi.fn>;
    destroy: ReturnType<typeof vi.fn>;
  };
}

function memoryStorage(): KVStorage {
  const store = new Map<string, string>();
  return {
    getItem: (key) => (store.has(key) ? store.get(key)! : null),
    setItem: (key, value) => { store.set(key, value); },
    removeItem: (key) => { store.delete(key); },
  };
}

function makeScene(muted = false) {
  const onceHandlers: Record<string, Listener[]> = {};
  const zoneHandlers = new Map<string, Listener>();
  const texts: Array<ReturnType<typeof makeText>> = [];
  const graphics: Array<ReturnType<typeof makeGraphics>> = [];
  const zones: Array<{ on: ReturnType<typeof vi.fn> }> = [];

  const scene = {
    add: {
      container: vi.fn(() => ({
        add: vi.fn(),
        setDepth: vi.fn().mockReturnThis(),
        setScrollFactor: vi.fn().mockReturnThis(),
        setAlpha: vi.fn().mockReturnThis(),
        setVisible: vi.fn().mockReturnThis(),
        alpha: 1,
      })),
      graphics: vi.fn(() => {
        const g = makeGraphics();
        graphics.push(g);
        return g;
      }),
      text: vi.fn((_x: number, _y: number, text: string) => {
        const t = makeText(text);
        texts.push(t);
        return t;
      }),
      zone: vi.fn(() => {
        const z = {
          setInteractive: vi.fn().mockReturnThis(),
          on: vi.fn((event: string, handler: Listener) => {
            zoneHandlers.set(event, handler);
            return z;
          }),
        };
        zones.push(z);
        return z;
      }),
    },
    tweens: {
      add: vi.fn((config: Record<string, unknown>) => ({
        stop: vi.fn(),
        targets: config.targets,
        onComplete: config.onComplete as (() => void) | undefined,
      })),
    },
    time: {
      delayedCall: vi.fn(),
      addEvent: vi.fn(),
    },
    registry: {
      get: vi.fn((key: string) => (key === 'audio' ? { isMuted: () => muted } : undefined)),
    },
    events: {
      once: vi.fn((event: string, handler: Listener) => {
        (onceHandlers[event] ??= []).push(handler);
      }),
      emit: (event: string) => {
        const handlers = onceHandlers[event] ?? [];
        onceHandlers[event] = [];
        handlers.forEach((fn) => fn());
      },
    },
    zoneHandlers,
    texts,
    graphics,
    zones,
  };

  return scene;
}

describe('HUD', () => {
  let progression: ProgressionSystem;
  let scene: ReturnType<typeof makeScene> | undefined;
  let toggleSpy: ReturnType<typeof vi.fn> | undefined;

  beforeEach(() => {
    setPlayerSlot('hud-test');
    setStorage(memoryStorage());
    progression = new ProgressionSystem();
    progression.reset();
    scene = undefined;
    toggleSpy = undefined;
  });

  afterEach(() => {
    scene?.events.emit('shutdown');
    if (toggleSpy) eventBus.off('audio:toggle-mute', toggleSpy);
  });

  it('updates AU/floor labels and animates coin when AU increases', () => {
    scene = makeScene(false);
    const hud = new HUD(scene as unknown as Phaser.Scene, progression);

    progression.addAU(FLOORS.LOBBY, 2);
    hud.update();

    const auTextCall = scene.add.text.mock.calls.findIndex(
      ([x, y, initialText]) => x === 46 && y === 6 && initialText === 'AU: 0',
    );
    const floorTextCall = scene.add.text.mock.calls.findIndex(
      ([x, y, initialText]) => x === GAME_WIDTH - 48 && y === 10 && initialText === '',
    );
    expect(auTextCall).toBeGreaterThan(-1);
    expect(floorTextCall).toBeGreaterThan(-1);
    const auText = scene.add.text.mock.results[auTextCall]?.value as ReturnType<typeof makeText>;
    const floorText = scene.add.text.mock.results[floorTextCall]?.value as ReturnType<typeof makeText>;

    expect(auText.setText).toHaveBeenCalledWith('AU: 2');
    expect(floorText.setText).toHaveBeenCalledWith(expect.stringContaining('F0:'));
    // update() triggers a tween for the coin-punch, a tween for the +N flyer,
    // and a progress-strip fill tween. Exact count is not asserted to allow
    // future tween additions to coexist without breaking the test.
    expect(scene.tweens.add).toHaveBeenCalled();
  });

  it('emits toggle event on mute click and unsubscribes from mute-changed on shutdown', () => {
    scene = makeScene(false);
    new HUD(scene as unknown as Phaser.Scene, progression);

    toggleSpy = vi.fn();
    eventBus.on('audio:toggle-mute', toggleSpy);

    scene.zoneHandlers.get('pointerup')?.();
    expect(toggleSpy).toHaveBeenCalledTimes(1);

    const muteGraphics = scene.graphics.find((g) =>
      g.setPosition.mock.calls.some(([x, y]) => x === GAME_WIDTH - 24 && y === 22),
    );
    expect(muteGraphics).toBeDefined();
    if (!muteGraphics) throw new Error('muteGraphics not found');
    const clearCountBefore = muteGraphics.clear.mock.calls.length;
    eventBus.emit('audio:mute-changed', true);
    expect(muteGraphics.clear.mock.calls.length).toBeGreaterThan(clearCountBefore);

    const clearCountAfterBind = muteGraphics.clear.mock.calls.length;
    scene.events.emit('shutdown');
    eventBus.emit('audio:mute-changed', false);
    expect(muteGraphics.clear.mock.calls.length).toBe(clearCountAfterBind);
  });
});
