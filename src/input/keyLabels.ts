import * as Phaser from 'phaser';
import type { GameAction } from './actions';
import { DEFAULT_BINDINGS, type KeyCode } from './bindings';

const K = Phaser.Input.Keyboard.KeyCodes;

/** Human-readable labels for the keys we bind. */
const KEY_LABELS: Record<number, string> = {
  [K.SPACE]: 'Space',
  [K.ENTER]: 'Enter',
  [K.ESC]: 'Esc',
  [K.UP]: '↑',
  [K.DOWN]: '↓',
  [K.LEFT]: '←',
  [K.RIGHT]: '→',
  [K.PAGE_UP]: 'Page Up',
  [K.PAGE_DOWN]: 'Page Down',
  [K.W]: 'W',
  [K.A]: 'A',
  [K.S]: 'S',
  [K.D]: 'D',
  [K.I]: 'I',
  [K.P]: 'P',
  [K.X]: 'X',
  [K.ONE]: '1',
  [K.TWO]: '2',
  [K.THREE]: '3',
  [K.FOUR]: '4',
  [K.B]: 'B',
  [K.C]: 'C',
  [K.H]: 'H',
  // ZERO and FIVE cover ElevatorCallFloor0 / ElevatorCallFloor5 so the modal
  // can display readable labels instead of raw key codes.
  [K.ZERO]: '0',
  [K.FIVE]: '5',
};

/** Label for a single key code (falls back to the raw code as a string). */
export function keyLabel(key: KeyCode): string {
  return KEY_LABELS[key] ?? String(key);
}

/**
 * Label of the primary (first-bound) key for an action. Useful for
 * on-screen "Press X" prompts so the prompt tracks the binding table.
 */
export function primaryKeyLabel(action: GameAction): string {
  const keys = DEFAULT_BINDINGS[action];
  if (!keys || keys.length === 0) return '?';
  return keyLabel(keys[0]!);
}

/**
 * Comma-joined labels for every key bound to an action, e.g.
 * "Space/Enter". Order matches the binding table.
 */
export function allKeyLabels(action: GameAction, separator = '/'): string {
  const keys = DEFAULT_BINDINGS[action];
  if (!keys || keys.length === 0) return '?';
  return keys.map(keyLabel).join(separator);
}
