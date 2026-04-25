import * as Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, COLORS } from '../../config/gameConfig';
import { GameStateManager } from '../../systems/GameStateManager';
import { pushContext, popContext } from '../../input';
import { createSceneLifecycle } from '../../systems/sceneLifecycle';

interface SettingsInitData {
  from?: string;
}

interface SettingsRow {
  label: Phaser.GameObjects.Text;
  action: () => void;
}

/**
 * Settings screen reachable from the main menu.
 *
 * Currently provides:
 *   - Replay tutorial — clears `onboardingComplete` so the welcome modal and
 *     control hints reappear on the next lobby entry.
 *   - Back — returns to the calling scene.
 *
 * Keyboard: ↑↓ select row, Enter/Space confirm, Esc back.
 */
export class SettingsScene extends Phaser.Scene {
  private fromScene = 'MenuScene';
  private gameState!: GameStateManager;
  private rows: SettingsRow[] = [];
  private selectedIndex = 0;

  constructor() {
    super({ key: 'SettingsScene' });
  }

  init(data?: SettingsInitData): void {
    this.fromScene = data?.from ?? 'MenuScene';
    this.gameState = this.registry.get('gameState') as GameStateManager;
  }

  create(): void {
    this.rows = [];
    this.selectedIndex = 0;
    this.cameras.main.setBackgroundColor(0x05060f);
    this.cameras.main.fadeIn(400, 0, 0, 0);

    this.buildUI();
    this.setupInput();
    this.updateSelection();
  }

  private buildUI(): void {
    const cx = GAME_WIDTH / 2;
    const cy = GAME_HEIGHT / 2;

    // Title
    this.add.text(cx, cy - 220, 'SETTINGS', {
      fontFamily: 'monospace', fontSize: '38px',
      color: '#ffffff', fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(10)
      .setShadow(0, 0, '#0099cc', 16, true, true);

    // Replay tutorial row
    this.addRow(cx, cy - 80, '[ Replay Tutorial ]', 22, () => this.replayTutorial());

    // Back row
    this.addRow(cx, cy - 80 + 70, '[ Back ]', 20, () => this.goBack());
  }

  private addRow(x: number, y: number, label: string, fontPx: number, action: () => void): void {
    const text = this.add.text(x, y, label, {
      fontFamily: 'monospace', fontSize: `${fontPx}px`, color: COLORS.titleText,
      padding: { x: 24, y: 12 },
    }).setOrigin(0.5).setInteractive({ useHandCursor: true }).setDepth(10);

    text.on('pointerover', () => {
      const idx = this.rows.findIndex(r => r.label === text);
      if (idx >= 0) { this.selectedIndex = idx; this.updateSelection(); }
    });
    text.on('pointerout', () => this.updateSelection());
    text.on('pointerdown', action);

    this.rows.push({ label: text, action });
  }

  private setupInput(): void {
    const token = pushContext('menu');
    const lifecycle = createSceneLifecycle(this);
    lifecycle.add(() => popContext(token));
    lifecycle.bindInput('NavigateUp',   () => this.moveSelection(-1));
    lifecycle.bindInput('NavigateDown', () => this.moveSelection(1));
    lifecycle.bindInput('Confirm',      () => this.activateSelection());
    lifecycle.bindInput('Cancel',       () => this.goBack());
  }

  private moveSelection(delta: number): void {
    if (this.rows.length === 0) return;
    this.selectedIndex = (this.selectedIndex + delta + this.rows.length) % this.rows.length;
    this.updateSelection();
  }

  private activateSelection(): void {
    this.rows[this.selectedIndex]?.action();
  }

  private updateSelection(): void {
    this.rows.forEach((row, i) => {
      if (i === this.selectedIndex) {
        row.label.setColor('#ffffff').setScale(1.08);
      } else {
        row.label.setColor(COLORS.titleText).setScale(1.0);
      }
    });
  }

  private replayTutorial(): void {
    this.gameState?.resetOnboarding();
    this.goBack();
  }

  private goBack(): void {
    this.cameras.main.fadeOut(400, 0, 0, 0);
    this.time.delayedCall(400, () => this.scene.start(this.fromScene));
  }
}
