import { describe, it, expect, beforeEach } from 'vitest';
import { ProgressionSystem } from './ProgressionSystem';
import { setStorage, setPlayerSlot, KVStorage } from './SaveManager';
import { FLOORS } from '../config/gameConfig';

function memoryStorage(): KVStorage {
  const store = new Map<string, string>();
  return {
    getItem: (k) => (store.has(k) ? store.get(k)! : null),
    setItem: (k, v) => { store.set(k, v); },
    removeItem: (k) => { store.delete(k); },
  };
}

describe('ProgressionSystem', () => {
  beforeEach(() => {
    setStorage(memoryStorage());
    setPlayerSlot('progression-test');
  });

  it('starts with LOBBY + PLATFORM_TEAM unlocked and 0 total AU', () => {
    const p = new ProgressionSystem();
    expect(p.getTotalAU()).toBe(0);
    expect(p.isFloorUnlocked(FLOORS.LOBBY)).toBe(true);
    expect(p.isFloorUnlocked(FLOORS.PLATFORM_TEAM)).toBe(true);
    expect(p.isFloorUnlocked(FLOORS.BUSINESS)).toBe(false);
  });

  it('accumulates AU per floor and in total', () => {
    const p = new ProgressionSystem();
    p.addAU(FLOORS.PLATFORM_TEAM, 3);
    p.addAU(FLOORS.PLATFORM_TEAM, 1);
    expect(p.getFloorAU(FLOORS.PLATFORM_TEAM)).toBe(4);
    expect(p.getTotalAU()).toBe(4);
  });

  it('dedupes collectAU when tokenIndex is provided', () => {
    const p = new ProgressionSystem();
    p.collectAU(FLOORS.PLATFORM_TEAM, 0);
    p.collectAU(FLOORS.PLATFORM_TEAM, 0); // duplicate — ignored
    p.collectAU(FLOORS.PLATFORM_TEAM, 1);
    expect(p.getTotalAU()).toBe(2);
    expect(p.isTokenCollected(FLOORS.PLATFORM_TEAM, 0)).toBe(true);
    expect(p.isTokenCollected(FLOORS.PLATFORM_TEAM, 2)).toBe(false);
  });

  it('unlocks BUSINESS when totalAU meets its threshold', () => {
    const p = new ProgressionSystem();
    expect(p.isFloorUnlocked(FLOORS.BUSINESS)).toBe(false);
    p.addAU(FLOORS.PLATFORM_TEAM, 10);
    expect(p.isFloorUnlocked(FLOORS.BUSINESS)).toBe(true);
  });

  it('reports remaining AU needed for a locked floor', () => {
    const p = new ProgressionSystem();
    expect(p.getAUNeededForFloor(FLOORS.BUSINESS)).toBe(10);
    p.addAU(FLOORS.PLATFORM_TEAM, 2);
    expect(p.getAUNeededForFloor(FLOORS.BUSINESS)).toBe(8);
    p.addAU(FLOORS.PLATFORM_TEAM, 15);
    expect(p.getAUNeededForFloor(FLOORS.BUSINESS)).toBe(0);
  });

  it('persists and reloads state via SaveManager', () => {
    const p = new ProgressionSystem();
    p.collectAU(FLOORS.PLATFORM_TEAM, 0);
    p.collectAU(FLOORS.PLATFORM_TEAM, 1);
    p.setCurrentFloor(FLOORS.PLATFORM_TEAM);

    const q = new ProgressionSystem();
    expect(q.loadFromSave()).toBe(true);
    expect(q.getTotalAU()).toBe(2);
    expect(q.isTokenCollected(FLOORS.PLATFORM_TEAM, 0)).toBe(true);
    expect(q.isTokenCollected(FLOORS.PLATFORM_TEAM, 1)).toBe(true);
    expect(q.getCurrentFloor()).toBe(FLOORS.PLATFORM_TEAM);
  });

  it('reset() clears all state and the persisted save', () => {
    const p = new ProgressionSystem();
    p.addAU(FLOORS.PLATFORM_TEAM, 10);
    p.reset();
    expect(p.getTotalAU()).toBe(0);
    expect(p.isFloorUnlocked(FLOORS.BUSINESS)).toBe(false);

    const q = new ProgressionSystem();
    expect(q.loadFromSave()).toBe(false);
  });

  describe('loseAU', () => {
    it('returns 0 and is a no-op when the player has no AU on the floor', () => {
      const p = new ProgressionSystem();
      expect(p.loseAU(FLOORS.PLATFORM_TEAM, 3)).toBe(0);
      expect(p.getTotalAU()).toBe(0);
      expect(p.getFloorAU(FLOORS.PLATFORM_TEAM)).toBe(0);
    });

    it('clamps at 0 — cannot go negative', () => {
      const p = new ProgressionSystem();
      p.addAU(FLOORS.PLATFORM_TEAM, 2);
      const lost = p.loseAU(FLOORS.PLATFORM_TEAM, 5);
      expect(lost).toBe(2);
      expect(p.getTotalAU()).toBe(0);
      expect(p.getFloorAU(FLOORS.PLATFORM_TEAM)).toBe(0);
    });

    it('decrements both per-floor and total by the removed amount', () => {
      const p = new ProgressionSystem();
      p.addAU(FLOORS.PLATFORM_TEAM, 5);
      const lost = p.loseAU(FLOORS.PLATFORM_TEAM, 2);
      expect(lost).toBe(2);
      expect(p.getTotalAU()).toBe(3);
      expect(p.getFloorAU(FLOORS.PLATFORM_TEAM)).toBe(3);
    });

    it('does not un-unlock floors already unlocked', () => {
      const p = new ProgressionSystem();
      p.addAU(FLOORS.PLATFORM_TEAM, 12);
      expect(p.isFloorUnlocked(FLOORS.BUSINESS)).toBe(true);
      p.loseAU(FLOORS.PLATFORM_TEAM, 10);
      expect(p.isFloorUnlocked(FLOORS.BUSINESS)).toBe(true);
    });

    it('does not touch collectedTokens (drops are transient)', () => {
      const p = new ProgressionSystem();
      p.collectAU(FLOORS.PLATFORM_TEAM, 0);
      p.collectAU(FLOORS.PLATFORM_TEAM, 1);
      p.loseAU(FLOORS.PLATFORM_TEAM, 2);
      expect(p.isTokenCollected(FLOORS.PLATFORM_TEAM, 0)).toBe(true);
      expect(p.isTokenCollected(FLOORS.PLATFORM_TEAM, 1)).toBe(true);
    });

    it('ignores non-positive amounts', () => {
      const p = new ProgressionSystem();
      p.addAU(FLOORS.PLATFORM_TEAM, 3);
      expect(p.loseAU(FLOORS.PLATFORM_TEAM, 0)).toBe(0);
      expect(p.loseAU(FLOORS.PLATFORM_TEAM, -5)).toBe(0);
      expect(p.getTotalAU()).toBe(3);
    });
  });
});
