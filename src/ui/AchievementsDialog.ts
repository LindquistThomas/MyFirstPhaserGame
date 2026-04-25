import * as Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../config/gameConfig';
import { theme } from '../style/theme';
import { ModalBase } from './ModalBase';
import { ModalKeyboardNavigator, makeTextFocusable } from './ModalKeyboardNavigator';
import { getAllDefs, getUnlockedIds } from '../systems/AchievementManager';
import { eventBus } from '../systems/EventBus';

const PANEL_W = 660;
const PADDING = 28;
const ROW_H = 62;
const CLOSE_BAR_H = 48;

/**
 * Full-screen modal overlay that lists all achievements and their status.
 *
 * Locked achievements show a lock icon and dimmed text; unlocked ones show
 * their icon and description in full colour. Secret achievements are shown
 * as "???" until unlocked.
 *
 * Extends {@link ModalBase} for container/overlay/fade/Esc lifecycle.
 */
export class AchievementsDialog extends ModalBase {
  private nav: ModalKeyboardNavigator;
  private scrollContainer!: Phaser.GameObjects.Container;
  private mask!: Phaser.GameObjects.Graphics;
  private scrollY = 0;
  private maxScrollY = 0;

  private wheelHandler?: (_pointer: unknown, _objectsOver: unknown[], _deltaX: number, deltaY: number) => void;
  private keyHandlers: Array<{ key: string; fn: () => void }> = [];

  constructor(scene: Phaser.Scene, onClose?: () => void) {
    super(scene);

    this.nav = new ModalKeyboardNavigator(scene);
    this.buildPanel(onClose);
    eventBus.emit('sfx:info_open');
    this.fadeIn();
  }

  private buildPanel(onClose?: () => void): void {
    const panelX = (GAME_WIDTH - PANEL_W) / 2;
    const panelH = GAME_HEIGHT - 40;
    const panelY = 20;

    // Panel background
    const bg = this.scene.add.graphics();
    bg.fillStyle(theme.color.bg.overlay, 0.97);
    bg.fillRoundedRect(panelX, panelY, PANEL_W, panelH, 10);
    bg.lineStyle(1.5, theme.color.ui.accent, 0.4);
    bg.strokeRoundedRect(panelX, panelY, PANEL_W, panelH, 10);
    bg.setScrollFactor(0);
    this.container.add(bg);

    // Title bar
    const titleBg = this.scene.add.graphics();
    titleBg.fillStyle(theme.color.ui.panel, 0.8);
    titleBg.fillRoundedRect(panelX, panelY, PANEL_W, 52, { tl: 10, tr: 10, bl: 0, br: 0 });
    titleBg.setScrollFactor(0);
    this.container.add(titleBg);

    const defs = getAllDefs();
    const unlockedIds = new Set(getUnlockedIds());
    const unlockedCount = defs.filter((d) => unlockedIds.has(d.id)).length;
    const totalCount = defs.length;

    const title = this.scene.add.text(
      GAME_WIDTH / 2, panelY + 14,
      `🏆  ACHIEVEMENTS  —  ${unlockedCount} / ${totalCount}`,
      { fontFamily: 'monospace', fontSize: '18px', color: theme.color.css.textTitle, fontStyle: 'bold' },
    ).setOrigin(0.5, 0).setScrollFactor(0);
    this.container.add(title);

    // Scroll viewport
    const viewportY = panelY + 56;
    const viewportH = panelH - 56 - CLOSE_BAR_H;

    // Mask graphics (fixed to camera)
    this.mask = this.scene.add.graphics().setScrollFactor(0);
    this.mask.fillStyle(0xffffff);
    this.mask.fillRect(panelX, viewportY, PANEL_W, viewportH);

    // Scrollable content container — starts at viewportY, clipped by mask
    this.scrollContainer = this.scene.add.container(0, viewportY);
    this.scrollContainer.setScrollFactor(0);
    this.scrollContainer.setDepth(201);
    const geometricMask = this.mask.createGeometryMask();
    this.scrollContainer.setMask(geometricMask);
    this.container.add(this.scrollContainer);

    // Achievement rows
    const contentX = panelX + PADDING;
    const contentW = PANEL_W - PADDING * 2;
    let rowY = 8;

    for (const def of getAllDefs()) {
      const unlocked = unlockedIds.has(def.id);
      const hidden = def.secret && !unlocked;
      this.addRow(contentX, rowY, contentW, def.icon, hidden ? '???' : def.title,
        hidden ? 'Keep playing to discover this achievement.' : def.description,
        unlocked);
      rowY += ROW_H + 6;
    }

    this.maxScrollY = Math.max(0, rowY - viewportH + 8);

    // Mouse wheel scroll
    this.wheelHandler = (_pointer, _objectsOver, _deltaX, deltaY) => {
      this.setScroll(this.scrollY + deltaY * 0.5);
    };
    this.scene.input.on('wheel', this.wheelHandler);

    // Close button
    const closeY = panelY + panelH - CLOSE_BAR_H + 8;
    const closeBtn = this.scene.add.text(GAME_WIDTH / 2, closeY, '[  CLOSE  ]', {
      fontFamily: 'monospace', fontSize: '16px',
      color: theme.color.css.textAccent, fontStyle: 'bold',
    }).setOrigin(0.5, 0).setScrollFactor(0).setInteractive({ useHandCursor: true });

    closeBtn.on('pointerover', () => closeBtn.setColor(theme.color.css.textQuizAccentHover));
    closeBtn.on('pointerout', () => closeBtn.setColor(theme.color.css.textAccent));
    closeBtn.on('pointerdown', () => { onClose?.(); this.close(); });
    this.container.add(closeBtn);
    this.nav.add(makeTextFocusable(closeBtn, theme.color.css.textAccent, theme.color.css.textQuizAccentHover));
    this.nav.setFocus(0);

    // Keyboard scroll
    this.registerKeyScroll();
  }

  private addRow(x: number, y: number, w: number, icon: string, title: string, description: string, unlocked: boolean): void {
    const rowBg = this.scene.add.graphics();
    const bgColor = unlocked ? theme.color.ui.panel : 0x0a0f1a;
    const borderColor = unlocked ? theme.color.ui.accent : 0x2a3a4a;
    const borderAlpha = unlocked ? 0.35 : 0.2;
    rowBg.fillStyle(bgColor, unlocked ? 0.45 : 0.25);
    rowBg.fillRoundedRect(x, y, w, ROW_H, 6);
    rowBg.lineStyle(1, borderColor, borderAlpha);
    rowBg.strokeRoundedRect(x, y, w, ROW_H, 6);
    this.scrollContainer.add(rowBg);

    const iconAlpha = unlocked ? 1 : 0.25;
    const iconText = this.scene.add.text(x + 14, y + ROW_H / 2, icon, {
      fontFamily: 'monospace', fontSize: '24px',
    }).setOrigin(0, 0.5).setAlpha(iconAlpha);
    this.scrollContainer.add(iconText);

    const titleColor = unlocked ? theme.color.css.textWhite : theme.color.css.textDisabled;
    const titleText = this.scene.add.text(x + 50, y + 14, title, {
      fontFamily: 'monospace', fontSize: '14px', color: titleColor, fontStyle: 'bold',
    }).setOrigin(0, 0);
    this.scrollContainer.add(titleText);

    const descColor = unlocked ? theme.color.css.textQuizBody : theme.color.css.textDisabled;
    const descText = this.scene.add.text(x + 50, y + 34, description, {
      fontFamily: 'monospace', fontSize: '12px', color: descColor,
      wordWrap: { width: w - 68 },
    }).setOrigin(0, 0);
    this.scrollContainer.add(descText);

    if (unlocked) {
      const checkmark = this.scene.add.text(x + w - 16, y + ROW_H / 2, '✓', {
        fontFamily: 'monospace', fontSize: '18px', color: theme.color.css.textQuizCorrect, fontStyle: 'bold',
      }).setOrigin(1, 0.5);
      this.scrollContainer.add(checkmark);
    }
  }

  protected override onBeforeClose(): void {
    if (this.wheelHandler) {
      this.scene.input.off('wheel', this.wheelHandler);
      this.wheelHandler = undefined;
    }
    for (const { key, fn } of this.keyHandlers) {
      this.scene.input.keyboard?.off(`keydown-${key}`, fn);
    }
    this.keyHandlers = [];
    this.mask?.destroy();
  }

  private setScroll(newY: number): void {
    this.scrollY = Phaser.Math.Clamp(newY, 0, this.maxScrollY);
    const panelY = 20;
    const viewportY = panelY + 56;
    this.scrollContainer.setY(viewportY - this.scrollY);
  }

  private registerKeyScroll(): void {
    const scroll = (dy: number): void => this.setScroll(this.scrollY + dy);
    const pairs: Array<[string, number]> = [
      ['UP', -40], ['DOWN', 40],
      ['W', -40], ['S', 40],
    ];
    for (const [key, dy] of pairs) {
      const fn = (): void => scroll(dy);
      this.keyHandlers.push({ key, fn });
      this.scene.input.keyboard?.on(`keydown-${key}`, fn);
    }
  }
}
