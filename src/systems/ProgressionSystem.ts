import { FLOORS, FloorId } from '../config/gameConfig';
import { LEVEL_DATA } from '../config/levelData';

export interface ProgressionState {
  totalTokens: number;
  floorTokens: Record<FloorId, number>;
  unlockedFloors: Set<FloorId>;
  currentFloor: FloorId;
}

export class ProgressionSystem {
  private state: ProgressionState;

  constructor() {
    this.state = {
      totalTokens: 0,
      floorTokens: {
        [FLOORS.LOBBY]: 0,
        [FLOORS.PLATFORM_TEAM]: 0,
        [FLOORS.CLOUD_TEAM]: 0,
      },
      unlockedFloors: new Set([FLOORS.LOBBY, FLOORS.PLATFORM_TEAM]),
      currentFloor: FLOORS.LOBBY,
    };
  }

  collectToken(floorId: FloorId): void {
    this.state.totalTokens++;
    this.state.floorTokens[floorId]++;
    this.checkUnlocks();
  }

  private checkUnlocks(): void {
    for (const [, floorData] of Object.entries(LEVEL_DATA)) {
      if (!this.state.unlockedFloors.has(floorData.id) &&
          this.state.totalTokens >= floorData.tokensRequired) {
        this.state.unlockedFloors.add(floorData.id);
      }
    }
  }

  isFloorUnlocked(floorId: FloorId): boolean {
    return this.state.unlockedFloors.has(floorId);
  }

  getTotalTokens(): number {
    return this.state.totalTokens;
  }

  getFloorTokens(floorId: FloorId): number {
    return this.state.floorTokens[floorId];
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

  getTokensNeededForFloor(floorId: FloorId): number {
    const required = LEVEL_DATA[floorId].tokensRequired;
    return Math.max(0, required - this.state.totalTokens);
  }

  reset(): void {
    this.state = {
      totalTokens: 0,
      floorTokens: {
        [FLOORS.LOBBY]: 0,
        [FLOORS.PLATFORM_TEAM]: 0,
        [FLOORS.CLOUD_TEAM]: 0,
      },
      unlockedFloors: new Set([FLOORS.LOBBY, FLOORS.PLATFORM_TEAM]),
      currentFloor: FLOORS.LOBBY,
    };
  }
}
