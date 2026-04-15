import * as Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../config/gameConfig';

export interface ElevatorButtonState {
  up: boolean;
  down: boolean;
}

/**
 * Reusable on-screen ▲/▼ elevator buttons.
 *
 * Appears when the player stands on an elevator and hides when they
 * step off.  Both HubScene and LevelScene share this component.
 */
export class ElevatorButtons {
  private container: Phaser.GameObjects.Container;
  private state: ElevatorButtonState = { up: false, down: false };
  private upBg: Phaser.GameObjects.Graphics;
  private downBg: Phaser.GameObjects.Graphics;
  private btnSize: number;
  private downY: number;
  private scene: Phaser.Scene;
  private releaseAllButtons: () => void;

  constructor(scene: Phaser.Scene, btnSize = 56) {
    this.scene = scene;
    this.btnSize = btnSize;
    this.downY = btnSize + 8;
    this.releaseAllButtons = () => {
      if (!this.container.visible) return;
      this.resetState();
    };

    const margin = 16;
    const rightEdge = GAME_WIDTH - margin - btnSize;
    const bottomEdge = GAME_HEIGHT - margin - btnSize * 2 - 8;

    this.container = scene.add.container(rightEdge, bottomEdge);
    this.container.setDepth(60);
    this.container.setScrollFactor(0);
    this.container.setVisible(false);

    // --- Up button ---
    this.upBg = scene.add.graphics();
    this.drawButton(this.upBg, 0, false);
    this.container.add(this.upBg);

    const upArrow = scene.add.text(btnSize / 2, btnSize / 2, '▲', {
      fontFamily: 'monospace', fontSize: `${Math.round(btnSize * 0.5)}px`, color: '#ffffff',
    }).setOrigin(0.5);
    this.container.add(upArrow);

    this.createHitArea(scene, 0, (pressed) => { this.state.up = pressed; });

    // --- Down button ---
    this.downBg = scene.add.graphics();
    this.drawButton(this.downBg, this.downY, false);
    this.container.add(this.downBg);

    const downArrow = scene.add.text(btnSize / 2, this.downY + btnSize / 2, '▼', {
      fontFamily: 'monospace', fontSize: `${Math.round(btnSize * 0.5)}px`, color: '#ffffff',
    }).setOrigin(0.5);
    this.container.add(downArrow);

    this.createHitArea(scene, this.downY, (pressed) => { this.state.down = pressed; });

    // Register scene-level release listeners once per button component instance.
    scene.input.on('pointerup', this.releaseAllButtons);
    scene.input.on('gameout', this.releaseAllButtons);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, this.destroy, this);
  }

  /* ---- public API ---- */

  getState(): ElevatorButtonState {
    return this.state;
  }

  /** Show or hide the buttons. Resets pressed state when hiding. */
  setVisible(visible: boolean): void {
    this.container.setVisible(visible);
    if (!visible) {
      this.resetState();
    }
  }

  /* ---- internals ---- */

  private resetState(): void {
    this.state.up = false;
    this.state.down = false;
    this.drawButton(this.upBg, 0, false);
    this.drawButton(this.downBg, this.downY, false);
  }

  private drawButton(bg: Phaser.GameObjects.Graphics, y: number, pressed: boolean): void {
    bg.clear();
    bg.fillStyle(pressed ? 0x44ccff : 0x00aaff, pressed ? 0.95 : 0.8);
    bg.fillRoundedRect(0, y, this.btnSize, this.btnSize, 6);
  }

  private createHitArea(
    scene: Phaser.Scene,
    y: number,
    onStateChange: (pressed: boolean) => void,
  ): void {
    const hit = scene.add.rectangle(
      this.btnSize / 2, y + this.btnSize / 2, this.btnSize, this.btnSize,
    ).setInteractive({ useHandCursor: true }).setAlpha(0.001);
    this.container.add(hit);

    const bg = y === 0 ? this.upBg : this.downBg;

    const setPressed = (pressed: boolean) => {
      onStateChange(pressed);
      this.drawButton(bg, y, pressed);
    };

    hit.on('pointerdown', () => setPressed(true));
    hit.on('pointerup', () => setPressed(false));
    hit.on('pointerout', () => setPressed(false));
    hit.on('pointerupoutside', () => setPressed(false));
  }

  private destroy(): void {
    this.scene.input.off('pointerup', this.releaseAllButtons);
    this.scene.input.off('gameout', this.releaseAllButtons);
  }
}
