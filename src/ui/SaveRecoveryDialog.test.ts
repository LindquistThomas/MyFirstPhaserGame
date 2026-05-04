/**
 * Unit tests for SaveRecoveryDialog.
 *
 * ModalBase is stubbed so the dialog can be constructed without a running
 * Phaser scene. SaveManager helpers (clearRecoveredSlot, getCorruptBackup)
 * are mocked to isolate dialog behaviour from storage state.
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
    };

    private destroyed = false;

    constructor(scene: unknown) {
      this.scene = scene;
      this.container = { add: vi.fn() };
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
// Stub SaveManager helpers
// ---------------------------------------------------------------------------
const mockClearRecoveredSlot = vi.fn();
const mockGetCorruptBackup = vi.fn((_id: string): string | null => null);

vi.mock('../systems/SaveManager', () => ({
  SAVE_SLOTS: ['slot1', 'slot2', 'slot3'],
  clearRecoveredSlot: (id: string) => mockClearRecoveredSlot(id),
  getCorruptBackup: (id: string) => mockGetCorruptBackup(id),
}));

// ---------------------------------------------------------------------------
// Scene stub helpers
// ---------------------------------------------------------------------------

function makeText() {
  const t: Record<string, ReturnType<typeof vi.fn>> = {};
  for (const name of ['setOrigin', 'setScrollFactor', 'setInteractive', 'setColor', 'on']) {
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
  const onceHandlers:  Map<string, EventHandler[]> = new Map();

  return {
    add: {
      graphics: vi.fn(() => makeGraphics()),
      text: vi.fn(() => makeText()),
    },
    inputs: {
      on:  vi.fn((action: string, handler: InputHandler) => {
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
// Import after mocks
// ---------------------------------------------------------------------------
import { SaveRecoveryDialog } from './SaveRecoveryDialog';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('SaveRecoveryDialog', () => {
  beforeEach(() => {
    mockClearRecoveredSlot.mockClear();
    mockGetCorruptBackup.mockReturnValue(null);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('constructs without throwing', () => {
    const scene = makeScene();
    expect(() => new SaveRecoveryDialog(
      scene as unknown as Phaser.Scene,
      'slot1',
      'parse',
    )).not.toThrow();
  });

  it('registers a Confirm input handler on construction', () => {
    const scene = makeScene();
    new SaveRecoveryDialog(scene as unknown as Phaser.Scene, 'slot1', 'parse');
    expect(scene.inputs.on).toHaveBeenCalledWith('Confirm', expect.any(Function));
  });

  it('calls clearRecoveredSlot with the slot id on close', () => {
    const scene = makeScene();
    const dialog = new SaveRecoveryDialog(scene as unknown as Phaser.Scene, 'slot2', 'parse');
    dialog.close();
    expect(mockClearRecoveredSlot).toHaveBeenCalledWith('slot2');
  });

  it('calls onDismiss callback on close', () => {
    const scene = makeScene();
    const onDismiss = vi.fn();
    const dialog = new SaveRecoveryDialog(scene as unknown as Phaser.Scene, 'slot1', 'parse', onDismiss);
    dialog.close();
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('does not call onDismiss a second time after double close (destroyed guard)', () => {
    const scene = makeScene();
    const onDismiss = vi.fn();
    const dialog = new SaveRecoveryDialog(scene as unknown as Phaser.Scene, 'slot1', 'parse', onDismiss);
    dialog.close();
    dialog.close();
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('removes the Confirm handler in onBeforeClose', () => {
    const scene = makeScene();
    const dialog = new SaveRecoveryDialog(scene as unknown as Phaser.Scene, 'slot1', 'parse');
    dialog.close();
    expect(scene.inputs.off).toHaveBeenCalledWith('Confirm', expect.any(Function));
  });

  it('Confirm key press triggers close and calls onDismiss', () => {
    const scene = makeScene();
    const onDismiss = vi.fn();
    new SaveRecoveryDialog(scene as unknown as Phaser.Scene, 'slot1', 'parse', onDismiss);
    scene._fire('Confirm');
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('adds text and graphics to the container', () => {
    const scene = makeScene();
    new SaveRecoveryDialog(scene as unknown as Phaser.Scene, 'slot1', 'parse');
    expect(scene.add.text).toHaveBeenCalled();
    expect(scene.add.graphics).toHaveBeenCalled();
  });

  it('shows slot number in a title text element', () => {
    const scene = makeScene();
    new SaveRecoveryDialog(scene as unknown as Phaser.Scene, 'slot2', 'parse');
    const allTextArgs = (scene.add.text as ReturnType<typeof vi.fn>).mock.calls.map((c) => c[2] as string);
    expect(allTextArgs.some((t) => t.includes('Slot 2'))).toBe(true);
  });

  it('renders download button when corrupt data is available', () => {
    mockGetCorruptBackup.mockReturnValue('{"raw":"corrupt"}');
    const scene = makeScene();
    new SaveRecoveryDialog(scene as unknown as Phaser.Scene, 'slot1', 'parse');
    const allTextArgs = (scene.add.text as ReturnType<typeof vi.fn>).mock.calls.map((c) => c[2] as string);
    expect(allTextArgs.some((t) => t.includes('Download Backup'))).toBe(true);
  });

  it('does NOT render download button when no corrupt data exists', () => {
    mockGetCorruptBackup.mockReturnValue(null);
    const scene = makeScene();
    new SaveRecoveryDialog(scene as unknown as Phaser.Scene, 'slot1', 'parse');
    const allTextArgs = (scene.add.text as ReturnType<typeof vi.fn>).mock.calls.map((c) => c[2] as string);
    expect(allTextArgs.some((t) => t.includes('Download Backup'))).toBe(false);
  });

  it('maps parse reason to a human-readable string', () => {
    const scene = makeScene();
    new SaveRecoveryDialog(scene as unknown as Phaser.Scene, 'slot1', 'parse');
    const allTextArgs = (scene.add.text as ReturnType<typeof vi.fn>).mock.calls.map((c) => c[2] as string);
    expect(allTextArgs.some((t) => t.includes('corrupt'))).toBe(true);
  });

  it('maps unknown reason to fallback text', () => {
    const scene = makeScene();
    new SaveRecoveryDialog(scene as unknown as Phaser.Scene, 'slot1', 'unknown');
    const allTextArgs = (scene.add.text as ReturnType<typeof vi.fn>).mock.calls.map((c) => c[2] as string);
    expect(allTextArgs.some((t) => t.includes('unexpected error'))).toBe(true);
  });

  it('clearRecoveredSlot is not called before close', () => {
    const scene = makeScene();
    new SaveRecoveryDialog(scene as unknown as Phaser.Scene, 'slot1', 'parse');
    expect(mockClearRecoveredSlot).not.toHaveBeenCalled();
  });
});
