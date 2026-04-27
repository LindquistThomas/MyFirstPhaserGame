import * as Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../../config/gameConfig';
import { theme } from '../../style/theme';
import { settingsStore } from '../../systems/SettingsStore';
import { buildEffectiveBindings, type KeyCode } from '../../input/bindings';
import { ALL_ACTIONS, type GameAction } from '../../input/actions';
import { keyLabel } from '../../input/keyLabels';
import { pushContext, popContext } from '../../input';
import { createSceneLifecycle } from '../../systems/sceneLifecycle';

/**
 * Controls-rebinding subscene — launched from SettingsScene.
 *
 * Lists every GameAction with its currently-bound key.
 * Selecting a row and pressing Confirm enters "capture mode":
 *   - Any non-modifier key press becomes the new binding for that action.
 *   - Escape cancels capture without changing the binding.
 * "Reset to defaults" clears all overrides.
 *
 * Navigation:
 *   Up / Down — move between rows (clamps at first/last; scrolls the visible window)
 *   PageUp / PageDown — jump a page at a time
 *   Enter / Confirm — activate / enter capture mode
 *   Escape — back to SettingsScene
 */

/** Human-readable labels for each GameAction. */
const ACTION_LABELS: Record<GameAction, string> = {
  MoveLeft: 'Move Left',
  MoveRight: 'Move Right',
  MoveUp: 'Move Up',
  MoveDown: 'Move Down',
  Jump: 'Jump',
  Interact: 'Interact',
  ToggleInfo: 'Toggle Info',
  NavigateUp: 'Navigate Up',
  NavigateDown: 'Navigate Down',
  NavigateLeft: 'Navigate Left',
  NavigateRight: 'Navigate Right',
  PageUp: 'Page Up',
  PageDown: 'Page Down',
  Confirm: 'Confirm',
  Cancel: 'Cancel',
  QuickAnswer1: 'Quick Answer 1',
  QuickAnswer2: 'Quick Answer 2',
  QuickAnswer3: 'Quick Answer 3',
  QuickAnswer4: 'Quick Answer 4',
  ElevatorCallFloor0: 'Elevator: Floor 0',
  ElevatorCallFloor1: 'Elevator: Floor 1',
  ElevatorCallFloor2: 'Elevator: Floor 2',
  ElevatorCallFloor3: 'Elevator: Floor 3',
  ElevatorCallFloor4: 'Elevator: Floor 4',
  ElevatorCallFloor5: 'Elevator: Boardroom',
  Attack: 'Attack (Throw/Fire)',
  Pause: 'Pause',
  ToggleDebug: 'Toggle Debug',
};

/** Key codes that are not allowed as new bindings (modifiers, lock keys, function keys). */
const RESERVED_KEYS = new Set<number>([
  // Modifiers
  16, // Shift
  17, // Ctrl
  18, // Alt
  91, 92, // Windows / Meta
  // Lock keys
  20, // Caps Lock
  144, // Num Lock
  145, // Scroll Lock
  // Function keys F1–F12
  112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123,
  // Special / navigation-only keys
  19,  // Pause/Break
  44,  // Print Screen
  45,  // Insert
]);

/** Special item indices appended after the action list. */
const EXTRA_ITEMS = ['[ RESET TO DEFAULTS ]', '[ BACK ]'] as const;

/** Number of rows visible in the panel at once. */
const VISIBLE_ROWS = 12;

/** Height (px) of each row. */
const ROW_H = 40;

export class ControlsScene extends Phaser.Scene {
  /** Key of the scene that opened SettingsScene (returned to on back). */
  private settingsFrom = 'MenuScene';
  /** Currently highlighted row index (0 = first action, … n-1 = last action, n = Reset, n+1 = Back). */
  private selectedIndex = 0;
  /** Index of the first visible row (scroll offset). */
  private scrollOffset = 0;
  /** True while waiting for the player to press a key to rebind. */
  private capturing = false;
  /** Raw DOM keydown listener active only during capture mode. */
  private captureListener?: (ev: KeyboardEvent) => void;

  private labelTexts: Phaser.GameObjects.Text[] = [];
  private keyTexts: Phaser.GameObjects.Text[] = [];
  private highlightBar!: Phaser.GameObjects.Graphics;
  private captureText!: Phaser.GameObjects.Text;
  private hintText!: Phaser.GameObjects.Text;

  /** Index into ALL_ACTIONS where each action row starts (0..ALL_ACTIONS.length-1).
   *  Indices ALL_ACTIONS.length and ALL_ACTIONS.length+1 are the special actions. */
  private get totalItems(): number {
    return ALL_ACTIONS.length + EXTRA_ITEMS.length;
  }

  constructor() {
    super({ key: 'ControlsScene' });
  }

  init(data: { settingsFrom?: string }): void {
    this.settingsFrom = data.settingsFrom ?? 'MenuScene';
    this.selectedIndex = 0;
    this.scrollOffset = 0;
    this.capturing = false;
  }

  create(): void {
    this.drawBackground();
    this.drawTitle();
    this.buildRows();
    this.setupNavigation();
    this.refreshAll();

    this.cameras.main.fadeIn(250, 0, 0, 0);
  }

  // -----------------------------------------------------------------------
  // Layout

  private drawBackground(): void {
    const bg = this.add.graphics().setDepth(0);
    bg.fillStyle(theme.color.bg.overlay, 0.96);
    bg.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    const panelW = 700;
    const panelH = VISIBLE_ROWS * ROW_H + 110; // rows + title + padding
    const panelX = (GAME_WIDTH - panelW) / 2;
    const panelY = (GAME_HEIGHT - panelH) / 2;
    const panel = this.add.graphics().setDepth(1);
    panel.fillStyle(theme.color.bg.shaft, 0.97);
    panel.fillRect(panelX, panelY, panelW, panelH);
    panel.lineStyle(2, theme.color.ui.border, 0.8);
    panel.strokeRect(panelX, panelY, panelW, panelH);
  }

  private drawTitle(): void {
    this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - (VISIBLE_ROWS * ROW_H) / 2 - 50, 'CONTROLS', {
      fontFamily: 'monospace',
      fontSize: '28px',
      color: theme.color.css.textAccent,
      fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(10);

    this.hintText = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - (VISIBLE_ROWS * ROW_H) / 2 - 20, '', {
      fontFamily: 'monospace',
      fontSize: '13px',
      color: theme.color.css.textMuted,
    }).setOrigin(0.5).setDepth(10);

    // Capture-mode overlay text (hidden by default)
    this.captureText = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + (VISIBLE_ROWS * ROW_H) / 2 + 20, '', {
      fontFamily: 'monospace',
      fontSize: '14px',
      color: theme.color.css.textAccent,
    }).setOrigin(0.5).setDepth(15);
  }

  private buildRows(): void {
    this.labelTexts = [];
    this.keyTexts = [];

    const startY = this.rowStartY();
    const labelX = GAME_WIDTH / 2 - 290;
    const keyX = GAME_WIDTH / 2 + 290;

    // Highlight bar (rendered behind text)
    this.highlightBar = this.add.graphics().setDepth(8);

    for (let i = 0; i < VISIBLE_ROWS; i++) {
      const y = startY + i * ROW_H;

      const lbl = this.add.text(labelX, y, '', {
        fontFamily: 'monospace',
        fontSize: '16px',
        color: theme.color.css.textPrimary,
      }).setDepth(10);
      this.labelTexts.push(lbl);

      const kTxt = this.add.text(keyX, y, '', {
        fontFamily: 'monospace',
        fontSize: '16px',
        color: theme.color.css.textPanel,
      }).setOrigin(1, 0).setDepth(10);
      this.keyTexts.push(kTxt);
    }
  }

  // -----------------------------------------------------------------------
  // Rendering

  private rowStartY(): number {
    return GAME_HEIGHT / 2 - (VISIBLE_ROWS * ROW_H) / 2 + 5;
  }

  private refreshAll(): void {
    const overrides = settingsStore.read().controlBindings;
    const effective = buildEffectiveBindings(overrides);
    const startY = this.rowStartY();
    const panelX = (GAME_WIDTH - 700) / 2;

    // Derive hint text from effective bindings so it stays correct after rebinding.
    const confirmKey = keyLabel(effective.Confirm?.[0] ?? 13);
    const cancelKey = keyLabel(effective.Cancel?.[0] ?? 27);
    this.hintText.setText(`${confirmKey}: rebind  •  ${cancelKey}: cancel / back`);

    this.highlightBar.clear();

    for (let slot = 0; slot < VISIBLE_ROWS; slot++) {
      const itemIdx = this.scrollOffset + slot;
      const lbl = this.labelTexts[slot];
      const kTxt = this.keyTexts[slot];
      if (!lbl || !kTxt) continue;

      const isSelected = itemIdx === this.selectedIndex;
      const y = startY + slot * ROW_H;

      if (itemIdx >= this.totalItems) {
        lbl.setText('').setVisible(false);
        kTxt.setText('').setVisible(false);
        continue;
      }

      lbl.setVisible(true);
      kTxt.setVisible(true);

      if (isSelected) {
        this.highlightBar.fillStyle(theme.color.ui.accent, 0.18);
        this.highlightBar.fillRect(panelX + 4, y - 2, 700 - 8, ROW_H - 4);
      }

      const isAction = itemIdx < ALL_ACTIONS.length;
      if (isAction) {
        const action = ALL_ACTIONS[itemIdx]!;
        const isCapturing = this.capturing && isSelected;

        lbl.setText(ACTION_LABELS[action])
          .setColor(isSelected ? theme.color.css.textWhite : theme.color.css.textPrimary)
          .setScale(isSelected ? 1.04 : 1);

        if (isCapturing) {
          kTxt.setText('[ PRESS KEY ]').setColor(theme.color.css.textAccent);
        } else {
          // Show effective primary key, mark overridden ones with a dot
          const keys = effective[action];
          const primaryCode = keys[0];
          const label = primaryCode !== undefined ? keyLabel(primaryCode) : '?';
          const isOverridden = overrides[action] !== undefined && overrides[action]!.length > 0;
          kTxt.setText(isOverridden ? `${label} *` : label)
            .setColor(isOverridden ? theme.color.css.textAccent : theme.color.css.textPanel);
        }
      } else {
        // Extra items: Reset / Back
        const extraIdx = itemIdx - ALL_ACTIONS.length;
        const extraLabel = EXTRA_ITEMS[extraIdx] ?? '';
        lbl.setText(extraLabel)
          .setColor(isSelected ? theme.color.css.textWhite : theme.color.css.textPrimary)
          .setScale(isSelected ? 1.08 : 1);
        kTxt.setText('');
      }
    }

    // Scroll indicator
    const hasMore = this.scrollOffset + VISIBLE_ROWS < this.totalItems;
    const hasAbove = this.scrollOffset > 0;
    this.captureText.setText(
      this.capturing
        ? 'Press any key to rebind  •  Esc to cancel'
        : `${hasAbove ? '▲ ' : ''}${hasMore ? '▼ scroll for more' : ''}`,
    ).setColor(this.capturing ? theme.color.css.textAccent : theme.color.css.textMuted);
  }

  // -----------------------------------------------------------------------
  // Navigation

  private setupNavigation(): void {
    const contextToken = pushContext('modal');
    const lifecycle = createSceneLifecycle(this);
    lifecycle.add(() => popContext(contextToken));
    lifecycle.add(() => this.stopCapture());

    lifecycle.bindInput('NavigateUp', () => this.move(-1));
    lifecycle.bindInput('NavigateDown', () => this.move(1));
    lifecycle.bindInput('PageUp', () => this.move(-VISIBLE_ROWS));
    lifecycle.bindInput('PageDown', () => this.move(VISIBLE_ROWS));
    lifecycle.bindInput('Confirm', () => this.activate());
    lifecycle.bindInput('Cancel', () => {
      if (this.capturing) {
        this.stopCapture();
        this.refreshAll();
      } else {
        this.goBack();
      }
    });
  }

  private move(delta: number): void {
    if (this.capturing) return;
    const n = this.totalItems;
    this.selectedIndex = Math.max(0, Math.min(n - 1, this.selectedIndex + delta));
    this.clampScroll();
    this.refreshAll();
  }

  private clampScroll(): void {
    if (this.selectedIndex < this.scrollOffset) {
      this.scrollOffset = this.selectedIndex;
    } else if (this.selectedIndex >= this.scrollOffset + VISIBLE_ROWS) {
      this.scrollOffset = this.selectedIndex - VISIBLE_ROWS + 1;
    }
  }

  private activate(): void {
    if (this.capturing) return;
    const idx = this.selectedIndex;
    if (idx < ALL_ACTIONS.length) {
      this.startCapture(idx);
    } else {
      const extraIdx = idx - ALL_ACTIONS.length;
      if (extraIdx === 0) {
        this.resetBindings();
      } else {
        this.goBack();
      }
    }
  }

  // -----------------------------------------------------------------------
  // Capture mode

  private startCapture(actionIdx: number): void {
    this.capturing = true;
    this.refreshAll();

    this.captureListener = (ev: KeyboardEvent) => {
      ev.preventDefault();
      ev.stopPropagation();

      const keyCode = ev.keyCode;

      // Escape → cancel
      if (keyCode === 27) {
        this.stopCapture();
        this.refreshAll();
        return;
      }

      // Ignore modifier-only presses
      if (RESERVED_KEYS.has(keyCode)) return;

      // Apply the new binding
      this.applyBinding(ALL_ACTIONS[actionIdx]!, keyCode);
      this.stopCapture();
      this.refreshAll();
    };

    // Use capture phase so this fires before Phaser's keyboard handler
    window.addEventListener('keydown', this.captureListener, { capture: true });
  }

  private stopCapture(): void {
    this.capturing = false;
    if (this.captureListener) {
      window.removeEventListener('keydown', this.captureListener, { capture: true });
      this.captureListener = undefined;
    }
  }

  private applyBinding(action: GameAction, keyCode: KeyCode): void {
    const current = settingsStore.read().controlBindings;
    const updated: typeof current = { ...current, [action]: [keyCode] };
    settingsStore.setControlBindings(updated);
  }

  private resetBindings(): void {
    settingsStore.resetControlBindings();
    this.refreshAll();
  }

  // -----------------------------------------------------------------------
  // Navigation

  private goBack(): void {
    this.stopCapture();
    this.cameras.main.fadeOut(250, 0, 0, 0);
    this.time.delayedCall(250, () => {
      this.scene.start('SettingsScene', { from: this.settingsFrom });
    });
  }
}
