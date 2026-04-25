/**
 * Settings store — single source of truth for player-facing settings.
 *
 * Persisted under `architect_settings_v1` in localStorage.
 * On first load it migrates the legacy `architect_audio_muted_v1` entry so
 * existing players keep their mute preference. The legacy key is removed
 * after migration.
 *
 * All mutations emit `audio:volume-changed` on the global EventBus so
 * AudioManager can react immediately.
 */

import { createPersistedStore } from './PersistedStore';
import { eventBus } from './EventBus';

export type MusicStyle = '8bit-chiptune' | 'retro-synth' | 'elevator-jazz';

export interface SettingsData {
  /** Overall audio level (0–100). Applied as the global Phaser sound-manager volume. */
  masterVolume: number;
  /** Music channel level (0–100). Scaled on top of the authored track volume. */
  musicVolume: number;
  /** SFX channel level (0–100). */
  sfxVolume: number;
  /** When true, all audio is silenced. Supersedes `architect_audio_muted_v1`. */
  muteAll: boolean;
  /** Preferred music style — takes effect on the next scene transition. */
  musicStyle: MusicStyle;
  /**
   * When true, skip non-essential animations (parallax, tweens, particle effects).
   * Defaults to the OS/browser prefers-reduced-motion media query.
   */
  reducedMotion: boolean;
}

export const SETTINGS_STORAGE_KEY = 'architect_settings_v1';
const LEGACY_MUTE_KEY = 'architect_audio_muted_v1';

const VALID_MUSIC_STYLES: ReadonlySet<string> = new Set(['8bit-chiptune', 'retro-synth', 'elevator-jazz']);

function defaultReducedMotion(): boolean {
  try {
    return globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  } catch {
    return false;
  }
}

export function defaultSettings(): SettingsData {
  return {
    masterVolume: 80,
    musicVolume: 70,
    sfxVolume: 90,
    muteAll: false,
    musicStyle: '8bit-chiptune',
    reducedMotion: defaultReducedMotion(),
  };
}

function parseSettings(raw: unknown): SettingsData {
  const defaults = defaultSettings();
  if (raw === null || typeof raw !== 'object') return defaults;
  const r = raw as Record<string, unknown>;

  const clamp = (v: unknown, min: number, max: number, fallback: number): number => {
    const n = Number(v);
    return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : fallback;
  };

  return {
    masterVolume: clamp(r['masterVolume'], 0, 100, defaults.masterVolume),
    musicVolume: clamp(r['musicVolume'], 0, 100, defaults.musicVolume),
    sfxVolume: clamp(r['sfxVolume'], 0, 100, defaults.sfxVolume),
    muteAll: typeof r['muteAll'] === 'boolean' ? r['muteAll'] : defaults.muteAll,
    musicStyle: VALID_MUSIC_STYLES.has(r['musicStyle'] as string)
      ? (r['musicStyle'] as MusicStyle)
      : defaults.musicStyle,
    reducedMotion: typeof r['reducedMotion'] === 'boolean' ? r['reducedMotion'] : defaults.reducedMotion,
  };
}

const store = createPersistedStore<SettingsData>({
  key: SETTINGS_STORAGE_KEY,
  defaultValue: defaultSettings,
  parse: parseSettings,
});

/**
 * Migrate the legacy mute preference to the new settings store.
 * Exported for unit testing; called automatically at module load.
 * Removes the old key after migration.
 */
export function migrate(): void {
  try {
    const ls = globalThis.localStorage;
    if (!ls) return;
    const legacy = ls.getItem(LEGACY_MUTE_KEY);
    if (legacy === null) return;
    const wasMuted = legacy === 'true' || legacy === '1';
    // Only write muteAll when there is no existing settings entry so we
    // don't overwrite settings the player has already configured.
    if (ls.getItem(SETTINGS_STORAGE_KEY) === null) {
      const data = defaultSettings();
      data.muteAll = wasMuted;
      store.write(data);
    }
    ls.removeItem(LEGACY_MUTE_KEY);
  } catch {
    // Storage unavailable — no-op.
  }
}

migrate();

/** Singleton settings store. Import and use everywhere instead of reading localStorage directly. */
export const settingsStore = {
  /** Read the current settings (never throws, falls back to defaults). */
  read(): SettingsData {
    return store.read();
  },

  /**
   * Apply a transform to the current settings, persist, and notify listeners.
   * `audio:volume-changed` is emitted so AudioManager can react immediately.
   */
  update(fn: (prev: SettingsData) => SettingsData): void {
    store.update(fn);
    eventBus.emit('audio:volume-changed');
  },

  setMuteAll(muted: boolean): void {
    this.update((prev) => ({ ...prev, muteAll: muted }));
  },

  toggleMute(): void {
    this.update((prev) => ({ ...prev, muteAll: !prev.muteAll }));
  },

  setMasterVolume(volume: number): void {
    this.update((prev) => ({ ...prev, masterVolume: Math.max(0, Math.min(100, Math.round(volume))) }));
  },

  setMusicVolume(volume: number): void {
    this.update((prev) => ({ ...prev, musicVolume: Math.max(0, Math.min(100, Math.round(volume))) }));
  },

  setSfxVolume(volume: number): void {
    this.update((prev) => ({ ...prev, sfxVolume: Math.max(0, Math.min(100, Math.round(volume))) }));
  },

  setMusicStyle(style: MusicStyle): void {
    this.update((prev) => ({ ...prev, musicStyle: style }));
  },

  setReducedMotion(reduced: boolean): void {
    this.update((prev) => ({ ...prev, reducedMotion: reduced }));
  },

  /** Exposed for tests that need to swap the underlying storage. */
  _store: store,
};
