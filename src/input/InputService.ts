import * as Phaser from 'phaser';
import {
  ACTION_CONTEXTS, ALL_ACTIONS, ALWAYS,
  type ActionContextTag, type GameAction, type InputContext,
} from './actions';
import { ALL_BOUND_KEYS, DEFAULT_BINDINGS, actionsForKey, type KeyCode } from './bindings';

/* ---------- Virtual (on-screen) button state ---------- */

/**
 * Hold state for virtual buttons. `isDown()` checks this in addition to
 * physical keyboard keys so the on-screen D-pad integrates transparently.
 */
const virtualButtonsDown = new Map<GameAction, boolean>();

/**
 * One-shot queue consumed by `justPressed()`. Set on virtual press so that
 * tap-style actions (Jump, Interact, Confirm) fire correctly even when the
 * caller polls `justPressed()` rather than subscribing via `on()`.
 */
const virtualJustPressedQueue = new Set<GameAction>();

/**
 * All currently active (started) InputService instances. Populated in
 * `onSceneStart`, cleared in `onShutdown`. Used to dispatch virtual presses
 * to event-handler subscribers across all running scenes.
 */
const liveInputServices = new Set<InputService>();

/**
 * Set or release a virtual button for `action`.
 *
 * Call with `pressed = true` on touch-start; call with `pressed = false`
 * on touch-end / touch-cancel. The hold state drives `isDown()` (polling)
 * and the press edge drives `justPressed()` and event subscribers, exactly
 * like a physical key press.
 *
 * Press events are edge-detected: calling with `pressed = true` while the
 * button is already held is a no-op, preventing spurious re-fires from
 * multi-touch quirks or repeated touchstart events.
 *
 * All actions are still filtered by the active `InputContext`, so virtual
 * `Jump` is suppressed while a modal is open, etc.
 */
export function setVirtualButton(action: GameAction, pressed: boolean): void {
  const wasPressed = virtualButtonsDown.get(action) === true;

  if (!pressed) {
    virtualButtonsDown.delete(action);
    return;
  }

  if (wasPressed) {
    // Already held — ignore repeated touchstart to avoid double-fires.
    return;
  }

  virtualButtonsDown.set(action, true);
  virtualJustPressedQueue.add(action);
  for (const svc of liveInputServices) {
    svc._dispatchAction(action);
  }
}

/** @internal Reset all virtual-button state. For unit tests only. */
export function _resetVirtualButtons(): void {
  virtualButtonsDown.clear();
  virtualJustPressedQueue.clear();
  liveInputServices.clear();
}

/* ---------- Global context stack ---------- */

/**
 * Active input contexts, top of stack last. The topmost context
 * decides which actions are allowed to dispatch. `gameplay` is the
 * implicit base when the stack is empty.
 */
const contextStack: InputContext[] = [];

/** The currently active context (top of stack, or 'gameplay' by default). */
export function activeContext(): InputContext {
  return contextStack.length > 0 ? contextStack[contextStack.length - 1]! : 'gameplay';
}

/** Push a context. Returns a token that must be passed back to `popContext`. */
export function pushContext(ctx: InputContext): ContextToken {
  contextStack.push(ctx);
  return { ctx, idx: contextStack.length - 1 };
}

export interface ContextToken {
  readonly ctx: InputContext;
  readonly idx: number;
}

/**
 * Pop a previously-pushed context.
 *
 * The token MUST be the one currently at the top of the stack. Out-of-order
 * pops are rejected: in development a `console.warn` is emitted and the
 * stack is left unchanged so callers can diagnose the mismatch.
 */
export function popContext(token: ContextToken): void {
  const top = contextStack.length - 1;
  if (top < 0) return;
  if (top === token.idx && contextStack[top] === token.ctx) {
    contextStack.pop();
    return;
  }
  if (import.meta.env.DEV) {
    console.warn(
      `[InputService] popContext: token mismatch — ` +
      `expected top "${contextStack[top]}" (idx ${top}), ` +
      `got "${token.ctx}" (idx ${token.idx}). Pop refused.`,
    );
  }
}

/** @internal Reset the context stack to empty. For unit tests only. */
export function _resetContextStack(): void {
  contextStack.length = 0;
}

/** True if an action may dispatch given the active context. */
function actionAllowed(action: GameAction): boolean {
  const tags: readonly ActionContextTag[] = ACTION_CONTEXTS[action];
  if (tags.includes(ALWAYS)) return true;
  return tags.includes(activeContext());
}

/* ---------- Per-scene plugin ---------- */

type ActionHandler = (action: GameAction) => void;

/**
 * Phaser ScenePlugin exposing the semantic action API to every scene.
 *
 * Accessed via the mapping configured in `main.ts` (e.g. `this.inputs`).
 *
 * Responsibilities:
 *   - On scene boot, register every KeyCode referenced by DEFAULT_BINDINGS.
 *   - Translate keyboard events into GameAction dispatches, filtered by
 *     the currently-active InputContext.
 *   - Offer three consumption styles: event (`on`), polling (`isDown`),
 *     per-frame edge (`justPressed`), and an axis helper.
 *   - Auto-clean on scene shutdown so plugins on restarted scenes
 *     don't accumulate listeners.
 */
export class InputService extends Phaser.Plugins.ScenePlugin {
  private keys = new Map<KeyCode, Phaser.Input.Keyboard.Key>();
  private handlers = new Map<GameAction, Set<ActionHandler>>();
  private keyDownListener?: (ev: KeyboardEvent) => void;
  /** Actions that have a pending "just pressed" flag consumed by justPressed(). */
  private justPressedFlags = new Map<GameAction, boolean>();

  boot(): void {
    const events = this.systems!.events;
    events.on('start', this.onSceneStart, this);
    events.once('destroy', this.onSceneDestroy, this);
  }

  private onSceneStart(): void {
    const kb = this.scene?.input.keyboard;
    if (!kb) return;

    // Register every bound key so Phaser tracks its isDown state.
    for (const code of ALL_BOUND_KEYS) {
      this.keys.set(code, kb.addKey(code, false));
    }

    // Single keydown listener — cheaper than N per-key handlers and
    // keeps ordering predictable (Phaser fires in registration order).
    this.keyDownListener = (ev: KeyboardEvent) => this.dispatchKeyDown(ev.keyCode);
    kb.on('keydown', this.keyDownListener);

    // Register as a live instance so setVirtualButton can dispatch to
    // our event handlers while this scene is running.
    liveInputServices.add(this);

    this.systems!.events.once('shutdown', this.onShutdown, this);
  }

  private dispatchKeyDown(keyCode: number): void {
    const actions = actionsForKey(keyCode);
    if (actions.length === 0) return;
    for (const action of actions) {
      this._dispatchAction(action);
    }
  }

  /**
   * Dispatch a single action press to this service instance — sets the
   * `justPressedFlags` entry and fires any registered event handlers.
   *
   * Used internally by `dispatchKeyDown` and by the module-level
   * `setVirtualButton` so that virtual presses are indistinguishable
   * from physical key presses.
   *
   * @internal Do not call from outside `src/input/`.
   */
  _dispatchAction(action: GameAction): void {
    if (!actionAllowed(action)) return;
    this.justPressedFlags.set(action, true);
    const set = this.handlers.get(action);
    if (!set) return;
    // Copy to tolerate handlers that unsubscribe during dispatch.
    for (const handler of Array.from(set)) {
      handler(action);
    }
  }

  /* ---- public polling API ---- */

  /** True while any key bound to `action` is held AND its context is active. */
  isDown(action: GameAction): boolean {
    if (!actionAllowed(action)) return false;
    if (virtualButtonsDown.get(action)) return true;
    const codes = DEFAULT_BINDINGS[action];
    for (const code of codes) {
      if (this.keys.get(code)?.isDown) return true;
    }
    return false;
  }

  /**
   * True exactly once per action press (keyboard or virtual). Consumes the
   * flag — a subsequent call in the same press returns false.
   */
  justPressed(action: GameAction): boolean {
    if (this.justPressedFlags.get(action)) {
      this.justPressedFlags.set(action, false);
      // Remove from the virtual queue too so a second service instance
      // can't get a spurious fire from the same virtual press.
      virtualJustPressedQueue.delete(action);
      return true;
    }
    // Fallback: check the module-level virtual queue. Consume the queued
    // virtual press even when the action is currently disallowed, so blocked
    // presses are discarded rather than leaking into a later context.
    // This matches keyboard semantics: a press while blocked is lost.
    if (virtualJustPressedQueue.has(action)) {
      virtualJustPressedQueue.delete(action);
      if (!actionAllowed(action)) return false;
      return true;
    }
    return false;
  }

  /** -1 / 0 / +1 horizontal axis from MoveLeft / MoveRight. */
  horizontal(): number {
    return (this.isDown('MoveRight') ? 1 : 0) - (this.isDown('MoveLeft') ? 1 : 0);
  }

  /** -1 / 0 / +1 vertical axis from MoveUp / MoveDown. */
  vertical(): number {
    return (this.isDown('MoveDown') ? 1 : 0) - (this.isDown('MoveUp') ? 1 : 0);
  }

  /* ---- event API ---- */

  on(action: GameAction, handler: ActionHandler): void {
    let set = this.handlers.get(action);
    if (!set) {
      set = new Set();
      this.handlers.set(action, set);
    }
    set.add(handler);
  }

  off(action: GameAction, handler: ActionHandler): void {
    this.handlers.get(action)?.delete(handler);
  }

  /**
   * Programmatically fire an action in the active context. Used by
   * `bindPointerAction` so clicks dispatch the same event path as keys.
   */
  emit(action: GameAction): void {
    if (!actionAllowed(action)) return;
    this.justPressedFlags.set(action, true);
    const set = this.handlers.get(action);
    if (!set) return;
    for (const handler of Array.from(set)) handler(action);
  }

  /* ---- lifecycle ---- */

  private onShutdown(): void {
    liveInputServices.delete(this);
    const kb = this.scene?.input.keyboard;
    if (kb && this.keyDownListener) kb.off('keydown', this.keyDownListener);
    this.keyDownListener = undefined;
    for (const k of this.keys.values()) k.destroy();
    this.keys.clear();
    this.handlers.clear();
    this.justPressedFlags.clear();
  }

  private onSceneDestroy(): void {
    this.onShutdown();
    this.systems?.events.off('start', this.onSceneStart, this);
  }
}

// Re-export the action list in case a consumer wants to iterate.
export { ALL_ACTIONS };
