import { describe, it, expect, vi, beforeAll } from 'vitest';
import { assertValidLevelConfig } from '../_shared/validateLevelConfig';
import type { LevelConfig } from '../_shared/LevelScene';
import { INFO_POINTS, preloadInfoFor } from '../../../config/info';
import { GAME_WIDTH, GAME_HEIGHT, TILE_SIZE, FLOORS } from '../../../config/gameConfig';

vi.mock('phaser', () => {
  class Scene {
    constructor(_config: unknown) {}
  }
  return { default: { Scene }, Scene };
});

vi.mock('../_shared/LevelScene', () => ({
  LevelScene: class LevelScene {
    protected floorId: unknown;
    public add = {
      image: vi.fn(() => ({ setDepth: vi.fn() })),
    };
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
    protected addAmbientPlants(_plants: unknown): void {}
    protected addSignpost(_config: unknown): void {}
  },
}));

import { ProductLeadershipScene } from './ProductLeadershipScene';

class TestableProductLeadershipScene extends ProductLeadershipScene {
  public getConfig(): LevelConfig {
    return this.getLevelConfig();
  }

  public runCreateDecorations(): void {
    this.createDecorations();
  }
}

describe('ProductLeadershipScene — LevelConfig', () => {
  let cfg: LevelConfig;

  beforeAll(async () => {
    await preloadInfoFor(FLOORS.BUSINESS);
    cfg = new TestableProductLeadershipScene().getConfig();
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

  it('token indices are disjoint from CustomerSuccessScene (start at offset 5)', () => {
    // ProductLeadershipScene.TOKEN_INDEX_OFFSET = 5, CustomerSuccessScene = 10.
    // Every token must carry an explicit index so implicit 0..n indexing
    // cannot silently collide with CustomerSuccessScene's 10..14 range.
    for (const token of cfg.tokens) {
      expect(token.index).toBeDefined();
      expect(token.index).toBeGreaterThanOrEqual(5);
      expect(token.index).toBeLessThan(10);
    }
  });

  it('exitPosition and playerStart are numeric coordinates', () => {
    expect(typeof cfg.exitPosition.x).toBe('number');
    expect(typeof cfg.exitPosition.y).toBe('number');
    expect(typeof cfg.playerStart.x).toBe('number');
    expect(typeof cfg.playerStart.y).toBe('number');
  });

  it('creates the expected product leadership decorations', () => {
    const scene = new TestableProductLeadershipScene() as TestableProductLeadershipScene & {
      addAmbientPlants: (...args: unknown[]) => void;
      addSignpost: (...args: unknown[]) => void;
      add: { image: (...args: unknown[]) => { setDepth: (...depthArgs: unknown[]) => void } };
    };
    const addAmbientPlants = vi.fn();
    const addSignpost = vi.fn();
    const addImage = vi.fn(() => ({ setDepth: vi.fn() }));
    scene.addAmbientPlants = addAmbientPlants as unknown as typeof scene.addAmbientPlants;
    scene.addSignpost = addSignpost as unknown as typeof scene.addSignpost;
    scene.add.image = addImage as unknown as typeof scene.add.image;

    scene.runCreateDecorations();

    expect(addAmbientPlants).toHaveBeenCalledWith([
      { x: 90, kind: 'tall' },
      { x: 160, kind: 'small' },
    ]);
    expect(addSignpost).toHaveBeenCalledWith(expect.objectContaining({
      x: 230,
      label: '  PRODUCT\nLEADERSHIP',
      color: '#ffd6f0',
      fontSize: 12,
    }));
    expect(addImage).toHaveBeenCalledTimes(4);
    expect(addImage).toHaveBeenNthCalledWith(1, 560, GAME_HEIGHT - TILE_SIZE - 36, 'desk_monitor');
    expect(addImage).toHaveBeenNthCalledWith(2, 720, GAME_HEIGHT - TILE_SIZE - 22, 'monitor_dash');
    expect(addImage).toHaveBeenNthCalledWith(3, 900, GAME_HEIGHT - TILE_SIZE - 36, 'desk_monitor');
    expect(addImage).toHaveBeenNthCalledWith(4, 1080, GAME_HEIGHT - TILE_SIZE - 22, 'monitor_dash');
  });
});
