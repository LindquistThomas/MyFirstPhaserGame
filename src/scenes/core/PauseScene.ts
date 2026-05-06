import * as Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../../config/gameConfig';
import { eventBus } from '../../systems/EventBus';
import { theme } from '../../style/theme';
import { createSceneLifecycle, type SceneLifecycle } from '../../systems/sceneLifecycle';
import { pushContext, popContext } from '../../input';
import { GameStateManager } from '../../systems/GameStateManager';
import { formatPlaytime } from '../../ui/HUD';
import { LEVEL_DATA } from '../../config/levelData';
import { ControlsReferenceModal } from '../../ui/ControlsReferenceModal';

const PANEL_WIDTH = 360;
const PANEL_HEIGHT = 520;

/**
 * Full-screen pause overlay launched as a sibling scene alongside any
 * `LevelScene`-derived scene.
 *
 * Flow:
 *   1. Parent level calls `scene.launch('PauseScene', { parentKey })`.
 *   2. `create()` pauses the parent and ducks the music.
 *   3. Resume (Esc / Enter on "Resume") restores the parent and music.
 *   4. Settings launches SettingsScene as an overlay; PauseScene stays alive (hidden).
 *   5. Quit to Menu stops the parent scene and navigates to `MenuScene`.
 */
export class PauseScene extends Phaser.Scene {
  private parentKey = '';
  private selectedIndex = 0;
  private menuItems: Array<{ btn: Phaser.GameObjects.Text; action: () => void }> = [];
  /** Active input lifecycle — disposed when Settings/Controls overlay opens, recreated on return. */
  private lc!: SceneLifecycle;
  private gameState!: GameStateManager;
  /** When true, immediately open the Controls modal after create(). */
  private showControlsOnCreate = false;

  constructor() {
    super({ key: 'PauseScene' });
  }

  init(data: { parentKey: string; showControls?: boolean }): void {
    this.parentKey = data.parentKey;
    this.selectedIndex = 0;
    this.menuItems = [];
    this.gameState = this.registry.get('gameState') as GameStateManager;
    this.showControlsOnCreate = data.showControls === true;
  }

  create(): void {
    // Pause the parent level scene (stops physics, tweens, update loop).
    this.scene.pause(this.parentKey);
    // Pause music while overlay is shown.
    eventBus.emit('music:pause');

    this.buildOverlay();
    this.buildPanel();
    this.setupKeyboard();

    // If launched via the ShowControls hotkey, open the Controls modal immediately
    // and close PauseScene automatically when the modal is dismissed.
    if (this.showControlsOnCreate) {
      this.openControlsModal(true);
    }
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
    const resumeBtn = this.makeButton('Resume  [Esc / Enter]', 0, -PANEL_HEIGHT / 2 + 110, () => this.resumeGame());
    container.add(resumeBtn);

    // Settings button (index 1)
    const settingsBtn = this.makeButton('Settings', 0, -PANEL_HEIGHT / 2 + 180, () => this.openSettings());
    container.add(settingsBtn);

    // Controls button (index 2)
    const controlsBtn = this.makeButton('Controls', 0, -PANEL_HEIGHT / 2 + 250, () => this.openControlsModal());
    container.add(controlsBtn);

    // Quit to Menu button (index 3)
    const quitBtn = this.makeButton('Quit to Menu', 0, -PANEL_HEIGHT / 2 + 320, () => this.quitToMenu());
    container.add(quitBtn);

    // Playtime stats
    this.buildPlaytimeStats(container);

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

  private buildPlaytimeStats(container: Phaser.GameObjects.Container): void {
    const tracker = this.gameState?.playtime;
    if (!tracker) return;

    const statsY = -PANEL_HEIGHT / 2 + 400;
    const divider2 = this.add.graphics();
    divider2.lineStyle(1, theme.color.ui.border, 0.3);
    divider2.lineBetween(-PANEL_WIDTH / 2 + 24, statsY - 8, PANEL_WIDTH / 2 - 24, statsY - 8);
    container.add(divider2);

    const totalMs = tracker.getTotalMs();
    const totalText = this.add.text(0, statsY + 4, `Total: ${formatPlaytime(totalMs)}`, {
      fontFamily: 'monospace',
      fontSize: '13px',
      color: theme.color.css.textMuted,
    }).setOrigin(0.5, 0);
    container.add(totalText);

    // Per-floor breakdown (top 3 floors sorted by time descending).
    const allFloors = tracker.getAllFloorMs();
    const sorted = Object.entries(allFloors)
      .map(([k, ms]) => ({ floorId: Number(k), ms: ms as number }))
      .filter((f) => f.ms > 0)
      .sort((a, b) => b.ms - a.ms)
      .slice(0, 3);

    let rowY = statsY + 26;
    for (const { floorId, ms } of sorted) {
      const floorName = LEVEL_DATA[floorId as keyof typeof LEVEL_DATA]?.name ?? `Floor ${floorId}`;
      const row = this.add.text(0, rowY, `${floorName}: ${formatPlaytime(ms)}`, {
        fontFamily: 'monospace',
        fontSize: '11px',
        color: theme.color.css.textPale,
      }).setOrigin(0.5, 0);
      container.add(row);
      rowY += 18;
    }
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
    this.lc = createSceneLifecycle(this);
    this.lc.add(() => popContext(contextToken));

    // Esc (Cancel in menu context) → always resume.
    this.lc.bindInput('Cancel', () => this.resumeGame());
    this.lc.bindInput('NavigateUp', () => this.moveSelection(-1));
    this.lc.bindInput('NavigateDown', () => this.moveSelection(1));
    this.lc.bindInput('Confirm', () => this.activateSelection());
    // H in menu context opens the Controls modal.
    this.lc.bindInput('ShowControls', () => this.openControlsModal());
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

  /**
   * Open the Controls reference modal.
   *
   * Disposes the menu keyboard lifecycle first so PauseScene's Cancel/Confirm
   * bindings don't fire alongside the modal's own Cancel/Confirm bindings.
   *
   * @param resumeOnDismiss When true (launched via ShowControls hotkey), closing the
   *   modal automatically resumes gameplay.  When false (player clicked "Controls"
   *   from the pause menu), PauseScene stays open and re-activates its keyboard.
   */
  private openControlsModal(resumeOnDismiss = false): void {
    this.lc.dispose();

    new ControlsReferenceModal(
      this,
      // onClose: normal dismiss — either resume gameplay or restore PauseScene keyboard.
      () => {
        if (resumeOnDismiss) {
          this.resumeGame();
        } else {
          this.setupKeyboard();
        }
      },
      // onRebind: user clicked "Rebind..." — open Settings using the same PauseScene
      // flow (launch + hide) so the pause:settings-closed path works correctly.
      () => { this.openSettings(); },
    );
  }

  private openSettings(): void {
    // Dispose input handlers so PauseScene's Cancel/Confirm/Navigate bindings
    // don't fire while SettingsScene is the active overlay — both share those
    // actions in 'menu' / 'modal' contexts and the global context stack would
    // otherwise allow both scenes' handlers to trigger on the same keypress.
    this.lc.dispose();

    // Re-activate input once SettingsScene signals it has closed.
    const resumeLc = createSceneLifecycle(this);
    resumeLc.bindEventBus('pause:settings-closed', () => {
      resumeLc.dispose();
      this.setupKeyboard();
    });

    this.scene.launch('SettingsScene', { from: 'PauseScene' });
    this.scene.bringToTop('SettingsScene');
    this.scene.setVisible(false);
  }

  private quitToMenu(): void {
    // Stop current music explicitly so there is no gap between the level
    // track stopping and MenuScene's MusicPlugin starting the menu track.
    eventBus.emit('music:stop');
    this.scene.stop(this.parentKey);
    this.scene.start('MenuScene');
  }
}
