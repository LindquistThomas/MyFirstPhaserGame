import * as Phaser from 'phaser';
import { FLOORS, FloorId } from '../../../config/gameConfig';
import { Enemy } from '../../../entities/Enemy';
import { Slime } from '../../../entities/enemies/Slime';
import { BureaucracyBot } from '../../../entities/enemies/BureaucracyBot';
import { ScopeCreep } from '../../../entities/enemies/ScopeCreep';
import { ArchitectureAstronaut } from '../../../entities/enemies/ArchitectureAstronaut';
import { TechDebtGhost } from '../../../entities/enemies/TechDebtGhost';
import { TerroristCommander } from '../../../entities/enemies/TerroristCommander';
import type { DroppedAU } from '../../../entities/DroppedAU';
import { Player } from '../../../entities/Player';
import { ProgressionSystem } from '../../../systems/ProgressionSystem';
import { eventBus } from '../../../systems/EventBus';
import { isReducedMotion } from '../../../systems/MotionPreference';
import type { WorldModifiers } from '../../../systems/WorldModifiers';
import type { LevelConfig } from './LevelScene';

const DEFAULT_ENEMY_SPEED_BY_TYPE = {
  slime: 50,
  bot: 75,
  'scope-creep': 35,
  astronaut: 60,
  'tech-debt-ghost': 40,
  terrorist: 90,
} as const;

export interface EnemySpawnerDeps {
  scene: Phaser.Scene;
  floorId: FloorId;
  progression: ProgressionSystem;
  player: Player;
  platformGroup: Phaser.Physics.Arcade.StaticGroup;
  droppedAUGroup: Phaser.Physics.Arcade.Group;
  camera: Phaser.Cameras.Scene2D.Camera;
  /** Optional callback invoked after every successful player hit. */
  onPlayerHit?: () => void;
  worldModifiers: WorldModifiers;
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
    const speedMultiplier = this.deps.worldModifiers.enemySpeedMultiplier;
    const contactDamageMultiplier = this.deps.worldModifiers.enemyContactDamageMultiplier;
    for (const e of config.enemies) {
      const minX = e.minX ?? e.x - 160;
      const maxX = e.maxX ?? e.x + 160;
      const baseSpeed = e.speed ?? DEFAULT_ENEMY_SPEED_BY_TYPE[e.type];
      const opts = { minX, maxX, speed: baseSpeed * speedMultiplier };
      let enemy: Enemy;
      switch (e.type) {
        case 'slime':
          enemy = new Slime(this.deps.scene, e.x, e.y, opts);
          break;
        case 'bot':
          enemy = new BureaucracyBot(this.deps.scene, e.x, e.y, opts);
          break;
        case 'scope-creep':
          enemy = new ScopeCreep(this.deps.scene, e.x, e.y, opts);
          break;
        case 'astronaut':
          enemy = new ArchitectureAstronaut(this.deps.scene, e.x, e.y, opts);
          break;
        case 'tech-debt-ghost':
          enemy = new TechDebtGhost(this.deps.scene, e.x, e.y, opts);
          break;
        case 'terrorist':
          enemy = new TerroristCommander(this.deps.scene, e.x, e.y, opts);
          break;
      }
      enemy.hitCost = Math.max(1, Math.ceil(enemy.hitCost * contactDamageMultiplier));
      this.enemies.push(enemy);
    }
  }

  /** Wire collisions after spawn() + player creation. Safe to call with empty enemies. */
  wireColliders(): void {
    if (this.enemies.length === 0) return;
    const physics = this.deps.scene.physics;
    const solid = this.enemies.filter((e) => e.collidesWithLevel);
    if (solid.length > 0) physics.add.collider(solid, this.deps.platformGroup);
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
      if (!isReducedMotion()) this.deps.camera.shake(80, 0.004);
      eventBus.emit('sfx:stomp');
      return;
    }

    this.applyHit(enemy);
  };

  private applyHit(enemy: Enemy): void {
    const removed = this.deps.progression.loseAU(this.deps.floorId, enemy.hitCost);

    if (removed > 0) {
      const tokenKey = this.deps.floorId === FLOORS.PLATFORM_TEAM ? 'token_floor1' : 'token_floor2';
      const dropX = this.deps.player.sprite.x;
      const dropY = this.deps.player.sprite.y - 20;
      for (let i = 0; i < removed; i++) {
        // get(x,y,key) seeds newly created members; reset(...) re-inits reused ones.
        const d = this.deps.droppedAUGroup.get(
          dropX,
          dropY,
          tokenKey,
        ) as DroppedAU | null;
        if (!d) continue;
        d.reset(dropX, dropY, tokenKey);
      }
      eventBus.emit('sfx:drop_au');
    }

    const dir = this.deps.player.sprite.x < enemy.x ? -1 : 1;
    this.deps.player.takeHit(enemy.knockbackX * dir, enemy.knockbackY);
    this.deps.onPlayerHit?.();
    if (!isReducedMotion()) this.deps.camera.shake(120, 0.006);
    eventBus.emit('sfx:hit');
  }
}
