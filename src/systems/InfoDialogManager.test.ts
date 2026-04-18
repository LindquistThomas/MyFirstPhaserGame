import { describe, it, expect, beforeEach } from 'vitest';
import { hasBeenSeen, markSeen, resetAll } from './InfoDialogManager';

const STORAGE_KEY = 'architect_info_seen_v1';

describe('InfoDialogManager', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('hasBeenSeen returns false before anything is marked', () => {
    expect(hasBeenSeen('x')).toBe(false);
  });

  it('markSeen persists to localStorage and hasBeenSeen returns true afterwards', () => {
    markSeen('x');
    expect(hasBeenSeen('x')).toBe(true);
    const raw = localStorage.getItem(STORAGE_KEY);
    expect(raw).not.toBeNull();
    expect(JSON.parse(raw!)).toContain('x');
  });

  it('tracks multiple IDs independently', () => {
    markSeen('alpha');
    markSeen('beta');
    expect(hasBeenSeen('alpha')).toBe(true);
    expect(hasBeenSeen('beta')).toBe(true);
    expect(hasBeenSeen('gamma')).toBe(false);
  });

  it('resetAll clears stored state', () => {
    markSeen('x');
    markSeen('y');
    resetAll();
    expect(hasBeenSeen('x')).toBe(false);
    expect(hasBeenSeen('y')).toBe(false);
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('handles corrupt JSON in localStorage gracefully', () => {
    localStorage.setItem(STORAGE_KEY, '{not-valid-json');
    expect(() => hasBeenSeen('x')).not.toThrow();
    expect(hasBeenSeen('x')).toBe(false);
    expect(() => markSeen('x')).not.toThrow();
    // After markSeen, the corrupt value should have been overwritten.
    expect(hasBeenSeen('x')).toBe(true);
  });

  it('markSeen is idempotent — marking the same id twice keeps a single entry', () => {
    markSeen('x');
    markSeen('x');
    const raw = localStorage.getItem(STORAGE_KEY);
    const arr = JSON.parse(raw!) as string[];
    expect(arr.filter(id => id === 'x')).toHaveLength(1);
  });
});
