import { eventBus } from './EventBus';
import { FloorId, FLOOR_IDS } from '../config/gameConfig';

/** Pluggable key-value storage. Defaults to localStorage. */
export interface KVStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/** Plain data shape persisted to storage. Floor fields use the same FloorId union as the rest of the game. */
export interface SaveData {
  version: number;
  totalAU: number;
  floorAU: Partial<Record<FloorId, number>>;
  unlockedFloors: FloorId[];
  currentFloor: FloorId;
  collectedTokens: Partial<Record<FloorId, number[]>>;
  /** Set once the player has completed (or explicitly skipped) the onboarding flow. */
  onboardingComplete?: boolean;
  /** Floors the player has entered at least once. Optional for backward-compat. */
  visitedFloors?: FloorId[];
  /** Unix ms timestamp of the last time this save was written. */
  lastPlayedAt?: number;
  /** Total active playtime in milliseconds (pauses excluded). */
  playtimeMs?: number;
  /** Per-floor active playtime in milliseconds. */
  floorPlaytimeMs?: Partial<Record<FloorId, number>>;
  /** Milliseconds from run-start to first boss defeat (set once, never overwritten). */
  firstClearMs?: number;
  /** Best (shortest) run clear time in milliseconds across all runs. */
  bestClearMs?: number;
  /** Unix ms timestamp when the current run was started; absent when not in a run. */
  runStartedAt?: number;
}

/** The three canonical slot IDs shown in the slot picker. */
export const SAVE_SLOTS = ['slot1', 'slot2', 'slot3'] as const;
export type SaveSlotId = (typeof SAVE_SLOTS)[number];

/** Minimal summary used by the slot-picker UI (no slot-switching side-effects). */
export interface SlotInfo {
  slotId: SaveSlotId;
  exists: boolean;
  totalAU?: number;
  currentFloor?: FloorId;
  lastPlayedAt?: number;
  /**
   * True when the slot's previous save was corrupt and has been discarded this
   * session. The slot behaves identically to an empty slot (selectability,
   * fresh-save on entry) but the UI surfaces a "RECOVERED" badge and a
   * recovery dialog so the player understands what happened.
   */
  recovered?: boolean;
}


/** Type guard: returns the value as FloorId if it is a valid floor identifier, otherwise undefined. */
function validateFloorId(value: unknown): FloorId | undefined {
  return typeof value === 'number' && FLOOR_IDS.includes(value as FloorId)
    ? value as FloorId
    : undefined;
}

/** Schema version written by this build. Increment when SaveData shape changes. */
export const CURRENT_SAVE_VERSION = 2;

/**
 * Storage key pattern reference (keep in sync when changing the format):
 *   Primary save  : architect_<slot>_v1         (e.g. architect_slot1_v1)
 *   Forensic copy : architect_<slot>_v1_corrupt  (most-recent corrupt blob per slot)
 *
 * The forensic key is written by discardCorrupt() / discardCorruptForSlot()
 * and is readable via getCorruptBackup(). One fixed key per slot; no timestamp
 * suffix so it can always be found (latest corruption overwrites any previous one).
 */

/**
 * Migration functions keyed by source version. Each receives raw parsed data
 * at that version and returns data compatible with the next version. Applied
 * in ascending order until CURRENT_SAVE_VERSION is reached.
 *
 * v0 → v1: first versioned release; shape is unchanged — just stamps the
 * `version` field that was previously absent.
 *
 * v1 → v2: adds playtime fields (playtimeMs, floorPlaytimeMs) with zero
 * defaults so loading old saves never results in `undefined`.
 *
 * To add a new save version:
 *   1. Bump CURRENT_SAVE_VERSION.
 *   2. Add an entry to MIGRATIONS keyed by the OLD version:
 *        N: (data) => ({ ...data, newField: defaultValue }),
 *   3. Update the SaveData type.
 *   4. Add a unit test for the migration in SaveManager.test.ts.
 */
const MIGRATIONS: Record<number, (data: Record<string, unknown>) => Record<string, unknown>> = {
  0: (d) => d,
  1: (d) => ({ ...d, playtimeMs: 0, floorPlaytimeMs: {} }),
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

/**
 * Session-scoped record of slots whose previous save was found corrupt and
 * discarded. Cleared only when the page is reloaded (module-level state).
 * Key: slot id (e.g. 'slot1'). Value: `{ raw, reason }` where `raw` is the
 * corrupt JSON string (for the Download Backup feature) and `reason` is the
 * failure reason passed to `emitFailed`.
 */
const recoveredSlots = new Map<string, { raw: string; reason: FailureReason }>();

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

export type FailureReason = 'quota' | 'unavailable' | 'parse' | 'unknown';

function emitFailed(reason: FailureReason, err?: unknown): void {
  const detail = err instanceof Error ? err.message : (err != null ? String(err) : undefined);
  console.warn('[SaveManager] persistence:failed', { key: key(), slot: playerSlot, reason, detail });
  eventBus.emit('persistence:failed', { reason, detail, slot: playerSlot });
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

/**
 * Type guard that verifies the parsed JSON object matches the SaveData shape.
 * Required fields are checked for correct type and value; optional fields are
 * validated only when present. Callers should treat a `false` return as
 * corruption.
 */
function isValidSaveData(d: unknown): d is SaveData {
  if (typeof d !== 'object' || d === null) return false;
  const o = d as Record<string, unknown>;
  if (typeof o['version'] !== 'number') return false;
  // totalAU < 0 is structurally impossible in valid saves; treat it as corruption
  // rather than deferring to ProgressionSystem which would persist the bad value.
  if (typeof o['totalAU'] !== 'number' || o['totalAU'] < 0) return false;
  if (typeof o['currentFloor'] !== 'number') return false;
  if (!Array.isArray(o['unlockedFloors'])) return false;
  if (!(o['unlockedFloors'] as unknown[]).every((n) => typeof n === 'number')) return false;
  if (typeof o['floorAU'] !== 'object' || o['floorAU'] === null || Array.isArray(o['floorAU'])) return false;
  // floorAU values must all be finite numbers (ProgressionSystem treats them as such).
  if (!Object.values(o['floorAU'] as object).every((v) => typeof v === 'number' && isFinite(v))) return false;
  if (typeof o['collectedTokens'] !== 'object' || o['collectedTokens'] === null || Array.isArray(o['collectedTokens'])) return false;
  // collectedTokens values must be arrays of numbers (consumed via new Set(…) in ProgressionSystem).
  if (!Object.values(o['collectedTokens'] as object).every(
    (v) => Array.isArray(v) && (v as unknown[]).every((n) => typeof n === 'number'),
  )) return false;
  // Optional fields: only validated if present.
  if (o['onboardingComplete'] !== undefined && typeof o['onboardingComplete'] !== 'boolean') return false;
  if (o['visitedFloors'] !== undefined) {
    if (!Array.isArray(o['visitedFloors'])) return false;
    if (!(o['visitedFloors'] as unknown[]).every((n) => typeof n === 'number')) return false;
  }
  if (o['lastPlayedAt'] !== undefined && typeof o['lastPlayedAt'] !== 'number') return false;
  if (o['playtimeMs'] !== undefined && typeof o['playtimeMs'] !== 'number') return false;
  if (o['floorPlaytimeMs'] !== undefined) {
    if (typeof o['floorPlaytimeMs'] !== 'object' || o['floorPlaytimeMs'] === null || Array.isArray(o['floorPlaytimeMs'])) return false;
    if (!Object.values(o['floorPlaytimeMs'] as object).every((v) => typeof v === 'number' && isFinite(v))) return false;
  }
  if (o['firstClearMs'] !== undefined && typeof o['firstClearMs'] !== 'number') return false;
  if (o['bestClearMs'] !== undefined && typeof o['bestClearMs'] !== 'number') return false;
  if (o['runStartedAt'] !== undefined && typeof o['runStartedAt'] !== 'number') return false;
  return true;
}

/**
 * Stash a forensic copy of raw save data under a fixed per-slot key and remove
 * the corrupt primary key so the next boot gets a clean slot.
 * Records the slot in the session-scoped recoveredSlots map.
 */
function discardCorrupt(raw: string): void {
  discardCorruptForSlot(playerSlot, raw, 'parse');
}

/**
 * Slot-agnostic variant of discardCorrupt used by loadSlotInfo, which reads
 * slots that may differ from the currently active playerSlot.
 */
function discardCorruptForSlot(slotId: string, raw: string, reason: FailureReason = 'parse'): void {
  const slotKey = `architect_${slotId}_v1`;
  const corruptKey = `${slotKey}_corrupt`;
  try { getStorage().setItem(corruptKey, raw); } catch { /* noop */ }
  try { getStorage().removeItem(slotKey); } catch { /* noop */ }
  recoveredSlots.set(slotId, { raw, reason });
}

/**
 * Returns the raw corrupt JSON string stashed by discardCorrupt for the given
 * slot during this session, or null if none exists. Used by SaveRecoveryDialog
 * to offer a "Download backup" file to the player.
 */
export function getCorruptBackup(slotId: SaveSlotId): string | null {
  return recoveredSlots.get(slotId)?.raw ?? null;
}

/**
 * Returns the failure reason stored when the corrupt save was discarded, or
 * 'parse' as a safe default. Used by SaveRecoveryDialog to show a tailored
 * human-readable explanation.
 */
export function getRecoveryReason(slotId: SaveSlotId): FailureReason {
  return recoveredSlots.get(slotId)?.reason ?? 'parse';
}

/**
 * Returns true if the given slot had a corrupt save discarded this session.
 * SaveSlotScene uses this to show a "RECOVERED" badge on the slot card.
 */
export function wasSlotRecovered(slotId: SaveSlotId): boolean {
  return recoveredSlots.has(slotId);
}

/**
 * Remove the recovered-slot sentinel for slotId.
 * Call this when the player has dismissed the recovery dialog so the dialog
 * does not reappear if SaveSlotScene is revisited in the same session.
 */
export function clearRecoveredSlot(slotId: SaveSlotId): void {
  recoveredSlots.delete(slotId);
}

/**
 * Parse and fully validate a raw save string (migrations + schema guard).
 * Returns the validated SaveData on success, or null if the data is invalid.
 * Has no side-effects: callers are responsible for cleanup and event emission.
 */
function parseAndValidateSave(raw: string): SaveData | null {
  try {
    let data = JSON.parse(raw) as Record<string, unknown>;
    const rawVersion = data['version'];
    let version = 0;
    if (typeof rawVersion === 'number') {
      if (!Number.isInteger(rawVersion) || rawVersion < 0) return null;
      version = rawVersion;
    }
    while (version < CURRENT_SAVE_VERSION) {
      const migrate = MIGRATIONS[version];
      if (!migrate) return null;
      data = migrate(data);
      version++;
    }
    data['version'] = version;
    return isValidSaveData(data) ? data : null;
  } catch {
    return null;
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

  const validated = parseAndValidateSave(raw);
  if (!validated) {
    // Stash a forensic copy so the corruption can be diagnosed later, then
    // remove the bad key so the player gets a clean slot on next boot.
    discardCorrupt(raw);
    emitFailed('parse', new Error('Save data is corrupt or failed schema validation'));
    return null;
  }
  return validated;
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
 * Returns `exists: false` for any slot whose data would be rejected by load()
 * (corrupt JSON, missing required fields, failed schema validation).
 * When corrupt data is found, stashes a forensic copy and sets `recovered: true`.
 */
export function loadSlotInfo(slotId: SaveSlotId): SlotInfo {
  checkUnavailable();
  const slotKey = `architect_${slotId}_v1`;
  let raw: string | null = null;
  try { raw = getStorage().getItem(slotKey); } catch { /* ignore */ }
  if (!raw) return { slotId, exists: false, recovered: recoveredSlots.has(slotId) };
  const data = parseAndValidateSave(raw);
  if (!data) {
    // Corrupt data — stash forensic copy (adds the `_corrupt` key), mark slot as
    // recovered for this session, then remove the primary save key so the slot
    // picker treats it as empty.
    discardCorruptForSlot(slotId, raw);
    return { slotId, exists: false, recovered: true };
  }
  return {
    slotId,
    exists: true,
    totalAU: data.totalAU,
    currentFloor: validateFloorId(data.currentFloor),
    lastPlayedAt: data.lastPlayedAt,
  };
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
