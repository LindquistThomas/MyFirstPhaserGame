import * as Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, FLOORS, TILE_SIZE, FloorId } from '../../config/gameConfig';
import { theme } from '../../style/theme';
import { Player } from '../../entities/Player';
import { Elevator } from '../../entities/Elevator';
import { HUD } from '../../ui/HUD';
import { ElevatorButtons } from '../../ui/ElevatorButtons';
import { ProgressionSystem } from '../../systems/ProgressionSystem';
import { GameStateManager } from '../../systems/GameStateManager';
import { DialogController } from '../../ui/DialogController';
import { ZoneManager } from '../../systems/ZoneManager';
import { ElevatorZones, ELEVATOR_INFO_ID, WELCOME_BOARD_ID, GEIR_F4_ID, SOFA_SIT_ID } from './ElevatorZones';
import { ElevatorController } from './ElevatorController';
import { ElevatorSceneLayout, ShaftExtent } from './ElevatorSceneLayout';
import { ProductDoorManager, ProductDoor } from './ProductDoorManager';
import { ElevatorFloorTransitionManager } from './ElevatorFloorTransitionManager';
import type { NavigationContext } from '../NavigationContext';
import type { GameAction } from '../../input/actions';
import { eventBus } from '../../systems/EventBus';

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
  /** True while the player is seated on the lobby sofa. */
  private isSittingOnSofa = false;
  /** Player y recorded at sit time, restored on stand-up to avoid tunneling. */
  private preSitY = 0;

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
  /**
   * Depth (px) of the shaft pit below the lobby walking surface. Controls how
   * much of the shaft bottom is visible when the camera clamps at the lobby.
   */
  private static readonly PIT_DEPTH = 96;

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
    // Fallback colour behind the sky backdrop (drawn by ElevatorSceneLayout).
    // Matches the horizon band so any sub-pixel leak reads as "sky", not a
    // harsh purple notch.
    this.cameras.main.setBackgroundColor(theme.color.sky.horizon);

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
      getCabDockedFloor: () => this.elevatorCtrl.elevator.getFloorAtCurrentPosition(),
      onEnterFloor: (floorId, side) => this.enterFloor(floorId, side),
      isFloorEntryBlocked: (floorId) =>
        floorId === FLOORS.EXECUTIVE
        && this.zoneManager.getActiveZone() === GEIR_F4_ID,
    });
    this.transitions.setSkipFloorEntry(this.spawnAtFloor, this.spawnAtFloorSide);

    this.elevatorCtrl = new ElevatorController(this, this.player, this.buildElevator(positions));

    const productsWalkY = positions[FLOORS.PRODUCTS] + ElevatorScene.FLOOR_H;
    this.doors = new ProductDoorManager({
      scene: this,
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
      getIconForContent: (id) => {
        if (id === GEIR_F4_ID) return this.zones.geirInfoIcon;
        if (id === WELCOME_BOARD_ID) return this.zones.lobbyBoardIcon;
        return this.zones.elevatorInfoIcon;
      },
      onOpen: (id) => this.gameState.markSeen(id),
      onClose: (id) => {
        if (id === ELEVATOR_INFO_ID) {
          this.zones.elevatorInfoIcon?.markAsSeen();
        } else if (id === WELCOME_BOARD_ID) {
          this.zones.lobbyBoardIcon?.markAsSeen();
        } else if (id === GEIR_F4_ID) {
          this.zones.geirInfoIcon?.markAsSeen();
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
      // Matches the info_board sprite placed in ElevatorSceneLayout at
      // (355, floorBottom - 60). Keep these in sync if the sprite moves.
      boardX: 355,
      boardY: lobbyY + ElevatorScene.FLOOR_H - 60,
      geirBounds: this.layout.getGeirBounds(),
      receptionBounds: this.layout.getReceptionBounds(),
      receptionBubble: this.layout.getReceptionistBubble(),
      sofaBounds: this.layout.getSofaBounds(),
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
    return { x: 110, y: lobbyY + ElevatorScene.FLOOR_H - SPAWN_OFFSET };
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
    // Route the cab's twin suspension cables to the machine-room pulley so
    // they don't extend off the top of the world.
    elevator.setCableTopY(this.layout.getPulleyAnchorY());
    return elevator;
  }

  /* ---- UI ---- */
  private createUI(): void {
    this.hud = new HUD(this, this.progression);

    this.add.text(GAME_WIDTH / 2, GAME_HEIGHT - 30, '\u2191\u2193  Ride Elevator  |  0-4  Call Floor  |  \u2190 \u2192  Walk  |  SPACE  Flip', {
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
    // Extend the shaft below the lobby walking surface by PIT_DEPTH so the
    // player can see the bottom of the shaft (pit floor) while standing on
    // the ground floor — without it, the camera clamps flush with the lobby
    // and the pit cap renders just out of view.
    const bottom = Math.max(...Object.values(positions)) + floorH + ElevatorScene.PIT_DEPTH;
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

  /** Debug overlay hook: expose the scene's spatial content zones. */
  getDebugZones(): import('../../features/floors/_shared/LevelZoneSetup').DebugZone[] {
    return this.zones?.getDebugZones() ?? [];
  }

  /* ---- update loop ---- */
  update(_time: number, delta: number): void {
    if (this.isTransitioning) return;

    const inputs = this.inputs;
    const infoPressed = inputs.justPressed('ToggleInfo');
    const interactPressed = inputs.justPressed('Interact');

    if (this.dialogs.isOpen) return;

    // Emit zone:enter / zone:exit events first so sit-zone state is fresh.
    this.zoneManager.update();
    const activeZone = this.zoneManager.getActiveZone();

    // --- Sofa sit/stand toggle. Runs BEFORE the generic info-dialog open
    //     so pressing Enter at the sofa always triggers sitting (and never
    //     a dialog — there is no 'sofa-sit' info content by design).
    if (interactPressed && (activeZone === SOFA_SIT_ID || this.isSittingOnSofa)) {
      this.toggleSitOnSofa();
      return;
    }

    // While seated, the player is frozen — skip physics-input processing,
    // pin them to the sofa, and let the camera continue to follow. Player
    // can only stand up via the sit/stand toggle above.
    if (this.isSittingOnSofa) {
      const seat = this.layout.getSofaSitPoint();
      if (seat) this.player.sprite.setX(seat.x);
      this.player.sprite.setVelocityX(0);
      this.hud.update();
      // Keep elevator/doors/LEDs alive so the world doesn't freeze.
      const cabY = this.elevatorCtrl.elevator.getY();
      for (const door of this.layout.shaftDoors) door.update(cabY, delta);
      this.layout.updateShaftCable(this.elevatorCtrl);
      this.layout.updateFloorLEDs(this.elevatorCtrl);
      return;
    }

    this.player.update(delta);
    this.hud.update();

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

    // Keyboard floor-call: digit keys 0..4 map to the visual floor order
    // (F0 = lobby at the bottom, F4 = executive at the top). Only honoured
    // while the player is riding the cab — matches the on-screen ▲/▼ buttons.
    if (this.elevatorCtrl.isOnElevator) {
      this.handleFloorCallInput();
    }

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

  /**
   * Toggle the player's seated state on the lobby sofa. Sitting down snaps
   * them to the sofa sit point, halts their movement, and accelerates the
   * lobby wall clock so time "passes faster" while they rest. Standing up
   * restores normal movement and real-time clock speed.
   */
  private toggleSitOnSofa(): void {
    const body = this.player.sprite.body as Phaser.Physics.Arcade.Body;
    if (this.isSittingOnSofa) {
      this.isSittingOnSofa = false;
      this.layout.setClockSpeed(1);
      // Restore standing pose BEFORE re-enabling gravity + snap the sprite
      // back to its pre-sit y. Otherwise the squashed body overlaps the
      // floor collider and re-enabled gravity tunnels the player through.
      this.player.sprite.setScale(1, 1);
      this.player.sprite.setY(this.preSitY);
      this.player.sprite.setVelocity(0, 0);
      body.setAllowGravity(true);
      body.updateFromGameObject();
      eventBus.emit('music:pop');
      return;
    }
    const seat = this.layout.getSofaSitPoint();
    if (!seat) return;
    this.isSittingOnSofa = true;
    // Remember standing y so we can restore it cleanly on stand-up.
    this.preSitY = this.player.sprite.y;
    // Snap onto the sofa cushion with a squashed pose so the player
    // clearly reads as seated rather than standing on top of it.
    this.player.sprite.setVelocity(0, 0);
    this.player.sprite.setX(seat.x);
    // seat.y is the sofa image centre; cushion top is ~15 px above. With a
    // 0.7 scaleY the sprite's visual height shortens, so plant it a bit
    // higher than the standing y to sit on the cushion.
    this.player.sprite.setY(seat.y - 12);
    this.player.sprite.setScale(1, 0.7);
    body.setAllowGravity(false);
    this.player.sprite.anims.stop();
    this.player.sprite.setFrame(0);
    // 60× real-time while seated — time really flies.
    this.layout.setClockSpeed(60);
    // Swap the lobby music for a gentle lullaby while resting.
    eventBus.emit('music:push', 'music_lullaby');
  }

  private enterFloor(floorId: FloorId, direction: 'left' | 'right' = 'left'): void {
    if (this.isTransitioning) return;
    this.isTransitioning = true;
    this.progression.setCurrentFloor(floorId);
    const sceneKey = ElevatorFloorTransitionManager.resolveSceneKey(floorId, direction);
    this.cameras.main.fadeOut(500, 0, 0, 0);
    this.time.delayedCall(500, () => this.scene.start(sceneKey));
  }

  /**
   * Translate digit-key presses into a `moveToFloor` call. Digits map by
   * visual stack order (the same order the cab's button panel uses): the
   * lowest-indexed digit selects the bottom-most floor (lobby = F0), and
   * the highest selects the top-most.
   */
  private handleFloorCallInput(): void {
    const positions = this.getFloorYPositions();
    // Sort so the bottom floor (largest Y) comes first → visual index 0.
    const visualOrder = Object.entries(positions)
      .map(([id, y]) => ({ id: Number(id) as FloorId, y }))
      .sort((a, b) => b.y - a.y);

    const inputs = this.inputs;
    const actions: readonly GameAction[] = [
      'ElevatorCallFloor0', 'ElevatorCallFloor1', 'ElevatorCallFloor2',
      'ElevatorCallFloor3', 'ElevatorCallFloor4',
    ];
    for (let i = 0; i < visualOrder.length && i < actions.length; i++) {
      if (inputs.justPressed(actions[i])) {
        this.elevatorCtrl.elevator.moveToFloor(visualOrder[i].id);
        return;
      }
    }
  }
}
