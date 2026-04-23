import * as Phaser from 'phaser';
import { Coffee } from '../../../entities/Coffee';
import { Player } from '../../../entities/Player';
import { eventBus } from '../../../systems/EventBus';
import type { LevelConfig } from './LevelScene';

export interface CoffeeManagerDeps {
  scene: Phaser.Scene;
  player: Player;
}

/**
 * Owns the coffee pickups for a level. Unlike {@link LevelTokenManager},
 * coffee has no progression persistence — every scene entry spawns a
 * fresh mug at each configured position. On overlap the mug tweens out
 * and the player's caffeine buff is applied.
 */
export class LevelCoffeeManager {
  readonly coffeeGroup: Phaser.Physics.Arcade.StaticGroup;

  constructor(private readonly deps: CoffeeManagerDeps) {
    this.coffeeGroup = deps.scene.physics.add.staticGroup();
  }

  spawn(config: LevelConfig): void {
    const coffees = config.coffees;
    if (!coffees?.length) return;
    for (const c of coffees) {
      const mug = new Coffee(this.deps.scene, c.x, c.y);
      this.coffeeGroup.add(mug);
    }
  }

  wireColliders(): void {
    this.deps.scene.physics.add.overlap(
      this.deps.player.sprite,
      this.coffeeGroup,
      this.onCollect as Phaser.Types.Physics.Arcade.ArcadePhysicsCallback,
      undefined,
      this,
    );
  }

  private onCollect = (
    _player: Phaser.Types.Physics.Arcade.GameObjectWithBody | Phaser.Tilemaps.Tile,
    mugObj: Phaser.Types.Physics.Arcade.GameObjectWithBody | Phaser.Tilemaps.Tile,
  ): void => {
    const mug = mugObj as Coffee;
    this.emitSipBurst(mug.x, mug.y);
    mug.collect();
    this.deps.player.applyCaffeine();
    eventBus.emit('sfx:coffee_sip');
  };

  private emitSipBurst(x: number, y: number): void {
    const scene = this.deps.scene;
    if (!scene.textures.exists('particle')) return;
    const emitter = scene.add.particles(x, y - 8, 'particle', {
      speed: { min: 40, max: 140 },
      angle: { min: 220, max: 320 },
      scale: { start: 0.6, end: 0 },
      alpha: { start: 0.9, end: 0 },
      lifespan: 480,
      gravityY: -40,
      tint: 0xe8d8c0,
      emitting: false,
    });
    emitter.setDepth(11);
    emitter.explode(8);
    scene.time.delayedCall(600, () => emitter.destroy());
  }
}
