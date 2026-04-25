import * as Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../../config/gameConfig';
import { eventBus } from '../../systems/EventBus';
import { theme } from '../../style/theme';
import { createSceneLifecycle } from '../../systems/sceneLifecycle';
import { pushContext, popContext } from '../../input';

const PANEL_WIDTH = 360;
const PANEL_HEIGHT = 280;

/**
 * Full-screen pause overlay launched as a sibling scene alongside any
 * `LevelScene`-derived scene.
 *
 * Flow:
 *   1. Parent level calls `scene.launch('PauseScene', { parentKey })`.
 *   2. `create()` pauses the parent and ducks the music.
 *   3. Resume (Esc / Enter on "Resume") restores the parent and music.
 *   4. Quit to Menu stops the parent scene and navigates to `MenuScene`.
 */
export class PauseScene extends Phaser.Scene {
  private parentKey = '';
  private selectedIndex = 0;
  private menuItems: Array<{ btn: Phaser.GameObjects.Text; action: () => void }> = [];

  constructor() {
    super({ key: 'PauseScene' });
  }

  init(data: { parentKey: string }): void {
    this.parentKey = data.parentKey;
    this.selectedIndex = 0;
    this.menuItems = [];
  }

  create(): void {
    // Pause the parent level scene (stops physics, tweens, update loop).
    this.scene.pause(this.parentKey);
    // Pause music while overlay is shown.
    eventBus.emit('music:pause');

    this.buildOverlay();
    this.buildPanel();
    this.setupKeyboard();
  }

  private buildOverlay(): void {
    const overlay = this.add.rectangle(
      GAME_WIDTH / 2, GAME_HEIGHT / 2,
      GAME_WIDTH, GAME_HEIGHT,
      theme.color.bg.dark, 0.65,
    );
    overlay.setScrollFactor(0).setDepth(190);
    // Block pointer events so clicks cannot reach the paused parent scene.
    overlay.setInteractive();
  }

  private buildPanel(): void {
    const cx = GAME_WIDTH / 2;
    const cy = GAME_HEIGHT / 2;

    const container = this.add.container(cx, cy);
    container.setDepth(200);
    container.setScrollFactor(0);

    // Panel background
    const panel = this.add.graphics();
    panel.fillStyle(theme.color.ui.panel, 0.97);
    panel.fillRoundedRect(-PANEL_WIDTH / 2, -PANEL_HEIGHT / 2, PANEL_WIDTH, PANEL_HEIGHT, 12);
    panel.lineStyle(2, theme.color.ui.border, 0.8);
    panel.strokeRoundedRect(-PANEL_WIDTH / 2, -PANEL_HEIGHT / 2, PANEL_WIDTH, PANEL_HEIGHT, 12);
    container.add(panel);

    // Title
    const title = this.add.text(0, -PANEL_HEIGHT / 2 + 44, 'PAUSED', {
      fontFamily: 'monospace',
      fontSize: '36px',
      color: theme.color.css.textAccent,
      fontStyle: 'bold',
    }).setOrigin(0.5);
    container.add(title);

    // Divider
    const divider = this.add.graphics();
    divider.lineStyle(1, theme.color.ui.border, 0.4);
    divider.lineBetween(-PANEL_WIDTH / 2 + 24, -PANEL_HEIGHT / 2 + 82, PANEL_WIDTH / 2 - 24, -PANEL_HEIGHT / 2 + 82);
    container.add(divider);

    // Resume button (index 0)
    const resumeBtn = this.makeButton('Resume  [Esc / Enter]', 0, 30, () => this.resumeGame());
    container.add(resumeBtn);

    // Quit to Menu button (index 1)
    const quitBtn = this.makeButton('Quit to Menu', 0, 110, () => this.quitToMenu());
    container.add(quitBtn);

    // Hint text
    const hint = this.add.text(0, PANEL_HEIGHT / 2 - 24, 'Progress is saved automatically', {
      fontFamily: 'monospace',
      fontSize: '13px',
      color: theme.color.css.textMuted,
    }).setOrigin(0.5);
    container.add(hint);

    // Fade in
    container.setAlpha(0);
    this.tweens.add({ targets: container, alpha: 1, duration: 150 });

    // Apply initial selection highlight.
    this.updateSelection();
  }

  private makeButton(
    label: string,
    x: number,
    y: number,
    action: () => void,
  ): Phaser.GameObjects.Text {
    const btn = this.add.text(x, y, label, {
      fontFamily: 'monospace',
      fontSize: '22px',
      color: theme.color.css.textWhite,
      backgroundColor: theme.color.css.bgPanel,
      padding: { x: 24, y: 10 },
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    btn.on('pointerover', () => {
      // Sync pointer hover with keyboard selection.
      const idx = this.menuItems.findIndex((m) => m.btn === btn);
      if (idx !== -1) {
        this.selectedIndex = idx;
        this.updateSelection();
      }
    });
    btn.on('pointerdown', action);

    this.menuItems.push({ btn, action });
    return btn;
  }

  private setupKeyboard(): void {
    // Push 'menu' context so NavigateUp/Down/Confirm/Cancel fire.
    const contextToken = pushContext('menu');
    const lc = createSceneLifecycle(this);
    lc.add(() => popContext(contextToken));

    // Esc (Cancel in menu context) → always resume.
    lc.bindInput('Cancel', () => this.resumeGame());
    lc.bindInput('NavigateUp', () => this.moveSelection(-1));
    lc.bindInput('NavigateDown', () => this.moveSelection(1));
    lc.bindInput('Confirm', () => this.activateSelection());
  }

  private moveSelection(delta: number): void {
    const n = this.menuItems.length;
    if (n === 0) return;
    this.selectedIndex = (this.selectedIndex + delta + n) % n;
    this.updateSelection();
  }

  private activateSelection(): void {
    const item = this.menuItems[this.selectedIndex];
    if (item) item.action();
  }

  private updateSelection(): void {
    this.menuItems.forEach((item, i) => {
      if (i === this.selectedIndex) {
        item.btn.setColor(theme.color.css.textAccent).setScale(1.05);
      } else {
        item.btn.setColor(theme.color.css.textWhite).setScale(1.0);
      }
    });
  }

  private resumeGame(): void {
    eventBus.emit('music:resume');
    this.scene.resume(this.parentKey);
    this.scene.stop();
  }

  private quitToMenu(): void {
    // Stop current music explicitly so there is no gap between the level
    // track stopping and MenuScene's MusicPlugin starting the menu track.
    eventBus.emit('music:stop');
    this.scene.stop(this.parentKey);
    this.scene.start('MenuScene');
  }
}
