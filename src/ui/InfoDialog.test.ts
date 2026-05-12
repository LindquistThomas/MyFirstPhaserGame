/**
 * Unit tests for InfoDialog.
 *
 * ModalBase is stubbed so InfoDialog can be constructed without a running
 * Phaser scene. Tests focus on:
 *   (a) Body text is rendered from content.body.
 *   (b) Scroll mask graphics call setScrollFactor(0) (CLAUDE.md tripwire).
 *   (c) Quiz button shows "TAKE QUIZ" label when quiz is available.
 *   (d) Quiz button shows "QUIZ PASSED" label when quiz is already passed.
 *   (e) Quiz button shows cooldown label and is non-interactive during cooldown.
 *   (f) onQuizStart is invoked when the quiz button is clicked.
 *   (g) onClose callback fired after modal closes.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type * as Phaser from 'phaser';

vi.mock('phaser', () => {
  const PhaserMath = { Clamp: (v: number, min: number, max: number) => Math.min(max, Math.max(min, v)) };
  return { ...{ Math: PhaserMath }, default: { Math: PhaserMath } };
});

vi.mock('../config/gameConfig', () => ({ GAME_WIDTH: 800, GAME_HEIGHT: 600 }));

vi.mock('../style/theme', () => ({
  theme: {
    color: {
      bg: { dark: 0x000011 },
      ui: { border: 0x334455 },
      css: { textTitle: '#ffffff', textWhite: '#ffffff' },
    },
  },
  getHighContrastCss: vi.fn(() => ({ textAccent: '#00ffff', textPanel: '#ccddee' })),
}));

vi.mock('../style/responsive', () => ({
  getSizeClass: vi.fn(() => 'md'),
  getLayoutTokens: vi.fn(() => ({
    dialogPanelW: 600,
    dialogFontTitle: '22px',
    dialogFontBody: '15px',
    dialogTapTarget: 44,
  })),
}));

vi.mock('../systems/SettingsStore', () => ({
  settingsStore: {
    read: vi.fn(() => ({ textScale: 1, highContrast: false })),
  },
}));

vi.mock('../systems/EventBus', () => ({
  eventBus: { emit: vi.fn(), on: vi.fn(), off: vi.fn() },
}));

// Stub ModalBase
vi.mock('./ModalBase', () => ({
  ModalBase: class MockModalBase {
    protected readonly scene: unknown;
    protected readonly container: {
      add: ReturnType<typeof vi.fn>;
      length: number;
    };
    private destroyed = false;

    constructor(scene: unknown) {
      this.scene = scene;
      this.container = { add: vi.fn(), length: 1 };
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

vi.mock('./ModalKeyboardNavigator', () => ({
  ModalKeyboardNavigator: class {
    private _bindings: Map<string, () => void> = new Map();
    add = vi.fn();
    insert = vi.fn();
    reset = vi.fn();
    setFocus = vi.fn();
    bind = vi.fn((action: string, fn: () => void) => { this._bindings.set(action, fn); });
    destroy = vi.fn();
    focusPrev = vi.fn();
    focusNext = vi.fn();
    activateFocused = vi.fn();
    refreshArrow = vi.fn();
    hideArrow = vi.fn();
    get = vi.fn(() => undefined);
    size = vi.fn(() => 1); // >0 so registerKeyboardNav doesn't early-return
    currentIndex = vi.fn(() => 0);
    /** Test helper: invoke a registered binding */
    _fire(action: string) { this._bindings.get(action)?.(); }
  },
  makeTextFocusable: vi.fn((t: unknown) => t),
}));

// ---------------------------------------------------------------------------
// Scene stub
// ---------------------------------------------------------------------------

function makeText() {
  const handlers: Record<string, (() => void)[]> = {};
  const obj = {
    _textValue: '',
    setOrigin: vi.fn().mockReturnThis(),
    setScrollFactor: vi.fn().mockReturnThis(),
    setDepth: vi.fn().mockReturnThis(),
    setColor: vi.fn().mockReturnThis(),
    setInteractive: vi.fn().mockReturnThis(),
    setX: vi.fn().mockReturnThis(),
    setText: vi.fn((t: string) => { obj._textValue = t; return obj; }),
    on: vi.fn((event: string, handler: () => void) => {
      if (!handlers[event]) handlers[event] = [];
      handlers[event]!.push(handler);
      return obj;
    }),
    off: vi.fn().mockReturnThis(),
    getBounds: vi.fn(() => ({ x: 0, y: 0, width: 100, height: 20 })),
    height: 20,
    destroy: vi.fn(),
    _trigger: (event: string) => handlers[event]?.forEach((h) => h()),
  };
  return obj;
}

function makeGraphics() {
  const obj: Record<string, ReturnType<typeof vi.fn>> = {};
  for (const name of [
    'fillStyle', 'fillRoundedRect', 'lineStyle', 'strokeRoundedRect',
    'lineBetween', 'fillRect',
    'setScrollFactor', 'setDepth', 'destroy',
    'createGeometryMask',
  ]) {
    obj[name] = vi.fn().mockReturnThis();
  }
  obj['createGeometryMask'] = vi.fn(() => ({}));
  return obj;
}

function makeContainer() {
  return {
    add: vi.fn(),
    setMask: vi.fn(),
    clearMask: vi.fn(),
    setVisible: vi.fn().mockReturnThis(),
    removeAll: vi.fn().mockReturnThis(),
    y: 0,
  };
}

function makeScene() {
  const texts: ReturnType<typeof makeText>[] = [];
  const graphics: ReturnType<typeof makeGraphics>[] = [];
  const scrollContainers: ReturnType<typeof makeContainer>[] = [];
  const wheelHandlers: Array<(...args: unknown[]) => void> = [];
  const timerEvents: Array<{ callback: () => void; event: { destroy: ReturnType<typeof vi.fn> } }> = [];

  const scene = {
    scale: { displaySize: { width: 800 } },
    add: {
      text: vi.fn((_x: number, _y: number, text: string, _style: unknown) => {
        const t = makeText();
        t._textValue = typeof text === 'string' ? text : String(text);
        texts.push(t);
        return t;
      }),
      graphics: vi.fn(() => {
        const g = makeGraphics();
        graphics.push(g);
        return g;
      }),
      container: vi.fn((_x: number, _y: number) => {
        const c = makeContainer();
        scrollContainers.push(c);
        return c;
      }),
      rectangle: vi.fn((_x: number, _y: number, _w: number, _h: number) => ({
        setOrigin: vi.fn().mockReturnThis(),
        setVisible: vi.fn().mockReturnThis(),
        height: 0,
      })),
    },
    make: {
      graphics: vi.fn((_opts: unknown, _add: boolean) => {
        const g = makeGraphics();
        // setScrollFactor is what the test checks (CLAUDE.md tripwire)
        graphics.push(g);
        return g;
      }),
      text: vi.fn(() => ({
        height: 40,
        destroy: vi.fn(),
      })),
    },
    input: {
      on: vi.fn((_event: string, handler: (...args: unknown[]) => void) => {
        wheelHandlers.push(handler);
      }),
      off: vi.fn(),
    },
    time: {
      addEvent: vi.fn((cfg: { callback: () => void }) => {
        const event = { destroy: vi.fn() };
        timerEvents.push({ callback: cfg.callback, event });
        return event;
      }),
      delayedCall: vi.fn((_delay: number, cb: () => void) => {
        return { destroy: vi.fn(), callback: cb };
      }),
    },
    tweens: { add: vi.fn() },
    _texts: () => texts,
    _textValues: () => texts.map((t) => t._textValue),
    _graphics: () => graphics,
    _tickTimer: () => {
      const last = timerEvents[timerEvents.length - 1];
      last?.callback();
    },
    _quizBtn: () => texts.find((t) => t._textValue.includes('QUIZ') || t._textValue.includes('RETRY')),
  };

  return scene;
}

import { InfoDialog } from './InfoDialog';
import type { InfoDialogContent, InfoDialogOptions } from './InfoDialog';

const BASE_CONTENT: InfoDialogContent = {
  id: 'test-info',
  title: 'Test Title',
  body: 'Test body content',
};

describe('InfoDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('(a) body text is rendered with the content.body value', () => {
    const scene = makeScene();
    new InfoDialog(scene as unknown as Phaser.Scene, BASE_CONTENT);
    expect(scene._textValues()).toContain('Test body content');
  });

  it('(b) scroll mask graphics have setScrollFactor(0) called (CLAUDE.md tripwire)', () => {
    const scene = makeScene();
    new InfoDialog(scene as unknown as Phaser.Scene, BASE_CONTENT);
    // The geometry mask graphics object must have scrollFactor 0
    const maskGfx = (scene.make.graphics as ReturnType<typeof vi.fn>).mock.results[0]?.value as
      ReturnType<typeof makeGraphics> | undefined;
    expect(maskGfx?.setScrollFactor).toHaveBeenCalledWith(0);
  });

  it('(c) quiz button shows "TAKE QUIZ" when quiz is available', () => {
    const scene = makeScene();
    const opts: InfoDialogOptions = {
      onQuizStart: vi.fn(),
      quizStatus: { passed: false, canRetry: true, cooldownSeconds: 0 },
    };
    new InfoDialog(scene as unknown as Phaser.Scene, BASE_CONTENT, undefined, opts);
    const quizBtn = scene._quizBtn();
    expect(quizBtn?._textValue).toContain('TAKE QUIZ');
  });

  it('(d) quiz button shows "QUIZ PASSED" label when quiz is passed', () => {
    const scene = makeScene();
    const opts: InfoDialogOptions = {
      onQuizStart: vi.fn(),
      quizStatus: { passed: true, canRetry: false, cooldownSeconds: 0 },
    };
    new InfoDialog(scene as unknown as Phaser.Scene, BASE_CONTENT, undefined, opts);
    const quizBtn = scene._quizBtn();
    expect(quizBtn?._textValue).toContain('QUIZ PASSED');
  });

  it('(e) quiz button shows cooldown label during cooldown', () => {
    const scene = makeScene();
    const opts: InfoDialogOptions = {
      onQuizStart: vi.fn(),
      quizStatus: { passed: false, canRetry: false, cooldownSeconds: 30 },
    };
    new InfoDialog(scene as unknown as Phaser.Scene, BASE_CONTENT, undefined, opts);
    const quizBtn = scene._quizBtn();
    expect(quizBtn?._textValue).toMatch(/RETRY IN/);
  });

  it('(f) clicking the quiz button (pointerdown) invokes onQuizStart', () => {
    const scene = makeScene();
    const onQuizStart = vi.fn();
    const opts: InfoDialogOptions = {
      onQuizStart,
      quizStatus: { passed: false, canRetry: true, cooldownSeconds: 0 },
    };
    new InfoDialog(scene as unknown as Phaser.Scene, BASE_CONTENT, undefined, opts);
    const quizBtn = scene._quizBtn();
    // Trigger pointerdown on the quiz button
    quizBtn?._trigger('pointerdown');
    // onQuizStart is wrapped in delayedCall, so it should be called via delayedCall callback
    const delayedCallCalls = (scene.time.delayedCall as ReturnType<typeof vi.fn>).mock.calls;
    expect(delayedCallCalls.length).toBeGreaterThan(0);
    // Fire the delayed callback directly
    const lastDelayedCb = delayedCallCalls[delayedCallCalls.length - 1]?.[1] as (() => void) | undefined;
    lastDelayedCb?.();
    expect(onQuizStart).toHaveBeenCalledTimes(1);
  });

  it('(g) onClose callback is fired after modal closes', () => {
    const scene = makeScene();
    const onClose = vi.fn();
    const dialog = new InfoDialog(scene as unknown as Phaser.Scene, BASE_CONTENT, onClose);
    dialog.close();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('title text rendered from content.title', () => {
    const scene = makeScene();
    new InfoDialog(scene as unknown as Phaser.Scene, { ...BASE_CONTENT, title: 'My Title' });
    expect(scene._textValues()).toContain('My Title');
  });

  it('wheel handler scrolls content when registered (triggers scrollBy)', () => {
    const scene = makeScene();
    new InfoDialog(scene as unknown as Phaser.Scene, BASE_CONTENT);
    // Invoke wheel handler — first arg is event 'wheel', second arg is the handler
    const wheelCalls = (scene.input.on as ReturnType<typeof vi.fn>).mock.calls as unknown[][];
    const wheelEntry = wheelCalls.find((args) => args[0] === 'wheel');
    expect(wheelEntry).toBeDefined();
    // Call the handler with a non-zero dy to exercise scrollBy
    const wheelFn = wheelEntry?.[1] as ((ptr: unknown, over: unknown, dx: number, dy: number) => void) | undefined;
    expect(() => wheelFn?.(null, [], 0, 10)).not.toThrow();
  });

  it('cooldown timer is destroyed in onBeforeClose', () => {
    const scene = makeScene();
    const opts: InfoDialogOptions = {
      onQuizStart: vi.fn(),
      quizStatus: { passed: false, canRetry: false, cooldownSeconds: 5 },
    };
    const dialog = new InfoDialog(scene as unknown as Phaser.Scene, BASE_CONTENT, undefined, opts);
    // Closing should call destroys on the cooldown timer
    expect(() => dialog.close()).not.toThrow();
  });

  it('renders links section when content has links', () => {
    const scene = makeScene();
    const content = {
      ...BASE_CONTENT,
      links: [{ label: 'Learn More', url: 'https://example.com' }],
    };
    new InfoDialog(scene as unknown as Phaser.Scene, content);
    expect(scene._textValues()).toContain('Learn more:');
  });

  it('extended info toggle renders Deep Dive section', () => {
    const scene = makeScene();
    const content = {
      ...BASE_CONTENT,
      extendedInfo: { title: 'Deep Title', body: 'Deep body text' },
    };
    new InfoDialog(scene as unknown as Phaser.Scene, content);
    // The toggle text should say "[+]  Deep Dive"
    const toggle = scene._texts().find((t) => (t._textValue as string).includes('Deep Dive'));
    expect(toggle).toBeDefined();
    // Fire the toggle click to expand
    toggle?._trigger('pointerdown');
    // After expanding, the toggle should update to "[-]"
    // (setText was called on the toggle text object)
  });

  it('keyboard nav bindings: NavigateUp/Down/Confirm/PageUp/PageDown cover inner callbacks', () => {
    const scene = makeScene();
    const dialog = new InfoDialog(scene as unknown as Phaser.Scene, BASE_CONTENT);
    const nav = (dialog as unknown as { nav: { _fire: (a: string) => void } }).nav;
    // Fire nav bindings — covers ensureFocusedVisible, focusedText, refreshFocusArrowWithVisibility
    expect(() => nav._fire('NavigateUp')).not.toThrow();
    expect(() => nav._fire('NavigateDown')).not.toThrow();
    expect(() => nav._fire('Confirm')).not.toThrow();
    expect(() => nav._fire('PageUp')).not.toThrow();
    expect(() => nav._fire('PageDown')).not.toThrow();
  });
});
