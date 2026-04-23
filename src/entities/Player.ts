import * as Phaser from 'phaser';
import { PLAYER_SPEED, PLAYER_JUMP_VELOCITY } from '../config/gameConfig';
import { eventBus } from '../systems/EventBus';
import { activeContext } from '../input';
import { CaffeineBuff } from '../systems/CaffeineBuff';

/** Coffee buff tuning. Air speed is deliberately NOT buffed — see
 *  AIR_HORIZONTAL_SPEED note above for the shaft-width invariant. */
export const CAFFEINE_DURATION_MS = 6000;
export const CAFFEINE_SPEED_MULT = 1.4;
export const CAFFEINE_JUMP_MULT = 1.15;

type PlayerAnimState = 'idle' | 'walk' | 'flip' | 'fall' | 'land';

/**
 * Horizontal air-speed cap. Kept lower than `PLAYER_SPEED` so the maximum
 * horizontal distance covered during a jump stays well under the elevator
 * shaft width (`SHAFT_WIDTH = 220` in ElevatorScene). With the default
 * PLAYER_JUMP_VELOCITY=-520 and PLAYER_GRAVITY=900, airtime ≈ 1.16 s, so
 * max horizontal distance ≈ 160 * 1.16 ≈ 185 px < 220. This prevents the
 * player from jumping across the shaft even if the invisible wall
 * colliders are ever regressed.
 */
const AIR_HORIZONTAL_SPEED = 160;

/** Sprite dimensions — must match SpriteGenerator. */
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

  /**
   * True from the moment a jump is initiated until the player next lands.
   * Kept as a boolean flag (not derived from vy sign) so callers like
   * takeHit() and the room-elevator logic have a stable definition of
   * "mid-jump" that doesn't flicker at the apex.
   */
  private isFlipping = false;
  /** When false, jump input is ignored (e.g. while riding the elevator). */
  private flipEnabled = true;

  /**
   * Invulnerability / hit-stun state.
   *
   * `invulnerableUntil` is a scene-time timestamp (ms). While scene.time.now
   * is below it, `takeHit()` is a no-op, and the sprite flashes via tween.
   * `hitStunUntil` briefly locks out horizontal input so the knockback is
   * visible and the hit feels weighty (~200 ms).
   */
  private invulnerableUntil = 0;
  private hitStunUntil = 0;
  private hitFlashTween?: Phaser.Tweens.Tween;

  /** Tracks airborne→grounded transitions for the land-squash tell. */
  private wasOnGround = true;
  /** True while the short `player_land` anim is playing; gates updateAnimation. */
  private isLanding = false;
  /** Scene time (ms) when the player left the ground; null while grounded. */
  private airborneSince: number | null = null;
  /** Minimum airborne duration before a walk-off-ledge landing emits dust. */
  private readonly LANDING_DUST_MIN_AIRBORNE_MS = 150;
  /**
   * Grace window before switching to the airborne (`fall`) animation. Avoids
   * 1-frame physics hiccups (e.g. tile seams, platform hand-offs) flicking
   * the idle character into a squat pose.
   */
  private readonly AIRBORNE_ANIM_GRACE_MS = 80;

  /** Average horizontal pixels traveled per walk-frame to match the sprite stride. */
  private readonly WALK_PX_PER_FRAME = 14;
  private readonly WALK_MIN_FPS = 4;
  private readonly WALK_MAX_FPS = 14;
  /** Last applied walk fps, rounded — avoids restarting the tween every frame. */
  private currentWalkFps = 10;

  /** Caffeine buff timer + steam particle trail. */
  private caffeine = new CaffeineBuff();
  private caffeineSteam?: Phaser.GameObjects.Particles.ParticleEmitter;

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
    this.createCaffeineEmitter();
  }

  private createAnimations(): void {
    const anims = this.scene.anims;

    if (!anims.exists('player_idle')) {
      // Static idle — single frame, no bob. Any multi-frame idle on a
      // pixel-art sprite reads as a subtle run/squat because the upper body
      // slides over the legs; one frame avoids that entirely.
      anims.create({
        key: 'player_idle',
        frames: anims.generateFrameNumbers('player', { start: 0, end: 0 }),
        frameRate: 1,
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

    // Front-flip: 8 rotation frames, plays once per jump. Frame rate picked
    // so the rotation completes in roughly the same window as the ballistic
    // airtime with the default jump velocity (~1.1s).
    if (!anims.exists('player_flip')) {
      anims.create({
        key: 'player_flip',
        frames: anims.generateFrameNumbers('player', { start: 6, end: 13 }),
        frameRate: 7,
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

  update(_delta: number): void {
    const body = this.sprite.body as Phaser.Physics.Arcade.Body;
    const onGround = body.blocked.down || body.touching.down;

    this.tickCaffeine();

    // Clear the mid-jump flag the moment we land so subsequent input/anim
    // logic reflects that the player is grounded again.
    if (this.isFlipping && onGround && body.velocity.y >= 0) {
      this.isFlipping = false;
    }

    // Land tell: fire once on airborne→grounded transition (walking off ledges).
    // Require a brief airborne window to filter out 1-frame physics flicker
    // (Arcade `touching.down` can drop out for a single tick even at rest),
    // which would otherwise re-trigger playLandAnim every couple of frames
    // and keep `isLanding` permanently true — freezing the sprite on the
    // walk frames that player_land reuses.
    if (!this.wasOnGround && onGround) {
      const now = this.scene.time.now;
      const airborneMs =
        this.airborneSince !== null ? now - this.airborneSince : 0;
      if (airborneMs > this.AIRBORNE_ANIM_GRACE_MS) {
        this.playLandAnim();
        // Only emit landing dust if the player was airborne long enough to
        // avoid spamming particles on slope/edge jitter.
        if (airborneMs > this.LANDING_DUST_MIN_AIRBORNE_MS) {
          this.emitDust();
        }
      }
      this.airborneSince = null;
    } else if (this.wasOnGround && !onGround) {
      this.airborneSince = this.scene.time.now;
    }
    this.wasOnGround = onGround;

    const inputs = this.scene.inputs;
    const h = inputs.horizontal();

    // Input-context freeze: whenever a modal or menu is overlaying
    // gameplay (e.g. the player pressed Interact/ToggleInfo to open an
    // info dialog while walking), snap to rest and let updateAnimation
    // drop to `idle`. Without this, `horizontal()` already returns 0 —
    // but the ground-deceleration path below multiplies vx by 0.8 per
    // frame, so the character would still slide ~170ms and keep the
    // walk animation looping while the dialog is on screen.
    if (activeContext() !== 'gameplay') {
      this.sprite.setVelocityX(0);
      this.sprite.setFlipX(!this.facingRight);
      // Bypass the player_land squash gate: if the squash-anim window
      // happened to overlap with opening a dialog, `updateAnimation`
      // would otherwise return early and leave the sprite in walk/land
      // under the modal. The dialog overlays the player, so clearing
      // the squash flag early is invisible to the user.
      this.isLanding = false;
      this.updateAnimation(onGround);
      return;
    }

    // Hit-stun: skip input-driven horizontal movement so knockback velocity
    // from takeHit() is visibly applied. Jump is also disabled during stun.
    if (this.isHitStunned()) {
      this.updateAnimation(onGround);
      this.sprite.setFlipX(!this.facingRight);
      return;
    }

    // Horizontal movement. Air control is capped below ground speed so the
    // player can't clear wide gaps (in particular the elevator shaft) by
    // jumping off the edge. Coffee buff multiplies ground speed only —
    // air speed stays at the base cap to preserve the shaft invariant.
    const groundSpeed = this.isCaffeinated()
      ? PLAYER_SPEED * CAFFEINE_SPEED_MULT
      : PLAYER_SPEED;
    const maxX = onGround ? groundSpeed : AIR_HORIZONTAL_SPEED;
    if (h < 0) {
      this.sprite.setVelocityX(-maxX);
      this.facingRight = false;
    } else if (h > 0) {
      this.sprite.setVelocityX(maxX);
      this.facingRight = true;
    } else if (onGround) {
      // Ground deceleration. Airborne we let Arcade physics carry the
      // existing vx so arcs feel ballistic instead of mushy.
      this.sprite.setVelocityX(this.sprite.body!.velocity.x * 0.8);
      if (Math.abs(this.sprite.body!.velocity.x) < 10) {
        this.sprite.setVelocityX(0);
      }
    } else if (Math.abs(this.sprite.body!.velocity.x) > maxX) {
      // Clamp residual ground momentum to the air-control cap so launching
      // at full PLAYER_SPEED can't push past AIR_HORIZONTAL_SPEED mid-flight.
      const sign = Math.sign(this.sprite.body!.velocity.x);
      this.sprite.setVelocityX(sign * maxX);
    }

    // Flip sprite based on direction
    this.sprite.setFlipX(!this.facingRight);

    // Jump → apply an upward impulse; gravity does the rest.
    if (inputs.justPressed('Jump') && onGround && this.flipEnabled) {
      this.startJump();
    }

    // Animations
    this.updateAnimation(onGround);
  }

  /**
   * Apply a real velocity-based jump. Gravity stays on, so Arcade physics
   * handles the arc and collides correctly with every solid body (in
   * particular the shaft walls) — unlike the previous scripted flip which
   * used `setPosition` and teleported through collisions.
   */
  private startJump(): void {
    this.isFlipping = true;
    const jumpV = this.isCaffeinated()
      ? PLAYER_JUMP_VELOCITY * CAFFEINE_JUMP_MULT
      : PLAYER_JUMP_VELOCITY;
    this.sprite.setVelocityY(jumpV);

    this.currentAnim = 'flip';
    this.sprite.anims.play('player_flip', true);
    this.sprite.setFlipX(!this.facingRight);

    this.emitDust();
    eventBus.emit('sfx:jump');
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
    this.currentAnim = 'land';
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
    const body = this.sprite.body as Phaser.Physics.Arcade.Body;
    const vx = Math.abs(body.velocity.x);
    let newAnim: PlayerAnimState;

    if (!onGround) {
      // Require a short airborne grace before committing to an airborne
      // pose — prevents 1-frame onGround flickers (tile seams, platform
      // handoffs) from forcing an idle character into a squat silhouette.
      const airborneMs =
        this.airborneSince !== null ? this.scene.time.now - this.airborneSince : 0;
      if (airborneMs < this.AIRBORNE_ANIM_GRACE_MS) {
        return;
      }
      // Ascending after a jump → flip rotation. Descending (or walking off
      // a ledge) → tucked fall pose.
      if (this.isFlipping && body.velocity.y < 0) {
        newAnim = 'flip';
      } else {
        newAnim = 'fall';
      }
    } else if (vx > 20) {
      newAnim = 'walk';
    } else {
      newAnim = 'idle';
    }

    if (newAnim !== this.currentAnim) {
      this.currentAnim = newAnim;
      this.sprite.anims.play(`player_${newAnim}`, true);
      if (newAnim === 'walk') {
        this.currentWalkFps = this.computeWalkFps(vx);
        this.sprite.anims.msPerFrame = 1000 / this.currentWalkFps;
      }
    } else if (newAnim === 'walk') {
      // Keep foot cadence matched to ground speed while walking. Only push
      // the new rate through when it has changed meaningfully, so we don't
      // restart the tween every frame on tiny velocity jitter.
      const targetFps = this.computeWalkFps(vx);
      if (Math.abs(targetFps - this.currentWalkFps) >= 1) {
        this.currentWalkFps = targetFps;
        this.sprite.anims.msPerFrame = 1000 / targetFps;
      }
    }
  }

  private computeWalkFps(vx: number): number {
    const raw = vx / this.WALK_PX_PER_FRAME;
    const clamped = Math.max(this.WALK_MIN_FPS, Math.min(this.WALK_MAX_FPS, raw));
    return Math.round(clamped);
  }

  private emitDust(): void {
    if (this.dustEmitter) {
      this.dustEmitter.setPosition(this.sprite.x, this.sprite.y + 70);
      this.dustEmitter.explode(5);
    }
  }

  private createCaffeineEmitter(): void {
    if (!this.scene.textures.exists('particle')) return;
    this.caffeineSteam = this.scene.add.particles(0, 0, 'particle', {
      speed: { min: 20, max: 60 },
      angle: { min: 250, max: 290 },
      scale: { start: 0.5, end: 0 },
      alpha: { start: 0.55, end: 0 },
      lifespan: 520,
      frequency: 80,
      quantity: 1,
      tint: 0xe8d8c0,
      emitting: false,
    });
    this.caffeineSteam.setDepth(9);
  }

  /**
   * Called every tick from {@link update}. Follows the steam emitter to
   * the sprite while active and transitions out cleanly on expiry.
   */
  private tickCaffeine(): void {
    const now = this.scene.time.now;
    if (this.caffeine.isActive(now)) {
      if (this.caffeineSteam) {
        this.caffeineSteam.setPosition(this.sprite.x, this.sprite.y - 10);
      }
    } else if (this.caffeineSteam?.emitting) {
      this.caffeineSteam.stop();
      eventBus.emit('buff:caffeine_end');
    }
  }

  /**
   * Activate (or refresh) the caffeine buff. Re-applying while active
   * refreshes the timer to the full `durationMs` — no stacking.
   */
  applyCaffeine(durationMs: number = CAFFEINE_DURATION_MS): void {
    const now = this.scene.time.now;
    this.caffeine.activate(now, durationMs);
    this.caffeineSteam?.setPosition(this.sprite.x, this.sprite.y - 10);
    this.caffeineSteam?.start();
    // Emit on every activation — the HUD listener resets its countdown
    // ring to full, which is the right behaviour for both a fresh buff
    // and a refresh of an already-active one.
    eventBus.emit('buff:caffeine_start', durationMs);
  }

  isCaffeinated(): boolean {
    return this.caffeine.isActive(this.scene.time.now);
  }

  setFlipEnabled(enabled: boolean): void {
    this.flipEnabled = enabled;
  }

  /**
   * Whether the player is currently immune to enemy hits.
   * Used by LevelScene's player↔enemy overlap to skip repeat damage.
   */
  isInvulnerable(): boolean {
    return this.scene.time.now < this.invulnerableUntil;
  }

  /**
   * Apply a hit: brief invulnerability, knockback, sprite flash.
   * Caller is responsible for AU deduction and dropped-AU spawning.
   *
   * `knockX` / `knockY` are applied to the physics body. Positive knockX
   * pushes right. No-op if already invulnerable or mid-flip (flip is a
   * scripted arc we don't want to interrupt).
   */
  takeHit(knockX: number, knockY: number, durationMs = 1000): void {
    if (this.isInvulnerable()) return;
    if (this.isFlipping) return;

    const now = this.scene.time.now;
    this.invulnerableUntil = now + durationMs;
    this.hitStunUntil = now + 220;

    const body = this.sprite.body as Phaser.Physics.Arcade.Body;
    body.setAllowGravity(true);
    this.sprite.setVelocity(knockX, knockY);

    this.hitFlashTween?.stop();
    this.sprite.setAlpha(1);
    this.hitFlashTween = this.scene.tweens.add({
      targets: this.sprite,
      alpha: { from: 1, to: 0.3 },
      duration: 90,
      yoyo: true,
      repeat: Math.floor(durationMs / 180),
      onComplete: () => this.sprite.setAlpha(1),
    });
  }

  /** True if horizontal input is currently suppressed by a recent hit. */
  isHitStunned(): boolean {
    return this.scene.time.now < this.hitStunUntil;
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
