import * as Phaser from 'phaser';

/**
 * Boss health bar — fixed to the top-centre of the screen.
 *
 * Fill gradient: gold (HP > 7) → orange (HP 4–7) → red (HP ≤ 3).
 * Shakes on each hit.
 */
export class BossHealthBar {
  private readonly container: Phaser.GameObjects.Container;
  private readonly barGfx: Phaser.GameObjects.Graphics;
  private readonly label: Phaser.GameObjects.Text;
  private readonly maxHp: number;
  private lastHp: number;

  private static readonly BAR_W = 320;
  private static readonly BAR_H = 18;
  private static readonly X = 640;
  private static readonly Y = 24;

  constructor(scene: Phaser.Scene, label: string, maxHp: number) {
    this.maxHp = maxHp;
    this.lastHp = maxHp;

    this.barGfx = scene.add.graphics().setScrollFactor(0).setDepth(60);
    this.label = scene.add.text(BossHealthBar.X, BossHealthBar.Y - 16, label, {
      fontFamily: 'monospace',
      fontSize: '14px',
      color: '#ffd700',
      fontStyle: 'bold',
    }).setOrigin(0.5, 1).setScrollFactor(0).setDepth(60);

    this.container = scene.add.container(0, 0, [this.barGfx, this.label]).setScrollFactor(0).setDepth(60);

    this.draw(maxHp);
  }

  update(hp: number): void {
    if (hp !== this.lastHp) {
      this.lastHp = hp;
      this.draw(hp);
      this.shake();
    }
  }

  private draw(hp: number): void {
    const g = this.barGfx;
    g.clear();
    const cx = BossHealthBar.X;
    const y = BossHealthBar.Y;
    const w = BossHealthBar.BAR_W;
    const h = BossHealthBar.BAR_H;
    const x = cx - w / 2;

    // Background track
    g.fillStyle(0x1a1a1a, 0.85);
    g.fillRoundedRect(x - 2, y - 2, w + 4, h + 4, 4);

    // Fill colour based on HP ratio
    const ratio = Math.max(0, hp / this.maxHp);
    const fillColor = ratio > 0.7 ? 0xffd700 : ratio > 0.3 ? 0xff8c00 : 0xcc2222;
    g.fillStyle(fillColor, 1);
    g.fillRoundedRect(x, y, Math.floor(w * ratio), h, 3);

    // Border
    g.lineStyle(1, 0x666666, 0.8);
    g.strokeRoundedRect(x - 2, y - 2, w + 4, h + 4, 4);

    // HP text
    this.label.setText(`${hp} / ${this.maxHp}`);
  }

  private shake(): void {
    const scene = this.barGfx.scene;
    const origX = BossHealthBar.X;
    scene.tweens.add({
      targets: this.barGfx,
      x: origX + 4,
      duration: 40,
      yoyo: true,
      repeat: 2,
      onComplete: () => this.barGfx.setX(0),
    });
  }

  destroy(): void {
    this.container.destroy();
    this.barGfx.destroy();
    this.label.destroy();
  }
}
