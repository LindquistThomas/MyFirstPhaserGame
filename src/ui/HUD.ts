import * as Phaser from 'phaser';
import { GAME_WIDTH, COLORS } from '../config/gameConfig';
import { ProgressionSystem } from '../systems/ProgressionSystem';
import { LEVEL_DATA } from '../config/levelData';

export class HUD {
  private scene: Phaser.Scene;
  private progression: ProgressionSystem;
  private auText!: Phaser.GameObjects.Text;
  private floorText!: Phaser.GameObjects.Text;
  private container!: Phaser.GameObjects.Container;

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

    // Floor indicator (right)
    this.floorText = this.scene.add.text(GAME_WIDTH - 16, 10, '', {
      fontFamily: 'monospace', fontSize: '16px', color: COLORS.titleText,
    }).setOrigin(1, 0);
    this.container.add(this.floorText);

    // Game title (center)
    this.container.add(
      this.scene.add.text(GAME_WIDTH / 2, 10, 'ARCHITECTURE ELEVATOR', {
        fontFamily: 'monospace', fontSize: '14px', color: '#556677',
      }).setOrigin(0.5, 0),
    );
  }

  update(): void {
    this.auText.setText(`AU: ${this.progression.getTotalAU()}`);
    const fd = LEVEL_DATA[this.progression.getCurrentFloor()];
    if (fd) this.floorText.setText(`F${fd.id}: ${fd.name}`);
  }
}
