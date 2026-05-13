import * as Phaser from 'phaser';
import { GAME_WIDTH, type FloorId } from '../config/gameConfig';
import { ProgressionSystem } from '../systems/ProgressionSystem';
import { PlaytimeTracker } from '../systems/PlaytimeTracker';
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
import { settingsStore } from '../systems/SettingsStore';
import { isReducedMotion } from '../systems/MotionPreference';
import { ObjectiveBanner } from './ObjectiveBanner';

const HUD_HEIGHT = 44;
const RUN_TIMER_Y = 32;

/** Format milliseconds as M:SS (e.g. 125 300 ms → "2:05"). */
export function formatPlaytime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

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
  private readonly playtime: PlaytimeTracker | null;
  private bg!: Phaser.GameObjects.Graphics;
  private titleText!: Phaser.GameObjects.Text;
  private timerText!: Phaser.GameObjects.Text;
  private toast!: Toast;
  private muteCtrl!: MuteIconController;
  private coinCtrl!: CoinCounterController;
  private progressCtrl!: ProgressStripController;
  private caffeineCtrl!: CaffeineRingController;
  private achievementCtrl!: AchievementBadgeController;
  private objectiveBanner?: ObjectiveBanner;
  private readonly getObjectiveText: () => string;
  private readonly isObjectiveHidden: () => boolean;
  private lastAU = 0;
  private lastFloor: FloorId | -1 = -1;
  private sizeClass: SizeClass = 'wide';
  private tokens: LayoutTokens = getLayoutTokens('wide');
  private destroyed = false;

  constructor(
    scene: Phaser.Scene,
    progression: ProgressionSystem,
    playtime?: PlaytimeTracker,
    options?: {
      getObjectiveText?: () => string;
      isObjectiveHidden?: () => boolean;
    },
  ) {
    this.scene = scene;
    this.progression = progression;
    this.playtime = playtime ?? null;
    this.getObjectiveText = options?.getObjectiveText ?? (() => '');
    this.isObjectiveHidden = options?.isObjectiveHidden ?? (() => false);
    const displayW = (scene.scale as { displaySize?: { width: number } })?.displaySize?.width ?? GAME_WIDTH;
    this.sizeClass = getSizeClass(displayW);
    this.tokens = getLayoutTokens(this.sizeClass, settingsStore.read().textScale);
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
    this.applyTitleTextContrast();
    this.titleText.setVisible(this.sizeClass !== 'compact');
    container.add(this.titleText as unknown as Phaser.GameObjects.GameObject);

    // Run timer — small M:SS counter in the top-right corner.
    // Visibility is controlled by SettingsStore.showRunTimer.
    this.timerText = this.scene.add.text(GAME_WIDTH - 10, RUN_TIMER_Y, '0:00', {
      fontFamily: 'monospace', fontSize: '12px',
      color: theme.color.css.textMuted,
    }).setOrigin(1, 0.5);
    this.timerText.setVisible(this._isTimerVisible());
    container.add(this.timerText as unknown as Phaser.GameObjects.GameObject);

    this.objectiveBanner = new ObjectiveBanner(this.scene, {
      getText: this.getObjectiveText,
      isModalOpen: this.isObjectiveHidden,
    });

    const lifecycle = createSceneLifecycle(this.scene);
    lifecycle.add(() => this.destroy());
    lifecycle.bindEventBus('persistence:failed', (payload) => {
      // When the boot-time probe returned false the player has already been
      // told via the guest-mode banner. Suppress ALL persistence toasts for
      // the session — not just 'unavailable', because a blocked localStorage
      // can surface as 'quota' or 'unknown' from SaveManager depending on
      // the browser and error type.
      if (this.scene.registry.get('persistenceAvailable') === false) {
        return;
      }
      this.toast.show(persistenceMessage(payload.reason));
    });
    // Re-render the title text colour when the high-contrast setting changes
    // so canvas HUD text also benefits from the accessibility toggle.
    // Also refresh the coin icon when the color-blind mode changes.
    // Also refresh tokens when textScale changes.
    lifecycle.bindEventBus('settings:changed', () => {
      this.applyTitleTextContrast();
      this.coinCtrl.refreshCoinColor();
      const newTokens = getLayoutTokens(this.sizeClass, settingsStore.read().textScale);
      this.tokens = newTokens;
      this.relayout();
    });

    const onResize = (): void => {
      const w = (this.scene.scale as { displaySize?: { width: number } })?.displaySize?.width ?? GAME_WIDTH;
      const newClass = getSizeClass(w);
      if (newClass !== this.sizeClass) {
        this.sizeClass = newClass;
        this.tokens = getLayoutTokens(newClass, settingsStore.read().textScale);
        this.relayout();
      }
    };
    this.scene.scale.on('resize', onResize, this);
    lifecycle.add(() => this.scene.scale.off('resize', onResize, this));

    const au = this.progression.getTotalAU();
    const floor = this.progression.getCurrentFloor();
    this.lastAU = au;
    this.lastFloor = floor;
    this.redrawBackground();
    this.progressCtrl.update(au, floor, true, true, this.scene.time.now);
  }

  private relayout(): void {
    this.coinCtrl.relayout(this.tokens);
    this.progressCtrl.relayout(this.tokens);
    this.titleText.setStyle({ fontSize: this.tokens.hudFontTitle });
    this.titleText.setVisible(this.sizeClass !== 'compact');
    this.timerText.setVisible(this._isTimerVisible());
  }

  /**
   * Apply colour and alpha to the HUD title text based on the current
   * `highContrast` setting.
   *
   * Default (no high-contrast): muted colour at 0.6 alpha — decorative.
   * High-contrast: primary text colour at full alpha — readable for
   * low-vision players and matches the intent of the accessibility toggle.
   *
   * Called once in `create()` and again whenever `settings:changed` fires.
   */
  private applyTitleTextContrast(): void {
    const highContrast = settingsStore.read().highContrast;
    this.titleText
      .setColor(highContrast ? theme.color.css.textPrimary : theme.color.css.textQuizMuted)
      .setAlpha(highContrast ? 1 : 0.6);
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
    this.objectiveBanner?.update();

    // Update run timer.
    if (this.playtime !== null) {
      const runMs = this.playtime.getRunElapsedMs();
      this.timerText.setText(formatPlaytime(runMs));
    }
  }

  /** Whether the timer widget should be visible. */
  private _isTimerVisible(): boolean {
    if (this.playtime === null) return false;
    return settingsStore.read().showRunTimer;
  }

  private destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.coinCtrl.destroy();
    this.progressCtrl.destroy();
    this.muteCtrl.destroy();
    this.caffeineCtrl.destroy();
    this.achievementCtrl.destroy();
    this.toast.destroy();
  }
}
