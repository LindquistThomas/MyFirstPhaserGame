import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, FLOORS, FloorId, COLORS } from '../config/gameConfig';
import { LEVEL_DATA } from '../config/levelData';
import { ProgressionSystem } from '../systems/ProgressionSystem';

export class ElevatorPanel {
  private scene: Phaser.Scene;
  private progression: ProgressionSystem;
  private container!: Phaser.GameObjects.Container;
  private isVisible = false;
  private onSelectCallback: (floorId: FloorId) => void;
  private buttons: Map<FloorId, Phaser.GameObjects.Container> = new Map();

  constructor(
    scene: Phaser.Scene,
    progression: ProgressionSystem,
    onSelect: (floorId: FloorId) => void
  ) {
    this.scene = scene;
    this.progression = progression;
    this.onSelectCallback = onSelect;
    this.create();
  }

  private create(): void {
    const panelWidth = 200;
    const panelHeight = 220;
    const panelX = GAME_WIDTH / 2 - panelWidth / 2;
    const panelY = GAME_HEIGHT - panelHeight - 60;

    this.container = this.scene.add.container(panelX, panelY);
    this.container.setDepth(60);
    this.container.setScrollFactor(0);
    this.container.setVisible(true);

    // Panel background
    const bg = this.scene.add.graphics();
    bg.fillStyle(0x0a0a2a, 0.9);
    bg.fillRoundedRect(0, 0, panelWidth, panelHeight, 8);
    bg.lineStyle(2, 0x00d4ff, 0.5);
    bg.strokeRoundedRect(0, 0, panelWidth, panelHeight, 8);
    this.container.add(bg);

    // Title
    const title = this.scene.add.text(panelWidth / 2, 12, 'ELEVATOR', {
      fontFamily: 'monospace',
      fontSize: '14px',
      color: COLORS.titleText,
      fontStyle: 'bold',
    }).setOrigin(0.5, 0);
    this.container.add(title);

    // Floor buttons
    const floors: FloorId[] = [FLOORS.CLOUD_TEAM, FLOORS.PLATFORM_TEAM, FLOORS.LOBBY];
    let yOffset = 45;

    for (const floorId of floors) {
      const floorData = LEVEL_DATA[floorId];
      const isUnlocked = this.progression.isFloorUnlocked(floorId);

      const btnContainer = this.scene.add.container(10, yOffset);

      const btnBg = this.scene.add.graphics();
      btnBg.fillStyle(isUnlocked ? 0x1a3a5a : 0x3a1a1a, 0.8);
      btnBg.fillRoundedRect(0, 0, panelWidth - 20, 45, 4);
      btnContainer.add(btnBg);

      // Floor number
      const floorNum = this.scene.add.text(10, 5, `F${floorId}`, {
        fontFamily: 'monospace',
        fontSize: '16px',
        color: isUnlocked ? '#00d4ff' : '#ff4444',
        fontStyle: 'bold',
      });
      btnContainer.add(floorNum);

      // Floor name
      const floorName = this.scene.add.text(10, 24, floorData.name, {
        fontFamily: 'monospace',
        fontSize: '11px',
        color: isUnlocked ? '#aabbcc' : '#664444',
      });
      btnContainer.add(floorName);

      // Status indicator
      const statusText = isUnlocked ? '▶' : '🔒';
      const status = this.scene.add.text(panelWidth - 40, 12, statusText, {
        fontFamily: 'monospace',
        fontSize: '16px',
        color: isUnlocked ? '#53a653' : '#8b0000',
      });
      btnContainer.add(status);

      // Make interactive if unlocked
      if (isUnlocked) {
        const hitArea = this.scene.add.rectangle(
          (panelWidth - 20) / 2, 22, panelWidth - 20, 45
        ).setInteractive({ useHandCursor: true });
        hitArea.setAlpha(0.001);
        btnContainer.add(hitArea);

        hitArea.on('pointerover', () => {
          btnBg.clear();
          btnBg.fillStyle(0x2a5a8a, 0.9);
          btnBg.fillRoundedRect(0, 0, panelWidth - 20, 45, 4);
        });

        hitArea.on('pointerout', () => {
          btnBg.clear();
          btnBg.fillStyle(0x1a3a5a, 0.8);
          btnBg.fillRoundedRect(0, 0, panelWidth - 20, 45, 4);
        });

        hitArea.on('pointerdown', () => {
          this.onSelectCallback(floorId);
        });
      }

      this.container.add(btnContainer);
      this.buttons.set(floorId, btnContainer);
      yOffset += 52;
    }
  }

  show(): void {
    this.isVisible = true;
    this.container.setVisible(true);
  }

  hide(): void {
    this.isVisible = false;
    this.container.setVisible(false);
  }

  toggle(): void {
    if (this.isVisible) this.hide();
    else this.show();
  }
}
