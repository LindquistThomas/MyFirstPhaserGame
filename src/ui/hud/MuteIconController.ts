import type * as Phaser from 'phaser';
import { createSceneLifecycle, type SceneLifecycle } from '../../systems/sceneLifecycle';
import { eventBus } from '../../systems/EventBus';
import { GAME_WIDTH } from '../../config/gameConfig';
import { theme } from '../../style/theme';
import type { AudioManager } from '../../systems/AudioManager';

const MUTE_X = GAME_WIDTH - 24;
const MUTE_Y = 22;

/**
 * Owns the HUD mute-toggle icon: renders the musical-note graphic,
 * handles pointer interactions, and listens to `audio:mute-changed`
 * to keep the visual in sync with the audio manager's state.
 */
export class MuteIconController {
  private readonly scene: Phaser.Scene;
  private readonly icon: Phaser.GameObjects.Graphics;
  private hovered = false;
  private readonly lifecycle: SceneLifecycle;

  constructor(scene: Phaser.Scene, container: Phaser.GameObjects.Container) {
    this.scene = scene;
    this.icon = scene.add.graphics().setPosition(MUTE_X, MUTE_Y);
    container.add(this.icon as unknown as Phaser.GameObjects.GameObject);

    const hit = scene.add.zone(MUTE_X, MUTE_Y, 32, 32).setInteractive({ useHandCursor: true });
    hit.on('pointerup', () => eventBus.emit('audio:toggle-mute'));
    hit.on('pointerdown', () => this.punchIcon());
    hit.on('pointerover', () => {
      this.hovered = true;
      this.render(this.getAudioMuted());
    });
    hit.on('pointerout', () => {
      this.hovered = false;
      this.render(this.getAudioMuted());
    });
    container.add(hit as unknown as Phaser.GameObjects.GameObject);

    this.lifecycle = createSceneLifecycle(scene);
    this.lifecycle.bindEventBus('audio:mute-changed', (muted) => this.render(muted));

    this.render(this.getAudioMuted());
  }

  private getAudioMuted(): boolean {
    const audio = this.scene.registry.get('audio') as AudioManager | undefined;
    return audio?.isMuted() ?? false;
  }

  private punchIcon(): void {
    this.scene.tweens.add({
      targets: this.icon,
      scale: { from: 1, to: 0.85 },
      duration: 90,
      ease: 'Quad.easeOut',
      yoyo: true,
    });
  }

  private render(muted: boolean): void {
    const g = this.icon;
    g.clear();
    const color = muted ? 0x808080 : (this.hovered ? theme.color.ui.hover : theme.color.ui.accent);
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

  destroy(): void {
    this.lifecycle.dispose();
  }
}
