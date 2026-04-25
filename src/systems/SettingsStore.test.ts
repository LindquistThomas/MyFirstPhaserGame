import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { eventBus } from './EventBus';
import {
  settingsStore,
  defaultSettings,
  migrate,
  SETTINGS_STORAGE_KEY,
  type MusicStyle,
} from './SettingsStore';
import type { KVStorage } from './SaveManager';

const LEGACY_MUTE_KEY = 'architect_audio_muted_v1';

/** In-memory KVStorage for test isolation. */
function memoryStorage(): KVStorage & { store: Map<string, string> } {
  const store = new Map<string, string>();
  return {
    store,
    getItem: (k) => store.get(k) ?? null,
    setItem: (k, v) => { store.set(k, v); },
    removeItem: (k) => { store.delete(k); },
  };
}

describe('SettingsStore', () => {
  beforeEach(() => {
    localStorage.clear();
    eventBus.removeAllListeners();
    // Invalidate the store's cache so each test starts fresh from storage.
    settingsStore._store.setStorage(globalThis.localStorage);
  });

  afterEach(() => {
    eventBus.removeAllListeners();
    localStorage.clear();
  });

  describe('defaults', () => {
    it('returns sensible defaults when storage is empty', () => {
      const s = settingsStore.read();
      expect(s.masterVolume).toBe(80);
      expect(s.musicVolume).toBe(70);
      expect(s.sfxVolume).toBe(90);
      expect(s.muteAll).toBe(false);
      expect(s.musicStyle).toBe('8bit-chiptune');
    });

    it('defaultSettings() returns independent objects each call', () => {
      const a = defaultSettings();
      const b = defaultSettings();
      a.masterVolume = 0;
      expect(b.masterVolume).toBe(80);
    });
  });

  describe('persistence', () => {
    it('persists settings and reads them back', () => {
      settingsStore.setMasterVolume(50);
      const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
      expect(raw).not.toBeNull();
      const parsed = JSON.parse(raw!) as { masterVolume: number };
      expect(parsed.masterVolume).toBe(50);
    });

    it('round-trips all fields', () => {
      settingsStore.update(() => ({
        masterVolume: 42,
        musicVolume: 55,
        sfxVolume: 33,
        muteAll: true,
        musicStyle: 'retro-synth',
        reducedMotion: true,
      }));
      // Force cache-miss by re-pointing at the same storage.
      settingsStore._store.setStorage(globalThis.localStorage);
      const s = settingsStore.read();
      expect(s.masterVolume).toBe(42);
      expect(s.musicVolume).toBe(55);
      expect(s.sfxVolume).toBe(33);
      expect(s.muteAll).toBe(true);
      expect(s.musicStyle).toBe('retro-synth');
      expect(s.reducedMotion).toBe(true);
    });

    it('clamps masterVolume to 0-100 on parse', () => {
      localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify({ masterVolume: 200 }));
      settingsStore._store.setStorage(globalThis.localStorage);
      expect(settingsStore.read().masterVolume).toBe(100);

      localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify({ masterVolume: -5 }));
      settingsStore._store.setStorage(globalThis.localStorage);
      expect(settingsStore.read().masterVolume).toBe(0);
    });

    it('falls back to default musicStyle for invalid values', () => {
      localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify({ musicStyle: 'unknown-genre' }));
      settingsStore._store.setStorage(globalThis.localStorage);
      expect(settingsStore.read().musicStyle).toBe('8bit-chiptune');
    });

    it('works with an isolated in-memory storage', () => {
      const mem = memoryStorage();
      settingsStore._store.setStorage(mem);
      settingsStore.setMusicVolume(25);
      expect(mem.store.has(SETTINGS_STORAGE_KEY)).toBe(true);
      // Restore
      settingsStore._store.setStorage(globalThis.localStorage);
    });
  });

  describe('setMuteAll / toggleMute', () => {
    it('setMuteAll(true) persists muteAll', () => {
      settingsStore.setMuteAll(true);
      expect(settingsStore.read().muteAll).toBe(true);
    });

    it('setMuteAll(false) persists muteAll', () => {
      settingsStore.setMuteAll(true);
      settingsStore.setMuteAll(false);
      expect(settingsStore.read().muteAll).toBe(false);
    });

    it('toggleMute flips muteAll', () => {
      expect(settingsStore.read().muteAll).toBe(false);
      settingsStore.toggleMute();
      expect(settingsStore.read().muteAll).toBe(true);
      settingsStore.toggleMute();
      expect(settingsStore.read().muteAll).toBe(false);
    });
  });

  describe('volume helpers', () => {
    it('setMasterVolume clamps to 0-100', () => {
      settingsStore.setMasterVolume(150);
      expect(settingsStore.read().masterVolume).toBe(100);
      settingsStore.setMasterVolume(-10);
      expect(settingsStore.read().masterVolume).toBe(0);
    });

    it('setMusicVolume updates only musicVolume', () => {
      const before = settingsStore.read().masterVolume;
      settingsStore.setMusicVolume(60);
      expect(settingsStore.read().musicVolume).toBe(60);
      expect(settingsStore.read().masterVolume).toBe(before);
    });

    it('setSfxVolume updates only sfxVolume', () => {
      settingsStore.setSfxVolume(40);
      expect(settingsStore.read().sfxVolume).toBe(40);
    });
  });

  describe('setMusicStyle', () => {
    const styles: MusicStyle[] = ['8bit-chiptune', 'retro-synth', 'elevator-jazz'];
    for (const style of styles) {
      it(`stores style "${style}"`, () => {
        settingsStore.setMusicStyle(style);
        expect(settingsStore.read().musicStyle).toBe(style);
      });
    }
  });

  describe('setReducedMotion', () => {
    it('stores true', () => {
      settingsStore.setReducedMotion(true);
      expect(settingsStore.read().reducedMotion).toBe(true);
    });

    it('stores false', () => {
      settingsStore.setReducedMotion(true);
      settingsStore.setReducedMotion(false);
      expect(settingsStore.read().reducedMotion).toBe(false);
    });
  });

  describe('audio:volume-changed event', () => {
    it('emits audio:volume-changed for audio settings (masterVolume, muteAll)', () => {
      const listener = vi.fn();
      eventBus.on('audio:volume-changed', listener);
      settingsStore.setMasterVolume(50);
      settingsStore.setMuteAll(true);
      expect(listener).toHaveBeenCalledTimes(2);
    });

    it('does NOT emit audio:volume-changed for non-audio settings (musicStyle, reducedMotion)', () => {
      const listener = vi.fn();
      eventBus.on('audio:volume-changed', listener);
      settingsStore.setMusicStyle('retro-synth');
      settingsStore.setReducedMotion(true);
      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe('migrate()', () => {
    it('migrates legacy "true" mute to muteAll=true', () => {
      const mem = memoryStorage();
      mem.setItem(LEGACY_MUTE_KEY, 'true');
      settingsStore._store.setStorage(mem);
      const origLS = globalThis.localStorage;
      Object.defineProperty(globalThis, 'localStorage', { value: mem, configurable: true });
      try {
        migrate();
      } finally {
        Object.defineProperty(globalThis, 'localStorage', { value: origLS, configurable: true });
      }
      settingsStore._store.setStorage(mem);
      expect(settingsStore.read().muteAll).toBe(true);
      expect(mem.getItem(LEGACY_MUTE_KEY)).toBeNull();
    });

    it('migrates legacy "1" encoding to muteAll=true', () => {
      const mem = memoryStorage();
      mem.setItem(LEGACY_MUTE_KEY, '1');
      settingsStore._store.setStorage(mem);
      const origLS = globalThis.localStorage;
      Object.defineProperty(globalThis, 'localStorage', { value: mem, configurable: true });
      try {
        migrate();
      } finally {
        Object.defineProperty(globalThis, 'localStorage', { value: origLS, configurable: true });
      }
      settingsStore._store.setStorage(mem);
      expect(settingsStore.read().muteAll).toBe(true);
      expect(mem.getItem(LEGACY_MUTE_KEY)).toBeNull();
    });

    it('does not overwrite existing settings during migration', () => {
      const mem = memoryStorage();
      const existing = defaultSettings();
      existing.masterVolume = 42;
      existing.muteAll = false;
      mem.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(existing));
      mem.setItem(LEGACY_MUTE_KEY, 'true');
      settingsStore._store.setStorage(mem);
      const origLS = globalThis.localStorage;
      Object.defineProperty(globalThis, 'localStorage', { value: mem, configurable: true });
      try {
        migrate();
      } finally {
        Object.defineProperty(globalThis, 'localStorage', { value: origLS, configurable: true });
      }
      settingsStore._store.setStorage(mem);
      const s = settingsStore.read();
      // existing settings should be intact — muteAll stays false even though legacy said true
      expect(s.muteAll).toBe(false);
      expect(s.masterVolume).toBe(42);
      // legacy key removed either way
      expect(mem.getItem(LEGACY_MUTE_KEY)).toBeNull();
    });

    it('is a no-op when no legacy key is present', () => {
      const mem = memoryStorage();
      settingsStore._store.setStorage(mem);
      const origLS = globalThis.localStorage;
      Object.defineProperty(globalThis, 'localStorage', { value: mem, configurable: true });
      try {
        migrate();
      } finally {
        Object.defineProperty(globalThis, 'localStorage', { value: origLS, configurable: true });
      }
      // Settings should remain at defaults
      settingsStore._store.setStorage(mem);
      const s = settingsStore.read();
      expect(s.muteAll).toBe(false);
      expect(s.masterVolume).toBe(80);
    });
  });
});
