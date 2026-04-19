import * as Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, FLOORS, TILE_SIZE, COLORS, FloorId } from '../../config/gameConfig';
import { Player } from '../../entities/Player';
import { Elevator } from '../../entities/Elevator';
import { HUD } from '../../ui/HUD';
import { ElevatorButtons } from '../../ui/ElevatorButtons';
import { ProgressionSystem } from '../../systems/ProgressionSystem';
import { GameStateManager } from '../../systems/GameStateManager';
import { DialogController } from '../../ui/DialogController';
import { ZoneManager } from '../../systems/ZoneManager';
import { ElevatorZones, ELEVATOR_INFO_ID, WELCOME_BOARD_ID } from './ElevatorZones';
import { ElevatorController } from './ElevatorController';
import { ElevatorSceneLayout, ShaftExtent } from './ElevatorSceneLayout';
import { ProductDoorManager, ProductDoor } from './ProductDoorManager';
import { ElevatorFloorTransitionManager } from './ElevatorFloorTransitionManager';
import type { NavigationContext } from '../NavigationContext';

/**
 * Elevator-shaft scene — Impossible-Mission style.
 *
 * The player rides the elevator up and down using Up/Down controls.
 * At each floor there is an opening; walking off the elevator onto the
 * floor platform triggers a scene transition to that floor's level.
 *
 * Structural concerns are extracted to focused collaborators:
 *   - {@link ElevatorSceneLayout}             — shaft visuals + walkways
 *   - {@link ProductDoorManager}              — PRODUCTS-floor doors
 *   - {@link ElevatorFloorTransitionManager}  — floor step-off rules + spawn
 *   - {@link ElevatorController}              — ride loop + music cues
 *   - {@link ElevatorZones}                   — zone registrations + icons
 *   - {@link DialogController}                — info + quiz dialogs
 * This scene owns the update loop and orchestrates scene transitions.
 */
export class ElevatorScene extends Phaser.Scene {
  private player!: Player;
  private hud!: HUD;
  private gameState!: GameStateManager;
  private progression!: ProgressionSystem;
  private isTransitioning = false;

  private elevatorButtons?: ElevatorButtons;

  /** Scene-transition hints derived from NavigationContext.init(). */
  private spawnAtProductDoor?: string;
  private spawnAtFloor?: FloorId;
  private spawnAtFloorSide: 'left' | 'right' = 'left';

  private dialogs!: DialogController;
  private zones!: ElevatorZones;
  private elevatorCtrl!: ElevatorController;
  private layout!: ElevatorSceneLayout;
  private doors!: ProductDoorManager;
  private transitions!: ElevatorFloorTransitionManager;

  private zoneManager = new ZoneManager();
  private shaftExtent!: ShaftExtent;

  /** The shaft is wider in the 128-px world. */
  private static readonly SHAFT_WIDTH = 220;
  /** Number of tile rows stacked per floor slab. */
  private static readonly FLOOR_TILE_ROWS = 2;
  /** Pixel height of one floor slab. */
  private static readonly FLOOR_H = ElevatorScene.FLOOR_TILE_ROWS * TILE_SIZE;

  constructor() {
    super({ key: 'ElevatorScene' });
  }

  init(data?: NavigationContext): void {
    this.gameState = this.registry.get('gameState') as GameStateManager;
    this.gameState.applyInitialLoad(data?.loadSave);
    this.progression = this.gameState.progression;
    this.spawnAtProductDoor = data?.spawnDoorId;
    this.spawnAtFloor = data?.fromFloor;
    this.spawnAtFloorSide = data?.spawnSide ?? 'left';
    this.zoneManager.clear();
  }

  create(): void {
    this.isTransitioning = false;
    this.cameras.main.setBackgroundColor(COLORS.background);

    this.shaftExtent = this.computeShaftExtent();
    const worldH = this.shaftExtent.bottom;
    this.physics.world.setBounds(0, 0, GAME_WIDTH, worldH);

    const positions = this.getFloorYPositions();
    this.layout = new ElevatorSceneLayout({
      scene: this,
      progression: this.progression,
      shaftWidth: ElevatorScene.SHAFT_WIDTH,
      shaftExtent: this.shaftExtent,
      floorYPositions: positions,
      floorLabels: this.getFloorLabels(),
    });
    this.layout.build();

    this.createPlayer(positions);

    this.transitions = new ElevatorFloorTransitionManager({
      scene: this,
      progression: this.progression,
      player: this.player,
      shaftWidth: ElevatorScene.SHAFT_WIDTH,
      floorYPositions: positions,
      floorHeight: ElevatorScene.FLOOR_H,
      isPlayerOnElevator: () => this.elevatorCtrl.isOnElevator,
      onEnterFloor: (floorId, side) => this.enterFloor(floorId, side),
    });
    this.transitions.setSkipFloorEntry(this.spawnAtFloor);

    this.elevatorCtrl = new ElevatorController(this, this.player, this.buildElevator(positions));

    const productsWalkY = positions[FLOORS.PRODUCTS] + ElevatorScene.FLOOR_H;
    this.doors = new ProductDoorManager({
      scene: this,
      progression: this.progression,
      player: this.player,
      productsWalkY,
      isPlayerOnElevator: () => this.elevatorCtrl.isOnElevator,
      onEnter: (door) => this.enterProductDoor(door),
    });
    this.doors.render();

    this.createUI();

    this.cameras.main.startFollow(this.player.sprite, true, 0.1, 0.1);
    this.cameras.main.setBounds(0, 0, GAME_WIDTH, worldH);
    this.cameras.main.fadeIn(500, 0, 0, 0);

    this.dialogs = new DialogController(this, {
      progression: this.progression,
      getIconForContent: () => this.zones.elevatorInfoIcon,
      onOpen: (id) => this.gameState.markSeen(id),
      onClose: (id) => {
        if (id === ELEVATOR_INFO_ID) {
          this.zones.elevatorInfoIcon?.markAsSeen();
        } else if (id === WELCOME_BOARD_ID) {
          this.zones.lobbyBoardIcon?.markAsSeen();
        }
      },
    });

    const lobbyY = positions[FLOORS.LOBBY];
    this.zones = new ElevatorZones({
      scene: this,
      zoneManager: this.zoneManager,
      dialogs: this.dialogs,
      player: this.player,
      gameState: this.gameState,
      elevatorButtons: () => this.elevatorButtons,
      isPlayerOnElevator: () => this.elevatorCtrl.isOnElevator,
      boardX: 300,
      boardY: lobbyY + ElevatorScene.FLOOR_H - 60,
    });

    // Cable + LEDs need an initial tick so they render before update() runs.
    this.layout.updateShaftCable(this.elevatorCtrl);
    this.layout.updateFloorLEDs(this.elevatorCtrl);
  }

  /* ---- player ---- */
  private createPlayer(positions: Record<number, number>): void {
    const spawn = this.resolveInitialSpawn(positions);
    this.player = new Player(this, spawn.x, spawn.y);
    this.physics.add.collider(this.player.sprite, this.layout.platforms);
  }

  /**
   * Decide where the player spawns based on the navigation context:
   *   - returning from a product room  → next to that door on the PRODUCTS walk surface
   *   - returning from a floor/room     → just outside the shaft on that side
   *   - otherwise                       → lobby default
   */
  private resolveInitialSpawn(positions: Record<number, number>): { x: number; y: number } {
    const SPAWN_OFFSET = 56;
    if (this.spawnAtProductDoor) {
      const productsWalkY = positions[FLOORS.PRODUCTS] + ElevatorScene.FLOOR_H;
      const door = ProductDoorManager.doors.find((d) => d.contentId === this.spawnAtProductDoor);
      if (door) {
        return { x: door.x, y: productsWalkY - SPAWN_OFFSET };
      }
    }
    if (this.spawnAtFloor !== undefined && this.spawnAtFloor !== FLOORS.LOBBY) {
      const floorY = positions[this.spawnAtFloor];
      if (floorY !== undefined) {
        const walkY = floorY + ElevatorScene.FLOOR_H;
        const cx = GAME_WIDTH / 2;
        const sw = ElevatorScene.SHAFT_WIDTH;
        const x = this.spawnAtFloorSide === 'right' ? cx + sw / 2 + 60 : cx - sw / 2 - 60;
        return { x, y: walkY - SPAWN_OFFSET };
      }
    }
    const lobbyY = positions[FLOORS.LOBBY];
    return { x: 200, y: lobbyY + ElevatorScene.FLOOR_H - SPAWN_OFFSET };
  }

  /* ---- elevator ---- */
  private buildElevator(positions: Record<number, number>): Elevator {
    const cx = GAME_WIDTH / 2;
    const floorH = ElevatorScene.FLOOR_H;
    const startY = positions[this.progression.getCurrentFloor()] + floorH + 8;

    const elevator = new Elevator(this, cx, startY);
    for (const [id, y] of Object.entries(positions)) {
      elevator.addFloor(Number(id), y + floorH + 8);
    }
    // Cab starts docked at whichever floor the player was last on — keep
    // the elevator's internal floor id in sync so the HUD doesn't show
    // F0/Lobby while physically parked at F1 on scene re-entry.
    elevator.setCurrentFloor(this.progression.getCurrentFloor());
    return elevator;
  }

  /* ---- UI ---- */
  private createUI(): void {
    this.hud = new HUD(this, this.progression);

    this.add.text(GAME_WIDTH / 2, GAME_HEIGHT - 30, '\u2191\u2193  Ride Elevator  |  \u2190 \u2192  Walk  |  SPACE  Flip', {
      fontFamily: 'monospace', fontSize: '14px', color: '#8899aa',
    }).setOrigin(0.5).setDepth(50).setScrollFactor(0);

    this.elevatorButtons = new ElevatorButtons(this, 56);
  }

  /* ---- helpers ---- */
  /**
   * Absolute Y (world coords) of the TOP of each floor's tile slab.
   * Values are chosen so floors are evenly spaced with the lobby at the
   * bottom and executive at the top; {@link computeShaftExtent} derives
   * the shaft range from these.
   */
  private getFloorYPositions(): Record<number, number> {
    return {
      [FLOORS.LOBBY]: 2410,
      [FLOORS.PLATFORM_TEAM]: 1880,
      [FLOORS.PRODUCTS]: 1350,
      [FLOORS.BUSINESS]: 820,
      [FLOORS.EXECUTIVE]: 290,
    };
  }

  private computeShaftExtent(): ShaftExtent {
    const positions = this.getFloorYPositions();
    const floorH = ElevatorScene.FLOOR_H;
    const top = Math.min(...Object.values(positions));
    const bottom = Math.max(...Object.values(positions)) + floorH;
    return { top, bottom, height: bottom - top };
  }

  /**
   * Build a "F#" label per floor based on Y position (bottom-up), so the
   * displayed number follows the visual stacking order even when FloorId
   * values aren't allocated in the same order (e.g. when a new floor is
   * inserted into the middle of the shaft).
   */
  private getFloorLabels(): Record<number, string> {
    const positions = this.getFloorYPositions();
    const sorted = Object.entries(positions)
      .map(([id, y]) => ({ id: Number(id), y }))
      .sort((a, b) => b.y - a.y);
    const out: Record<number, string> = {};
    sorted.forEach((entry, index) => { out[entry.id] = `F${index}`; });
    return out;
  }

  /** Debug overlay: current floor the elevator is stopped at (or "between"). */
  getDebugInfo(): string[] {
    if (!this.elevatorCtrl) return [];
    const labels = this.getFloorLabels();
    const elev = this.elevatorCtrl.elevator;
    const stoppedAt = elev.getFloorAtCurrentPosition();
    const current = elev.getCurrentFloor();
    const label = (id: number | null): string =>
      id === null ? '—' : `${labels[id] ?? `F?`} (id=${id})`;
    const lines = [`Elevator floor: ${label(current)}`];
    if (stoppedAt === null) lines.push('  (between floors)');
    return lines;
  }

  /* ---- update loop ---- */
  update(_time: number, delta: number): void {
    if (this.isTransitioning) return;

    const inputs = this.inputs;
    const infoPressed = inputs.justPressed('ToggleInfo');
    const interactPressed = inputs.justPressed('Interact');

    if (this.dialogs.isOpen) return;

    this.player.update(delta);
    this.hud.update();

    // Emit zone:enter / zone:exit events; ElevatorZones' subscribers react.
    this.zoneManager.update();

    const activeZone = this.zoneManager.getActiveZone();
    if (infoPressed && activeZone && !this.dialogs.isOpen) {
      this.dialogs.open(activeZone);
      return;
    }

    const btnState = this.elevatorButtons?.getState();
    this.elevatorCtrl.update(
      { up: inputs.isDown('MoveUp'), down: inputs.isDown('MoveDown') },
      btnState ? { up: btnState.up, down: btnState.down } : undefined,
      delta,
    );

    const cabY = this.elevatorCtrl.elevator.getY();
    for (const door of this.layout.shaftDoors) door.update(cabY, delta);
    this.layout.updateShaftCable(this.elevatorCtrl);
    this.layout.updateFloorLEDs(this.elevatorCtrl);

    // Keep progression.currentFloor aligned with the docked cab so the HUD
    // floor label tracks the player as they ride between floors.
    const elevFloor = this.elevatorCtrl.elevator.getCurrentFloor() as FloorId;
    if (elevFloor !== this.progression.getCurrentFloor()) {
      this.progression.setCurrentFloor(elevFloor);
    }

    this.transitions.clearSkipWhenBackOnElevator();
    this.transitions.checkFloorEntry();
    this.doors.update(interactPressed);
  }

  private enterProductDoor(door: ProductDoor): void {
    if (this.isTransitioning) return;
    this.isTransitioning = true;
    this.progression.setCurrentFloor(FLOORS.PRODUCTS);
    this.cameras.main.fadeOut(500, 0, 0, 0);
    this.time.delayedCall(500, () => this.scene.start(door.sceneKey));
  }

  private enterFloor(floorId: FloorId, direction: 'left' | 'right' = 'left'): void {
    if (this.isTransitioning) return;
    this.isTransitioning = true;
    this.progression.setCurrentFloor(floorId);
    const sceneKey = ElevatorFloorTransitionManager.resolveSceneKey(floorId, direction);
    this.cameras.main.fadeOut(500, 0, 0, 0);
    this.time.delayedCall(500, () => this.scene.start(sceneKey));
  }
}
