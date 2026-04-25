import { describe, expect, it } from 'vitest';
import {
  CATWALK_THICKNESS,
  CATWALK_THICKNESS_PLATFORM,
  TIER_Y_T1,
  TIER_Y_T2,
  TIER_Y_T3,
  TIER_Y_T4,
} from './levelGeometry';

describe('levelGeometry', () => {
  it('keeps mezzanine tiers on the documented 140 px pitch', () => {
    expect(TIER_Y_T1 - TIER_Y_T2).toBe(140);
    expect(TIER_Y_T2 - TIER_Y_T3).toBe(140);
    expect(TIER_Y_T3 - TIER_Y_T4).toBe(140);
  });

  it('keeps platform catwalk thinner than the shared default', () => {
    expect(CATWALK_THICKNESS).toBe(20);
    expect(CATWALK_THICKNESS_PLATFORM).toBe(16);
    expect(CATWALK_THICKNESS_PLATFORM).toBeLessThan(CATWALK_THICKNESS);
  });
});
