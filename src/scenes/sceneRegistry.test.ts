import { describe, it, expect, vi } from 'vitest';

// Minimal Phaser stub — scene files extend Phaser.Scene but are not
// instantiated here; we just need the class symbol to exist.
vi.mock('phaser', () => {
  const KeyCodes = {
    LEFT: 37, UP: 38, RIGHT: 39, DOWN: 40,
    SPACE: 32, ENTER: 13, ESC: 27,
    PAGE_UP: 33, PAGE_DOWN: 34,
    A: 65, B: 66, C: 67, D: 68, I: 73, S: 83, W: 87,
    ONE: 49, TWO: 50, THREE: 51, FOUR: 52, FIVE: 53,
    F12: 123,
    ZERO: 48,
  };
  class Scene {
    constructor(_config?: unknown) {}
  }
  class ScenePlugin {
    constructor(_scene: unknown, _pluginManager: unknown, _pluginKey: string) {}
  }
  const phaser = {
    Scene,
    Input: { Keyboard: { KeyCodes } },
    Plugins: { ScenePlugin },
  };
  return { ...phaser, default: phaser };
});

// Stub config modules to avoid importing the full game configuration.
vi.mock('../config/levelData', () => ({ LEVEL_DATA: {} }));
vi.mock('../config/audioConfig', () => ({
  SCENE_MUSIC: {},
  STATIC_MUSIC_ASSETS: [],
  SFX_EVENTS: {},
}));

// Stub all eager scene classes so their heavy import chains are skipped.
// sceneRegistry only needs their constructor symbols for SCENE_CLASSES.
vi.mock('./core/BootScene', () => ({ BootScene: class BootScene {} }));
vi.mock('./core/MenuScene', () => ({ MenuScene: class MenuScene {} }));
vi.mock('./core/SettingsScene', () => ({ SettingsScene: class SettingsScene {} }));
vi.mock('./core/ControlsScene', () => ({ ControlsScene: class ControlsScene {} }));
vi.mock('./core/PauseScene', () => ({ PauseScene: class PauseScene {} }));
vi.mock('./core/SaveSlotScene', () => ({ SaveSlotScene: class SaveSlotScene {} }));
vi.mock('./elevator/ElevatorScene', () => ({ ElevatorScene: class ElevatorScene {} }));

import {
  SCENE_REGISTRY,
  SCENE_CLASSES,
  validateSceneRegistry,
} from './sceneRegistry';
import type { EagerSceneRegistration } from './sceneRegistry';
import { LAZY_SCENE_LOADERS } from './lazySceneLoaders';

const EXPECTED_EAGER_KEYS = [
  'BootScene',
  'MenuScene',
  'SettingsScene',
  'ControlsScene',
  'PauseScene',
  'SaveSlotScene',
  'ElevatorScene',
];

const EXPECTED_LAZY_KEYS = [
  'PlatformTeamScene',
  'ArchitectureTeamScene',
  'FinanceTeamScene',
  'ProductLeadershipScene',
  'CustomerSuccessScene',
  'ExecutiveSuiteScene',
  'ProductIsyProjectControlsScene',
  'ProductIsyBeskrivelseScene',
  'ProductIsyRoadScene',
  'ProductAdminLisensScene',
  'BossArenaScene',
];

describe('SCENE_REGISTRY structure', () => {
  it('contains all expected eager keys', () => {
    const keys = new Set(SCENE_REGISTRY.map((r) => r.key));
    for (const k of EXPECTED_EAGER_KEYS) {
      expect(keys.has(k), `expected eager key "${k}" to be in SCENE_REGISTRY`).toBe(true);
    }
  });

  it('contains all expected lazy keys', () => {
    const keys = new Set(SCENE_REGISTRY.map((r) => r.key));
    for (const k of EXPECTED_LAZY_KEYS) {
      expect(keys.has(k), `expected lazy key "${k}" to be in SCENE_REGISTRY`).toBe(true);
    }
  });

  it('has no duplicate keys', () => {
    const keys = SCENE_REGISTRY.map((r) => r.key);
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe('SCENE_CLASSES (eager-only)', () => {
  it('matches exactly the cls entries in SCENE_REGISTRY', () => {
    // Derive expected set directly from registry entries that carry a class
    // constructor — this catches any accidental eager→lazy reclassification.
    const registryEagerClasses = SCENE_REGISTRY
      .filter((r): r is EagerSceneRegistration => 'cls' in r)
      .map((r) => r.cls);
    expect(SCENE_CLASSES).toHaveLength(registryEagerClasses.length);
    expect(new Set(SCENE_CLASSES)).toEqual(new Set(registryEagerClasses));
  });

  it('does not include any lazy scene class', () => {
    // Lazy scenes have no statically imported class; SCENE_CLASSES must not
    // grow to include them (they are registered at runtime via scene.add()).
    const lazyKeys = new Set(
      SCENE_REGISTRY.filter((r) => 'loader' in r).map((r) => r.key),
    );
    for (const cls of SCENE_CLASSES) {
      expect(
        lazyKeys.has(cls.name),
        `lazy scene "${cls.name}" must NOT be in SCENE_CLASSES`,
      ).toBe(false);
    }
  });

  it('every entry is a constructor function', () => {
    for (const cls of SCENE_CLASSES) {
      expect(typeof cls).toBe('function');
    }
  });
});

describe('LAZY_SCENE_LOADERS', () => {
  it('contains all expected lazy keys', () => {
    for (const key of EXPECTED_LAZY_KEYS) {
      expect(
        LAZY_SCENE_LOADERS.has(key),
        `expected lazy key "${key}" in LAZY_SCENE_LOADERS`,
      ).toBe(true);
    }
  });

  it('does not contain any eager key', () => {
    for (const key of EXPECTED_EAGER_KEYS) {
      expect(
        LAZY_SCENE_LOADERS.has(key),
        `eager key "${key}" must NOT be in LAZY_SCENE_LOADERS`,
      ).toBe(false);
    }
  });

  it('every loader is a function', () => {
    for (const [, loader] of LAZY_SCENE_LOADERS) {
      expect(typeof loader).toBe('function');
    }
  });
});

describe('validateSceneRegistry', () => {
  it('returns an empty array when LEVEL_DATA and SCENE_MUSIC are empty stubs', () => {
    expect(validateSceneRegistry()).toEqual([]);
  });
});
