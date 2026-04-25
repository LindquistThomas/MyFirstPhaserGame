import type { KVStorage } from './SaveManager';
import { createPersistedStore } from './PersistedStore';

const STORAGE_KEY = 'architect_info_seen_v1';

const store = createPersistedStore<string[]>({
  key: STORAGE_KEY,
  defaultValue: () => [],
  parse: (raw) => (Array.isArray(raw) ? raw.filter((x): x is string => typeof x === 'string') : []),
});

export function setStorage(s: KVStorage): void { store.setStorage(s); }

export function hasBeenSeen(id: string): boolean {
  return store.read().includes(id);
}

/** True once the player has opened at least one info dialog. */
export function hasSeenAny(): boolean {
  return store.read().length > 0;
}

/** Returns all IDs that have been marked as seen. */
export function getSeenIds(): string[] {
  return store.read();
}

export function markSeen(id: string): void {
  store.update((prev) => (prev.includes(id) ? prev : [...prev, id]));
}

export function resetAll(): void {
  store.clear();
}
