import { describe, it, expect } from 'vitest';
import { LEVEL_DATA } from './levelData';
import { FLOORS } from './gameConfig';

describe('LEVEL_DATA', () => {
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

  it('cumulative token AU available (Σ totalAU for all lower-numbered floors) >= auRequired for every floor', () => {
    // Sort floors by their display order (floorNumber) so we accumulate AU
    // in the same order a player would encounter them.
    const sorted = Object.values(LEVEL_DATA).sort((a, b) => a.floorNumber - b.floorNumber);
    let cumulativeAU = 0;
    for (const floor of sorted) {
      expect(
        cumulativeAU,
        `Floor "${floor.name}" (auRequired=${floor.auRequired}) requires more AU than is ` +
        `available from all preceding floors (cumulative available=${cumulativeAU})`,
      ).toBeGreaterThanOrEqual(floor.auRequired);
      cumulativeAU += floor.totalAU;
    }
  });

  it('boss remains reachable from base floor AU alone (without quiz bonuses)', () => {
    const boss = LEVEL_DATA[FLOORS.BOSS];
    const guaranteedFloorAU = Object.values(LEVEL_DATA)
      .filter((floor) => floor.floorNumber < boss.floorNumber)
      .reduce((sum, floor) => sum + floor.totalAU, 0);

    expect(guaranteedFloorAU).toBeGreaterThanOrEqual(boss.auRequired);
  });
});
