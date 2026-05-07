import * as Phaser from 'phaser';
import { GAME_WIDTH } from '../config/gameConfig';
import { settingsStore } from '../systems/SettingsStore';
import { createSceneLifecycle } from '../systems/sceneLifecycle';

const BANNER_WIDTH = 280;
const BANNER_HEIGHT = 34;
const BANNER_Y = 52;

export interface ObjectiveBannerOptions {
  getText: () => string;
  isModalOpen?: () => boolean;
}

export class ObjectiveBanner extends Phaser.GameObjects.Container {
  private readonly getText: () => string;
  private readonly isModalOpen: () => boolean;
  private readonly label: Phaser.GameObjects.Text;
  private currentText = '';

  constructor(scene: Phaser.Scene, options: ObjectiveBannerOptions) {
    super(scene, GAME_WIDTH / 2, BANNER_Y);
    this.getText = options.getText;
    this.isModalOpen = options.isModalOpen ?? (() => false);

    const bg = scene.add.graphics();
    bg.fillStyle(0x081020, 0.7);
    bg.lineStyle(1, 0x8fb4ff, 0.45);
    bg.fillRoundedRect(-BANNER_WIDTH / 2, -BANNER_HEIGHT / 2, BANNER_WIDTH, BANNER_HEIGHT, 8);
    bg.strokeRoundedRect(-BANNER_WIDTH / 2, -BANNER_HEIGHT / 2, BANNER_WIDTH, BANNER_HEIGHT, 8);

    this.label = scene.add.text(0, 0, '', {
      fontFamily: 'monospace',
      fontSize: '14px',
      color: '#d8e8ff',
      fontStyle: 'bold',
      resolution: 2,
    }).setOrigin(0.5);

    this.add([bg, this.label]);
    this.setDepth(55).setScrollFactor(0);
    scene.add.existing(this);

    const lifecycle = createSceneLifecycle(scene);
    lifecycle.bindEventBus('progression:changed', () => this.refreshText());
    lifecycle.bindEventBus('quiz:completed', () => this.refreshText());
    lifecycle.bindEventBus('boss:phase_changed', () => this.refreshText());
    lifecycle.bindEventBus('settings:changed', () => this.refreshVisibility());

    this.refreshText();
  }

  update(): void {
    this.refreshVisibility();
  }

  private refreshText(): void {
    const next = this.getText().trim();
    if (next !== this.currentText) {
      this.currentText = next;
      this.label.setText(next);
    }
    this.refreshVisibility();
  }

  private refreshVisibility(): void {
    const settings = settingsStore.read();
    const shouldShow = settings.showObjectiveBanner
      && this.currentText.length > 0
      && !this.isModalOpen();
    this.setVisible(shouldShow);
  }
}
