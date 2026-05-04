import * as Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../config/gameConfig';
import { theme } from '../style/theme';
import { ModalBase } from './ModalBase';
import { SAVE_SLOTS, type SaveSlotId, clearRecoveredSlot, getCorruptBackup } from '../systems/SaveManager';

/** Human-readable descriptions for each failure reason. */
const REASON_TEXT: Record<string, string> = {
  parse:       'The save file could not be read (data was corrupt or used an incompatible format).',
  quota:       'Your device\'s storage was full when the game tried to save.',
  unavailable: 'Browser storage is not available in this environment.',
  unknown:     'An unexpected error occurred while reading the save file.',
};

/**
 * One-shot modal shown when a save slot's data was found corrupt and discarded.
 *
 * Displayed from SaveSlotScene when `SlotInfo.recovered` is true. Offers:
 *   - A plain-language explanation of what happened.
 *   - A human-readable failure reason.
 *   - A "Download Backup" button that writes the stashed corrupt JSON to disk
 *     (so a developer can inspect it or the player can attempt recovery later).
 *   - An "OK" button to dismiss.
 *
 * Dismissing calls `clearRecoveredSlot(slotId)` so the dialog does not
 * reappear if SaveSlotScene is revisited in the same browser session.
 */
export class SaveRecoveryDialog extends ModalBase {
  private readonly slotId: SaveSlotId;
  private readonly onDismiss: () => void;
  private confirmHandler: (() => void) | null = null;

  constructor(
    scene: Phaser.Scene,
    slotId: SaveSlotId,
    reason: string,
    onDismiss: () => void = () => { /* no-op */ },
  ) {
    super(scene);
    this.slotId = slotId;
    this.onDismiss = onDismiss;
    this.buildPanel(reason);
    this.fadeIn();
  }

  protected override onBeforeClose(): void {
    if (this.confirmHandler) {
      this.scene.inputs.off('Confirm', this.confirmHandler);
      this.confirmHandler = null;
    }
  }

  protected override onAfterClose(): void {
    clearRecoveredSlot(this.slotId);
    this.onDismiss();
  }

  private buildPanel(reason: string): void {
    const panelW = 560;
    const panelH = 300;
    const panelX = (GAME_WIDTH - panelW) / 2;
    const panelY = (GAME_HEIGHT - panelH) / 2;
    const PADDING = 28;

    // Panel background
    const bg = this.scene.add.graphics();
    bg.fillStyle(0x08082a, 0.97);
    bg.fillRoundedRect(panelX, panelY, panelW, panelH, 12);
    bg.lineStyle(2, 0xffaa00, 0.9);
    bg.strokeRoundedRect(panelX, panelY, panelW, panelH, 12);
    this.container.add(bg);

    // Warning accent bar
    const accentBar = this.scene.add.graphics();
    accentBar.fillStyle(0xffaa00, 1);
    accentBar.fillRect(panelX + 12, panelY, panelW - 24, 4);
    this.container.add(accentBar);

    const slotNum = SAVE_SLOTS.indexOf(this.slotId) + 1;

    // Title
    const title = this.scene.add.text(
      GAME_WIDTH / 2, panelY + PADDING,
      `\u26a0  Save Data Recovery — Slot ${slotNum}`,
      {
        fontFamily: 'monospace',
        fontSize: '20px',
        color: '#ffaa00',
        fontStyle: 'bold',
        resolution: 2,
      },
    ).setOrigin(0.5, 0).setScrollFactor(0);
    this.container.add(title);

    // Main explanation
    const body = this.scene.add.text(
      panelX + PADDING,
      panelY + PADDING + 44,
      `Your save file for Slot ${slotNum} was unreadable and has\nbeen replaced with a fresh slot.`,
      {
        fontFamily: 'monospace',
        fontSize: '15px',
        color: theme.color.css.textPrimary,
        lineSpacing: 4,
      },
    ).setScrollFactor(0);
    this.container.add(body);

    // Reason line
    const reasonLabel = this.scene.add.text(
      panelX + PADDING,
      panelY + PADDING + 100,
      `Reason: ${REASON_TEXT[reason] ?? REASON_TEXT['unknown']}`,
      {
        fontFamily: 'monospace',
        fontSize: '13px',
        color: theme.color.css.textSecondary,
        wordWrap: { width: panelW - PADDING * 2 },
        lineSpacing: 2,
      },
    ).setScrollFactor(0);
    this.container.add(reasonLabel);

    // Buttons row
    const btnY = panelY + panelH - 54;
    const corruptData = getCorruptBackup(this.slotId);

    if (corruptData !== null) {
      const dlBtn = this.scene.add.text(
        GAME_WIDTH / 2 - 90,
        btnY,
        '[ Download Backup ]',
        {
          fontFamily: 'monospace',
          fontSize: '15px',
          color: '#55ddff',
          backgroundColor: '#0a1a2a',
          padding: { x: 12, y: 8 },
        },
      ).setOrigin(0.5).setScrollFactor(0).setInteractive({ useHandCursor: true });

      dlBtn.on('pointerover', () => dlBtn.setColor('#ffffff'));
      dlBtn.on('pointerout',  () => dlBtn.setColor('#55ddff'));
      dlBtn.on('pointerdown', () => this.triggerDownload(slotNum, corruptData));
      this.container.add(dlBtn);
    }

    const okBtnX = corruptData !== null ? GAME_WIDTH / 2 + 80 : GAME_WIDTH / 2;
    const okBtn = this.scene.add.text(
      okBtnX,
      btnY,
      '[ OK ]',
      {
        fontFamily: 'monospace',
        fontSize: '15px',
        color: '#ffffff',
        backgroundColor: '#0e2a4a',
        padding: { x: 20, y: 8 },
      },
    ).setOrigin(0.5).setScrollFactor(0).setInteractive({ useHandCursor: true });

    okBtn.on('pointerover', () => okBtn.setColor('#55eeff'));
    okBtn.on('pointerout',  () => okBtn.setColor('#ffffff'));
    okBtn.on('pointerdown', () => this.close());
    this.container.add(okBtn);

    this.confirmHandler = () => this.close();
    this.scene.inputs.on('Confirm', this.confirmHandler);
  }

  private triggerDownload(slotNum: number, data: string): void {
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const filename = `architect-recovered-slot${slotNum}-${date}.json`;
    try {
      const blob = new Blob([data], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      /* If the download fails (e.g. sandboxed environment), silently ignore — the
         player can still dismiss via OK. */
    }
  }
}
