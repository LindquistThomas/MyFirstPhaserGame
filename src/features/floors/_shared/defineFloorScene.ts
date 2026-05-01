/**
 * Factory that creates a `LevelScene` subclass from a declarative options
 * object. Eliminates the per-floor boilerplate of:
 *
 *   - `constructor()` calling `super(key, floorId)` and setting `returnSide`
 *   - `getBannerTitle()` / `getBannerDescription()` overrides
 *   - `createDecorations()` override
 *   - `getLevelConfig()` override
 *
 * ### Usage — simple scene (const, no extra methods)
 * ```ts
 * export const CustomerSuccessScene = defineFloorScene({
 *   key: 'CustomerSuccessScene',
 *   floorId: FLOORS.BUSINESS,
 *   returnSide: 'right',
 *   config: { floorId: FLOORS.BUSINESS, … },
 * });
 * ```
 *
 * ### Usage — complex scene (class extension, override extra hooks)
 * ```ts
 * export class PlatformTeamScene extends defineFloorScene({
 *   key: 'PlatformTeamScene',
 *   floorId: FLOORS.PLATFORM_TEAM,
 *   config: { … },
 * }) {
 *   override create(): void {
 *     super.create();
 *     // …scene-specific create code…
 *   }
 *   protected override createDecorations(): void { … }
 * }
 * ```
 */

import { LevelScene, LevelConfig } from './LevelScene';
import type { FloorId } from '../../../config/gameConfig';

export interface DefineFloorSceneOpts {
  /** Phaser scene key — must match the lazy-loader entry in `lazySceneLoaders.ts`. */
  key: string;
  /** Floor identifier passed to `LevelScene` and used to resolve `LEVEL_DATA`. */
  floorId: FloorId;
  /**
   * Level geometry and content. Provide either a static `LevelConfig` object
   * or a factory function receiving the live scene instance (useful when
   * values such as `playerStart` depend on state set during `init()`).
   *
   * Omit — or leave the class to override `getLevelConfig()` — when the config
   * depends on scene-private fields that cannot be expressed via this callback.
   */
  config?: LevelConfig | ((scene: LevelScene) => LevelConfig);
  /**
   * Floor-entry banner text. When omitted, the base class reads the title and
   * description from `LEVEL_DATA[floorId]` (the shared floor name / blurb).
   */
  banner?: { title: string; description: string };
  /**
   * Decoration callback invoked inside `createDecorations()`. Useful for
   * simple scenes whose decorations only call public `Phaser.Scene` APIs.
   *
   * For scenes that need protected helpers (`addAmbientPlants`, `addSignpost`,
   * etc.), subclass the returned class and override `createDecorations()` there
   * instead — those protected methods are fully accessible in a subclass body.
   */
  decorations?: (scene: LevelScene) => void;
  /**
   * Which side of the elevator shaft this room sits on; controls where the
   * player re-spawns in the elevator on return. Defaults to `'left'`.
   */
  returnSide?: 'left' | 'right';
}

/**
 * Returns a `LevelScene` subclass wired up from `opts`.
 *
 * The returned class can be used directly as a `const` export for simple
 * scenes, or as a base class for scenes that need additional overrides.
 */
export function defineFloorScene(opts: DefineFloorSceneOpts) {
  const { key, floorId, config, banner, decorations, returnSide } = opts;

  class DefinedFloorScene extends LevelScene {
    constructor() {
      super(key, floorId);
      if (returnSide !== undefined) {
        this.returnSide = returnSide;
      }
    }

    protected override getBannerTitle(): string {
      return banner !== undefined ? banner.title : super.getBannerTitle();
    }

    protected override getBannerDescription(): string {
      return banner !== undefined ? banner.description : super.getBannerDescription();
    }

    protected override createDecorations(): void {
      decorations?.(this);
    }

    protected override getLevelConfig(): LevelConfig {
      if (config === undefined) return super.getLevelConfig();
      return typeof config === 'function' ? config(this) : config;
    }
  }

  return DefinedFloorScene;
}
