import * as Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../../config/gameConfig';
import { theme } from '../../style/theme';
import { settingsStore } from '../../systems/SettingsStore';
import { GameStateManager } from '../../systems/GameStateManager';
import { pushContext, popContext } from '../../input';
import { createSceneLifecycle } from '../../systems/sceneLifecycle';

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
  | { kind: 'action'; label: string; action: () => void };

export class SettingsScene extends Phaser.Scene {
  private items: SettingsItem[] = [];
  private selectedIndex = 0;
  private rows: Phaser.GameObjects.Text[] = [];
  private valueTexts: Phaser.GameObjects.Text[] = [];
  private sliderBars: Phaser.GameObjects.Graphics[] = [];
  /** Key of the scene that opened settings (returned to on back/cancel). */
  private callerScene = 'MenuScene';
  private gameState!: GameStateManager;

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
        kind: 'action',
        label: '[ REPLAY TUTORIAL ]',
        action: () => this.replayTutorial(),
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
    const panelH = 560;
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

    for (let i = 0; i < this.items.length; i++) {
      const item = this.items[i];
      const label = this.rows[i];
      const valText = this.valueTexts[i];
      const bar = this.sliderBars[i];
      if (!item || !label || !valText || !bar) continue;

      const isSelected = i === this.selectedIndex;
      const labelColor = isSelected ? '#ffffff' : theme.color.css.textPrimary;
      const labelScale = isSelected ? 1.06 : 1;
      label.setColor(labelColor).setScale(labelScale);

      const y = startY + i * rowH;

      bar.clear();

      if (item.kind === 'slider') {
        const pct = item.get() / 100;
        valText.setText(`${item.get()}%`).setColor(theme.color.css.textPanel);

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
        valText.setText(on ? 'ON' : 'OFF').setColor(on ? theme.color.css.textAccent : theme.color.css.textMuted);
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
    const n = this.items.length;
    this.selectedIndex = (this.selectedIndex + delta + n) % n;
    this.refreshAll();
  }

  private adjust(delta: number): void {
    const item = this.items[this.selectedIndex];
    if (!item) return;

    if (item.kind === 'slider') {
      item.set(item.get() + delta * item.step);
    } else if (item.kind === 'toggle') {
      item.set(!item.get());
    }
    this.refreshAll();
  }

  private activate(): void {
    const item = this.items[this.selectedIndex];
    if (!item) return;

    if (item.kind === 'toggle') {
      item.set(!item.get());
      this.refreshAll();
    } else if (item.kind === 'action') {
      item.action();
    }
  }

  private replayTutorial(): void {
    this.gameState?.resetOnboarding();
    this.goBack();
  }


  private goBack(): void {
    this.cameras.main.fadeOut(300, 0, 0, 0);
    this.time.delayedCall(300, () => {
      this.scene.start(this.callerScene);
    });
  }
}
