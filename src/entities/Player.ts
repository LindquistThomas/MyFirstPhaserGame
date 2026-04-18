import * as Phaser from 'phaser';
import { PLAYER_SPEED } from '../config/gameConfig';
import { eventBus } from '../systems/EventBus';

type PlayerAnimState = 'idle' | 'walk' | 'flip' | 'fall';

/** Flip (jump) parameters */
const FLIP_DISTANCE = 256;                  // horizontal pixels traveled
const FLIP_HEIGHT = FLIP_DISTANCE / 2;      // peak height = half the distance
const FLIP_DURATION = 800;                  // total ms for the flip arc
const FLIP_FRAME_COUNT = 8;                 // animation frames in a flip
const FLIP_FRAME_RATE = (FLIP_FRAME_COUNT / FLIP_DURATION) * 1000; // frames per second

/** Sprite dimensions — must match SpriteGenerator. */
const SPRITE_WIDTH = 64;
const SPRITE_HEIGHT = 160;
const HITBOX_MARGIN_X = 12;
const HITBOX_MARGIN_Y = 16;
const HITBOX_WIDTH = 40;
const HITBOX_HEIGHT = SPRITE_HEIGHT - HITBOX_MARGIN_Y - 28; // 116 — bottom aligned with character feet

export class Player {
  public sprite: Phaser.Physics.Arcade.Sprite;
  private scene: Phaser.Scene;
  private currentAnim: PlayerAnimState = 'idle';
  private facingRight = true;
  private dustEmitter?: Phaser.GameObjects.Particles.ParticleEmitter;
  private footstepToggle = false;

  /** True while the player is mid-flip (scripted arc). */
  private isFlipping = false;
  /** When false, Space/jump input is ignored (e.g. while riding the elevator). */
  private flipEnabled = true;
  private flipElapsed = 0;
  private flipStartX = 0;
  private flipStartY = 0;
  private flipDirection = 1; // 1 = right, -1 = left

  /** Tracks airborne→grounded transitions for the land-squash tell. */
  private wasOnGround = true;
  /** True while the short `player_land` anim is playing; gates updateAnimation. */
  private isLanding = false;
  /** Scene time (ms) when the player left the ground; null while grounded. */
  private airborneSince: number | null = null;
  /** Minimum airborne duration before a walk-off-ledge landing emits dust. */
  private readonly LANDING_DUST_MIN_AIRBORNE_MS = 150;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    this.scene = scene;

    this.sprite = scene.physics.add.sprite(x, y, 'player', 0);
    this.sprite.setSize(HITBOX_WIDTH, HITBOX_HEIGHT);
    this.sprite.setOffset(HITBOX_MARGIN_X, HITBOX_MARGIN_Y);
    this.sprite.setCollideWorldBounds(true);
    this.sprite.setDepth(10);

    this.createAnimations();
    this.sprite.on(Phaser.Animations.Events.ANIMATION_UPDATE, this.onAnimationFrame, this);
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

    // Front-flip: 8 rotation frames, plays once per jump
    if (!anims.exists('player_flip')) {
      anims.create({
        key: 'player_flip',
        frames: anims.generateFrameNumbers('player', { start: 6, end: 13 }),
        frameRate: FLIP_FRAME_RATE,
        repeat: 0, // single run, no loop
      });
    }

    // Fall: static upright tucked pose (first flip frame) for walking off edges
    if (!anims.exists('player_fall')) {
      anims.create({
        key: 'player_fall',
        frames: anims.generateFrameNumbers('player', { start: 6, end: 6 }),
        frameRate: 1,
        repeat: -1,
      });
    }

    // Land: 120ms squash-tell reusing walk frames (no new sheet frames needed)
    if (!anims.exists('player_land')) {
      anims.create({
        key: 'player_land',
        frames: anims.generateFrameNumbers('player', { frames: [2, 3] }),
        frameRate: 16,
        repeat: 0,
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
    const body = this.sprite.body as Phaser.Physics.Arcade.Body;
    const onGround = body.blocked.down || body.touching.down;

    // ---- Scripted flip in progress ----
    if (this.isFlipping) {
      this.updateFlip(delta);
      // Mid-flip we treat the player as grounded for the land-tell so the
      // flip's own emitDust handles the landing, not player_land.
      this.wasOnGround = true;
      this.airborneSince = null;
      return;
    }

    // Land tell: fire once on airborne→grounded transition (walking off ledges).
    if (!this.wasOnGround && onGround) {
      this.playLandAnim();
      // Only emit landing dust if the player was airborne long enough to
      // avoid spamming particles on slope/edge jitter.
      const now = this.scene.time.now;
      if (
        this.airborneSince !== null
        && now - this.airborneSince > this.LANDING_DUST_MIN_AIRBORNE_MS
      ) {
        this.emitDust();
      }
      this.airborneSince = null;
    } else if (this.wasOnGround && !onGround) {
      this.airborneSince = this.scene.time.now;
    }
    this.wasOnGround = onGround;

    const inputs = this.scene.inputs;
    const h = inputs.horizontal();

    // Horizontal movement
    if (h < 0) {
      this.sprite.setVelocityX(-PLAYER_SPEED);
      this.facingRight = false;
    } else if (h > 0) {
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

    // Jump → initiate forward flip
    if (inputs.justPressed('Jump') && onGround && this.flipEnabled) {
      this.startFlip();
      return;
    }

    // Animations
    this.updateAnimation(onGround);
  }

  /* ---- Scripted forward flip ---- */
  private startFlip(): void {
    this.isFlipping = true;
    this.flipElapsed = 0;
    this.flipStartX = this.sprite.x;
    this.flipStartY = this.sprite.y;
    this.flipDirection = this.facingRight ? 1 : -1;

    // Disable physics gravity during flip — we control position manually
    const body = this.sprite.body as Phaser.Physics.Arcade.Body;
    body.setAllowGravity(false);
    this.sprite.setVelocity(0, 0);

    // Play flip animation once
    this.currentAnim = 'flip';
    this.sprite.anims.play('player_flip', true);
    this.sprite.setFlipX(!this.facingRight);

    this.emitDust();
    eventBus.emit('sfx:jump');
  }

  private updateFlip(delta: number): void {
    this.flipElapsed += delta;

    const t = Math.min(this.flipElapsed / FLIP_DURATION, 1); // 0→1

    // Horizontal: linear interpolation
    const dx = FLIP_DISTANCE * t * this.flipDirection;

    // Vertical: parabolic arc — peak at t=0.5, height = FLIP_HEIGHT
    // y = -4 * FLIP_HEIGHT * t * (1 - t)   (negative = upward in screen)
    const dy = -4 * FLIP_HEIGHT * t * (1 - t);

    this.sprite.setPosition(this.flipStartX + dx, this.flipStartY + dy);

    // End flip
    if (t >= 1) {
      this.isFlipping = false;
      const body = this.sprite.body as Phaser.Physics.Arcade.Body;
      body.setAllowGravity(true);
      this.sprite.setVelocity(0, 0);

      // Reset to idle
      this.currentAnim = 'idle';
      this.sprite.anims.play('player_idle', true);

      this.emitDust();
    }
  }

  private onAnimationFrame(
    _anim: Phaser.Animations.Animation,
    frame: Phaser.Animations.AnimationFrame,
  ): void {
    if (this.currentAnim !== 'walk') return;
    if (frame.index === 0 || frame.index === 2) {
      this.footstepToggle = !this.footstepToggle;
      eventBus.emit(this.footstepToggle ? 'sfx:footstep_a' : 'sfx:footstep_b');
    }
  }

  private playLandAnim(): void {
    this.isLanding = true;
    this.sprite.anims.play('player_land', true);
    this.scene.tweens.add({
      targets: this.sprite,
      scaleY: { from: 0.92, to: 1 },
      duration: 120,
      ease: 'Quad.easeOut',
    });
    this.scene.time.delayedCall(120, () => {
      this.isLanding = false;
      this.sprite.setScale(1, 1);
    });
  }

  private updateAnimation(onGround: boolean): void {
    if (this.isLanding) return;
    const vx = Math.abs(this.sprite.body!.velocity.x);
    let newAnim: PlayerAnimState;

    if (!onGround) {
      // Airborne but not mid-flip — show static tucked pose
      newAnim = 'fall';
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
      this.dustEmitter.setPosition(this.sprite.x, this.sprite.y + 70);
      this.dustEmitter.explode(5);
    }
  }

  setFlipEnabled(enabled: boolean): void {
    this.flipEnabled = enabled;
  }

  setPosition(x: number, y: number): void {
    this.sprite.setPosition(x, y);
    this.sprite.setVelocity(0, 0);
  }

  /** Whether the player is currently performing a scripted flip. */
  getIsFlipping(): boolean {
    return this.isFlipping;
  }
}
