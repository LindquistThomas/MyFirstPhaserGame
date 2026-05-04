/**
 * Unit tests for SaveRecoveryDialog.
 *
 * ModalBase and ModalKeyboardNavigator are stubbed so the dialog can be
 * constructed without a running Phaser scene. SaveManager helpers
 * (clearRecoveredSlot, getCorruptBackup) are mocked to isolate dialog
 * behaviour from storage state.
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
// Stub ModalKeyboardNavigator + makeTextFocusable
// ---------------------------------------------------------------------------
vi.mock('./ModalKeyboardNavigator', () => {
  class MockModalKeyboardNavigator {
    private _scene: Record<string, unknown>;
    private focusables: Array<{ focus(): void; blur(): void; activate(): void }> = [];
    private focusIndex = -1;
    private handlers: Array<{ action: string; handler: () => void }> = [];

    constructor(scene: Record<string, unknown>) { this._scene = scene; }

    add(f: { focus(): void; blur(): void; activate(): void }): number {
      this.focusables.push(f); return this.focusables.length - 1;
    }
    size(): number { return this.focusables.length; }
    currentIndex(): number { return this.focusIndex; }

    setFocus(index: number): void {
      if (index < 0 || index >= this.focusables.length) return;
      if (this.focusIndex >= 0) this.focusables[this.focusIndex]!.blur();
      this.focusIndex = index;
      this.focusables[index]!.focus();
    }

    focusPrev(): void {
      if (this.focusables.length === 0) return;
      const next = this.focusIndex < 0
        ? this.focusables.length - 1
        : (this.focusIndex - 1 + this.focusables.length) % this.focusables.length;
      this.setFocus(next);
    }
    focusNext(): void {
      if (this.focusables.length === 0) return;
      this.setFocus((this.focusIndex + 1) % this.focusables.length);
    }
    activateFocused(): void { this.focusables[this.focusIndex]?.activate(); }

    bind(action: string, handler: () => void): void {
      (this._scene.inputs as { on(a: string, h: () => void): void }).on(action, handler);
      this.handlers.push({ action, handler });
    }

    destroy(): void {
      for (const { action, handler } of this.handlers) {
        (this._scene.inputs as { off(a: string, h: () => void): void }).off(action, handler);
      }
      this.handlers = [];
    }
  }

  return {
    ModalKeyboardNavigator: MockModalKeyboardNavigator,
    makeTextFocusable: (
      text: { setColor(c: string): void; emit(e: string): void },
      normalColor: string,
      focusColor: string,
    ) => ({
      focus: () => text.setColor(focusColor),
      blur:  () => text.setColor(normalColor),
      activate: () => text.emit('pointerdown'),
      bounds: () => ({ x: 0, y: 0, width: 100, height: 30 }),
    }),
  };
});

// ---------------------------------------------------------------------------
// Stub SaveManager helpers
// ---------------------------------------------------------------------------
const mockClearRecoveredSlot = vi.fn();
const mockGetCorruptBackup = vi.fn((_id: string): string | null => null);
const mockGetRecoveryReason = vi.fn((_id: string): string => 'parse');

vi.mock('../systems/SaveManager', () => ({
  SAVE_SLOTS: ['slot1', 'slot2', 'slot3'],
  clearRecoveredSlot: (id: string) => mockClearRecoveredSlot(id),
  getCorruptBackup: (id: string) => mockGetCorruptBackup(id),
  getRecoveryReason: (id: string) => mockGetRecoveryReason(id),
}));

// ---------------------------------------------------------------------------
// Scene stub helpers
// ---------------------------------------------------------------------------

function makeText() {
  // Track registered event handlers so emit() can fire them.
  const eventHandlers: Map<string, Array<() => void>> = new Map();

  const t: Record<string, ReturnType<typeof vi.fn>> = {};
  for (const name of [
    'setOrigin', 'setScrollFactor', 'setInteractive', 'setColor',
    'setDepth', 'setVisible', 'setPosition', 'destroy',
  ]) {
    t[name] = vi.fn().mockReturnThis();
  }

  // getBounds returns a usable rect for ModalKeyboardNavigator arrow placement.
  t['getBounds'] = vi.fn(() => ({ x: 0, y: 0, width: 100, height: 30 }));

  // on() stores handlers AND is tracked as a vi.fn for assertions.
  t['on'] = vi.fn((event: string, handler: () => void) => {
    if (!eventHandlers.has(event)) eventHandlers.set(event, []);
    eventHandlers.get(event)!.push(handler);
    return t;
  }) as ReturnType<typeof vi.fn>;

  // emit() fires all stored handlers for the given event.
  t['emit'] = vi.fn((event: string) => {
    for (const h of eventHandlers.get(event) ?? []) h();
    return t;
  }) as ReturnType<typeof vi.fn>;

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
    mockGetRecoveryReason.mockReturnValue('parse');
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

  it('registers a Confirm input handler on construction (via nav.bind)', () => {
    const scene = makeScene();
    new SaveRecoveryDialog(scene as unknown as Phaser.Scene, 'slot1', 'parse');
    expect(scene.inputs.on).toHaveBeenCalledWith('Confirm', expect.any(Function));
  });

  it('registers NavigateLeft and NavigateRight handlers on construction', () => {
    const scene = makeScene();
    new SaveRecoveryDialog(scene as unknown as Phaser.Scene, 'slot1', 'parse');
    expect(scene.inputs.on).toHaveBeenCalledWith('NavigateLeft', expect.any(Function));
    expect(scene.inputs.on).toHaveBeenCalledWith('NavigateRight', expect.any(Function));
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

  it('unregisters all nav handlers (including Confirm) on close via nav.destroy()', () => {
    const scene = makeScene();
    const dialog = new SaveRecoveryDialog(scene as unknown as Phaser.Scene, 'slot1', 'parse');
    dialog.close();
    // nav.destroy() deregisters each bound action including Confirm
    expect(scene.inputs.off).toHaveBeenCalledWith('Confirm', expect.any(Function));
  });

  it('Confirm key press activates focused button (OK) and calls onDismiss', () => {
    const scene = makeScene();
    const onDismiss = vi.fn();
    new SaveRecoveryDialog(scene as unknown as Phaser.Scene, 'slot1', 'parse', onDismiss);
    // Confirm activates nav.activateFocused() → okBtn.emit('pointerdown') → close()
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

  it('triggerDownload creates an anchor element, sets href and download, and clicks it', () => {
    const corruptData = '{"raw":"corrupt","version":99}';
    mockGetCorruptBackup.mockReturnValue(corruptData);

    // Stub URL and document APIs
    const fakeUrl = 'blob:fake-url';
    const createObjectURLSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue(fakeUrl);
    const revokeObjectURLSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});

    const clickSpy = vi.fn();
    const fakeAnchor = { href: '', download: '', click: clickSpy };
    const createElementSpy = vi.spyOn(document, 'createElement').mockReturnValue(
      fakeAnchor as unknown as HTMLElement,
    );
    const appendChildSpy = vi.spyOn(document.body, 'appendChild').mockReturnValue(
      fakeAnchor as unknown as HTMLElement,
    );
    // Simulate the anchor being in the DOM so removeChild is called
    vi.spyOn(document.body, 'contains').mockReturnValue(true);
    const removeChildSpy = vi.spyOn(document.body, 'removeChild').mockReturnValue(
      fakeAnchor as unknown as HTMLElement,
    );

    const scene = makeScene();
    new SaveRecoveryDialog(scene as unknown as Phaser.Scene, 'slot1', 'parse');

    // Find the Download Backup button and fire its pointerdown via the registered handler
    const allCalls = (scene.add.text as ReturnType<typeof vi.fn>).mock.calls;
    const dlBtnCallIdx = allCalls.findIndex((c) => (c[2] as string).includes('Download Backup'));
    expect(dlBtnCallIdx).toBeGreaterThanOrEqual(0);

    const dlTextMock = (scene.add.text as ReturnType<typeof vi.fn>).mock.results[dlBtnCallIdx]?.value as ReturnType<typeof makeText>;
    const onCalls = (dlTextMock.on as ReturnType<typeof vi.fn>).mock.calls as [string, () => void][];
    const pdHandler = onCalls.find((c) => c[0] === 'pointerdown')?.[1];
    expect(pdHandler).toBeDefined();
    pdHandler?.();

    expect(createObjectURLSpy).toHaveBeenCalledOnce();
    expect(createElementSpy).toHaveBeenCalledWith('a');
    expect(fakeAnchor.href).toBe(fakeUrl);
    expect(fakeAnchor.download).toMatch(/^architect-recovered-slot1-\d{8}\.json$/);
    expect(appendChildSpy).toHaveBeenCalledWith(fakeAnchor);
    expect(clickSpy).toHaveBeenCalledOnce();
    expect(removeChildSpy).toHaveBeenCalledWith(fakeAnchor);
    // URL must always be revoked (try/finally)
    expect(revokeObjectURLSpy).toHaveBeenCalledWith(fakeUrl);

    // Restore spies
    createObjectURLSpy.mockRestore();
    revokeObjectURLSpy.mockRestore();
    createElementSpy.mockRestore();
    appendChildSpy.mockRestore();
    removeChildSpy.mockRestore();
    vi.restoreAllMocks();
  });

  it('revokeObjectURL is called even when removeChild throws (try/finally)', () => {
    const corruptData = '{"v":1}';
    mockGetCorruptBackup.mockReturnValue(corruptData);

    const fakeUrl = 'blob:fake-url';
    const createObjectURLSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue(fakeUrl);
    const revokeObjectURLSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});

    const fakeAnchor = { href: '', download: '', click: vi.fn() };
    vi.spyOn(document, 'createElement').mockReturnValue(fakeAnchor as unknown as HTMLElement);
    vi.spyOn(document.body, 'appendChild').mockReturnValue(fakeAnchor as unknown as HTMLElement);
    vi.spyOn(document.body, 'contains').mockReturnValue(true);
    vi.spyOn(document.body, 'removeChild').mockImplementation(() => {
      throw new Error('removeChild failed');
    });

    const scene = makeScene();
    new SaveRecoveryDialog(scene as unknown as Phaser.Scene, 'slot1', 'parse');

    const allCalls = (scene.add.text as ReturnType<typeof vi.fn>).mock.calls;
    const dlBtnCallIdx = allCalls.findIndex((c) => (c[2] as string).includes('Download Backup'));
    const dlTextMock = (scene.add.text as ReturnType<typeof vi.fn>).mock.results[dlBtnCallIdx]?.value as ReturnType<typeof makeText>;
    const onCalls = (dlTextMock.on as ReturnType<typeof vi.fn>).mock.calls as [string, () => void][];
    const pdHandler = onCalls.find((c) => c[0] === 'pointerdown')?.[1];

    // removeChild throws inside the try block — URL should still be revoked by finally
    expect(() => pdHandler?.()).not.toThrow();
    expect(revokeObjectURLSpy).toHaveBeenCalledWith(fakeUrl);

    vi.restoreAllMocks();
    createObjectURLSpy.mockRestore();
    revokeObjectURLSpy.mockRestore();
  });

  it('maps quota reason to a human-readable string about storage being full', () => {
    const scene = makeScene();
    new SaveRecoveryDialog(scene as unknown as Phaser.Scene, 'slot1', 'quota');
    const allTextArgs = (scene.add.text as ReturnType<typeof vi.fn>).mock.calls.map((c) => c[2] as string);
    expect(allTextArgs.some((t) => t.includes('storage was full'))).toBe(true);
  });

  it('maps unavailable reason to a human-readable string about browser storage', () => {
    const scene = makeScene();
    new SaveRecoveryDialog(scene as unknown as Phaser.Scene, 'slot1', 'unavailable');
    const allTextArgs = (scene.add.text as ReturnType<typeof vi.fn>).mock.calls.map((c) => c[2] as string);
    expect(allTextArgs.some((t) => t.includes('not available'))).toBe(true);
  });

  it('silently swallows errors if URL.createObjectURL throws during download', () => {
    mockGetCorruptBackup.mockReturnValue('{"data":true}');

    const createObjectURLSpy = vi.spyOn(URL, 'createObjectURL').mockImplementation(() => {
      throw new Error('Not supported in this context');
    });
    const revokeObjectURLSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});

    const scene = makeScene();
    new SaveRecoveryDialog(scene as unknown as Phaser.Scene, 'slot1', 'parse');

    const allCalls = (scene.add.text as ReturnType<typeof vi.fn>).mock.calls;
    const dlBtnCallIdx = allCalls.findIndex((c) => (c[2] as string).includes('Download Backup'));
    expect(dlBtnCallIdx).toBeGreaterThanOrEqual(0);

    const dlTextMock = (scene.add.text as ReturnType<typeof vi.fn>).mock.results[dlBtnCallIdx]?.value as ReturnType<typeof makeText>;
    const onCalls = (dlTextMock.on as ReturnType<typeof vi.fn>).mock.calls as [string, () => void][];
    const pdHandler = onCalls.find((c) => c[0] === 'pointerdown')?.[1];
    // createObjectURL throws → caught; URL is null so revokeObjectURL is NOT called
    expect(() => pdHandler?.()).not.toThrow();
    expect(revokeObjectURLSpy).not.toHaveBeenCalled();

    createObjectURLSpy.mockRestore();
    revokeObjectURLSpy.mockRestore();
  });

  it('NavigateRight switches focus from OK to Download Backup (when both exist)', () => {
    mockGetCorruptBackup.mockReturnValue('{"v":1}');
    const scene = makeScene();
    const onDismiss = vi.fn();
    new SaveRecoveryDialog(scene as unknown as Phaser.Scene, 'slot1', 'parse', onDismiss);

    // Default focus is on OK (last button). NavigateRight wraps to Download Backup (first).
    // Then Confirm activates Download Backup's pointerdown (which triggers download, not close).
    // We just verify Confirm after navigate does NOT call onDismiss (focus is on dl button).
    const revokeObjectURLSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:x');
    vi.spyOn(document, 'createElement').mockReturnValue({ href: '', download: '', click: vi.fn() } as unknown as HTMLElement);
    vi.spyOn(document.body, 'appendChild').mockReturnValue({} as unknown as HTMLElement);
    vi.spyOn(document.body, 'contains').mockReturnValue(true);
    vi.spyOn(document.body, 'removeChild').mockReturnValue({} as unknown as HTMLElement);

    scene._fire('NavigateRight'); // moves focus: OK → Download Backup
    scene._fire('Confirm');       // activates Download Backup → triggers download (not close)

    expect(onDismiss).not.toHaveBeenCalled(); // focus was on Download, not OK
    vi.restoreAllMocks();
    revokeObjectURLSpy.mockRestore();
  });
});
