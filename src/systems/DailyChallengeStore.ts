import { createPersistedStore } from './PersistedStore';
import { DAILY_RESULTS_KEY, getUtcDateKey, shiftDateKeyUtc } from './DailyChallenge';
import type { KVStorage } from './SaveManager';

export interface DailyResult {
  runMs: number;
}

type DailyResultsMap = Record<string, DailyResult>;

const store = createPersistedStore<DailyResultsMap>({
  key: DAILY_RESULTS_KEY,
  defaultValue: () => ({}),
  parse: (raw) => {
    if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return {};
    const out: DailyResultsMap = {};
    for (const [k, v] of Object.entries(raw)) {
      if (!/^\d{8}$/.test(k)) continue;
      if (typeof v !== 'object' || v === null) continue;
      const runMs = (v as { runMs?: unknown }).runMs;
      if (typeof runMs !== 'number' || !Number.isFinite(runMs) || runMs <= 0) continue;
      out[k] = { runMs };
    }
    return out;
  },
});

export function getResult(dateKey: string): DailyResult | undefined {
  return store.read()[dateKey];
}

export function recordResult(dateKey: string, runMs: number): boolean {
  if (!Number.isFinite(runMs) || runMs <= 0) return false;
  let improved = false;
  store.update((prev) => {
    const existing = prev[dateKey];
    if (!existing || runMs < existing.runMs) {
      improved = true;
      return { ...prev, [dateKey]: { runMs: Math.floor(runMs) } };
    }
    return prev;
  });
  return improved;
}

export function getRecentResults(days: number, now: Date = new Date()): Array<{ dateKey: string; runMs?: number }> {
  const dateKey = getUtcDateKey(now);
  const all = store.read();
  const out: Array<{ dateKey: string; runMs?: number }> = [];
  for (let i = 0; i < days; i++) {
    const key = shiftDateKeyUtc(dateKey, -i);
    out.push({ dateKey: key, runMs: all[key]?.runMs });
  }
  return out;
}

export function getCompletionStreakEndingAt(dateKey: string): number {
  const all = store.read();
  let streak = 0;
  for (let i = 0; i < 365; i++) {
    const key = shiftDateKeyUtc(dateKey, -i);
    if (!all[key]) break;
    streak++;
  }
  return streak;
}

export function setStorage(storage: KVStorage): void {
  store.setStorage(storage);
}
