import Phaser from 'phaser';
import { GAME_WIDTH, COLORS } from '../config/gameConfig';
import { ProgressionSystem } from '../systems/ProgressionSystem';
import { LEVEL_DATA } from '../config/levelData';

export class HUD {
  private scene: Phaser.Scene;
  private progression: ProgressionSystem;
  private tokenText!: Phaser.GameObjects.Text;
  private floorText!: Phaser.GameObjects.Text;
  private container!: Phaser.GameObjects.Container;

  constructor(scene: Phaser.Scene, progression: ProgressionSystem) {
    this.scene = scene;
    this.progression = progression;
    this.create();
  }

  private create(): void {
    this.container = this.scene.add.container(0, 0);
    this.container.setDepth(50);
    this.container.setScrollFactor(0);

    // Background bar
    const bg = this.scene.add.graphics();
    bg.fillStyle(COLORS.hudBackground, 0.7);
    bg.fillRect(0, 0, GAME_WIDTH, 36);
    bg.lineStyle(1, 0x00d4ff, 0.3);
    bg.lineBetween(0, 36, GAME_WIDTH, 36);
    this.container.add(bg);

    // Token counter
    const tokenIcon = this.scene.add.graphics();
    tokenIcon.fillStyle(COLORS.token);
    tokenIcon.fillCircle(22, 18, 8);
    tokenIcon.fillStyle(0xffed4a);
    tokenIcon.fillCircle(21, 17, 5);
    this.container.add(tokenIcon);

    this.tokenText = this.scene.add.text(38, 8, '0', {
      fontFamily: 'monospace',
      fontSize: '16px',
      color: COLORS.hudText,
      fontStyle: 'bold',
    });
    this.container.add(this.tokenText);

    // Floor indicator
    this.floorText = this.scene.add.text(GAME_WIDTH - 16, 8, '', {
      fontFamily: 'monospace',
      fontSize: '14px',
      color: COLORS.titleText,
    }).setOrigin(1, 0);
    this.container.add(this.floorText);

    // Game title
    const title = this.scene.add.text(GAME_WIDTH / 2, 8, 'ARCHITECTURE ELEVATOR', {
      fontFamily: 'monospace',
      fontSize: '12px',
      color: '#556677',
    }).setOrigin(0.5, 0);
    this.container.add(title);
  }

  update(): void {
    this.tokenText.setText(`${this.progression.getTotalTokens()}`);

    const currentFloor = this.progression.getCurrentFloor();
    const floorData = LEVEL_DATA[currentFloor];
    if (floorData) {
      this.floorText.setText(`F${currentFloor}: ${floorData.name}`);
    }
  }
}
