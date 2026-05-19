import { describe, it, expect, vi, beforeAll } from 'vitest';
import { assertValidLevelConfig } from '../_shared/validateLevelConfig';
import type { LevelConfig } from '../_shared/LevelScene';
import { INFO_POINTS, preloadInfoFor } from '../../../config/info';
import { GAME_WIDTH, GAME_HEIGHT, FLOORS } from '../../../config/gameConfig';

vi.mock('phaser', () => {
  class Scene {
    constructor(_config: unknown) {}
  }
  return { default: { Scene }, Scene };
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

import { CustomerSuccessScene } from './CustomerSuccessScene';

class TestableCustomerSuccessScene extends CustomerSuccessScene {
  public getConfig(): LevelConfig {
    return this.getLevelConfig();
  }

  public runCreateDecorations(): void {
    this.createDecorations();
  }
}

describe('CustomerSuccessScene — LevelConfig', () => {
  let cfg: LevelConfig;

  beforeAll(async () => {
    await preloadInfoFor(FLOORS.BUSINESS);
    cfg = new TestableCustomerSuccessScene().getConfig();
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

  it('token indices are disjoint from ProductLeadershipScene (start at offset 10)', () => {
    // CustomerSuccessScene.TOKEN_INDEX_OFFSET = 10.
    // Every token must carry an explicit index so implicit 0..n indexing
    // cannot silently collide with ProductLeadershipScene's 5..9 range.
    for (const token of cfg.tokens) {
      expect(token.index).toBeDefined();
      expect(token.index).toBeGreaterThanOrEqual(10);
    }
  });

  it('exitPosition and playerStart are numeric coordinates', () => {
    expect(typeof cfg.exitPosition.x).toBe('number');
    expect(typeof cfg.exitPosition.y).toBe('number');
    expect(typeof cfg.playerStart.x).toBe('number');
    expect(typeof cfg.playerStart.y).toBe('number');
  });

  it('createDecorations adds expected flora, signpost, and monitors', () => {
    const scene = new TestableCustomerSuccessScene() as unknown as {
      addAmbientPlants: ReturnType<typeof vi.fn>;
      addSignpost: ReturnType<typeof vi.fn>;
      add: { image: ReturnType<typeof vi.fn> };
      runCreateDecorations: () => void;
    };
    const image = vi.fn(() => ({ setDepth: vi.fn() }));
    scene.addAmbientPlants = vi.fn();
    scene.addSignpost = vi.fn();
    scene.add = { image };

    scene.runCreateDecorations();

    expect(scene.addAmbientPlants).toHaveBeenCalledWith([
      { x: 1180, kind: 'tall' },
      { x: 1120, kind: 'small' },
    ]);
    expect(scene.addSignpost).toHaveBeenCalled();
    expect(image).toHaveBeenCalledTimes(4);
  });
});
