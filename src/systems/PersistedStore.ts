/**
 * Generic JSON-backed key/value store factory.
 *
 * Wraps a single localStorage key with an in-memory cache and defensive
 * try/catch on quota errors, corrupt JSON, and unavailable storage.
 *
 * **Error semantics**: `persistence:error` is emitted from the WRITE path
 * only (quota / unavailable storage / unserialisable value). Read failures
 * (corrupt JSON in storage, getItem throwing) silently fall back to
 * `defaultValue` — they typically resolve themselves on the next
 * successful write, and emitting on every read would spam the bus.
 *
 * Replaces the ad-hoc try/catch + JSON.parse pattern that was duplicated
 * across QuizManager, InfoDialogManager, and AudioManager.
 *
 * `SaveManager` keeps its own implementation because of its slot-keyed
 * shape (`architect_<slot>_v1`); it shares the `KVStorage` interface
 * exported from there.
 */

import { eventBus } from './EventBus';
import type { KVStorage } from './SaveManager';

const noopStorage: KVStorage = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
};

function defaultStorage(): KVStorage {
  try { return globalThis.localStorage; } catch { return noopStorage; }
}

export interface PersistedStore<T> {
  /** Returns the current value, parsing from storage on a cache miss. */
  read(): T;
  /** Persists `value` and updates the cache. Errors are emitted via `persistence:error`. */
  write(value: T): void;
  /** Convenience: read, transform, write. */
  update(fn: (prev: T) => T): void;
  /** Removes the persisted entry and resets the cache to default. */
  clear(): void;
  /** Test seam — replace the underlying storage and invalidate the cache. */
  setStorage(s: KVStorage): void;
}

export interface PersistedStoreOptions<T> {
  key: string;
  defaultValue: () => T;
  /** Validate / migrate raw JSON-decoded value into T. Defaults to identity cast. */
  parse?: (raw: unknown) => T;
  /** Convert T into a JSON-safe value before stringify. Defaults to identity. */
  serialise?: (value: T) => unknown;
}

export function createPersistedStore<T>(opts: PersistedStoreOptions<T>): PersistedStore<T> {
  let storage: KVStorage | null = null;
  // Cache the raw string alongside the parsed value so external storage
  // mutations (e.g. tests calling localStorage.clear()) auto-invalidate.
  let cache: { raw: string | null; value: T } | null = null;

  const getStorage = (): KVStorage => storage ?? (storage = defaultStorage());
  const parse = opts.parse ?? ((raw: unknown) => raw as T);
  const serialise = opts.serialise ?? ((v: T) => v as unknown);

  const reportError = (err: unknown): void => {
    const message = err instanceof Error ? err.message : String(err);
    eventBus.emit('persistence:error', opts.key, message);
  };

  return {
    read(): T {
      let raw: string | null;
      try { raw = getStorage().getItem(opts.key); }
      catch { raw = null; }
      if (cache && cache.raw === raw) return cache.value;
      let value: T;
      if (raw == null) {
        value = opts.defaultValue();
      } else {
        try { value = parse(JSON.parse(raw)); }
        catch { value = opts.defaultValue(); }
      }
      cache = { raw, value };
      return value;
    },
    write(value: T): void {
      let raw: string;
      try { raw = JSON.stringify(serialise(value)); }
      catch (err) { reportError(err); return; }
      const previousRaw = cache?.raw ?? null;
      try {
        getStorage().setItem(opts.key, raw);
        cache = { raw, value };
      } catch (err) {
        // Persisted write failed (quota / storage unavailable). Keep the
        // new value visible to in-session reads, but pin cache.raw to the
        // pre-write storage value so subsequent reads still hit the cache
        // (otherwise the raw mismatch would discard the in-memory update).
        cache = { raw: previousRaw, value };
        reportError(err);
      }
    },
    update(fn: (prev: T) => T): void {
      this.write(fn(this.read()));
    },
    clear(): void {
      cache = null;
      try { getStorage().removeItem(opts.key); } catch { /* noop */ }
    },
    setStorage(s: KVStorage): void {
      storage = s;
      cache = null;
    },
  };
}
