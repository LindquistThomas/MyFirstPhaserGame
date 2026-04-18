import * as Phaser from 'phaser';
import { generatePlayerSprites } from './sprites/player';
import { generateTileSprites } from './sprites/tiles';
import { generateAUTokenSprites } from './sprites/token';
import { generateElevatorSprites } from './sprites/elevator';
import { generateRoomElevatorSprite } from './sprites/roomElevator';
import { generateDoorSprites } from './sprites/doors';
import { generateParticleSprite } from './sprites/particles';
import { generatePlantSprites } from './sprites/plants';
import { generateInfoBoardSprite } from './sprites/infoBoard';
import { generateInfraSprites } from './sprites/infra';
import { generateEnemySprites } from './sprites/enemies';

/**
 * Composition root for runtime sprite generation.
 *
 * Every graphic asset is built procedurally so the game ships with zero
 * image files. Individual generators live under `./sprites/`; this file
 * just wires them up for BootScene.
 */
export function generateSprites(scene: Phaser.Scene): void {
  generatePlayerSprites(scene);
  generateTileSprites(scene);
  generateAUTokenSprites(scene);
  generateElevatorSprites(scene);
  generateRoomElevatorSprite(scene);
  generateDoorSprites(scene);
  generateParticleSprite(scene);
  generatePlantSprites(scene);
  generateInfoBoardSprite(scene);
  generateInfraSprites(scene);
  generateEnemySprites(scene);
}
