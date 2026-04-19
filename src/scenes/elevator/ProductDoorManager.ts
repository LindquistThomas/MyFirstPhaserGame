import * as Phaser from 'phaser';
import { Player } from '../../entities/Player';
import { theme } from '../../style/theme';
import { InteractiveDoor } from '../../ui/InteractiveDoor';

const FLOOR_DETECTION_TOLERANCE = 18;
const DOOR_PROXIMITY = 60;

export interface ProductDoor {
  x: number;
  label: string;
  sceneKey: string;
  /** Door identifier — matches ProductRoomConfig.contentId for return-spawn. */
  contentId: string;
}

export interface ProductDoorManagerDeps {
  scene: Phaser.Scene;
  player: Player;
  productsWalkY: number;
  /** Returns true while the player is standing on the elevator cab. */
  isPlayerOnElevator: () => boolean;
  /** Invoked when the player walks through (or taps) a product door. */
  onEnter: (door: ProductDoor) => void;
}

/**
 * Renders the product doors on the PRODUCTS floor, shows a proximity
 * prompt, opens the nearest door as the player approaches, and dispatches
 * {@link ProductDoorManagerDeps.onEnter} when the player interacts. Also
 * owns the list of doors used by {@link ElevatorScene} to resolve the
 * return-spawn coordinates when the player comes back through one.
 */
export class ProductDoorManager {
  private static readonly DOORS: ProductDoor[] = [
    { x: 280,  label: 'ISY Project Controls', sceneKey: 'ProductIsyProjectControlsScene', contentId: 'product-isy-project-controls' },
    { x: 460,  label: 'ISY Beskrivelse',      sceneKey: 'ProductIsyBeskrivelseScene',     contentId: 'product-isy-beskrivelse'      },
    { x: 820,  label: 'ISY Road',             sceneKey: 'ProductIsyRoadScene',            contentId: 'product-isy-road'             },
    { x: 1040, label: 'Admin & Lisens',       sceneKey: 'ProductAdminLisensScene',        contentId: 'product-admin-lisens'         },
  ];

  private prompt?: Phaser.GameObjects.Text;
  private doors: Array<{ cfg: ProductDoor; sprite: InteractiveDoor }> = [];

  constructor(private readonly deps: ProductDoorManagerDeps) {}

  /** Build door sprites + name plates on the PRODUCTS walking surface. */
  render(): void {
    const walkY = this.deps.productsWalkY;
    for (const cfg of ProductDoorManager.DOORS) {
      const sprite = new InteractiveDoor(
        this.deps.scene, cfg.x, walkY - 56, 'door_unlocked', 'door_open',
      ).onPointerDown(() => this.deps.onEnter(cfg));

      this.deps.scene.add.text(cfg.x, walkY - 130, cfg.label, {
        fontFamily: 'monospace', fontSize: '13px', color: theme.color.css.textPale,
        fontStyle: 'bold', align: 'center',
        backgroundColor: theme.color.css.bgPanel, padding: { x: 6, y: 3 },
      }).setOrigin(0.5).setDepth(4);

      this.doors.push({ cfg, sprite });
    }

    // World-space prompt follows camera scroll.
    this.prompt = this.deps.scene.add.text(0, 0, '', {
      fontFamily: 'monospace', fontSize: '16px',
      color: theme.color.css.textWarn, backgroundColor: theme.color.css.bgDialog,
      padding: { x: theme.space.sm, y: theme.space.xs },
    }).setDepth(20).setVisible(false);
  }

  /** Per-frame check: show prompt, open nearest door, trigger entry on interact. */
  update(interactJustPressed: boolean): void {
    const nearDoor = this.findNearDoor();
    // Keep each door's open state in sync with proximity every frame so the
    // door closes again as soon as the player walks away.
    for (const d of this.doors) d.sprite.setOpen(nearDoor === d.cfg);

    if (!nearDoor) {
      this.prompt?.setVisible(false);
      return;
    }

    const walkY = this.deps.productsWalkY;
    this.prompt
      ?.setText(`Press Enter \u2192 ${nearDoor.label}`)
      .setPosition(nearDoor.x - 120, walkY - 180)
      .setVisible(true);

    if (interactJustPressed) this.deps.onEnter(nearDoor);
  }

  /** The door the player is currently close enough to interact with, if any. */
  private findNearDoor(): ProductDoor | undefined {
    if (this.deps.isPlayerOnElevator()) return undefined;

    const body = this.deps.player.sprite.body as Phaser.Physics.Arcade.Body;
    if (Math.abs(body.bottom - this.deps.productsWalkY) > FLOOR_DETECTION_TOLERANCE) {
      return undefined;
    }

    const px = this.deps.player.sprite.x;
    for (const cfg of ProductDoorManager.DOORS) {
      if (Math.abs(px - cfg.x) < DOOR_PROXIMITY) return cfg;
    }
    return undefined;
  }

  static get doors(): readonly ProductDoor[] {
    return ProductDoorManager.DOORS;
  }
}
