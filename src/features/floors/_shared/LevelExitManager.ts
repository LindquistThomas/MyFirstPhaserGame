import * as Phaser from 'phaser';
import { FLOORS, type FloorId } from '../../../config/gameConfig';
import type { Player } from '../../../entities/Player';
import type { GameStateManager } from '../../../systems/GameStateManager';
import type { CallElevatorButton } from '../../../ui/CallElevatorButton';
import { allKeyLabels } from '../../../input';
import { getDailyState } from '../../../systems/DailyChallenge';
import { hasCompletionStreakEndingAt, recordResult } from '../../../systems/DailyChallengeStore';
import { theme } from '../../../style/theme';
import type { LevelConfig } from './LevelConfig';
import type { NavigationContext } from '../../../scenes/NavigationContext';

export interface ExitManagerDeps {
  scene: Phaser.Scene;
  floorId: FloorId;
  gameState: GameStateManager;
  /** Lazily resolves the player created in `LevelScene.createPlayer()`. */
  getPlayer: () => Player;
  /** Lazily resolves the interact-prompt text created in `LevelScene.createPlayer()`. */
  getInteractPrompt: () => Phaser.GameObjects.Text | undefined;
  getIsTransitioning: () => boolean;
  setIsTransitioning: (value: boolean) => void;
  getReturnSide: () => 'left' | 'right';
  /** Lazily resolves the call-elevator button created in `LevelScene.createUI()`. */
  getCallElevBtn: () => CallElevatorButton;
}

/**
 * Owns the exit door, exit-proximity detection, and the elevator-return
 * transition.
 *
 *   - `create(config)` — places the exit door image + label.
 *   - `setDoorOpen(open)` — swaps closed/open door texture.
 *   - `checkExitProximity()` — distance check + Interact trigger.
 *   - `returnToElevator()` — daily-challenge bookkeeping + fade + scene switch.
 */
export class LevelExitManager {
  /** The exit-door image.  Exposed so subclass `checkExitProximity` overrides
   *  can read `this.exitDoor.x / .y` via the `LevelScene` protected getter. */
  exitDoor!: Phaser.GameObjects.Image;

  constructor(private readonly deps: ExitManagerDeps) {}

  // ---- door creation -------------------------------------------------------------

  /**
   * Place the exit door and "← ELEVATOR" label.
   * Called from `LevelScene.createExit()`.
   */
  create(config: LevelConfig): void {
    const { scene } = this.deps;
    const { x, y } = config.exitPosition;
    this.exitDoor = scene.add.image(x, y, 'door_exit').setDepth(4);
    this.exitDoor.setInteractive({ useHandCursor: true });
    this.exitDoor.on('pointerdown', () => scene.inputs.emit('Interact'));
    scene.add.text(x, y - 70, '\u2190 ELEVATOR', {
      fontFamily: 'monospace', fontSize: '15px', color: theme.color.css.textPanel,
    }).setOrigin(0.5).setDepth(5);
  }

  // ---- door open/close -----------------------------------------------------------

  /**
   * Swap the exit door between the closed and open textures.
   * Called from `LevelScene.setExitDoorOpen()`.
   */
  setDoorOpen(open: boolean): void {
    const key = open ? 'door_exit_open' : 'door_exit';
    if (this.exitDoor.texture.key !== key) this.exitDoor.setTexture(key);
  }

  // ---- proximity check -----------------------------------------------------------

  /**
   * Called from `LevelScene.checkExitProximity()` (and therefore from
   * `LevelScene.update()`).  Subclass overrides that call `super.checkExitProximity()`
   * route through the `LevelScene` stub which delegates here.
   */
  checkExitProximity(): void {
    const { scene, getPlayer, getInteractPrompt } = this.deps;
    const player = getPlayer();
    const interactPrompt = getInteractPrompt();
    const d = Phaser.Math.Distance.Between(
      player.sprite.x, player.sprite.y,
      this.exitDoor.x, this.exitDoor.y,
    );
    const near = d < 90;
    this.setDoorOpen(near);
    if (near) {
      interactPrompt
        ?.setText(`Press ${allKeyLabels('Interact')} \u2192 Elevator`)
        .setPosition(this.exitDoor.x - 60, this.exitDoor.y - 90)
        .setVisible(true);
      if (scene.inputs.justPressed('Interact')) this.returnToElevator();
    } else {
      interactPrompt?.setVisible(false);
    }
  }

  // ---- transition ----------------------------------------------------------------

  /**
   * Fade out and start `ElevatorScene`.  Called from
   * `LevelScene.returnToElevator()`.
   */
  returnToElevator(): void {
    const {
      scene, floorId, gameState,
      getIsTransitioning, setIsTransitioning,
      getReturnSide, getCallElevBtn,
    } = this.deps;

    if (getIsTransitioning()) return;
    setIsTransitioning(true);
    getCallElevBtn().setVisible(false);

    // Start the run timer when leaving the lobby for the first time.
    if (floorId === FLOORS.LOBBY) {
      gameState.playtime.startRun();
    }

    // Daily-challenge bookkeeping.
    const daily = getDailyState(scene.registry);
    if (daily && floorId !== FLOORS.LOBBY) {
      const runMs = gameState.playtime.getRunElapsedMs();
      if (runMs > 0) {
        recordResult(daily.dateKey, runMs);
        if (hasCompletionStreakEndingAt(daily.dateKey, 3)) {
          gameState.unlockAchievement('daily-streak-3');
        }
      }
    }

    scene.cameras.main.fadeOut(500, 0, 0, 0);
    const ctx: NavigationContext = {
      fromFloor: floorId,
      spawnSide: getReturnSide(),
    };
    scene.time.delayedCall(500, () => scene.scene.start('ElevatorScene', ctx));
  }
}
