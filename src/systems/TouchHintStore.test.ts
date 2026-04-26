import { describe, it, expect, beforeEach } from 'vitest';
import { hasSeen, markSeen, clearSeen, setStorage } from './TouchHintStore';
import type { KVStorage } from './SaveManager';

function memStorage(): KVStorage & { data: Record<string, string> } {
  const data: Record<string, string> = {};
  return {
    data,
    getItem:    (key) => data[key] ?? null,
    setItem:    (key, value) => { data[key] = value; },
    removeItem: (key) => { delete data[key]; },
  };
}

describe('TouchHintStore', () => {
  let storage: ReturnType<typeof memStorage>;

  beforeEach(() => {
    storage = memStorage();
    setStorage(storage);
  });

  it('hasSeen() returns false when no flag is stored', () => {
    expect(hasSeen()).toBe(false);
  });

  it('markSeen() persists true and hasSeen() returns true', () => {
    markSeen();
    expect(hasSeen()).toBe(true);
    expect(storage.data['architect_touch_hint_seen_v1']).toBe('true');
  });

  it('clearSeen() removes the flag and hasSeen() returns false again', () => {
    markSeen();
    clearSeen();
    expect(hasSeen()).toBe(false);
    expect(storage.data['architect_touch_hint_seen_v1']).toBeUndefined();
  });

  it('hasSeen() is false when stored value is malformed', () => {
    storage.data['architect_touch_hint_seen_v1'] = 'notjson{{{';
    expect(hasSeen()).toBe(false);
  });

  it('hasSeen() is false when stored value is "false"', () => {
    storage.data['architect_touch_hint_seen_v1'] = 'false';
    expect(hasSeen()).toBe(false);
  });

  it('markSeen() is idempotent', () => {
    markSeen();
    markSeen();
    expect(hasSeen()).toBe(true);
  });
});
