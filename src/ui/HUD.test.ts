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
  return {
    clear: vi.fn(),
    fillStyle: vi.fn(),
    fillCircle: vi.fn(),
    fillRect: vi.fn(),
    fillGradientStyle: vi.fn(),
    lineStyle: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    strokePath: vi.fn(),
    fillEllipse: vi.fn(),
    setPosition: vi.fn().mockReturnThis(),
  };
}

function makeText(text: string) {
  return {
    text,
    setOrigin: vi.fn().mockReturnThis(),
    setText: vi.fn().mockReturnThis(),
    setScrollFactor: vi.fn().mockReturnThis(),
    setDepth: vi.fn().mockReturnThis(),
    destroy: vi.fn(),
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
    expect(scene.tweens.add).toHaveBeenCalledTimes(2);
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
    const clearCountBefore = muteGraphics.clear.mock.calls.length;
    eventBus.emit('audio:mute-changed', true);
    expect(muteGraphics.clear.mock.calls.length).toBeGreaterThan(clearCountBefore);

    const clearCountAfterBind = muteGraphics.clear.mock.calls.length;
    scene.events.emit('shutdown');
    eventBus.emit('audio:mute-changed', false);
    expect(muteGraphics.clear.mock.calls.length).toBe(clearCountAfterBind);
  });
});
