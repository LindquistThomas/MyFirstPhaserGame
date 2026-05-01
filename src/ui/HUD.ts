import * as Phaser from 'phaser';
import { GAME_WIDTH, type FloorId } from '../config/gameConfig';
import { ProgressionSystem } from '../systems/ProgressionSystem';
import { LEVEL_DATA } from '../config/levelData';
import { createSceneLifecycle } from '../systems/sceneLifecycle';
import { theme } from '../style/theme';
import { getSizeClass, getLayoutTokens, type SizeClass, type LayoutTokens } from '../style/responsive';
import { Toast } from './Toast';
import { MuteIconController } from './hud/MuteIconController';
import { CoinCounterController } from './hud/CoinCounterController';
import { lighten } from './hud/colorUtils';
import { ProgressStripController } from './hud/ProgressStripController';
import { CaffeineRingController } from './hud/CaffeineRingController';
import { AchievementBadgeController } from './hud/AchievementBadgeController';

const HUD_HEIGHT = 44;

function persistenceMessage(reason: 'quota' | 'unavailable' | 'parse' | 'unknown'): string {
  switch (reason) {
    case 'quota':       return 'Storage full — close other tabs or clear site data to save progress.';
    case 'unavailable': return 'Browser storage is unavailable. Progress will not be saved (try disabling Private Browsing).';
    case 'parse':       return "Existing save couldn't be read. Starting a new save.";
    default:            return 'Save failed — your progress may not be stored.';
  }
}

export class HUD {
  private readonly scene: Phaser.Scene;
  private readonly progression: ProgressionSystem;
  private bg!: Phaser.GameObjects.Graphics;
  private titleText!: Phaser.GameObjects.Text;
  private toast!: Toast;
  private muteCtrl!: MuteIconController;
  private coinCtrl!: CoinCounterController;
  private progressCtrl!: ProgressStripController;
  private caffeineCtrl!: CaffeineRingController;
  private achievementCtrl!: AchievementBadgeController;
  private lastAU = 0;
  private lastFloor: FloorId | -1 = -1;
  private sizeClass: SizeClass = 'wide';
  private tokens: LayoutTokens = getLayoutTokens('wide');

  constructor(scene: Phaser.Scene, progression: ProgressionSystem) {
    this.scene = scene;
    this.progression = progression;
    const displayW = (scene.scale as { displaySize?: { width: number } })?.displaySize?.width ?? GAME_WIDTH;
    this.sizeClass = getSizeClass(displayW);
    this.tokens = getLayoutTokens(this.sizeClass);
    this.create();
  }

  private create(): void {
    const container = this.scene.add.container(0, 0).setDepth(50).setScrollFactor(0);

    this.bg = this.scene.add.graphics();
    container.add(this.bg as unknown as Phaser.GameObjects.GameObject);

    this.toast = new Toast(this.scene);

    // Sub-controllers — each manages its own graphics and event subscriptions.
    this.coinCtrl = new CoinCounterController(this.scene, container, this.progression, this.tokens);
    this.progressCtrl = new ProgressStripController(this.scene, container, this.progression, this.toast, this.tokens);
    this.muteCtrl = new MuteIconController(this.scene, container);
    this.caffeineCtrl = new CaffeineRingController(this.scene, container);
    this.achievementCtrl = new AchievementBadgeController(this.scene, container, this.toast);

    // Game title (center) — decorative chrome, hidden on compact viewports.
    this.titleText = this.scene.add.text(GAME_WIDTH / 2, 14, 'SO YOU WANT TO BE AN ARCHITECT', {
      fontFamily: 'monospace', fontSize: this.tokens.hudFontTitle,
      color: theme.color.css.textQuizMuted, fontStyle: 'bold',
    }).setOrigin(0.5, 0).setAlpha(0.6);
    this.titleText.setVisible(this.sizeClass !== 'compact');
    container.add(this.titleText as unknown as Phaser.GameObjects.GameObject);

    const lifecycle = createSceneLifecycle(this.scene);
    lifecycle.bindEventBus('persistence:failed', (payload) => {
      this.toast.show(persistenceMessage(payload.reason));
    });

    const onResize = (): void => {
      const w = (this.scene.scale as { displaySize?: { width: number } })?.displaySize?.width ?? GAME_WIDTH;
      const newClass = getSizeClass(w);
      if (newClass !== this.sizeClass) {
        this.sizeClass = newClass;
        this.tokens = getLayoutTokens(newClass);
        this.relayout();
      }
    };
    this.scene.scale.on('resize', onResize, this);
    lifecycle.add(() => this.scene.scale.off('resize', onResize, this));

    this.lastAU = this.progression.getTotalAU();
    this.redrawBackground();
  }

  private relayout(): void {
    this.coinCtrl.relayout(this.tokens);
    this.progressCtrl.relayout(this.tokens);
    this.titleText.setStyle({ fontSize: this.tokens.hudFontTitle });
    this.titleText.setVisible(this.sizeClass !== 'compact');
  }

  /** Gradient HUD bar with theme-coloured accent line. Repaints only when floor changes. */
  private redrawBackground(): void {
    const floor = this.progression.getCurrentFloor();
    const fd = LEVEL_DATA[floor];
    const accent = fd ? lighten(fd.theme.platformColor, 0.35) : theme.color.ui.accent;
    const top = 0x0a1428;
    const bottom = theme.color.bg.shaft;
    const alpha = 0.8;

    const g = this.bg;
    g.clear();
    g.fillGradientStyle(top, top, bottom, bottom, alpha);
    g.fillRect(0, 0, GAME_WIDTH, HUD_HEIGHT);
    g.fillStyle(0xffffff, 0.06);
    g.fillRect(0, 0, GAME_WIDTH, 1);
    g.fillStyle(0xffffff, 0.04);
    g.fillRect(216, 10, 1, HUD_HEIGHT - 20);
    g.fillRect(GAME_WIDTH - 220, 10, 1, HUD_HEIGHT - 20);
    g.fillStyle(accent, 0.9);
    g.fillRect(0, HUD_HEIGHT - 1, GAME_WIDTH, 1);
  }

  /**
   * Display a notification toast. Used by LevelScene to show coaching hints
   * and any other code that needs to surface a temporary message.
   */
  showToast(message: string, duration?: number): void {
    this.toast.show(message, duration);
  }

  update(): void {
    const au = this.progression.getTotalAU();
    const floor = this.progression.getCurrentFloor();
    const floorChanged = floor !== this.lastFloor;
    const auChanged = au !== this.lastAU;

    if (floorChanged) {
      this.lastFloor = floor;
      this.redrawBackground();
    }

    this.coinCtrl.update(au, this.lastAU);
    this.lastAU = au;

    this.progressCtrl.update(au, floor, floorChanged, auChanged, this.scene.time.now);
    this.caffeineCtrl.update(this.scene.time.now);
  }
}
