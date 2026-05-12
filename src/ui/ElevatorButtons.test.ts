/**
 * Unit tests for ElevatorButtons.
 *
 * Covers:
 *   (a) Container starts hidden (setVisible(false) called in constructor).
 *   (b) getState() returns { up: false, down: false } on construction.
 *   (c) setVisible(false) resets pressed state back to false.
 *   (d) setVisible(true) shows the container without altering state.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type * as Phaser from 'phaser';

vi.mock('phaser', () => ({
  default: {
    Scenes: { Events: { SHUTDOWN: 'shutdown' } },
  },
  Scenes: { Events: { SHUTDOWN: 'shutdown' } },
}));
vi.mock('../config/gameConfig', () => ({ GAME_WIDTH: 800, GAME_HEIGHT: 600 }));
vi.mock('../style/theme', () => ({
  theme: { color: { css: { textWhite: '#ffffff' }, ui: { accentAlt: 0x224466 } } },
}));

// ---------------------------------------------------------------------------
// Scene stub
// ---------------------------------------------------------------------------

function makeGraphics() {
  const g: Record<string, ReturnType<typeof vi.fn>> = {};
  for (const name of ['clear', 'fillStyle', 'fillRoundedRect', 'lineStyle', 'strokeRoundedRect']) {
    g[name] = vi.fn().mockReturnThis();
  }
  return g;
}

function makeText() {
  const t: Record<string, ReturnType<typeof vi.fn>> = {};
  for (const name of ['setOrigin', 'setScrollFactor']) {
    t[name] = vi.fn().mockReturnThis();
  }
  return t;
}

function makeScene() {
  let containerVisible = false;
  const inputHandlers: Map<string, (() => void)[]> = new Map();
  const onceHandlers: Array<{ event: string; handler: () => void }> = [];
  const hitAreas: Array<Record<string, ReturnType<typeof vi.fn>>> = [];

  const containerObj = {
    setDepth: vi.fn().mockReturnThis(),
    setScrollFactor: vi.fn().mockReturnThis(),
    setVisible: vi.fn((v: boolean) => { containerVisible = v; return containerObj; }),
    add: vi.fn(),
    get visible() { return containerVisible; },
  };

  const scene = {
    add: {
      container: vi.fn(() => containerObj),
      graphics: vi.fn(() => makeGraphics()),
      text: vi.fn(() => makeText()),
      rectangle: vi.fn(() => {
        const handlers: Record<string, () => void> = {};
        const rect = {
          setInteractive: vi.fn().mockReturnThis(),
          setAlpha: vi.fn().mockReturnThis(),
          on: vi.fn((event: string, handler: () => void) => {
            handlers[event] = handler;
            return rect;
          }),
          _trigger: (event: string) => handlers[event]?.(),
        };
        hitAreas.push(rect as unknown as Record<string, ReturnType<typeof vi.fn>>);
        return rect;
      }),
    },
    input: {
      on: vi.fn((event: string, handler: () => void) => {
        if (!inputHandlers.has(event)) inputHandlers.set(event, []);
        inputHandlers.get(event)!.push(handler);
      }),
      off: vi.fn(),
    },
    events: {
      once: vi.fn((event: string, handler: () => void) => {
        onceHandlers.push({ event, handler });
      }),
    },
    _container: () => containerObj,
    _triggerHitArea: (index: number, event: string) => {
      (hitAreas[index] as unknown as { _trigger: (e: string) => void })?._trigger(event);
    },
    _fireInput: (event: string) => {
      for (const h of inputHandlers.get(event) ?? []) h();
    },
  };

  return scene;
}

import { ElevatorButtons } from './ElevatorButtons';

describe('ElevatorButtons', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('(a) container starts hidden (setVisible called with false)', () => {
    const scene = makeScene();
    new ElevatorButtons(scene as unknown as Phaser.Scene);
    expect(scene._container().setVisible).toHaveBeenCalledWith(false);
  });

  it('(b) getState() returns { up: false, down: false } on construction', () => {
    const scene = makeScene();
    const buttons = new ElevatorButtons(scene as unknown as Phaser.Scene);
    expect(buttons.getState()).toEqual({ up: false, down: false });
  });

  it('(c) setVisible(false) resets pressed state to false', () => {
    const scene = makeScene();
    const buttons = new ElevatorButtons(scene as unknown as Phaser.Scene);

    // Simulate up button press
    scene._triggerHitArea(0, 'pointerdown');
    expect(buttons.getState().up).toBe(true);

    // Hide — state should reset
    buttons.setVisible(false);
    expect(buttons.getState()).toEqual({ up: false, down: false });
  });

  it('(d) setVisible(true) shows the container without altering state', () => {
    const scene = makeScene();
    const buttons = new ElevatorButtons(scene as unknown as Phaser.Scene);

    buttons.setVisible(true);
    expect(scene._container().setVisible).toHaveBeenCalledWith(true);
    // State should remain untouched
    expect(buttons.getState()).toEqual({ up: false, down: false });
  });

  it('pointerup on hit area releases the pressed state', () => {
    const scene = makeScene();
    const buttons = new ElevatorButtons(scene as unknown as Phaser.Scene);

    scene._triggerHitArea(0, 'pointerdown');
    expect(buttons.getState().up).toBe(true);

    scene._triggerHitArea(0, 'pointerup');
    expect(buttons.getState().up).toBe(false);
  });

  it('down button hit area (index 1) controls state.down', () => {
    const scene = makeScene();
    const buttons = new ElevatorButtons(scene as unknown as Phaser.Scene);

    scene._triggerHitArea(1, 'pointerdown');
    expect(buttons.getState().down).toBe(true);

    scene._triggerHitArea(1, 'pointerout');
    expect(buttons.getState().down).toBe(false);
  });

  it('scene-level pointerup resets state (releaseAllButtons)', () => {
    const scene = makeScene();
    const buttons = new ElevatorButtons(scene as unknown as Phaser.Scene);

    buttons.setVisible(true);
    scene._triggerHitArea(0, 'pointerdown');
    expect(buttons.getState().up).toBe(true);

    // Simulate scene-level pointer release
    scene._fireInput('pointerup');
    expect(buttons.getState()).toEqual({ up: false, down: false });
  });
});
