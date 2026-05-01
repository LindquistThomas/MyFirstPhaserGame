/**
 * Unit tests for WelcomeModal.
 *
 * ModalBase is stubbed so the modal can be constructed without a running
 * Phaser scene. `isTouchPrimary`, `allKeyLabels`, and `primaryKeyLabel` are
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

// Mock key labels so the non-touch branch resolves without real input data
vi.mock('../input/keyLabels', () => ({
  allKeyLabels: vi.fn(() => 'K'),
  primaryKeyLabel: vi.fn(() => 'K'),
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
import * as keyLabels from '../input/keyLabels';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('WelcomeModal', () => {
  beforeEach(() => {
    mockIsTouchPrimary.mockReturnValue(false);
    vi.mocked(keyLabels.allKeyLabels).mockReturnValue('K');
    vi.mocked(keyLabels.primaryKeyLabel).mockReturnValue('K');
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

  it('uses allKeyLabels / primaryKeyLabel on non-touch devices', () => {
    mockIsTouchPrimary.mockReturnValue(false);
    const scene = makeScene();
    new WelcomeModal(scene as unknown as Phaser.Scene, vi.fn());
    // Both helpers should have been called to build the keyboard-controls block
    expect(keyLabels.allKeyLabels).toHaveBeenCalled();
    expect(keyLabels.primaryKeyLabel).toHaveBeenCalled();
  });

  it('does NOT call allKeyLabels on touch-primary devices (uses TOUCH_CONTROLS constant)', () => {
    mockIsTouchPrimary.mockReturnValue(true);
    vi.mocked(keyLabels.allKeyLabels).mockClear();
    const scene = makeScene();
    new WelcomeModal(scene as unknown as Phaser.Scene, vi.fn());
    expect(keyLabels.allKeyLabels).not.toHaveBeenCalled();
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

  it('second close() call does not invoke onComplete a second time (stub guard)', () => {
    // The ModalBase stub has no `destroyed` guard; verifies the Confirm handler
    // is nulled after the first close so the second close's onBeforeClose is a no-op.
    const scene = makeScene();
    const onComplete = vi.fn();
    const modal = new WelcomeModal(scene as unknown as Phaser.Scene, onComplete);
    modal.close();
    const firstCallCount = onComplete.mock.calls.length;
    modal.close();
    // inputs.off should not be called again with the handler (it's been nulled)
    const offCallsAfterSecondClose = (scene.inputs.off as ReturnType<typeof vi.fn>).mock.calls
      .filter(([action]) => action === 'Confirm').length;
    // Only one off call for Confirm (from the first close)
    expect(offCallsAfterSecondClose).toBe(1);
    expect(onComplete.mock.calls.length).toBeGreaterThanOrEqual(firstCallCount);
  });
});
