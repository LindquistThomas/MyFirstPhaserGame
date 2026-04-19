import * as Phaser from 'phaser';
import { QUIZ_DATA } from '../../config/quiz';
import { createSceneLifecycle } from '../../systems/sceneLifecycle';
import { ZoneManager } from '../../systems/ZoneManager';
import { GameStateManager } from '../../systems/GameStateManager';
import { Player } from '../../entities/Player';
import { ElevatorButtons } from '../../ui/ElevatorButtons';
import { DialogController } from '../../ui/DialogController';
import { InfoIcon } from '../../ui/InfoIcon';
import type { DebugZone } from '../../features/floors/_shared/LevelZoneSetup';

export const ELEVATOR_INFO_ID = 'architecture-elevator';
export const WELCOME_BOARD_ID = 'welcome-board';

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
  /** World-space x of the info board in the lobby. */
  boardX: number;
  /** World-space y of the info board center. */
  boardY: number;
}

/**
 * Owns the scene's zone registrations and the two info icons (elevator cab +
 * lobby welcome board). Designed to be created once per scene in `create()`;
 * listener cleanup is wired to the scene's `shutdown` event so reuse across
 * restarts is safe.
 *
 * Geir Harald (F4) has a proximity zone in {@link ExecutiveSuiteScene} — he
 * is not reachable by the player in the elevator shaft preview, so there is
 * no Geir zone here.
 */
export class ElevatorZones {
  /** Info icon for the elevator zone. */
  elevatorInfoIcon?: InfoIcon;
  /** Info icon for the lobby welcome board. */
  lobbyBoardIcon?: InfoIcon;

  private readonly opts: ElevatorZonesOptions;

  constructor(opts: ElevatorZonesOptions) {
    this.opts = opts;
    this.register();
    this.createElevatorInfoIcon();
  }

  private register(): void {
    const { scene, zoneManager, dialogs, player } = this.opts;

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

    const lifecycle = createSceneLifecycle(scene);
    lifecycle.bindEventBus('zone:enter', (zoneId) => {
      if (zoneId === ELEVATOR_INFO_ID) {
        this.opts.elevatorButtons()?.setVisible(true);
        this.elevatorInfoIcon?.setVisible(true);
      } else if (zoneId === WELCOME_BOARD_ID) {
        this.lobbyBoardIcon?.setVisible(true);
      }
    });
    lifecycle.bindEventBus('zone:exit', (zoneId) => {
      if (zoneId === ELEVATOR_INFO_ID) {
        this.opts.elevatorButtons()?.setVisible(false);
        this.elevatorInfoIcon?.setVisible(false);
      } else if (zoneId === WELCOME_BOARD_ID) {
        this.lobbyBoardIcon?.setVisible(false);
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

  /**
   * Spatial shapes for debug overlay. Only the welcome-board zone is truly
   * spatial; the elevator zone is predicate-driven (player-on-cab) and isn't
   * drawn as a rectangle in the world.
   */
  getDebugZones(): DebugZone[] {
    const { zoneManager, boardX, boardY } = this.opts;
    const activeId = zoneManager.getActiveZone();
    return [
      {
        id: WELCOME_BOARD_ID,
        shape: 'circle',
        x: boardX,
        y: boardY,
        radius: BOARD_RADIUS,
        active: activeId === WELCOME_BOARD_ID,
      },
    ];
  }
}
