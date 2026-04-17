import { describe, it, expect, beforeEach } from 'vitest';
import { setStorage, setPlayerSlot, save, load, hasSave, clear, KVStorage, SaveData } from './SaveManager';

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
