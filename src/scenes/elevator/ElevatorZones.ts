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
export const GEIR_F4_ID = 'exec-geir-harald';
export const RECEPTION_GREETING_ID = 'reception-greeting';
export const SOFA_SIT_ID = 'sofa-sit';

const BOARD_RADIUS = 70;
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
  /**
   * Optional proximity rect for Geir Harald's walkway area on the F4 shaft
   * preview. Absent if the layout hasn't drawn him yet (older saves or
   * scene variants).
   */
  geirBounds?: { x: number; y: number; width: number; height: number };
  /**
   * Optional proximity rect for the reception desk. Players inside this
   * area see the receptionist's "Hello!" speech bubble.
   */
  receptionBounds?: { x: number; y: number; width: number; height: number };
  /**
   * Speech-bubble container toggled by the reception-greeting zone. Start
   * hidden; zone:enter shows it, zone:exit hides it. Purely cosmetic —
   * there is no info icon or dialog for this zone.
   */
  receptionBubble?: Phaser.GameObjects.Container;
  /**
   * Optional proximity rect for the lobby sofa. When the player is inside
   * this rect, the scene allows pressing Enter to sit/stand. No visible
   * prompt is shown — discovery is intentional.
   */
  sofaBounds?: { x: number; y: number; width: number; height: number };
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

    // --- Geir Harald zone — active when player walks into his pacing area
    //     on the F4 walkway preview. Registered FIRST so getActiveZone()
    //     prefers Geir over the lobby welcome board when overlapping.
    if (this.opts.geirBounds) {
      const gb = this.opts.geirBounds;
      const rect = new Phaser.Geom.Rectangle(gb.x, gb.y, gb.width, gb.height);
      zoneManager.register(GEIR_F4_ID, () =>
        !this.opts.isPlayerOnElevator()
          && Phaser.Geom.Rectangle.Contains(rect, player.sprite.x, player.sprite.y),
      );
    }

    // --- Elevator zone — active while player is standing on the cab ---
    zoneManager.register(ELEVATOR_INFO_ID, () => this.opts.isPlayerOnElevator());

    // --- Welcome board zone — active within BOARD_RADIUS of the board ---
    zoneManager.register(WELCOME_BOARD_ID, () =>
      Phaser.Math.Distance.Between(
        player.sprite.x, player.sprite.y,
        this.opts.boardX, this.opts.boardY,
      ) < BOARD_RADIUS,
    );

    // --- Reception greeting zone — registered AFTER welcome board so
    //     getActiveZone() prefers the welcome board on any overlap.
    //     Decorative only: no info icon, no dialog — just toggles the
    //     receptionist's speech bubble.
    if (this.opts.receptionBounds) {
      const rb = this.opts.receptionBounds;
      const rect = new Phaser.Geom.Rectangle(rb.x, rb.y, rb.width, rb.height);
      zoneManager.register(RECEPTION_GREETING_ID, () =>
        Phaser.Geom.Rectangle.Contains(rect, player.sprite.x, player.sprite.y),
      );
    }

    // --- Sofa zone — active when the player is near the lobby sofa.
    //     The scene owns the sit/stand toggle; this zone just gates the
    //     prompt bubble's visibility.
    if (this.opts.sofaBounds) {
      const sb = this.opts.sofaBounds;
      const rect = new Phaser.Geom.Rectangle(sb.x, sb.y, sb.width, sb.height);
      zoneManager.register(SOFA_SIT_ID, () =>
        !this.opts.isPlayerOnElevator()
          && Phaser.Geom.Rectangle.Contains(rect, player.sprite.x, player.sprite.y),
      );
    }

    this.lobbyBoardIcon = new InfoIcon(
      scene,
      INFO_ICON_X, INFO_ICON_Y,
      () => dialogs.open(WELCOME_BOARD_ID),
      WELCOME_BOARD_ID,
    );
    this.lobbyBoardIcon.setVisible(false);

    if (this.opts.geirBounds) {
      this.geirInfoIcon = new InfoIcon(
        scene,
        INFO_ICON_X, INFO_ICON_Y,
        () => dialogs.open(GEIR_F4_ID),
        GEIR_F4_ID,
      );
      this.geirInfoIcon.setVisible(false);
    }

    const lifecycle = createSceneLifecycle(scene);
    lifecycle.bindEventBus('zone:enter', (zoneId) => {
      if (zoneId === ELEVATOR_INFO_ID) {
        this.opts.elevatorButtons()?.setVisible(true);
        this.elevatorInfoIcon?.setVisible(true);
      } else if (zoneId === WELCOME_BOARD_ID) {
        this.lobbyBoardIcon?.setVisible(true);
      } else if (zoneId === GEIR_F4_ID) {
        this.geirInfoIcon?.setVisible(true);
      } else if (zoneId === RECEPTION_GREETING_ID) {
        this.opts.receptionBubble?.setVisible(true);
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
      } else if (zoneId === RECEPTION_GREETING_ID) {
        this.opts.receptionBubble?.setVisible(false);
      }
    });
  }

  private createElevatorInfoIcon(): void {
    const { scene, dialogs } = this.opts;
    // Cab-info opens on Enter (Interact), not ArrowUp (ToggleInfo), because
    // ArrowUp is the MoveUp ride control while standing on the cab — see
    // ElevatorScene.update. The teaching hint mirrors that so first-time
    // players see the correct key.
    this.elevatorInfoIcon = new InfoIcon(
      scene,
      INFO_ICON_X, INFO_ICON_Y,
      () => dialogs.open(ELEVATOR_INFO_ID),
      ELEVATOR_INFO_ID,
      false,
      'Interact',
    );
    this.elevatorInfoIcon.setVisible(false);
    if (QUIZ_DATA[ELEVATOR_INFO_ID]) {
      this.elevatorInfoIcon.setQuizBadge(scene, this.opts.gameState.isQuizPassed(ELEVATOR_INFO_ID));
    }
  }

  /**
   * Spatial shapes for debug overlay: the welcome-board circle in the lobby
   * and Geir's walkway rect on F4. The elevator zone is predicate-driven
   * (player-on-cab) and has no spatial extent.
   */
  getDebugZones(): DebugZone[] {
    const { zoneManager, boardX, boardY } = this.opts;
    const activeId = zoneManager.getActiveZone();
    const out: DebugZone[] = [
      {
        id: WELCOME_BOARD_ID,
        shape: 'circle',
        x: boardX,
        y: boardY,
        radius: BOARD_RADIUS,
        active: activeId === WELCOME_BOARD_ID,
      },
    ];
    if (this.opts.geirBounds) {
      const gb = this.opts.geirBounds;
      out.push({
        id: GEIR_F4_ID,
        shape: 'rect',
        x: gb.x,
        y: gb.y,
        width: gb.width,
        height: gb.height,
        active: activeId === GEIR_F4_ID,
      });
    }
    if (this.opts.receptionBounds) {
      const rb = this.opts.receptionBounds;
      out.push({
        id: RECEPTION_GREETING_ID,
        shape: 'rect',
        x: rb.x,
        y: rb.y,
        width: rb.width,
        height: rb.height,
        active: activeId === RECEPTION_GREETING_ID,
      });
    }
    if (this.opts.sofaBounds) {
      const sb = this.opts.sofaBounds;
      out.push({
        id: SOFA_SIT_ID,
        shape: 'rect',
        x: sb.x,
        y: sb.y,
        width: sb.width,
        height: sb.height,
        active: activeId === SOFA_SIT_ID,
      });
    }
    return out;
  }
}
