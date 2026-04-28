/**
 * Lazy scene loader factories — one per non-boot scene.
 *
 * Each entry is a thunk that returns a dynamic `import()`. Vite splits each
 * dynamic import into its own JS chunk that is fetched on demand the first
 * time the player transitions to that scene.
 *
 * This module intentionally has **no static imports of any scene class** so it
 * can be consumed by both `sceneRegistry.ts` (which imports eager scene
 * classes) and `ElevatorScene` (which is itself an eager scene) without
 * creating a module cycle.
 */

import type * as Phaser from 'phaser';

type SceneClass = new (...args: never[]) => Phaser.Scene;

/** A factory that resolves to a scene constructor — used for lazy chunks. */
export type LazySceneLoader = () => Promise<SceneClass>;

const LOADERS: ReadonlyArray<{ key: string; loader: LazySceneLoader }> = [
  { key: 'PlatformTeamScene',              loader: () => import('../features/floors/platform/PlatformTeamScene').then((m) => m.PlatformTeamScene) },
  { key: 'ArchitectureTeamScene',          loader: () => import('../features/floors/architecture/ArchitectureTeamScene').then((m) => m.ArchitectureTeamScene) },
  { key: 'FinanceTeamScene',               loader: () => import('../features/floors/finance/FinanceTeamScene').then((m) => m.FinanceTeamScene) },
  { key: 'ProductLeadershipScene',         loader: () => import('../features/floors/product/ProductLeadershipScene').then((m) => m.ProductLeadershipScene) },
  { key: 'CustomerSuccessScene',           loader: () => import('../features/floors/customer/CustomerSuccessScene').then((m) => m.CustomerSuccessScene) },
  { key: 'ExecutiveSuiteScene',            loader: () => import('../features/floors/executive/ExecutiveSuiteScene').then((m) => m.ExecutiveSuiteScene) },
  { key: 'ProductIsyProjectControlsScene', loader: () => import('../features/products/rooms/ProductIsyProjectControlsScene').then((m) => m.ProductIsyProjectControlsScene) },
  { key: 'ProductIsyBeskrivelseScene',     loader: () => import('../features/products/rooms/ProductIsyBeskrivelseScene').then((m) => m.ProductIsyBeskrivelseScene) },
  { key: 'ProductIsyRoadScene',            loader: () => import('../features/products/rooms/ProductIsyRoadScene').then((m) => m.ProductIsyRoadScene) },
  { key: 'ProductAdminLisensScene',        loader: () => import('../features/products/rooms/ProductAdminLisensScene').then((m) => m.ProductAdminLisensScene) },
  { key: 'BossArenaScene',                 loader: () => import('../features/floors/boss/BossArenaScene').then((m) => m.BossArenaScene) },
];

/**
 * Map of scene key → loader for all lazy scenes.
 * Consumed by `ElevatorScene.lazyStartScene()` to dynamically register a
 * scene class with Phaser before transitioning to it for the first time.
 */
export const LAZY_SCENE_LOADERS: ReadonlyMap<string, LazySceneLoader> = new Map(
  LOADERS.map((r) => [r.key, r.loader]),
);
