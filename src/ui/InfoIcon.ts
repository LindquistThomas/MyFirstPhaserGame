import * as Phaser from 'phaser';

export class InfoIcon {
  private container: Phaser.GameObjects.Container;
  private pulseTween: Phaser.Tweens.Tween;
  private badge?: Phaser.GameObjects.Container;

  constructor(scene: Phaser.Scene, x: number, y: number, onClick: () => void) {
    this.container = scene.add.container(x, y);
    this.container.setDepth(55);
    this.container.setScrollFactor(0);

    const circle = scene.add.graphics();
    circle.fillStyle(0x0a0a2a, 0.85);
    circle.fillCircle(0, 0, 14);
    circle.lineStyle(1.5, 0x00aaff, 0.7);
    circle.strokeCircle(0, 0, 14);
    this.container.add(circle);

    const label = scene.add.text(0, 0, 'i', {
      fontFamily: 'monospace', fontSize: '16px',
      color: '#00aaff', fontStyle: 'bold',
    }).setOrigin(0.5);
    this.container.add(label);

    const hitArea = scene.add.rectangle(0, 0, 32, 32)
      .setInteractive({ useHandCursor: true })
      .setAlpha(0.001);

    hitArea.on('pointerover', () => label.setColor('#88ddff'));
    hitArea.on('pointerout', () => label.setColor('#00aaff'));
    hitArea.on('pointerdown', () => onClick());
    this.container.add(hitArea);

    this.pulseTween = scene.tweens.add({
      targets: this.container, alpha: { from: 1, to: 0.55 },
      duration: 1400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
    });
  }

  /** Show a small badge on the info icon indicating quiz status. */
  setQuizBadge(scene: Phaser.Scene, passed: boolean): void {
    if (this.badge) {
      this.badge.destroy();
      this.badge = undefined;
    }

    this.badge = scene.add.container(10, -10);

    const badgeBg = scene.add.graphics();
    if (passed) {
      badgeBg.fillStyle(0x228b22, 1);
      badgeBg.fillCircle(0, 0, 7);
    } else {
      badgeBg.fillStyle(0xdaa520, 1);
      badgeBg.fillCircle(0, 0, 7);
    }
    this.badge.add(badgeBg);

    const badgeLabel = scene.add.text(0, 0, passed ? '\u2713' : '?', {
      fontFamily: 'monospace', fontSize: passed ? '10px' : '11px',
      color: '#ffffff', fontStyle: 'bold',
    }).setOrigin(0.5);
    this.badge.add(badgeLabel);

    this.container.add(this.badge);
  }

  setVisible(visible: boolean): void {
    this.container.setVisible(visible);
  }

  destroy(): void {
    this.pulseTween.destroy();
    this.container.destroy();
  }
}
