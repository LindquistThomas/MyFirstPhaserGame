import * as Phaser from 'phaser';
import type { GameAction } from './actions';
import type { InputService } from './InputService';

type InteractiveObject = Phaser.GameObjects.GameObject & {
  setInteractive: (...args: unknown[]) => unknown;
  on: (event: string, handler: (...args: unknown[]) => void) => unknown;
};

/**
 * Wires a Phaser interactive GameObject so pointer-down dispatches
 * `action` through the scene's InputService, just like a key press.
 *
 * Consumers can subscribe once via `inputs.on(action, handler)` and
 * have keyboard and mouse share the same code path. Use this for
 * semantic clicks only (Confirm, Cancel, etc.). Positional buttons
 * — like elevator up/down — should stay as direct handlers.
 *
 * Returns the object for chaining.
 */
export function bindPointerAction<T extends InteractiveObject>(
  obj: T,
  action: GameAction,
  inputs: InputService,
): T {
  obj.setInteractive({ useHandCursor: true });
  obj.on('pointerdown', () => inputs.emit(action));
  return obj;
}
