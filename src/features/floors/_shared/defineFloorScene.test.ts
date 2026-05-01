import { describe, it, expect, vi } from 'vitest';
import type { LevelConfig } from './LevelScene';
import { FLOORS } from '../../../config/gameConfig';

// ---- Minimal Phaser stub (LevelScene extends Phaser.Scene indirectly) ----
vi.mock('phaser', () => {
  class Scene {
    constructor(_config: unknown) {}
  }
  return { default: { Scene }, Scene };
});

// ---- LevelScene stub — avoids the full Phaser / engine import chain ----
// Must expose all protected fields / methods that defineFloorScene references.
vi.mock('./LevelScene', () => ({
  LevelScene: class MockLevelScene {
    protected floorId: unknown;
    protected returnSide: 'left' | 'right' = 'left';
    /** Captured constructor arg so tests can verify the key was forwarded. */
    readonly _capturedKey: string;

    constructor(key: string, floorId: unknown) {
      this._capturedKey = key;
      this.floorId = floorId;
    }

    protected getBannerTitle(): string { return 'base-title'; }
    protected getBannerDescription(): string { return 'base-description'; }
    protected createDecorations(): void { /* no-op */ }
    protected getLevelConfig(): LevelConfig {
      return {
        floorId: 0,
        platforms: [],
        tokens: [],
        roomElevators: [],
        exitPosition: { x: 0, y: 0 },
        playerStart: { x: 0, y: 0 },
      };
    }
  },
}));

// Must be imported AFTER the mocks are hoisted.
import { defineFloorScene } from './defineFloorScene';

// ─── helpers ────────────────────────────────────────────────────────────────

const MINIMAL_CONFIG: LevelConfig = {
  floorId: FLOORS.PLATFORM_TEAM,
  platforms: [{ x: 0, y: 800, width: 1 }],
  tokens: [],
  roomElevators: [],
  exitPosition: { x: 10, y: 10 },
  playerStart: { x: 20, y: 20 },
};

/** Exposes protected members for white-box testing. */
function makeTestable<T extends { _capturedKey: string }>(
  cls: new () => T,
) {
  return new cls() as T & {
    floorId: unknown;
    returnSide: string;
    getBannerTitle(): string;
    getBannerDescription(): string;
    createDecorations(): void;
    getLevelConfig(): LevelConfig;
  };
}

// ─── tests ──────────────────────────────────────────────────────────────────

describe('defineFloorScene — scene identity', () => {
  it('forwards key to the parent constructor', () => {
    const Scene = defineFloorScene({
      key: 'MyScene',
      floorId: FLOORS.PLATFORM_TEAM,
      config: MINIMAL_CONFIG,
    });
    const instance = makeTestable(Scene as unknown as new () => { _capturedKey: string });
    expect(instance._capturedKey).toBe('MyScene');
  });

  it('forwards floorId to the parent constructor', () => {
    const Scene = defineFloorScene({
      key: 'MyScene',
      floorId: FLOORS.BUSINESS,
      config: MINIMAL_CONFIG,
    });
    const instance = makeTestable(Scene as unknown as new () => { _capturedKey: string });
    expect(instance.floorId).toBe(FLOORS.BUSINESS);
  });
});

describe('defineFloorScene — getLevelConfig', () => {
  it('returns a static config object', () => {
    const Scene = defineFloorScene({
      key: 'S',
      floorId: FLOORS.PLATFORM_TEAM,
      config: MINIMAL_CONFIG,
    });
    const instance = makeTestable(Scene as unknown as new () => { _capturedKey: string });
    expect(instance.getLevelConfig()).toBe(MINIMAL_CONFIG);
  });

  it('calls a config factory function with the scene instance', () => {
    const factory = vi.fn((_scene: unknown) => MINIMAL_CONFIG);
    const Scene = defineFloorScene({
      key: 'S',
      floorId: FLOORS.PLATFORM_TEAM,
      config: factory as (scene: import('./LevelScene').LevelScene) => LevelConfig,
    });
    const instance = makeTestable(Scene as unknown as new () => { _capturedKey: string });
    const cfg = instance.getLevelConfig();
    expect(factory).toHaveBeenCalledOnce();
    expect(factory).toHaveBeenCalledWith(instance);
    expect(cfg).toBe(MINIMAL_CONFIG);
  });

  it('falls back to base getLevelConfig when config is omitted', () => {
    const Scene = defineFloorScene({
      key: 'S',
      floorId: FLOORS.PLATFORM_TEAM,
      // config intentionally omitted
    });
    const instance = makeTestable(Scene as unknown as new () => { _capturedKey: string });
    // The mock base returns a default with floorId: 0
    expect(instance.getLevelConfig().floorId).toBe(0);
  });
});

describe('defineFloorScene — decoration callback', () => {
  it('invokes decorations callback during createDecorations', () => {
    const spy = vi.fn();
    const Scene = defineFloorScene({
      key: 'S',
      floorId: FLOORS.PLATFORM_TEAM,
      config: MINIMAL_CONFIG,
      decorations: spy,
    });
    const instance = makeTestable(Scene as unknown as new () => { _capturedKey: string });
    instance.createDecorations();
    expect(spy).toHaveBeenCalledOnce();
    expect(spy).toHaveBeenCalledWith(instance);
  });

  it('does not throw when no decorations callback is provided', () => {
    const Scene = defineFloorScene({
      key: 'S',
      floorId: FLOORS.PLATFORM_TEAM,
      config: MINIMAL_CONFIG,
    });
    const instance = makeTestable(Scene as unknown as new () => { _capturedKey: string });
    expect(() => instance.createDecorations()).not.toThrow();
  });

  it('calls the callback once per createDecorations invocation', () => {
    const spy = vi.fn();
    const Scene = defineFloorScene({
      key: 'S',
      floorId: FLOORS.PLATFORM_TEAM,
      config: MINIMAL_CONFIG,
      decorations: spy,
    });
    const instance = makeTestable(Scene as unknown as new () => { _capturedKey: string });
    instance.createDecorations();
    instance.createDecorations();
    expect(spy).toHaveBeenCalledTimes(2);
  });
});

describe('defineFloorScene — banner override', () => {
  it('uses provided banner title', () => {
    const Scene = defineFloorScene({
      key: 'S',
      floorId: FLOORS.PLATFORM_TEAM,
      config: MINIMAL_CONFIG,
      banner: { title: 'My Title', description: 'My Desc' },
    });
    const instance = makeTestable(Scene as unknown as new () => { _capturedKey: string });
    expect(instance.getBannerTitle()).toBe('My Title');
  });

  it('uses provided banner description', () => {
    const Scene = defineFloorScene({
      key: 'S',
      floorId: FLOORS.PLATFORM_TEAM,
      config: MINIMAL_CONFIG,
      banner: { title: 'My Title', description: 'My Desc' },
    });
    const instance = makeTestable(Scene as unknown as new () => { _capturedKey: string });
    expect(instance.getBannerDescription()).toBe('My Desc');
  });

  it('falls back to base getBannerTitle when no banner provided', () => {
    const Scene = defineFloorScene({
      key: 'S',
      floorId: FLOORS.PLATFORM_TEAM,
      config: MINIMAL_CONFIG,
    });
    const instance = makeTestable(Scene as unknown as new () => { _capturedKey: string });
    expect(instance.getBannerTitle()).toBe('base-title');
  });

  it('falls back to base getBannerDescription when no banner provided', () => {
    const Scene = defineFloorScene({
      key: 'S',
      floorId: FLOORS.PLATFORM_TEAM,
      config: MINIMAL_CONFIG,
    });
    const instance = makeTestable(Scene as unknown as new () => { _capturedKey: string });
    expect(instance.getBannerDescription()).toBe('base-description');
  });
});

describe('defineFloorScene — returnSide propagation', () => {
  it('sets returnSide when provided', () => {
    const Scene = defineFloorScene({
      key: 'S',
      floorId: FLOORS.PLATFORM_TEAM,
      config: MINIMAL_CONFIG,
      returnSide: 'right',
    });
    const instance = makeTestable(Scene as unknown as new () => { _capturedKey: string });
    expect(instance.returnSide).toBe('right');
  });

  it('leaves returnSide at default when not provided', () => {
    const Scene = defineFloorScene({
      key: 'S',
      floorId: FLOORS.PLATFORM_TEAM,
      config: MINIMAL_CONFIG,
    });
    const instance = makeTestable(Scene as unknown as new () => { _capturedKey: string });
    // Default is 'left' per the mock base class initializer.
    expect(instance.returnSide).toBe('left');
  });
});
