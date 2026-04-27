import * as Phaser from 'phaser';
import { eventBus } from '../systems/EventBus';

export type BossPhase = 1 | 2 | 3;

/**
 * CEO Boss — "The Knowledge Cowboy".
 *
 * Three-phase AI:
 *   Phase 1 (HP 10–8) — Slow patrol, charges every 5s.
 *   Phase 2 (HP 7–4)  — Faster patrol, throws briefcases every 4s.
 *   Phase 3 (HP 3–0)  — Max speed, briefcase every 2s, 3s dashes.
 *
 * Knowledge gate: HP cannot drop below 1 unless `phasePromptsAnsweredCorrectly > 0`.
 * `triggerDefeat()` plays the respectful handoff cutscene instead of a death animation.
 */
export class CEOBoss extends Phaser.Physics.Arcade.Sprite {
  static readonly MAX_HP = 10;

  private hp = CEOBoss.MAX_HP;
  phase: BossPhase = 1;
  defeated = false;
  /** Tracks correct prompt answers for the current phase (knowledge gate). */
  phasePromptsAnsweredCorrectly = 0;

  private iFrameTimer = 0;
  private readonly I_FRAME_MS = 500;

  private chargeTimer = 0;
  private briefcaseTimer = 0;
  private isCharging = false;

  private readonly PATROL_SPEED_P1 = 80;
  private readonly PATROL_SPEED_P2 = 140;
  private readonly PATROL_SPEED_P3 = 200;
  private readonly CHARGE_SPEED = 420;

  private patrolDir = 1;
  private minX: number;
  private maxX: number;

  constructor(scene: Phaser.Scene, x: number, y: number, minX: number, maxX: number) {
    super(scene, x, y, 'boss_ceo');
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setDepth(8);
    this.minX = minX;
    this.maxX = maxX;

    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setCollideWorldBounds(true);
    body.setSize(44, 58);
    body.setOffset(2, 6);
  }

  get currentHp(): number { return this.hp; }

  /**
   * Attempt to deal 1 damage. Respects i-frame cooldown and the knowledge gate.
   * Returns true if damage was actually applied.
   */
  takeDamage(ignorKnowledgeGate = false): boolean {
    if (this.defeated || this.iFrameTimer > 0) return false;
    // Knowledge gate: can't finish phase without at least one correct prompt.
    if (!ignorKnowledgeGate && this.hp <= 1 && this.phasePromptsAnsweredCorrectly === 0) {
      return false;
    }
    this.hp = Math.max(0, this.hp - 1);
    this.iFrameTimer = this.I_FRAME_MS;
    eventBus.emit('sfx:boss_hit');

    // Flash white on hit
    this.setTexture('boss_ceo_hit');
    this.scene.time.delayedCall(80, () => {
      if (!this.scene) return;
      this.setTexture(this.phase === 3 ? 'boss_ceo' : 'boss_ceo');
      if (this.phase === 3) this.setTint(0xffd700);
    });

    this.checkPhaseTransition();
    if (this.hp === 0) this.triggerDefeat();
    return true;
  }

  /** Correct quiz answer: disable hazard, earn knowledge gate credit, deal bonus damage. */
  onCorrectAnswer(): void {
    this.phasePromptsAnsweredCorrectly++;
    this.takeDamage(true);
    // Reset briefcase timer (brief breathing room)
    this.briefcaseTimer = Math.max(this.briefcaseTimer, 3000);
  }

  /** Wrong quiz answer: restore 1 HP (capped at phase max), refill charge timer. */
  onWrongAnswer(): void {
    const phaseMax = this.phase === 1 ? 10 : this.phase === 2 ? 7 : 3;
    this.hp = Math.min(phaseMax, this.hp + 1);
    this.chargeTimer = 0;
  }

  private checkPhaseTransition(): void {
    let newPhase: BossPhase = this.phase;
    if (this.hp <= 3) newPhase = 3;
    else if (this.hp <= 7) newPhase = 2;

    if (newPhase !== this.phase) {
      this.phase = newPhase;
      this.phasePromptsAnsweredCorrectly = 0;
      this.chargeTimer = 0;
      this.briefcaseTimer = 0;
      this.isCharging = false;
      if (this.phase === 3) this.setTint(0xffd700);
      eventBus.emit('sfx:boss_phase');
    }
  }

  update(delta: number, playerX: number, _playerY: number): void {
    if (this.defeated) return;

    // Cool i-frames
    if (this.iFrameTimer > 0) this.iFrameTimer -= delta;

    const body = this.body as Phaser.Physics.Arcade.Body;
    const speed = this.phase === 1
      ? this.PATROL_SPEED_P1
      : this.phase === 2
      ? this.PATROL_SPEED_P2
      : this.PATROL_SPEED_P3;

    // Update timers
    this.chargeTimer -= delta;
    this.briefcaseTimer -= delta;

    const chargeInterval = 5000;
    const briefcaseInterval = this.phase === 2 ? 4000 : 2000;

    // Charge attack (phase 1+)
    if (this.chargeTimer <= 0 && !this.isCharging) {
      this.isCharging = true;
      this.chargeTimer = chargeInterval;
      const dir = playerX < this.x ? -1 : 1;
      body.setVelocityX(this.CHARGE_SPEED * dir);
      this.setFlipX(dir < 0);
      this.scene.time.delayedCall(600, () => {
        if (!this.scene || this.defeated) return;
        this.isCharging = false;
        body.setVelocityX(speed * this.patrolDir);
      });
      return;
    }

    if (this.isCharging) return;

    // Normal patrol
    if (this.x <= this.minX && body.velocity.x < 0) {
      this.patrolDir = 1;
      body.setVelocityX(speed);
      this.setFlipX(false);
    } else if (this.x >= this.maxX && body.velocity.x > 0) {
      this.patrolDir = -1;
      body.setVelocityX(-speed);
      this.setFlipX(true);
    }

    if (Math.abs(body.velocity.x) < speed * 0.5) {
      body.setVelocityX(speed * this.patrolDir);
    }

    // Briefcase throw (phase 2+)
    if (this.phase >= 2 && this.briefcaseTimer <= 0) {
      this.briefcaseTimer = briefcaseInterval;
      eventBus.emit('sfx:briefcase_throw');
      // The scene creates the actual projectile — we just signal readiness.
      this.emit('throwBriefcase', playerX);
    }
  }

  /**
   * Trigger the respectful knowledge handoff ending.
   * AI pauses → stagger tween → dialogue fires → boss fades → `boss:defeated` emits.
   */
  triggerDefeat(): void {
    if (this.defeated) return;
    this.defeated = true;
    const body = this.body as Phaser.Physics.Arcade.Body;
    if (body) { body.setVelocity(0, 0); body.enable = false; }
    this.scene.tweens.killTweensOf(this);

    // Stagger → steady up
    this.scene.tweens.add({
      targets: this,
      angle: { from: -8, to: 8 },
      duration: 120,
      yoyo: true,
      repeat: 2,
      onComplete: () => {
        if (!this.scene) return;
        this.setAngle(0);
        // Signal scene to show dialogue panel
        this.emit('defeatDialogue');
      },
    });
  }

  /** Called by the scene after the defeat dialogue panel closes. */
  fadeOut(): void {
    this.scene.tweens.add({
      targets: this,
      alpha: 0,
      duration: 1200,
      ease: 'Sine.easeIn',
      onComplete: () => {
        eventBus.emit('boss:defeated');
        this.destroy();
      },
    });
  }
}
