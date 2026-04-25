import { describe, it, expect, beforeEach } from 'vitest';
import { setStorage } from './AchievementManager';
import * as AchievementManager from './AchievementManager';
import { FLOORS } from '../config/gameConfig';
import { type KVStorage } from './SaveManager';
import { eventBus } from './EventBus';
import type { AchievementCheckState } from '../config/achievements';

function memoryStorage(): KVStorage {
  const store = new Map<string, string>();
  return {
    getItem: (key) => store.get(key) ?? null,
    setItem: (key, value) => { store.set(key, value); },
    removeItem: (key) => { store.delete(key); },
  };
}

function baseState(): AchievementCheckState {
  return {
    totalAU: 0,
    visitedFloors: new Set([FLOORS.LOBBY]),
    collectedTokens: {
      [FLOORS.LOBBY]: new Set(),
      [FLOORS.PLATFORM_TEAM]: new Set(),
      [FLOORS.BUSINESS]: new Set(),
      [FLOORS.EXECUTIVE]: new Set(),
      [FLOORS.PRODUCTS]: new Set(),
    },
    passedQuizIds: [],
    seenInfoIds: [],
  };
}

describe('AchievementManager', () => {
  beforeEach(() => {
    setStorage(memoryStorage());
    AchievementManager.resetAll();
  });

  it('starts with no unlocked achievements', () => {
    expect(AchievementManager.getUnlockedIds()).toHaveLength(0);
  });

  it('unlocks "first-au" when totalAU >= 1', () => {
    const state = { ...baseState(), totalAU: 1 };
    AchievementManager.checkAll(state);
    expect(AchievementManager.isUnlocked('first-au')).toBe(true);
  });

  it('does not unlock "first-au" when totalAU is 0', () => {
    AchievementManager.checkAll(baseState());
    expect(AchievementManager.isUnlocked('first-au')).toBe(false);
  });

  it('unlocks AU milestone achievements at the right thresholds', () => {
    AchievementManager.checkAll({ ...baseState(), totalAU: 10 });
    expect(AchievementManager.isUnlocked('au-10')).toBe(true);
    expect(AchievementManager.isUnlocked('au-25')).toBe(false);

    AchievementManager.resetAll();
    AchievementManager.checkAll({ ...baseState(), totalAU: 25 });
    expect(AchievementManager.isUnlocked('au-10')).toBe(true);
    expect(AchievementManager.isUnlocked('au-25')).toBe(true);
  });

  it('unlocks "floor-all" only when all required floors visited', () => {
    const partial = {
      ...baseState(),
      visitedFloors: new Set([FLOORS.LOBBY, FLOORS.PLATFORM_TEAM]),
    };
    AchievementManager.checkAll(partial);
    expect(AchievementManager.isUnlocked('floor-all')).toBe(false);

    AchievementManager.resetAll();
    const all = {
      ...baseState(),
      visitedFloors: new Set([FLOORS.LOBBY, FLOORS.PLATFORM_TEAM, FLOORS.BUSINESS, FLOORS.EXECUTIVE]),
    };
    AchievementManager.checkAll(all);
    expect(AchievementManager.isUnlocked('floor-all')).toBe(true);
  });

  it('unlocks info achievements at the correct thresholds', () => {
    AchievementManager.checkAll({ ...baseState(), seenInfoIds: ['a'] });
    expect(AchievementManager.isUnlocked('info-first')).toBe(true);
    expect(AchievementManager.isUnlocked('info-5')).toBe(false);

    AchievementManager.resetAll();
    AchievementManager.checkAll({ ...baseState(), seenInfoIds: ['a', 'b', 'c', 'd', 'e'] });
    expect(AchievementManager.isUnlocked('info-5')).toBe(true);
  });

  it('unlocks quiz achievements', () => {
    AchievementManager.checkAll({ ...baseState(), passedQuizIds: ['q1'] });
    expect(AchievementManager.isUnlocked('quiz-first')).toBe(true);
    expect(AchievementManager.isUnlocked('quiz-3')).toBe(false);

    AchievementManager.resetAll();
    AchievementManager.checkAll({ ...baseState(), passedQuizIds: ['q1', 'q2', 'q3'] });
    expect(AchievementManager.isUnlocked('quiz-3')).toBe(true);
  });

  it('emits achievement:unlocked event for each new unlock', () => {
    const received: string[] = [];
    const handler = (id: string): void => { received.push(id); };
    eventBus.on('achievement:unlocked', handler);

    AchievementManager.checkAll({ ...baseState(), totalAU: 5 });
    expect(received).toContain('first-au');

    eventBus.off('achievement:unlocked', handler);
  });

  it('does not emit achievement:unlocked for already-unlocked achievements', () => {
    AchievementManager.checkAll({ ...baseState(), totalAU: 1 });

    const received: string[] = [];
    const handler = (id: string): void => { received.push(id); };
    eventBus.on('achievement:unlocked', handler);

    // second call — already unlocked
    AchievementManager.checkAll({ ...baseState(), totalAU: 1 });
    expect(received).toHaveLength(0);

    eventBus.off('achievement:unlocked', handler);
  });

  it('getAllDefs returns all achievement definitions', () => {
    const defs = AchievementManager.getAllDefs();
    expect(defs.length).toBeGreaterThan(5);
    const ids = defs.map((d) => d.id);
    expect(ids).toContain('first-au');
    expect(ids).toContain('floor-all');
    expect(ids).toContain('info-first');
    expect(ids).toContain('quiz-first');
  });

  it('resetAll clears all unlocked achievements', () => {
    AchievementManager.checkAll({ ...baseState(), totalAU: 10 });
    expect(AchievementManager.getUnlockedIds().length).toBeGreaterThan(0);
    AchievementManager.resetAll();
    expect(AchievementManager.getUnlockedIds()).toHaveLength(0);
  });

  it('persists and reloads across instances (same storage)', () => {
    const storage = memoryStorage();
    setStorage(storage);
    AchievementManager.checkAll({ ...baseState(), totalAU: 1 });
    expect(AchievementManager.isUnlocked('first-au')).toBe(true);

    // Reload into a fresh store instance pointing at the same storage
    setStorage(storage);
    expect(AchievementManager.isUnlocked('first-au')).toBe(true);
  });
});
