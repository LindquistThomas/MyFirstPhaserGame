import * as Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../../config/gameConfig';
import { theme, getHighContrastCss } from '../../style/theme';
import { settingsStore } from '../../systems/SettingsStore';
import type { MusicStyle, OnScreenControlsSetting, ColorBlindMode, TextScale } from '../../systems/SettingsStore';
import { getReducedMotionOverride, setReducedMotionOverride } from '../../systems/MotionPreference';
import { eventBus } from '../../systems/EventBus';
import { GameStateManager } from '../../systems/GameStateManager';
import {
  SaveSlotId,
  exportSlot,
  importToSlot,
  SAVE_ENVELOPE_FORMAT,
  SAVE_SLOTS,
  getPlayerSlot,
} from '../../systems/SaveManager';
import { WelcomeModal } from '../../ui/WelcomeModal';
import { showTouchHintForcedWithPersist } from '../../ui/TouchHintOverlay';
import * as TouchHintStore from '../../systems/TouchHintStore';
import { announce } from '../../ui/ariaLive';
import { pushContext, popContext } from '../../input';
import { createSceneLifecycle } from '../../systems/sceneLifecycle';

import { clampSlider } from '../../systems/sliderUtils';

/**
 * Settings scene — keyboard-navigable UI for audio and accessibility settings.
 *
 * Reachable from MenuScene (and future PauseScene). Receives the caller's
 * scene key via `this.scene.settings.data.from` (string) and returns to it
 * on Back / Cancel.
 *
 * Navigation:
 *   Up / Down — move between items
 *   Left / Right — adjust sliders / cycle options
 *   Enter / Confirm — toggle boolean items
 *   Escape — back to caller
 */

type SettingsItem =
  | { kind: 'slider'; label: string; get: () => number; set: (v: number) => void; step: number }
  | { kind: 'toggle'; label: string; get: () => boolean; set: (v: boolean) => void }
  | { kind: 'cycle'; label: string; options: readonly string[]; get: () => string; set: (v: string) => void }
  | { kind: 'action'; label: string; action: () => void };

/** User-visible error shown for any unrecognised or corrupt import file. */
const IMPORT_ERROR_MESSAGE =
  'This file is not a valid Architect save (bad format / corrupt / wrong version).';

export class SettingsScene extends Phaser.Scene {
  private items: SettingsItem[] = [];
  private selectedIndex = 0;
  private rows: Phaser.GameObjects.Text[] = [];
  private valueTexts: Phaser.GameObjects.Text[] = [];
  private sliderBars: Phaser.GameObjects.Graphics[] = [];
  /** Key of the scene that opened settings (returned to on back/cancel). */
  private callerScene = 'MenuScene';
  private gameState!: GameStateManager;
  /** True while the How-to-Play WelcomeModal is open; blocks settings nav. */
  private helpModalOpen = false;
  /** True while the import-confirm overlay is open; blocks settings nav. */
  private importConfirmOpen = false;
  /** Currently focused button in the confirm overlay: 0 = YES, 1 = NO. */
  private importConfirmIndex = 1; // default to "No" (safer default)
  /** Overlay container shown while the import-confirm dialog is active. */
  private importOverlay?: Phaser.GameObjects.Container;
  /** [ YES ] button reference for keyboard highlight refresh. */
  private importConfirmYesBtn?: Phaser.GameObjects.Text;
  /** [ NO ] button reference for keyboard highlight refresh. */
  private importConfirmNoBtn?: Phaser.GameObjects.Text;
  /** Pending import data kept alive between openImportConfirm and confirmImport. */
  private importConfirmData?: { raw: string; slotId: SaveSlotId };
  /** Inline status message shown after export/import actions. */
  private statusText?: Phaser.GameObjects.Text;

  constructor() {
    super({ key: 'SettingsScene' });
  }

  init(data: { from?: string }): void {
    this.callerScene = data.from ?? 'MenuScene';
    this.gameState = this.registry.get('gameState') as GameStateManager;
  }

  create(): void {
    this.items = this.buildItems();
    this.selectedIndex = 0;

    this.drawBackground();
    this.drawTitle();
    this.buildRows();
    this.setupNavigation();
    this.refreshAll();

    this.cameras.main.fadeIn(300, 0, 0, 0);
  }

  // -----------------------------------------------------------------------
  // Build settings items

  private buildItems(): SettingsItem[] {
    const MUSIC_STYLE_OPTIONS = ['8-BIT', 'SYNTH', 'JAZZ'] as const;
    type MusicStyleOption = typeof MUSIC_STYLE_OPTIONS[number];
    const MUSIC_STYLE_VALUES: Record<MusicStyleOption, MusicStyle> = {
      '8-BIT': '8bit-chiptune',
      'SYNTH': 'retro-synth',
      'JAZZ': 'elevator-jazz',
    };
    const MUSIC_STYLE_LABELS: Record<MusicStyle, MusicStyleOption> = {
      '8bit-chiptune': '8-BIT',
      'retro-synth': 'SYNTH',
      'elevator-jazz': 'JAZZ',
    };

    const REDUCED_OPTIONS = ['SYSTEM', 'OFF', 'ON'] as const;

    const ON_SCREEN_CONTROLS_OPTIONS = ['AUTO', 'ALWAYS', 'NEVER'] as const;
    type OnScreenControlsOption = typeof ON_SCREEN_CONTROLS_OPTIONS[number];
    const ON_SCREEN_CONTROLS_VALUES: Record<OnScreenControlsOption, OnScreenControlsSetting> = {
      'AUTO': 'auto',
      'ALWAYS': 'always',
      'NEVER': 'never',
    };
    const ON_SCREEN_CONTROLS_LABELS: Record<OnScreenControlsSetting, OnScreenControlsOption> = {
      'auto': 'AUTO',
      'always': 'ALWAYS',
      'never': 'NEVER',
    };

    const COLOR_BLIND_OPTIONS = ['OFF', 'DEUTERANOPIA', 'PROTANOPIA', 'TRITANOPIA'] as const;
    type ColorBlindOption = typeof COLOR_BLIND_OPTIONS[number];
    const COLOR_BLIND_VALUES: Record<ColorBlindOption, ColorBlindMode> = {
      'OFF': 'off',
      'DEUTERANOPIA': 'deuteranopia',
      'PROTANOPIA': 'protanopia',
      'TRITANOPIA': 'tritanopia',
    };
    const COLOR_BLIND_LABELS: Record<ColorBlindMode, ColorBlindOption> = {
      'off': 'OFF',
      'deuteranopia': 'DEUTERANOPIA',
      'protanopia': 'PROTANOPIA',
      'tritanopia': 'TRITANOPIA',
    };

    const TEXT_SIZE_OPTIONS = ['100%', '115%', '130%', '150%'] as const;
    type TextSizeOption = typeof TEXT_SIZE_OPTIONS[number];
    const TEXT_SIZE_VALUES: Record<TextSizeOption, TextScale> = {
      '100%': 1,
      '115%': 1.15,
      '130%': 1.3,
      '150%': 1.5,
    };
    const TEXT_SIZE_LABELS: Record<TextScale, TextSizeOption> = {
      1: '100%',
      1.15: '115%',
      1.3: '130%',
      1.5: '150%',
    };

    return [
      {
        kind: 'slider',
        label: 'MASTER VOLUME',
        get: () => settingsStore.read().masterVolume,
        set: (v) => settingsStore.setMasterVolume(v),
        step: 5,
      },
      {
        kind: 'slider',
        label: 'MUSIC VOLUME',
        get: () => settingsStore.read().musicVolume,
        set: (v) => settingsStore.setMusicVolume(v),
        step: 5,
      },
      {
        kind: 'slider',
        label: 'SFX VOLUME',
        get: () => settingsStore.read().sfxVolume,
        set: (v) => settingsStore.setSfxVolume(v),
        step: 5,
      },
      {
        kind: 'toggle',
        label: 'MUTE ALL  [M]',
        get: () => settingsStore.read().muteAll,
        set: (v) => settingsStore.setMuteAll(v),
      },
      {
        kind: 'toggle',
        label: 'HIGH CONTRAST',
        get: () => settingsStore.read().highContrast,
        set: (v) => {
          settingsStore.setHighContrast(v);
          // `settings:changed` emitted by setHighContrast() triggers
          // applyHighContrastToDocument() via the EventBus handler registered
          // in initVirtualGamepad() — no explicit call needed here.
        },
      },
      {
        kind: 'cycle',
        label: 'REDUCED MOTION',
        options: REDUCED_OPTIONS,
        get: () => {
          const o = getReducedMotionOverride();
          if (o === null) return 'SYSTEM';
          return o ? 'ON' : 'OFF';
        },
        set: (v) => {
          if (v === 'ON') setReducedMotionOverride(true);
          else if (v === 'OFF') setReducedMotionOverride(false);
          else setReducedMotionOverride(null);
        },
      },
      {
        kind: 'cycle',
        label: 'MUSIC STYLE',
        options: MUSIC_STYLE_OPTIONS,
        get: () => MUSIC_STYLE_LABELS[settingsStore.read().musicStyle] ?? MUSIC_STYLE_OPTIONS[0],
        set: (v) => settingsStore.setMusicStyle(MUSIC_STYLE_VALUES[v as MusicStyleOption] ?? MUSIC_STYLE_VALUES[MUSIC_STYLE_OPTIONS[0]]),
      },
      {
        kind: 'cycle',
        label: 'SHOW CONTROLS',
        options: ON_SCREEN_CONTROLS_OPTIONS,
        get: () => ON_SCREEN_CONTROLS_LABELS[settingsStore.read().onScreenControls] ?? ON_SCREEN_CONTROLS_OPTIONS[0],
        set: (v) => settingsStore.setOnScreenControls(
          ON_SCREEN_CONTROLS_VALUES[v as OnScreenControlsOption] ?? ON_SCREEN_CONTROLS_VALUES[ON_SCREEN_CONTROLS_OPTIONS[0]],
        ),
      },
      {
        kind: 'toggle',
        label: 'HAPTIC FEEDBACK',
        get: () => settingsStore.read().hapticsEnabled,
        set: (v) => settingsStore.setHapticsEnabled(v),
      },
      {
        kind: 'cycle',
        label: 'COLOR BLIND MODE',
        options: COLOR_BLIND_OPTIONS,
        get: () => COLOR_BLIND_LABELS[settingsStore.read().colorBlindMode] ?? COLOR_BLIND_OPTIONS[0],
        set: (v) => settingsStore.setColorBlindMode(
          COLOR_BLIND_VALUES[v as ColorBlindOption] ?? COLOR_BLIND_VALUES[COLOR_BLIND_OPTIONS[0]],
        ),
      },
      {
        kind: 'cycle',
        label: 'TEXT SIZE',
        options: TEXT_SIZE_OPTIONS,
        get: () => TEXT_SIZE_LABELS[settingsStore.read().textScale] ?? TEXT_SIZE_OPTIONS[0],
        set: (v) => settingsStore.setTextScale(
          TEXT_SIZE_VALUES[v as TextSizeOption] ?? TEXT_SIZE_VALUES[TEXT_SIZE_OPTIONS[0]],
        ),
      },
      {
        kind: 'toggle',
        label: 'HIDE TUTORIALS',
        get: () => settingsStore.read().hideTutorials,
        set: (v) => settingsStore.setHideTutorials(v),
      },
      {
        kind: 'toggle',
        label: 'SEND ANALYTICS',
        get: () => settingsStore.read().analyticsConsent,
        set: (v) => settingsStore.setAnalyticsConsent(v),
      },
      {
        kind: 'action',
        label: '[ HOW TO PLAY ]',
        action: () => this.openHowToPlay(),
      },
      {
        kind: 'action',
        label: '[ SHOW TOUCH HINT ]',
        action: () => this.resetTouchHint(),
      },
      {
        kind: 'action',
        label: '[ CONTROLS ]',
        action: () => this.openControls(),
      },
      {
        kind: 'action',
        label: '[ REPLAY TUTORIAL ]',
        action: () => this.replayTutorial(),
      },
      {
        kind: 'action',
        label: '[ EXPORT SAVE ]',
        action: () => this.exportSave(),
      },
      {
        kind: 'action',
        label: '[ IMPORT SAVE ]',
        action: () => this.importSave(),
      },
      {
        kind: 'action',
        label: '[ BACK ]',
        action: () => this.goBack(),
      },
    ];
  }

  // -----------------------------------------------------------------------
  // Layout

  private drawBackground(): void {
    const bg = this.add.graphics().setDepth(0);
    bg.fillStyle(theme.color.bg.overlay, 0.96);
    bg.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    // Panel
    const panelW = 640;
    const panelH = 620;
    const panelX = (GAME_WIDTH - panelW) / 2;
    const panelY = (GAME_HEIGHT - panelH) / 2;
    const panel = this.add.graphics().setDepth(1);
    panel.fillStyle(theme.color.bg.shaft, 0.97);
    panel.fillRect(panelX, panelY, panelW, panelH);
    panel.lineStyle(2, theme.color.ui.border, 0.8);
    panel.strokeRect(panelX, panelY, panelW, panelH);
  }

  private drawTitle(): void {
    this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 245, 'SETTINGS', {
      fontFamily: 'monospace',
      fontSize: '32px',
      color: theme.color.css.textAccent,
      fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(10);

    this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 250, 'Tip: M key toggles mute from any screen', {
      fontFamily: 'monospace',
      fontSize: '13px',
      color: theme.color.css.textMuted,
    }).setOrigin(0.5).setDepth(10);
  }

  private buildRows(): void {
    this.rows = [];
    this.valueTexts = [];
    this.sliderBars = [];

    const startY = GAME_HEIGHT / 2 - 185;
    const rowH = 52;
    const labelX = GAME_WIDTH / 2 - 260;
    const valueX = GAME_WIDTH / 2 + 180;

    for (let i = 0; i < this.items.length; i++) {
      const item = this.items[i];
      if (!item) continue;
      const y = startY + i * rowH;

      const label = this.add.text(labelX, y, item.label, {
        fontFamily: 'monospace',
        fontSize: '18px',
        color: theme.color.css.textPrimary,
      }).setDepth(10);
      this.rows.push(label);

      const valText = this.add.text(valueX, y, '', {
        fontFamily: 'monospace',
        fontSize: '18px',
        color: theme.color.css.textPanel,
      }).setOrigin(1, 0).setDepth(10);
      this.valueTexts.push(valText);

      // Slider bar (only for slider items)
      if (item.kind === 'slider') {
        const bar = this.add.graphics().setDepth(9);
        this.sliderBars.push(bar);
      } else {
        this.sliderBars.push(this.add.graphics().setDepth(9)); // placeholder
      }
    }
  }

  // -----------------------------------------------------------------------
  // Rendering

  private refreshAll(): void {
    const startY = GAME_HEIGHT / 2 - 185;
    const rowH = 52;
    const sliderX = GAME_WIDTH / 2 - 80;
    const sliderW = 200;
    const hcPalette = getHighContrastCss(settingsStore.read().highContrast);

    for (let i = 0; i < this.items.length; i++) {
      const item = this.items[i];
      const label = this.rows[i];
      const valText = this.valueTexts[i];
      const bar = this.sliderBars[i];
      if (!item || !label || !valText || !bar) continue;

      const isSelected = i === this.selectedIndex;
      const labelColor = isSelected ? '#ffffff' : hcPalette.textPrimary;
      const labelScale = isSelected ? 1.06 : 1;
      label.setColor(labelColor).setScale(labelScale);

      const y = startY + i * rowH;

      bar.clear();

      if (item.kind === 'slider') {
        const pct = item.get() / 100;
        valText.setText(`${item.get()}%`).setColor(hcPalette.textPanel);

        // Trough
        bar.fillStyle(theme.color.bg.mid, 0.6);
        bar.fillRect(sliderX, y + 6, sliderW, 12);
        // Fill
        bar.fillStyle(isSelected ? theme.color.ui.accent : theme.color.ui.accentAlt, 0.9);
        bar.fillRect(sliderX, y + 6, Math.round(sliderW * pct), 12);
        // Knob
        bar.fillStyle(0xffffff, isSelected ? 1 : 0.7);
        bar.fillCircle(sliderX + Math.round(sliderW * pct), y + 12, 8);
      } else if (item.kind === 'toggle') {
        const on = item.get();
        valText.setText(on ? 'ON' : 'OFF').setColor(on ? hcPalette.textAccent : theme.color.css.textMuted);
      } else if (item.kind === 'cycle') {
        const val = item.get();
        valText.setText(val).setColor(hcPalette.textAccent);
      } else if (item.kind === 'action') {
        valText.setText('');
        if (isSelected) {
          label.setColor('#ffffff').setScale(1.1);
        }
      }
    }
  }

  // -----------------------------------------------------------------------
  // Navigation / input

  private setupNavigation(): void {
    const contextToken = pushContext('modal');
    const lifecycle = createSceneLifecycle(this);
    lifecycle.add(() => popContext(contextToken));

    lifecycle.bindInput('NavigateUp', () => this.move(-1));
    lifecycle.bindInput('NavigateDown', () => this.move(1));
    lifecycle.bindInput('NavigateLeft', () => this.adjust(-1));
    lifecycle.bindInput('NavigateRight', () => this.adjust(1));
    lifecycle.bindInput('Confirm', () => this.activate());
    lifecycle.bindInput('Cancel', () => this.goBack());

    // Re-render when audio settings change (e.g. AudioManager toggles mute via M key)
    lifecycle.bindEventBus('audio:mute-changed', () => this.refreshAll());
  }

  private move(delta: number): void {
    if (this.importConfirmOpen) {
      this.importConfirmIndex = (this.importConfirmIndex + delta + 2) % 2;
      this.refreshImportConfirmHighlight();
      return;
    }
    const n = this.items.length;
    this.selectedIndex = (this.selectedIndex + delta + n) % n;
    this.refreshAll();
  }

  private adjust(delta: number): void {
    if (this.importConfirmOpen) {
      this.importConfirmIndex = (this.importConfirmIndex + (delta > 0 ? 1 : -1) + 2) % 2;
      this.refreshImportConfirmHighlight();
      return;
    }
    const item = this.items[this.selectedIndex];
    if (!item) return;

    if (item.kind === 'slider') {
      const next = clampSlider(item.get() + delta * item.step);
      item.set(next);
    } else if (item.kind === 'toggle') {
      item.set(!item.get());
    } else if (item.kind === 'cycle') {
      const n = item.options.length;
      const idx = item.options.indexOf(item.get());
      const next = item.options[((idx === -1 ? 0 : idx) + delta + n) % n];
      if (next !== undefined) item.set(next);
    }
    this.refreshAll();
  }

  private activate(): void {
    if (this.helpModalOpen) return;
    if (this.importConfirmOpen) {
      if (this.importConfirmIndex === 0) {
        const d = this.importConfirmData;
        if (d && this.importOverlay) this.confirmImport(d.raw, d.slotId, this.importOverlay);
      } else {
        if (this.importOverlay) this.closeImportConfirm(this.importOverlay);
      }
      return;
    }
    const item = this.items[this.selectedIndex];
    if (!item) return;

    if (item.kind === 'toggle') {
      item.set(!item.get());
      this.refreshAll();
    } else if (item.kind === 'cycle') {
      const n = item.options.length;
      const idx = item.options.indexOf(item.get());
      const next = item.options[((idx === -1 ? 0 : idx) + 1) % n];
      if (next !== undefined) item.set(next);
      this.refreshAll();
    } else if (item.kind === 'action') {
      item.action();
    }
  }

  private openControls(): void {
    this.cameras.main.fadeOut(250, 0, 0, 0);
    this.time.delayedCall(250, () => {
      this.scene.start('ControlsScene', { settingsFrom: this.callerScene });
    });
  }

  /**
   * Open the Welcome / How-to-Play modal on demand without touching the
   * first-run `onboardingComplete` flag. Blocks settings navigation while
   * the modal is open so stacked Confirm/Cancel key presses don't interfere.
   */
  private openHowToPlay(): void {
    this.helpModalOpen = true;
    announce('Help opened');
    // Pass a real onComplete that clears the guard when the modal closes.
    // WelcomeModal.onAfterClose always calls onComplete, so this fires on
    // both button-click and Esc dismissal.
    new WelcomeModal(this, () => { this.helpModalOpen = false; }, 'help');
  }

  /**
   * Clear the touch-hint seen flag so the virtual-gamepad hint will appear
   * again on the next pointer-down (or immediately if the pad is mounted).
   */
  private resetTouchHint(): void {
    TouchHintStore.clearSeen();
    const padEl = document.getElementById('virtual-pad');
    // Use the "persist" variant so when the user dismisses the re-shown hint,
    // markSeen() fires and the hint won't auto-appear again next session.
    if (padEl) showTouchHintForcedWithPersist(padEl);
  }

  private replayTutorial(): void {
    this.gameState?.resetOnboarding();
    this.gameState?.resetVisitedFloors();
    this.goBack();
  }

  /**
   * Return the currently active save slot ID.
   * Falls back to 'slot1' when the active slot is not one of the canonical
   * three (e.g. during testing with a custom slot key).
   */
  private activeSlotId(): SaveSlotId {
    const current = getPlayerSlot();
    return (SAVE_SLOTS as readonly string[]).includes(current)
      ? (current as SaveSlotId)
      : SAVE_SLOTS[0];
  }

  /**
   * Show a brief inline status message below the settings panel.
   * Auto-hides after 4 s. Any subsequent call replaces the previous message.
   */
  private showStatus(message: string, isError = false): void {
    if (this.statusText) {
      this.statusText.destroy();
      this.statusText = undefined;
    }
    const color = isError ? '#ff6680' : '#44dd88';
    const text = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 290, message, {
      fontFamily: 'monospace',
      fontSize: '13px',
      color,
      wordWrap: { width: 580 },
      align: 'center',
    }).setOrigin(0.5).setDepth(20);
    this.statusText = text;

    // Only destroy if this specific text object is still the active one when
    // the timer fires. This prevents a rapid second call from clearing the
    // newer message when the first timer fires 4s after the first call.
    this.time.delayedCall(4000, () => {
      if (this.statusText === text) { text.destroy(); this.statusText = undefined; }
    });
  }

  /**
   * Export the currently active save slot as a JSON file download.
   * Uses a temporary <a download> element to trigger the browser's native
   * save-file dialog — works on both desktop and mobile browsers.
   */
  private exportSave(): void {
    if (this.importConfirmOpen) return;

    // Resolve the active slot via the module-level playerSlot state.
    const slotId = this.activeSlotId();
    const json = exportSlot(slotId);
    if (!json) {
      this.showStatus('Nothing to export — slot is empty.', true);
      return;
    }

    // Build a filename like: architect-save-slot1-20240101.json
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const filename = `architect-save-${slotId}-${date}.json`;

    try {
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      this.showStatus(`Save exported as ${filename}`);
      announce(`Save exported as ${filename}`);
    } catch {
      this.showStatus('Export failed — browser may not support downloads.', true);
    }
  }

  /**
   * Open a file picker, validate the selected file as a SaveEnvelope,
   * and show a confirm overlay before applying the import.
   */
  private importSave(): void {
    if (this.importConfirmOpen || this.helpModalOpen) return;

    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';

    input.onchange = (): void => {
      const file = input.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (e): void => {
        const raw = e.target?.result;
        if (typeof raw !== 'string') {
          this.showStatus('Could not read file.', true);
          return;
        }

        // Pre-validate before showing the confirm dialog so we fail fast.
        let envelope: unknown;
        try { envelope = JSON.parse(raw); } catch {
          this.showStatus(IMPORT_ERROR_MESSAGE, true);
          return;
        }
        if (
          typeof envelope !== 'object' || envelope === null ||
          (envelope as Record<string, unknown>)['format'] !== SAVE_ENVELOPE_FORMAT
        ) {
          this.showStatus(IMPORT_ERROR_MESSAGE, true);
          return;
        }

        const slotId = this.activeSlotId();
        const slotNum = SAVE_SLOTS.indexOf(slotId) + 1;
        this.openImportConfirm(raw, slotId, slotNum);
      };
      reader.onerror = (): void => {
        this.showStatus('Could not read file.', true);
      };
      reader.readAsText(file);
    };

    // Trigger the file picker. Appending briefly to the DOM is needed on
    // some mobile browsers (iOS Safari) for the picker to open correctly.
    document.body.appendChild(input);
    input.click();
    document.body.removeChild(input);
  }

  /**
   * Show the import-confirm overlay.
   * On confirm: write the imported data and reload progression state.
   * On cancel: dismiss without touching storage.
   * Supports both pointer clicks and keyboard (Confirm = Enter, Cancel = Esc,
   * Left/Right/Up/Down = switch YES ↔ NO focus).
   */
  private openImportConfirm(raw: string, slotId: SaveSlotId, slotNum: number): void {
    if (this.importConfirmOpen) return;
    this.importConfirmOpen = true;
    this.importConfirmIndex = 1; // default focus to "No" (safer)
    this.importConfirmData = { raw, slotId };

    const ow = 440, oh = 160;
    const ox = (GAME_WIDTH - ow) / 2;
    const oy = (GAME_HEIGHT - oh) / 2;

    const overlay = this.add.container(0, 0).setDepth(100);

    const blocker = this.add.rectangle(
      GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.5,
    ).setInteractive({ useHandCursor: false });
    const stopEvent = (_p: Phaser.Input.Pointer, _lx: number, _ly: number, ev: Phaser.Types.Input.EventData): void => { ev.stopPropagation(); };
    blocker.on('pointerdown', stopEvent);
    blocker.on('pointerup', stopEvent);
    overlay.add(blocker);

    const bg = this.add.graphics();
    bg.fillStyle(0x0a0d1c, 0.97);
    bg.fillRect(ox, oy, ow, oh);
    bg.lineStyle(2, theme.color.ui.accent, 1);
    bg.strokeRect(ox, oy, ow, oh);
    overlay.add(bg);

    overlay.add(this.add.text(ox + ow / 2, oy + 24, `Import to Slot ${slotNum}?`, {
      fontFamily: 'monospace', fontSize: '18px',
      color: theme.color.css.textAccent, fontStyle: 'bold',
    }).setOrigin(0.5));

    overlay.add(this.add.text(ox + ow / 2, oy + 56, `This will replace the contents of Slot ${slotNum}.`, {
      fontFamily: 'monospace', fontSize: '13px', color: theme.color.css.textMuted,
    }).setOrigin(0.5));

    const yesBtn = this.add.text(ox + ow / 2 - 70, oy + 110, '[ YES ]', {
      fontFamily: 'monospace', fontSize: '16px', color: theme.color.css.textAccent,
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    yesBtn.on('pointerdown', () => this.confirmImport(raw, slotId, overlay));
    yesBtn.on('pointerover', () => { this.importConfirmIndex = 0; this.refreshImportConfirmHighlight(); });
    overlay.add(yesBtn);

    const noBtn = this.add.text(ox + ow / 2 + 70, oy + 110, '[ NO ]', {
      fontFamily: 'monospace', fontSize: '16px', color: theme.color.css.textMuted,
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    noBtn.on('pointerdown', () => this.closeImportConfirm(overlay));
    noBtn.on('pointerover', () => { this.importConfirmIndex = 1; this.refreshImportConfirmHighlight(); });
    overlay.add(noBtn);

    this.importConfirmYesBtn = yesBtn;
    this.importConfirmNoBtn = noBtn;
    this.importOverlay = overlay;
    this.refreshImportConfirmHighlight();
  }

  private refreshImportConfirmHighlight(): void {
    this.importConfirmYesBtn?.setColor(this.importConfirmIndex === 0 ? '#ffffff' : theme.color.css.textAccent);
    this.importConfirmNoBtn?.setColor(this.importConfirmIndex === 1 ? '#ffffff' : theme.color.css.textMuted);
  }

  private confirmImport(raw: string, slotId: SaveSlotId, overlay: Phaser.GameObjects.Container): void {
    const data = importToSlot(slotId, raw);
    if (!data) {
      this.closeImportConfirm(overlay);
      this.showStatus(IMPORT_ERROR_MESSAGE, true);
      return;
    }

    // Reload in-memory progression from the freshly-written slot.
    this.gameState?.progression?.loadFromSave();
    eventBus.emit('progression:loaded');

    this.closeImportConfirm(overlay);
    this.showStatus('Save imported successfully!');
    announce('Save imported successfully');
  }

  private closeImportConfirm(overlay: Phaser.GameObjects.Container): void {
    overlay.destroy();
    this.importOverlay = undefined;
    this.importConfirmYesBtn = undefined;
    this.importConfirmNoBtn = undefined;
    this.importConfirmData = undefined;
    this.importConfirmOpen = false;
  }

  private goBack(): void {
    if (this.helpModalOpen) return;
    if (this.importConfirmOpen) {
      if (this.importOverlay) this.closeImportConfirm(this.importOverlay);
      return;
    }
    this.cameras.main.fadeOut(300, 0, 0, 0);
    this.time.delayedCall(300, () => {
      if (this.callerScene === 'PauseScene') {
        // Signal PauseScene to re-activate its input lifecycle, then stop this
        // scene and restore PauseScene visibility. Emit before stop() so the
        // listener fires while SettingsScene's 'modal' context is still on the
        // stack; PauseScene's setupKeyboard() pushes 'menu' on top, and
        // stop() then pops 'modal', leaving the stack in the correct state.
        eventBus.emit('pause:settings-closed');
        this.scene.stop();
        this.scene.setVisible(true, 'PauseScene');
      } else {
        this.scene.start(this.callerScene);
      }
    });
  }
}
