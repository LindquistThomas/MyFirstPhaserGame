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

const noopStorage: KVStorage = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
};

function getDefaultStorage(): KVStorage {
  try { return globalThis.localStorage; } catch { return noopStorage; }
}

let storage: KVStorage | null = null;
let playerSlot = 'default';

function getStorage(): KVStorage { return storage ?? (storage = getDefaultStorage()); }

export function setStorage(s: KVStorage): void { storage = s; }
export function setPlayerSlot(slot: string): void { playerSlot = slot; }

function key(): string { return `architect_${playerSlot}_v1`; }

export function hasSave(): boolean {
  try { return getStorage().getItem(key()) !== null; } catch { return false; }
}

export function save(data: SaveData): void {
  try { getStorage().setItem(key(), JSON.stringify(data)); } catch { /* quota */ }
}

export function load(): SaveData | null {
  try {
    const raw = getStorage().getItem(key());
    if (!raw) return null;
    let data = JSON.parse(raw) as Record<string, unknown>;
    let version = typeof data['version'] === 'number' ? (data['version'] as number) : 0;
    while (version < CURRENT_SAVE_VERSION) {
      const migrate = MIGRATIONS[version];
      if (!migrate) break;
      data = migrate(data);
      version++;
    }
    data['version'] = version;
    return data as unknown as SaveData;
  } catch { return null; }
}

export function clear(): void {
  try { getStorage().removeItem(key()); } catch { /* noop */ }
}
