import * as Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, COLORS, PLAYER_GRAVITY } from './config/gameConfig';
import { BootScene } from './scenes/BootScene';
import { MenuScene } from './scenes/MenuScene';
import { HubScene } from './scenes/HubScene';
import { Floor0Scene } from './scenes/Floor0Scene';
import { Floor1Scene } from './scenes/Floor1Scene';
import { Floor1ArchScene } from './scenes/Floor1ArchScene';
import { Floor2Scene } from './scenes/Floor2Scene';
import { Floor3Scene } from './scenes/Floor3Scene';
import { Floor3ProductScene } from './scenes/Floor3ProductScene';
import { Floor3ProductsScene } from './scenes/Floor3ProductsScene';
import { Floor4Scene } from './scenes/Floor4Scene';
import { ProductIsyProjectControlsScene } from './scenes/products/ProductIsyProjectControlsScene';
import { ProductIsyBeskrivelseScene } from './scenes/products/ProductIsyBeskrivelseScene';
import { ProductIsyRoadScene } from './scenes/products/ProductIsyRoadScene';
import { ProductAdminLisensScene } from './scenes/products/ProductAdminLisensScene';
import { MusicPlugin } from './plugins/MusicPlugin';
import { DebugPlugin } from './plugins/DebugPlugin';

// Render all Text objects at 2x internal resolution so glyphs stay crisp
// after the canvas is FIT-scaled to the viewport. Applies to both
// `scene.add.text(...)` and `scene.make.text(...)` unless a resolution is
// explicitly set by the caller.
const TEXT_RESOLUTION = 2;
const factoryProto = Phaser.GameObjects.GameObjectFactory.prototype as unknown as {
  text: (x: number, y: number, text: string | string[], style?: Phaser.Types.GameObjects.Text.TextStyle) => Phaser.GameObjects.Text;
};
const origAddText = factoryProto.text;
factoryProto.text = function (x, y, text, style) {
  const t = origAddText.call(this, x, y, text, style);
  if (!style || style.resolution === undefined) t.setResolution(TEXT_RESOLUTION);
  return t;
};
const creatorProto = Phaser.GameObjects.GameObjectCreator.prototype as unknown as {
  text: (config: Phaser.Types.GameObjects.Text.TextConfig, addToScene?: boolean) => Phaser.GameObjects.Text;
};
const origMakeText = creatorProto.text;
creatorProto.text = function (config, addToScene) {
  const t = origMakeText.call(this, config, addToScene);
  if (config?.style?.resolution === undefined) t.setResolution(TEXT_RESOLUTION);
  return t;
};

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
  scene: [BootScene, MenuScene, HubScene, Floor0Scene, Floor1Scene, Floor1ArchScene, Floor2Scene, Floor3ProductsScene, Floor3Scene, Floor3ProductScene, Floor4Scene, ProductIsyProjectControlsScene, ProductIsyBeskrivelseScene, ProductIsyRoadScene, ProductAdminLisensScene],
  plugins: {
    scene: [{ key: 'MusicPlugin', plugin: MusicPlugin, mapping: 'music' },
            { key: 'DebugPlugin', plugin: DebugPlugin, mapping: 'debug' }],
  },
};

const game = new Phaser.Game(config);

// In dev mode, expose the game instance on `window` so E2E tests
// (Playwright) can drive scene transitions and capture screenshots.
if (import.meta.env.DEV) {
  (window as unknown as { __game?: Phaser.Game }).__game = game;
}
