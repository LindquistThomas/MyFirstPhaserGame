import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createPersistedStore } from './PersistedStore';
import { eventBus } from './EventBus';
import type { KVStorage } from './SaveManager';

function memoryStorage(): KVStorage & { store: Map<string, string> } {
  const store = new Map<string, string>();
  return {
    store,
    getItem: (k) => (store.has(k) ? store.get(k)! : null),
    setItem: (k, v) => { store.set(k, v); },
    removeItem: (k) => { store.delete(k); },
  };
}

describe('PersistedStore', () => {
  beforeEach(() => {
    eventBus.removeAllListeners();
  });

  afterEach(() => {
    eventBus.removeAllListeners();
  });

  it('returns the default value when storage is empty', () => {
    const s = createPersistedStore<number>({ key: 'k', defaultValue: () => 42 });
    s.setStorage(memoryStorage());
    expect(s.read()).toBe(42);
  });

  it('round-trips a value through write / read', () => {
    const s = createPersistedStore<{ a: number }>({ key: 'k', defaultValue: () => ({ a: 0 }) });
    s.setStorage(memoryStorage());
    s.write({ a: 5 });
    expect(s.read()).toEqual({ a: 5 });
  });

  it('clear() resets cache and removes the underlying entry', () => {
    const store = memoryStorage();
    const s = createPersistedStore<string>({ key: 'k', defaultValue: () => 'def' });
    s.setStorage(store);
    s.write('value');
    expect(store.store.has('k')).toBe(true);
    s.clear();
    expect(store.store.has('k')).toBe(false);
    expect(s.read()).toBe('def');
  });

  it('invalidates the in-memory cache when storage is mutated externally', () => {
    const store = memoryStorage();
    const s = createPersistedStore<string>({ key: 'k', defaultValue: () => 'def' });
    s.setStorage(store);
    s.write('first');
    expect(s.read()).toBe('first');
    // External mutation — simulates another tab or a test calling localStorage.clear().
    store.store.delete('k');
    expect(s.read()).toBe('def');
    store.store.set('k', JSON.stringify('updated'));
    expect(s.read()).toBe('updated');
  });

  it('uses parse() to coerce / validate raw JSON', () => {
    const store = memoryStorage();
    store.store.set('k', JSON.stringify(['x', 1, 'y'])); // mixed types
    const s = createPersistedStore<string[]>({
      key: 'k',
      defaultValue: () => [],
      parse: (raw) => Array.isArray(raw) ? raw.filter((v): v is string => typeof v === 'string') : [],
    });
    s.setStorage(store);
    expect(s.read()).toEqual(['x', 'y']);
  });

  it('falls back to default on corrupt JSON', () => {
    const store = memoryStorage();
    store.store.set('k', '{not-json');
    const s = createPersistedStore<number>({ key: 'k', defaultValue: () => 7 });
    s.setStorage(store);
    expect(s.read()).toBe(7);
  });

  it('emits persistence:error when setItem throws (quota)', () => {
    const failing: KVStorage = {
      getItem: () => null,
      setItem: () => { throw new Error('QuotaExceeded'); },
      removeItem: () => {},
    };
    const s = createPersistedStore<number>({ key: 'k', defaultValue: () => 0 });
    s.setStorage(failing);
    const listener = vi.fn();
    eventBus.on('persistence:error', listener);
    s.write(1);
    expect(listener).toHaveBeenCalledWith('k', 'QuotaExceeded');
  });

  it('keeps the in-session value visible to read() when write fails (no cache mismatch)', () => {
    // Storage that returns the previously-stored value for getItem but
    // throws on setItem. Without the cache-on-success guard, the cached
    // raw would no longer match the stored raw, so the next read() would
    // discard the in-memory write and revert to the previous value.
    let stored: string | null = null;
    const flaky: KVStorage = {
      getItem: () => stored,
      setItem: () => { throw new Error('QuotaExceeded'); },
      removeItem: () => { stored = null; },
    };
    const s = createPersistedStore<number>({ key: 'k', defaultValue: () => 0 });
    s.setStorage(flaky);
    s.write(7);
    expect(s.read()).toBe(7); // cache must still reflect the failed write within this session
    expect(s.read()).toBe(7); // and stay stable across reads
  });

  it('update() applies a transform to the current value', () => {
    const s = createPersistedStore<number>({ key: 'k', defaultValue: () => 1 });
    s.setStorage(memoryStorage());
    s.update((prev) => prev + 41);
    expect(s.read()).toBe(42);
  });

  it('setStorage() invalidates the cache so the new backing is observed', () => {
    const a = memoryStorage();
    const b = memoryStorage();
    a.store.set('k', JSON.stringify('from-a'));
    b.store.set('k', JSON.stringify('from-b'));
    const s = createPersistedStore<string>({ key: 'k', defaultValue: () => 'def' });
    s.setStorage(a);
    expect(s.read()).toBe('from-a');
    s.setStorage(b);
    expect(s.read()).toBe('from-b');
  });
});
