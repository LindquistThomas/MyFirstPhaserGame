import { FLOORS, FloorId } from '../config/gameConfig';
import { LEVEL_DATA } from '../config/levelData';
import * as SaveManager from './SaveManager';

/** AU = Architecture Utility — the game's single currency / progression points. */
export interface ProgressionState {
  totalAU: number;
  floorAU: Record<FloorId, number>;
  unlockedFloors: Set<FloorId>;
  currentFloor: FloorId;
  collectedTokens: Record<FloorId, Set<number>>;
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
      collectedTokens: {
        [FLOORS.LOBBY]: new Set(),
        [FLOORS.PLATFORM_TEAM]: new Set(),
        [FLOORS.CLOUD_TEAM]: new Set(),
      },
    };
  }

  collectAU(floorId: FloorId, tokenIndex?: number): void {
    if (tokenIndex !== undefined) {
      if (this.state.collectedTokens[floorId].has(tokenIndex)) return;
      this.state.collectedTokens[floorId].add(tokenIndex);
    }
    this.state.totalAU++;
    this.state.floorAU[floorId]++;
    this.checkUnlocks();
    this.persist();
  }

  isTokenCollected(floorId: FloorId, tokenIndex: number): boolean {
    return this.state.collectedTokens[floorId].has(tokenIndex);
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
    this.persist();
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
    SaveManager.clear();
  }

  loadFromSave(): boolean {
    const data = SaveManager.load();
    if (!data) return false;
    this.state = {
      totalAU: data.totalAU,
      floorAU: data.floorAU as Record<FloorId, number>,
      unlockedFloors: new Set(data.unlockedFloors as FloorId[]),
      currentFloor: data.currentFloor as FloorId,
      collectedTokens: Object.fromEntries(
        Object.entries(data.collectedTokens).map(([k, v]) => [Number(k), new Set(v)]),
      ) as Record<FloorId, Set<number>>,
    };
    this.checkUnlocks();
    return true;
  }

  private persist(): void {
    SaveManager.save({
      totalAU: this.state.totalAU,
      floorAU: this.state.floorAU,
      unlockedFloors: Array.from(this.state.unlockedFloors),
      currentFloor: this.state.currentFloor,
      collectedTokens: Object.fromEntries(
        Object.entries(this.state.collectedTokens).map(([k, v]) => [Number(k), Array.from(v)]),
      ),
    });
  }
}
