import * as Phaser from 'phaser';
import { SCENE_MUSIC, STATIC_MUSIC_ASSETS } from '../config/audioConfig';
import { eventBus } from '../systems/EventBus';

/** Build a key→path lookup once from the full catalog. */
const MUSIC_PATH: Readonly<Record<string, string>> = Object.fromEntries(
  STATIC_MUSIC_ASSETS.map(({ key, path }) => [key, path]),
);

/**
 * Phaser ScenePlugin — bridges the framework's scene lifecycle to the
 * standalone EventBus.
 *
 * Auto-attached to every scene via the game config. On each scene's
 * `create` event it looks up SCENE_MUSIC and:
 *   - emits `music:play` immediately if the audio is already in cache, OR
 *   - lazy-loads the file first (via the scene's own Loader) and emits
 *     `music:play` once loading completes.
 *
 * Also handles `music:request` / `music:request-push` while the scene is
 * active, so that any call site (ElevatorController, QuizDialog, etc.) can
 * request a non-eager track without worrying about the cache state.
 *
 * Scenes themselves never touch audio code directly.
 *
 * Uses the standard Phaser start/shutdown re-registration pattern so
 * the `create` listener is reliably re-attached on every scene restart.
 */
export class MusicPlugin extends Phaser.Plugins.ScenePlugin {
  // Arrow-function fields so the same reference is used for on/off.
  private readonly onMusicRequest = (key: string): void => {
    this.playOrLoad(key);
  };

  private readonly onMusicRequestPush = (key: string): void => {
    this.loadAndEmitPush(key);
  };

  boot(): void {
    const events = this.systems!.events;
    events.on('start', this.onSceneStart, this);
    events.once('destroy', this.onSceneDestroy, this);
  }

  private onSceneStart(): void {
    const events = this.systems!.events;
    events.on('create', this.onSceneCreate, this);
    events.once('shutdown', this.onSceneShutdown, this);
    // Subscribe to music:request / music:request-push while this scene is active.
    // Unsubscribed in onSceneShutdown so only the live scene's plugin handles them.
    eventBus.on('music:request', this.onMusicRequest);
    eventBus.on('music:request-push', this.onMusicRequestPush);
  }

  private onSceneCreate(): void {
    const sceneKey = this.scene!.scene.key;
    const musicKey = SCENE_MUSIC[sceneKey];
    if (!musicKey) return;

    this.playOrLoad(musicKey);
  }

  /**
   * Emit `music:play` for `key`. If the audio isn't in Phaser's cache yet,
   * queue it for loading first and wait for the `filecomplete` event before
   * emitting. Subsequent calls hit the cache and are instant.
   */
  playOrLoad(musicKey: string): void {
    const scene = this.scene!;

    // Already cached — play immediately.
    if (scene.cache.audio.exists(musicKey)) {
      eventBus.emit('music:play', musicKey);
      return;
    }

    const path = MUSIC_PATH[musicKey];
    if (!path) {
      // Unknown key; nothing to load. Play anyway and let AudioManager handle the miss.
      eventBus.emit('music:play', musicKey);
      return;
    }

    // Queue the audio file for loading on this scene's loader, then start.
    // Using 'once' on filecomplete so each plugin instance fires at most once
    // per load — AudioManager's same-key guard handles any duplicate emits.
    scene.load.audio(musicKey, path);
    scene.load.once(`filecomplete-audio-${musicKey}`, () => {
      eventBus.emit('music:play', musicKey);
    });
    scene.load.start();
  }

  /**
   * Like `playOrLoad` but emits `music:push` instead of `music:play`,
   * preserving the AudioManager's push-stack semantics (pair with `music:pop`).
   */
  loadAndEmitPush(musicKey: string): void {
    const scene = this.scene!;

    if (scene.cache.audio.exists(musicKey)) {
      eventBus.emit('music:push', musicKey);
      return;
    }

    const path = MUSIC_PATH[musicKey];
    if (!path) {
      eventBus.emit('music:push', musicKey);
      return;
    }

    scene.load.audio(musicKey, path);
    scene.load.once(`filecomplete-audio-${musicKey}`, () => {
      eventBus.emit('music:push', musicKey);
    });
    scene.load.start();
  }

  private onSceneShutdown(): void {
    this.systems?.events.off('create', this.onSceneCreate, this);
    eventBus.off('music:request', this.onMusicRequest);
    eventBus.off('music:request-push', this.onMusicRequestPush);
  }

  private onSceneDestroy(): void {
    this.onSceneShutdown();
    this.systems?.events.off('start', this.onSceneStart, this);
  }
}
