import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock Phaser with just the runtime surface our input module uses.
// Vitest resolves "phaser" to its uncompiled src which has unresolvable
// require()s (phaser3spectorjs, etc.), so we substitute a stub here.
vi.mock('phaser', () => {
  const KeyCodes = {
    LEFT: 37, UP: 38, RIGHT: 39, DOWN: 40,
    SPACE: 32, ENTER: 13, ESC: 27,
    PAGE_UP: 33, PAGE_DOWN: 34,
    A: 65, B: 66, C: 67, D: 68, I: 73, S: 83, W: 87,
    ONE: 49, TWO: 50, THREE: 51, FOUR: 52,
    F12: 123,
  };
  class ScenePlugin {
    scene: unknown;
    systems: unknown;
    game: unknown;
    pluginKey: string;
    constructor(scene: { sys?: { events?: { once?: (e: string, fn: () => void) => void } } }, pluginManager: { game?: unknown }, pluginKey: string) {
      this.scene = scene;
      this.systems = scene?.sys;
      this.game = pluginManager?.game;
      this.pluginKey = pluginKey;
      scene?.sys?.events?.once?.('boot', () => (this as unknown as { boot?: () => void }).boot?.());
    }
  }
  const phaser = { Input: { Keyboard: { KeyCodes } }, Plugins: { ScenePlugin } };
  return { ...phaser, default: phaser };
});

import * as Phaser from 'phaser';
import {
  InputService,
  activeContext,
  pushContext,
  popContext,
  _resetContextStack,
  setVirtualButton,
  _resetVirtualButtons,
} from './InputService';

const K = Phaser.Input.Keyboard.KeyCodes;

interface FakeKey {
  isDown: boolean;
  destroy: ReturnType<typeof vi.fn>;
}

interface FakeEvents {
  handlers: Record<string, Array<{ fn: (...args: unknown[]) => void; ctx?: unknown }>>;
  on: (ev: string, fn: (...args: unknown[]) => void, ctx?: unknown) => void;
  once: (ev: string, fn: (...args: unknown[]) => void, ctx?: unknown) => void;
  off: (ev: string, fn: (...args: unknown[]) => void, ctx?: unknown) => void;
  emit: (ev: string, ...args: unknown[]) => void;
}

function makeFakeEvents(): FakeEvents {
  const handlers: FakeEvents['handlers'] = {};
  return {
    handlers,
    on(ev, fn, ctx) { (handlers[ev] ??= []).push({ fn, ctx }); },
    once(ev, fn, ctx) { (handlers[ev] ??= []).push({ fn, ctx }); },
    off(ev, fn) {
      const list = handlers[ev];
      if (!list) return;
      const i = list.findIndex((h) => h.fn === fn);
      if (i >= 0) list.splice(i, 1);
    },
    emit(ev, ...args) {
      const list = handlers[ev]?.slice();
      if (!list) return;
      for (const h of list) h.fn.apply(h.ctx, args);
    },
  };
}

interface Harness {
  svc: InputService;
  keys: Map<number, FakeKey>;
  fireKeyDown: (keyCode: number) => void;
  sceneEvents: FakeEvents;
}

function mountService(): Harness {
  const keys = new Map<number, FakeKey>();
  let keydownListener: ((ev: KeyboardEvent) => void) | undefined;

  const keyboard = {
    addKey: vi.fn((code: number) => {
      const k: FakeKey = { isDown: false, destroy: vi.fn() };
      keys.set(code, k);
      return k as unknown as Phaser.Input.Keyboard.Key;
    }),
    on: vi.fn((ev: string, fn: (e: KeyboardEvent) => void) => {
      if (ev === 'keydown') keydownListener = fn;
    }),
    off: vi.fn((ev: string, fn: (e: KeyboardEvent) => void) => {
      if (ev === 'keydown' && keydownListener === fn) keydownListener = undefined;
    }),
  };

  const sceneEvents = makeFakeEvents();
  const scene = {
    sys: { events: sceneEvents },
    input: { keyboard },
  };
  const pluginManager = { game: {} };

  const svc = new InputService(
    scene as unknown as Phaser.Scene,
    pluginManager as unknown as Phaser.Plugins.PluginManager,
    'inputs',
  );

  // Phaser's ScenePlugin constructor queues boot via systems.events.once('boot').
  // Fire it explicitly so the plugin wires up its lifecycle listeners.
  sceneEvents.emit('boot');
  // Now emit 'start' to have the plugin register keys and install the keydown handler.
  sceneEvents.emit('start');

  return {
    svc,
    keys,
    sceneEvents,
    fireKeyDown: (keyCode: number) => {
      if (!keydownListener) throw new Error('keydown listener not registered');
      keydownListener({ keyCode } as unknown as KeyboardEvent);
    },
  };
}

/** Reset the module-level context stack between tests. */
function drainContextStack(): void {
  _resetContextStack();
}

describe('InputService — axes', () => {
  let h: Harness;

  beforeEach(() => {
    drainContextStack();
    h = mountService();
  });
  afterEach(() => { drainContextStack(); });

  it('horizontal() returns -1 when a left key is held', () => {
    h.keys.get(K.LEFT)!.isDown = true;
    expect(h.svc.horizontal()).toBe(-1);
  });

  it('horizontal() returns +1 when a right key is held', () => {
    h.keys.get(K.RIGHT)!.isDown = true;
    expect(h.svc.horizontal()).toBe(1);
  });

  it('horizontal() returns 0 when no horizontal key is held', () => {
    expect(h.svc.horizontal()).toBe(0);
  });

  it('horizontal() returns 0 when both left and right are held (they cancel)', () => {
    h.keys.get(K.LEFT)!.isDown = true;
    h.keys.get(K.RIGHT)!.isDown = true;
    expect(h.svc.horizontal()).toBe(0);
  });

  it('horizontal() honours the WASD rebinding (A/D)', () => {
    h.keys.get(K.A)!.isDown = true;
    expect(h.svc.horizontal()).toBe(-1);
    h.keys.get(K.A)!.isDown = false;
    h.keys.get(K.D)!.isDown = true;
    expect(h.svc.horizontal()).toBe(1);
  });

  it('vertical() returns -1 when up is held, +1 when down is held, 0 when both or neither', () => {
    expect(h.svc.vertical()).toBe(0);

    h.keys.get(K.UP)!.isDown = true;
    expect(h.svc.vertical()).toBe(-1);

    h.keys.get(K.DOWN)!.isDown = true;
    expect(h.svc.vertical()).toBe(0); // cancel

    h.keys.get(K.UP)!.isDown = false;
    expect(h.svc.vertical()).toBe(1);
  });
});

describe('InputService — isDown', () => {
  let h: Harness;
  beforeEach(() => { drainContextStack(); h = mountService(); });
  afterEach(() => { drainContextStack(); });

  it('returns true while any bound key for the action is held', () => {
    expect(h.svc.isDown('Jump')).toBe(false);
    h.keys.get(K.SPACE)!.isDown = true;
    expect(h.svc.isDown('Jump')).toBe(true);
    h.keys.get(K.SPACE)!.isDown = false;
    h.keys.get(K.W)!.isDown = true; // Jump is also bound to W
    expect(h.svc.isDown('Jump')).toBe(true);
  });

  it('returns false for gameplay actions when active context is not gameplay', () => {
    h.keys.get(K.SPACE)!.isDown = true;
    expect(h.svc.isDown('Jump')).toBe(true);
    const tok = pushContext('modal');
    expect(h.svc.isDown('Jump')).toBe(false);
    popContext(tok);
    expect(h.svc.isDown('Jump')).toBe(true);
  });
});

describe('InputService — justPressed', () => {
  let h: Harness;
  beforeEach(() => { drainContextStack(); h = mountService(); });
  afterEach(() => { drainContextStack(); });

  it('returns true exactly once per key press', () => {
    h.fireKeyDown(K.SPACE);
    expect(h.svc.justPressed('Jump')).toBe(true);
    expect(h.svc.justPressed('Jump')).toBe(false); // flag consumed
  });

  it('re-arms on the next key press', () => {
    h.fireKeyDown(K.SPACE);
    expect(h.svc.justPressed('Jump')).toBe(true);
    h.fireKeyDown(K.SPACE);
    expect(h.svc.justPressed('Jump')).toBe(true);
  });

  it('fires for any key rebound to the action (Jump: Space, W)', () => {
    h.fireKeyDown(K.W);
    expect(h.svc.justPressed('Jump')).toBe(true);
    h.fireKeyDown(K.SPACE);
    expect(h.svc.justPressed('Jump')).toBe(true);
  });

  it('binds ArrowUp to ToggleInfo — and not to Jump', () => {
    h.fireKeyDown(K.UP);
    expect(h.svc.justPressed('ToggleInfo')).toBe(true);
    expect(h.svc.justPressed('Jump')).toBe(false);
  });

  it('dispatches to all actions a key is bound to (respecting context)', () => {
    // Enter → Interact (gameplay), ToggleInfo (gameplay), Confirm (menu|modal).
    // Default context is gameplay, so Confirm must NOT dispatch here.
    h.fireKeyDown(K.ENTER);
    expect(h.svc.justPressed('Interact')).toBe(true);
    expect(h.svc.justPressed('ToggleInfo')).toBe(true);
    expect(h.svc.justPressed('Confirm')).toBe(false);
  });

  it('fires Confirm but not Interact when a modal context is active', () => {
    const tok = pushContext('modal');
    h.fireKeyDown(K.ENTER);
    expect(h.svc.justPressed('Confirm')).toBe(true);
    expect(h.svc.justPressed('Interact')).toBe(false);
    expect(h.svc.justPressed('ToggleInfo')).toBe(false);
    popContext(tok);
  });

  it('fires ToggleDebug from any context (tagged ALWAYS)', () => {
    const tok = pushContext('modal');
    h.fireKeyDown(K.D);
    expect(h.svc.justPressed('ToggleDebug')).toBe(true);
    popContext(tok);
  });
});

describe('InputService — event API', () => {
  let h: Harness;
  beforeEach(() => { drainContextStack(); h = mountService(); });
  afterEach(() => { drainContextStack(); });

  it('invokes registered handlers on matching key events', () => {
    const fn = vi.fn();
    h.svc.on('Jump', fn);
    h.fireKeyDown(K.SPACE);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith('Jump');
  });

  it('stops invoking handlers after off()', () => {
    const fn = vi.fn();
    h.svc.on('Jump', fn);
    h.svc.off('Jump', fn);
    h.fireKeyDown(K.SPACE);
    expect(fn).not.toHaveBeenCalled();
  });

  it('emit() dispatches without a physical key press', () => {
    const fn = vi.fn();
    h.svc.on('Interact', fn);
    h.svc.emit('Interact');
    expect(fn).toHaveBeenCalledTimes(1);
    expect(h.svc.justPressed('Interact')).toBe(true);
  });

  it('emit() is suppressed when the context forbids the action', () => {
    const fn = vi.fn();
    h.svc.on('Jump', fn);
    const tok = pushContext('modal');
    h.svc.emit('Jump');
    popContext(tok);
    expect(fn).not.toHaveBeenCalled();
  });

  it('tolerates handlers that unsubscribe during dispatch', () => {
    const calls: string[] = [];
    const a = (): void => {
      calls.push('a');
      h.svc.off('Jump', a);
    };
    const b = (): void => { calls.push('b'); };
    h.svc.on('Jump', a);
    h.svc.on('Jump', b);
    h.fireKeyDown(K.SPACE);
    expect(calls).toEqual(['a', 'b']);
  });
});

describe('context stack', () => {
  beforeEach(() => { drainContextStack(); });
  afterEach(() => { drainContextStack(); });

  it('defaults to gameplay when empty', () => {
    expect(activeContext()).toBe('gameplay');
  });

  it('push/pop nests correctly', () => {
    const t1 = pushContext('menu');
    expect(activeContext()).toBe('menu');
    const t2 = pushContext('modal');
    expect(activeContext()).toBe('modal');
    popContext(t2);
    expect(activeContext()).toBe('menu');
    popContext(t1);
    expect(activeContext()).toBe('gameplay');
  });

  it('out-of-order pop is rejected and leaves the stack unchanged', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const outer = pushContext('menu');
      const inner = pushContext('modal');
      // inner is on top; popping outer first must be refused.
      popContext(outer);
      expect(warnSpy).toHaveBeenCalledOnce();
      expect(warnSpy.mock.calls[0]![0]).toMatch(/popContext/);
      expect(activeContext()).toBe('modal'); // stack unchanged
      // Correct tear-down order still works after the refused pop.
      popContext(inner);
      expect(activeContext()).toBe('menu');
      popContext(outer);
      expect(activeContext()).toBe('gameplay');
    } finally {
      warnSpy.mockRestore();
    }
  });

  it('popContext on an empty stack is a no-op', () => {
    expect(() => popContext({ ctx: 'menu', idx: 0 })).not.toThrow();
    expect(activeContext()).toBe('gameplay');
  });
});

describe('InputService — virtual buttons (setVirtualButton)', () => {
  let h: Harness;
  beforeEach(() => {
    drainContextStack();
    _resetVirtualButtons();
    h = mountService();
  });
  afterEach(() => {
    drainContextStack();
    _resetVirtualButtons();
  });

  it('isDown() returns true while a virtual button is held', () => {
    expect(h.svc.isDown('MoveLeft')).toBe(false);
    setVirtualButton('MoveLeft', true);
    expect(h.svc.isDown('MoveLeft')).toBe(true);
    setVirtualButton('MoveLeft', false);
    expect(h.svc.isDown('MoveLeft')).toBe(false);
  });

  it('isDown() respects context even for virtual buttons', () => {
    setVirtualButton('Jump', true);
    expect(h.svc.isDown('Jump')).toBe(true);
    const tok = pushContext('modal');
    expect(h.svc.isDown('Jump')).toBe(false);
    popContext(tok);
    expect(h.svc.isDown('Jump')).toBe(true);
    setVirtualButton('Jump', false);
  });

  it('justPressed() returns true exactly once after a virtual press', () => {
    setVirtualButton('Jump', true);
    expect(h.svc.justPressed('Jump')).toBe(true);
    expect(h.svc.justPressed('Jump')).toBe(false);
  });

  it('justPressed() does not re-arm while button stays held', () => {
    setVirtualButton('MoveRight', true);
    expect(h.svc.justPressed('MoveRight')).toBe(true);
    expect(h.svc.justPressed('MoveRight')).toBe(false);
    // Still held — no new press, still false
    expect(h.svc.justPressed('MoveRight')).toBe(false);
    setVirtualButton('MoveRight', false);
  });

  it('justPressed() is suppressed when the context forbids the action', () => {
    const tok = pushContext('modal');
    setVirtualButton('Jump', true);
    expect(h.svc.justPressed('Jump')).toBe(false);
    popContext(tok);
    // The blocked press must be discarded — it must NOT fire after context is restored.
    expect(h.svc.justPressed('Jump')).toBe(false);
  });

  it('event handlers fire on virtual press', () => {
    const fn = vi.fn();
    h.svc.on('Interact', fn);
    setVirtualButton('Interact', true);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith('Interact');
  });

  it('event handlers are suppressed when context forbids the action', () => {
    const fn = vi.fn();
    h.svc.on('Jump', fn);
    const tok = pushContext('modal');
    setVirtualButton('Jump', true);
    popContext(tok);
    expect(fn).not.toHaveBeenCalled();
  });

  it('virtual Confirm fires in modal context but not gameplay context', () => {
    const fn = vi.fn();
    h.svc.on('Confirm', fn);
    // Default context is gameplay — Confirm is not allowed, so handler must NOT fire.
    setVirtualButton('Confirm', true);
    setVirtualButton('Confirm', false);
    expect(fn).toHaveBeenCalledTimes(0);
    // Push modal context — next press must dispatch to the handler.
    const tok = pushContext('modal');
    setVirtualButton('Confirm', true);
    expect(fn).toHaveBeenCalledTimes(1);
    popContext(tok);
  });

  it('horizontal() includes virtual button hold state', () => {
    expect(h.svc.horizontal()).toBe(0);
    setVirtualButton('MoveRight', true);
    expect(h.svc.horizontal()).toBe(1);
    setVirtualButton('MoveLeft', true);
    expect(h.svc.horizontal()).toBe(0); // cancel
    setVirtualButton('MoveRight', false);
    expect(h.svc.horizontal()).toBe(-1);
    setVirtualButton('MoveLeft', false);
    expect(h.svc.horizontal()).toBe(0);
  });
});

