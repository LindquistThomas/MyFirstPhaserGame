import * as Phaser from 'phaser';
import { drawPlayerWalkFrames, drawPlayerFlipFrames, generatePlayerSprites } from './sprites/player';
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
import { generateEnemySpritesA, generateEnemySpritesB, generateEnemySprites } from './sprites/enemies';
import { generateGeirSprite } from './sprites/npcGeir';
import { generateReceptionistSprite } from './sprites/receptionist';
import { generateCoffeeSprites } from './sprites/coffee';
import { generateRubberDuckSprite } from './sprites/npcRubberDuck';
import { generateEnergyDrinkFridgeSprites } from './sprites/energyDrinkFridge';
import { generateBossSpritesA, generateBossSpritesB, generateBossSpritesC, generateBossSprites } from './sprites/boss';
import { generateMissionItemSprites } from './sprites/missionItems';

/** A single named unit of procedural generation work. */
export interface GeneratorPhase {
  /** Human-readable label shown in the boot loading text. */
  label: string;
  /** Execute this phase's generation against the given scene. */
  run: (scene: Phaser.Scene) => void;
}

/**
 * Build the two player GeneratorPhases, sharing a canvas via closure.
 *
 * Phase 1 creates the canvas and draws idle/walk frames (0–5).
 * Phase 2 draws flip frames (6–13) then registers the sprite sheet.
 * Splitting across two frame ticks keeps each phase well under the
 * 20 ms per-tick budget on throttled hardware.
 */
function buildPlayerPhases(): [GeneratorPhase, GeneratorPhase] {
  const W = 64;
  const H = 160;
  const FRAMES = 14;
  let canvas: HTMLCanvasElement | null = null;
  let ctx: CanvasRenderingContext2D | null = null;

  return [
    {
      label: 'Drawing player (walk)',
      run: (_scene: Phaser.Scene) => {
        canvas = document.createElement('canvas');
        canvas.width = W * FRAMES;
        canvas.height = H;
        ctx = canvas.getContext('2d');
        drawPlayerWalkFrames(canvas, ctx!);
      },
    },
    {
      label: 'Drawing player (flip)',
      run: (scene: Phaser.Scene) => {
        drawPlayerFlipFrames(canvas!, ctx!);
        scene.textures.addSpriteSheet(
          'player',
          canvas as unknown as HTMLImageElement,
          { frameWidth: W, frameHeight: H },
        );
        canvas = null;
        ctx = null;
      },
    },
  ];
}

const [_playerPhase1, _playerPhase2] = buildPlayerPhases();

/**
 * Ordered sprite generation phases exposed for frame-yielding pipelines.
 *
 * `BootScene` iterates this array via `time.addEvent` so each phase runs
 * on its own frame tick and the progress bar updates smoothly. The cache
 * guard (`textures.exists('player')`) is checked by the caller before
 * starting the pipeline.
 *
 * Heavy generators (player, enemies, boss) are split across multiple
 * phases so no single phase exceeds the ~20 ms per-tick budget.
 */
export const SPRITE_PHASES: readonly GeneratorPhase[] = [
  _playerPhase1,
  _playerPhase2,
  { label: 'Drawing tiles & platforms', run: (s) => { generateTileSprites(s); generateMovingPlatformSprite(s); } },
  { label: 'Drawing tokens', run: generateAUTokenSprites },
  { label: 'Drawing elevator', run: (s) => { generateElevatorSprites(s); generateRoomElevatorSprite(s); } },
  { label: 'Drawing doors & props', run: (s) => { generateDoorSprites(s); generateInfoBoardSprite(s); generateLobbyPropSprites(s); } },
  { label: 'Drawing environment', run: (s) => { generateParticleSprite(s); generatePlantSprites(s); generateInfraSprites(s); } },
  { label: 'Drawing enemies (1/2)', run: generateEnemySpritesA },
  { label: 'Drawing enemies (2/2)', run: generateEnemySpritesB },
  { label: 'Drawing boss (1/3)', run: generateBossSpritesA },
  { label: 'Drawing boss (2/3)', run: generateBossSpritesB },
  { label: 'Drawing boss (3/3)', run: generateBossSpritesC },
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

// Re-export aggregates so callers that import them directly still work.
export { generatePlayerSprites, generateEnemySprites, generateBossSprites };
