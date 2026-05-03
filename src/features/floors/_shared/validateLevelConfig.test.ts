import { describe, it, expect } from 'vitest';
import { assertValidLevelConfig, VALID_ENEMY_TYPES } from './validateLevelConfig';
import type { LevelConfig } from './LevelScene';
import { preloadInfoFor } from '../../../config/info';
import { FLOORS } from '../../../config/gameConfig';

/** Minimal valid config used as baseline for mutation tests. */
function makeValidConfig(): LevelConfig {
  return {
    floorId: FLOORS.PLATFORM_TEAM,
    platforms: [{ x: 0, y: 100, width: 200 }],
    tokens: [{ x: 100, y: 100 }],
    roomElevators: [],
    exitPosition: { x: 640, y: 50 },
    playerStart: { x: 200, y: 800 },
  };
}

describe('assertValidLevelConfig — invalid configs', () => {
  it('throws when platforms is missing', () => {
    const cfg = makeValidConfig();
    delete (cfg as any).platforms;
    expect(() => assertValidLevelConfig(cfg)).toThrow('platforms must be an array');
  });

  it('throws when tokens is missing', () => {
    const cfg = makeValidConfig();
    delete (cfg as any).tokens;
    expect(() => assertValidLevelConfig(cfg)).toThrow('tokens must be an array');
  });

  it('throws when roomElevators is missing', () => {
    const cfg = makeValidConfig();
    delete (cfg as any).roomElevators;
    expect(() => assertValidLevelConfig(cfg)).toThrow('roomElevators must be an array');
  });

  it('throws when exitPosition has NaN x', () => {
    const cfg = makeValidConfig();
    cfg.exitPosition = { x: NaN, y: 50 };
    expect(() => assertValidLevelConfig(cfg)).toThrow('exitPosition must have finite numeric x and y');
  });

  it('throws when exitPosition is missing', () => {
    const cfg = makeValidConfig();
    delete (cfg as any).exitPosition;
    expect(() => assertValidLevelConfig(cfg)).toThrow('exitPosition must have finite numeric x and y');
  });

  it('throws when playerStart has NaN y', () => {
    const cfg = makeValidConfig();
    cfg.playerStart = { x: 200, y: NaN };
    expect(() => assertValidLevelConfig(cfg)).toThrow('playerStart must have finite numeric x and y');
  });

  it('throws when playerStart is missing', () => {
    const cfg = makeValidConfig();
    delete (cfg as any).playerStart;
    expect(() => assertValidLevelConfig(cfg)).toThrow('playerStart must have finite numeric x and y');
  });

  it('throws on an unrecognised enemy type', () => {
    const cfg = makeValidConfig();
    cfg.enemies = [{ type: 'dragon' as any, x: 100, y: 800 }];
    expect(() => assertValidLevelConfig(cfg)).toThrow('Unknown enemy type "dragon"');
  });

  it('throws when an infoPoint contentId is not in INFO_POINTS', () => {
    const cfg = makeValidConfig();
    cfg.infoPoints = [{ contentId: '__no_such_id__', x: 100, y: 100 }];
    expect(() => assertValidLevelConfig(cfg)).toThrow('"__no_such_id__" is not registered in INFO_POINTS');
  });

  it('throws when a token x is out of world bounds', () => {
    const cfg = makeValidConfig();
    cfg.tokens = [{ x: 99999, y: 100 }];
    expect(() => assertValidLevelConfig(cfg)).toThrow('outside world bounds');
  });

  it('throws when a token y is out of world bounds', () => {
    const cfg = makeValidConfig();
    cfg.tokens = [{ x: 100, y: 99999 }];
    expect(() => assertValidLevelConfig(cfg)).toThrow('outside world bounds');
  });

  it('throws when a token x is negative', () => {
    const cfg = makeValidConfig();
    cfg.tokens = [{ x: -1, y: 100 }];
    expect(() => assertValidLevelConfig(cfg)).toThrow('outside world bounds');
  });
});

describe('assertValidLevelConfig — happy path', () => {
  it('does not throw for a minimal valid config', () => {
    expect(() => assertValidLevelConfig(makeValidConfig())).not.toThrow();
  });

  it('does not throw when enemies array is absent', () => {
    const cfg = makeValidConfig();
    delete cfg.enemies;
    expect(() => assertValidLevelConfig(cfg)).not.toThrow();
  });

  it('does not throw when enemies array is empty', () => {
    const cfg = makeValidConfig();
    cfg.enemies = [];
    expect(() => assertValidLevelConfig(cfg)).not.toThrow();
  });

  it('does not throw when infoPoints array is absent', () => {
    const cfg = makeValidConfig();
    delete cfg.infoPoints;
    expect(() => assertValidLevelConfig(cfg)).not.toThrow();
  });

  it('accepts every known enemy type', () => {
    for (const type of VALID_ENEMY_TYPES) {
      const cfg = makeValidConfig();
      cfg.enemies = [{ type, x: 100, y: 800 }];
      expect(() => assertValidLevelConfig(cfg)).not.toThrow();
    }
  });

  it('accepts a registered infoPoint contentId after preloading', async () => {
    await preloadInfoFor(FLOORS.PLATFORM_TEAM);
    const cfg = makeValidConfig();
    cfg.infoPoints = [{ contentId: 'platform-engineering', x: 100, y: 100 }];
    expect(() => assertValidLevelConfig(cfg)).not.toThrow();
  });
});

describe('VALID_ENEMY_TYPES', () => {
  it('contains the expected enemy types', () => {
    expect(VALID_ENEMY_TYPES).toContain('slime');
    expect(VALID_ENEMY_TYPES).toContain('bot');
    expect(VALID_ENEMY_TYPES).toContain('scope-creep');
    expect(VALID_ENEMY_TYPES).toContain('astronaut');
    expect(VALID_ENEMY_TYPES).toContain('tech-debt-ghost');
    expect(VALID_ENEMY_TYPES).toContain('terrorist');
  });
});
