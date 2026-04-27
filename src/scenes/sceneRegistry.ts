/**
 * Single source of truth for the Phaser scene list.
 *
 * Adding a new scene requires:
 *   1. Importing the class here.
 *   2. Adding one entry to `SCENE_REGISTRY` below.
 *   3. (Optional) Adding a SCENE_MUSIC entry in `src/config/audioConfig.ts`.
 *   4. (Floors only) Adding a LEVEL_DATA entry in `src/config/levelData.ts`.
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
import {
  PlatformTeamScene,
  ArchitectureTeamScene,
  FinanceTeamScene,
  ProductLeadershipScene,
  CustomerSuccessScene,
  ExecutiveSuiteScene,
} from '../features/floors';
import { ProductIsyProjectControlsScene } from '../features/products/rooms/ProductIsyProjectControlsScene';
import { ProductIsyBeskrivelseScene } from '../features/products/rooms/ProductIsyBeskrivelseScene';
import { ProductIsyRoadScene } from '../features/products/rooms/ProductIsyRoadScene';
import { ProductAdminLisensScene } from '../features/products/rooms/ProductAdminLisensScene';
import { BossArenaScene } from '../features/floors/boss/BossArenaScene';
import { LEVEL_DATA } from '../config/levelData';
import { SCENE_MUSIC } from '../config/audioConfig';

type SceneClass = new (...args: never[]) => Phaser.Scene;

export interface SceneRegistration {
  /** Phaser scene key — must match the `key` passed to `super(...)` in the class. */
  key: string;
  cls: SceneClass;
}

export const SCENE_REGISTRY: ReadonlyArray<SceneRegistration> = [
  { key: 'BootScene', cls: BootScene },
  { key: 'MenuScene', cls: MenuScene },
  { key: 'SettingsScene', cls: SettingsScene },
  { key: 'ControlsScene', cls: ControlsScene },
  { key: 'PauseScene', cls: PauseScene },
  { key: 'SaveSlotScene', cls: SaveSlotScene },
  { key: 'ElevatorScene', cls: ElevatorScene },
  { key: 'PlatformTeamScene', cls: PlatformTeamScene },
  { key: 'ArchitectureTeamScene', cls: ArchitectureTeamScene },
  { key: 'FinanceTeamScene', cls: FinanceTeamScene },
  { key: 'ProductLeadershipScene', cls: ProductLeadershipScene },
  { key: 'CustomerSuccessScene', cls: CustomerSuccessScene },
  { key: 'ExecutiveSuiteScene', cls: ExecutiveSuiteScene },
  { key: 'ProductIsyProjectControlsScene', cls: ProductIsyProjectControlsScene },
  { key: 'ProductIsyBeskrivelseScene', cls: ProductIsyBeskrivelseScene },
  { key: 'ProductIsyRoadScene', cls: ProductIsyRoadScene },
  { key: 'ProductAdminLisensScene', cls: ProductAdminLisensScene },
  { key: 'BossArenaScene', cls: BossArenaScene },
];

/**
 * Scene keys referenced by LEVEL_DATA / SCENE_MUSIC that don't have a
 * standalone Phaser.Scene class. They're handled inline by another scene
 * (e.g. `ProductsFloor` is rendered by `ElevatorScene` via the product
 * door manager — see levelData.ts comment).
 */
const VIRTUAL_SCENE_KEYS: ReadonlySet<string> = new Set(['ProductsFloor']);

/** Constructor list ready to feed into `Phaser.Game.config.scene`. */
export const SCENE_CLASSES: ReadonlyArray<SceneClass> = SCENE_REGISTRY.map((r) => r.cls);

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
