import type * as Phaser from 'phaser';

export const DAILY_RESULTS_KEY = 'architect_daily_results_v1';
export const DAILY_MODE_REGISTRY_KEY = 'dailyChallenge';

export interface DailyChallengeState {
  dateKey: string;
  seed: number;
  slotId: string;
}

export function getUtcDateKey(now: Date = new Date()): string {
  const y = now.getUTCFullYear().toString().padStart(4, '0');
  const m = (now.getUTCMonth() + 1).toString().padStart(2, '0');
  const d = now.getUTCDate().toString().padStart(2, '0');
  return `${y}${m}${d}`;
}

export function dateKeyToSeed(dateKey: string): number {
  const parsed = Number.parseInt(dateKey, 10);
  return Number.isFinite(parsed) ? parsed >>> 0 : 0;
}

export function buildDailySlotId(dateKey: string): string {
  return `daily_${dateKey}`;
}

export function getCurrentDailyState(now: Date = new Date()): DailyChallengeState {
  const dateKey = getUtcDateKey(now);
  return {
    dateKey,
    seed: dateKeyToSeed(dateKey),
    slotId: buildDailySlotId(dateKey),
  };
}

export function msUntilNextUtcMidnight(now: Date = new Date()): number {
  const nextMidnightMs = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate() + 1,
    0,
    0,
    0,
    0,
  );
  return Math.max(1, nextMidnightMs - now.getTime());
}

export function formatDailyDateLabel(dateKey: string): string {
  if (!/^\d{8}$/.test(dateKey)) return `${dateKey} UTC`;
  return `${dateKey.slice(0, 4)}-${dateKey.slice(4, 6)}-${dateKey.slice(6, 8)} UTC`;
}

export function getDailyState(registry: Phaser.Data.DataManager): DailyChallengeState | null {
  const state = registry.get(DAILY_MODE_REGISTRY_KEY) as DailyChallengeState | undefined;
  if (!state) return null;
  if (!state.dateKey || !state.slotId) return null;
  return state;
}

export function setDailyState(
  registry: Phaser.Data.DataManager,
  state: DailyChallengeState | null,
): void {
  if (state === null) {
    registry.remove(DAILY_MODE_REGISTRY_KEY);
    return;
  }
  registry.set(DAILY_MODE_REGISTRY_KEY, state);
}

export function shiftDateKeyUtc(dateKey: string, offsetDays: number): string {
  if (!/^\d{8}$/.test(dateKey)) return dateKey;
  const y = Number.parseInt(dateKey.slice(0, 4), 10);
  const m = Number.parseInt(dateKey.slice(4, 6), 10);
  const d = Number.parseInt(dateKey.slice(6, 8), 10);
  const shifted = new Date(Date.UTC(y, m - 1, d + offsetDays));
  return getUtcDateKey(shifted);
}

