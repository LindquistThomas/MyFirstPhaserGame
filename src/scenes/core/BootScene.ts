import * as Phaser from 'phaser';
import { BOOT_SPRITE_PHASES } from '../../systems/SpriteGenerator';
import type { GeneratorPhase } from '../../systems/SpriteGenerator';
import { AudioManager } from '../../systems/AudioManager';
import { GameStateManager } from '../../systems/GameStateManager';
import { eventBus } from '../../systems/EventBus';
import { STATIC_MUSIC_ASSETS } from '../../config/audioConfig';
import { COLORS } from '../../config/gameConfig';
import { theme } from '../../style/theme';
import { migrateDefaultSlot, setPlayerSlot } from '../../systems/SaveManager';
import { isPersistenceAvailable } from '../../systems/PersistedStore';
import { createAnalyticsService } from '../../systems/Analytics';
import { setDailyState } from '../../systems/DailyChallenge';
import { getWorldModifiers } from '../../systems/WorldModifiers';

/** Count of static assets that failed to load during this boot pass. */
let _bootAssetErrorCount = 0;
/** Ensure dev profiling logs only once per full page load. */
let _bootPerfLogged = false;
const BOOT_HEAVY_PHASE_MS = 16;

export class BootScene extends Phaser.Scene {
  // Guard: window listener is installed once per instance and removed only
  // when the Phaser.Game is fully destroyed (not on scene shutdown, which
  // fires immediately when this.scene.start() hands off to MenuScene).
  private _muteHotkeyInstalled = false;

  // Progress UI elements — created in preload(), driven in create().
  // Optional chaining is used throughout so create() works safely even
  // when preload() was not called (e.g. unit tests).
  private _progressBar: Phaser.GameObjects.Graphics | null = null;
  private _progressBox: Phaser.GameObjects.Graphics | null = null;
  private _loadingText: Phaser.GameObjects.Text | null = null;
  private _percentText: Phaser.GameObjects.Text | null = null;

  // Named reference to the file-load progress handler so it can be removed
  // before the second loader run (procedural audio blobs) to prevent the
  // 0–10% scaling being incorrectly applied to that run.
  private _onFileProgress: ((value: number) => void) | null = null;

  // Named reference to the loaderror handler so re-entering preload() replaces
  // it rather than accumulating a second copy on the loader.
  private _onLoaderError: ((file: { key: string; type: string; src: string }) => void) | null = null;
  private _devProfileBoot = false;

  constructor() {
    super({ key: 'BootScene' });
  }

  preload(): void {
    this._devProfileBoot = import.meta.env.DEV && import.meta.env.MODE !== 'test' && !_bootPerfLogged;
    this._devMark('boot:file-load:start');
    // Reset per-boot-pass error counter and signal a fresh boot to any
    // listeners that maintain boot-derived state (e.g. MusicPlugin's skip-set).
    _bootAssetErrorCount = 0;
    eventBus.emit('boot:reset');

    // Show loading bar
    const width = this.cameras.main.width;
    const height = this.cameras.main.height;

    this._progressBox = this.add.graphics();
    this._progressBox.fillStyle(0x222222, 0.8);
    this._progressBox.fillRect(width / 2 - 160, height / 2 - 25, 320, 50);

    this._progressBar = this.add.graphics();

    this._loadingText = this.add.text(width / 2, height / 2 - 50, 'Initializing Systems...', {
      fontFamily: 'monospace',
      fontSize: '18px',
      color: COLORS.hudText,
    }).setOrigin(0.5);

    this._percentText = this.add.text(width / 2, height / 2, '0%', {
      fontFamily: 'monospace',
      fontSize: '16px',
      color: COLORS.titleText,
    }).setOrigin(0.5);

    // Named handler stored as an instance field so it can be removed before
    // the second loader run (procedural audio) to avoid double-scaling.
    this._onFileProgress = (value: number): void => {
      this._updateProgress(value * 0.1, 'Initializing Systems...');
    };
    this.load.on('progress', this._onFileProgress);

    // Remove the handler once the initial file load is done so it cannot
    // accumulate on BootScene re-entry.
    this.load.once('complete', () => {
      if (this._onFileProgress) {
        this.load.off('progress', this._onFileProgress);
        this._onFileProgress = null;
      }
      if (this._onLoaderError) {
        this.load.off('loaderror', this._onLoaderError);
        this._onLoaderError = null;
      }
    });

    // Load only eager music tracks at boot (everything else is lazy-loaded
    // by MusicPlugin on first play so the initial download stays small).
    //
    // Attach a single loaderror handler so missing/CORS-blocked assets surface
    // in logs and on the EventBus rather than failing silently.
    // Stored as an instance field and explicitly removed before re-registering
    // so calling preload() more than once (e.g. on BootScene re-entry) does
    // not accumulate duplicate handlers.
    if (this._onLoaderError) {
      this.load.off('loaderror', this._onLoaderError);
    }
    this._onLoaderError = (file: { key: string; type: string; src: string }): void => {
      console.error('[BootScene] Asset failed to load:', file.key, file.src);
      eventBus.emit('boot:asset-error', { key: file.key, type: file.type, url: file.src });
      _bootAssetErrorCount++;
    };
    this.load.on('loaderror', this._onLoaderError);

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
    this._devMeasure('boot:file-load', 'boot:file-load:start');
    // Migrate legacy 'default' slot → slot1 on first launch.
    // Must happen before GameStateManager is constructed (it may call hasSave()).
    migrateDefaultSlot();
    // Default active slot for the session (SaveSlotScene will override this).
    setPlayerSlot('slot1');
    setDailyState(this.registry, null);

    // Probe storage availability at startup so every subsequent scene can
    // read `registry.get('persistenceAvailable')` to gate UI and toasts.
    this.registry.set('persistenceAvailable', isPersistenceAvailable());

    // Initialize audio manager and wire it to the EventBus
    const audio = new AudioManager(this.sound, this.game);
    audio.registerEventListeners();
    this.registry.set('audio', audio);

    // Build the persistent game-state facade once. Subsequent scenes read
    // `gameState` from the registry instead of constructing their own
    // ProgressionSystem or reaching into the singleton save managers.
    const gameState = new GameStateManager();
    this.registry.set('gameState', gameState);
    this.registry.set('worldModifiers', getWorldModifiers(gameState.progression.getMode()));

    // Bootstrap opt-in analytics. createAnalyticsService() returns null when
    // VITE_ANALYTICS_ENDPOINT is not set (structurally disabled). When set,
    // consent is checked per-event so no request is made until the player
    // explicitly opts in via Settings.
    // Guard against re-entry: unbind + destroy any existing service first so
    // a second call to create() (e.g. if BootScene is re-started) does not
    // accumulate duplicate EventBus subscriptions or interval timers.
    const existingAnalytics = this.registry.get('analytics') as import('../../systems/Analytics').AnalyticsService | undefined;
    if (existingAnalytics) {
      existingAnalytics.unbind();
      this.registry.remove('analytics');
    }
    const analytics = createAnalyticsService();
    if (analytics) this.registry.set('analytics', analytics);

    // Global M-key toggles audio mute from any scene or context.
    // Attached to window so it works regardless of which Phaser scene has
    // keyboard focus or what input context is active.
    // Mute state is persisted via SettingsStore (architect_settings_v1).
    // The Settings screen mentions this hotkey so players can discover it.
    //
    // Note: this.scene.start('MenuScene') below fires BootScene's `shutdown`
    // event immediately, so we must NOT remove the listener on `shutdown` —
    // only on `destroy` (full game teardown). The guard prevents a second
    // call to create() (e.g. on BootScene re-entry) from double-registering.
    if (!this._muteHotkeyInstalled) {
      this._muteHotkeyInstalled = true;
      const onMuteHotkey = (ev: KeyboardEvent): void => {
        if (ev.repeat) return;
        if (ev.key !== 'm' && ev.key !== 'M') return;
        const target = ev.target as HTMLElement | null;
        const tag = target?.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || target?.isContentEditable) return;
        eventBus.emit('audio:toggle-mute');
      };
      window.addEventListener('keydown', onMuteHotkey);
      this.events.once('destroy', () => {
        window.removeEventListener('keydown', onMuteHotkey);
        this._muteHotkeyInstalled = false;
      });
    }

    // Signal that procedural assets (tiles, enemies, sounds, etc.) are not yet
    // ready. MenuScene.create() will run the deferred warmup and flip this to
    // true once all phases complete. Scenes that need deferred keys can check
    // registry.get('proceduralAssetsReady') or listen to the registry event
    // 'changedata-proceduralAssetsReady' (see MenuScene.warmupDeferredAssets).
    this.registry.set('proceduralAssetsReady', false);

    // Build the generation pipeline: only the player sprite at boot so the
    // MenuScene animated elevator cab has the best asset from the first frame.
    // All other sprites and all sounds are deferred to MenuScene.create()
    // (warmupDeferredAssets) where they run after first paint in idle time.
    // Skip if assets are already cached (e.g. on BootScene re-entry).
    const spritesCached = this.textures?.exists('player') ?? false;
    const spritePhases: readonly GeneratorPhase[] = spritesCached ? [] : BOOT_SPRITE_PHASES;
    const total = spritePhases.length;

    // File loading accounts for the first 10% of the progress bar;
    // procedural generation phases fill the remaining 90%.
    const FILE_SHARE = total > 0 ? 0.1 : 0;
    const GEN_SHARE = 1 - FILE_SHARE;

    const finish = (): void => {
      this._devMark('boot:create:end');
      this._devMeasure('boot:create:total', 'boot:create:start', 'boot:create:end');
      _bootPerfLogged = _bootPerfLogged || this._devProfileBoot;
      // Write the final error count now that all loading is complete,
      // so MenuScene reads an accurate total rather than a mid-boot snapshot.
      this.registry.set('bootAssetErrors', _bootAssetErrorCount);
      this._destroyProgress();
      this.scene.start('MenuScene');
    };

    if (total === 0) {
      finish();
      return;
    }

    this._devMark('boot:create:start');

    // Sprite generation (synchronous canvas ops, frame-yielding for heavy phases).
    let spriteIndex = 0;
    const runSpritePhases = (): void => {
      while (spriteIndex < spritePhases.length) {
        const phase = spritePhases[spriteIndex]!;
        const measureName = `boot:phase:${phase.label}`;
        this._devMark(`${measureName}:start`);
        const t0 = performance.now();
        phase.run(this);
        const elapsed = performance.now() - t0;
        this._devMark(`${measureName}:end`);
        this._devMeasure(measureName, `${measureName}:start`, `${measureName}:end`);

        const progress = FILE_SHARE + GEN_SHARE * ((spriteIndex + 1) / total);
        this._updateProgress(progress, phase.label);
        spriteIndex++;

        if (elapsed > BOOT_HEAVY_PHASE_MS) {
          this._scheduleNextFrame(runSpritePhases);
          return;
        }
      }
      finish();
    };

    this._scheduleNextFrame(runSpritePhases);
  }

  /** Update the progress bar and status text. `value` is in the range [0, 1]. */
  private _updateProgress(value: number, label: string): void {
    const width = this.cameras.main.width;
    const height = this.cameras.main.height;
    this._percentText?.setText(`${Math.round(value * 100)}%`);
    this._loadingText?.setText(label);
    this._progressBar?.clear();
    this._progressBar?.fillStyle(theme.color.ui.accent, 1);
    this._progressBar?.fillRect(width / 2 - 150, height / 2 - 15, 300 * value, 30);
  }

  /** Destroy and null all progress bar UI elements. */
  private _destroyProgress(): void {
    this._progressBar?.destroy();
    this._progressBox?.destroy();
    this._loadingText?.destroy();
    this._percentText?.destroy();
    this._progressBar = null;
    this._progressBox = null;
    this._loadingText = null;
    this._percentText = null;
  }

  private _scheduleNextFrame(callback: () => void): void {
    if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(callback);
      return;
    }
    this.time.addEvent({ delay: 0, callback });
  }

  private _devMark(name: string): void {
    if (!this._devProfileBoot) return;
    performance.mark(name);
  }

  private _devMeasure(name: string, startMark: string, endMark?: string): void {
    if (!this._devProfileBoot) return;
    try {
      if (endMark) performance.measure(name, startMark, endMark);
      else performance.measure(name, startMark);
      const entries = performance.getEntriesByName(name, 'measure');
      const duration = entries[entries.length - 1]?.duration;
      if (typeof duration === 'number') {
        console.info(`[BootScene][perf] ${name}: ${duration.toFixed(1)} ms`);
      }
    } catch {
      // Marks are dev-only diagnostics; ignore if missing in test/mocks.
    } finally {
      performance.clearMarks(startMark);
      if (endMark) performance.clearMarks(endMark);
      performance.clearMeasures(name);
    }
  }
}
