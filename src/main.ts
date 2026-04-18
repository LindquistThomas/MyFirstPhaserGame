import * as Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, COLORS, PLAYER_GRAVITY } from './config/gameConfig';
import { BootScene } from './scenes/BootScene';
import { MenuScene } from './scenes/MenuScene';
import { ElevatorScene } from './scenes/ElevatorScene';
import { LobbyScene } from './scenes/LobbyScene';
import { PlatformTeamScene } from './scenes/PlatformTeamScene';
import { ArchitectureTeamScene } from './scenes/ArchitectureTeamScene';
import { FinanceTeamScene } from './scenes/FinanceTeamScene';
import { ProductLeadershipScene } from './scenes/ProductLeadershipScene';
import { ProductsHallScene } from './scenes/ProductsHallScene';
import { ExecutiveSuiteScene } from './scenes/ExecutiveSuiteScene';
import { ProductIsyProjectControlsScene } from './scenes/products/ProductIsyProjectControlsScene';
import { ProductIsyBeskrivelseScene } from './scenes/products/ProductIsyBeskrivelseScene';
import { ProductIsyRoadScene } from './scenes/products/ProductIsyRoadScene';
import { ProductAdminLisensScene } from './scenes/products/ProductAdminLisensScene';
import { MusicPlugin } from './plugins/MusicPlugin';
import { DebugPlugin } from './plugins/DebugPlugin';
import { InputService } from './input';

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
  scene: [BootScene, MenuScene, ElevatorScene, LobbyScene, PlatformTeamScene, ArchitectureTeamScene, ProductsHallScene, FinanceTeamScene, ProductLeadershipScene, ExecutiveSuiteScene, ProductIsyProjectControlsScene, ProductIsyBeskrivelseScene, ProductIsyRoadScene, ProductAdminLisensScene],
  plugins: {
    scene: [{ key: 'InputService', plugin: InputService, mapping: 'inputs' },
            { key: 'MusicPlugin', plugin: MusicPlugin, mapping: 'music' },
            { key: 'DebugPlugin', plugin: DebugPlugin, mapping: 'debug' }],
  },
};

const game = new Phaser.Game(config);

// In dev mode, expose the game instance on `window` so E2E tests
// (Playwright) can drive scene transitions and capture screenshots.
if (import.meta.env.DEV) {
  (window as unknown as { __game?: Phaser.Game }).__game = game;
}
