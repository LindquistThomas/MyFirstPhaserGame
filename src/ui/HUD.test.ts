import { beforeEach, describe, expect, it, vi } from 'vitest';
import type * as Phaser from 'phaser';
import { eventBus } from '../systems/EventBus';
import { ProgressionSystem } from '../systems/ProgressionSystem';
import { FLOORS } from '../config/gameConfig';

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

  beforeEach(() => {
    progression = new ProgressionSystem();
    progression.reset();
  });

  it('updates AU/floor labels and animates coin when AU increases', () => {
    const scene = makeScene(false);
    const hud = new HUD(scene as unknown as Phaser.Scene, progression);

    progression.addAU(FLOORS.LOBBY, 2);
    hud.update();

    const auText = scene.texts[0];
    const floorText = scene.texts[1];
    expect(auText.setText).toHaveBeenCalledWith('AU: 2');
    expect(floorText.setText).toHaveBeenCalledWith(expect.stringContaining('F0:'));
    expect(scene.tweens.add).toHaveBeenCalledTimes(2);
    scene.events.emit('shutdown');
  });

  it('emits toggle event on mute click and unsubscribes from mute-changed on shutdown', () => {
    const scene = makeScene(false);
    new HUD(scene as unknown as Phaser.Scene, progression);

    const toggleSpy = vi.fn();
    eventBus.on('audio:toggle-mute', toggleSpy);

    scene.zoneHandlers.get('pointerup')?.();
    expect(toggleSpy).toHaveBeenCalledTimes(1);

    const muteGraphics = scene.graphics[3];
    const clearCountBefore = muteGraphics.clear.mock.calls.length;
    eventBus.emit('audio:mute-changed', true);
    expect(muteGraphics.clear.mock.calls.length).toBeGreaterThan(clearCountBefore);

    const clearCountAfterBind = muteGraphics.clear.mock.calls.length;
    scene.events.emit('shutdown');
    eventBus.emit('audio:mute-changed', false);
    expect(muteGraphics.clear.mock.calls.length).toBe(clearCountAfterBind);

    eventBus.off('audio:toggle-mute', toggleSpy);
  });
});
