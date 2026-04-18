import { describe, it, expect } from 'vitest';
import { INFO_POINTS } from './index';
import { FLOORS } from '../gameConfig';

describe('INFO_POINTS', () => {
  const entries = Object.entries(INFO_POINTS);
  const validFloorIds = new Set<number>(Object.values(FLOORS));

  it('is non-empty', () => {
    expect(entries.length).toBeGreaterThan(0);
  });

  it('has unique record keys (no duplicate info ids)', () => {
    const keys = entries.map(([k]) => k);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('has inner content.id that matches the record key for every entry', () => {
    for (const [key, def] of entries) {
      expect(def.content.id).toBe(key);
    }
  });

  it('has a valid floorId for every entry', () => {
    for (const [, def] of entries) {
      expect(validFloorIds.has(def.floorId)).toBe(true);
    }
  });

  it('has non-empty title and body for every entry', () => {
    for (const [, def] of entries) {
      expect(typeof def.content.title).toBe('string');
      expect(def.content.title.trim().length).toBeGreaterThan(0);
      expect(typeof def.content.body).toBe('string');
      expect(def.content.body.trim().length).toBeGreaterThan(0);
    }
  });

  it('has non-empty label and url for every link, when links are provided', () => {
    for (const [, def] of entries) {
      if (!def.content.links) continue;
      for (const link of def.content.links) {
        expect(typeof link.label).toBe('string');
        expect(link.label.trim().length).toBeGreaterThan(0);
        expect(typeof link.url).toBe('string');
        expect(link.url.trim().length).toBeGreaterThan(0);
        // A sanity check — link must look URL-ish (protocol scheme).
        expect(link.url).toMatch(/^https?:\/\//);
      }
    }
  });

  it('has non-empty title and body when extendedInfo is provided', () => {
    for (const [, def] of entries) {
      if (!def.content.extendedInfo) continue;
      expect(typeof def.content.extendedInfo.title).toBe('string');
      expect(def.content.extendedInfo.title.trim().length).toBeGreaterThan(0);
      expect(typeof def.content.extendedInfo.body).toBe('string');
      expect(def.content.extendedInfo.body.trim().length).toBeGreaterThan(0);
    }
  });
});
