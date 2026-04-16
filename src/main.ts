import * as Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, COLORS, PLAYER_GRAVITY } from './config/gameConfig';
import { BootScene } from './scenes/BootScene';
import { MenuScene } from './scenes/MenuScene';
import { HubScene } from './scenes/HubScene';
import { Floor0Scene } from './scenes/Floor0Scene';
import { Floor1Scene } from './scenes/Floor1Scene';
import { Floor2Scene } from './scenes/Floor2Scene';
import { MusicPlugin } from './plugins/MusicPlugin';

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'game-container',
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  pixelArt: true,
  roundPixels: true,
  backgroundColor: COLORS.background,
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { x: 0, y: PLAYER_GRAVITY },
      debug: false,
    },
  },
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  scene: [BootScene, MenuScene, HubScene, Floor0Scene, Floor1Scene, Floor2Scene],
  plugins: {
    scene: [{ key: 'MusicPlugin', plugin: MusicPlugin, mapping: 'music' }],
  },
};

const game = new Phaser.Game(config);

// In dev mode, expose the game instance on `window` so E2E tests
// (Playwright) can drive scene transitions and capture screenshots.
if (import.meta.env.DEV) {
  (window as unknown as { __game?: Phaser.Game }).__game = game;
}
