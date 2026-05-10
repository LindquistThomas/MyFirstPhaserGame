import type { GameAction } from './actions';
import { primaryKeyLabel } from './keyLabels';
import { eventBus } from '../systems/EventBus';
import {
  TOUCH_PRIMARY_OVERRIDE_CHANGED_EVENT,
  TOUCH_PRIMARY_OVERRIDE_KEY,
  readTouchPrimaryOverride,
} from '../ui/touchPrimary';

export type InputMode = 'keyboard' | 'gamepad' | 'touch';

/**
 * Hand-authored v1 gamepad prompt map for the most common in-game actions.
 * Unmapped actions intentionally fall back to keyboard labels.
 */
const GAMEPAD_PROMPTS: Partial<Record<GameAction, string>> = {
  Jump: 'A',
  Interact: 'B',
  Confirm: 'A',
  Cancel: 'B',
  ToggleInfo: 'D-Pad Up',
  MoveLeft: 'D-Pad Left',
  MoveRight: 'D-Pad Right',
};

const TOUCH_PROMPTS: Partial<Record<GameAction, string>> = {
  ToggleInfo: 'Tap',
  Interact: 'Tap',
  Confirm: 'Tap',
  Jump: 'Tap and hold',
  MoveLeft: 'Swipe',
  MoveRight: 'Swipe',
};

let trackingInitialised = false;
let trackedMode: InputMode | null = null;
let touchOverrideSnapshot: string | null = null;
let disposers: Array<() => void> = [];

function hasActiveGamepad(): boolean {
  if (typeof navigator === 'undefined' || typeof navigator.getGamepads !== 'function') return false;
  try {
    const pads = navigator.getGamepads();
    if (!pads) return false;
    return Array.from(pads).some((pad) => !!pad?.connected);
  } catch {
    return false;
  }
}

export function detectInputMode(): InputMode {
  const touchOverride = readTouchPrimaryOverride();
  if (touchOverride === true) return 'touch';
  if (touchOverride === false) return 'keyboard';
  if (hasActiveGamepad()) return 'gamepad';
  return 'keyboard';
}

export function promptLabel(action: GameAction, mode: InputMode = detectInputMode()): string {
  if (mode === 'touch') return TOUCH_PROMPTS[action] ?? 'Tap';
  if (mode === 'gamepad') return GAMEPAD_PROMPTS[action] ?? primaryKeyLabel(action);
  return primaryKeyLabel(action);
}

/** Human-readable action instruction, e.g. "Press A" or "Tap". */
export function actionPrompt(action: GameAction, mode: InputMode = detectInputMode()): string {
  const label = promptLabel(action, mode);
  if (label === 'Tap' || label === 'Tap and hold' || label === 'Swipe') return label;
  return `Press ${label}`;
}

function emitModeChangedIfNeeded(): void {
  const nextMode = detectInputMode();
  if (trackedMode === nextMode) return;
  trackedMode = nextMode;
  eventBus.emit('input:mode-changed', nextMode);
}

function onTouchOverrideMaybeChanged(): void {
  const next = localStorage.getItem(TOUCH_PRIMARY_OVERRIDE_KEY);
  if (next === touchOverrideSnapshot) return;
  touchOverrideSnapshot = next;
  emitModeChangedIfNeeded();
}

export function initInputModeTracking(): void {
  // Safe to call from bootstrap and UI constructors; only the first call
  // attaches listeners, later calls are intentional no-ops.
  if (trackingInitialised || typeof window === 'undefined') return;
  trackingInitialised = true;
  trackedMode = detectInputMode();
  touchOverrideSnapshot = localStorage.getItem(TOUCH_PRIMARY_OVERRIDE_KEY);

  const onGamepadEvent = (): void => emitModeChangedIfNeeded();
  const onStorage = (event: StorageEvent): void => {
    if (event.key !== TOUCH_PRIMARY_OVERRIDE_KEY) return;
    touchOverrideSnapshot = event.newValue;
    emitModeChangedIfNeeded();
  };
  const onOverrideChanged = (): void => onTouchOverrideMaybeChanged();

  window.addEventListener('gamepadconnected', onGamepadEvent);
  window.addEventListener('gamepaddisconnected', onGamepadEvent);
  window.addEventListener('storage', onStorage);
  window.addEventListener(TOUCH_PRIMARY_OVERRIDE_CHANGED_EVENT, onOverrideChanged);

  disposers = [
    () => window.removeEventListener('gamepadconnected', onGamepadEvent),
    () => window.removeEventListener('gamepaddisconnected', onGamepadEvent),
    () => window.removeEventListener('storage', onStorage),
    () => window.removeEventListener(TOUCH_PRIMARY_OVERRIDE_CHANGED_EVENT, onOverrideChanged),
  ];
}

/** @internal Test seam */
export function _resetInputModeTrackingForTests(): void {
  for (const dispose of disposers) dispose();
  disposers = [];
  trackingInitialised = false;
  trackedMode = null;
  touchOverrideSnapshot = null;
}
