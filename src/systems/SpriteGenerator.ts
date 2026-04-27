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
import { generateMissionItemSprites } from './sprites/missionItems';

/**
 * Composition root for runtime sprite generation.
 *
 * Every graphic asset is built procedurally so the game ships with zero
 * image files. Individual generators live under `./sprites/`; this file
 * just wires them up for BootScene. Guarded by a cache check so
 * re-entering BootScene does not pay the generation cost again.
 */
export function generateSprites(scene: Phaser.Scene): void {
  if (scene.textures.exists('player')) return;
  generatePlayerSprites(scene);
  generateTileSprites(scene);
  generateAUTokenSprites(scene);
  generateElevatorSprites(scene);
  generateRoomElevatorSprite(scene);
  generateMovingPlatformSprite(scene);
  generateDoorSprites(scene);
  generateParticleSprite(scene);
  generatePlantSprites(scene);
  generateInfoBoardSprite(scene);
  generateLobbyPropSprites(scene);
  generateInfraSprites(scene);
  generateEnemySprites(scene);
  generateGeirSprite(scene);
  generateReceptionistSprite(scene);
  generateCoffeeSprites(scene);
  generateRubberDuckSprite(scene);
  generateEnergyDrinkFridgeSprites(scene);
  generateMissionItemSprites(scene);
}
