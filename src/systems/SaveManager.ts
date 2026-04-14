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

let storage: KVStorage = localStorage;
let playerSlot = 'default';

export function setStorage(s: KVStorage): void { storage = s; }
export function setPlayerSlot(slot: string): void { playerSlot = slot; }

function key(): string { return `architect_${playerSlot}_v1`; }

export function hasSave(): boolean {
  try { return storage.getItem(key()) !== null; } catch { return false; }
}

export function save(data: SaveData): void {
  try { storage.setItem(key(), JSON.stringify(data)); } catch { /* quota */ }
}

export function load(): SaveData | null {
  try {
    const raw = storage.getItem(key());
    return raw ? JSON.parse(raw) as SaveData : null;
  } catch { return null; }
}

export function clear(): void {
  try { storage.removeItem(key()); } catch { /* noop */ }
}
