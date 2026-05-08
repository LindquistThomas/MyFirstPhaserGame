import { beforeEach, describe, expect, it } from 'vitest';
import type { KVStorage } from './SaveManager';
import * as DailyChallengeStore from './DailyChallengeStore';

function memoryStorage(): KVStorage {
  const store = new Map<string, string>();
  return {
    getItem: (k) => (store.has(k) ? store.get(k)! : null),
    setItem: (k, v) => { store.set(k, v); },
    removeItem: (k) => { store.delete(k); },
  };
}

describe('DailyChallengeStore', () => {
  beforeEach(() => {
    DailyChallengeStore.setStorage(memoryStorage());
  });

  it('records best (lowest) run time per day', () => {
    DailyChallengeStore.recordResult('20260508', 120_000);
    DailyChallengeStore.recordResult('20260508', 130_000);
    DailyChallengeStore.recordResult('20260508', 110_000);
    expect(DailyChallengeStore.getResult('20260508')?.runMs).toBe(110_000);
  });

  it('computes consecutive completion streak ending at date', () => {
    DailyChallengeStore.recordResult('20260506', 90_000);
    DailyChallengeStore.recordResult('20260507', 95_000);
    DailyChallengeStore.recordResult('20260508', 100_000);
    expect(DailyChallengeStore.getCompletionStreakEndingAt('20260508')).toBe(3);
  });
});
