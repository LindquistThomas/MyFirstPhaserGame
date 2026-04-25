import { describe, it, expect, beforeEach, vi, afterEach, afterAll } from 'vitest';
import { setStorage, setPlayerSlot, save, load, hasSave, clear, noopStorage, KVStorage, SaveData, CURRENT_SAVE_VERSION } from './SaveManager';
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
  floorAU: { 0: 1, 1: 4, 2: 2 },
  unlockedFloors: [0, 1, 2],
  currentFloor: 1,
  collectedTokens: { 0: [0], 1: [0, 1, 2], 2: [3] },
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
    // SaveManager uses a raw JSON.parse with no schema filtering, so extra
    // fields written by a future version survive a load() round-trip verbatim.
    const store = memoryStorage();
    const future = {
      ...sample,
      schemaVersion: 2,
      cosmetics: { hat: 'wizard' },
      lastPlayedAt: '2099-01-01T00:00:00Z',
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

  it('returns an empty object cast to SaveData when storage holds "{}" (no validation)', () => {
    // load() applies migrations (v0 → v1) and stamps `version: 1`.
    // All other fields remain absent; consumers merge with defaults.
    const store = memoryStorage();
    store.store.set('architect_test_v1', '{}');
    setStorage(store);

    const loaded = load();
    expect(loaded).not.toBeNull();
    expect(loaded).toEqual({ version: CURRENT_SAVE_VERSION });
    expect((loaded as Partial<SaveData>).totalAU).toBeUndefined();
    expect((loaded as Partial<SaveData>).floorAU).toBeUndefined();
  });

  it('returns a partial object verbatim when required fields are missing', () => {
    const store = memoryStorage();
    const partial = { totalAU: 5, currentFloor: 2 };
    store.store.set('architect_test_v1', JSON.stringify(partial));
    setStorage(store);

    const loaded = load() as Partial<SaveData> | null;
    expect(loaded).toEqual({ ...partial, version: CURRENT_SAVE_VERSION });
    expect(loaded?.unlockedFloors).toBeUndefined();
    expect(loaded?.collectedTokens).toBeUndefined();
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

  it.skip('load() returns null when a required migration entry is missing', () => {
    // This path only occurs when 0 < save.version < CURRENT_SAVE_VERSION and
    // a migration step inside that range is missing. With CURRENT_SAVE_VERSION=1
    // there is no constructible version-gap case yet.
    //
    // Once a gap can be created, seed a save at the missing intermediate version,
    // call load(), and assert:
    // expect(load()).toBeNull();
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
