import * as Phaser from 'phaser';
import { generatePlayerSprites } from './sprites/player';
import { generateTileSprites } from './sprites/tiles';
import { generateAUTokenSprites } from './sprites/token';
import { generateElevatorSprites } from './sprites/elevator';
import { generateRoomElevatorSprite } from './sprites/roomElevator';
import { generateMovingPlatformSprite } from './sprites/movingPlatform';
import { generateDoorSprites } from './sprites/doors';
import { generateParticleSprite } from './sprites/particles';
import { generatePlantSprites } from './sprites/plants';
import { generateInfoBoardSprite } from './sprites/infoBoard';
import { generateLobbyPropSprites } from './sprites/lobbyProps';
import { generateInfraSprites } from './sprites/infra';
import { generateEnemySprites } from './sprites/enemies';
import { generateGeirSprite } from './sprites/npcGeir';
import { generateReceptionistSprite } from './sprites/receptionist';
import { generateCoffeeSprites } from './sprites/coffee';
import { generateRubberDuckSprite } from './sprites/npcRubberDuck';
import { generateEnergyDrinkFridgeSprites } from './sprites/energyDrinkFridge';
import { generateBossSprites } from './sprites/boss';
import { generateMissionItemSprites } from './sprites/missionItems';

/** A single named unit of procedural generation work. */
export interface GeneratorPhase {
  /** Human-readable label shown in the boot loading text. */
  label: string;
  /** Execute this phase's generation against the given scene. */
  run: (scene: Phaser.Scene) => void;
}

/**
 * Ordered sprite generation phases exposed for frame-yielding pipelines.
 *
 * `BootScene` iterates this array via `time.addEvent` so each phase runs
 * on its own frame tick and the progress bar updates smoothly. The cache
 * guard (`textures.exists('player')`) is checked by the caller before
 * starting the pipeline.
 */
export const SPRITE_PHASES: readonly GeneratorPhase[] = [
  { label: 'Drawing player', run: generatePlayerSprites },
  { label: 'Drawing tiles & platforms', run: (s) => { generateTileSprites(s); generateMovingPlatformSprite(s); } },
  { label: 'Drawing tokens', run: generateAUTokenSprites },
  { label: 'Drawing elevator', run: (s) => { generateElevatorSprites(s); generateRoomElevatorSprite(s); } },
  { label: 'Drawing doors & props', run: (s) => { generateDoorSprites(s); generateInfoBoardSprite(s); generateLobbyPropSprites(s); } },
  { label: 'Drawing environment', run: (s) => { generateParticleSprite(s); generatePlantSprites(s); generateInfraSprites(s); } },
  { label: 'Drawing enemies', run: (s) => { generateEnemySprites(s); generateBossSprites(s); } },
  { label: 'Drawing characters', run: (s) => { generateGeirSprite(s); generateReceptionistSprite(s); generateRubberDuckSprite(s); } },
  { label: 'Drawing items', run: (s) => { generateCoffeeSprites(s); generateEnergyDrinkFridgeSprites(s); generateMissionItemSprites(s); } },
];

/**
 * Composition root for runtime sprite generation.
 *
 * Every graphic asset is built procedurally so the game ships with zero
 * image files. Individual generators live under `./sprites/`; this file
 * just wires them up for BootScene. Guarded by a cache check so
 * re-entering BootScene does not pay the generation cost again.
 *
 * For smooth boot-screen progress, prefer driving `SPRITE_PHASES` directly
 * via a frame-yielding pipeline (see `BootScene`).
 */
export function generateSprites(scene: Phaser.Scene): void {
  if (scene.textures.exists('player')) return;
  for (const phase of SPRITE_PHASES) {
    phase.run(scene);
  }
}
