import { describe, expect, it, vi } from 'vitest';
import { FLOORS } from '../../config/gameConfig';
import { ElevatorFloorTransitionManager } from './ElevatorFloorTransitionManager';

function makeManager(overrides: Partial<ConstructorParameters<typeof ElevatorFloorTransitionManager>[0]> = {}) {
  const onEnterFloor = vi.fn();
  const deps: ConstructorParameters<typeof ElevatorFloorTransitionManager>[0] = {
    scene: {} as never,
    progression: { isFloorUnlocked: vi.fn(() => true) } as never,
    player: { sprite: { x: 100, body: { blocked: { down: true }, bottom: 716 } } } as never,
    shaftWidth: 220,
    floorYPositions: {
      [FLOORS.LOBBY]: 0,
      [FLOORS.PLATFORM_TEAM]: 620,
      [FLOORS.BUSINESS]: 520,
    },
    floorHeight: 96,
    isPlayerOnElevator: () => false,
    getCabDockedFloor: () => null,
    onEnterFloor,
    ...overrides,
  };
  const manager = new ElevatorFloorTransitionManager(deps);
  return { manager, deps, onEnterFloor };
}

describe('ElevatorFloorTransitionManager.resolveSceneKey', () => {
  it('uses split-floor overrides for platform-team right and business right', () => {
    expect(ElevatorFloorTransitionManager.resolveSceneKey(FLOORS.PLATFORM_TEAM, 'right')).toBe('ArchitectureTeamScene');
    expect(ElevatorFloorTransitionManager.resolveSceneKey(FLOORS.BUSINESS, 'right')).toBe('CustomerSuccessScene');
    expect(ElevatorFloorTransitionManager.resolveSceneKey(FLOORS.BUSINESS, 'left')).toBe('ProductLeadershipScene');
  });
});

describe('ElevatorFloorTransitionManager.checkFloorEntry', () => {
  it('enters unlocked floor when player stands outside shaft on matching walking surface', () => {
    const { manager, onEnterFloor } = makeManager();
    manager.checkFloorEntry();
    expect(onEnterFloor).toHaveBeenCalledWith(FLOORS.PLATFORM_TEAM, 'left');
  });

  it('does not enter when floor is blocked or when skip guard matches same side', () => {
    const { manager, onEnterFloor } = makeManager({
      isFloorEntryBlocked: vi.fn(() => true),
    });
    manager.setSkipFloorEntry(FLOORS.PLATFORM_TEAM, 'left');
    manager.checkFloorEntry();
    expect(onEnterFloor).not.toHaveBeenCalled();
  });
});

describe('ElevatorFloorTransitionManager.clearSkipWhenBackOnElevator', () => {
  it('clears skip guard only after rider is on elevator at a different floor', () => {
    let onElevator = false;
    let dockedFloor: number | null = FLOORS.PLATFORM_TEAM;
    const { manager, onEnterFloor, deps } = makeManager({
      isPlayerOnElevator: () => onElevator,
      getCabDockedFloor: () => dockedFloor,
      isFloorEntryBlocked: undefined,
    });

    manager.setSkipFloorEntry(FLOORS.PLATFORM_TEAM, 'left');
    manager.clearSkipWhenBackOnElevator(); // still off elevator
    manager.checkFloorEntry();
    expect(onEnterFloor).not.toHaveBeenCalled();

    onElevator = true;
    dockedFloor = FLOORS.BUSINESS;
    manager.clearSkipWhenBackOnElevator();
    onElevator = false;
    (deps.player.sprite as { x: number; body: { blocked: { down: boolean }; bottom: number } }).x = 100;
    manager.checkFloorEntry();
    expect(onEnterFloor).toHaveBeenCalledWith(FLOORS.PLATFORM_TEAM, 'left');
  });
});
