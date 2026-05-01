import { describe, it, expect, vi, beforeAll } from 'vitest';
import { assertValidLevelConfig, VALID_ENEMY_TYPES } from '../_shared/validateLevelConfig';
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

import { ArchitectureTeamScene } from './ArchitectureTeamScene';

class TestableArchitectureTeamScene extends ArchitectureTeamScene {
  public getConfig(): LevelConfig {
    return this.getLevelConfig();
  }
}

describe('ArchitectureTeamScene — LevelConfig', () => {
  let cfg: LevelConfig;

  beforeAll(async () => {
    await preloadInfoFor(FLOORS.PLATFORM_TEAM);
    cfg = new TestableArchitectureTeamScene().getConfig();
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

  it('has at least one enemy', () => {
    expect((cfg.enemies ?? []).length).toBeGreaterThan(0);
  });

  it('every enemy type is in the valid-type union', () => {
    for (const enemy of cfg.enemies ?? []) {
      expect(VALID_ENEMY_TYPES).toContain(enemy.type);
    }
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

  it('token indices are disjoint from PlatformTeamScene (start at offset 7)', () => {
    // ArchitectureTeamScene uses TOKEN_INDEX_OFFSET = 7.
    // Every token must carry an explicit index so implicit 0..n indexing
    // cannot silently collide with PlatformTeamScene's 0..6 range.
    for (const token of cfg.tokens) {
      expect(token.index).toBeDefined();
      expect(token.index).toBeGreaterThanOrEqual(7);
    }
  });
});
