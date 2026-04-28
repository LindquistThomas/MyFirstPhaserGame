import * as Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, FLOORS, TILE_SIZE, FloorId } from '../../config/gameConfig';
import { theme } from '../../style/theme';
import { Player } from '../../entities/Player';
import { Elevator } from '../../entities/Elevator';
import { HUD } from '../../ui/HUD';
import { ElevatorButtons } from '../../ui/ElevatorButtons';
import { ElevatorPanel } from '../../ui/ElevatorPanel';
import { WelcomeModal } from '../../ui/WelcomeModal';
import { ControlHintsOverlay } from '../../ui/ControlHintsOverlay';
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
import { LAZY_SCENE_LOADERS } from '../lazySceneLoaders';

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
  private elevatorPanel?: ElevatorPanel;
  private floorCallButtons: FloorCallButton[] = [];

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

  /** Control hints overlay — shown on first visit, dismissed per action or after 30 s. */
  private controlHints?: ControlHintsOverlay;
  /** Whether the welcome modal is currently open (blocks control hints). */
  private welcomeModalOpen = false;

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
  private static readonly SPAWN_OFFSET = 56;
  /** How close the player must stand to a shaft-side call button to use it. */
  private static readonly CALL_BUTTON_RADIUS = 54;
  private static readonly CALL_BUTTON_RADIUS_SQ =
    ElevatorScene.CALL_BUTTON_RADIUS * ElevatorScene.CALL_BUTTON_RADIUS;

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
  }

  create(): void {
    this.isTransitioning = false;
    this.floorCallButtons = [];
    this.zoneManager.bindScene(this);
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
    this.createFloorCallButtons(positions);

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
      onOpen: (id) => {
        this.gameState.markSeen(id);
        this.gameState.checkAchievements();
      },
      onClose: (id) => {
        if (id === ELEVATOR_INFO_ID) {
          this.zones.elevatorInfoIcon?.markAsSeen();
        } else if (id === WELCOME_BOARD_ID) {
          this.zones.lobbyBoardIcon?.markAsSeen();
        } else if (id === GEIR_F4_ID) {
          this.zones.geirInfoIcon?.markAsSeen();
        }
        this.gameState.checkAchievements();
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
      elevatorPanel: () => this.elevatorPanel,
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

    // First-time onboarding: show welcome modal on a fresh save.
    this.maybeShowOnboarding();

    // Mark the starting floor as visited and check for first-time achievements.
    this.progression.markFloorVisited(this.progression.getCurrentFloor());
    this.gameState.checkAchievements();
  }

  /** Show the welcome modal + control hints overlay on the player's first visit. */
  private maybeShowOnboarding(): void {
    if (this.gameState.isOnboardingComplete()) return;

    this.welcomeModalOpen = true;
    new WelcomeModal(this, () => {
      this.welcomeModalOpen = false;
      this.gameState.completeOnboarding();
      // Control hints appear once the welcome card is dismissed.
      this.controlHints = new ControlHintsOverlay(this);
    });
  }

  /* ---- player ---- */
  private createPlayer(positions: Record<FloorId, number>): void {
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
  private resolveInitialSpawn(positions: Record<FloorId, number>): { x: number; y: number } {
    if (this.spawnAtProductDoor) {
      const productsWalkY = positions[FLOORS.PRODUCTS] + ElevatorScene.FLOOR_H;
      const door = ProductDoorManager.doors.find((d) => d.contentId === this.spawnAtProductDoor);
      if (door) {
        return { x: door.x, y: productsWalkY - ElevatorScene.SPAWN_OFFSET };
      }
    }
    if (this.spawnAtFloor !== undefined && this.spawnAtFloor !== FLOORS.LOBBY) {
      const walkY = positions[this.spawnAtFloor] + ElevatorScene.FLOOR_H;
      return this.resolveShaftSideSpawn(walkY, this.spawnAtFloorSide);
    }
    const currentFloor = this.progression.getCurrentFloor();
    if (currentFloor !== FLOORS.LOBBY && positions[currentFloor] !== undefined) {
      const walkY = positions[currentFloor] + ElevatorScene.FLOOR_H;
      return this.resolveShaftSideSpawn(walkY, 'left');
    }
    const lobbyY = positions[FLOORS.LOBBY];
    return { x: 110, y: lobbyY + ElevatorScene.FLOOR_H - ElevatorScene.SPAWN_OFFSET };
  }

  private resolveShaftSideSpawn(walkY: number, side: 'left' | 'right'): { x: number; y: number } {
    const cx = GAME_WIDTH / 2;
    const sw = ElevatorScene.SHAFT_WIDTH;
    const x = side === 'right' ? cx + sw / 2 + 60 : cx - sw / 2 - 60;
    return { x, y: walkY - ElevatorScene.SPAWN_OFFSET };
  }

  /* ---- elevator ---- */
  private buildElevator(positions: Record<FloorId, number>): Elevator {
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

    this.add.text(GAME_WIDTH / 2, GAME_HEIGHT - 30, '\u2191\u2193  Ride Elevator  |  0-5  Call Floor  |  ENTER  Call/Open  |  \u2190 \u2192  Walk  |  SPACE  Flip', {
      fontFamily: 'monospace', fontSize: '14px', color: '#8899aa',
    }).setOrigin(0.5).setDepth(50).setScrollFactor(0);

    this.elevatorButtons = new ElevatorButtons(this, 56);
    this.elevatorPanel = new ElevatorPanel(
      this,
      this.progression,
      (floorId) => this.callFloorIfUnlocked(floorId),
    );
  }

  /**
   * Attempt to call the elevator cab to a floor.
   * Silently ignores the request if the floor is still locked — guards both
   * the ElevatorPanel pointer interaction and the keyboard floor-call path.
   */
  private callFloorIfUnlocked(floorId: FloorId): void {
    if (this.progression.isFloorUnlocked(floorId)) {
      this.elevatorCtrl.elevator.moveToFloor(floorId);
    }
  }

  /** Draw one hallway call button on each side of every shaft opening. */
  private createFloorCallButtons(positions: Record<FloorId, number>): void {
    const cx = GAME_WIDTH / 2;
    const sw = ElevatorScene.SHAFT_WIDTH;
    const sides: Array<{ side: 'left' | 'right'; x: number }> = [
      { side: 'left', x: cx - sw / 2 - 28 },
      { side: 'right', x: cx + sw / 2 + 28 },
    ];

    const floorIds = Object.keys(positions).map((id) => Number(id) as FloorId);
    for (const floorId of floorIds) {
      const floorY = positions[floorId];
      const y = floorY + ElevatorScene.FLOOR_H - 88;
      for (const { side, x } of sides) {
        const container = this.add.container(x, y).setDepth(4);
        const panel = this.add.graphics();
        panel.fillStyle(0x101018, 0.95);
        panel.fillRoundedRect(-14, -18, 28, 36, 4);
        panel.lineStyle(1, 0x6a6a82, 1);
        panel.strokeRoundedRect(-14, -18, 28, 36, 4);
        panel.fillStyle(0x223344, 1);
        panel.fillCircle(0, -6, 6);
        panel.lineStyle(1, 0x88bbff, 1);
        panel.strokeCircle(0, -6, 6);
        panel.fillStyle(0x44ccff, 1);
        panel.fillTriangle(-5, 8, 5, 8, 0, -1);
        container.add(panel);

        const prompt = this.add.text(0, -36, 'CALL', {
          fontFamily: 'monospace',
          fontSize: '11px',
          color: theme.color.css.textWhite,
          backgroundColor: theme.color.css.bgPanel,
          padding: { x: 4, y: 2 },
        }).setOrigin(0.5).setVisible(false);
        container.add(prompt);

        this.floorCallButtons.push({ floorId, side, x, y, prompt });
      }
    }
  }

  private getActiveFloorCallButton(): FloorCallButton | undefined {
    if (this.elevatorCtrl.isOnElevator) return undefined;
    const px = this.player.sprite.x;
    const py = this.player.sprite.y;
    return this.floorCallButtons.find((button) => {
      const dx = px - button.x;
      const dy = py - button.y;
      return this.progression.isFloorUnlocked(button.floorId)
        && dx * dx + dy * dy <= ElevatorScene.CALL_BUTTON_RADIUS_SQ;
    });
  }

  private updateFloorCallButtonPrompts(activeButton?: FloorCallButton): void {
    for (const button of this.floorCallButtons) {
      button.prompt.setVisible(button === activeButton);
    }
  }

  /* ---- helpers ---- */
  /**
   * Absolute Y (world coords) of the TOP of each floor's tile slab.
   * Values are chosen so floors are evenly spaced with the lobby at the
   * bottom and executive at the top; {@link computeShaftExtent} derives
   * the shaft range from these.
   */
  private getFloorYPositions(): Record<FloorId, number> {
    return {
      [FLOORS.LOBBY]: 2410,
      [FLOORS.PLATFORM_TEAM]: 1936,
      [FLOORS.PRODUCTS]: 1462,
      [FLOORS.BUSINESS]: 988,
      [FLOORS.EXECUTIVE]: 514,
      [FLOORS.BOSS]: 40,
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

    // Keep the Player ticking while a dialog is open so it can react to
    // the `modal` input context (zeroing velocity, switching to `idle`).
    // Everything else in the elevator (cab, doors, buttons) intentionally
    // pauses — the player is just reading the dialog.
    if (this.dialogs.isOpen) {
      this.player.update(delta);
      this.hud.update();
      return;
    }

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

    const activeCallButton = this.getActiveFloorCallButton();
    this.updateFloorCallButtonPrompts(activeCallButton);
    if (interactPressed && activeCallButton) {
      this.callFloorIfUnlocked(activeCallButton.floorId);
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
      this.layout.updateFacadeMotion(this.elevatorCtrl, delta);
      return;
    }

    this.player.update(delta);
    this.hud.update();

    // Tick control hints overlay while gameplay is running (not modal-blocked).
    if (!this.welcomeModalOpen) this.controlHints?.update();

    // The elevator cab zone overlaps MoveUp (ArrowUp is bound to both
    // MoveUp and ToggleInfo). If we let ToggleInfo open the cab info
    // dialog here, pressing Up on the cab would open the dialog instead
    // of riding, and while the dialog is open the cab is frozen — the
    // "can't ride the cab" regression. Cab info is still reachable via
    // the clickable HUD icon or Enter (Interact) — see below.
    const infoOpenTrigger =
      activeZone === ELEVATOR_INFO_ID ? interactPressed : infoPressed;
    if (infoOpenTrigger && activeZone && !this.dialogs.isOpen) {
      this.dialogs.open(activeZone);
      return;
    }

    const btnState = this.elevatorButtons?.getState();
    this.elevatorCtrl.update(
      { up: inputs.isDown('MoveUp'), down: inputs.isDown('MoveDown') },
      btnState ? { up: btnState.up, down: btnState.down } : undefined,
      delta,
    );

    // Keyboard floor-call: digit keys 0..5 map to the visual floor order
    // (F0 = lobby at the bottom, F5 = boardroom at the top). Only honoured
    // while the player is riding the cab — matches the on-screen ▲/▼ buttons.
    if (this.elevatorCtrl.isOnElevator) {
      this.handleFloorCallInput();
    }

    const cabY = this.elevatorCtrl.elevator.getY();
    for (const door of this.layout.shaftDoors) door.update(cabY, delta);
    this.layout.updateShaftCable(this.elevatorCtrl);
    this.layout.updateFloorLEDs(this.elevatorCtrl);
    this.layout.updateFacadeMotion(this.elevatorCtrl, delta);

    // Keep progression.currentFloor aligned with the player while riding.
    // Hallway call buttons can move the cab without the player, and that must
    // not rewrite the saved player floor.
    const elevFloor = this.elevatorCtrl.elevator.getCurrentFloor() as FloorId;
    if (this.elevatorCtrl.isOnElevator && elevFloor !== this.progression.getCurrentFloor()) {
      this.progression.setCurrentFloor(elevFloor);
    }

    this.transitions.clearSkipWhenBackOnElevator();
    this.transitions.checkFloorEntry();
    this.doors.update(interactPressed);

    // Fade the elevator panel when the player stands behind it.
    if (this.elevatorPanel) {
      const cam = this.cameras.main;
      const px = this.player.sprite.x - cam.scrollX;
      const py = this.player.sprite.y - cam.scrollY;
      this.elevatorPanel.update(px, py);
    }
  }

  private enterProductDoor(door: ProductDoor): void {
    if (this.isTransitioning) return;
    this.isTransitioning = true;
    this.progression.setCurrentFloor(FLOORS.PRODUCTS);
    this.cameras.main.fadeOut(500, 0, 0, 0);
    void this.lazyStartScene(door.sceneKey);
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
    void this.lazyStartScene(sceneKey);
  }

  /**
   * Registers the scene class with Phaser on first use (via a dynamic import
   * that Vite splits into its own chunk), then starts it once the 500 ms fade
   * has elapsed. The fetch and the fade run concurrently — on fast connections
   * there is no extra black-screen time beyond the animation itself.
   *
   * On failure (e.g. network error) the fade is reversed so the player can
   * retry the transition.
   */
  private async lazyStartScene(sceneKey: string): Promise<void> {
    const fadeDelay = new Promise<void>((resolve) => {
      this.time.delayedCall(500, () => resolve());
    });

    try {
      const loader = LAZY_SCENE_LOADERS.get(sceneKey);
      if (loader && !this.scene.get(sceneKey)) {
        const [cls] = await Promise.all([loader(), fadeDelay]);
        this.scene.add(sceneKey, cls, false);
      } else {
        await fadeDelay;
      }
      this.scene.start(sceneKey);
    } catch (err: unknown) {
      console.error(`[ElevatorScene] Failed to load scene "${sceneKey}":`, err);
      this.isTransitioning = false;
      this.cameras.main.fadeIn(300, 0, 0, 0);
    }
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
      'ElevatorCallFloor3', 'ElevatorCallFloor4', 'ElevatorCallFloor5',
    ];
    for (let i = 0; i < visualOrder.length && i < actions.length; i++) {
      if (inputs.justPressed(actions[i]!)) {
        this.callFloorIfUnlocked(visualOrder[i]!.id);
        return;
      }
    }
  }
}

interface FloorCallButton {
  floorId: FloorId;
  side: 'left' | 'right';
  x: number;
  y: number;
  prompt: Phaser.GameObjects.Text;
}
