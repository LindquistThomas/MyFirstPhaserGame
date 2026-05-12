import * as Phaser from 'phaser';
import { isReducedMotion } from '../systems/MotionPreference';

/**
 * A checkpoint marker that records the player's position when triggered.
 *
 * Visual: a small flag-and-pole glyph drawn with Phaser Graphics.
 * Activation: caller provides an `onActivate` callback invoked the first time
 * the player overlaps the invisible physics trigger. Subsequent overlaps are
 * ignored (once per visit).
 */
export class Checkpoint {
  /** Invisible physics trigger the caller wires into `physics.add.overlap`. */
  public readonly trigger: Phaser.Physics.Arcade.Image;

  /** Whether this checkpoint has already been activated this visit. */
  public activated = false;

  private readonly flagGraphic: Phaser.GameObjects.Graphics;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    id: string,
    onActivate: (checkpoint: Checkpoint) => void,
    activatedOnSpawn = false,
  ) {
    // --- Invisible physics trigger (32×64 box centred at x, y) ---
    this.trigger = scene.physics.add.image(x, y, '__DEFAULT');
    this.trigger.setVisible(false);
    this.trigger.setImmovable(true);
    const body = this.trigger.body as Phaser.Physics.Arcade.Body;
    body.setAllowGravity(false);
    body.setSize(32, 64);
    body.setOffset(-16, -32);

    // Store id on the game object for debug tools.
    this.trigger.setData('checkpointId', id);

    // --- Visual flag ---
    this.flagGraphic = scene.add.graphics().setDepth(6);
    this.activated = activatedOnSpawn;
    this.drawFlag(x, y, activatedOnSpawn ? 'consumed' : 'inactive');

    // Subtle idle bob (skip under reduced motion).
    if (!isReducedMotion() && !activatedOnSpawn) {
      scene.tweens.add({
        targets: this.flagGraphic,
        y: this.flagGraphic.y - 4,
        duration: 900,
        ease: 'Sine.easeInOut',
        yoyo: true,
        repeat: -1,
      });
    }

    // Wire the physics trigger callback.
    // The actual activation callback is wired externally by the caller
    // (LevelScene / BossArenaScene) so it has access to the player sprite.
    this._pendingCallback = () => {
      if (this.activated) return;
      this.activated = true;
      this.drawFlag(x, y, 'active');
      onActivate(this);
    };
  }

  /**
   * Wire the player sprite overlap.
   *
   * Called after both the player and this checkpoint are created so the scene
   * can pass the correct `physics` reference.
   */
  wireOverlap(
    physics: Phaser.Physics.Arcade.ArcadePhysics,
    playerSprite: Phaser.Physics.Arcade.Sprite,
  ): void {
    physics.add.overlap(
      playerSprite,
      this.trigger,
      this._pendingCallback as Phaser.Types.Physics.Arcade.ArcadePhysicsCallback,
    );
  }

  private _pendingCallback: () => void;

  private drawFlag(x: number, y: number, state: 'inactive' | 'active' | 'consumed'): void {
    const g = this.flagGraphic;
    g.clear();

    const active = state === 'active';
    const consumed = state === 'consumed';
    const poleColor = active ? 0xffd700 : consumed ? 0x7d858c : 0x888888;
    const flagColor = active ? 0x00cc66 : consumed ? 0x5f7785 : 0x446688;
    const glowColor = active ? 0x44ff88 : consumed ? 0xa6b2bb : 0x88aacc;
    const poleH = 36;
    const poleW = 3;
    const flagW = 18;
    const flagH = 12;
    const baseX = x - 1;
    const baseY = y - 4;

    // Pole.
    g.fillStyle(poleColor, 1);
    g.fillRect(baseX, baseY - poleH, poleW, poleH);

    // Flag body.
    g.fillStyle(flagColor, 1);
    g.fillRect(baseX + poleW, baseY - poleH, flagW, flagH);
    // Lighter top rim.
    g.fillStyle(glowColor, 0.8);
    g.fillRect(baseX + poleW, baseY - poleH, flagW, 2);

    // Base peg.
    g.fillStyle(poleColor, 0.6);
    g.fillRect(baseX - 3, baseY, poleW + 6, 4);

    // Active: radiating ring.
    if (active) {
      g.lineStyle(2, 0x44ff88, 0.45);
      g.strokeCircle(baseX + 1, baseY - poleH / 2, 20);
    }
  }
}
