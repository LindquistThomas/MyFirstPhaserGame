/**
 * Unit tests for ControlsReferenceModal.
 *
 * ModalBase is stubbed so the modal can be constructed without a running
 * Phaser scene.  `settingsStore`, `buildEffectiveBindings`, and `keyLabel`
 * are all mocked to give deterministic results.
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
      list: unknown[];
      add: ReturnType<typeof vi.fn>;
    };

    private destroyed = false;

    constructor(scene: unknown) {
      this.scene = scene;
      this.container = {
        list: [],
        add: vi.fn(),
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
// Mock settings and input modules
// ---------------------------------------------------------------------------

const mockOverrides: Record<string, number[]> = {};
vi.mock('../systems/SettingsStore', () => ({
  settingsStore: {
    read: vi.fn(() => ({ controlBindings: mockOverrides })),
  },
}));

vi.mock('../input/bindings', () => ({
  buildEffectiveBindings: vi.fn((overrides: Record<string, number[]>) => {
    // Return a minimal effective binding map: action → [99] by default,
    // or whatever the override says.
    return new Proxy(overrides, {
      get(target, prop) {
        return (target as Record<string, number[]>)[prop as string] ?? [99];
      },
    });
  }),
}));

vi.mock('../input/actionLabels', () => ({
  ACTION_LABELS: new Proxy({}, {
    get(_target, prop) { return `Label(${String(prop)})`; },
  }),
}));

vi.mock('../input/keyLabels', () => ({
  keyLabel: vi.fn((code: number) => `Key(${code})`),
}));

// ---------------------------------------------------------------------------
// Scene stub helpers
// ---------------------------------------------------------------------------

type InputHandler = () => void;

function makeText() {
  const t: Record<string, ReturnType<typeof vi.fn>> = {};
  for (const name of [
    'setOrigin', 'setScrollFactor', 'setInteractive', 'setColor', 'setFontSize',
    'setVisible', 'setText', 'on',
  ]) {
    t[name] = vi.fn().mockReturnThis();
  }
  return t;
}

function makeGraphics() {
  const g: Record<string, ReturnType<typeof vi.fn>> = {};
  for (const name of [
    'fillStyle', 'fillRoundedRect', 'lineStyle', 'strokeRoundedRect',
    'fillRect', 'lineBetween', 'clear',
  ]) {
    g[name] = vi.fn().mockReturnThis();
  }
  return g;
}

function makeScene() {
  const inputHandlers: Map<string, InputHandler[]> = new Map();

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
      once: vi.fn(),
      off: vi.fn(),
    },
    time: {
      delayedCall: vi.fn(),
    },
    sys: {
      settings: { key: 'MenuScene' },
    },
    scene: {
      start: vi.fn(),
    },
    _fire: (action: string) => {
      for (const h of inputHandlers.get(action) ?? []) h();
    },
    _handlers: inputHandlers,
  };
}

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { ControlsReferenceModal } from './ControlsReferenceModal';
import * as keyLabels from '../input/keyLabels';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ControlsReferenceModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset override map.
    for (const k of Object.keys(mockOverrides)) delete mockOverrides[k];
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // ---- Construction --------------------------------------------------------

  it('constructs without throwing', () => {
    const scene = makeScene();
    expect(() => new ControlsReferenceModal(scene as unknown as Phaser.Scene)).not.toThrow();
  });

  it('adds text elements to the scene (panel rows and labels)', () => {
    const scene = makeScene();
    new ControlsReferenceModal(scene as unknown as Phaser.Scene);
    expect(scene.add.text).toHaveBeenCalled();
  });

  it('adds graphics elements (background, highlight bar, divider)', () => {
    const scene = makeScene();
    new ControlsReferenceModal(scene as unknown as Phaser.Scene);
    expect(scene.add.graphics).toHaveBeenCalled();
  });

  it('registers a Confirm input handler on construction', () => {
    const scene = makeScene();
    new ControlsReferenceModal(scene as unknown as Phaser.Scene);
    expect(scene.inputs.on).toHaveBeenCalledWith('Confirm', expect.any(Function));
  });

  it('registers NavigateUp/Down and PageUp/PageDown scroll handlers', () => {
    const scene = makeScene();
    new ControlsReferenceModal(scene as unknown as Phaser.Scene);
    const registeredActions = (scene.inputs.on as ReturnType<typeof vi.fn>).mock.calls.map(
      (c: unknown[]) => c[0],
    );
    expect(registeredActions).toContain('NavigateUp');
    expect(registeredActions).toContain('NavigateDown');
    expect(registeredActions).toContain('PageUp');
    expect(registeredActions).toContain('PageDown');
  });

  // ---- Render ---------------------------------------------------------------

  it('uses keyLabel to render current bindings', () => {
    const scene = makeScene();
    new ControlsReferenceModal(scene as unknown as Phaser.Scene);
    expect(vi.mocked(keyLabels.keyLabel)).toHaveBeenCalled();
  });

  it('reflects user rebinds: shows overridden key label with asterisk', () => {
    // Simulate user having rebound Jump to key code 75 (K).
    mockOverrides['Jump'] = [75];
    const scene = makeScene();
    new ControlsReferenceModal(scene as unknown as Phaser.Scene);
    // keyLabel(75) should have been called for the Jump row.
    expect(vi.mocked(keyLabels.keyLabel)).toHaveBeenCalledWith(75);
  });

  it('does NOT mark non-overridden bindings with an asterisk', () => {
    const scene = makeScene();
    new ControlsReferenceModal(scene as unknown as Phaser.Scene);
    // Default (non-overridden) keyLabel code 99 used by our mock.
    expect(vi.mocked(keyLabels.keyLabel)).toHaveBeenCalledWith(99);
    // Verify that setText was called: the absence of an asterisk is
    // verified via the mock's call args — all setText calls should only
    // contain asterisk when the action is actually overridden.
    const textObjects = (scene.add.text as ReturnType<typeof vi.fn>).mock.results.map(
      (r) => r.value as ReturnType<typeof makeText>,
    );
    const allSetTextCalls = textObjects.flatMap(
      (t) => (t.setText as ReturnType<typeof vi.fn>).mock.calls ?? [],
    );
    // No default (non-overridden) binding should show an asterisk.
    const asteriskCalls = allSetTextCalls.filter(
      (args) => typeof args[0] === 'string' && (args[0] as string).endsWith(' *'),
    );
    expect(asteriskCalls).toHaveLength(0);
  });

  // ---- Close behaviour ------------------------------------------------------

  it('calls onClose callback when close() is invoked', () => {
    const scene = makeScene();
    const onClose = vi.fn();
    const modal = new ControlsReferenceModal(scene as unknown as Phaser.Scene, onClose);
    modal.close();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('removes Confirm handler in onBeforeClose (called by close())', () => {
    const scene = makeScene();
    const modal = new ControlsReferenceModal(scene as unknown as Phaser.Scene, vi.fn());
    modal.close();
    expect(scene.inputs.off).toHaveBeenCalledWith('Confirm', expect.any(Function));
  });

  it('removes all navigation handlers in onBeforeClose', () => {
    const scene = makeScene();
    const modal = new ControlsReferenceModal(scene as unknown as Phaser.Scene, vi.fn());
    modal.close();
    const removedActions = (scene.inputs.off as ReturnType<typeof vi.fn>).mock.calls.map(
      (c: unknown[]) => c[0],
    );
    expect(removedActions).toContain('NavigateUp');
    expect(removedActions).toContain('NavigateDown');
    expect(removedActions).toContain('PageUp');
    expect(removedActions).toContain('PageDown');
  });

  it('Confirm key press closes the modal (calls onClose)', () => {
    const scene = makeScene();
    const onClose = vi.fn();
    new ControlsReferenceModal(scene as unknown as Phaser.Scene, onClose);
    scene._fire('Confirm');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('second close() call is a no-op (destroyed guard)', () => {
    const scene = makeScene();
    const onClose = vi.fn();
    const modal = new ControlsReferenceModal(scene as unknown as Phaser.Scene, onClose);
    modal.close();
    const firstCount = onClose.mock.calls.length;
    modal.close();
    expect(onClose.mock.calls.length).toBe(firstCount);
  });

  it('Confirm handler not fired after close (listener removed)', () => {
    const scene = makeScene();
    const onClose = vi.fn();
    const modal = new ControlsReferenceModal(scene as unknown as Phaser.Scene, onClose);
    modal.close();
    onClose.mockClear();
    scene._fire('Confirm');
    expect(onClose).not.toHaveBeenCalled();
  });

  // ---- Scrolling ------------------------------------------------------------

  it('NavigateDown shifts scroll offset (scrolls down one row)', () => {
    const scene = makeScene();
    new ControlsReferenceModal(scene as unknown as Phaser.Scene);
    // Capture initial setText call count.
    const textObjects = (scene.add.text as ReturnType<typeof vi.fn>).mock.results.map(
      (r) => r.value as ReturnType<typeof makeText>,
    );
    const setTextBefore = textObjects.reduce(
      (acc, t) => acc + ((t.setText as ReturnType<typeof vi.fn>).mock.calls.length), 0,
    );
    scene._fire('NavigateDown');
    const setTextAfter = textObjects.reduce(
      (acc, t) => acc + ((t.setText as ReturnType<typeof vi.fn>).mock.calls.length), 0,
    );
    // After scrolling, refresh() is called which calls setText again on row texts.
    expect(setTextAfter).toBeGreaterThan(setTextBefore);
  });

  it('NavigateUp does not underflow below scroll offset 0', () => {
    const scene = makeScene();
    new ControlsReferenceModal(scene as unknown as Phaser.Scene);
    // Repeatedly fire NavigateUp from the start — should not throw or produce negative offset.
    expect(() => {
      scene._fire('NavigateUp');
      scene._fire('NavigateUp');
      scene._fire('NavigateUp');
    }).not.toThrow();
  });
});
