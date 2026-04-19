import type { KVStorage } from './SaveManager';

const STORAGE_KEY = 'architect_info_seen_v1';

let storage: KVStorage | null = null;

export function setStorage(s: KVStorage): void { storage = s; }

function getStorage(): KVStorage {
  if (storage) return storage;
  try { storage = globalThis.localStorage; return storage; }
  catch { return { getItem: () => null, setItem: () => {}, removeItem: () => {} }; }
}

function loadSeen(): Set<string> {
  try {
    const raw = getStorage().getItem(STORAGE_KEY);
    return raw ? new Set(JSON.parse(raw) as string[]) : new Set();
  } catch { return new Set(); }
}

function persist(seen: Set<string>): void {
  try { getStorage().setItem(STORAGE_KEY, JSON.stringify([...seen])); } catch { /* */ }
}

export function hasBeenSeen(id: string): boolean {
  return loadSeen().has(id);
}

export function markSeen(id: string): void {
  const seen = loadSeen();
  seen.add(id);
  persist(seen);
}

export function resetAll(): void {
  try { getStorage().removeItem(STORAGE_KEY); } catch { /* */ }
}
