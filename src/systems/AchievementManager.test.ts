import { beforeEach, describe, expect, it } from 'vitest';
import type { KVStorage } from './SaveManager';
import * as AchievementManager from './AchievementManager';

function memoryStorage(): KVStorage {
  const store = new Map<string, string>();
  return {
    getItem: (k) => (store.has(k) ? store.get(k)! : null),
    setItem: (k, v) => { store.set(k, v); },
    removeItem: (k) => { store.delete(k); },
  };
}

describe('AchievementManager', () => {
  beforeEach(() => {
    AchievementManager.setStorage(memoryStorage());
  });

  it('starts with no achievements unlocked', () => {
    expect(AchievementManager.getUnlocked()).toEqual([]);
    expect(AchievementManager.getUnlockedCount()).toBe(0);
  });

  it('unlock() returns true the first time and persists the id', () => {
    const result = AchievementManager.unlock('au-5');
    expect(result).toBe(true);
    expect(AchievementManager.isUnlocked('au-5')).toBe(true);
    expect(AchievementManager.getUnlocked()).toContain('au-5');
  });

  it('unlock() returns false if already unlocked (idempotent)', () => {
    AchievementManager.unlock('au-5');
    const second = AchievementManager.unlock('au-5');
    expect(second).toBe(false);
    expect(AchievementManager.getUnlockedCount()).toBe(1);
  });

  it('isUnlocked returns false for unknown/locked ids', () => {
    expect(AchievementManager.isUnlocked('au-15')).toBe(false);
  });

  it('resetAll() clears all unlocks', () => {
    AchievementManager.unlock('au-5');
    AchievementManager.unlock('info-1');
    AchievementManager.resetAll();

    expect(AchievementManager.getUnlocked()).toEqual([]);
    expect(AchievementManager.isUnlocked('au-5')).toBe(false);
  });

  it('getUnlockedCount() returns the correct count', () => {
    AchievementManager.unlock('au-5');
    AchievementManager.unlock('au-15');
    AchievementManager.unlock('au-30');
    expect(AchievementManager.getUnlockedCount()).toBe(3);
  });

  it('persists across setStorage calls (reads back from storage)', () => {
    const storage = memoryStorage();
    AchievementManager.setStorage(storage);
    AchievementManager.unlock('quiz-1');

    // Re-attach the same storage (simulates a new session reading from the same store).
    AchievementManager.setStorage(storage);
    expect(AchievementManager.isUnlocked('quiz-1')).toBe(true);
  });
});
