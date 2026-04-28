/**
 * Single source of truth for the Phaser scene list.
 *
 * Scenes are split into two groups:
 *
 * **Eager** — bundled in the main app chunk, registered with Phaser at startup.
 *   These are scenes a player may encounter immediately (boot, menu, elevator).
 *   Adding a new eager scene requires:
 *     1. Importing the class here.
 *     2. Adding one entry to `EAGER_REGISTRY` below.
 *     3. (Optional) Adding a SCENE_MUSIC entry in `src/config/audioConfig.ts`.
 *
 * **Lazy** — each lives in its own JS chunk fetched on demand the first time
 *   the player transitions to that scene. The elevator fade (500 ms) acts as
 *   the loading screen.
 *   Adding a new lazy scene requires:
 *     1. Adding one entry to `LAZY_REGISTRY` below with a dynamic `import(…)`.
 *     2. (Optional) Adding a SCENE_MUSIC entry in `src/config/audioConfig.ts`.
 *     3. (Floors only) Adding a LEVEL_DATA entry in `src/config/levelData.ts`.
 *
 * `validateSceneRegistry()` runs at boot and fails loudly if LEVEL_DATA or
 * SCENE_MUSIC reference a scene key that was never registered.
 */

import * as Phaser from 'phaser';
import { BootScene } from './core/BootScene';
import { MenuScene } from './core/MenuScene';
import { SettingsScene } from './core/SettingsScene';
import { ControlsScene } from './core/ControlsScene';
import { PauseScene } from './core/PauseScene';
import { SaveSlotScene } from './core/SaveSlotScene';
import { ElevatorScene } from './elevator/ElevatorScene';
import { LEVEL_DATA } from '../config/levelData';
import { SCENE_MUSIC } from '../config/audioConfig';

type SceneClass = new (...args: never[]) => Phaser.Scene;

/** A factory that resolves to a scene constructor — used for lazy chunks. */
export type LazySceneLoader = () => Promise<SceneClass>;

/** An eagerly loaded scene — class is bundled in the main app chunk. */
export interface EagerSceneRegistration {
  /** Phaser scene key — must match the `key` passed to `super(...)` in the class. */
  key: string;
  cls: SceneClass;
}

/**
 * A lazily loaded scene — module is split into a separate Vite chunk and
 * fetched on demand the first time the player transitions to that scene.
 */
export interface LazySceneRegistration {
  /** Phaser scene key — must match the `key` passed to `super(...)` in the class. */
  key: string;
  loader: LazySceneLoader;
}

export type SceneRegistration = EagerSceneRegistration | LazySceneRegistration;

/**
 * Eager scenes — bundled in the main app chunk and registered with Phaser at
 * startup. These are the scenes a player may encounter immediately on load.
 */
const EAGER_REGISTRY: ReadonlyArray<EagerSceneRegistration> = [
  { key: 'BootScene', cls: BootScene },
  { key: 'MenuScene', cls: MenuScene },
  { key: 'SettingsScene', cls: SettingsScene },
  { key: 'ControlsScene', cls: ControlsScene },
  { key: 'PauseScene', cls: PauseScene },
  { key: 'SaveSlotScene', cls: SaveSlotScene },
  { key: 'ElevatorScene', cls: ElevatorScene },
];

/**
 * Lazy scenes — each is split into its own JS chunk by Vite and fetched the
 * first time the player transitions to it. The elevator transition fade
 * (500 ms) acts as the loading screen; both the fetch and the fade run
 * concurrently so there is no extra delay on fast connections.
 */
const LAZY_REGISTRY: ReadonlyArray<LazySceneRegistration> = [
  { key: 'PlatformTeamScene',             loader: () => import('../features/floors/platform/PlatformTeamScene').then((m) => m.PlatformTeamScene) },
  { key: 'ArchitectureTeamScene',         loader: () => import('../features/floors/architecture/ArchitectureTeamScene').then((m) => m.ArchitectureTeamScene) },
  { key: 'FinanceTeamScene',              loader: () => import('../features/floors/finance/FinanceTeamScene').then((m) => m.FinanceTeamScene) },
  { key: 'ProductLeadershipScene',        loader: () => import('../features/floors/product/ProductLeadershipScene').then((m) => m.ProductLeadershipScene) },
  { key: 'CustomerSuccessScene',          loader: () => import('../features/floors/customer/CustomerSuccessScene').then((m) => m.CustomerSuccessScene) },
  { key: 'ExecutiveSuiteScene',           loader: () => import('../features/floors/executive/ExecutiveSuiteScene').then((m) => m.ExecutiveSuiteScene) },
  { key: 'ProductIsyProjectControlsScene', loader: () => import('../features/products/rooms/ProductIsyProjectControlsScene').then((m) => m.ProductIsyProjectControlsScene) },
  { key: 'ProductIsyBeskrivelseScene',    loader: () => import('../features/products/rooms/ProductIsyBeskrivelseScene').then((m) => m.ProductIsyBeskrivelseScene) },
  { key: 'ProductIsyRoadScene',           loader: () => import('../features/products/rooms/ProductIsyRoadScene').then((m) => m.ProductIsyRoadScene) },
  { key: 'ProductAdminLisensScene',       loader: () => import('../features/products/rooms/ProductAdminLisensScene').then((m) => m.ProductAdminLisensScene) },
  { key: 'BossArenaScene',                loader: () => import('../features/floors/boss/BossArenaScene').then((m) => m.BossArenaScene) },
];

/** Combined registry (eager + lazy) — used for validation. */
export const SCENE_REGISTRY: ReadonlyArray<SceneRegistration> = [...EAGER_REGISTRY, ...LAZY_REGISTRY];

/**
 * Scene keys referenced by LEVEL_DATA / SCENE_MUSIC that don't have a
 * standalone Phaser.Scene class. They're handled inline by another scene
 * (e.g. `ProductsFloor` is rendered by `ElevatorScene` via the product
 * door manager — see levelData.ts comment).
 */
const VIRTUAL_SCENE_KEYS: ReadonlySet<string> = new Set(['ProductsFloor']);

/**
 * Constructor list for `Phaser.Game.config.scene` — **eager scenes only**.
 * Lazy scenes are registered on demand via `ElevatorScene.lazyStartScene()`.
 */
export const SCENE_CLASSES: ReadonlyArray<SceneClass> = EAGER_REGISTRY.map((r) => r.cls);

/**
 * Map of scene key → loader for all lazy scenes.
 * Used by `ElevatorScene` to dynamically register a scene class with Phaser
 * before transitioning to it for the first time.
 */
export const LAZY_SCENE_LOADERS: ReadonlyMap<string, LazySceneLoader> = new Map(
  LAZY_REGISTRY.map((r) => [r.key, r.loader]),
);

/**
 * Cross-check that every scene key referenced by LEVEL_DATA and SCENE_MUSIC
 * has a registered class (or is explicitly virtual). Returns the list of
 * violations; empty array means clean.
 *
 * Caller decides what to do with violations — `main.ts` throws in dev and
 * logs in production builds so the game still boots.
 */
export function validateSceneRegistry(): string[] {
  const errors: string[] = [];
  const registered = new Set(SCENE_REGISTRY.map((r) => r.key));
  const knownKey = (k: string): boolean => registered.has(k) || VIRTUAL_SCENE_KEYS.has(k);

  for (const floor of Object.values(LEVEL_DATA)) {
    if (!knownKey(floor.sceneKey)) {
      errors.push(
        `LEVEL_DATA["${floor.name}"] references sceneKey "${floor.sceneKey}", but no scene is registered with that key.`,
      );
    }
  }

  for (const sceneKey of Object.keys(SCENE_MUSIC)) {
    if (!knownKey(sceneKey)) {
      errors.push(
        `SCENE_MUSIC references scene "${sceneKey}", but no scene is registered with that key.`,
      );
    }
  }

  // Catch duplicate registrations early — Phaser would throw later.
  const seen = new Set<string>();
  for (const reg of SCENE_REGISTRY) {
    if (seen.has(reg.key)) {
      errors.push(`Duplicate registration for scene key "${reg.key}".`);
    }
    seen.add(reg.key);
  }

  return errors;
}
