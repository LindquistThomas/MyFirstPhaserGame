import { describe, it, expect, beforeEach, vi, afterEach, afterAll } from 'vitest';
import { setStorage, setPlayerSlot, save, load, hasSave, clear, noopStorage, KVStorage, SaveData, CURRENT_SAVE_VERSION, loadSlotInfo, migrateDefaultSlot, clearSlot, SAVE_SLOTS, exportSlot, importToSlot, SAVE_ENVELOPE_FORMAT, wasSlotRecovered, getCorruptBackup, clearRecoveredSlot, getRecoveryReason } from './SaveManager';
import type { SaveMigrationMap } from './SaveManager';
import { eventBus } from './EventBus';

function memoryStorage(): KVStorage & { store: Map<string, string> } {
  const store = new Map<string, string>();
  return {
    store,
    getItem: (k) => (store.has(k) ? store.get(k)! : null),
    setItem: (k, v) => { store.set(k, v); },
    removeItem: (k) => { store.delete(k); },
  };
}

const sample: SaveData = {
  version: CURRENT_SAVE_VERSION,
  totalAU: 7,
  floorAU: { 0: 1, 1: 4, 3: 2 },
  unlockedFloors: [0, 1, 3],
  currentFloor: 1,
  collectedTokens: { 0: [0], 1: [0, 1, 2], 3: [3] },
};

describe('SaveManager', () => {
  beforeEach(() => {
    setPlayerSlot('test');
  });

  it('returns null from load() when nothing is saved', () => {
    setStorage(memoryStorage());
    expect(load()).toBeNull();
    expect(hasSave()).toBe(false);
  });

  it('round-trips SaveData through save() / load()', () => {
    setStorage(memoryStorage());
    save(sample);
    expect(hasSave()).toBe(true);
    expect(load()).toEqual(sample);
  });

  it('clears persisted data', () => {
    setStorage(memoryStorage());
    save(sample);
    clear();
    expect(load()).toBeNull();
    expect(hasSave()).toBe(false);
  });

  it('suppresses quota errors during save()', () => {
    const failing: KVStorage = {
      getItem: () => null,
      setItem: () => { throw new Error('QuotaExceeded'); },
      removeItem: () => {},
    };
    setStorage(failing);
    expect(() => save(sample)).not.toThrow();
  });

  it('returns null when load() parses invalid JSON', () => {
    const corrupt = memoryStorage();
    corrupt.store.set('architect_test_v1', '{not-json');
    setStorage(corrupt);
    expect(load()).toBeNull();
  });

  it('scopes saves by player slot', () => {
    const store = memoryStorage();
    setStorage(store);

    setPlayerSlot('alice');
    save({ ...sample, totalAU: 10 });

    setPlayerSlot('bob');
    expect(load()).toBeNull();
    save({ ...sample, totalAU: 99 });

    setPlayerSlot('alice');
    expect(load()?.totalAU).toBe(10);

    setPlayerSlot('bob');
    expect(load()?.totalAU).toBe(99);
  });
});

describe('SaveManager — forward compatibility & robustness', () => {
  beforeEach(() => {
    try { globalThis.localStorage?.clear(); } catch { /* noop */ }
    setPlayerSlot('test');
  });

  it('preserves unknown/extra fields on load (forward-compat)', () => {
    // load() has no schema filtering for unknown keys — extra fields written by
    // a future build survive the round-trip verbatim, as long as all required
    // fields are present and valid.
    const store = memoryStorage();
    const future = {
      ...sample,
      schemaVersion: 2,
      cosmetics: { hat: 'wizard' },
      lastPlayedAt: 4070908800000, // valid number timestamp (year 2099)
    };
    store.store.set('architect_test_v1', JSON.stringify(future));
    setStorage(store);

    const loaded = load() as unknown as typeof future;
    expect(loaded).not.toBeNull();
    expect(loaded).toEqual(future);
    expect(loaded.schemaVersion).toBe(2);
    expect(loaded.cosmetics).toEqual({ hat: 'wizard' });
  });

  it('returns null (does not throw) for the literal string "not json"', () => {
    const store = memoryStorage();
    store.store.set('architect_test_v1', 'not json');
    setStorage(store);

    expect(() => load()).not.toThrow();
    expect(load()).toBeNull();
  });

  it('returns null and emits persistence:failed when storage holds "{}" (required fields missing)', () => {
    // load() now validates required fields; an empty object fails schema validation.
    const store = memoryStorage();
    store.store.set('architect_test_v1', '{}');
    setStorage(store);

    const handler = vi.fn();
    eventBus.on('persistence:failed', handler);

    const loaded = load();
    expect(loaded).toBeNull();
    expect(handler).toHaveBeenCalledOnce();
    expect(handler).toHaveBeenCalledWith(expect.objectContaining({ reason: 'parse' }));

    eventBus.off('persistence:failed', handler);
  });

  it('returns null and emits persistence:failed when required fields are missing', () => {
    // A partial save (e.g. missing unlockedFloors and collectedTokens) fails
    // schema validation and must not be fed into ProgressionSystem.
    const store = memoryStorage();
    const partial = { totalAU: 5, currentFloor: 2 };
    store.store.set('architect_test_v1', JSON.stringify(partial));
    setStorage(store);

    const handler = vi.fn();
    eventBus.on('persistence:failed', handler);

    const loaded = load();
    expect(loaded).toBeNull();
    expect(handler).toHaveBeenCalledOnce();
    expect(handler).toHaveBeenCalledWith(expect.objectContaining({ reason: 'parse' }));

    eventBus.off('persistence:failed', handler);
  });

  it('save() then load() returns a deeply-equal, structurally-independent copy', () => {
    setStorage(memoryStorage());
    save(sample);
    const loaded = load();
    expect(loaded).toEqual(sample);
    // JSON round-trip must yield a different reference (no aliasing of the
    // original object or its nested records/arrays).
    expect(loaded).not.toBe(sample);
    expect(loaded?.floorAU).not.toBe(sample.floorAU);
    expect(loaded?.unlockedFloors).not.toBe(sample.unlockedFloors);
    expect(loaded?.collectedTokens).not.toBe(sample.collectedTokens);
  });

  it('hasSave() is false on empty storage and true after save()', () => {
    setStorage(memoryStorage());
    expect(hasSave()).toBe(false);
    save(sample);
    expect(hasSave()).toBe(true);
    clear();
    expect(hasSave()).toBe(false);
  });

  it('keeps slots independent: clearing one slot does not affect others', () => {
    // Slots share the injected storage but key themselves by `architect_<slot>_v1`.
    setStorage(memoryStorage());

    setPlayerSlot('alice');
    save({ ...sample, totalAU: 1 });

    setPlayerSlot('bob');
    save({ ...sample, totalAU: 2 });

    setPlayerSlot('carol');
    save({ ...sample, totalAU: 3 });

    setPlayerSlot('bob');
    clear();
    expect(hasSave()).toBe(false);
    expect(load()).toBeNull();

    setPlayerSlot('alice');
    expect(hasSave()).toBe(true);
    expect(load()?.totalAU).toBe(1);

    setPlayerSlot('carol');
    expect(hasSave()).toBe(true);
    expect(load()?.totalAU).toBe(3);
  });
});


describe('SaveManager — schema versioning & migration', () => {
  beforeEach(() => {
    setPlayerSlot('test');
    setStorage(memoryStorage());
  });

  it('save() persists the version provided by the caller', () => {
    // save() is a thin serialiser — it does not enforce CURRENT_SAVE_VERSION.
    // Callers (e.g. ProgressionSystem.persist) are responsible for stamping the right version.
    const customVersionedSample: SaveData = { ...sample, version: CURRENT_SAVE_VERSION + 1 };
    save(customVersionedSample);
    const loaded = load();
    expect(loaded?.version).toBe(CURRENT_SAVE_VERSION + 1);
  });

  it('load() migrates a legacy save (no version field) to CURRENT_SAVE_VERSION', () => {
    const store = memoryStorage();
    // Simulate a save written before versioning was introduced.
    const legacy = { totalAU: 5, floorAU: { 0: 5 }, unlockedFloors: [0], currentFloor: 0, collectedTokens: {} };
    store.store.set('architect_test_v1', JSON.stringify(legacy));
    setStorage(store);

    const loaded = load();
    expect(loaded).not.toBeNull();
    expect(loaded?.version).toBe(CURRENT_SAVE_VERSION);
    expect(loaded?.totalAU).toBe(5);
    expect(loaded?.currentFloor).toBe(0);
  });

  it('load() does not re-migrate a save already at CURRENT_SAVE_VERSION', () => {
    save(sample);
    // Load twice — second load must see the same version, not an incremented one.
    expect(load()?.version).toBe(CURRENT_SAVE_VERSION);
    expect(load()?.version).toBe(CURRENT_SAVE_VERSION);
  });

  it('load() preserves all game fields after migration', () => {
    const store = memoryStorage();
    const legacy = {
      totalAU: 3,
      floorAU: { 0: 1, 1: 2 },
      unlockedFloors: [0, 1],
      currentFloor: 1,
      collectedTokens: { 0: [0], 1: [1, 2] },
    };
    store.store.set('architect_test_v1', JSON.stringify(legacy));
    setStorage(store);

    const loaded = load();
    expect(loaded?.totalAU).toBe(3);
    expect(loaded?.floorAU).toEqual({ 0: 1, 1: 2 });
    expect(loaded?.unlockedFloors).toEqual([0, 1]);
    expect(loaded?.currentFloor).toBe(1);
    expect(loaded?.collectedTokens).toEqual({ 0: [0], 1: [1, 2] });
  });

  it('load() returns a future-version save unchanged when no downgrade path exists', () => {
    const store = memoryStorage();
    // Simulate a save from a newer build. Since version 99 > CURRENT_SAVE_VERSION,
    // the migration loop is skipped and the save is returned as-is.
    store.store.set('architect_test_v1', JSON.stringify({ version: 99, totalAU: 0, floorAU: {}, unlockedFloors: [], currentFloor: 0, collectedTokens: {} }));
    setStorage(store);

    const loaded = load();
    expect(loaded).not.toBeNull();
    expect(loaded?.version).toBe(99); // unchanged — higher than current
  });

  it('load() returns null when a required migration entry is missing', () => {
    const store = memoryStorage();
    const v1Save = {
      version: 1,
      totalAU: 5,
      floorAU: { 0: 5 },
      unlockedFloors: [0],
      currentFloor: 0,
      collectedTokens: {},
    };
    store.store.set('architect_test_v1', JSON.stringify(v1Save));
    setStorage(store);

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const incompleteMigrations: SaveMigrationMap = {
      0: (d) => d,
      // Missing 1 -> 2 migration on purpose.
    };
    try {
      expect(load(incompleteMigrations)).toBeNull();
      expect(warnSpy).toHaveBeenCalledWith(
        '[SaveManager] persistence:failed',
        expect.objectContaining({ reason: 'parse', slot: 'test' }),
      );
    } finally {
      warnSpy.mockRestore();
    }
  });

  it('v1→current migration: loading a v1 save yields zeroed playtime fields', () => {
    const store = memoryStorage();
    const v1Save = {
      version: 1,
      totalAU: 5,
      floorAU: { 0: 5 },
      unlockedFloors: [0],
      currentFloor: 0,
      collectedTokens: {},
    };
    store.store.set('architect_test_v1', JSON.stringify(v1Save));
    setStorage(store);

    const loaded = load();
    expect(loaded).not.toBeNull();
    expect(loaded?.version).toBe(CURRENT_SAVE_VERSION);
    expect(loaded?.playtimeMs).toBe(0);
    expect(loaded?.floorPlaytimeMs).toEqual({});
  });

  it('v0→current migration (no version field): yields zeroed playtime fields', () => {
    const store = memoryStorage();
    const v0Save = {
      totalAU: 3,
      floorAU: { 0: 3 },
      unlockedFloors: [0],
      currentFloor: 0,
      collectedTokens: {},
    };
    store.store.set('architect_test_v1', JSON.stringify(v0Save));
    setStorage(store);

    const loaded = load();
    expect(loaded).not.toBeNull();
    expect(loaded?.version).toBe(CURRENT_SAVE_VERSION);
    expect(loaded?.playtimeMs).toBe(0);
    expect(loaded?.floorPlaytimeMs).toEqual({});
    // original fields preserved
    expect(loaded?.totalAU).toBe(3);
  });

  it('v2→v3 migration adds PB fields defaulting to undefined', () => {
    const store = memoryStorage();
    const v2Save = {
      version: 2,
      totalAU: 11,
      floorAU: { 0: 5, 1: 6 },
      unlockedFloors: [0, 1],
      currentFloor: 1,
      collectedTokens: { 0: [0], 1: [0] },
      playtimeMs: 1234,
      floorPlaytimeMs: { 1: 1234 },
    };
    store.store.set('architect_test_v1', JSON.stringify(v2Save));
    setStorage(store);

    const loaded = load();
    expect(loaded?.version).toBe(3);
    expect(loaded?.bestRunMs).toBeUndefined();
    expect(loaded?.bestFloorMs).toBeUndefined();
  });

  it('load() returns null for a non-integer version field', () => {
    const store = memoryStorage();
    store.store.set('architect_test_v1', JSON.stringify({ ...sample, version: 1.5 }));
    setStorage(store);
    expect(load()).toBeNull();
  });

  it('load() returns null for a negative version field', () => {
    const store = memoryStorage();
    store.store.set('architect_test_v1', JSON.stringify({ ...sample, version: -1 }));
    setStorage(store);
    expect(load()).toBeNull();
  });
});


describe('SaveManager — persistence:failed events', () => {
  const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

  beforeEach(() => {
    setPlayerSlot('test');
    warnSpy.mockClear();
    eventBus.removeAllListeners();
  });

  afterEach(() => {
    eventBus.removeAllListeners();
  });

  afterAll(() => {
    warnSpy.mockRestore();
  });

  it('emits persistence:failed with reason "quota" when setItem throws a QuotaExceededError DOMException', () => {
    const quotaStorage: KVStorage = {
      getItem: () => null,
      setItem: () => { throw new DOMException('Quota exceeded', 'QuotaExceededError'); },
      removeItem: () => {},
    };
    setStorage(quotaStorage);

    const handler = vi.fn();
    eventBus.on('persistence:failed', handler);

    expect(() => save(sample)).not.toThrow();
    expect(handler).toHaveBeenCalledOnce();
    expect(handler).toHaveBeenCalledWith(expect.objectContaining({ reason: 'quota' }));
  });

  it('emits persistence:failed with reason "quota" for DOMException with code 22', () => {
    const quotaStorage: KVStorage = {
      getItem: () => null,
      setItem: () => {
        const err = new DOMException('QuotaExceeded');
        // Some browsers use numeric code 22 instead of the string name.
        Object.defineProperty(err, 'code', { value: 22 });
        throw err;
      },
      removeItem: () => {},
    };
    setStorage(quotaStorage);

    const handler = vi.fn();
    eventBus.on('persistence:failed', handler);

    save(sample);
    expect(handler).toHaveBeenCalledWith(expect.objectContaining({ reason: 'quota' }));
  });

  it('emits persistence:failed with reason "parse" when load() encounters invalid JSON', () => {
    const store = new Map<string, string>([['architect_test_v1', 'not-valid-json']]);
    const parseStorage: KVStorage = {
      getItem: (k) => store.get(k) ?? null,
      setItem: (k, v) => { store.set(k, v); },
      removeItem: (k) => { store.delete(k); },
    };
    setStorage(parseStorage);

    const handler = vi.fn();
    eventBus.on('persistence:failed', handler);

    const result = load();
    expect(result).toBeNull();
    expect(handler).toHaveBeenCalledOnce();
    expect(handler).toHaveBeenCalledWith(expect.objectContaining({ reason: 'parse' }));
  });

  it('emits persistence:failed with reason "unavailable" exactly once when noopStorage is in use', () => {
    setStorage(noopStorage);

    const handler = vi.fn();
    eventBus.on('persistence:failed', handler);

    // First call triggers the unavailable detection
    hasSave();
    expect(handler).toHaveBeenCalledOnce();
    expect(handler).toHaveBeenCalledWith(expect.objectContaining({ reason: 'unavailable' }));

    // Subsequent calls must NOT re-emit
    save(sample);
    load();
    clear();
    expect(handler).toHaveBeenCalledOnce();
  });

  it('resets the unavailable flag after setStorage() so detection fires again on re-inject', () => {
    setStorage(noopStorage);

    const handler = vi.fn();
    eventBus.on('persistence:failed', handler);
    hasSave(); // emits once

    // Re-inject noopStorage — setStorage resets the flag
    setStorage(noopStorage);
    hasSave(); // should emit again
    expect(handler).toHaveBeenCalledTimes(2);
  });

  it('emits persistence:failed with reason "unknown" for non-quota save errors', () => {
    const unknownStorage: KVStorage = {
      getItem: () => null,
      setItem: () => { throw new Error('SecurityError'); },
      removeItem: () => {},
    };
    setStorage(unknownStorage);

    const handler = vi.fn();
    eventBus.on('persistence:failed', handler);

    save(sample);
    expect(handler).toHaveBeenCalledWith(expect.objectContaining({ reason: 'unknown' }));
  });

  it('includes detail string in the payload when err has a message', () => {
    const quotaStorage: KVStorage = {
      getItem: () => null,
      setItem: () => { throw new DOMException('Disk is full', 'QuotaExceededError'); },
      removeItem: () => {},
    };
    setStorage(quotaStorage);

    const handler = vi.fn();
    eventBus.on('persistence:failed', handler);

    save(sample);
    const payload = handler.mock.calls[0]?.[0] as { reason: string; detail?: string };
    expect(payload.detail).toContain('Disk is full');
  });

  it('emits persistence:failed with reason "unknown" when hasSave() getItem throws', () => {
    const throwingStorage: KVStorage = {
      getItem: () => { throw new Error('storage unavailable'); },
      setItem: () => {},
      removeItem: () => {},
    };
    setStorage(throwingStorage);

    const handler = vi.fn();
    eventBus.on('persistence:failed', handler);

    const result = hasSave();
    expect(result).toBe(false);
    expect(handler).toHaveBeenCalledWith(expect.objectContaining({ reason: 'unknown' }));
  });
});


describe('SaveManager — multi-slot UI helpers', () => {
  beforeEach(() => {
    setStorage(memoryStorage());
    setPlayerSlot('test');
  });

  it('SAVE_SLOTS contains exactly slot1, slot2, slot3', () => {
    expect(SAVE_SLOTS).toEqual(['slot1', 'slot2', 'slot3']);
  });

  it('loadSlotInfo returns exists:false for an empty slot', () => {
    const info = loadSlotInfo('slot1');
    expect(info.exists).toBe(false);
    expect(info.slotId).toBe('slot1');
  });

  it('loadSlotInfo returns exists:false with correct fields after saving', () => {
    setPlayerSlot('slot2');
    save({ ...sample, totalAU: 42, currentFloor: 3, lastPlayedAt: 1234567890, bestRunMs: 61_000 });

    const info = loadSlotInfo('slot2');
    expect(info.exists).toBe(true);
    expect(info.totalAU).toBe(42);
    expect(info.currentFloor).toBe(3);
    expect(info.lastPlayedAt).toBe(1234567890);
    expect(info.bestRunMs).toBe(61_000);
  });

  it('loadSlotInfo returns undefined currentFloor for an unrecognised floor ID', () => {
    // Saves from hypothetical future builds or corrupted data may contain a
    // floor ID that is not in the current FLOORS enum. loadSlotInfo must reject
    // it rather than widening the type to an arbitrary number.
    const store = memoryStorage();
    store.store.set('architect_slot1_v1', JSON.stringify({
      version: 1,
      totalAU: 10,
      currentFloor: 999, // not a valid FloorId
      unlockedFloors: [0],
      floorAU: { 0: 10 },
      collectedTokens: { 0: [] },
    }));
    setStorage(store);

    const info = loadSlotInfo('slot1');
    expect(info.exists).toBe(true);
    expect(info.totalAU).toBe(10);
    expect(info.currentFloor).toBeUndefined();
  });


  it('loadSlotInfo returns exists:false when the slot data is corrupt JSON', () => {
    const store = memoryStorage();
    store.store.set('architect_slot3_v1', '{not-valid-json');
    setStorage(store);

    const info = loadSlotInfo('slot3');
    expect(info.exists).toBe(false);
    expect(info.slotId).toBe('slot3');
  });

  it('loadSlotInfo returns exists:false when required fields are missing (schema invalid)', () => {
    // A save with missing unlockedFloors/collectedTokens fails schema validation;
    // loadSlotInfo must return exists:false to match what load() would do.
    const store = memoryStorage();
    store.store.set('architect_slot1_v1', JSON.stringify({ totalAU: 5, currentFloor: 0 }));
    setStorage(store);

    const info = loadSlotInfo('slot1');
    expect(info.exists).toBe(false);
  });

  it('loadSlotInfo returns exists:false when collectedTokens has non-array values (schema invalid)', () => {
    const store = memoryStorage();
    store.store.set('architect_slot2_v1', JSON.stringify({ ...sample, collectedTokens: { 0: 1 } }));
    setStorage(store);

    const info = loadSlotInfo('slot2');
    expect(info.exists).toBe(false);
  });

  it('loadSlotInfo does not change the active player slot', () => {
    setPlayerSlot('slot1');
    save({ ...sample, totalAU: 99 });

    setPlayerSlot('slot3');
    loadSlotInfo('slot1'); // read a different slot

    // Active slot must still be slot3
    expect(load()).toBeNull(); // slot3 has no save
  });

  it('clearSlot removes only the targeted slot', () => {
    setPlayerSlot('slot1');
    save({ ...sample, totalAU: 1 });

    setPlayerSlot('slot2');
    save({ ...sample, totalAU: 2 });

    clearSlot('slot1');

    expect(loadSlotInfo('slot1').exists).toBe(false);
    expect(loadSlotInfo('slot2').exists).toBe(true);
    expect(loadSlotInfo('slot2').totalAU).toBe(2);
  });

  it('clearSlot does not affect the currently active slot if they differ', () => {
    setPlayerSlot('slot2');
    save({ ...sample, totalAU: 7 });

    clearSlot('slot1'); // slot1 was empty anyway, slot2 untouched

    setPlayerSlot('slot2');
    expect(hasSave()).toBe(true);
    expect(load()?.totalAU).toBe(7);
  });
});


describe('SaveManager — migrateDefaultSlot', () => {
  beforeEach(() => {
    setStorage(memoryStorage());
    setPlayerSlot('test');
  });

  it('migrates architect_default_v1 into architect_slot1_v1 when slot1 is empty', () => {
    // Simulate an existing legacy save under the 'default' slot
    setPlayerSlot('default');
    save({ ...sample, totalAU: 55 });

    const migrated = migrateDefaultSlot();
    expect(migrated).toBe(true);

    // The old default key should be gone
    setPlayerSlot('default');
    expect(hasSave()).toBe(false);

    // slot1 should now carry the data
    expect(loadSlotInfo('slot1').exists).toBe(true);
    expect(loadSlotInfo('slot1').totalAU).toBe(55);
  });

  it('does not overwrite slot1 if it already has data, and preserves the legacy key', () => {
    setPlayerSlot('slot1');
    save({ ...sample, totalAU: 10 });

    setPlayerSlot('default');
    save({ ...sample, totalAU: 99 });

    const migrated = migrateDefaultSlot();
    // Should not migrate because slot1 already has a save
    expect(migrated).toBe(false);

    // slot1 must still have the original data
    expect(loadSlotInfo('slot1').totalAU).toBe(10);

    // The legacy default key must NOT have been deleted
    setPlayerSlot('default');
    expect(hasSave()).toBe(true);
    expect(load()?.totalAU).toBe(99);
  });

  it('returns false and does nothing when no default save exists', () => {
    const migrated = migrateDefaultSlot();
    expect(migrated).toBe(false);
    expect(loadSlotInfo('slot1').exists).toBe(false);
  });

  it('is idempotent: running twice has no harmful effect', () => {
    setPlayerSlot('default');
    save({ ...sample, totalAU: 20 });

    migrateDefaultSlot();
    const second = migrateDefaultSlot(); // slot1 now exists → skips
    expect(second).toBe(false);
    expect(loadSlotInfo('slot1').totalAU).toBe(20);
  });
});


describe('SaveManager — isValidSaveData schema validation', () => {
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    setStorage(memoryStorage());
    setPlayerSlot('test');
    eventBus.removeAllListeners();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    eventBus.removeAllListeners();
  });

  const validBase = {
    version: CURRENT_SAVE_VERSION,
    totalAU: 10,
    floorAU: { 0: 5, 1: 5 },
    unlockedFloors: [0, 1],
    currentFloor: 1,
    collectedTokens: { 0: [0], 1: [1] },
  };

  function storeAndLoad(data: Record<string, unknown>): SaveData | null {
    const store = memoryStorage();
    store.store.set('architect_test_v1', JSON.stringify(data));
    setStorage(store);
    return load();
  }

  it('accepts a fully valid save and returns it', () => {
    const loaded = storeAndLoad(validBase);
    expect(loaded).not.toBeNull();
    expect(loaded?.totalAU).toBe(10);
  });

  it('accepts a valid save with all optional fields present', () => {
    const withOptionals = {
      ...validBase,
      onboardingComplete: true,
      visitedFloors: [0, 1],
      lastPlayedAt: 1234567890,
    };
    const loaded = storeAndLoad(withOptionals);
    expect(loaded).not.toBeNull();
    expect(loaded?.onboardingComplete).toBe(true);
  });

  it('returns null and emits persistence:failed when totalAU is missing', () => {
    const handler = vi.fn();
    eventBus.on('persistence:failed', handler);

    const { totalAU: _omit, ...missing } = validBase;
    const loaded = storeAndLoad(missing);
    expect(loaded).toBeNull();
    expect(handler).toHaveBeenCalledWith(expect.objectContaining({ reason: 'parse' }));
  });

  it('returns null and emits persistence:failed when totalAU is negative', () => {
    const handler = vi.fn();
    eventBus.on('persistence:failed', handler);

    const loaded = storeAndLoad({ ...validBase, totalAU: -1 });
    expect(loaded).toBeNull();
    expect(handler).toHaveBeenCalledWith(expect.objectContaining({ reason: 'parse' }));
  });

  it('returns null and emits persistence:failed when totalAU is a string', () => {
    const handler = vi.fn();
    eventBus.on('persistence:failed', handler);

    const loaded = storeAndLoad({ ...validBase, totalAU: '10' });
    expect(loaded).toBeNull();
    expect(handler).toHaveBeenCalledWith(expect.objectContaining({ reason: 'parse' }));
  });

  it('returns null and emits persistence:failed when unlockedFloors is an object (not array)', () => {
    const handler = vi.fn();
    eventBus.on('persistence:failed', handler);

    const loaded = storeAndLoad({ ...validBase, unlockedFloors: { 0: 0, 1: 1 } });
    expect(loaded).toBeNull();
    expect(handler).toHaveBeenCalledWith(expect.objectContaining({ reason: 'parse' }));
  });

  it('returns null and emits persistence:failed when unlockedFloors contains non-numbers', () => {
    const handler = vi.fn();
    eventBus.on('persistence:failed', handler);

    const loaded = storeAndLoad({ ...validBase, unlockedFloors: ['a', 'b'] });
    expect(loaded).toBeNull();
    expect(handler).toHaveBeenCalledWith(expect.objectContaining({ reason: 'parse' }));
  });

  it('returns null and emits persistence:failed when floorAU is an array (not object)', () => {
    const handler = vi.fn();
    eventBus.on('persistence:failed', handler);

    const loaded = storeAndLoad({ ...validBase, floorAU: [5, 5] });
    expect(loaded).toBeNull();
    expect(handler).toHaveBeenCalledWith(expect.objectContaining({ reason: 'parse' }));
  });

  it('returns null and emits persistence:failed when floorAU is null', () => {
    const handler = vi.fn();
    eventBus.on('persistence:failed', handler);

    const loaded = storeAndLoad({ ...validBase, floorAU: null });
    expect(loaded).toBeNull();
    expect(handler).toHaveBeenCalledWith(expect.objectContaining({ reason: 'parse' }));
  });

  it('returns null and emits persistence:failed when collectedTokens is an array', () => {
    const handler = vi.fn();
    eventBus.on('persistence:failed', handler);

    const loaded = storeAndLoad({ ...validBase, collectedTokens: [[0], [1]] });
    expect(loaded).toBeNull();
    expect(handler).toHaveBeenCalledWith(expect.objectContaining({ reason: 'parse' }));
  });

  it('returns null and emits persistence:failed when optional onboardingComplete is a string', () => {
    const handler = vi.fn();
    eventBus.on('persistence:failed', handler);

    const loaded = storeAndLoad({ ...validBase, onboardingComplete: 'yes' });
    expect(loaded).toBeNull();
    expect(handler).toHaveBeenCalledWith(expect.objectContaining({ reason: 'parse' }));
  });

  it('returns null and emits persistence:failed when optional visitedFloors is an object', () => {
    const handler = vi.fn();
    eventBus.on('persistence:failed', handler);

    const loaded = storeAndLoad({ ...validBase, visitedFloors: { 0: 0 } });
    expect(loaded).toBeNull();
    expect(handler).toHaveBeenCalledWith(expect.objectContaining({ reason: 'parse' }));
  });

  it('returns null and emits persistence:failed when optional lastPlayedAt is a string', () => {
    const handler = vi.fn();
    eventBus.on('persistence:failed', handler);

    const loaded = storeAndLoad({ ...validBase, lastPlayedAt: '2026-01-01' });
    expect(loaded).toBeNull();
    expect(handler).toHaveBeenCalledWith(expect.objectContaining({ reason: 'parse' }));
  });

  it('returns null and emits persistence:failed when floorAU has non-number values', () => {
    const handler = vi.fn();
    eventBus.on('persistence:failed', handler);

    const loaded = storeAndLoad({ ...validBase, floorAU: { 0: 'bad', 1: 5 } });
    expect(loaded).toBeNull();
    expect(handler).toHaveBeenCalledWith(expect.objectContaining({ reason: 'parse' }));
  });

  it('returns null and emits persistence:failed when collectedTokens has non-array values', () => {
    const handler = vi.fn();
    eventBus.on('persistence:failed', handler);

    // {0: 1} (number instead of array) must be rejected
    const loaded = storeAndLoad({ ...validBase, collectedTokens: { 0: 1, 1: [1] } });
    expect(loaded).toBeNull();
    expect(handler).toHaveBeenCalledWith(expect.objectContaining({ reason: 'parse' }));
  });

  it('returns null and emits persistence:failed when collectedTokens has object values', () => {
    const handler = vi.fn();
    eventBus.on('persistence:failed', handler);

    const loaded = storeAndLoad({ ...validBase, collectedTokens: { 0: {} } });
    expect(loaded).toBeNull();
    expect(handler).toHaveBeenCalledWith(expect.objectContaining({ reason: 'parse' }));
  });

  it('returns null and emits persistence:failed when visitedFloors contains non-numbers', () => {
    const handler = vi.fn();
    eventBus.on('persistence:failed', handler);

    const loaded = storeAndLoad({ ...validBase, visitedFloors: ['a', 'b'] });
    expect(loaded).toBeNull();
    expect(handler).toHaveBeenCalledWith(expect.objectContaining({ reason: 'parse' }));
  });

  it('stores a forensic copy and removes the corrupt key on validation failure', () => {
    const store = memoryStorage();
    store.store.set('architect_test_v1', JSON.stringify({ totalAU: 'bad' }));
    setStorage(store);

    load();

    // Original key removed so hasSave() is false
    expect(store.store.has('architect_test_v1')).toBe(false);
    // Forensic copy stored under the fixed per-slot key (no timestamp suffix)
    expect(store.store.has('architect_test_v1_corrupt')).toBe(true);
  });

  it('stores a forensic copy on JSON.parse failure (not just schema failure)', () => {
    const store = memoryStorage();
    store.store.set('architect_test_v1', '{not valid json}');
    setStorage(store);

    load();

    expect(store.store.has('architect_test_v1')).toBe(false);
    expect(store.store.has('architect_test_v1_corrupt')).toBe(true);
  });

  it('stores a forensic copy when version is invalid (non-integer)', () => {
    const store = memoryStorage();
    store.store.set('architect_test_v1', JSON.stringify({ ...validBase, version: 1.5 }));
    setStorage(store);

    load();

    expect(store.store.has('architect_test_v1')).toBe(false);
    expect(store.store.has('architect_test_v1_corrupt')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Save recovery: wasSlotRecovered / getCorruptBackup / clearRecoveredSlot
// ---------------------------------------------------------------------------

describe('SaveManager — save recovery helpers', () => {
  const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

  beforeEach(() => {
    setPlayerSlot('slot1');
    warnSpy.mockClear();
    eventBus.removeAllListeners();
    // Clear any lingering recovered-slot state from previous tests.
    clearRecoveredSlot('slot1');
    clearRecoveredSlot('slot2');
    clearRecoveredSlot('slot3');
  });

  afterEach(() => {
    eventBus.removeAllListeners();
  });

  afterAll(() => {
    warnSpy.mockRestore();
  });

  it('wasSlotRecovered returns false for a healthy boot (no corruption)', () => {
    const store = memoryStorage();
    setStorage(store);
    expect(wasSlotRecovered('slot1')).toBe(false);
  });

  it('wasSlotRecovered returns true after load() encounters a corrupt save', () => {
    const store = memoryStorage();
    store.store.set('architect_slot1_v1', '{not json}');
    setStorage(store);
    load();
    expect(wasSlotRecovered('slot1')).toBe(true);
  });

  it('getCorruptBackup returns the raw corrupt string after load() discards it', () => {
    const raw = '{not json}';
    const store = memoryStorage();
    store.store.set('architect_slot1_v1', raw);
    setStorage(store);
    load();
    expect(getCorruptBackup('slot1')).toBe(raw);
  });

  it('getCorruptBackup returns null for a slot that was never recovered', () => {
    setStorage(memoryStorage());
    expect(getCorruptBackup('slot2')).toBeNull();
  });

  it('clearRecoveredSlot removes the recovery sentinel so dialog does not reappear', () => {
    const store = memoryStorage();
    store.store.set('architect_slot1_v1', '{not json}');
    setStorage(store);
    load();
    expect(wasSlotRecovered('slot1')).toBe(true);
    clearRecoveredSlot('slot1');
    expect(wasSlotRecovered('slot1')).toBe(false);
  });

  it('clearRecoveredSlot also clears getCorruptBackup', () => {
    const store = memoryStorage();
    store.store.set('architect_slot1_v1', '{bad}');
    setStorage(store);
    load();
    clearRecoveredSlot('slot1');
    expect(getCorruptBackup('slot1')).toBeNull();
  });

  it('wasSlotRecovered returns true when loadSlotInfo detects corruption', () => {
    const store = memoryStorage();
    store.store.set('architect_slot2_v1', '{corrupt}');
    setStorage(store);
    const info = loadSlotInfo('slot2');
    expect(info.recovered).toBe(true);
    expect(wasSlotRecovered('slot2')).toBe(true);
  });

  it('loadSlotInfo.recovered is false for a genuinely empty slot', () => {
    setStorage(memoryStorage());
    const info = loadSlotInfo('slot3');
    expect(info.exists).toBe(false);
    expect(info.recovered).toBe(false);
  });

  it('loadSlotInfo.recovered is true for a slot recovered via load() even after key is removed', () => {
    const store = memoryStorage();
    store.store.set('architect_slot1_v1', '{bad}');
    setStorage(store);
    // Simulate load() detecting corruption (sets playerSlot = 'slot1').
    load();
    // Now loadSlotInfo should see recovered=true even though the key is gone.
    const info = loadSlotInfo('slot1');
    expect(info.exists).toBe(false);
    expect(info.recovered).toBe(true);
  });

  it('persistence:failed payload includes the slot id on parse failure', () => {
    const store = memoryStorage();
    store.store.set('architect_slot1_v1', '{bad}');
    setStorage(store);
    const handler = vi.fn();
    eventBus.on('persistence:failed', handler);
    load();
    expect(handler).toHaveBeenCalledWith(expect.objectContaining({ reason: 'parse', slot: 'slot1' }));
  });

  it('forensic copy is stored under the fixed _corrupt key (no timestamp)', () => {
    const store = memoryStorage();
    store.store.set('architect_slot1_v1', 'CORRUPT');
    setStorage(store);
    load();
    expect(store.store.get('architect_slot1_v1_corrupt')).toBe('CORRUPT');
  });

  it('loadSlotInfo stashes forensic copy for non-active slot', () => {
    const store = memoryStorage();
    store.store.set('architect_slot3_v1', 'BADDATA');
    setStorage(store);
    loadSlotInfo('slot3');
    expect(store.store.get('architect_slot3_v1_corrupt')).toBe('BADDATA');
    expect(store.store.has('architect_slot3_v1')).toBe(false);
  });

  it('getRecoveryReason returns "parse" after corruption is detected', () => {
    const store = memoryStorage();
    store.store.set('architect_slot1_v1', '{bad}');
    setStorage(store);
    load();
    expect(getRecoveryReason('slot1')).toBe('parse');
  });

  it('getRecoveryReason returns "parse" as default for a slot that was never recovered', () => {
    setStorage(memoryStorage());
    expect(getRecoveryReason('slot2')).toBe('parse');
  });
});


describe('SaveManager — exportSlot / importToSlot', () => {
  const mem = memoryStorage();

  beforeEach(() => {
    setStorage(mem);
    setPlayerSlot('slot1');
    eventBus.removeAllListeners();
  });

  afterEach(() => {
    // Clear the in-memory store between tests
    mem.store.clear();
    eventBus.removeAllListeners();
  });

  it('exportSlot returns null when slot is empty', () => {
    expect(exportSlot('slot1')).toBeNull();
  });

  it('exportSlot produces a valid JSON envelope with the correct format', () => {
    save(sample);
    const json = exportSlot('slot1');
    expect(json).not.toBeNull();
    const envelope = JSON.parse(json!);
    expect(envelope.format).toBe(SAVE_ENVELOPE_FORMAT);
    expect(typeof envelope.exportedAt).toBe('string');
    expect(envelope.payload.totalAU).toBe(sample.totalAU);
    expect(envelope.payload.currentFloor).toBe(sample.currentFloor);
  });

  it('round-trip: export → clear storage → import → data restored exactly', () => {
    save(sample);
    const json = exportSlot('slot1')!;

    // Wipe the slot
    mem.store.clear();
    expect(mem.store.has('architect_slot1_v1')).toBe(false);

    // Import back
    const restored = importToSlot('slot1', json);
    expect(restored).not.toBeNull();
    expect(restored!.totalAU).toBe(sample.totalAU);
    expect(restored!.currentFloor).toBe(sample.currentFloor);
    expect(restored!.unlockedFloors).toEqual(sample.unlockedFloors);

    // Slot key in storage should now exist
    expect(mem.store.has('architect_slot1_v1')).toBe(true);
  });

  it('importToSlot returns null for malformed JSON', () => {
    expect(importToSlot('slot1', '{not valid json}')).toBeNull();
  });

  it('importToSlot returns null for a future / unknown format string', () => {
    const badEnvelope = JSON.stringify({
      format: 'architect-save-v2',
      exportedAt: new Date().toISOString(),
      payload: sample,
    });
    expect(importToSlot('slot1', badEnvelope)).toBeNull();
  });

  it('importToSlot returns null when payload is missing required fields', () => {
    const badPayload = JSON.stringify({
      format: SAVE_ENVELOPE_FORMAT,
      exportedAt: new Date().toISOString(),
      payload: { totalAU: 5 }, // missing required fields
    });
    expect(importToSlot('slot1', badPayload)).toBeNull();
  });

  it('importToSlot runs MIGRATIONS on a v0 payload (cross-version safety)', () => {
    // v0 saves had no 'version' field; the migration stamps it at version: 1.
    const v0Payload = {
      // no version field — treated as version 0
      totalAU: 42,
      floorAU: { 0: 42 },
      unlockedFloors: [0],
      currentFloor: 0,
      collectedTokens: { 0: [] },
    };
    const envelope = JSON.stringify({
      format: SAVE_ENVELOPE_FORMAT,
      exportedAt: new Date().toISOString(),
      payload: v0Payload,
    });
    const result = importToSlot('slot1', envelope);
    expect(result).not.toBeNull();
    expect(result!.totalAU).toBe(42);
  });

  it('importToSlot writes to the specified slot key, not the active playerSlot key', () => {
    setPlayerSlot('slot2'); // active slot is slot2

    const envelope = JSON.stringify({
      format: SAVE_ENVELOPE_FORMAT,
      exportedAt: new Date().toISOString(),
      payload: sample,
    });
    importToSlot('slot1', envelope); // write to slot1 explicitly

    // slot1 should have the data; slot2 should remain empty
    expect(mem.store.has('architect_slot1_v1')).toBe(true);
    expect(mem.store.has('architect_slot2_v1')).toBe(false);
  });
});
