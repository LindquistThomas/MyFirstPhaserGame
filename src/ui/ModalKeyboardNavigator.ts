import * as Phaser from 'phaser';
import type { GameAction } from '../input';

export interface ModalFocusable {
  focus(): void;
  blur(): void;
  activate(): void;
  bounds(): Phaser.Geom.Rectangle;
}

/**
 * Focus-ring manager for modal dialogs.
 *
 * Owns:
 *   - the ordered list of focusables (links, buttons, quiz choices, ...)
 *   - the focus arrow sprite drawn next to the active item
 *   - input listener registration + cleanup on close
 *
 * Intentionally does not know what the focusables *are*; callers register
 * any object conforming to {@link ModalFocusable}. The navigator simply
 * binds NavigateUp/Down/Confirm and delegates. Additional key bindings
 * (e.g. quiz A–D quick-answer) can be attached via {@link bind}.
 *
 * The focus arrow is deliberately NOT added to the caller's container,
 * so that `container.removeAt(...)`-style panel rebuilds (common in the
 * quiz flow between question/feedback/results screens) can't destroy it
 * out from under the navigator. The arrow gets its depth and scrollFactor
 * set directly so it still sits above the modal backdrop.
 */
export class ModalKeyboardNavigator {
  private focusables: ModalFocusable[] = [];
  private focusIndex = -1;
  private focusArrow: Phaser.GameObjects.Text;
  private handlers: Array<{ action: GameAction; handler: () => void }> = [];

  constructor(private readonly scene: Phaser.Scene) {
    this.focusArrow = scene.add.text(0, 0, '\u25b6', {
      fontFamily: 'monospace', fontSize: '16px', color: '#ffd700', fontStyle: 'bold',
    })
      .setOrigin(0.5, 0.5)
      .setScrollFactor(0)
      .setDepth(201)
      .setVisible(false);
  }

  /** Register a focusable and return its index. */
  add(f: ModalFocusable): number {
    this.focusables.push(f);
    return this.focusables.length - 1;
  }

  /**
   * Insert a focusable at a specific index (used when the quiz button
   * promotes from cooldown). Shifts the current focus index if needed so
   * the previously-focused element stays focused after the insert.
   */
  insert(index: number, f: ModalFocusable): void {
    this.focusables.splice(index, 0, f);
    if (this.focusIndex >= index) {
      this.focusIndex++;
      this.refreshArrow();
    }
  }

  /** Clear all focusables (e.g. when re-rendering the quiz screen). */
  reset(): void {
    this.focusables = [];
    this.focusIndex = -1;
    this.focusArrow.setVisible(false);
  }

  size(): number {
    return this.focusables.length;
  }

  currentIndex(): number {
    return this.focusIndex;
  }

  get(index: number): ModalFocusable | undefined {
    return this.focusables[index];
  }

  setFocus(index: number): void {
    if (index < 0 || index >= this.focusables.length) return;
    const prev = this.focusables[this.focusIndex];
    if (prev) prev.blur();
    this.focusIndex = index;
    const cur = this.focusables[index]!;
    cur.focus();
    this.refreshArrow();
  }

  activateFocused(): void {
    this.focusables[this.focusIndex]?.activate();
  }

  focusNext(): void {
    if (this.focusables.length === 0) return;
    this.setFocus((this.focusIndex + 1) % this.focusables.length);
  }

  focusPrev(): void {
    if (this.focusables.length === 0) return;
    this.setFocus(
      (this.focusIndex - 1 + this.focusables.length) % this.focusables.length,
    );
  }

  /** Hide the focus arrow (caller decides when — e.g. scrolled off-viewport). */
  hideArrow(): void {
    this.focusArrow.setVisible(false);
  }

  /** Move arrow to the current focusable's bounds. */
  refreshArrow(): void {
    if (this.focusIndex < 0) return;
    const cur = this.focusables[this.focusIndex];
    if (!cur) return;
    const b = cur.bounds();
    this.focusArrow.setPosition(b.x - 14, b.y + b.height / 2);
    this.focusArrow.setVisible(true);
  }

  /** Bind a game action to a handler; unregistered automatically on destroy(). */
  bind(action: GameAction, handler: () => void): void {
    this.scene.inputs.on(action, handler);
    this.handlers.push({ action, handler });
  }

  /** Clear all input listeners and destroy the arrow. Call from onBeforeClose. */
  destroy(): void {
    for (const { action, handler } of this.handlers) {
      this.scene.inputs.off(action, handler);
    }
    this.handlers = [];
    this.focusArrow.destroy();
  }
}

/** Wrap a Phaser.Text in the ModalFocusable interface with hover-like color swap. */
export function makeTextFocusable(
  text: Phaser.GameObjects.Text,
  normalColor: string,
  focusColor: string,
): ModalFocusable {
  return {
    focus: () => text.setColor(focusColor),
    blur: () => text.setColor(normalColor),
    activate: () => text.emit('pointerdown'),
    bounds: () => text.getBounds(),
  };
}
