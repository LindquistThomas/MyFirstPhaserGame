import { describe, it, expect, beforeEach } from 'vitest';
import { ProgressionSystem, SaveAdapter } from './ProgressionSystem';
import { SaveData, CURRENT_SAVE_VERSION } from './SaveManager';
import { FLOORS } from '../config/gameConfig';

function memoryAdapter(): SaveAdapter & { stored: SaveData | null } {
  let stored: SaveData | null = null;
  return {
    get stored() { return stored; },
    load: () => stored,
    save: (d) => { stored = { ...d }; },
    clear: () => { stored = null; },
  };
}

describe('ProgressionSystem — onboarding', () => {
  let adapter: ReturnType<typeof memoryAdapter>;
  let p: ProgressionSystem;

  beforeEach(() => {
    adapter = memoryAdapter();
    p = new ProgressionSystem(adapter);
  });

  it('isOnboardingComplete() returns false by default', () => {
    expect(p.isOnboardingComplete()).toBe(false);
  });

  it('completeOnboarding() marks onboarding as complete and persists', () => {
    p.completeOnboarding();
    expect(p.isOnboardingComplete()).toBe(true);
    expect(adapter.stored?.onboardingComplete).toBe(true);
  });

  it('completeOnboarding() is idempotent', () => {
    p.completeOnboarding();
    p.completeOnboarding();
    expect(p.isOnboardingComplete()).toBe(true);
  });

  it('resetOnboarding() clears the flag and persists', () => {
    p.completeOnboarding();
    p.resetOnboarding();
    expect(p.isOnboardingComplete()).toBe(false);
    expect(adapter.stored?.onboardingComplete).toBe(false);
  });

  it('loadFromSave() restores onboardingComplete=true from saved data', () => {
    // Manually save data with onboardingComplete=true
    adapter.save({
      version: CURRENT_SAVE_VERSION,
      totalAU: 0,
      floorAU: { [FLOORS.LOBBY]: 0 } as Record<number, number>,
      unlockedFloors: [FLOORS.LOBBY],
      currentFloor: FLOORS.LOBBY,
      collectedTokens: { [FLOORS.LOBBY]: [] } as Record<number, number[]>,
      onboardingComplete: true,
    });

    const p2 = new ProgressionSystem(adapter);
    p2.loadFromSave();
    expect(p2.isOnboardingComplete()).toBe(true);
  });

  it('loadFromSave() defaults onboardingComplete to false when absent (legacy save)', () => {
    // Save without onboardingComplete (simulates an older save file)
    const legacy = {
      totalAU: 5,
      floorAU: { [FLOORS.LOBBY]: 5 } as Record<number, number>,
      unlockedFloors: [FLOORS.LOBBY],
      currentFloor: FLOORS.LOBBY,
      collectedTokens: { [FLOORS.LOBBY]: [] } as Record<number, number[]>,
    } as SaveData;
    adapter.save(legacy);

    const p2 = new ProgressionSystem(adapter);
    p2.loadFromSave();
    expect(p2.isOnboardingComplete()).toBe(false);
  });

  it('reset() resets onboardingComplete to false', () => {
    p.completeOnboarding();
    p.reset();
    expect(p.isOnboardingComplete()).toBe(false);
  });
});
