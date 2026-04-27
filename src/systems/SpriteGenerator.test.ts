import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateSprites } from './SpriteGenerator';

// Mock all sub-generators so tests run without a real Phaser context.
vi.mock('./sprites/player', () => ({ generatePlayerSprites: vi.fn() }));
vi.mock('./sprites/tiles', () => ({ generateTileSprites: vi.fn() }));
vi.mock('./sprites/token', () => ({ generateAUTokenSprites: vi.fn() }));
vi.mock('./sprites/elevator', () => ({ generateElevatorSprites: vi.fn() }));
vi.mock('./sprites/roomElevator', () => ({ generateRoomElevatorSprite: vi.fn() }));
vi.mock('./sprites/movingPlatform', () => ({ generateMovingPlatformSprite: vi.fn() }));
vi.mock('./sprites/doors', () => ({ generateDoorSprites: vi.fn() }));
vi.mock('./sprites/particles', () => ({ generateParticleSprite: vi.fn() }));
vi.mock('./sprites/plants', () => ({ generatePlantSprites: vi.fn() }));
vi.mock('./sprites/infoBoard', () => ({ generateInfoBoardSprite: vi.fn() }));
vi.mock('./sprites/lobbyProps', () => ({ generateLobbyPropSprites: vi.fn() }));
vi.mock('./sprites/infra', () => ({ generateInfraSprites: vi.fn() }));
vi.mock('./sprites/enemies', () => ({ generateEnemySprites: vi.fn() }));
vi.mock('./sprites/npcGeir', () => ({ generateGeirSprite: vi.fn() }));
vi.mock('./sprites/receptionist', () => ({ generateReceptionistSprite: vi.fn() }));
vi.mock('./sprites/coffee', () => ({ generateCoffeeSprites: vi.fn() }));
vi.mock('./sprites/energyDrinkFridge', () => ({ generateEnergyDrinkFridgeSprites: vi.fn() }));
vi.mock('./sprites/npcRubberDuck', () => ({ generateRubberDuckSprite: vi.fn() }));
vi.mock('./sprites/boss', () => ({ generateBossSprites: vi.fn() }));

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
import { generateEnergyDrinkFridgeSprites } from './sprites/energyDrinkFridge';
import { generateRubberDuckSprite } from './sprites/npcRubberDuck';
import { generateBossSprites } from './sprites/boss';

const allGenerators = [
  generatePlayerSprites,
  generateTileSprites,
  generateAUTokenSprites,
  generateElevatorSprites,
  generateRoomElevatorSprite,
  generateMovingPlatformSprite,
  generateDoorSprites,
  generateParticleSprite,
  generatePlantSprites,
  generateInfoBoardSprite,
  generateLobbyPropSprites,
  generateInfraSprites,
  generateEnemySprites,
  generateGeirSprite,
  generateReceptionistSprite,
  generateCoffeeSprites,
  generateEnergyDrinkFridgeSprites,
  generateRubberDuckSprite,
  generateBossSprites,
];

function makeScene(playerTextureExists: boolean) {
  return {
    textures: {
      exists: vi.fn().mockReturnValue(playerTextureExists),
    },
  };
}

describe('generateSprites', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls every sub-generator exactly once on the first invocation', () => {
    const scene = makeScene(false);
    generateSprites(scene as never);

    for (const gen of allGenerators) {
      expect(gen).toHaveBeenCalledTimes(1);
    }
  });

  it('skips all sub-generators when textures are already cached', () => {
    const scene = makeScene(true);
    generateSprites(scene as never);

    for (const gen of allGenerators) {
      expect(gen).not.toHaveBeenCalled();
    }
  });

  it('calls each sub-generator exactly once when generateSprites is called twice', () => {
    // First call: textures not cached → generate
    const scene = makeScene(false);
    generateSprites(scene as never);

    // Second call: textures now cached → skip
    scene.textures.exists.mockReturnValue(true);
    generateSprites(scene as never);

    for (const gen of allGenerators) {
      expect(gen).toHaveBeenCalledTimes(1);
    }
  });

  it('checks the "player" texture key for the cache guard', () => {
    const scene = makeScene(false);
    generateSprites(scene as never);

    expect(scene.textures.exists).toHaveBeenCalledWith('player');
  });
});
