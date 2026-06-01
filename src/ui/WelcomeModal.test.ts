/**
 * Unit tests for WelcomeModal.
 *
 * ModalBase is stubbed so the modal can be constructed without a running
 * Phaser scene. `isTouchPrimary` and `promptLabel` are
 * also mocked to control the two build-panel branches (keyboard vs touch).
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type * as Phaser from 'phaser';

vi.mock('phaser', () => {
  const Phaser = {};
  return { ...Phaser, default: Phaser };
});

// ---------------------------------------------------------------------------
// Stub ModalBase
// ---------------------------------------------------------------------------
vi.mock('./ModalBase', () => ({
  ModalBase: class MockModalBase {
    protected readonly scene: unknown;
    protected readonly container: {
      add: ReturnType<typeof vi.fn>;
      setDepth: ReturnType<typeof vi.fn>;
      setScrollFactor: ReturnType<typeof vi.fn>;
      setAlpha: ReturnType<typeof vi.fn>;
    };

    private destroyed = false;

    constructor(scene: unknown) {
      this.scene = scene;
      this.container = {
        add: vi.fn(),
        setDepth: vi.fn().mockReturnThis(),
        setScrollFactor: vi.fn().mockReturnThis(),
        setAlpha: vi.fn().mockReturnThis(),
      };
    }

    protected onBeforeClose(): void { /* stub */ }
    protected onAfterClose(): void { /* stub */ }
    protected fadeIn(): void { /* stub */ }

    close(): void {
      if (this.destroyed) return;
      this.destroyed = true;
      this.onBeforeClose();
      this.onAfterClose();
    }
  },
}));

// ---------------------------------------------------------------------------
// Control isTouchPrimary per test
// ---------------------------------------------------------------------------
const mockIsTouchPrimary = vi.fn(() => false);
vi.mock('./touchPrimary', () => ({
  isTouchPrimary: () => mockIsTouchPrimary(),
}));

vi.mock('../input', () => ({
  promptLabel: vi.fn(() => 'K'),
}));

// ---------------------------------------------------------------------------
// Scene stub helpers
// ---------------------------------------------------------------------------

function makeText() {
  const t: Record<string, ReturnType<typeof vi.fn>> = {};
  for (const name of [
    'setOrigin', 'setScrollFactor', 'setInteractive', 'setColor', 'on',
  ]) {
    t[name] = vi.fn().mockReturnThis();
  }
  return t;
}

function makeGraphics() {
  const g: Record<string, ReturnType<typeof vi.fn>> = {};
  for (const name of [
    'fillStyle', 'fillRoundedRect', 'lineStyle', 'strokeRoundedRect', 'fillRect',
  ]) {
    g[name] = vi.fn().mockReturnThis();
  }
  return g;
}

type InputHandler = () => void;
type EventHandler = () => void;

function makeScene() {
  const inputHandlers: Map<string, InputHandler[]> = new Map();
  const onceHandlers: Map<string, EventHandler[]> = new Map();

  return {
    add: {
      graphics: vi.fn(() => makeGraphics()),
      text: vi.fn(() => makeText()),
    },
    inputs: {
      on: vi.fn((action: string, handler: InputHandler) => {
        if (!inputHandlers.has(action)) inputHandlers.set(action, []);
        inputHandlers.get(action)!.push(handler);
      }),
      off: vi.fn((action: string, handler: InputHandler) => {
        const list = inputHandlers.get(action) ?? [];
        const idx = list.indexOf(handler);
        if (idx >= 0) list.splice(idx, 1);
      }),
    },
    events: {
      once: vi.fn((event: string, handler: EventHandler) => {
        if (!onceHandlers.has(event)) onceHandlers.set(event, []);
        onceHandlers.get(event)!.push(handler);
      }),
      off: vi.fn(),
    },
    _fire: (action: string) => {
      for (const h of inputHandlers.get(action) ?? []) h();
    },
    _fireEvent: (event: string) => {
      for (const h of onceHandlers.get(event) ?? []) h();
    },
    _handlers: inputHandlers,
  };
}

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { WelcomeModal } from './WelcomeModal';
import * as input from '../input';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('WelcomeModal', () => {
  beforeEach(() => {
    mockIsTouchPrimary.mockReturnValue(false);
    vi.mocked(input.promptLabel).mockReturnValue('K');
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('constructs without throwing (keyboard path)', () => {
    const scene = makeScene();
    expect(() => new WelcomeModal(scene as unknown as Phaser.Scene, vi.fn())).not.toThrow();
  });

  it('constructs without throwing (touch-primary path)', () => {
    mockIsTouchPrimary.mockReturnValue(true);
    const scene = makeScene();
    expect(() => new WelcomeModal(scene as unknown as Phaser.Scene, vi.fn())).not.toThrow();
  });

  it('registers a Confirm input handler on construction', () => {
    const scene = makeScene();
    new WelcomeModal(scene as unknown as Phaser.Scene, vi.fn());
    expect(scene.inputs.on).toHaveBeenCalledWith('Confirm', expect.any(Function));
  });

  it('adds text and graphics elements to the container', () => {
    const scene = makeScene();
    new WelcomeModal(scene as unknown as Phaser.Scene, vi.fn());
    expect(scene.add.text).toHaveBeenCalled();
    expect(scene.add.graphics).toHaveBeenCalled();
  });

  it('describes the actual win condition instead of a 100 AU target', () => {
    const scene = makeScene();
    new WelcomeModal(scene as unknown as Phaser.Scene, vi.fn());
    const allTextArgs = (scene.add.text as ReturnType<typeof vi.fn>).mock.calls.map((c) => c[2]);
    const bodyText = allTextArgs.find((text): text is string =>
      typeof text === 'string' && text.includes('Collecting AU'),
    );

    expect(bodyText).toContain('Unlock the Boardroom and beat the CEO boss to graduate!');
    expect(bodyText).not.toContain('Reach 100 AU');
  });

  it('calls onComplete when close() is invoked', () => {
    const scene = makeScene();
    const onComplete = vi.fn();
    const modal = new WelcomeModal(scene as unknown as Phaser.Scene, onComplete);
    modal.close();
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it('removes the Confirm handler in onBeforeClose', () => {
    const scene = makeScene();
    const modal = new WelcomeModal(scene as unknown as Phaser.Scene, vi.fn());
    modal.close();
    expect(scene.inputs.off).toHaveBeenCalledWith('Confirm', expect.any(Function));
  });

  it('Confirm key press triggers close() which calls onComplete', () => {
    const scene = makeScene();
    const onComplete = vi.fn();
    new WelcomeModal(scene as unknown as Phaser.Scene, onComplete);
    scene._fire('Confirm');
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it('uses promptLabel on non-touch devices', () => {
    mockIsTouchPrimary.mockReturnValue(false);
    const scene = makeScene();
    new WelcomeModal(scene as unknown as Phaser.Scene, vi.fn());
    expect(input.promptLabel).toHaveBeenCalled();
  });

  it('does NOT call promptLabel on touch-primary devices (uses TOUCH_CONTROLS constant)', () => {
    mockIsTouchPrimary.mockReturnValue(true);
    vi.mocked(input.promptLabel).mockClear();
    const scene = makeScene();
    new WelcomeModal(scene as unknown as Phaser.Scene, vi.fn());
    expect(input.promptLabel).not.toHaveBeenCalled();
  });

  it('Confirm handler is removed after close so a second fire does not call onComplete again', () => {
    const scene = makeScene();
    const onComplete = vi.fn();
    const modal = new WelcomeModal(scene as unknown as Phaser.Scene, onComplete);
    modal.close(); // removes Confirm listener
    // Simulate firing Confirm again — handler should already be removed
    onComplete.mockClear();
    scene._fire('Confirm');
    expect(onComplete).not.toHaveBeenCalled();
  });

  it('second close() call does not invoke onComplete a second time (destroyed guard)', () => {
    // The ModalBase stub has a `destroyed` guard matching real ModalBase behaviour:
    // the second close() is a no-op so onComplete must not be called again.
    const scene = makeScene();
    const onComplete = vi.fn();
    const modal = new WelcomeModal(scene as unknown as Phaser.Scene, onComplete);
    modal.close();
    const firstCallCount = onComplete.mock.calls.length;
    modal.close();
    // onComplete call count must not have grown after the second (no-op) close
    expect(onComplete.mock.calls.length).toBe(firstCallCount);
    // inputs.off was called exactly once for Confirm (from the first close)
    const offConfirmCalls = (scene.inputs.off as ReturnType<typeof vi.fn>).mock.calls
      .filter(([action]) => action === 'Confirm').length;
    expect(offConfirmCalls).toBe(1);
  });

  // -------------------------------------------------------------------------
  // source: 'help' branch
  // -------------------------------------------------------------------------

  it('source: help — renders "How to Play" title (not "Welcome, Architect!")', () => {
    const scene = makeScene();
    new WelcomeModal(scene as unknown as Phaser.Scene, vi.fn(), 'help');
    // Filter to the title call specifically: the third arg is the text string
    // and the fourth arg contains fontStyle: 'bold' with fontSize: '30px'.
    const titleCalls = (scene.add.text as ReturnType<typeof vi.fn>).mock.calls.filter(
      (c) => typeof c[2] === 'string' && c[3]?.fontStyle === 'bold' && c[3]?.fontSize === '30px',
    );
    expect(titleCalls.length).toBe(1);
    expect(titleCalls[0]![2]).toBe('How to Play');
  });

  it('source: first-run — renders "Welcome, Architect!" title', () => {
    const scene = makeScene();
    new WelcomeModal(scene as unknown as Phaser.Scene, vi.fn(), 'first-run');
    const titleCalls = (scene.add.text as ReturnType<typeof vi.fn>).mock.calls.filter(
      (c) => typeof c[2] === 'string' && c[3]?.fontStyle === 'bold' && c[3]?.fontSize === '30px',
    );
    expect(titleCalls.length).toBe(1);
    expect(titleCalls[0]![2]).toBe('Welcome, Architect!');
  });

  it('source: help — calls onComplete when modal is closed (caller manages side effects)', () => {
    // With the new design, onComplete is always called on close; the caller
    // (SettingsScene.openHowToPlay) passes a guard-clearing callback rather
    // than the completeOnboarding() handler used for first-run.
    const scene = makeScene();
    const onComplete = vi.fn();
    const modal = new WelcomeModal(scene as unknown as Phaser.Scene, onComplete, 'help');
    modal.close();
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it('source: help — Confirm key press also calls onComplete', () => {
    const scene = makeScene();
    const onComplete = vi.fn();
    new WelcomeModal(scene as unknown as Phaser.Scene, onComplete, 'help');
    scene._fire('Confirm');
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it('source: help — renders "Esc to close" footer (not "Esc to skip")', () => {
    const scene = makeScene();
    new WelcomeModal(scene as unknown as Phaser.Scene, vi.fn(), 'help');
    const allTextArgs = (scene.add.text as ReturnType<typeof vi.fn>).mock.calls.map((c) => c[2]);
    expect(allTextArgs.some((t) => t === 'Esc to close')).toBe(true);
    expect(allTextArgs.some((t) => t === 'Esc to skip')).toBe(false);
  });

  it('source: first-run — renders "Esc to skip" footer', () => {
    const scene = makeScene();
    new WelcomeModal(scene as unknown as Phaser.Scene, vi.fn(), 'first-run');
    const allTextArgs = (scene.add.text as ReturnType<typeof vi.fn>).mock.calls.map((c) => c[2]);
    expect(allTextArgs.some((t) => t === 'Esc to skip')).toBe(true);
    expect(allTextArgs.some((t) => t === 'Esc to close')).toBe(false);
  });

  it('source: first-run (default) — calls onComplete when closed', () => {
    const scene = makeScene();
    const onComplete = vi.fn();
    const modal = new WelcomeModal(scene as unknown as Phaser.Scene, onComplete);
    modal.close();
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it('constructs with default no-op onComplete (no arg) and does not throw on close', () => {
    const scene = makeScene();
    // No onComplete provided — exercises the default parameter arrow function
    const modal = new WelcomeModal(scene as unknown as Phaser.Scene);
    expect(() => modal.close()).not.toThrow();
  });
});
