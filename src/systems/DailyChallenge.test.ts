import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  dateKeyToSeed,
  formatDailyDateLabel,
  getUtcDateKey,
  msUntilNextUtcMidnight,
  shiftDateKeyUtc,
} from './DailyChallenge';

describe('DailyChallenge date helpers', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('uses UTC day for date key', () => {
    expect(getUtcDateKey(new Date('2026-05-08T23:59:59Z'))).toBe('20260508');
    expect(getUtcDateKey(new Date('2026-05-09T00:00:00Z'))).toBe('20260509');
  });

  it('refreshes to the next UTC day at midnight boundary', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-08T23:59:59.000Z'));
    expect(getUtcDateKey()).toBe('20260508');

    vi.setSystemTime(new Date('2026-05-09T00:00:00.000Z'));
    expect(getUtcDateKey()).toBe('20260509');
  });

  it('computes ms until next UTC midnight', () => {
    const now = new Date('2026-05-08T23:59:58.500Z');
    expect(msUntilNextUtcMidnight(now)).toBe(1500);
  });

  it('formats and shifts date keys', () => {
    expect(formatDailyDateLabel('20260508')).toBe('2026-05-08 UTC');
    expect(shiftDateKeyUtc('20260508', -1)).toBe('20260507');
    expect(dateKeyToSeed('20260508')).toBe(20260508);
  });
});

