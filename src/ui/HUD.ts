import * as Phaser from 'phaser';
import { GAME_WIDTH, COLORS } from '../config/gameConfig';
import { ProgressionSystem } from '../systems/ProgressionSystem';
import { LEVEL_DATA } from '../config/levelData';
import { eventBus } from '../systems/EventBus';
import type { AudioManager } from '../systems/AudioManager';

export class HUD {
  private scene: Phaser.Scene;
  private progression: ProgressionSystem;
  private auText!: Phaser.GameObjects.Text;
  private floorText!: Phaser.GameObjects.Text;
  private container!: Phaser.GameObjects.Container;
  private muteIcon!: Phaser.GameObjects.Graphics;
  private muteHit!: Phaser.GameObjects.Zone;
  private onMuteChanged = (muted: boolean): void => this.renderMuteIcon(muted);

  constructor(scene: Phaser.Scene, progression: ProgressionSystem) {
    this.scene = scene;
    this.progression = progression;
    this.create();
  }

  private create(): void {
    this.container = this.scene.add.container(0, 0).setDepth(50).setScrollFactor(0);

    const bg = this.scene.add.graphics();
    bg.fillStyle(COLORS.hudBackground, 0.7);
    bg.fillRect(0, 0, GAME_WIDTH, 44);
    bg.lineStyle(1, 0x00d4ff, 0.3);
    bg.lineBetween(0, 44, GAME_WIDTH, 44);
    this.container.add(bg);

    // AU icon (gold coin)
    const icon = this.scene.add.graphics();
    icon.fillStyle(COLORS.token);
    icon.fillCircle(26, 22, 12);
    icon.fillStyle(0xffed4a);
    icon.fillCircle(25, 21, 8);
    this.container.add(icon);

    // AU label + counter
    this.auText = this.scene.add.text(46, 8, 'AU: 0', {
      fontFamily: 'monospace', fontSize: '20px',
      color: COLORS.hudText, fontStyle: 'bold',
    });
    this.container.add(this.auText);

    // Music mute toggle (left of floor indicator)
    const muteX = GAME_WIDTH - 220;
    const muteY = 22;
    this.muteIcon = this.scene.add.graphics();
    this.muteIcon.setPosition(muteX, muteY);
    this.container.add(this.muteIcon);
    this.muteHit = this.scene.add.zone(muteX, muteY, 32, 32).setInteractive({ useHandCursor: true });
    this.muteHit.on('pointerup', () => eventBus.emit('audio:toggle-mute'));
    this.container.add(this.muteHit);
    this.renderMuteIcon(this.getAudio()?.isMuted() ?? false);
    eventBus.on('audio:mute-changed', this.onMuteChanged);
    this.scene.events.once('shutdown', () => {
      eventBus.off('audio:mute-changed', this.onMuteChanged);
    });

    // Floor indicator (right)
    this.floorText = this.scene.add.text(GAME_WIDTH - 16, 10, '', {
      fontFamily: 'monospace', fontSize: '16px', color: COLORS.titleText,
    }).setOrigin(1, 0);
    this.container.add(this.floorText);

    // Game title (center)
    this.container.add(
      this.scene.add.text(GAME_WIDTH / 2, 9, 'SO YOU WANT TO BE AN ARCHITECT', {
        fontFamily: 'monospace', fontSize: '18px', color: '#b8c8dc', fontStyle: 'bold',
      }).setOrigin(0.5, 0),
    );
  }

  private getAudio(): AudioManager | undefined {
    return this.scene.registry.get('audio') as AudioManager | undefined;
  }

  /** Draw a musical-note icon; struck-through when muted. */
  private renderMuteIcon(muted: boolean): void {
    const g = this.muteIcon;
    g.clear();
    const color = muted ? 0x808080 : 0x00d4ff;
    // Note stem
    g.lineStyle(2, color, 1);
    g.beginPath();
    g.moveTo(4, -10);
    g.lineTo(4, 8);
    g.strokePath();
    // Flag
    g.lineStyle(2, color, 1);
    g.beginPath();
    g.moveTo(4, -10);
    g.lineTo(12, -6);
    g.lineTo(12, 2);
    g.strokePath();
    // Note head
    g.fillStyle(color, 1);
    g.fillEllipse(0, 8, 10, 7);
    if (muted) {
      g.lineStyle(2.5, 0xff4444, 1);
      g.beginPath();
      g.moveTo(-12, -14);
      g.lineTo(14, 14);
      g.strokePath();
    }
  }

  update(): void {
    this.auText.setText(`AU: ${this.progression.getTotalAU()}`);
    const fd = LEVEL_DATA[this.progression.getCurrentFloor()];
    if (fd) this.floorText.setText(`F${fd.id}: ${fd.name}`);
  }
}
