import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { eventBus } from './EventBus';
import {
  settingsStore,
  defaultSettings,
  migrate,
  SETTINGS_STORAGE_KEY,
  type MusicStyle,
  type ColorBlindMode,
  type TextScale,
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
        controlBindings: {},
        onScreenControls: 'always',
        hideTutorials: true,
        showObjectiveBanner: false,
        highContrast: true,
        hapticsEnabled: false,
        colorBlindMode: 'deuteranopia',
        textScale: 1.3,
        analyticsConsent: true,
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
      expect(s.onScreenControls).toBe('always');
      expect(s.hideTutorials).toBe(true);
      expect(s.showObjectiveBanner).toBe(false);
      expect(s.highContrast).toBe(true);
      expect(s.hapticsEnabled).toBe(false);
      expect(s.colorBlindMode).toBe('deuteranopia');
      expect(s.textScale).toBe(1.3);
      expect(s.analyticsConsent).toBe(true);
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

    it('round-trips onScreenControls', () => {
      settingsStore.setOnScreenControls('never');
      settingsStore._store.setStorage(globalThis.localStorage);
      expect(settingsStore.read().onScreenControls).toBe('never');
    });

    it('falls back to auto for invalid onScreenControls values', () => {
      localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify({ onScreenControls: 'banana' }));
      settingsStore._store.setStorage(globalThis.localStorage);
      expect(settingsStore.read().onScreenControls).toBe('auto');
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

  describe('settings:changed event', () => {
    it('emits settings:changed for non-audio settings (setMusicStyle)', () => {
      const listener = vi.fn();
      eventBus.on('settings:changed', listener);
      settingsStore.setMusicStyle('retro-synth');
      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('emits settings:changed for non-audio settings (setReducedMotion)', () => {
      const listener = vi.fn();
      eventBus.on('settings:changed', listener);
      settingsStore.setReducedMotion(true);
      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('emits settings:changed for non-audio settings (setOnScreenControls)', () => {
      const listener = vi.fn();
      eventBus.on('settings:changed', listener);
      settingsStore.setOnScreenControls('always');
      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('does NOT emit settings:changed for audio settings (setMasterVolume, setMuteAll)', () => {
      const listener = vi.fn();
      eventBus.on('settings:changed', listener);
      settingsStore.setMasterVolume(50);
      settingsStore.setMuteAll(true);
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

  describe('controlBindings', () => {
    it('defaults to an empty object', () => {
      expect(settingsStore.read().controlBindings).toEqual({});
    });

    it('setControlBindings persists an override', () => {
      settingsStore.setControlBindings({ MoveLeft: [72] }); // H key
      expect(settingsStore.read().controlBindings).toEqual({ MoveLeft: [72] });
    });

    it('resetControlBindings clears all overrides', () => {
      settingsStore.setControlBindings({ Jump: [74] }); // J key
      settingsStore.resetControlBindings();
      expect(settingsStore.read().controlBindings).toEqual({});
    });

    it('round-trips controlBindings through storage', () => {
      settingsStore.setControlBindings({ MoveLeft: [72], MoveRight: [76] });
      settingsStore._store.setStorage(globalThis.localStorage);
      const s = settingsStore.read();
      expect(s.controlBindings).toEqual({ MoveLeft: [72], MoveRight: [76] });
    });

    it('ignores invalid (non-integer / non-positive) key codes on parse', () => {
      localStorage.setItem(
        SETTINGS_STORAGE_KEY,
        JSON.stringify({ controlBindings: { MoveLeft: [-1], MoveRight: [65.5], Jump: ['x'] } }),
      );
      settingsStore._store.setStorage(globalThis.localStorage);
      expect(settingsStore.read().controlBindings).toEqual({});
    });

    it('ignores unknown action keys on parse', () => {
      localStorage.setItem(
        SETTINGS_STORAGE_KEY,
        JSON.stringify({ controlBindings: { NotARealAction: [65], MoveLeft: [72] } }),
      );
      settingsStore._store.setStorage(globalThis.localStorage);
      expect(settingsStore.read().controlBindings).toEqual({ MoveLeft: [72] });
    });

    it('rejects proto-poison keys on parse', () => {
      localStorage.setItem(
        SETTINGS_STORAGE_KEY,
        JSON.stringify({ controlBindings: { __proto__: [65], constructor: [66], MoveLeft: [72] } }),
      );
      settingsStore._store.setStorage(globalThis.localStorage);
      const bindings = settingsStore.read().controlBindings;
      expect(bindings).not.toHaveProperty('__proto__');
      expect(bindings).not.toHaveProperty('constructor');
      expect(bindings).toEqual({ MoveLeft: [72] });
    });

    it('does not emit audio:volume-changed when updating controlBindings', () => {
      const listener = vi.fn();
      eventBus.on('audio:volume-changed', listener);
      settingsStore.setControlBindings({ Jump: [74] });
      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe('hideTutorials', () => {
    it('defaults to false', () => {
      expect(settingsStore.read().hideTutorials).toBe(false);
    });

    it('setHideTutorials(true) persists the flag', () => {
      settingsStore.setHideTutorials(true);
      expect(settingsStore.read().hideTutorials).toBe(true);
    });

    it('setHideTutorials(false) clears the flag', () => {
      settingsStore.setHideTutorials(true);
      settingsStore.setHideTutorials(false);
      expect(settingsStore.read().hideTutorials).toBe(false);
    });

    it('falls back to false when the stored value is not a boolean', () => {
      localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify({ hideTutorials: 'yes' }));
      settingsStore._store.setStorage(globalThis.localStorage);
      expect(settingsStore.read().hideTutorials).toBe(false);
    });

    it('round-trips through storage', () => {
      settingsStore.setHideTutorials(true);
      settingsStore._store.setStorage(globalThis.localStorage);
      expect(settingsStore.read().hideTutorials).toBe(true);
    });

    it('does NOT emit audio:volume-changed when updating hideTutorials', () => {
      const listener = vi.fn();
      eventBus.on('audio:volume-changed', listener);
      settingsStore.setHideTutorials(true);
      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe('showObjectiveBanner', () => {
    it('defaults to true', () => {
      expect(settingsStore.read().showObjectiveBanner).toBe(true);
    });

    it('setShowObjectiveBanner(false) persists the flag', () => {
      settingsStore.setShowObjectiveBanner(false);
      expect(settingsStore.read().showObjectiveBanner).toBe(false);
    });

    it('falls back to true when stored value is not boolean', () => {
      localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify({ showObjectiveBanner: 'no' }));
      settingsStore._store.setStorage(globalThis.localStorage);
      expect(settingsStore.read().showObjectiveBanner).toBe(true);
    });

    it('emits settings:changed (not audio:volume-changed)', () => {
      const audioListener = vi.fn();
      const settingsListener = vi.fn();
      eventBus.on('audio:volume-changed', audioListener);
      eventBus.on('settings:changed', settingsListener);
      settingsStore.setShowObjectiveBanner(false);
      expect(audioListener).not.toHaveBeenCalled();
      expect(settingsListener).toHaveBeenCalledTimes(1);
    });
  });

  describe('colorBlindMode', () => {
    const modes: ColorBlindMode[] = ['off', 'deuteranopia', 'protanopia', 'tritanopia'];

    it('defaults to "off"', () => {
      expect(settingsStore.read().colorBlindMode).toBe('off');
    });

    for (const mode of modes) {
      it(`setColorBlindMode("${mode}") persists the mode`, () => {
        settingsStore.setColorBlindMode(mode);
        expect(settingsStore.read().colorBlindMode).toBe(mode);
      });
    }

    it('round-trips colorBlindMode through storage', () => {
      settingsStore.setColorBlindMode('tritanopia');
      settingsStore._store.setStorage(globalThis.localStorage);
      expect(settingsStore.read().colorBlindMode).toBe('tritanopia');
    });

    it('falls back to "off" for invalid stored value', () => {
      localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify({ colorBlindMode: 'rainbow' }));
      settingsStore._store.setStorage(globalThis.localStorage);
      expect(settingsStore.read().colorBlindMode).toBe('off');
    });

    it('falls back to "off" when field is missing from stored object', () => {
      localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify({ masterVolume: 50 }));
      settingsStore._store.setStorage(globalThis.localStorage);
      expect(settingsStore.read().colorBlindMode).toBe('off');
    });

    it('emits settings:changed (not audio:volume-changed)', () => {
      const audioListener = vi.fn();
      const settingsListener = vi.fn();
      eventBus.on('audio:volume-changed', audioListener);
      eventBus.on('settings:changed', settingsListener);
      settingsStore.setColorBlindMode('protanopia');
      expect(audioListener).not.toHaveBeenCalled();
      expect(settingsListener).toHaveBeenCalledTimes(1);
    });
  });

  describe('highContrast', () => {
    it('defaults to false', () => {
      expect(settingsStore.read().highContrast).toBe(false);
    });

    it('setHighContrast(true) persists the flag', () => {
      settingsStore.setHighContrast(true);
      expect(settingsStore.read().highContrast).toBe(true);
    });

    it('setHighContrast(false) clears the flag', () => {
      settingsStore.setHighContrast(true);
      settingsStore.setHighContrast(false);
      expect(settingsStore.read().highContrast).toBe(false);
    });

    it('round-trips through storage', () => {
      settingsStore.setHighContrast(true);
      settingsStore._store.setStorage(globalThis.localStorage);
      expect(settingsStore.read().highContrast).toBe(true);
    });

    it('migrates legacy highContrastControls=true to highContrast=true', () => {
      localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify({ highContrastControls: true }));
      settingsStore._store.setStorage(globalThis.localStorage);
      expect(settingsStore.read().highContrast).toBe(true);
    });

    it('migrates legacy highContrastControls=false to highContrast=false', () => {
      localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify({ highContrastControls: false }));
      settingsStore._store.setStorage(globalThis.localStorage);
      expect(settingsStore.read().highContrast).toBe(false);
    });

    it('explicit highContrast takes precedence over legacy highContrastControls', () => {
      localStorage.setItem(
        SETTINGS_STORAGE_KEY,
        JSON.stringify({ highContrast: true, highContrastControls: false }),
      );
      settingsStore._store.setStorage(globalThis.localStorage);
      expect(settingsStore.read().highContrast).toBe(true);
    });

    it('emits settings:changed (not audio:volume-changed)', () => {
      const audioListener = vi.fn();
      const settingsListener = vi.fn();
      eventBus.on('audio:volume-changed', audioListener);
      eventBus.on('settings:changed', settingsListener);
      settingsStore.setHighContrast(true);
      expect(audioListener).not.toHaveBeenCalled();
      expect(settingsListener).toHaveBeenCalledTimes(1);
    });
  });

  describe('textScale', () => {
    const scales: TextScale[] = [1, 1.15, 1.3, 1.5];

    it('defaults to 1', () => {
      expect(settingsStore.read().textScale).toBe(1);
    });

    for (const scale of scales) {
      it(`setTextScale(${scale}) persists the value`, () => {
        settingsStore.setTextScale(scale);
        expect(settingsStore.read().textScale).toBe(scale);
      });
    }

    it('round-trips textScale through storage', () => {
      settingsStore.setTextScale(1.5);
      settingsStore._store.setStorage(globalThis.localStorage);
      expect(settingsStore.read().textScale).toBe(1.5);
    });

    it('falls back to 1 for invalid stored value', () => {
      localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify({ textScale: 2.0 }));
      settingsStore._store.setStorage(globalThis.localStorage);
      expect(settingsStore.read().textScale).toBe(1);
    });

    it('falls back to 1 when field is missing', () => {
      localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify({ masterVolume: 50 }));
      settingsStore._store.setStorage(globalThis.localStorage);
      expect(settingsStore.read().textScale).toBe(1);
    });

    it('emits settings:changed (not audio:volume-changed)', () => {
      const audioListener = vi.fn();
      const settingsListener = vi.fn();
      eventBus.on('audio:volume-changed', audioListener);
      eventBus.on('settings:changed', settingsListener);
      settingsStore.setTextScale(1.3);
      expect(audioListener).not.toHaveBeenCalled();
      expect(settingsListener).toHaveBeenCalledTimes(1);
    });
  });

  describe('analyticsConsent', () => {
    it('defaults to false', () => {
      expect(settingsStore.read().analyticsConsent).toBe(false);
    });

    it('setAnalyticsConsent(true) persists the value', () => {
      settingsStore.setAnalyticsConsent(true);
      expect(settingsStore.read().analyticsConsent).toBe(true);
    });

    it('round-trips through storage', () => {
      settingsStore.setAnalyticsConsent(true);
      settingsStore._store.setStorage(globalThis.localStorage);
      expect(settingsStore.read().analyticsConsent).toBe(true);
    });

    it('falls back to false when the stored value is not a boolean', () => {
      localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify({ analyticsConsent: 'yes' }));
      settingsStore._store.setStorage(globalThis.localStorage);
      expect(settingsStore.read().analyticsConsent).toBe(false);
    });

    it('falls back to false when field is missing', () => {
      localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify({ masterVolume: 50 }));
      settingsStore._store.setStorage(globalThis.localStorage);
      expect(settingsStore.read().analyticsConsent).toBe(false);
    });

    it('does NOT emit audio:volume-changed when updating analyticsConsent', () => {
      const listener = vi.fn();
      eventBus.on('audio:volume-changed', listener);
      settingsStore.setAnalyticsConsent(true);
      expect(listener).not.toHaveBeenCalled();
    });

    it('emits settings:changed when updating analyticsConsent', () => {
      const listener = vi.fn();
      eventBus.on('settings:changed', listener);
      settingsStore.setAnalyticsConsent(true);
      expect(listener).toHaveBeenCalledTimes(1);
    });
  });
});
