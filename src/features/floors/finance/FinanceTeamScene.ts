import * as Phaser from 'phaser';
import { GAME_HEIGHT, TILE_SIZE, FLOORS } from '../../../config/gameConfig';
import { LevelScene, LevelConfig } from '../_shared/LevelScene';
import { allKeyLabels } from '../../../input';

/**
 * Finance — now a content-only room accessed via a door inside the
 * Executive Suite, rather than a side of the Business floor.
 *
 * The architect rides the elevator to the penthouse (F4), then steps
 * through the "FINANCE" door to enter this room. Exit returns the
 * player to the Executive Suite next to the same door, mirroring the
 * product-hall/room pattern.
 *
 * FloorId reuses EXECUTIVE so token/quiz state is naturally namespaced
 * under the penthouse. No tokens are defined here — Finance is an
 * info/narrative room, not an AU-collection floor.
 */
export class FinanceTeamScene extends LevelScene {
  /** Door identifier used by ExecutiveSuiteScene to respawn next to this door. */
  static readonly DOOR_ID = 'finance';

  constructor() {
    super('FinanceTeamScene', FLOORS.EXECUTIVE);
  }

  protected override createDecorations(): void {
    const G = GAME_HEIGHT - TILE_SIZE;

    this.addAmbientPlants([
      { x: 90, kind: 'tall' },
      { x: 160, kind: 'small' },
    ]);

    this.addSignpost({ x: 260, label: '  FINANCE', color: '#b8ffd1' });

    // Trading-desk style monitors — proxy for FP&A dashboards.
    this.add.image(560, G - 36, 'desk_monitor').setDepth(3);
    this.add.image(720, G - 22, 'monitor_dash').setDepth(3);
    this.add.image(900, G - 36, 'desk_monitor').setDepth(3);
    this.add.image(1080, G - 22, 'monitor_dash').setDepth(3);
  }

  protected getLevelConfig(): LevelConfig {
    const G = GAME_HEIGHT - TILE_SIZE;

    return {
      floorId: FLOORS.EXECUTIVE,
      playerStart: { x: 150, y: G - 100 },
      exitPosition: { x: 80, y: G - 56 },

      platforms: [
        { x: 0, y: G, width: 10 },
      ],

      roomElevators: [],

      // Finance is a narrative room — no AU tokens here.
      tokens: [],

      infoPoints: [
        {
          x: 260, y: G, contentId: 'finance',
          zone: { shape: 'rect', width: 140, height: 220 },
        },
      ],
    };
  }

  /** Return to the Executive Suite next to the Finance door. */
  protected override returnToElevator(): void {
    if (this.isTransitioning) return;
    this.isTransitioning = true;
    this.cameras.main.fadeOut(500, 0, 0, 0);
    this.time.delayedCall(500, () =>
      this.scene.start('ExecutiveSuiteScene', { fromDoor: FinanceTeamScene.DOOR_ID }),
    );
  }

  /** Show "→ Executive Suite" rather than the default "→ Elevator" prompt. */
  protected override checkExitProximity(): void {
    const d = Phaser.Math.Distance.Between(
      this.player.sprite.x, this.player.sprite.y,
      this.exitDoor.x, this.exitDoor.y,
    );
    if (d < 90) {
      this.interactPrompt?.setText(`Press ${allKeyLabels('Interact')} \u2192 Executive Suite`).setPosition(
        this.exitDoor.x - 80, this.exitDoor.y - 90,
      ).setVisible(true);
      if (this.inputs.justPressed('Interact')) this.returnToElevator();
    } else {
      this.interactPrompt?.setVisible(false);
    }
  }
}
