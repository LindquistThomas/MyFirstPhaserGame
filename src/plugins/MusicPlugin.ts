import * as Phaser from 'phaser';
import { SCENE_MUSIC } from '../config/audioConfig';
import { eventBus } from '../systems/EventBus';

/**
 * Phaser ScenePlugin — bridges the framework's scene lifecycle to the
 * standalone EventBus.
 *
 * Auto-attached to every scene via the game config. On each scene's
 * `create` event it looks up SCENE_MUSIC and emits `music:play` on the
 * EventBus. Scenes themselves never touch audio code.
 */
export class MusicPlugin extends Phaser.Plugins.ScenePlugin {
  boot(): void {
    this.systems!.events.on('create', this.onSceneCreate, this);
  }

  private onSceneCreate(): void {
    const musicKey = SCENE_MUSIC[this.scene!.scene.key];
    if (musicKey) {
      eventBus.emit('music:play', musicKey);
    }
  }
}
