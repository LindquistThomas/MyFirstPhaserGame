import * as Phaser from 'phaser';
import { theme } from '../style/theme';

const loadingColor = `#${theme.color.ui.accent.toString(16).padStart(6, '0')}`;

/**
 * Minimal transition overlay for lazy scene chunk loads.
 * Hidden by default; scene code decides when to show loading/error states.
 */
export class SceneLoadingOverlay extends Phaser.GameObjects.Container {
  private readonly loadingText: Phaser.GameObjects.Text;
  private readonly hintText: Phaser.GameObjects.Text;
  private dots = 0;
  private dotsEvent?: Phaser.Time.TimerEvent;

  constructor(scene: Phaser.Scene) {
    const width = scene.cameras.main.width;
    const height = scene.cameras.main.height;
    super(scene, width / 2, height / 2);
    scene.add.existing(this);
    this.setDepth(250).setScrollFactor(0).setVisible(false);

    this.loadingText = scene.add.text(0, -10, '', {
      fontFamily: 'monospace',
      fontSize: '26px',
      color: loadingColor,
      resolution: 2,
    }).setOrigin(0.5);

    this.hintText = scene.add.text(0, 26, '', {
      fontFamily: 'monospace',
      fontSize: '16px',
      color: theme.color.css.textWhite,
      resolution: 2,
    }).setOrigin(0.5);

    this.add([this.loadingText, this.hintText]);
  }

  showLoading(): void {
    this.setVisible(true);
    this.hintText.setVisible(false).setText('');
    this.dots = 0;
    this.refreshLoadingText();
    this.dotsEvent?.remove(false);
    this.dotsEvent = this.scene.time.addEvent({
      delay: 220,
      loop: true,
      callback: () => {
        this.dots = (this.dots + 1) % 4;
        this.refreshLoadingText();
      },
    });
  }

  showError(message: string, retryHint: string): void {
    this.dotsEvent?.remove(false);
    this.dotsEvent = undefined;
    this.setVisible(true);
    this.loadingText.setText(message);
    this.hintText.setText(retryHint).setVisible(true);
  }

  hide(): void {
    this.dotsEvent?.remove(false);
    this.dotsEvent = undefined;
    this.setVisible(false);
  }

  private refreshLoadingText(): void {
    this.loadingText.setText(`Loading${'.'.repeat(this.dots)}`);
  }
}
