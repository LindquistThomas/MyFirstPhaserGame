import * as Phaser from 'phaser';
import type { GameAction } from './actions';

/**
 * A Phaser keyboard KeyCode (a number). We alias it so call sites
 * don't need to import Phaser types just to extend the binding table.
 */
export type KeyCode = number;

const K = Phaser.Input.Keyboard.KeyCodes;

/**
 * The single source of truth for key → action mapping.
 *
 * To change a key binding, edit this table. Nothing else in the
 * codebase should reference a raw KeyCode.
 *
 * Multiple keys per action are fully supported — any of the listed
 * keys triggers the action.
 */
export const DEFAULT_BINDINGS: Record<GameAction, readonly KeyCode[]> = {
  // --- Movement ---
  MoveLeft:  [K.LEFT, K.A],
  MoveRight: [K.RIGHT, K.D],
  MoveUp:    [K.UP, K.W],
  MoveDown:  [K.DOWN, K.S],

  // --- Gameplay verbs ---
  // Space is reserved exclusively for Jump so it never triggers a
  // scene transition or dialog by accident. Action verbs (entering
  // doors, opening info cards) all go through Enter — which is also
  // dispatched by pointer/touch events on interactive game objects.
  // ArrowUp is reserved for ToggleInfo so pressing Up near an info
  // zone opens the card without also firing Jump; W remains the
  // keyboard-alternative for Jump.
  Jump:       [K.SPACE, K.W],
  Interact:   [K.ENTER],
  ToggleInfo: [K.UP, K.ENTER, K.I],

  // --- Menu / dialog navigation ---
  NavigateUp:    [K.UP, K.W],
  NavigateDown:  [K.DOWN, K.S],
  NavigateLeft:  [K.LEFT, K.A],
  NavigateRight: [K.RIGHT, K.D],
  PageUp:        [K.PAGE_UP],
  PageDown:      [K.PAGE_DOWN],

  // --- Generic UI verbs ---
  Confirm: [K.ENTER],
  Cancel:  [K.ESC],

  // --- Quiz shortcuts ---
  QuickAnswer1: [K.ONE, K.A],
  QuickAnswer2: [K.TWO, K.B],
  QuickAnswer3: [K.THREE, K.C],
  QuickAnswer4: [K.FOUR, K.D],

  // --- Elevator floor call buttons ---
  // Digit keys map to the visual floor order shown on the cab panel
  // (F0 = lobby at the bottom, F4 = executive at the top). The same
  // physical keys are also bound to QuickAnswer1..4 above; the active
  // input context (gameplay vs modal) keeps the two from colliding.
  ElevatorCallFloor0: [K.ZERO],
  ElevatorCallFloor1: [K.ONE],
  ElevatorCallFloor2: [K.TWO],
  ElevatorCallFloor3: [K.THREE],
  ElevatorCallFloor4: [K.FOUR],

  // --- Debug ---
  ToggleDebug: [K.D],
};

/**
 * Reverse lookup: for a given KeyCode, which actions does it trigger?
 * Cached once at module load — the binding table is immutable.
 */
const KEY_TO_ACTIONS: Map<KeyCode, GameAction[]> = (() => {
  const m = new Map<KeyCode, GameAction[]>();
  for (const [action, keys] of Object.entries(DEFAULT_BINDINGS) as [GameAction, readonly KeyCode[]][]) {
    for (const key of keys) {
      const list = m.get(key) ?? [];
      list.push(action);
      m.set(key, list);
    }
  }
  return m;
})();

export function actionsForKey(key: KeyCode): readonly GameAction[] {
  return KEY_TO_ACTIONS.get(key) ?? [];
}

/** Every distinct KeyCode referenced by the binding table. */
export const ALL_BOUND_KEYS: readonly KeyCode[] = Array.from(KEY_TO_ACTIONS.keys());
