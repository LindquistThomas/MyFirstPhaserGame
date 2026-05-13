import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { ProgressionSystem } from './ProgressionSystem';
import { setStorage, setPlayerSlot, KVStorage, CURRENT_SAVE_VERSION } from './SaveManager';
import { FLOORS, FLOOR_IDS } from '../config/gameConfig';
import type { SaveAdapter } from './ProgressionSystem';
import { eventBus } from './EventBus';

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

  it('starts with only free floors unlocked (auRequired === 0) and 0 total AU', () => {
    const p = new ProgressionSystem();
    expect(p.getTotalAU()).toBe(0);
    // LOBBY and PLATFORM_TEAM both have auRequired=0 → unlocked from the start.
    expect(p.isFloorUnlocked(FLOORS.LOBBY)).toBe(true);
    expect(p.isFloorUnlocked(FLOORS.PLATFORM_TEAM)).toBe(true);
    // AU-gated floors start locked.
    expect(p.isFloorUnlocked(FLOORS.BUSINESS)).toBe(false);
    expect(p.isFloorUnlocked(FLOORS.EXECUTIVE)).toBe(false);
    expect(p.isFloorUnlocked(FLOORS.PRODUCTS)).toBe(false);
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

  it('unlocks BUSINESS when totalAU reaches its threshold', () => {
    const p = new ProgressionSystem();
    expect(p.isFloorUnlocked(FLOORS.BUSINESS)).toBe(false);
    p.addAU(FLOORS.PLATFORM_TEAM, 8);
    expect(p.isFloorUnlocked(FLOORS.BUSINESS)).toBe(true);
  });

  it('reports remaining AU needed for a locked floor', () => {
    const p = new ProgressionSystem();
    expect(p.getAUNeededForFloor(FLOORS.BUSINESS)).toBe(8);
    p.addAU(FLOORS.PLATFORM_TEAM, 2);
    expect(p.getAUNeededForFloor(FLOORS.BUSINESS)).toBe(6);
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

  it('locked floor remains locked after save-reload (no merge with defaults)', () => {
    // Player collects only 5 AU — not enough for BUSINESS (needs 8).
    const p = new ProgressionSystem();
    p.addAU(FLOORS.PLATFORM_TEAM, 5);
    expect(p.isFloorUnlocked(FLOORS.BUSINESS)).toBe(false);

    // Reload — BUSINESS should still be locked.
    const q = new ProgressionSystem();
    expect(q.loadFromSave()).toBe(true);
    expect(q.getTotalAU()).toBe(5);
    expect(q.isFloorUnlocked(FLOORS.BUSINESS)).toBe(false);
  });

  it('emits progression:floor_unlocked when AU threshold is crossed', () => {
    const unlocked: number[] = [];
    const handler = (id: number) => unlocked.push(id);
    eventBus.on('progression:floor_unlocked', handler);
    try {
      const p = new ProgressionSystem();
      p.addAU(FLOORS.PLATFORM_TEAM, 10); // crosses BUSINESS threshold (8)
      expect(unlocked).toContain(FLOORS.BUSINESS);
    } finally {
      eventBus.off('progression:floor_unlocked', handler);
    }
  });

  it('unlocked floor persists across save-reload', () => {
    const p = new ProgressionSystem();
    p.addAU(FLOORS.PLATFORM_TEAM, 10);
    expect(p.isFloorUnlocked(FLOORS.BUSINESS)).toBe(true);

    const q = new ProgressionSystem();
    expect(q.loadFromSave()).toBe(true);
    expect(q.isFloorUnlocked(FLOORS.BUSINESS)).toBe(true);
  });

  it('backwards-compat: old saves with extra floor unlocks keep those unlocks on reload', () => {
    // Simulate a legacy save where all floors were persisted as unlocked (before
    // gating was enabled) even though totalAU doesn't reach every threshold.
    // Inject a hand-crafted save via a custom SaveAdapter.
    const legacySave = {
      version: 1,
      totalAU: 5, // only 5 AU — not enough for BUSINESS (8), EXECUTIVE (22), or PRODUCTS (8)
      floorAU: {
        [FLOORS.LOBBY]: 2,
        [FLOORS.PLATFORM_TEAM]: 3,
        [FLOORS.BUSINESS]: 0,
        [FLOORS.EXECUTIVE]: 0,
        [FLOORS.PRODUCTS]: 0,
      },
      unlockedFloors: [
        FLOORS.LOBBY,
        FLOORS.PLATFORM_TEAM,
        FLOORS.BUSINESS,  // persisted unlocked in old save without meeting threshold
        FLOORS.EXECUTIVE, // persisted unlocked in old save without meeting threshold
        FLOORS.PRODUCTS,  // persisted unlocked in old save without meeting threshold
      ],
      currentFloor: FLOORS.LOBBY,
      collectedTokens: {},
      onboardingComplete: false,
    };

    const adapter = {
      load: () => legacySave,
      save: (_d: unknown) => {},
      clear: () => {},
    };
    const q = new ProgressionSystem(adapter as import('./ProgressionSystem').SaveAdapter);
    expect(q.loadFromSave()).toBe(true);
    // All five floors must survive — old unlocks are preserved verbatim.
    expect(q.isFloorUnlocked(FLOORS.BUSINESS)).toBe(true);
    expect(q.isFloorUnlocked(FLOORS.EXECUTIVE)).toBe(true);
    expect(q.isFloorUnlocked(FLOORS.PRODUCTS)).toBe(true);
    // AU total must also be correct.
    expect(q.getTotalAU()).toBe(5);
  });

  it('hasVisitedFloor returns false before visit and true after markFloorVisited', () => {
    const p = new ProgressionSystem();
    expect(p.hasVisitedFloor(FLOORS.LOBBY)).toBe(false);
    p.markFloorVisited(FLOORS.LOBBY);
    expect(p.hasVisitedFloor(FLOORS.LOBBY)).toBe(true);
    // Other floors remain unvisited.
    expect(p.hasVisitedFloor(FLOORS.PLATFORM_TEAM)).toBe(false);
  });

  it('persists activated checkpoints and restores latest checkpoint id on reload', () => {
    const p = new ProgressionSystem();
    p.activateCheckpoint(FLOORS.PLATFORM_TEAM, 'platform-cp-1');
    p.activateCheckpoint(FLOORS.PLATFORM_TEAM, 'platform-cp-2');

    const q = new ProgressionSystem();
    expect(q.loadFromSave()).toBe(true);
    expect(q.getActivatedCheckpointIds(FLOORS.PLATFORM_TEAM)).toEqual(['platform-cp-1', 'platform-cp-2']);
    expect(q.getLatestActivatedCheckpointId(FLOORS.PLATFORM_TEAM)).toBe('platform-cp-2');
  });

  it('re-activating an older checkpoint moves it to latest', () => {
    const p = new ProgressionSystem();
    p.activateCheckpoint(FLOORS.PLATFORM_TEAM, 'platform-cp-1');
    p.activateCheckpoint(FLOORS.PLATFORM_TEAM, 'platform-cp-2');
    p.activateCheckpoint(FLOORS.PLATFORM_TEAM, 'platform-cp-1');

    expect(p.getActivatedCheckpointIds(FLOORS.PLATFORM_TEAM)).toEqual(['platform-cp-2', 'platform-cp-1']);
    expect(p.getLatestActivatedCheckpointId(FLOORS.PLATFORM_TEAM)).toBe('platform-cp-1');
  });

  it('reset() clears all state and the persisted save', () => {
    const p = new ProgressionSystem();
    p.addAU(FLOORS.PLATFORM_TEAM, 10);
    p.reset();
    expect(p.getTotalAU()).toBe(0);
    // After reset BUSINESS should be locked again (threshold not met with 0 AU).
    expect(p.isFloorUnlocked(FLOORS.BUSINESS)).toBe(false);

    const q = new ProgressionSystem();
    expect(q.loadFromSave()).toBe(false);
  });

  it('recordBossDefeat returns first-defeat flag and persists total count', () => {
    const p = new ProgressionSystem();
    expect(p.getBossDefeatedCount()).toBe(0);
    expect(p.recordBossDefeat()).toBe(true);
    expect(p.getBossDefeatedCount()).toBe(1);
    expect(p.recordBossDefeat()).toBe(false);
    expect(p.getBossDefeatedCount()).toBe(2);

    const q = new ProgressionSystem();
    expect(q.loadFromSave()).toBe(true);
    expect(q.getBossDefeatedCount()).toBe(2);
  });

  it('startNewGame("ngplus") resets run state but preserves bossDefeatedCount', () => {
    const p = new ProgressionSystem();
    p.addAU(FLOORS.PLATFORM_TEAM, 10);
    p.recordBossDefeat();
    p.startNewGame('ngplus');

    expect(p.getMode()).toBe('ngplus');
    expect(p.getTotalAU()).toBe(0);
    expect(p.getCurrentFloor()).toBe(FLOORS.LOBBY);
    expect(p.getBossDefeatedCount()).toBe(1);
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

  describe('progression events', () => {
    afterEach(() => {
      eventBus.removeAllListeners();
    });

    it('emits progression:au_milestone at each explicit milestone value crossed', () => {
      const p = new ProgressionSystem();
      const milestones: number[] = [];
      eventBus.on('progression:au_milestone', (total) => milestones.push(total));
      p.addAU(FLOORS.PLATFORM_TEAM, 4);
      expect(milestones).toEqual([]);
      p.addAU(FLOORS.PLATFORM_TEAM, 1); // crosses 5
      expect(milestones).toEqual([5]);
      p.addAU(FLOORS.PLATFORM_TEAM, 10); // crosses 15
      expect(milestones).toEqual([5, 15]);
      p.addAU(FLOORS.PLATFORM_TEAM, 15); // crosses 30
      expect(milestones).toEqual([5, 15, 30]);
      p.addAU(FLOORS.PLATFORM_TEAM, 20); // crosses 50
      expect(milestones).toEqual([5, 15, 30, 50]);
    });

    it('emits every milestone when a single addAU call crosses multiple boundaries', () => {
      const p = new ProgressionSystem();
      const milestones: number[] = [];
      eventBus.on('progression:au_milestone', (total) => milestones.push(total));
      p.addAU(FLOORS.PLATFORM_TEAM, 50); // crosses 5, 15, 30, 50
      expect(milestones).toEqual([5, 15, 30, 50]);
    });

    it('does not emit progression:au_milestone when total stays below first milestone', () => {
      const p = new ProgressionSystem();
      const fn = vi.fn();
      eventBus.on('progression:au_milestone', fn);
      p.addAU(FLOORS.PLATFORM_TEAM, 4); // stays below 5 (first milestone)
      expect(fn).not.toHaveBeenCalled();
    });
  });
});

describe('ProgressionSystem — loadFromSave optional-field fallbacks', () => {
  function seededStorage(payload: Record<string, unknown>): KVStorage {
    const store = new Map<string, string>([
      ['architect_progression-test_v1', JSON.stringify(payload)],
    ]);
    return {
      getItem: (k) => store.get(k) ?? null,
      setItem: (k, v) => { store.set(k, v); },
      removeItem: (k) => { store.delete(k); },
    };
  }

  beforeEach(() => {
    setPlayerSlot('progression-test');
  });

  it('defaults visitedFloors to empty when absent in legacy save', () => {
    // Older saves written before visitedFloors was added must not blow up.
    setStorage(seededStorage({
      version: CURRENT_SAVE_VERSION,
      totalAU: 3,
      floorAU: { [FLOORS.LOBBY]: 3 },
      unlockedFloors: [FLOORS.LOBBY],
      currentFloor: FLOORS.LOBBY,
      collectedTokens: {},
      // visitedFloors deliberately absent
    }));

    const p = new ProgressionSystem();
    expect(p.loadFromSave()).toBe(true);
    expect(p.getVisitedFloorCount()).toBe(0);
  });

  it('defaults onboardingComplete to false when absent in legacy save', () => {
    // Saves predating the onboarding feature must not show the tutorial flag as true.
    setStorage(seededStorage({
      version: CURRENT_SAVE_VERSION,
      totalAU: 0,
      floorAU: {},
      unlockedFloors: [FLOORS.LOBBY],
      currentFloor: FLOORS.LOBBY,
      collectedTokens: {},
      // onboardingComplete deliberately absent
    }));

    const p = new ProgressionSystem();
    expect(p.loadFromSave()).toBe(true);
    expect(p.isOnboardingComplete()).toBe(false);
  });

  it('defaults activatedCheckpoints to empty when absent in legacy save', () => {
    setStorage(seededStorage({
      version: CURRENT_SAVE_VERSION,
      totalAU: 0,
      floorAU: {},
      unlockedFloors: [FLOORS.LOBBY],
      currentFloor: FLOORS.LOBBY,
      collectedTokens: {},
    }));

    const p = new ProgressionSystem();
    expect(p.loadFromSave()).toBe(true);
    expect(p.getActivatedCheckpointIds(FLOORS.LOBBY)).toEqual([]);
    expect(p.getLatestActivatedCheckpointId(FLOORS.LOBBY)).toBeNull();
  });
});

describe('ProgressionSystem — isFirstVisit / resetVisitedFloors', () => {
  beforeEach(() => {
    setStorage(memoryStorage());
    setPlayerSlot('progression-test');
  });

  it('isFirstVisit returns true for a floor that has never been visited', () => {
    const p = new ProgressionSystem();
    expect(p.isFirstVisit(FLOORS.LOBBY)).toBe(true);
  });

  it('isFirstVisit returns false after markFloorVisited is called', () => {
    const p = new ProgressionSystem();
    p.markFloorVisited(FLOORS.LOBBY);
    expect(p.isFirstVisit(FLOORS.LOBBY)).toBe(false);
  });

  it('isFirstVisit remains true for unvisited floors even when other floors are visited', () => {
    const p = new ProgressionSystem();
    p.markFloorVisited(FLOORS.LOBBY);
    expect(p.isFirstVisit(FLOORS.PLATFORM_TEAM)).toBe(true);
  });

  it('resetVisitedFloors makes isFirstVisit return true again for all floors', () => {
    const p = new ProgressionSystem();
    p.markFloorVisited(FLOORS.LOBBY);
    p.markFloorVisited(FLOORS.PLATFORM_TEAM);
    expect(p.isFirstVisit(FLOORS.LOBBY)).toBe(false);
    expect(p.isFirstVisit(FLOORS.PLATFORM_TEAM)).toBe(false);

    p.resetVisitedFloors();

    expect(p.isFirstVisit(FLOORS.LOBBY)).toBe(true);
    expect(p.isFirstVisit(FLOORS.PLATFORM_TEAM)).toBe(true);
  });

  it('resetVisitedFloors persists — reloading the save has no visited floors', () => {
    const p = new ProgressionSystem();
    p.markFloorVisited(FLOORS.LOBBY);
    p.resetVisitedFloors();

    const q = new ProgressionSystem();
    expect(q.loadFromSave()).toBe(true);
    expect(q.getVisitedFloorCount()).toBe(0);
    expect(q.isFirstVisit(FLOORS.LOBBY)).toBe(true);
  });
});

describe('ProgressionSystem — loadFromSave floor ID sanitisation', () => {
  it('returns false and keeps default state when adapter load() returns null', () => {
    const adapter: SaveAdapter = { load: () => null, save: () => {}, clear: () => {} };
    const p = new ProgressionSystem(adapter);

    expect(() => p.loadFromSave()).not.toThrow();
    expect(p.loadFromSave()).toBe(false);
    expect(p.getTotalAU()).toBe(0);
    expect(p.getCurrentFloor()).toBe(FLOORS.LOBBY);
    expect(p.isFloorUnlocked(FLOORS.LOBBY)).toBe(true);
    expect(p.isFloorUnlocked(FLOORS.BUSINESS)).toBe(false);
  });

  it('falls back to FLOORS.LOBBY when currentFloor is an unknown ID', () => {
    const corrupt = {
      version: 1,
      totalAU: 0,
      floorAU: {},
      unlockedFloors: [FLOORS.LOBBY],
      currentFloor: 999, // not a valid FloorId
      collectedTokens: {},
    };
    const adapter: SaveAdapter = { load: () => corrupt as never, save: () => {}, clear: () => {} };
    const p = new ProgressionSystem(adapter);
    p.loadFromSave();
    expect(p.getCurrentFloor()).toBe(FLOORS.LOBBY);
  });

  it('filters out unknown IDs from unlockedFloors', () => {
    const corrupt = {
      version: 1,
      totalAU: 0,
      floorAU: {},
      unlockedFloors: [FLOORS.LOBBY, 999], // 999 is not a valid FloorId
      currentFloor: FLOORS.LOBBY,
      collectedTokens: {},
    };
    const adapter: SaveAdapter = { load: () => corrupt as never, save: () => {}, clear: () => {} };
    const p = new ProgressionSystem(adapter);
    p.loadFromSave();
    // 999 must have been stripped; all remaining IDs must be valid FloorId values
    const unlocked = p.getUnlockedFloors();
    expect(unlocked).not.toContain(999);
    expect(unlocked.every(id => FLOOR_IDS.includes(id))).toBe(true);
  });

  it('fills in 0 for floors absent from floorAU in the saved data', () => {
    // A save that only has LOBBY in floorAU — all other floors should default to 0.
    const partial = {
      version: 1,
      totalAU: 3,
      floorAU: { [FLOORS.LOBBY]: 3 }, // missing PLATFORM_TEAM, BUSINESS, etc.
      unlockedFloors: [FLOORS.LOBBY],
      currentFloor: FLOORS.LOBBY,
      collectedTokens: {},
    };
    const adapter: SaveAdapter = { load: () => partial as never, save: () => {}, clear: () => {} };
    const p = new ProgressionSystem(adapter);
    p.loadFromSave();
    expect(p.getFloorAU(FLOORS.LOBBY)).toBe(3);
    expect(p.getFloorAU(FLOORS.PLATFORM_TEAM)).toBe(0);
    expect(p.getFloorAU(FLOORS.BUSINESS)).toBe(0);
  });

  it('ignores unknown floor keys in floorAU', () => {
    const corrupt = {
      version: 1,
      totalAU: 7,
      floorAU: { [FLOORS.LOBBY]: 5, 999: 2 }, // 999 is not a valid FloorId
      unlockedFloors: [FLOORS.LOBBY],
      currentFloor: FLOORS.LOBBY,
      collectedTokens: {},
    };
    const adapter: SaveAdapter = { load: () => corrupt as never, save: () => {}, clear: () => {} };
    const p = new ProgressionSystem(adapter);
    p.loadFromSave();
    expect(p.getFloorAU(FLOORS.LOBBY)).toBe(5);
    // totalAU is loaded verbatim from the save (not re-derived from floorAU)
    expect(p.getTotalAU()).toBe(7);
  });

  it('filters out unknown IDs from visitedFloors', () => {
    const corrupt = {
      version: 1,
      totalAU: 0,
      floorAU: {},
      unlockedFloors: [FLOORS.LOBBY],
      currentFloor: FLOORS.LOBBY,
      collectedTokens: {},
      visitedFloors: [FLOORS.LOBBY, 999], // 999 is not a valid FloorId
    };
    const adapter: SaveAdapter = { load: () => corrupt as never, save: () => {}, clear: () => {} };
    const p = new ProgressionSystem(adapter);
    p.loadFromSave();
    expect(p.hasVisitedFloor(FLOORS.LOBBY)).toBe(true);
    expect(p.getVisitedFloorCount()).toBe(1);
  });
});
