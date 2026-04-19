import * as Phaser from 'phaser';
import { QUIZ_DATA } from '../../config/quiz';
import { createSceneLifecycle } from '../../systems/sceneLifecycle';
import { ZoneManager } from '../../systems/ZoneManager';
import { GameStateManager } from '../../systems/GameStateManager';
import { Player } from '../../entities/Player';
import { ElevatorButtons } from '../../ui/ElevatorButtons';
import { DialogController } from '../../ui/DialogController';
import { InfoIcon } from '../../ui/InfoIcon';

export const ELEVATOR_INFO_ID = 'architecture-elevator';
export const WELCOME_BOARD_ID = 'welcome-board';
export const GEIR_F4_ID = 'exec-geir-harald';

const BOARD_RADIUS = 120;
/**
 * Info icons live in the HUD top bar (top bar is 44 px tall, center y = 22).
 * Placed left of the title and right of the AU counter.
 */
const INFO_ICON_X = 210;
const INFO_ICON_Y = 22;

export interface ElevatorZonesOptions {
  scene: Phaser.Scene;
  zoneManager: ZoneManager;
  dialogs: DialogController;
  player: Player;
  gameState: GameStateManager;
  /** Elevator buttons — shown/hidden together with the elevator zone. */
  elevatorButtons: () => ElevatorButtons | undefined;
  /** Returns true while the player is physically standing on the elevator cab. */
  isPlayerOnElevator: () => boolean;
  /** Returns true when the elevator cab is docked at floor 4 (EXECUTIVE). */
  isCabAtExecutive: () => boolean;
  /** World-space x of the info board in the lobby. */
  boardX: number;
  /** World-space y of the info board center. */
  boardY: number;
}

/**
 * Owns the scene's zone registrations, the two lobby info icons, and the
 * "first-ride" elevator-info flow. Encapsulates what used to be
 * `ElevatorScene.registerZones` + `setupElevatorInfo` + `createInfoIcon` and
 * their private fields.
 *
 * Designed to be created once per scene in `create()`; listener cleanup is
 * wired to the scene's `shutdown` event so reuse across restarts is safe.
 */
export class ElevatorZones {
  /** Info icon for the elevator zone. */
  elevatorInfoIcon?: InfoIcon;
  /** Info icon for the lobby welcome board. */
  lobbyBoardIcon?: InfoIcon;
  /** Info icon for Geir Harald on F4. */
  geirInfoIcon?: InfoIcon;

  private readonly opts: ElevatorZonesOptions;

  constructor(opts: ElevatorZonesOptions) {
    this.opts = opts;
    this.register();
    this.createElevatorInfoIcon();
  }

  private register(): void {
    const { scene, zoneManager, dialogs, player } = this.opts;

    // --- Geir Harald zone — active when cab is docked at F4 and player is on it.
    //     Registered BEFORE the elevator zone so getActiveZone() prefers Geir. ---
    zoneManager.register(GEIR_F4_ID, () =>
      this.opts.isPlayerOnElevator() && this.opts.isCabAtExecutive(),
    );

    // --- Elevator zone — active while player is standing on the cab ---
    zoneManager.register(ELEVATOR_INFO_ID, () => this.opts.isPlayerOnElevator());

    // --- Welcome board zone — active within BOARD_RADIUS of the board ---
    zoneManager.register(WELCOME_BOARD_ID, () =>
      Phaser.Math.Distance.Between(
        player.sprite.x, player.sprite.y,
        this.opts.boardX, this.opts.boardY,
      ) < BOARD_RADIUS,
    );

    this.lobbyBoardIcon = new InfoIcon(
      scene,
      INFO_ICON_X, INFO_ICON_Y,
      () => dialogs.open(WELCOME_BOARD_ID),
      WELCOME_BOARD_ID,
    );
    this.lobbyBoardIcon.setVisible(false);

    this.geirInfoIcon = new InfoIcon(
      scene,
      INFO_ICON_X, INFO_ICON_Y,
      () => dialogs.open(GEIR_F4_ID),
      GEIR_F4_ID,
    );
    this.geirInfoIcon.setVisible(false);

    const lifecycle = createSceneLifecycle(scene);
    lifecycle.bindEventBus('zone:enter', (zoneId) => {
      if (zoneId === ELEVATOR_INFO_ID) {
        this.opts.elevatorButtons()?.setVisible(true);
        // Only show the elevator icon if Geir's zone isn't already active
        // (both are triggered when the cab reaches F4; Geir takes priority).
        if (!this.opts.isCabAtExecutive()) {
          this.elevatorInfoIcon?.setVisible(true);
        }
      } else if (zoneId === WELCOME_BOARD_ID) {
        this.lobbyBoardIcon?.setVisible(true);
      } else if (zoneId === GEIR_F4_ID) {
        // Geir wins the HUD slot while docked at F4.
        this.elevatorInfoIcon?.setVisible(false);
        this.geirInfoIcon?.setVisible(true);
      }
    });
    lifecycle.bindEventBus('zone:exit', (zoneId) => {
      if (zoneId === ELEVATOR_INFO_ID) {
        this.opts.elevatorButtons()?.setVisible(false);
        this.elevatorInfoIcon?.setVisible(false);
      } else if (zoneId === WELCOME_BOARD_ID) {
        this.lobbyBoardIcon?.setVisible(false);
      } else if (zoneId === GEIR_F4_ID) {
        this.geirInfoIcon?.setVisible(false);
        // Cab left F4 while player is still on it — restore the elevator icon.
        if (this.opts.isPlayerOnElevator()) {
          this.elevatorInfoIcon?.setVisible(true);
        }
      }
    });
  }

  private createElevatorInfoIcon(): void {
    const { scene, dialogs } = this.opts;
    this.elevatorInfoIcon = new InfoIcon(
      scene,
      INFO_ICON_X, INFO_ICON_Y,
      () => dialogs.open(ELEVATOR_INFO_ID),
      ELEVATOR_INFO_ID,
    );
    this.elevatorInfoIcon.setVisible(false);
    if (QUIZ_DATA[ELEVATOR_INFO_ID]) {
      this.elevatorInfoIcon.setQuizBadge(scene, this.opts.gameState.isQuizPassed(ELEVATOR_INFO_ID));
    }
  }
}

