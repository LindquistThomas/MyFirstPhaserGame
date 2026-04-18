import * as Phaser from 'phaser';
import { FLOORS, FloorId } from '../../config/gameConfig';
import { Enemy } from '../../entities/Enemy';
import { Slime } from '../../entities/enemies/Slime';
import { BureaucracyBot } from '../../entities/enemies/BureaucracyBot';
import { DroppedAU } from '../../entities/DroppedAU';
import { Player } from '../../entities/Player';
import { ProgressionSystem } from '../../systems/ProgressionSystem';
import { eventBus } from '../../systems/EventBus';
import type { LevelConfig } from './LevelScene';

export interface EnemySpawnerDeps {
  scene: Phaser.Scene;
  floorId: FloorId;
  progression: ProgressionSystem;
  player: Player;
  platformGroup: Phaser.Physics.Arcade.StaticGroup;
  droppedAUGroup: Phaser.Physics.Arcade.Group;
  camera: Phaser.Cameras.Scene2D.Camera;
}

/**
 * Spawns level enemies, wires player↔enemy collisions, and applies stomp/
 * damage rules. Owns no visuals of its own — enemies are Phaser game objects
 * living on the scene.
 */
export class LevelEnemySpawner {
  readonly enemies: Enemy[] = [];

  constructor(private readonly deps: EnemySpawnerDeps) {}

  spawn(config: LevelConfig): void {
    if (!config.enemies?.length) return;
    for (const e of config.enemies) {
      const minX = e.minX ?? e.x - 160;
      const maxX = e.maxX ?? e.x + 160;
      const opts = { minX, maxX, speed: e.speed };
      const enemy: Enemy = e.type === 'slime'
        ? new Slime(this.deps.scene, e.x, e.y, opts)
        : new BureaucracyBot(this.deps.scene, e.x, e.y, opts);
      this.enemies.push(enemy);
    }
  }

  /** Wire collisions after spawn() + player creation. Safe to call with empty enemies. */
  wireColliders(): void {
    if (this.enemies.length === 0) return;
    const physics = this.deps.scene.physics;
    physics.add.collider(this.enemies, this.deps.platformGroup);
    physics.add.overlap(
      this.deps.player.sprite,
      this.enemies,
      this.onEnemyOverlap as Phaser.Types.Physics.Arcade.ArcadePhysicsCallback,
      undefined,
      this,
    );
  }

  update(time: number, delta: number): void {
    for (const enemy of this.enemies) {
      if (!enemy.defeated) enemy.update(time, delta);
    }
  }

  private onEnemyOverlap = (
    _playerObj: Phaser.Types.Physics.Arcade.GameObjectWithBody | Phaser.Tilemaps.Tile,
    enemyObj: Phaser.Types.Physics.Arcade.GameObjectWithBody | Phaser.Tilemaps.Tile,
  ): void => {
    const enemy = enemyObj as Enemy;
    if (enemy.defeated) return;
    if (this.deps.player.isInvulnerable()) return;

    const enemyBody = enemy.body as Phaser.Physics.Arcade.Body;
    const playerBody = this.deps.player.sprite.body as Phaser.Physics.Arcade.Body;
    const comingFromAbove = playerBody.bottom - enemyBody.top < 24;
    const falling = playerBody.velocity.y > 40 || this.deps.player.getIsFlipping();

    if (enemy.canBeStomped && comingFromAbove && falling) {
      enemy.onStomp();
      this.deps.player.sprite.setVelocityY(-420);
      eventBus.emit('sfx:stomp');
      return;
    }

    this.applyHit(enemy);
  };

  private applyHit(enemy: Enemy): void {
    const removed = this.deps.progression.loseAU(this.deps.floorId, enemy.hitCost);

    if (removed > 0) {
      const tokenKey = this.deps.floorId === FLOORS.PLATFORM_TEAM ? 'token_floor1' : 'token_floor2';
      for (let i = 0; i < removed; i++) {
        const d = new DroppedAU(
          this.deps.scene,
          this.deps.player.sprite.x,
          this.deps.player.sprite.y - 20,
          tokenKey,
        );
        this.deps.droppedAUGroup.add(d);
      }
      eventBus.emit('sfx:drop_au');
    }

    const dir = this.deps.player.sprite.x < enemy.x ? -1 : 1;
    this.deps.player.takeHit(enemy.knockbackX * dir, enemy.knockbackY);
    this.deps.camera.shake(120, 0.006);
    eventBus.emit('sfx:hit');
  }
}
