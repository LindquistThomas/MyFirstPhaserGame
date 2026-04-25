import { eventBus } from './EventBus';

/** Pluggable key-value storage. Defaults to localStorage. */
export interface KVStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/** Plain data shape — no game-type imports. */
export interface SaveData {
  totalAU: number;
  floorAU: Record<number, number>;
  unlockedFloors: number[];
  currentFloor: number;
  collectedTokens: Record<number, number[]>;
}

export const noopStorage: KVStorage = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
};

function getDefaultStorage(): KVStorage {
  try { return globalThis.localStorage; } catch { return noopStorage; }
}

let storage: KVStorage | null = null;
let playerSlot = 'default';
let unavailableEmitted = false;

function getStorage(): KVStorage { return storage ?? (storage = getDefaultStorage()); }

export function setStorage(s: KVStorage): void { storage = s; unavailableEmitted = false; }
export function setPlayerSlot(slot: string): void { playerSlot = slot; }

function key(): string { return `architect_${playerSlot}_v1`; }

function isQuotaError(err: unknown): boolean {
  if (err instanceof DOMException) {
    return err.name === 'QuotaExceededError' || err.code === 22;
  }
  return false;
}

type FailureReason = 'quota' | 'unavailable' | 'parse' | 'unknown';

function emitFailed(reason: FailureReason, err?: unknown): void {
  const detail = err instanceof Error ? err.message : (err != null ? String(err) : undefined);
  console.warn('[SaveManager] persistence:failed', { key: key(), slot: playerSlot, reason, detail });
  eventBus.emit('persistence:failed', { reason, detail });
}

/** Emits `persistence:failed` with reason `unavailable` the first time noop storage is detected. */
function checkUnavailable(): void {
  if (getStorage() === noopStorage && !unavailableEmitted) {
    unavailableEmitted = true;
    emitFailed('unavailable');
  }
}

export function hasSave(): boolean {
  checkUnavailable();
  try { return getStorage().getItem(key()) !== null; } catch (err) {
    emitFailed('unknown', err);
    return false;
  }
}

export function save(data: SaveData): void {
  checkUnavailable();
  try { getStorage().setItem(key(), JSON.stringify(data)); } catch (err) {
    emitFailed(isQuotaError(err) ? 'quota' : 'unknown', err);
  }
}

export function load(): SaveData | null {
  checkUnavailable();
  let raw: string | null;
  try {
    raw = getStorage().getItem(key());
  } catch (err) {
    emitFailed('unknown', err);
    return null;
  }
  if (!raw) return null;
  try {
    return JSON.parse(raw) as SaveData;
  } catch (err) {
    emitFailed('parse', err);
    return null;
  }
}

export function clear(): void {
  checkUnavailable();
  try { getStorage().removeItem(key()); } catch (err) {
    emitFailed('unknown', err);
  }
}
