import * as Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, COLORS, PLAYER_GRAVITY } from './config/gameConfig';
import { BootScene } from './scenes/core/BootScene';
import { MenuScene } from './scenes/core/MenuScene';
import { ElevatorScene } from './scenes/elevator/ElevatorScene';
import {
  PlatformTeamScene,
  ArchitectureTeamScene,
  FinanceTeamScene,
  ProductLeadershipScene,
  CustomerSuccessScene,
  ExecutiveSuiteScene,
} from './features/floors';
import { ProductIsyProjectControlsScene } from './features/products/rooms/ProductIsyProjectControlsScene';
import { ProductIsyBeskrivelseScene } from './features/products/rooms/ProductIsyBeskrivelseScene';
import { ProductIsyRoadScene } from './features/products/rooms/ProductIsyRoadScene';
import { ProductAdminLisensScene } from './features/products/rooms/ProductAdminLisensScene';
import { MusicPlugin } from './plugins/MusicPlugin';
import { DebugPlugin } from './plugins/DebugPlugin';
import { InputService } from './input';
import { QuizDialog } from './ui/QuizDialog';
import { canRetryQuiz } from './systems/QuizManager';
import { startPillarboxBackdrop } from './ui/pillarboxBackdrop';

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

// ±0.1% aspect drift tolerance prevents tiny floating-point/rounding jitter
// from enabling the backdrop path when viewport and game ratio are effectively
// the same.
const ASPECT_RATIO_TOLERANCE = 0.001;
// Chosen once at boot. `preserveDrawingBuffer` is a WebGL context creation
// flag and can't be toggled after the renderer is created.
const needsPillarboxBackdrop =
  Math.abs(window.innerWidth / Math.max(1, window.innerHeight) - GAME_WIDTH / GAME_HEIGHT) > ASPECT_RATIO_TOLERANCE;

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
  // Enabled only when viewport aspect differs from game aspect; this limits
  // WebGL preserveDrawingBuffer perf/memory overhead to sessions where the
  // pillarbox backdrop is actually used.
  // Required so the pillarbox backdrop (src/ui/pillarboxBackdrop.ts) can
  // `drawImage` the live WebGL canvas. Without this, reads from the GL
  // context yield blank frames.
  render: {
    preserveDrawingBuffer: needsPillarboxBackdrop,
  },
  scene: [BootScene, MenuScene, ElevatorScene, PlatformTeamScene, ArchitectureTeamScene, FinanceTeamScene, ProductLeadershipScene, CustomerSuccessScene, ExecutiveSuiteScene, ProductIsyProjectControlsScene, ProductIsyBeskrivelseScene, ProductIsyRoadScene, ProductAdminLisensScene],
  plugins: {
    scene: [{ key: 'InputService', plugin: InputService, mapping: 'inputs' },
            { key: 'MusicPlugin', plugin: MusicPlugin, mapping: 'music' },
            { key: 'DebugPlugin', plugin: DebugPlugin, mapping: 'debug' }],
  },
};

const game = new Phaser.Game(config);

// Expose the game instance on `window.__game` so E2E tests (Playwright)
// can drive scene transitions and capture screenshots. Kept enabled in
// production/preview builds too — the E2E suite targets the built bundle
// on CI for stable compile-free startup, and Phaser already exposes its
// full surface via `window` in any build, so this adds no meaningful
// attack surface. `__testHooks` exposes a tiny set of internals the E2E
// suite constructs directly (the QuizDialog class); it replaces a Vite
// dev-only `import('/src/ui/QuizDialog.ts')` that did not survive the
// production bundle.
//
// Set VITE_EXPOSE_TEST_HOOKS=false at build time to omit both globals from
// the bundle (e.g. for a security-hardened production build).
if (import.meta.env.VITE_EXPOSE_TEST_HOOKS !== 'false') {
  const gameWindow = window as unknown as {
    __game?: Phaser.Game;
    __testHooks?: {
      QuizDialog: typeof QuizDialog;
      canRetryQuiz: typeof canRetryQuiz;
    };
  };
  gameWindow.__game = game;
  gameWindow.__testHooks = { QuizDialog, canRetryQuiz };
}

// Kick the pillarbox backdrop once the first frame has rendered, so the
// initial draw copies actual scene pixels rather than a blank buffer. The
// `.ready` class fades it in (see #pillarbox-bg CSS in index.html).
if (needsPillarboxBackdrop) {
  game.events.once(Phaser.Core.Events.POST_RENDER, () => {
    startPillarboxBackdrop(game);
    document.getElementById('pillarbox-bg')?.classList.add('ready');
  });
}
