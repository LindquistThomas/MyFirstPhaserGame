import * as Phaser from 'phaser';
import { PLAYER_SPEED, PLAYER_JUMP_VELOCITY } from '../config/gameConfig';
import { InputManager } from '../systems/InputManager';

type PlayerAnimState = 'idle' | 'walk' | 'flip';

export class Player {
  public sprite: Phaser.Physics.Arcade.Sprite;
  private inputManager: InputManager;
  private scene: Phaser.Scene;
  private currentAnim: PlayerAnimState = 'idle';
  private facingRight = true;
  private jumpCooldown = 0;
  private dustEmitter?: Phaser.GameObjects.Particles.ParticleEmitter;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    this.scene = scene;
    this.inputManager = new InputManager(scene);

    this.sprite = scene.physics.add.sprite(x, y, 'player', 0);
    this.sprite.setSize(40, 110);
    this.sprite.setOffset(12, 16);
    this.sprite.setCollideWorldBounds(true);
    this.sprite.setDepth(10);

    this.createAnimations();
    this.createDustEmitter();
  }

  private createAnimations(): void {
    const anims = this.scene.anims;

    if (!anims.exists('player_idle')) {
      anims.create({
        key: 'player_idle',
        frames: anims.generateFrameNumbers('player', { start: 0, end: 1 }),
        frameRate: 3,
        repeat: -1,
      });
    }

    if (!anims.exists('player_walk')) {
      anims.create({
        key: 'player_walk',
        frames: anims.generateFrameNumbers('player', { start: 2, end: 5 }),
        frameRate: 10,
        repeat: -1,
      });
    }

    // Front-flip: 4 rotation frames that loop once per jump
    if (!anims.exists('player_flip')) {
      anims.create({
        key: 'player_flip',
        frames: anims.generateFrameNumbers('player', { start: 6, end: 9 }),
        frameRate: 12,
        repeat: -1,
      });
    }
  }

  private createDustEmitter(): void {
    if (this.scene.textures.exists('particle')) {
      this.dustEmitter = this.scene.add.particles(0, 0, 'particle', {
        speed: { min: 10, max: 40 },
        angle: { min: 200, max: 340 },
        scale: { start: 0.4, end: 0 },
        alpha: { start: 0.6, end: 0 },
        lifespan: 300,
        gravityY: 100,
        tint: 0x888888,
        emitting: false,
      });
      this.dustEmitter.setDepth(9);
    }
  }

  update(delta: number): void {
    const input = this.inputManager.getState();
    const body = this.sprite.body as Phaser.Physics.Arcade.Body;
    const onGround = body.blocked.down || body.touching.down;

    // Horizontal movement
    if (input.left) {
      this.sprite.setVelocityX(-PLAYER_SPEED);
      this.facingRight = false;
    } else if (input.right) {
      this.sprite.setVelocityX(PLAYER_SPEED);
      this.facingRight = true;
    } else {
      // Deceleration
      this.sprite.setVelocityX(this.sprite.body!.velocity.x * 0.8);
      if (Math.abs(this.sprite.body!.velocity.x) < 10) {
        this.sprite.setVelocityX(0);
      }
    }

    // Flip sprite based on direction
    this.sprite.setFlipX(!this.facingRight);

    // Jump cooldown
    if (this.jumpCooldown > 0) {
      this.jumpCooldown -= delta;
    }

    // Jump
    if (this.inputManager.isJumpJustPressed() && onGround && this.jumpCooldown <= 0) {
      this.sprite.setVelocityY(PLAYER_JUMP_VELOCITY);
      this.jumpCooldown = 200;
      this.emitDust();
    }

    // Animations
    this.updateAnimation(onGround);
  }

  private updateAnimation(onGround: boolean): void {
    const vx = Math.abs(this.sprite.body!.velocity.x);
    let newAnim: PlayerAnimState;

    if (!onGround) {
      // Front-flip while airborne
      newAnim = 'flip';
    } else if (vx > 20) {
      newAnim = 'walk';
    } else {
      newAnim = 'idle';
    }

    if (newAnim !== this.currentAnim) {
      this.currentAnim = newAnim;
      this.sprite.anims.play(`player_${newAnim}`, true);
    }
  }

  private emitDust(): void {
    if (this.dustEmitter) {
      this.dustEmitter.setPosition(this.sprite.x, this.sprite.y + 56);
      this.dustEmitter.explode(5);
    }
  }

  getInputManager(): InputManager {
    return this.inputManager;
  }

  setPosition(x: number, y: number): void {
    this.sprite.setPosition(x, y);
    this.sprite.setVelocity(0, 0);
  }
}
