import { beforeEach, describe, expect, it, vi } from 'vitest';
import type * as Phaser from 'phaser';

vi.mock('phaser', () => {
  const Phaser = {};
  return { ...Phaser, default: Phaser };
});

// Stub ModalBase so BombDisarmDialog can be constructed without a real Phaser scene.
vi.mock('./ModalBase', () => ({
  ModalBase: class ModalBase {
    protected readonly scene: unknown;
    protected readonly container: { add: ReturnType<typeof vi.fn>; setDepth: ReturnType<typeof vi.fn>; setScrollFactor: ReturnType<typeof vi.fn>; setAlpha: ReturnType<typeof vi.fn> };
    private onBeforeCloseCb?: () => void;
    private onAfterCloseCb?: () => void;

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

// Stub settingsStore so tests can control reducedMotion.
const mockReducedMotion = { value: false };
vi.mock('../systems/SettingsStore', () => ({
  settingsStore: {
    read: () => ({ reducedMotion: mockReducedMotion.value }),
  },
}));

function makeText() {
  const t: Record<string, ReturnType<typeof vi.fn> | string> = { text: '' };
  for (const name of ['setOrigin', 'setScrollFactor', 'setDepth', 'setVisible', 'setColor', 'setText', 'setInteractive', 'on', 'destroy']) {
    t[name] = vi.fn().mockReturnThis();
  }
  t['setText'] = vi.fn((s: string) => { t['text'] = s; return t; });
  return t;
}

function makeGraphics() {
  const g: Record<string, ReturnType<typeof vi.fn>> = {};
  for (const name of ['clear', 'fillStyle', 'fillRect', 'fillRoundedRect', 'lineStyle', 'strokeRect', 'strokeRoundedRect', 'setScrollFactor', 'setDepth', 'destroy']) {
    g[name] = vi.fn().mockReturnThis();
  }
  return g;
}

function makeRectangle() {
  const r: Record<string, ReturnType<typeof vi.fn>> = {};
  for (const name of ['setScrollFactor', 'setDepth', 'setInteractive', 'destroy', 'setAlpha']) {
    r[name] = vi.fn().mockReturnThis();
  }
  return r;
}

function makeTweenResult() {
  return { stop: vi.fn(), complete: vi.fn() };
}

type InputHandler = (() => void);

function makeScene() {
  const inputHandlers: Map<string, InputHandler[]> = new Map();
  const timerCallbacks: Array<{ delay: number; repeat: number; callback: () => void; event: { remove: ReturnType<typeof vi.fn> } }> = [];
  const tweenResults: ReturnType<typeof makeTweenResult>[] = [];

  const scene = {
    add: {
      graphics: vi.fn(() => makeGraphics()),
      text: vi.fn(() => makeText()),
      rectangle: vi.fn(() => makeRectangle()),
      container: vi.fn((_x: number, _y: number, _items?: unknown[]) => ({
        add: vi.fn(),
        setDepth: vi.fn().mockReturnThis(),
        setScrollFactor: vi.fn().mockReturnThis(),
        setAlpha: vi.fn().mockReturnThis(),
        destroy: vi.fn(),
      })),
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
    tweens: {
      add: vi.fn((_cfg: Record<string, unknown>) => {
        const result = makeTweenResult();
        tweenResults.push(result);
        // Immediately invoke onComplete if present (for tests that need it)
        return result;
      }),
    },
    time: {
      addEvent: vi.fn((cfg: { delay: number; repeat: number; callback: () => void }) => {
        const event = { remove: vi.fn() };
        timerCallbacks.push({ ...cfg, event });
        return event;
      }),
    },
    // Test helpers
    _fire: (action: string) => {
      for (const h of inputHandlers.get(action) ?? []) h();
    },
    _tickTimer: (times = 1) => {
      const cb = timerCallbacks[timerCallbacks.length - 1];
      if (!cb) return;
      for (let i = 0; i < times; i++) cb.callback();
    },
    _triggerTweenComplete: (tweenIdx = 0) => {
      const t = tweenResults[tweenIdx];
      if (!t) return;
      // Invoke the onComplete from the most recent tweens.add call
      const calls = (scene.tweens.add as ReturnType<typeof vi.fn>).mock.calls;
      const cfg = calls[tweenIdx]?.[0] as Record<string, unknown> | undefined;
      if (cfg?.['onComplete']) (cfg['onComplete'] as () => void)();
    },
  };

  return scene;
}

// Must be imported after mocks are established.
import { BombDisarmDialog } from './BombDisarmDialog';

describe('BombDisarmDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockReducedMotion.value = false;
  });

  it('constructs without throwing', () => {
    const scene = makeScene();
    expect(() => {
      new BombDisarmDialog(scene as unknown as Phaser.Scene, {
        onSuccess: vi.fn(),
        onFailure: vi.fn(),
      });
    }).not.toThrow();
  });

  it('registers NavigateLeft, NavigateRight, Confirm, QuickAnswer1/2/3 handlers', () => {
    const scene = makeScene();
    new BombDisarmDialog(scene as unknown as Phaser.Scene, {
      onSuccess: vi.fn(),
      onFailure: vi.fn(),
    });

    expect(scene.inputs.on).toHaveBeenCalledWith('NavigateLeft', expect.any(Function));
    expect(scene.inputs.on).toHaveBeenCalledWith('NavigateRight', expect.any(Function));
    expect(scene.inputs.on).toHaveBeenCalledWith('Confirm', expect.any(Function));
    expect(scene.inputs.on).toHaveBeenCalledWith('QuickAnswer1', expect.any(Function));
    expect(scene.inputs.on).toHaveBeenCalledWith('QuickAnswer2', expect.any(Function));
    expect(scene.inputs.on).toHaveBeenCalledWith('QuickAnswer3', expect.any(Function));
  });

  it('starts a countdown timer', () => {
    const scene = makeScene();
    new BombDisarmDialog(scene as unknown as Phaser.Scene, {
      onSuccess: vi.fn(),
      onFailure: vi.fn(),
    });

    expect(scene.time.addEvent).toHaveBeenCalledWith(expect.objectContaining({
      delay: 250,
      callback: expect.any(Function),
    }));
  });

  it('cutting wires in the correct order calls onSuccess (reduced-motion path)', () => {
    mockReducedMotion.value = true;
    const onSuccess = vi.fn();
    const onFailure = vi.fn();
    const scene = makeScene();
    const dialog = new BombDisarmDialog(scene as unknown as Phaser.Scene, { onSuccess, onFailure });

    // Access the internal correctOrder to simulate the correct sequence.
    const { correctOrder } = dialog as unknown as { correctOrder: number[] };

    for (const wireIdx of correctOrder) {
      // Navigate to the wire (may require left/right presses)
      const { cursorIdx } = dialog as unknown as { cursorIdx: number };
      const diff = wireIdx - cursorIdx;
      const action = diff > 0 ? 'NavigateRight' : 'NavigateLeft';
      for (let i = 0; i < Math.abs(diff); i++) scene._fire(action);
      scene._fire('Confirm');
    }

    expect(onSuccess).toHaveBeenCalledTimes(1);
    expect(onFailure).not.toHaveBeenCalled();
  });

  it('cutting a wrong wire calls onFailure (reduced-motion path)', () => {
    mockReducedMotion.value = true;
    const onSuccess = vi.fn();
    const onFailure = vi.fn();
    const scene = makeScene();
    const dialog = new BombDisarmDialog(scene as unknown as Phaser.Scene, { onSuccess, onFailure });

    // Find a wire that is NOT the first correct step.
    const { correctOrder } = dialog as unknown as { correctOrder: number[] };
    const firstCorrect = correctOrder[0]!;
    const wrongWire = (firstCorrect + 1) % 3;

    // Navigate to the wrong wire.
    const { cursorIdx } = dialog as unknown as { cursorIdx: number };
    const diff = wrongWire - cursorIdx;
    const action = diff > 0 ? 'NavigateRight' : 'NavigateLeft';
    for (let i = 0; i < Math.abs(diff); i++) scene._fire(action);
    scene._fire('Confirm');

    expect(onFailure).toHaveBeenCalledTimes(1);
    expect(onSuccess).not.toHaveBeenCalled();
  });

  it('QuickAnswer shortcuts cut the corresponding wire', () => {
    mockReducedMotion.value = true;
    const onSuccess = vi.fn();
    const onFailure = vi.fn();
    const scene = makeScene();
    const dialog = new BombDisarmDialog(scene as unknown as Phaser.Scene, { onSuccess, onFailure });

    const { correctOrder } = dialog as unknown as { correctOrder: number[] };
    const actions: Record<number, string> = { 0: 'QuickAnswer1', 1: 'QuickAnswer2', 2: 'QuickAnswer3' };

    for (const wireIdx of correctOrder) {
      scene._fire(actions[wireIdx]!);
    }

    expect(onSuccess).toHaveBeenCalledTimes(1);
    expect(onFailure).not.toHaveBeenCalled();
  });

  it('timer expiry calls onFailure', () => {
    mockReducedMotion.value = true;
    const onSuccess = vi.fn();
    const onFailure = vi.fn();
    const scene = makeScene();
    new BombDisarmDialog(scene as unknown as Phaser.Scene, { onSuccess, onFailure, timeLimit: 2 });
    // Tick down past the timer limit (2s × 4 ticks/s = 8 ticks)
    scene._tickTimer(9);

    expect(onFailure).toHaveBeenCalledTimes(1);
    expect(onSuccess).not.toHaveBeenCalled();
  });

  it('NavigateLeft/Right wrap around correctly', () => {
    const scene = makeScene();
    const dialog = new BombDisarmDialog(scene as unknown as Phaser.Scene, {
      onSuccess: vi.fn(),
      onFailure: vi.fn(),
    });

    const d = dialog as unknown as { cursorIdx: number };
    const startIdx = d.cursorIdx;

    // Move left three times — should wrap back to start
    scene._fire('NavigateLeft');
    scene._fire('NavigateLeft');
    scene._fire('NavigateLeft');
    expect(d.cursorIdx).toBe(startIdx);
  });

  it('deregisters all input handlers when closed', () => {
    const scene = makeScene();
    const dialog = new BombDisarmDialog(scene as unknown as Phaser.Scene, {
      onSuccess: vi.fn(),
      onFailure: vi.fn(),
    });

    dialog.close();

    expect(scene.inputs.off).toHaveBeenCalledWith('NavigateLeft', expect.any(Function));
    expect(scene.inputs.off).toHaveBeenCalledWith('NavigateRight', expect.any(Function));
    expect(scene.inputs.off).toHaveBeenCalledWith('Confirm', expect.any(Function));
    expect(scene.inputs.off).toHaveBeenCalledWith('QuickAnswer1', expect.any(Function));
    expect(scene.inputs.off).toHaveBeenCalledWith('QuickAnswer2', expect.any(Function));
    expect(scene.inputs.off).toHaveBeenCalledWith('QuickAnswer3', expect.any(Function));
  });
});
