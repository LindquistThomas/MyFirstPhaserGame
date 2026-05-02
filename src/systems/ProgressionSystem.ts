import { FLOORS, FloorId } from '../config/gameConfig';
import { LEVEL_DATA } from '../config/levelData';
import type { SaveData } from './SaveManager';
import * as DefaultSaveManager from './SaveManager';
import { CURRENT_SAVE_VERSION } from './SaveManager';
import { resetAllQuizzes } from './QuizManager';
import { resetAll as resetAllInfoDialogs } from './InfoDialogManager';
import { eventBus } from './EventBus';

/** Explicit AU totals at which a `progression:au_milestone` event fires. */
const AU_MILESTONES = [5, 15, 30, 50, 75, 100, 150, 200, 300, 500];

/** Pluggable persistence adapter; defaults to the SaveManager module. */
export interface SaveAdapter {
  load(): SaveData | null;
  save(data: SaveData): void;
  clear(): void;
}

/** AU = Architecture Utility — the game's single currency / progression points. */
export interface ProgressionState {
  totalAU: number;
  floorAU: Record<FloorId, number>;
  unlockedFloors: Set<FloorId>;
  currentFloor: FloorId;
  collectedTokens: Record<FloorId, Set<number>>;
  onboardingComplete: boolean;
  /** Floors the player has physically entered at least once. */
  visitedFloors: Set<FloorId>;
}

export class ProgressionSystem {
  private state: ProgressionState;
  private readonly saveAdapter: SaveAdapter;

  constructor(saveAdapter?: SaveAdapter) {
    this.saveAdapter = saveAdapter ?? DefaultSaveManager;
    this.state = this.defaultState();
  }

  private defaultState(): ProgressionState {
    const allFloors = Object.values(FLOORS);
    return {
      totalAU: 0,
      floorAU: Object.fromEntries(allFloors.map(id => [id, 0])) as Record<FloorId, number>,
      // Only floors with auRequired === 0 are unlocked from the start.
      // All other floors are gated behind AU thresholds checked in checkUnlocks().
      unlockedFloors: new Set(
        Object.values(LEVEL_DATA)
          .filter(f => f.auRequired === 0)
          .map(f => f.id),
      ),
      currentFloor: FLOORS.LOBBY,
      collectedTokens: Object.fromEntries(allFloors.map(id => [id, new Set<number>()])) as Record<FloorId, Set<number>>,
      onboardingComplete: false,
      visitedFloors: new Set<FloorId>(),
    };
  }

  private tokensFor(floorId: FloorId): Set<number> {
    return this.state.collectedTokens[floorId] ??= new Set();
  }

  collectAU(floorId: FloorId, tokenIndex?: number): void {
    if (tokenIndex !== undefined) {
      if (this.tokensFor(floorId).has(tokenIndex)) return;
      this.tokensFor(floorId).add(tokenIndex);
    }
    this.addAU(floorId, 1);
  }

  addAU(floorId: FloorId, amount: number): void {
    const prevTotal = this.state.totalAU;
    this.state.totalAU += amount;
    this.state.floorAU[floorId] += amount;
    this.checkUnlocks();
    this.persist();

    // Emit every milestone value the player crossed in this addAU call so the
    // HUD can celebrate with a toast.  Iterating the explicit list keeps the
    // first few milestones (5, 15, 30) tightly spaced for early-game feedback
    // while still covering large totals for completionists.
    const newTotal = this.state.totalAU;
    for (const milestone of AU_MILESTONES) {
      if (prevTotal < milestone && newTotal >= milestone) {
        eventBus.emit('progression:au_milestone', milestone);
      }
    }
  }

  /**
   * Deduct AU lost due to an enemy hit. Clamps both per-floor and total
   * counters at 0. Returns the amount actually removed (may be less than
   * `amount` if the player had less AU available).
   *
   * Does NOT touch `collectedTokens` — dropped AU is transient and
   * recoverable via DroppedAU pickups. The already-unlocked floors are
   * also left in place (unlocks are sticky).
   */
  loseAU(floorId: FloorId, amount: number): number {
    if (amount <= 0) return 0;
    const floorAvail = this.state.floorAU[floorId] ?? 0;
    const totalAvail = this.state.totalAU;
    const removed = Math.max(0, Math.min(amount, floorAvail, totalAvail));
    if (removed === 0) return 0;
    this.state.floorAU[floorId] = floorAvail - removed;
    this.state.totalAU = totalAvail - removed;
    this.persist();
    return removed;
  }

  isTokenCollected(floorId: FloorId, tokenIndex: number): boolean {
    return this.tokensFor(floorId).has(tokenIndex);
  }

  /** Returns true when the player has NOT yet visited this floor (first-visit check). */
  isFirstVisit(floorId: FloorId): boolean {
    return !this.state.visitedFloors.has(floorId);
  }

  /** Mark a floor as having been physically entered by the player. */
  markFloorVisited(floorId: FloorId): void {
    if (this.state.visitedFloors.has(floorId)) return;
    this.state.visitedFloors.add(floorId);
    this.persist();
  }

  /** Reset all visited-floor flags so coaching toasts appear again on next entry. */
  resetVisitedFloors(): void {
    this.state.visitedFloors = new Set<FloorId>();
    this.persist();
  }

  /** Whether the player has previously entered a floor at least once. */
  hasVisitedFloor(floorId: FloorId): boolean {
    return this.state.visitedFloors.has(floorId);
  }

  /** Number of distinct floors the player has visited. */
  getVisitedFloorCount(): number {
    return this.state.visitedFloors.size;
  }

  /** Total number of tokens collected across all floors. */
  getTotalCollectedTokens(): number {
    return Object.values(this.state.collectedTokens)
      .reduce((sum, s) => sum + s.size, 0);
  }

  private checkUnlocks(): void {
    for (const [, floorData] of Object.entries(LEVEL_DATA)) {
      if (!this.state.unlockedFloors.has(floorData.id) &&
          this.state.totalAU >= floorData.auRequired) {
        this.state.unlockedFloors.add(floorData.id);
        eventBus.emit('progression:floor_unlocked', floorData.id);
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

  isOnboardingComplete(): boolean {
    return this.state.onboardingComplete;
  }

  completeOnboarding(): void {
    if (this.state.onboardingComplete) return;
    this.state.onboardingComplete = true;
    this.persist();
  }

  resetOnboarding(): void {
    this.state.onboardingComplete = false;
    this.persist();
  }

  reset(): void {
    this.state = this.defaultState();
    this.saveAdapter.clear();
    resetAllQuizzes();
    resetAllInfoDialogs();
  }

  loadFromSave(): boolean {
    const data = this.saveAdapter.load();
    if (!data) return false;
    this.state = {
      totalAU: data.totalAU,
      floorAU: data.floorAU as Record<FloorId, number>,
      // Restore only the floors the player actually unlocked (no merge with
      // defaults). checkUnlocks() below will re-unlock any floor whose
      // auRequired threshold the player's saved total already meets.
      unlockedFloors: new Set<FloorId>(data.unlockedFloors),
      currentFloor: data.currentFloor,
      collectedTokens: Object.fromEntries(
        Object.entries(data.collectedTokens).map(([k, v]) => [Number(k), new Set(v)]),
      ) as Record<FloorId, Set<number>>,
      onboardingComplete: data.onboardingComplete ?? false,
      visitedFloors: new Set<FloorId>(data.visitedFloors ?? []),
    };
    this.checkUnlocks();
    return true;
  }

  private persist(): void {
    this.saveAdapter.save({
      version: CURRENT_SAVE_VERSION,
      totalAU: this.state.totalAU,
      floorAU: this.state.floorAU,
      unlockedFloors: Array.from(this.state.unlockedFloors),
      currentFloor: this.state.currentFloor,
      // Object.entries() widens keys to string; Number(k) restores the FloorId
      // value. The source (this.state.collectedTokens) is Record<FloorId, ...>,
      // so all keys are guaranteed to be valid FloorIds.
      collectedTokens: Object.fromEntries(
        Object.entries(this.state.collectedTokens).map(([k, v]) => [Number(k), Array.from(v)]),
      ) as Record<FloorId, number[]>,
      onboardingComplete: this.state.onboardingComplete,
      visitedFloors: Array.from(this.state.visitedFloors),
      lastPlayedAt: Date.now(),
    });
  }
}
