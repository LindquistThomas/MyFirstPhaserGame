import * as Phaser from 'phaser';
import { theme } from '../style/theme';

export interface ButtonListFocusable {
  focus(): void;
  blur(): void;
  activate(): void;
  bounds(): Phaser.Geom.Rectangle;
}

export class ButtonListNavigator {
  private readonly focusables: ButtonListFocusable[] = [];
  private focusIndex = -1;
  private readonly ring: Phaser.GameObjects.Graphics;

  constructor(private readonly scene: Phaser.Scene, private readonly depth = 202) {
    this.ring = scene.add.graphics();
    (this.ring.setScrollFactor as ((v: number) => Phaser.GameObjects.Graphics) | undefined)?.call(this.ring, 0);
    (this.ring.setDepth as ((v: number) => Phaser.GameObjects.Graphics) | undefined)?.call(this.ring, depth);
    (this.ring.setVisible as ((v: boolean) => Phaser.GameObjects.Graphics) | undefined)?.call(this.ring, false);
  }

  add(focusable: ButtonListFocusable): number {
    this.focusables.push(focusable);
    return this.focusables.length - 1;
  }

  size(): number {
    return this.focusables.length;
  }

  currentIndex(): number {
    return this.focusIndex;
  }

  setFocus(index: number): void {
    if (index < 0 || index >= this.focusables.length) return;

    const prev = this.focusables[this.focusIndex];
    if (prev) prev.blur();

    this.focusIndex = index;
    const cur = this.focusables[index];
    if (!cur) return;

    cur.focus();
    this.renderRing(cur.bounds());
  }

  focusNext(): void {
    if (this.focusables.length === 0) return;
    const next = this.focusIndex < 0 ? 0 : (this.focusIndex + 1) % this.focusables.length;
    this.setFocus(next);
  }

  focusPrev(): void {
    if (this.focusables.length === 0) return;
    const next = this.focusIndex < 0
      ? this.focusables.length - 1
      : (this.focusIndex - 1 + this.focusables.length) % this.focusables.length;
    this.setFocus(next);
  }

  activateFocused(): void {
    this.focusables[this.focusIndex]?.activate();
  }

  hideRing(): void {
    (this.ring.clear as (() => Phaser.GameObjects.Graphics) | undefined)?.call(this.ring);
    (this.ring.setVisible as ((v: boolean) => Phaser.GameObjects.Graphics) | undefined)?.call(this.ring, false);
  }

  destroy(): void {
    this.ring.destroy();
  }

  private renderRing(bounds: Phaser.Geom.Rectangle): void {
    const padX = 8;
    const padY = 6;
    const x = bounds.x - padX;
    const y = bounds.y - padY;
    const w = bounds.width + padX * 2;
    const h = bounds.height + padY * 2;

    (this.ring.clear as (() => Phaser.GameObjects.Graphics) | undefined)?.call(this.ring);
    (this.ring.fillStyle as ((c: number, a?: number) => Phaser.GameObjects.Graphics) | undefined)?.call(this.ring, theme.color.ui.accentAlt, 0.2);
    if (typeof this.ring.fillRoundedRect === 'function') {
      this.ring.fillRoundedRect(x, y, w, h, 8);
    } else if (typeof this.ring.fillRect === 'function') {
      this.ring.fillRect(x, y, w, h);
    }
    (this.ring.lineStyle as ((w: number, c: number, a?: number) => Phaser.GameObjects.Graphics) | undefined)?.call(this.ring, 2, theme.color.ui.hover, 1);
    if (typeof this.ring.strokeRoundedRect === 'function') {
      this.ring.strokeRoundedRect(x, y, w, h, 8);
    } else if (typeof this.ring.strokeRect === 'function') {
      this.ring.strokeRect(x, y, w, h);
    }
    (this.ring.setVisible as ((v: boolean) => Phaser.GameObjects.Graphics) | undefined)?.call(this.ring, true);
  }
}
