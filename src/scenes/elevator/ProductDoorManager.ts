import * as Phaser from 'phaser';
import { FLOORS } from '../../config/gameConfig';
import { Player } from '../../entities/Player';
import { ProgressionSystem } from '../../systems/ProgressionSystem';

const FLOOR_DETECTION_TOLERANCE = 18;

export interface ProductDoor {
  x: number;
  label: string;
  sceneKey: string;
  /** Door identifier — matches ProductRoomConfig.contentId for return-spawn. */
  contentId: string;
}

export interface ProductDoorManagerDeps {
  scene: Phaser.Scene;
  progression: ProgressionSystem;
  player: Player;
  productsWalkY: number;
  /** Returns true while the player is standing on the elevator cab. */
  isPlayerOnElevator: () => boolean;
  /** Invoked when the player walks through (or taps) a product door. */
  onEnter: (door: ProductDoor) => void;
}

/**
 * Renders the product doors on the PRODUCTS floor, shows a proximity
 * prompt, and dispatches {@link ProductDoorManagerDeps.onEnter} when the
 * player interacts with one. Also resolves the return-spawn coordinates
 * when the player comes back through a door.
 */
export class ProductDoorManager {
  private static readonly DOORS: ProductDoor[] = [
    { x: 900,  label: 'ISY Project Controls', sceneKey: 'ProductIsyProjectControlsScene', contentId: 'product-isy-project-controls' },
    { x: 1120, label: 'ISY Beskrivelse',      sceneKey: 'ProductIsyBeskrivelseScene',     contentId: 'product-isy-beskrivelse'      },
  ];

  private prompt?: Phaser.GameObjects.Text;

  constructor(private readonly deps: ProductDoorManagerDeps) {}

  /** Build door sprites + name plates on the PRODUCTS walking surface. */
  render(): void {
    const walkY = this.deps.productsWalkY;
    for (const door of ProductDoorManager.DOORS) {
      const img = this.deps.scene.add.image(door.x, walkY - 56, 'door_unlocked').setDepth(3);
      img.setInteractive({ useHandCursor: true });
      img.on('pointerdown', () => this.deps.onEnter(door));
      this.deps.scene.add.text(door.x, walkY - 130, door.label, {
        fontFamily: 'monospace', fontSize: '13px', color: '#cfe6ff',
        fontStyle: 'bold', align: 'center',
        backgroundColor: '#0a1422', padding: { x: 6, y: 3 },
      }).setOrigin(0.5).setDepth(4);
    }

    // World-space prompt follows camera scroll.
    this.prompt = this.deps.scene.add.text(0, 0, '', {
      fontFamily: 'monospace', fontSize: '16px',
      color: '#ffdd44', backgroundColor: '#00000088',
      padding: { x: 8, y: 4 },
    }).setDepth(20).setVisible(false);
  }

  /** Per-frame check: show prompt and trigger entry when player is near a door. */
  update(interactJustPressed: boolean): void {
    if (this.deps.isPlayerOnElevator()) {
      this.prompt?.setVisible(false);
      return;
    }
    if (!this.deps.progression.isFloorUnlocked(FLOORS.PRODUCTS)) {
      this.prompt?.setVisible(false);
      return;
    }

    const body = this.deps.player.sprite.body as Phaser.Physics.Arcade.Body;
    const walkY = this.deps.productsWalkY;
    if (Math.abs(body.bottom - walkY) > FLOOR_DETECTION_TOLERANCE) {
      this.prompt?.setVisible(false);
      return;
    }

    const px = this.deps.player.sprite.x;
    for (const door of ProductDoorManager.DOORS) {
      if (Math.abs(px - door.x) < 60) {
        this.prompt
          ?.setText(`Press Enter \u2192 ${door.label}`)
          .setPosition(door.x - 120, walkY - 180)
          .setVisible(true);
        if (interactJustPressed) this.deps.onEnter(door);
        return;
      }
    }
    this.prompt?.setVisible(false);
  }

  static get doors(): readonly ProductDoor[] {
    return ProductDoorManager.DOORS;
  }
}
