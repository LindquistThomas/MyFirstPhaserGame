import * as Phaser from 'phaser';
import { FLOORS, FloorId } from '../../../config/gameConfig';
import { FloorData } from '../../../config/levelData';
import { Player } from '../../../entities/Player';
import { Token } from '../../../entities/Token';
import { DroppedAU } from '../../../entities/DroppedAU';
import { ProgressionSystem } from '../../../systems/ProgressionSystem';
import { GameStateManager } from '../../../systems/GameStateManager';
import { isReducedMotion } from '../../../systems/MotionPreference';
import type { LevelConfig } from './LevelScene';

export interface TokenManagerDeps {
  scene: Phaser.Scene;
  floorId: FloorId;
  floorData: FloorData;
  progression: ProgressionSystem;
  player: Player;
  platformGroup: Phaser.Physics.Arcade.StaticGroup;
  camera: Phaser.Cameras.Scene2D.Camera;
  gameState: GameStateManager;
}

/**
 * Owns the tokens and dropped-AU groups for a level. Handles collection,
 * sparkle particles, and re-pickup of dropped AU.
 */
export class LevelTokenManager {
  readonly tokenGroup: Phaser.Physics.Arcade.StaticGroup;
  readonly droppedAUGroup: Phaser.Physics.Arcade.Group;
  private sparkleEmitter?: Phaser.GameObjects.Particles.ParticleEmitter;

  /** Running count of AU collected in the current room (UI-independent). */
  auCollected = 0;

  constructor(private readonly deps: TokenManagerDeps) {
    this.tokenGroup = deps.scene.physics.add.staticGroup();
    this.droppedAUGroup = deps.scene.physics.add.group({
      classType: DroppedAU,
      maxSize: 32,
      runChildUpdate: true,
    });
    this.sparkleEmitter = this.createSparkleEmitter();
    const destroyEmitter = (): void => {
      const emitter = this.sparkleEmitter;
      this.sparkleEmitter = undefined;
      emitter?.destroy();
    };
    deps.scene.events.once('shutdown', destroyEmitter);
    deps.scene.events.once('destroy', destroyEmitter);
  }

  spawn(config: LevelConfig): void {
    const tokenKey = this.tokenKey();
    for (let i = 0; i < config.tokens.length; i++) {
      const idx = config.tokens[i]!.index ?? i;
      if (this.deps.progression.isTokenCollected(this.deps.floorId, idx)) continue;
      const token = new Token(this.deps.scene, config.tokens[i]!.x, config.tokens[i]!.y, tokenKey);
      token.setData('tokenIndex', idx);
      this.tokenGroup.add(token);
    }
  }

  wireColliders(): void {
    const physics = this.deps.scene.physics;
    physics.add.overlap(
      this.deps.player.sprite,
      this.tokenGroup,
      this.onCollect as Phaser.Types.Physics.Arcade.ArcadePhysicsCallback,
      undefined,
      this,
    );
    physics.add.collider(this.droppedAUGroup, this.deps.platformGroup);
    physics.add.overlap(
      this.deps.player.sprite,
      this.droppedAUGroup,
      this.onRecoverDropped as Phaser.Types.Physics.Arcade.ArcadePhysicsCallback,
      undefined,
      this,
    );
  }

  private tokenKey(): string {
    return this.deps.floorId === FLOORS.PLATFORM_TEAM ? 'token_floor1' : 'token_floor2';
  }

  private onCollect = (
    _player: Phaser.Types.Physics.Arcade.GameObjectWithBody | Phaser.Tilemaps.Tile,
    tokenObj: Phaser.Types.Physics.Arcade.GameObjectWithBody | Phaser.Tilemaps.Tile,
  ): void => {
    const token = tokenObj as Token;
    const tokenIndex = token.getData('tokenIndex') as number;
    this.emitSparkle(token.x, token.y);
    token.collect();
    this.deps.progression.collectAU(this.deps.floorId, tokenIndex);
    this.auCollected++;
    this.deps.camera.flash(100, 255, 215, 0, false, undefined, this);
    this.deps.gameState.checkAchievements();
  };

  private onRecoverDropped = (
    _player: Phaser.Types.Physics.Arcade.GameObjectWithBody | Phaser.Tilemaps.Tile,
    dropObj: Phaser.Types.Physics.Arcade.GameObjectWithBody | Phaser.Tilemaps.Tile,
  ): void => {
    const drop = dropObj as DroppedAU;
    if (!drop.ready || drop.collected) return;
    drop.recover(() => {
      this.droppedAUGroup.killAndHide(drop);
      const body = drop.body as Phaser.Physics.Arcade.Body | null;
      if (body) body.enable = false;
    });
    this.deps.progression.addAU(this.deps.floorId, 1);
    this.deps.gameState.checkAchievements();
  };

  private emitSparkle(x: number, y: number): void {
    if (isReducedMotion()) return;
    this.sparkleEmitter?.emitParticleAt(x, y, 10);
  }

  private createSparkleEmitter(): Phaser.GameObjects.Particles.ParticleEmitter | undefined {
    const scene = this.deps.scene;
    if (isReducedMotion()) return undefined;
    if (!scene.textures.exists('particle')) return undefined;
    const emitter = scene.add.particles(0, 0, 'particle', {
      speed: { min: 60, max: 180 },
      angle: { min: 0, max: 360 },
      scale: { start: 0.8, end: 0 },
      alpha: { start: 1, end: 0 },
      lifespan: 500,
      gravityY: 120,
      tint: this.deps.floorData.theme.tokenColor,
      emitting: false,
    });
    emitter.setDepth(11);
    return emitter;
  }
}
