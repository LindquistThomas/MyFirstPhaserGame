import { describe, it, expect, vi, beforeAll } from 'vitest';
import { assertValidLevelConfig } from '../_shared/validateLevelConfig';
import type { LevelConfig } from '../_shared/LevelScene';
import { INFO_POINTS, preloadInfoFor } from '../../../config/info';
import { FLOORS } from '../../../config/gameConfig';

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

// FinanceTeamScene imports allKeyLabels from the input module, which
// transitively imports Phaser plugins. Stub the whole barrel to avoid that
// heavy dependency chain in a config-only test.
vi.mock('../../../input', () => ({
  allKeyLabels: vi.fn(() => 'Enter'),
}));

import { FinanceTeamScene } from './FinanceTeamScene';

class TestableFinanceTeamScene extends FinanceTeamScene {
  public getConfig(): LevelConfig {
    return this.getLevelConfig();
  }
}

describe('FinanceTeamScene — LevelConfig', () => {
  let cfg: LevelConfig;

  beforeAll(async () => {
    await preloadInfoFor(FLOORS.BUSINESS);
    cfg = new TestableFinanceTeamScene().getConfig();
  });

  it('passes the shared assertValidLevelConfig validator', () => {
    expect(() => assertValidLevelConfig(cfg)).not.toThrow();
  });

  it('has at least one platform', () => {
    expect(cfg.platforms.length).toBeGreaterThan(0);
  });

  it('has at least one infoPoint', () => {
    expect((cfg.infoPoints ?? []).length).toBeGreaterThan(0);
  });

  it('every infoPoint contentId resolves in INFO_POINTS', () => {
    for (const point of cfg.infoPoints ?? []) {
      expect(INFO_POINTS).toHaveProperty(point.contentId);
    }
  });

  it('has no enemies (narrative-only room)', () => {
    expect((cfg.enemies ?? []).length).toBe(0);
  });

  it('has no tokens (narrative-only room)', () => {
    expect(cfg.tokens.length).toBe(0);
  });

  it('exitPosition and playerStart are numeric coordinates', () => {
    expect(typeof cfg.exitPosition.x).toBe('number');
    expect(typeof cfg.exitPosition.y).toBe('number');
    expect(typeof cfg.playerStart.x).toBe('number');
    expect(typeof cfg.playerStart.y).toBe('number');
  });
});
