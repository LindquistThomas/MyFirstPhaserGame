/**
 * Unit tests for ControlHintsOverlay.
 *
 * Covers:
 *   (a) Constructor creates chips (scene.add.container called for each hint).
 *   (b) Auto-dismiss timer is started (scene.time.delayedCall called on construction).
 *   (c) destroy() is idempotent (second call is a no-op).
 *   (d) Timer clear: destroy() removes the timer.
 *   (e) update() after destroy() is a no-op (no further checks performed).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type * as Phaser from 'phaser';

vi.mock('phaser', () => ({ default: {} }));
vi.mock('../config/gameConfig', () => ({ GAME_WIDTH: 800, GAME_HEIGHT: 600 }));
vi.mock('../style/theme', () => ({
  theme: { color: { bg: { dark: 0x000011 } } },
}));

// Mock primaryKeyLabel so we avoid real input binding lookups
vi.mock('../input', () => ({
  primaryKeyLabel: vi.fn((_action: string) => 'Key'),
  promptLabel: vi.fn((_action: string) => 'Enter'),
  initInputModeTracking: vi.fn(),
}));

// Stub createSceneLifecycle — capture the registered teardown callbacks
const lifecycleDisposers: Array<() => void> = [];
vi.mock('../systems/sceneLifecycle', () => ({
  createSceneLifecycle: vi.fn((_scene: unknown) => ({
    add: vi.fn((fn: () => void) => { lifecycleDisposers.push(fn); }),
    bindEventBus: vi.fn(),
    destroy: vi.fn(),
  })),
}));

// ---------------------------------------------------------------------------
// Scene stub
// ---------------------------------------------------------------------------

function makeGraphics() {
  const g: Record<string, ReturnType<typeof vi.fn>> = {};
  for (const name of ['fillStyle', 'fillRoundedRect', 'lineStyle', 'strokeRoundedRect']) {
    g[name] = vi.fn().mockReturnThis();
  }
  return g;
}

function makeText() {
  const t: Record<string, ReturnType<typeof vi.fn>> = {};
  for (const name of ['setOrigin', 'setScrollFactor', 'setDepth']) {
    t[name] = vi.fn().mockReturnThis();
  }
  return t;
}

interface FakeTimer { remove: ReturnType<typeof vi.fn> }

function makeScene() {
  const timers: FakeTimer[] = [];
  let dismissTimerCallback: (() => void) | null = null;

  const scene = {
    add: {
      graphics: vi.fn(() => makeGraphics()),
      text: vi.fn(() => makeText()),
      container: vi.fn((_x: unknown, _y: unknown, _children: unknown) => ({
        setDepth: vi.fn().mockReturnThis(),
        setScrollFactor: vi.fn().mockReturnThis(),
        destroy: vi.fn(),
        y: 0,
      })),
    },
    inputs: {
      justPressed: vi.fn(() => false),
    },
    tweens: {
      add: vi.fn(),
    },
    time: {
      delayedCall: vi.fn((_delay: number, cb: () => void) => {
        dismissTimerCallback = cb;
        const t: FakeTimer = { remove: vi.fn() };
        timers.push(t);
        return t;
      }),
    },
    _timers: timers,
    _triggerDismissTimer: () => { dismissTimerCallback?.(); },
  };

  return scene;
}

import { ControlHintsOverlay } from './ControlHintsOverlay';

describe('ControlHintsOverlay', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    lifecycleDisposers.length = 0;
  });

  it('(a) creates 4 hint chip containers on construction', () => {
    const scene = makeScene();
    new ControlHintsOverlay(scene as unknown as Phaser.Scene);
    // 4 chips, each using scene.add.container
    expect(scene.add.container).toHaveBeenCalledTimes(4);
  });

  it('(b) starts the auto-dismiss timer on construction', () => {
    const scene = makeScene();
    new ControlHintsOverlay(scene as unknown as Phaser.Scene);
    expect(scene.time.delayedCall).toHaveBeenCalledTimes(1);
  });

  it('(c) destroy() is idempotent — second call does not re-destroy chips', () => {
    const scene = makeScene();
    const overlay = new ControlHintsOverlay(scene as unknown as Phaser.Scene);
    overlay.destroy();
    // Should not throw on second call
    expect(() => overlay.destroy()).not.toThrow();
  });

  it('(d) destroy() removes the dismiss timer', () => {
    const scene = makeScene();
    const overlay = new ControlHintsOverlay(scene as unknown as Phaser.Scene);
    const timer = scene._timers[0]!;
    overlay.destroy();
    expect(timer.remove).toHaveBeenCalled();
  });

  it('(e) update() after destroy() performs no action (dismissed guard)', () => {
    const scene = makeScene();
    const overlay = new ControlHintsOverlay(scene as unknown as Phaser.Scene);
    overlay.destroy();
    // After destroy, update() should be a no-op (inputs.justPressed not called again)
    const callsBefore = (scene.inputs.justPressed as ReturnType<typeof vi.fn>).mock.calls.length;
    overlay.update();
    expect(scene.inputs.justPressed).toHaveBeenCalledTimes(callsBefore);
  });

  it('auto-dismiss timer fires destroy()', () => {
    const scene = makeScene();
    const overlay = new ControlHintsOverlay(scene as unknown as Phaser.Scene);
    // Spy to confirm destroy gets called
    const destroySpy = vi.spyOn(overlay, 'destroy');
    scene._triggerDismissTimer();
    expect(destroySpy).toHaveBeenCalledTimes(1);
  });

  it('lifecycle teardown callback fires destroy()', () => {
    const scene = makeScene();
    const overlay = new ControlHintsOverlay(scene as unknown as Phaser.Scene);
    const destroySpy = vi.spyOn(overlay, 'destroy');
    // Invoke the disposer registered via lifecycle.add(...)
    lifecycleDisposers[0]?.();
    expect(destroySpy).toHaveBeenCalledTimes(1);
  });

  it('(f) update() dismisses a chip via animated tween when its action fires', () => {
    const scene = makeScene();
    const overlay = new ControlHintsOverlay(scene as unknown as Phaser.Scene);

    // Make 'Interact' fire (non-MoveLeft path) so dismissChip(chip, true) runs
    (scene.inputs.justPressed as ReturnType<typeof vi.fn>).mockImplementation(
      (action: string) => action === 'Interact',
    );
    overlay.update();

    // The animate=true path calls tweens.add once for the Interact chip
    expect(scene.tweens.add).toHaveBeenCalledTimes(1);

    // A second update() hits the chip.dismissed=true → continue branch
    overlay.update();
    expect(scene.tweens.add).toHaveBeenCalledTimes(1); // still only 1, skipped
  });

  it('(g) MoveLeft chip dismisses on MoveRight action (shared hint)', () => {
    const scene = makeScene();
    const overlay = new ControlHintsOverlay(scene as unknown as Phaser.Scene);

    // MoveRight triggers the MoveLeft chip dismissal (ternary true branch)
    (scene.inputs.justPressed as ReturnType<typeof vi.fn>).mockImplementation(
      (action: string) => action === 'MoveRight',
    );
    overlay.update();

    expect(scene.tweens.add).toHaveBeenCalledTimes(1);
  });

  it('(h) update() calls destroy() once all chips are dismissed', () => {
    const scene = makeScene();
    const overlay = new ControlHintsOverlay(scene as unknown as Phaser.Scene);
    const destroySpy = vi.spyOn(overlay, 'destroy');

    // All actions fire → all four chips dismissed → every() true → destroy()
    (scene.inputs.justPressed as ReturnType<typeof vi.fn>).mockReturnValue(true);
    overlay.update();

    expect(destroySpy).toHaveBeenCalledTimes(1);
  });
});
