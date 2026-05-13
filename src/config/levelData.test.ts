import { describe, it, expect } from 'vitest';
import { LEVEL_DATA } from './levelData';
import { FLOORS } from './gameConfig';

describe('LEVEL_DATA', () => {
  const UNLOCK_SLACK_MULTIPLIER = 1.25;
  const MID_GAME_FLOOR_THRESHOLD = 4;
  const entries = Object.entries(LEVEL_DATA);

  it('has an entry for every FloorId in FLOORS', () => {
    for (const floorId of Object.values(FLOORS)) {
      expect(LEVEL_DATA[floorId]).toBeDefined();
    }
  });

  it('has matching record key and inner id for every entry', () => {
    for (const [key, floor] of entries) {
      expect(Number(key)).toBe(floor.id);
    }
  });

  it('has unique floor ids', () => {
    const ids = entries.map(([, f]) => f.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('has unique scene keys', () => {
    const sceneKeys = entries.map(([, f]) => f.sceneKey);
    expect(new Set(sceneKeys).size).toBe(sceneKeys.length);
  });

  it('has non-empty string name, description, sceneKey and auLabel', () => {
    for (const [, floor] of entries) {
      expect(typeof floor.name).toBe('string');
      expect(floor.name.length).toBeGreaterThan(0);
      expect(typeof floor.description).toBe('string');
      expect(floor.description.length).toBeGreaterThan(0);
      expect(typeof floor.sceneKey).toBe('string');
      expect(floor.sceneKey.length).toBeGreaterThan(0);
      expect(typeof floor.auLabel).toBe('string');
      expect(floor.auLabel.length).toBeGreaterThan(0);
    }
  });

  it('has non-negative finite auRequired and totalAU', () => {
    for (const [, floor] of entries) {
      expect(Number.isFinite(floor.auRequired)).toBe(true);
      expect(floor.auRequired).toBeGreaterThanOrEqual(0);
      expect(Number.isFinite(floor.totalAU)).toBe(true);
      expect(floor.totalAU).toBeGreaterThanOrEqual(0);
    }
  });

  it('has a valid integer color theme (0x000000..0xffffff) for every color slot', () => {
    const colorKeys = ['platformColor', 'backgroundColor', 'wallColor', 'tokenColor'] as const;
    for (const [, floor] of entries) {
      for (const key of colorKeys) {
        const value = floor.theme[key];
        expect(Number.isInteger(value)).toBe(true);
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThanOrEqual(0xffffff);
      }
    }
  });

  it('the lobby floor is free to enter (auRequired === 0)', () => {
    expect(LEVEL_DATA[FLOORS.LOBBY].auRequired).toBe(0);
  });

  it('each non-boss floor is unlockable from lower-numbered floors', () => {
    const sorted = Object.values(LEVEL_DATA).sort((a, b) => a.floorNumber - b.floorNumber);
    let cumulativeAU = 0;
    for (const floor of sorted) {
      if (floor.id === FLOORS.BOSS) break;
      expect(
        cumulativeAU,
        `Floor "${floor.name}" (auRequired=${floor.auRequired}) requires more AU than is ` +
        `available from all preceding floors (cumulative available=${cumulativeAU})`,
      ).toBeGreaterThanOrEqual(floor.auRequired);
      cumulativeAU += floor.totalAU;
    }
  });

  it('every gated floor has at least 25% AU slack from earlier floors', () => {
    const sorted = Object.values(LEVEL_DATA).sort((a, b) => a.floorNumber - b.floorNumber);
    let cumulativeAU = 0;
    for (const floor of sorted) {
      if (floor.auRequired > 0) {
        expect(
          cumulativeAU,
          `Floor "${floor.name}" (auRequired=${floor.auRequired}) should have at least 25% AU slack ` +
          `from earlier floors (cumulative available=${cumulativeAU})`,
        ).toBeGreaterThanOrEqual(floor.auRequired * UNLOCK_SLACK_MULTIPLIER);
      }
      cumulativeAU += floor.totalAU;
    }
  });

  it('mid/late-game gates cannot be unlocked by the AU of any single earlier floor', () => {
    const sorted = Object.values(LEVEL_DATA).sort((a, b) => a.floorNumber - b.floorNumber);
    const earlierFloors: typeof sorted = [];

    for (const floor of sorted) {
      if (floor.floorNumber >= MID_GAME_FLOOR_THRESHOLD && floor.auRequired > 0) {
        const earlierAuSources = earlierFloors.filter((earlier) => earlier.totalAU > 0);
        // Early floor gates can only have 0-1 prior AU sources by design.
        // We enforce the multi-source rule only where 2+ earlier sources exist.
        if (earlierAuSources.length >= 2) {
          const maxSingleEarlierYield = Math.max(...earlierAuSources.map((earlier) => earlier.totalAU));
          expect(
            floor.auRequired,
            `Floor "${floor.name}" (auRequired=${floor.auRequired}) should require AU from multiple earlier floors; ` +
            `max single earlier yield is ${maxSingleEarlierYield}`,
          ).toBeGreaterThan(maxSingleEarlierYield);
        }
      }
      earlierFloors.push(floor);
    }
  });
});
