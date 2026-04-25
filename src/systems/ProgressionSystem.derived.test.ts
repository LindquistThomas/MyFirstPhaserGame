/**
 * Verifies that ProgressionSystem.defaultState() derives floor maps from
 * Object.values(FLOORS) rather than a hardcoded list.
 *
 * Uses vi.doMock + vi.resetModules to inject a synthetic floor id (99) that
 * is not present in the real FLOORS constant, then asserts that getFloorAU
 * returns 0 (not undefined) for that id.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { FloorId } from '../config/gameConfig';
import type { SaveAdapter } from './ProgressionSystem';

const SYNTH_FLOOR = 99 as FloorId;

const noopSave: SaveAdapter = {
  load: () => null,
  save: () => {},
  clear: () => {},
};

describe('ProgressionSystem — defaultState derivation from FLOORS', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('getFloorAU returns 0 (not undefined) for a synthetic floor ID present in FLOORS', async () => {
    vi.doMock('../config/gameConfig', () => ({
      FLOORS: {
        LOBBY: 0,
        PLATFORM_TEAM: 1,
        BUSINESS: 3,
        EXECUTIVE: 4,
        PRODUCTS: 5,
        SYNTHETIC: SYNTH_FLOOR,
      },
    }));

    const { ProgressionSystem } = await import('./ProgressionSystem');
    const p = new ProgressionSystem(noopSave);
    expect(p.getFloorAU(SYNTH_FLOOR)).toBe(0);
  });

  it('isFloorUnlocked returns true for a synthetic floor ID present in FLOORS', async () => {
    vi.doMock('../config/gameConfig', () => ({
      FLOORS: {
        LOBBY: 0,
        PLATFORM_TEAM: 1,
        BUSINESS: 3,
        EXECUTIVE: 4,
        PRODUCTS: 5,
        SYNTHETIC: SYNTH_FLOOR,
      },
    }));

    const { ProgressionSystem } = await import('./ProgressionSystem');
    const p = new ProgressionSystem(noopSave);
    expect(p.isFloorUnlocked(SYNTH_FLOOR)).toBe(true);
  });
});
