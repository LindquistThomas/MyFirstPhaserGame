import * as Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../config/gameConfig';
import { theme } from '../style/theme';
import { ModalBase } from './ModalBase';
import { ACHIEVEMENTS } from '../config/achievements';
import * as AchievementManager from '../systems/AchievementManager';

const PANEL_W = 580;
const PANEL_X = (GAME_WIDTH - PANEL_W) / 2;
const PANEL_PADDING = 28;
const ROW_H = 54;
const ROW_GAP = 6;

/**
 * Full-screen modal listing all achievements with lock/unlock status.
 *
 * Extends {@link ModalBase} for overlay dim, Esc-to-close, and fade lifecycle.
 */
export class AchievementsDialog extends ModalBase {
  constructor(scene: Phaser.Scene, onClose?: () => void) {
    super(scene);
    this.buildPanel(onClose);
    this.fadeIn();
  }

  private buildPanel(onClose?: () => void): void {
    const panelH = GAME_HEIGHT - 60;
    const panelY = 30;

    // --- background ---
    const bg = this.scene.add.graphics();
    bg.fillStyle(0x0a0a2a, 0.97);
    bg.fillRoundedRect(PANEL_X, panelY, PANEL_W, panelH, 10);
    bg.lineStyle(2, theme.color.ui.border, 0.7);
    bg.strokeRoundedRect(PANEL_X, panelY, PANEL_W, panelH, 10);
    this.container.add(bg);

    // --- title ---
    const unlocked = AchievementManager.getUnlocked();
    const total = ACHIEVEMENTS.length;
    const unlockedCount = unlocked.length;

    const titleY = panelY + PANEL_PADDING;
    const titleText = this.scene.add.text(GAME_WIDTH / 2, titleY, 'ACHIEVEMENTS', {
      fontFamily: 'monospace', fontSize: '22px',
      color: theme.color.css.textTitle, fontStyle: 'bold',
    }).setOrigin(0.5, 0);
    this.container.add(titleText);

    const countText = this.scene.add.text(GAME_WIDTH / 2, titleY + 30, `${unlockedCount} / ${total} unlocked`, {
      fontFamily: 'monospace', fontSize: '13px',
      color: theme.color.css.textQuizMuted,
    }).setOrigin(0.5, 0);
    this.container.add(countText);

    // separator
    const sepY = titleY + 58;
    const sep = this.scene.add.graphics();
    sep.lineStyle(1, theme.color.ui.border, 0.3);
    sep.lineBetween(PANEL_X + 20, sepY, PANEL_X + PANEL_W - 20, sepY);
    this.container.add(sep);

    // --- close button (sticky, bottom) ---
    const CLOSE_BAR_H = 44;
    const closeY = panelY + panelH - CLOSE_BAR_H;
    const closeSep = this.scene.add.graphics();
    closeSep.lineStyle(1, theme.color.ui.border, 0.3);
    closeSep.lineBetween(PANEL_X + 20, closeY, PANEL_X + PANEL_W - 20, closeY);
    this.container.add(closeSep);

    const xBtn = this.scene.add.text(GAME_WIDTH / 2, closeY + 12, 'CLOSE  [Esc]', {
      fontFamily: 'monospace', fontSize: '14px',
      color: theme.color.css.textMuted, fontStyle: 'bold',
    }).setOrigin(0.5, 0).setInteractive({ useHandCursor: true });
    xBtn.on('pointerover', () => xBtn.setColor(theme.color.css.textAccent));
    xBtn.on('pointerout', () => xBtn.setColor(theme.color.css.textMuted));
    xBtn.on('pointerdown', () => { this.close(); onClose?.(); });
    this.container.add(xBtn);

    // --- scrollable achievement list ---
    const contentTop = sepY + 8;
    const contentBottom = closeY - 8;
    const contentH = contentBottom - contentTop;

    const scrollContent = this.scene.add.container(0, contentTop);
    this.container.add(scrollContent);

    const maskGfx = this.scene.make.graphics({ x: 0, y: 0 }, false);
    maskGfx.setScrollFactor(0);
    maskGfx.fillStyle(0xffffff);
    maskGfx.fillRect(PANEL_X, contentTop, PANEL_W, contentH);
    scrollContent.setMask(maskGfx.createGeometryMask());

    let cy = 0;
    const unlockedSet = new Set(unlocked);

    for (const ach of ACHIEVEMENTS) {
      const isUnlocked = unlockedSet.has(ach.id);
      const isSecret = ach.secret && !isUnlocked;

      const rowBg = this.scene.add.graphics();
      const rowColor = isUnlocked ? 0x0d2a0d : 0x0a1422;
      rowBg.fillStyle(rowColor, 0.9);
      rowBg.fillRoundedRect(PANEL_X + 12, cy, PANEL_W - 24, ROW_H, 6);
      if (isUnlocked) {
        rowBg.lineStyle(1, 0x2a6a2a, 0.6);
        rowBg.strokeRoundedRect(PANEL_X + 12, cy, PANEL_W - 24, ROW_H, 6);
      }
      scrollContent.add(rowBg);

      // status icon
      const iconX = PANEL_X + 34;
      const iconCY = cy + ROW_H / 2;
      const iconGfx = this.scene.add.graphics();
      if (isUnlocked) {
        // gold trophy icon
        iconGfx.fillStyle(0xffd700, 1);
        iconGfx.fillRect(iconX - 7, iconCY - 8, 14, 10);
        iconGfx.fillRect(iconX - 4, iconCY + 2, 8, 3);
        iconGfx.fillRect(iconX - 6, iconCY + 5, 12, 3);
        iconGfx.fillStyle(0xffd700, 0.6);
        iconGfx.fillRect(iconX - 10, iconCY - 6, 3, 6);
        iconGfx.fillRect(iconX + 7, iconCY - 6, 3, 6);
      } else if (!isSecret) {
        // grey lock outline
        iconGfx.fillStyle(0x445566, 1);
        iconGfx.fillRect(iconX - 5, iconCY - 2, 10, 9);
        iconGfx.lineStyle(2, 0x445566, 1);
        iconGfx.beginPath();
        iconGfx.arc(iconX, iconCY - 5, 5, Math.PI, 0);
        iconGfx.strokePath();
      } else {
        // dimmed block icon for secret
        iconGfx.fillStyle(0x334455, 1);
        iconGfx.fillRect(iconX - 5, iconCY - 2, 10, 9);
      }
      scrollContent.add(iconGfx);

      // label
      const labelColor = isUnlocked
        ? '#ffd700'
        : isSecret ? '#334455' : theme.color.css.textMuted;
      const labelX = PANEL_X + 56;
      const label = this.scene.add.text(labelX, cy + 8, isSecret ? '???' : ach.label, {
        fontFamily: 'monospace', fontSize: '14px',
        color: labelColor, fontStyle: 'bold',
      }).setOrigin(0, 0);
      scrollContent.add(label);

      // description
      const descColor = isUnlocked ? theme.color.css.textSecondary : '#33445566';
      const desc = this.scene.add.text(labelX, cy + 27, isSecret ? 'Complete all other achievements to reveal.' : ach.description, {
        fontFamily: 'monospace', fontSize: '11px',
        color: isSecret ? '#445566' : descColor,
      }).setOrigin(0, 0);
      scrollContent.add(desc);

      cy += ROW_H + ROW_GAP;
    }

    // scroll support
    const totalContentH = cy;
    const maxScroll = Math.max(0, totalContentH - contentH);
    let scrollOffset = 0;

    const applyScroll = (): void => {
      scrollContent.y = contentTop - scrollOffset;
    };

    if (maxScroll > 0) {
      const wheelHandler = (
        _ptr: unknown, _over: unknown[], _dx: number, dy: number,
      ): void => {
        scrollOffset = Phaser.Math.Clamp(scrollOffset + dy * 0.5, 0, maxScroll);
        applyScroll();
      };
      this.scene.input.on('wheel', wheelHandler);
      // Register cleanup on modal close via scene shutdown (ModalBase handles it)
      this.scene.events.once('shutdown', () => this.scene.input.off('wheel', wheelHandler));

      // Also allow keyboard scroll (PageUp/PageDown)
      const keyUpHandler = (): void => {
        scrollOffset = Phaser.Math.Clamp(scrollOffset - contentH * 0.4, 0, maxScroll);
        applyScroll();
      };
      const keyDownHandler = (): void => {
        scrollOffset = Phaser.Math.Clamp(scrollOffset + contentH * 0.4, 0, maxScroll);
        applyScroll();
      };
      this.scene.inputs.on('PageUp', keyUpHandler);
      this.scene.inputs.on('PageDown', keyDownHandler);
      this.scene.events.once('shutdown', () => {
        this.scene.inputs.off('PageUp', keyUpHandler);
        this.scene.inputs.off('PageDown', keyDownHandler);
      });
    }
  }
}
