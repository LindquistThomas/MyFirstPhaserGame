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
  // Jump and Interact share Space because the player is either on the
  // ground near an interactable (Interact fires, scene transitions) or
  // not (Jump fires). Jump additionally honours the classic Up/W keys.
  Jump:       [K.SPACE, K.UP, K.W],
  Interact:   [K.SPACE, K.ENTER],
  ToggleInfo: [K.I],

  // --- Menu / dialog navigation ---
  NavigateUp:    [K.UP, K.W],
  NavigateDown:  [K.DOWN, K.S],
  NavigateLeft:  [K.LEFT, K.A],
  NavigateRight: [K.RIGHT, K.D],
  PageUp:        [K.PAGE_UP],
  PageDown:      [K.PAGE_DOWN],

  // --- Generic UI verbs ---
  Confirm: [K.SPACE, K.ENTER],
  Cancel:  [K.ESC],

  // --- Quiz shortcuts ---
  QuickAnswer1: [K.ONE, K.A],
  QuickAnswer2: [K.TWO, K.B],
  QuickAnswer3: [K.THREE, K.C],
  QuickAnswer4: [K.FOUR, K.D],

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
