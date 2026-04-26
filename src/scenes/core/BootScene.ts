import * as Phaser from 'phaser';
import { generateSprites } from '../../systems/SpriteGenerator';
import { generateSounds } from '../../systems/SoundGenerator';
import { AudioManager } from '../../systems/AudioManager';
import { GameStateManager } from '../../systems/GameStateManager';
import { eventBus } from '../../systems/EventBus';
import { STATIC_MUSIC_ASSETS } from '../../config/audioConfig';
import { COLORS } from '../../config/gameConfig';
import { theme } from '../../style/theme';
import { migrateDefaultSlot, setPlayerSlot } from '../../systems/SaveManager';

export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' });
  }

  preload(): void {
    // Show loading bar
    const width = this.cameras.main.width;
    const height = this.cameras.main.height;

    const progressBox = this.add.graphics();
    progressBox.fillStyle(0x222222, 0.8);
    progressBox.fillRect(width / 2 - 160, height / 2 - 25, 320, 50);

    const progressBar = this.add.graphics();

    const loadingText = this.add.text(width / 2, height / 2 - 50, 'Initializing Systems...', {
      fontFamily: 'monospace',
      fontSize: '18px',
      color: COLORS.hudText,
    }).setOrigin(0.5);

    const percentText = this.add.text(width / 2, height / 2, '0%', {
      fontFamily: 'monospace',
      fontSize: '16px',
      color: COLORS.titleText,
    }).setOrigin(0.5);

    this.load.on('progress', (value: number) => {
      percentText.setText(`${Math.round(value * 100)}%`);
      progressBar.clear();
      progressBar.fillStyle(theme.color.ui.accent, 1);
      progressBar.fillRect(width / 2 - 150, height / 2 - 15, 300 * value, 30);
    });

    this.load.on('complete', () => {
      progressBar.destroy();
      progressBox.destroy();
      loadingText.destroy();
      percentText.destroy();
    });

    // Generate procedural SFX and queue for Phaser's loader.
    // This also generates the procedural lullaby music track.
    generateSounds(this);

    // Load only eager music tracks at boot (everything else is lazy-loaded
    // by MusicPlugin on first play so the initial download stays small).
    for (const { key, path, eager } of STATIC_MUSIC_ASSETS) {
      if (eager) this.load.audio(key, path);
    }

    // Brand assets. The Norconsult Digital wordmark (white) is used as the
    // wall-mounted company sign in the lobby. Rendered from SVG so it stays
    // crisp at any camera zoom. The SVG's native viewBox is 160×54; scale up
    // to ~3× so it reads from across the lobby.
    this.load.svg('lobby_logo', 'brand/norconsult-digital-white.svg', { width: 200, height: 68 });
  }

  create(): void {
    // Migrate legacy 'default' slot → slot1 on first launch.
    // Must happen before GameStateManager is constructed (it may call hasSave()).
    migrateDefaultSlot();
    // Default active slot for the session (SaveSlotScene will override this).
    setPlayerSlot('slot1');

    // Generate all sprites programmatically
    generateSprites(this);

    // Initialize audio manager and wire it to the EventBus
    const audio = new AudioManager(this.sound);
    audio.registerEventListeners();
    this.registry.set('audio', audio);

    // Build the persistent game-state facade once. Subsequent scenes read
    // `gameState` from the registry instead of constructing their own
    // ProgressionSystem or reaching into the singleton save managers.
    this.registry.set('gameState', new GameStateManager());

    // Global M-key toggles audio mute from any scene or context.
    // Attached to window so it works regardless of which Phaser scene has
    // keyboard focus or what input context is active.
    // Mute state is persisted via SettingsStore (architect_settings_v1).
    // The Settings screen mentions this hotkey so players can discover it.
    window.addEventListener('keydown', (ev) => {
      if (ev.repeat) return;
      if (ev.key === 'm' || ev.key === 'M') {
        const target = ev.target as HTMLElement | null;
        const tag = target?.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || target?.isContentEditable) return;
        eventBus.emit('audio:toggle-mute');
      }
    });

    this.scene.start('MenuScene');
  }
}
