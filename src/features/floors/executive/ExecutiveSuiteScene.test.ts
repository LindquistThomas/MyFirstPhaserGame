import { describe, it, expect, vi, beforeAll } from 'vitest';
import { assertValidLevelConfig } from '../_shared/validateLevelConfig';
import type { LevelConfig } from '../_shared/LevelScene';
import { INFO_POINTS } from '../../../config/info';
import { GAME_WIDTH, GAME_HEIGHT } from '../../../config/gameConfig';

vi.mock('phaser', () => {
  class Scene {
    constructor(_config: unknown) {}
  }
  class ArcadeSprite {
    constructor(_scene: unknown, _x: unknown, _y: unknown, _key: unknown) {}
  }
  const Physics = { Arcade: { Sprite: ArcadeSprite, Events: { WORLD_BOUNDS: 'worldbounds' } } };
  return { default: { Scene, Physics }, Scene, Physics };
});

vi.mock('../_shared/LevelScene', () => ({
  LevelScene: class LevelScene {
    protected floorId: unknown;
    constructor(_key: string, floorId: unknown) {
      this.floorId = floorId;
    }
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

// ExecutiveSuiteScene imports allKeyLabels from the input barrel, which
// transitively pulls in InputService → Phaser.Plugins.ScenePlugin.
// Stub the whole input barrel to avoid that chain.
vi.mock('../../../input', () => ({
  allKeyLabels: vi.fn(() => 'Enter'),
}));

// InteractiveDoor extends nothing Phaser-critical at module level, but
// mocking it keeps the import chain minimal and self-documenting.
vi.mock('../../../ui/InteractiveDoor', () => ({
  InteractiveDoor: class InteractiveDoor {
    setOpen(_open: boolean) {}
    onPointerDown(_cb: () => void) { return this; }
  },
}));

// MissionItem uses Phaser.Physics.Arcade.Sprite — stub it.
vi.mock('../../../entities/MissionItem', () => ({
  MissionItem: class MissionItem {
    itemId: string;
    constructor(_s: unknown, _x: unknown, _y: unknown, id: string, _cb: unknown) {
      this.itemId = id;
    }
    collect() {}
  },
}));

// TerroristCommander uses Phaser Physics — stub it.
vi.mock('../../../entities/enemies/TerroristCommander', () => ({
  TerroristCommander: class TerroristCommander {
    defeated = false;
    knockbackX = 300;
    knockbackY = -280;
    constructor() {}
    update() {}
    defeat() {}
  },
}));

// PistolProjectile uses Phaser Physics — stub it.
vi.mock('../../../entities/PistolProjectile', () => ({
  PistolProjectile: class PistolProjectile {
    constructor() {}
    destroySelf() {}
  },
}));

// eventBus is a singleton — stub the emit to avoid side effects in config tests.
vi.mock('../../../systems/EventBus', () => ({
  eventBus: { emit: vi.fn(), on: vi.fn(), off: vi.fn(), once: vi.fn() },
}));

// loadDeferredMusic is called in preload(), not getLevelConfig().
// Stub it so the import resolves without side effects.
vi.mock('../../../config/audioConfig', async (importOriginal) => {
  const original = await importOriginal<typeof import('../../../config/audioConfig')>();
  return { ...original, loadDeferredMusic: vi.fn() };
});

import { ExecutiveSuiteScene } from './ExecutiveSuiteScene';

class TestableExecutiveSuiteScene extends ExecutiveSuiteScene {
  public getConfig(): LevelConfig {
    return this.getLevelConfig();
  }
}

describe('ExecutiveSuiteScene — LevelConfig', () => {
  let cfg: LevelConfig;

  beforeAll(() => {
    cfg = new TestableExecutiveSuiteScene().getConfig();
  });

  it('passes the shared assertValidLevelConfig validator', () => {
    expect(() => assertValidLevelConfig(cfg)).not.toThrow();
  });

  it('has at least one platform', () => {
    expect(cfg.platforms.length).toBeGreaterThan(0);
  });

  it('has at least one token', () => {
    expect(cfg.tokens.length).toBeGreaterThan(0);
  });

  it('has at least one infoPoint', () => {
    expect((cfg.infoPoints ?? []).length).toBeGreaterThan(0);
  });

  it('every infoPoint contentId resolves in INFO_POINTS', () => {
    for (const point of cfg.infoPoints ?? []) {
      expect(INFO_POINTS).toHaveProperty(point.contentId);
    }
  });

  it('every token x/y is within world bounds', () => {
    for (const token of cfg.tokens) {
      expect(token.x).toBeGreaterThanOrEqual(0);
      expect(token.x).toBeLessThanOrEqual(GAME_WIDTH);
      expect(token.y).toBeGreaterThanOrEqual(0);
      expect(token.y).toBeLessThanOrEqual(GAME_HEIGHT);
    }
  });

  it('exitPosition and playerStart are numeric coordinates', () => {
    expect(typeof cfg.exitPosition.x).toBe('number');
    expect(typeof cfg.exitPosition.y).toBe('number');
    expect(typeof cfg.playerStart.x).toBe('number');
    expect(typeof cfg.playerStart.y).toBe('number');
  });

  it('has at least one roomElevator', () => {
    expect(cfg.roomElevators.length).toBeGreaterThan(0);
  });
});
