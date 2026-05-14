/**
 * Unit tests for ModalBase.
 *
 * ModalBase is abstract; tests drive it through a minimal concrete subclass.
 * All Phaser scene APIs are stubbed so no game instance is needed.
 *
 * Covers:
 *   (a) Constructor pushes 'modal' context and registers a Cancel listener.
 *   (b) Constructor registers a scene shutdown/destroy handler.
 *   (c) close() releases the Cancel listener and pops the context (idempotent: second call is no-op).
 *   (d) close() calls onBeforeClose then onAfterClose.
 *   (e) Scene shutdown triggers destroyImmediate (onBeforeClose + onAfterClose called once).
 *   (f) fadeIn() stops the previous tween before starting a new one.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type * as Phaser from 'phaser';

vi.mock('phaser', () => ({ default: {} }));
vi.mock('../config/gameConfig', () => ({ GAME_WIDTH: 800, GAME_HEIGHT: 600 }));
vi.mock('../style/theme', () => ({ theme: { color: { bg: { dark: 0x000011 }, ui: { border: 0x3344aa } } } }));

// Capture pushContext / popContext calls
const pushCtxMock = vi.fn((_ctx: string) => Symbol('token') as unknown);
const popCtxMock = vi.fn();

vi.mock('../input', () => ({
  pushContext: (ctx: string) => pushCtxMock(ctx),
  popContext: (tok: unknown) => popCtxMock(tok),
}));

// ---------------------------------------------------------------------------
// Scene stub
// ---------------------------------------------------------------------------

type InputHandler = () => void;
type EventHandler = (...args: unknown[]) => void;

function makeTween() {
  return { stop: vi.fn() };
}

function makeScene() {
  const inputHandlers: Map<string, InputHandler[]> = new Map();
  const onceHandlers: Map<string, EventHandler[]> = new Map();
  const tweens: ReturnType<typeof makeTween>[] = [];

  const scene = {
    add: {
      container: vi.fn(() => ({
        setDepth: vi.fn().mockReturnThis(),
        setScrollFactor: vi.fn().mockReturnThis(),
        setAlpha: vi.fn().mockReturnThis(),
        add: vi.fn(),
        destroy: vi.fn(),
      })),
      rectangle: vi.fn(() => ({
        setScrollFactor: vi.fn().mockReturnThis(),
        setInteractive: vi.fn().mockReturnThis(),
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
      once: vi.fn((event: string, handler: EventHandler) => {
        if (!onceHandlers.has(event)) onceHandlers.set(event, []);
        onceHandlers.get(event)!.push(handler);
      }),
      off: vi.fn(),
      emit: vi.fn(),
    },
    tweens: {
      add: vi.fn((_cfg: Record<string, unknown>) => {
        const t = makeTween();
        tweens.push(t);
        return t;
      }),
    },
    // Helpers
    _fire: (action: string) => {
      for (const h of inputHandlers.get(action) ?? []) h();
    },
    _fireEvent: (event: string) => {
      for (const h of onceHandlers.get(event) ?? []) h();
    },
    _lastTween: () => tweens[tweens.length - 1],
    _tweenCount: () => tweens.length,
  };

  return scene;
}

// Must import after mocks
import { ModalBase } from './ModalBase';

/** Minimal concrete subclass for testing. */
class TestModal extends ModalBase {
  public beforeCloseCalled = 0;
  public afterCloseCalled = 0;

  protected override onBeforeClose(): void { this.beforeCloseCalled++; }
  protected override onAfterClose(): void { this.afterCloseCalled++; }

  /** Expose protected fadeIn for direct testing. */
  public callFadeIn(duration?: number): void { this.fadeIn(duration); }
}

describe('ModalBase', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    pushCtxMock.mockImplementation((_ctx: string) => Symbol('token') as unknown);
    document.body.innerHTML = '';
  });

  it('(a) pushes modal context and registers a Cancel listener on construction', () => {
    const scene = makeScene();
    new TestModal(scene as unknown as Phaser.Scene);

    expect(pushCtxMock).toHaveBeenCalledWith('modal');
    expect(scene.inputs.on).toHaveBeenCalledWith('Cancel', expect.any(Function));
  });

  it('(b) registers shutdown and destroy scene event handlers', () => {
    const scene = makeScene();
    new TestModal(scene as unknown as Phaser.Scene);

    expect(scene.events.once).toHaveBeenCalledWith('shutdown', expect.any(Function));
    expect(scene.events.once).toHaveBeenCalledWith('destroy', expect.any(Function));
  });

  it('(b2) creates an aria-modal root for accessibility', () => {
    const scene = makeScene();
    new TestModal(scene as unknown as Phaser.Scene);

    const modalRoot = document.querySelector<HTMLElement>('[data-modal-root="true"]');
    expect(modalRoot).not.toBeNull();
    expect(modalRoot?.getAttribute('role')).toBe('dialog');
    expect(modalRoot?.getAttribute('aria-modal')).toBe('true');
  });

  it('(c) close() removes the Cancel listener and pops the context', () => {
    const scene = makeScene();
    const modal = new TestModal(scene as unknown as Phaser.Scene);
    modal.close();

    expect(scene.inputs.off).toHaveBeenCalledWith('Cancel', expect.any(Function));
    expect(popCtxMock).toHaveBeenCalledTimes(1);
  });

  it('(c2) second close() is a no-op — onBeforeClose called only once', () => {
    const scene = makeScene();
    const modal = new TestModal(scene as unknown as Phaser.Scene);
    modal.close();
    modal.close();

    expect(modal.beforeCloseCalled).toBe(1);
  });

  it('(c3) close() disposes aria-modal root and restores focus to trigger', () => {
    const trigger = document.createElement('button');
    trigger.textContent = 'trigger';
    document.body.appendChild(trigger);
    trigger.focus();

    const scene = makeScene();
    const modal = new TestModal(scene as unknown as Phaser.Scene);
    modal.close();

    expect(document.querySelector('[data-modal-root="true"]')).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it('(d) close() calls onBeforeClose and eventually onAfterClose', () => {
    const scene = makeScene();
    const modal = new TestModal(scene as unknown as Phaser.Scene);

    // close() starts a fade-out tween; onAfterClose is inside onComplete
    modal.close();

    // Manually trigger onComplete of the fade tween to exercise onAfterClose
    const addCalls = (scene.tweens.add as ReturnType<typeof vi.fn>).mock.calls;
    const lastCfg = addCalls[addCalls.length - 1]?.[0] as Record<string, unknown> | undefined;
    if (lastCfg?.['onComplete']) (lastCfg['onComplete'] as () => void)();

    expect(modal.beforeCloseCalled).toBe(1);
    expect(modal.afterCloseCalled).toBe(1);
  });

  it('(e) scene shutdown triggers destroyImmediate: onBeforeClose + onAfterClose each called once', () => {
    const scene = makeScene();
    const modal = new TestModal(scene as unknown as Phaser.Scene);

    scene._fireEvent('shutdown');

    expect(modal.beforeCloseCalled).toBe(1);
    expect(modal.afterCloseCalled).toBe(1);
  });

  it('(e2) subsequent close() after scene shutdown is a no-op', () => {
    const scene = makeScene();
    const modal = new TestModal(scene as unknown as Phaser.Scene);

    scene._fireEvent('shutdown');
    modal.close();

    expect(modal.beforeCloseCalled).toBe(1);
    expect(modal.afterCloseCalled).toBe(1);
  });

  it('(f) fadeIn() stops the previous active tween before starting a new one', () => {
    const scene = makeScene();
    const modal = new TestModal(scene as unknown as Phaser.Scene);

    modal.callFadeIn(200);
    const firstTween = scene._lastTween();

    modal.callFadeIn(200);

    expect(firstTween!.stop).toHaveBeenCalledTimes(1);
    expect(scene._tweenCount()).toBe(2);
  });

  it('(f2) fadeIn onComplete clears activeTween so subsequent fadeIn does not call stop on null', () => {
    const scene = makeScene();
    const modal = new TestModal(scene as unknown as Phaser.Scene);
    modal.callFadeIn(200);

    // Fire the onComplete callback of the most recently added tween
    const addCalls = (scene.tweens.add as ReturnType<typeof vi.fn>).mock.calls;
    const lastCfg = addCalls[addCalls.length - 1]?.[0] as Record<string, unknown> | undefined;
    expect(lastCfg?.['onComplete']).toBeDefined();
    // Should not throw and should clear activeTween
    expect(() => (lastCfg!['onComplete'] as () => void)()).not.toThrow();

    // After onComplete, calling fadeIn again should NOT call stop on a null tween
    expect(() => modal.callFadeIn(200)).not.toThrow();
  });
});
