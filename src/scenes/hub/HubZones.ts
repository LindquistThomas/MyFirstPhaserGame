import * as Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../../config/gameConfig';
import { QUIZ_DATA } from '../../config/quizData';
import { eventBus } from '../../systems/EventBus';
import { ZoneManager } from '../../systems/ZoneManager';
import { hasBeenSeen } from '../../systems/InfoDialogManager';
import { isQuizPassed } from '../../systems/QuizManager';
import { Player } from '../../entities/Player';
import { ElevatorButtons } from '../../ui/ElevatorButtons';
import { DialogController } from '../../ui/DialogController';
import { InfoIcon } from '../../ui/InfoIcon';

export const ELEVATOR_INFO_ID = 'architecture-elevator';
export const WELCOME_BOARD_ID = 'welcome-board';

const BOARD_RADIUS = 120;
const INFO_ICON_X_OFFSET = 310;
const INFO_ICON_Y = GAME_HEIGHT - 30;

export interface HubZonesOptions {
  scene: Phaser.Scene;
  zoneManager: ZoneManager;
  dialogs: DialogController;
  player: Player;
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
 * Owns the hub's zone registrations, the two lobby info icons, and the
 * "first-ride" elevator-info flow. Encapsulates what used to be
 * `HubScene.registerZones` + `setupElevatorInfo` + `createInfoIcon` and
 * their private fields.
 *
 * Designed to be created once per scene in `create()`; listener cleanup is
 * wired to the scene's `shutdown` event so reuse across restarts is safe.
 */
export class HubZones {
  /** Info icon for the elevator zone — created lazily after the first dialog close. */
  elevatorInfoIcon?: InfoIcon;
  /** Info icon for the lobby welcome board. */
  lobbyBoardIcon?: InfoIcon;
  /** True until the first elevator ride triggers the intro dialog. */
  showElevatorInfoOnFirstRide = false;

  private readonly opts: HubZonesOptions;

  constructor(opts: HubZonesOptions) {
    this.opts = opts;
    this.register();
    this.setupElevatorInfo();
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
      GAME_WIDTH / 2 + INFO_ICON_X_OFFSET, INFO_ICON_Y,
      () => dialogs.open(WELCOME_BOARD_ID),
    );
    this.lobbyBoardIcon.setVisible(false);

    const onEnter = (zoneId: string) => {
      if (zoneId === ELEVATOR_INFO_ID) {
        this.opts.elevatorButtons()?.setVisible(true);
        this.elevatorInfoIcon?.setVisible(true);
      } else if (zoneId === WELCOME_BOARD_ID) {
        this.lobbyBoardIcon?.setVisible(true);
      }
    };

    const onExit = (zoneId: string) => {
      if (zoneId === ELEVATOR_INFO_ID) {
        this.opts.elevatorButtons()?.setVisible(false);
        this.elevatorInfoIcon?.setVisible(false);
      } else if (zoneId === WELCOME_BOARD_ID) {
        this.lobbyBoardIcon?.setVisible(false);
      }
    };

    eventBus.on('zone:enter', onEnter);
    eventBus.on('zone:exit', onExit);

    scene.events.once('shutdown', () => {
      eventBus.off('zone:enter', onEnter);
      eventBus.off('zone:exit', onExit);
    });
  }

  private setupElevatorInfo(): void {
    if (hasBeenSeen(ELEVATOR_INFO_ID)) {
      this.showElevatorInfoOnFirstRide = false;
      this.createElevatorInfoIcon();
    } else {
      // The icon is created after the first dialog close — see onElevatorInfoSeen().
      this.showElevatorInfoOnFirstRide = true;
    }
  }

  /** Called by the dialog controller's onClose hook after the first viewing. */
  onElevatorInfoSeen(): void {
    if (!this.elevatorInfoIcon) {
      this.createElevatorInfoIcon();
    }
  }

  private createElevatorInfoIcon(): void {
    const { scene, dialogs } = this.opts;
    this.elevatorInfoIcon = new InfoIcon(
      scene,
      GAME_WIDTH / 2 + INFO_ICON_X_OFFSET, INFO_ICON_Y,
      () => dialogs.open(ELEVATOR_INFO_ID),
    );
    this.elevatorInfoIcon.setVisible(false);
    if (QUIZ_DATA[ELEVATOR_INFO_ID]) {
      this.elevatorInfoIcon.setQuizBadge(scene, isQuizPassed(ELEVATOR_INFO_ID));
    }
  }
}

