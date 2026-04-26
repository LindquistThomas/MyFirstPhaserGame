import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { ProgressionSystem } from './ProgressionSystem';
import { setStorage, setPlayerSlot, KVStorage, CURRENT_SAVE_VERSION } from './SaveManager';
import { FLOORS } from '../config/gameConfig';
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

  it('locked floor remains locked after save-reload (no merge with defaults)', () => {
    // Player collects only 5 AU — not enough for BUSINESS (needs 10).
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
      p.addAU(FLOORS.PLATFORM_TEAM, 10); // crosses BUSINESS threshold (10)
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
      totalAU: 5, // only 5 AU — not enough for BUSINESS (10), EXECUTIVE (15), or PRODUCTS (8)
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

    it('emits progression:au_milestone at each 50-AU boundary crossed', () => {
      const p = new ProgressionSystem();
      const milestones: number[] = [];
      eventBus.on('progression:au_milestone', (total) => milestones.push(total));
      p.addAU(FLOORS.PLATFORM_TEAM, 49);
      expect(milestones).toEqual([]);
      p.addAU(FLOORS.PLATFORM_TEAM, 1); // crosses 50
      expect(milestones).toEqual([50]);
      p.addAU(FLOORS.PLATFORM_TEAM, 50); // crosses 100
      expect(milestones).toEqual([50, 100]);
    });

    it('emits every boundary when a single addAU call crosses multiple milestones', () => {
      const p = new ProgressionSystem();
      const milestones: number[] = [];
      eventBus.on('progression:au_milestone', (total) => milestones.push(total));
      p.addAU(FLOORS.PLATFORM_TEAM, 120); // crosses 50 and 100
      expect(milestones).toEqual([50, 100]);
    });

    it('does not emit progression:au_milestone when total stays below first boundary', () => {
      const p = new ProgressionSystem();
      const fn = vi.fn();
      eventBus.on('progression:au_milestone', fn);
      p.addAU(FLOORS.PLATFORM_TEAM, 49);
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
});
