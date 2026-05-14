import * as Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../config/gameConfig';
import { theme } from '../style/theme';
import { ModalBase } from './ModalBase';
import { settingsStore } from '../systems/SettingsStore';
import { buildEffectiveBindings } from '../input/bindings';
import { ACTION_LABELS } from '../input/actionLabels';
import { keyLabel } from '../input/keyLabels';
import type { GameAction } from '../input/actions';

/** Number of action rows visible at once inside the modal. */
const VISIBLE_ROWS = 10;

/** Height (px) of each row in the scrollable list. */
const ROW_H = 34;

/** Panel dimensions. */
const PANEL_W = 680;
const PANEL_H = VISIBLE_ROWS * ROW_H + 190; // rows + title area + footer

/**
 * Action groups displayed in the controls reference, with descriptive category headers.
 */
const CATEGORIES: Array<{ header: string; actions: GameAction[] }> = [
  {
    header: 'MOVEMENT',
    actions: ['MoveLeft', 'MoveRight', 'MoveUp', 'MoveDown', 'Jump'],
  },
  {
    header: 'GAMEPLAY',
    actions: ['Interact', 'ToggleInfo', 'Attack'],
  },
  {
    header: 'NAVIGATION',
    actions: [
      'NavigateUp', 'NavigateDown', 'NavigateLeft', 'NavigateRight',
      'PageUp', 'PageDown', 'Confirm', 'Cancel',
    ],
  },
  {
    header: 'QUIZ',
    actions: ['QuickAnswer1', 'QuickAnswer2', 'QuickAnswer3', 'QuickAnswer4'],
  },
  {
    header: 'ELEVATOR',
    actions: [
      'ElevatorCallFloor0', 'ElevatorCallFloor1', 'ElevatorCallFloor2',
      'ElevatorCallFloor3', 'ElevatorCallFloor4', 'ElevatorCallFloor5',
    ],
  },
  {
    header: 'SYSTEM',
    actions: ['Pause', 'ShowControls', 'ToggleDebug'],
  },
];

type ListItem =
  | { kind: 'header'; label: string }
  | { kind: 'action'; action: GameAction }
  | { kind: 'hotkey'; label: string; key: string };

/**
 * Read-only controls reference modal.
 *
 * Shows all game actions grouped by category with their currently-bound keys.
 * Opened from PauseScene, MenuScene, and via the global `ShowControls` hotkey.
 *
 * Navigation:
 *   Up / Down        — scroll one row
 *   PageUp / PageDown — jump a full page
 *   Esc / Cancel     — close (handled by ModalBase)
 *   Enter / Confirm  — close
 *   Click outside panel — close
 */
export class ControlsReferenceModal extends ModalBase {
  private readonly onClose: () => void;
  private readonly onRebind: (() => void) | undefined;

  private confirmHandler: (() => void) | null = null;
  private readonly navHandlers: Array<{ action: GameAction; handler: () => void }> = [];
  /** True when user clicked "Rebind..." — routes onAfterClose to onRebind instead of onClose. */
  private rebindRequested = false;

  private scrollOffset = 0;
  private readonly listItems: ListItem[];
  private readonly rowTexts: Phaser.GameObjects.Text[] = [];
  private readonly keyTexts: Phaser.GameObjects.Text[] = [];
  private highlightBar!: Phaser.GameObjects.Graphics;
  private scrollIndicator!: Phaser.GameObjects.Text;

  constructor(
    scene: Phaser.Scene,
    onClose: () => void = () => { /* no-op */ },
    onRebind?: () => void,
  ) {
    super(scene);
    this.onClose = onClose;
    this.onRebind = onRebind;

    // Build flat list of category headers + action rows.
    this.listItems = [];
    for (const cat of CATEGORIES) {
      this.listItems.push({ kind: 'header', label: cat.header });
      for (const action of cat.actions) {
        this.listItems.push({ kind: 'action', action });
      }
    }
    // Global shortcuts (raw window-level hotkeys, not rebindable via InputService)
    this.listItems.push({ kind: 'header', label: 'GLOBAL SHORTCUTS' });
    this.listItems.push({ kind: 'hotkey', label: 'Toggle Mute', key: 'M' });

    // Click-outside-to-close: attach to the ModalBase dim overlay (always the
    // first container child). Only close when the pointer is genuinely outside
    // the panel — non-interactive panel elements would otherwise pass clicks
    // through to the overlay and close the modal unexpectedly.
    const panelX = (GAME_WIDTH - PANEL_W) / 2;
    const panelY = (GAME_HEIGHT - PANEL_H) / 2;
    const baseOverlay = this.container.list?.[0] as Phaser.GameObjects.Rectangle | undefined;
    baseOverlay?.on?.('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (
        pointer.x < panelX || pointer.x > panelX + PANEL_W ||
        pointer.y < panelY || pointer.y > panelY + PANEL_H
      ) {
        this.close();
      }
    });

    this.buildPanel();
    this.setupHandlers();
    this.refresh();
    this.fadeIn();
  }

  protected override onBeforeClose(): void {
    if (this.confirmHandler) {
      this.scene.inputs.off('Confirm', this.confirmHandler);
      this.confirmHandler = null;
    }
    for (const { action, handler } of this.navHandlers) {
      this.scene.inputs.off(action, handler);
    }
    this.navHandlers.length = 0;
  }

  protected override onAfterClose(): void {
    if (this.rebindRequested && this.onRebind) {
      this.onRebind();
    } else {
      this.onClose();
    }
  }

  // -------------------------------------------------------------------------
  // Layout

  private buildPanel(): void {
    const panelX = (GAME_WIDTH - PANEL_W) / 2;
    const panelY = (GAME_HEIGHT - PANEL_H) / 2;

    // Panel background
    const bg = this.scene.add.graphics();
    bg.fillStyle(theme.color.bg.shaft, 0.98);
    bg.fillRoundedRect(panelX, panelY, PANEL_W, PANEL_H, 10);
    bg.lineStyle(2, theme.color.ui.border, 0.8);
    bg.strokeRoundedRect(panelX, panelY, PANEL_W, PANEL_H, 10);
    this.container.add(bg);

    // Title
    const title = this.scene.add.text(GAME_WIDTH / 2, panelY + 24, 'CONTROLS REFERENCE', {
      fontFamily: 'monospace',
      fontSize: '22px',
      color: theme.color.css.textAccent,
      fontStyle: 'bold',
    }).setOrigin(0.5, 0).setScrollFactor(0);
    this.container.add(title);

    // Sub-header
    const sub = this.scene.add.text(GAME_WIDTH / 2, panelY + 54, 'current key bindings  •  * = custom', {
      fontFamily: 'monospace',
      fontSize: '12px',
      color: theme.color.css.textMuted,
    }).setOrigin(0.5, 0).setScrollFactor(0);
    this.container.add(sub);

    // Highlight bar (behind rows, re-drawn on each refresh)
    this.highlightBar = this.scene.add.graphics();
    this.container.add(this.highlightBar);

    // Scrollable row area
    const rowStartY = panelY + 78;
    const labelX = panelX + 20;
    const keyX = panelX + PANEL_W - 20;

    for (let i = 0; i < VISIBLE_ROWS; i++) {
      const y = rowStartY + i * ROW_H;

      const rowLbl = this.scene.add.text(labelX, y, '', {
        fontFamily: 'monospace',
        fontSize: '14px',
        color: theme.color.css.textPrimary,
      }).setScrollFactor(0);
      this.container.add(rowLbl);
      this.rowTexts.push(rowLbl);

      const rowKey = this.scene.add.text(keyX, y, '', {
        fontFamily: 'monospace',
        fontSize: '14px',
        color: theme.color.css.textPanel,
      }).setOrigin(1, 0).setScrollFactor(0);
      this.container.add(rowKey);
      this.keyTexts.push(rowKey);
    }

    // Scroll indicator text below the row area
    const indicatorY = panelY + 78 + VISIBLE_ROWS * ROW_H + 4;
    this.scrollIndicator = this.scene.add.text(GAME_WIDTH / 2, indicatorY, '', {
      fontFamily: 'monospace',
      fontSize: '11px',
      color: theme.color.css.textMuted,
    }).setOrigin(0.5, 0).setScrollFactor(0);
    this.container.add(this.scrollIndicator);

    // Divider above footer
    const dividerY = panelY + PANEL_H - 64;
    const divider = this.scene.add.graphics();
    divider.lineStyle(1, theme.color.ui.border, 0.3);
    divider.lineBetween(panelX + 20, dividerY, panelX + PANEL_W - 20, dividerY);
    this.container.add(divider);

    // Close button (default / primary action — focused first)
    const closeBtn = this.scene.add.text(GAME_WIDTH / 2 - 90, panelY + PANEL_H - 40, '[ Close ]', {
      fontFamily: 'monospace',
      fontSize: '16px',
      color: theme.color.css.textWhite,
      backgroundColor: theme.color.css.bgPanel,
      padding: { x: 14, y: 8 },
    }).setOrigin(0.5).setScrollFactor(0).setInteractive({ useHandCursor: true });
    closeBtn.on('pointerover', () => closeBtn.setColor(theme.color.css.textAccent));
    closeBtn.on('pointerout', () => closeBtn.setColor(theme.color.css.textWhite));
    closeBtn.on('pointerdown', () => this.close());
    this.container.add(closeBtn);

    // Rebind button
    const rebindBtn = this.scene.add.text(GAME_WIDTH / 2 + 90, panelY + PANEL_H - 40, '[ Rebind... ]', {
      fontFamily: 'monospace',
      fontSize: '16px',
      color: theme.color.css.textMuted,
      backgroundColor: theme.color.css.bgPanel,
      padding: { x: 14, y: 8 },
    }).setOrigin(0.5).setScrollFactor(0).setInteractive({ useHandCursor: true });
    rebindBtn.on('pointerover', () => rebindBtn.setColor(theme.color.css.textAccent));
    rebindBtn.on('pointerout', () => rebindBtn.setColor(theme.color.css.textMuted));
    rebindBtn.on('pointerdown', () => this.openRebind());
    this.container.add(rebindBtn);
  }

  // -------------------------------------------------------------------------
  // Rendering

  private refresh(): void {
    const overrides = settingsStore.read().controlBindings;
    const effective = buildEffectiveBindings(overrides);
    const panelX = (GAME_WIDTH - PANEL_W) / 2;
    const panelY = (GAME_HEIGHT - PANEL_H) / 2;
    const rowStartY = panelY + 78;

    this.highlightBar.clear();

    for (let slot = 0; slot < VISIBLE_ROWS; slot++) {
      const itemIdx = this.scrollOffset + slot;
      const rowLbl = this.rowTexts[slot];
      const rowKey = this.keyTexts[slot];
      if (!rowLbl || !rowKey) continue;

      if (itemIdx >= this.listItems.length) {
        rowLbl.setVisible(false);
        rowKey.setVisible(false);
        continue;
      }

      rowLbl.setVisible(true);
      rowKey.setVisible(true);

      const item = this.listItems[itemIdx]!;
      const y = rowStartY + slot * ROW_H;

      if (item.kind === 'header') {
        rowLbl.setText(`— ${item.label} —`)
          .setColor(theme.color.css.textAccent)
          .setFontSize('12px');
        rowKey.setText('');
        // Subtle tinted background for category headers
        this.highlightBar.fillStyle(theme.color.ui.accent, 0.06);
        this.highlightBar.fillRect(panelX + 4, y - 2, PANEL_W - 8, ROW_H - 4);
      } else if (item.kind === 'hotkey') {
        rowLbl.setText(item.label)
          .setColor(theme.color.css.textPrimary)
          .setFontSize('14px');
        rowKey.setText(item.key)
          .setColor(theme.color.css.textMuted);
      } else {
        const { action } = item;
        const keys = effective[action];
        const primaryCode = keys?.[0];
        const bindingLabel = primaryCode !== undefined ? keyLabel(primaryCode) : '?';
        const isOverridden =
          overrides[action] !== undefined && (overrides[action]?.length ?? 0) > 0;

        rowLbl.setText(ACTION_LABELS[action])
          .setColor(theme.color.css.textPrimary)
          .setFontSize('14px');
        rowKey
          .setText(isOverridden ? `${bindingLabel} *` : bindingLabel)
          .setColor(isOverridden ? theme.color.css.textAccent : theme.color.css.textPanel);
      }
    }

    // Scroll indicator
    const hasAbove = this.scrollOffset > 0;
    const hasBelow = this.scrollOffset + VISIBLE_ROWS < this.listItems.length;
    const parts: string[] = [];
    if (hasAbove) parts.push('▲ scroll up');
    if (hasBelow) parts.push('▼ scroll down');
    this.scrollIndicator.setText(parts.join('  •  '));
  }

  private scroll(delta: number): void {
    const maxOffset = Math.max(0, this.listItems.length - VISIBLE_ROWS);
    this.scrollOffset = Math.max(0, Math.min(maxOffset, this.scrollOffset + delta));
    this.refresh();
  }

  // -------------------------------------------------------------------------
  // Input handlers

  private setupHandlers(): void {
    // Enter / Confirm → close (default action; same as clicking "Close")
    this.confirmHandler = () => this.close();
    this.scene.inputs.on('Confirm', this.confirmHandler);

    // Scroll handlers (modal context — only fire when this modal is active)
    const navPairs: Array<[GameAction, number]> = [
      ['NavigateUp', -1],
      ['NavigateDown', 1],
      ['PageUp', -VISIBLE_ROWS],
      ['PageDown', VISIBLE_ROWS],
    ];
    for (const [action, delta] of navPairs) {
      const handler = () => this.scroll(delta);
      this.scene.inputs.on(action, handler);
      this.navHandlers.push({ action, handler });
    }
  }

  // -------------------------------------------------------------------------
  // Rebind navigation

  private openRebind(): void {
    // Signal that the caller's onRebind handler should fire instead of onClose.
    // The caller (PauseScene / MenuScene) is responsible for navigating to
    // SettingsScene in a way that fits its own lifecycle (launch+hide vs. start).
    this.rebindRequested = true;
    this.close();
  }
}
