import * as Phaser from 'phaser';
import { Enemy } from '../../../entities/Enemy';
import { Player } from '../../../entities/Player';

export interface LevelShadowControllerDeps {
  scene: Phaser.Scene;
  player: Player;
  getEnemies: () => readonly Enemy[];
}

export class LevelShadowController {
  private playerShadow?: Phaser.GameObjects.Image;
  private enemyShadows: Array<Phaser.GameObjects.Image | undefined> = [];

  constructor(private readonly deps: LevelShadowControllerDeps) {}

  init(): void {
    if (!this.deps.scene.textures.exists('shadow_blob')) return;

    this.playerShadow = this.deps.scene.add
      .image(this.deps.player.sprite.x, this.deps.player.sprite.y + 70, 'shadow_blob')
      .setDepth(9.5);

    for (const enemy of this.deps.getEnemies()) {
      const sh = this.deps.scene.add.image(enemy.x, enemy.y + 28, 'shadow_blob').setDepth(5.5).setScale(0.7);
      this.enemyShadows.push(sh);
    }
  }

  update(): void {
    if (this.playerShadow) {
      const p = this.deps.player.sprite;
      const body = p.body as Phaser.Physics.Arcade.Body;
      const onGround = body.blocked.down || body.touching.down;
      this.playerShadow.setPosition(p.x, p.y + 70);
      if (onGround) {
        this.playerShadow.setAlpha(1).setScale(1);
      } else {
        const vy = body.velocity.y;
        const fade = Phaser.Math.Clamp(1 - Math.abs(vy) / 600, 0.3, 1);
        this.playerShadow.setAlpha(fade * 0.85).setScale(fade);
      }
    }

    const enemies = this.deps.getEnemies();
    for (let i = 0; i < this.enemyShadows.length; i++) {
      const sh = this.enemyShadows[i];
      if (!sh) continue;
      const en = enemies[i];
      if (!en || en.defeated || !en.active) {
        sh.destroy();
        this.enemyShadows[i] = undefined;
        continue;
      }
      const body = en.body as Phaser.Physics.Arcade.Body | null;
      const footY = body ? body.bottom : en.y + 28;
      sh.setPosition(en.x, footY + 2);
    }
  }

  shutdown(): void {
    this.playerShadow?.destroy();
    this.playerShadow = undefined;
    for (const shadow of this.enemyShadows) {
      shadow?.destroy();
    }
    this.enemyShadows = [];
  }
}
