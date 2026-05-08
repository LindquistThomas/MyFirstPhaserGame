import { describe, expect, it } from 'vitest';
import { FLOORS } from '../../../config/gameConfig';
import type { LevelConfig } from './LevelScene';
import { applyDailyChallengeLayout } from './dailyChallengeLayout';

const BASE_CONFIG: LevelConfig = {
  floorId: FLOORS.PLATFORM_TEAM,
  platforms: [{ x: 0, y: 656, width: 10 }],
  tokens: [
    { x: 120, y: 500, index: 0 },
    { x: 320, y: 500, index: 1 },
    { x: 520, y: 500, index: 2 },
  ],
  roomElevators: [],
  playerStart: { x: 80, y: 560 },
  exitPosition: { x: 80, y: 560 },
  enemies: [
    { type: 'slime', x: 260, y: 590 },
    { type: 'bot', x: 420, y: 590, minX: 300, maxX: 560 },
  ],
  coffees: [{ x: 140, y: 600 }],
  fridges: [{ x: 620, y: 600 }],
};

describe('applyDailyChallengeLayout', () => {
  it('is deterministic for the same seed', () => {
    const a = applyDailyChallengeLayout(BASE_CONFIG, 20260508);
    const b = applyDailyChallengeLayout(BASE_CONFIG, 20260508);
    expect(a).toEqual(b);
  });

  it('keeps AU availability unchanged by preserving token count', () => {
    const changed = applyDailyChallengeLayout(BASE_CONFIG, 20260508);
    expect(changed.tokens).toHaveLength(BASE_CONFIG.tokens.length);
    expect(changed.tokens.map((t) => t.index).sort()).toEqual([0, 1, 2]);
  });

  it('jittered enemy patrol bands stay clamped to floor extent', () => {
    const changed = applyDailyChallengeLayout(BASE_CONFIG, 20260508);
    for (const enemy of changed.enemies ?? []) {
      expect(enemy.minX).toBeGreaterThanOrEqual(0);
      expect(enemy.maxX).toBeLessThanOrEqual(1280);
      expect((enemy.maxX ?? 0) - (enemy.minX ?? 0)).toBeGreaterThanOrEqual(80);
    }
  });
});

