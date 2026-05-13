import * as Phaser from 'phaser';
import { Enemy } from '../../../entities/Enemy';
import { Player } from '../../../entities/Player';

const PLAYER_SHADOW_OFFSET_Y = 70;
const PLAYER_SHADOW_DEPTH = 9.5;
const ENEMY_SHADOW_OFFSET_Y = 28;
const ENEMY_SHADOW_DEPTH = 5.5;
const ENEMY_SHADOW_SCALE = 0.7;
const ENEMY_SHADOW_FOOT_OFFSET_Y = 2;

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
      .image(this.deps.player.sprite.x, this.deps.player.sprite.y + PLAYER_SHADOW_OFFSET_Y, 'shadow_blob')
      .setDepth(PLAYER_SHADOW_DEPTH);

    for (const enemy of this.deps.getEnemies()) {
      const sh = this.deps.scene.add
        .image(enemy.x, enemy.y + ENEMY_SHADOW_OFFSET_Y, 'shadow_blob')
        .setDepth(ENEMY_SHADOW_DEPTH)
        .setScale(ENEMY_SHADOW_SCALE);
      this.enemyShadows.push(sh);
    }
  }

  update(): void {
    if (this.playerShadow) {
      const p = this.deps.player.sprite;
      const body = p.body as Phaser.Physics.Arcade.Body;
      const onGround = body.blocked.down || body.touching.down;
      this.playerShadow.setPosition(p.x, p.y + PLAYER_SHADOW_OFFSET_Y);
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
      const footY = body ? body.bottom : en.y + ENEMY_SHADOW_OFFSET_Y;
      sh.setPosition(en.x, footY + ENEMY_SHADOW_FOOT_OFFSET_Y);
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
