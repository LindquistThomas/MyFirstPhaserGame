import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  isReducedMotion,
  setReducedMotionOverride,
  getReducedMotionOverride,
  _setMotionStorageForTest,
} from './MotionPreference';
import type { KVStorage } from './SaveManager';

function makeFakeStorage(): { storage: KVStorage; data: Record<string, string> } {
  const data: Record<string, string> = {};
  const storage: KVStorage = {
    getItem: (k) => data[k] ?? null,
    setItem: (k, v) => { data[k] = v; },
    removeItem: (k) => { delete data[k]; },
  };
  return { storage, data };
}

describe('MotionPreference', () => {
  let fake: ReturnType<typeof makeFakeStorage>;

  beforeEach(() => {
    fake = makeFakeStorage();
    _setMotionStorageForTest(fake.storage);
    // Reset to "no override" state
    setReducedMotionOverride(null);
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('system preference (no override)', () => {
    it('returns true when system prefers reduced motion', () => {
      vi.spyOn(window, 'matchMedia').mockReturnValue({ matches: true } as MediaQueryList);
      setReducedMotionOverride(null);
      expect(isReducedMotion()).toBe(true);
    });

    it('returns false when system has no preference', () => {
      vi.spyOn(window, 'matchMedia').mockReturnValue({ matches: false } as MediaQueryList);
      setReducedMotionOverride(null);
      expect(isReducedMotion()).toBe(false);
    });

    it('returns false gracefully when matchMedia throws', () => {
      vi.spyOn(window, 'matchMedia').mockImplementation(() => { throw new Error('no mq'); });
      setReducedMotionOverride(null);
      expect(isReducedMotion()).toBe(false);
    });
  });

  describe('user override', () => {
    it('override=true wins over system=false', () => {
      vi.spyOn(window, 'matchMedia').mockReturnValue({ matches: false } as MediaQueryList);
      setReducedMotionOverride(true);
      expect(isReducedMotion()).toBe(true);
    });

    it('override=false wins over system=true', () => {
      vi.spyOn(window, 'matchMedia').mockReturnValue({ matches: true } as MediaQueryList);
      setReducedMotionOverride(false);
      expect(isReducedMotion()).toBe(false);
    });

    it('null override reverts to system preference', () => {
      vi.spyOn(window, 'matchMedia').mockReturnValue({ matches: true } as MediaQueryList);
      setReducedMotionOverride(false);
      setReducedMotionOverride(null);
      expect(isReducedMotion()).toBe(true);
    });
  });

  describe('getReducedMotionOverride', () => {
    it('returns null by default', () => {
      expect(getReducedMotionOverride()).toBeNull();
    });

    it('returns the set value', () => {
      setReducedMotionOverride(true);
      expect(getReducedMotionOverride()).toBe(true);
    });

    it('returns null after clearing the override', () => {
      setReducedMotionOverride(true);
      setReducedMotionOverride(null);
      expect(getReducedMotionOverride()).toBeNull();
    });
  });

  describe('persistence', () => {
    it('persists override across a fresh read from storage', () => {
      setReducedMotionOverride(true);
      // Re-inject same storage to simulate a fresh module read
      _setMotionStorageForTest(fake.storage);
      expect(isReducedMotion()).toBe(true);
    });
  });
});
