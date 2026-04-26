import { eventBus } from './EventBus';

/** Pluggable key-value storage. Defaults to localStorage. */
export interface KVStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/** Plain data shape — no game-type imports. */
export interface SaveData {
  version: number;
  totalAU: number;
  floorAU: Record<number, number>;
  unlockedFloors: number[];
  currentFloor: number;
  collectedTokens: Record<number, number[]>;
  /** Set once the player has completed (or explicitly skipped) the onboarding flow. */
  onboardingComplete?: boolean;
  /** Floors the player has entered at least once. Optional for backward-compat. */
  visitedFloors?: number[];
  /** Unix ms timestamp of the last time this save was written. */
  lastPlayedAt?: number;
}

/** The three canonical slot IDs shown in the slot picker. */
export const SAVE_SLOTS = ['slot1', 'slot2', 'slot3'] as const;
export type SaveSlotId = (typeof SAVE_SLOTS)[number];

/** Minimal summary used by the slot-picker UI (no slot-switching side-effects). */
export interface SlotInfo {
  slotId: SaveSlotId;
  exists: boolean;
  totalAU?: number;
  currentFloor?: number;
  lastPlayedAt?: number;
}


/** Schema version written by this build. Increment when SaveData shape changes. */
export const CURRENT_SAVE_VERSION = 1;

/**
 * Migration functions keyed by source version. Each receives raw parsed data
 * at that version and returns data compatible with the next version. Applied
 * in ascending order until CURRENT_SAVE_VERSION is reached.
 *
 * v0 → v1: first versioned release; shape is unchanged — just stamps the
 * `version` field that was previously absent.
 */
const MIGRATIONS: Record<number, (data: Record<string, unknown>) => Record<string, unknown>> = {
  0: (d) => d,
};


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
    let data = JSON.parse(raw) as Record<string, unknown>;
    // Saves written before versioning was introduced have no `version` field → treat as v0.
    // Non-integer or negative values are invalid; return null rather than guess.
    const rawVersion = data['version'];
    let version = 0;
    if (typeof rawVersion === 'number') {
      if (!Number.isInteger(rawVersion) || rawVersion < 0) return null;
      version = rawVersion;
    }
    while (version < CURRENT_SAVE_VERSION) {
      const migrate = MIGRATIONS[version];
      // A missing migration entry is a developer error — throw so the outer catch
      // returns null rather than silently serving partially-migrated data.
      if (!migrate) throw new Error(`No migration found for save version ${version}`);
      data = migrate(data);
      version++;
    }
    // Stamp the final version so the returned object always has an up-to-date field.
    data['version'] = version;
    return data as unknown as SaveData;
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

/**
 * Read summary information for a specific slot without changing the active
 * slot. Safe to call during the slot-picker UI before the player has chosen.
 */
export function loadSlotInfo(slotId: SaveSlotId): SlotInfo {
  checkUnavailable();
  const slotKey = `architect_${slotId}_v1`;
  let raw: string | null = null;
  try { raw = getStorage().getItem(slotKey); } catch { /* ignore */ }
  if (!raw) return { slotId, exists: false };
  try {
    const data = JSON.parse(raw) as Record<string, unknown>;
    return {
      slotId,
      exists: true,
      totalAU: typeof data['totalAU'] === 'number' ? data['totalAU'] : undefined,
      currentFloor: typeof data['currentFloor'] === 'number' ? data['currentFloor'] : undefined,
      lastPlayedAt: typeof data['lastPlayedAt'] === 'number' ? data['lastPlayedAt'] : undefined,
    };
  } catch {
    // Corrupt data — treat as absent so the slot picker shows "EMPTY" and
    // SaveSlotScene won't pass loadSave:true to a slot that can't be loaded.
    return { slotId, exists: false };
  }
}

/**
 * One-time migration: if `architect_default_v1` exists and `architect_slot1_v1`
 * does not, copy the default save into slot1 and remove the old key.
 * Returns `true` if a migration was performed.
 */
export function migrateDefaultSlot(): boolean {
  checkUnavailable();
  const defaultKey = 'architect_default_v1';
  const slot1Key = 'architect_slot1_v1';
  let existing: string | null = null;
  try { existing = getStorage().getItem(defaultKey); } catch { return false; }
  if (!existing) return false;
  let slot1: string | null = null;
  try { slot1 = getStorage().getItem(slot1Key); } catch { return false; }
  if (slot1 !== null) {
    // slot1 already has data — preserve it; leave the legacy key in place
    // so the player's old save is not silently discarded.
    return false;
  }
  try {
    getStorage().setItem(slot1Key, existing);
    getStorage().removeItem(defaultKey);
    return true;
  } catch {
    return false;
  }
}

/** Delete a specific slot by id without changing the currently active slot. */
export function clearSlot(slotId: SaveSlotId): void {
  checkUnavailable();
  const slotKey = `architect_${slotId}_v1`;
  try { getStorage().removeItem(slotKey); } catch (err) {
    const detail = err instanceof Error ? err.message : (err != null ? String(err) : undefined);
    console.warn('[SaveManager] Failed to clear save slot', { slotId, slotKey, detail });
    eventBus.emit('persistence:failed', { reason: 'unknown' as const, detail });
  }
}
