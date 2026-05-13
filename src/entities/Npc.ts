import * as Phaser from 'phaser';

export interface NpcConfig {
  id: string;
  name: string;
  x: number;
  y: number;
  topic: string;
  minX?: number;
  maxX?: number;
  speed?: number;
  tint?: number;
}

const DEFAULT_SPEED = 35;
const INTERACTION_RADIUS = 95;

export class Npc extends Phaser.Physics.Arcade.Sprite {
  readonly id: string;
  readonly displayName: string;
  readonly topic: string;
  readonly minX: number;
  readonly maxX: number;
  readonly speed: number;

  constructor(scene: Phaser.Scene, config: NpcConfig) {
    super(scene, config.x, config.y, 'npc_geir', 0);
    this.id = config.id;
    this.displayName = config.name;
    this.topic = config.topic;
    this.minX = config.minX ?? config.x - 120;
    this.maxX = config.maxX ?? config.x + 120;
    this.speed = config.speed ?? DEFAULT_SPEED;

    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setDepth(6);
    this.setOrigin(0.5, 1);
    if (config.tint !== undefined) this.setTint(config.tint);
    if (scene.anims.exists('geir_walk')) this.play('geir_walk');

    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setCollideWorldBounds(true);
    body.setAllowGravity(true);
    body.setSize(34, 92);
    body.setOffset(15, 34);
    this.setVelocityX(this.speed);
  }

  override update(_time: number, _delta: number): void {
    const body = this.body as Phaser.Physics.Arcade.Body | null;
    if (!body) return;
    if (this.x <= this.minX && body.velocity.x < 0) this.setVelocityX(this.speed);
    if (this.x >= this.maxX && body.velocity.x > 0) this.setVelocityX(-this.speed);
    const vx = body.velocity.x;
    if (vx !== 0) this.setFlipX(vx < 0);
  }

  isPlayerNearby(player: Phaser.GameObjects.GameObject & { x: number; y: number }, radius = INTERACTION_RADIUS): boolean {
    return Phaser.Math.Distance.Between(this.x, this.y - 50, player.x, player.y) <= radius;
  }
}
