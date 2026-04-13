import { FLOORS, FloorId } from '../config/gameConfig';
import { LEVEL_DATA } from '../config/levelData';

/** AU = Architecture Utility — the game's single currency / progression points. */
export interface ProgressionState {
  totalAU: number;
  floorAU: Record<FloorId, number>;
  unlockedFloors: Set<FloorId>;
  currentFloor: FloorId;
}

export class ProgressionSystem {
  private state: ProgressionState;

  constructor() {
    this.state = this.defaultState();
  }

  private defaultState(): ProgressionState {
    return {
      totalAU: 0,
      floorAU: {
        [FLOORS.LOBBY]: 0,
        [FLOORS.PLATFORM_TEAM]: 0,
        [FLOORS.CLOUD_TEAM]: 0,
      },
      unlockedFloors: new Set([FLOORS.LOBBY, FLOORS.PLATFORM_TEAM]),
      currentFloor: FLOORS.LOBBY,
    };
  }

  collectAU(floorId: FloorId): void {
    this.state.totalAU++;
    this.state.floorAU[floorId]++;
    this.checkUnlocks();
  }

  private checkUnlocks(): void {
    for (const [, floorData] of Object.entries(LEVEL_DATA)) {
      if (!this.state.unlockedFloors.has(floorData.id) &&
          this.state.totalAU >= floorData.auRequired) {
        this.state.unlockedFloors.add(floorData.id);
      }
    }
  }

  isFloorUnlocked(floorId: FloorId): boolean {
    return this.state.unlockedFloors.has(floorId);
  }

  getTotalAU(): number {
    return this.state.totalAU;
  }

  getFloorAU(floorId: FloorId): number {
    return this.state.floorAU[floorId];
  }

  getCurrentFloor(): FloorId {
    return this.state.currentFloor;
  }

  setCurrentFloor(floorId: FloorId): void {
    this.state.currentFloor = floorId;
  }

  getUnlockedFloors(): FloorId[] {
    return Array.from(this.state.unlockedFloors);
  }

  getAUNeededForFloor(floorId: FloorId): number {
    const required = LEVEL_DATA[floorId].auRequired;
    return Math.max(0, required - this.state.totalAU);
  }

  reset(): void {
    this.state = this.defaultState();
  }
}
