import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateSprites, SPRITE_PHASES } from './SpriteGenerator';

// Mock all sub-generators so tests run without a real Phaser context.
vi.mock('./sprites/player', () => ({
  generatePlayerSprites: vi.fn(),
  drawPlayerWalkFrames: vi.fn(),
  drawPlayerFlipFrames: vi.fn(),
}));
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
vi.mock('./sprites/enemies', () => ({
  generateEnemySprites: vi.fn(),
  generateEnemySpritesA: vi.fn(),
  generateEnemySpritesB: vi.fn(),
}));
vi.mock('./sprites/npcGeir', () => ({ generateGeirSprite: vi.fn() }));
vi.mock('./sprites/receptionist', () => ({ generateReceptionistSprite: vi.fn() }));
vi.mock('./sprites/coffee', () => ({ generateCoffeeSprites: vi.fn() }));
vi.mock('./sprites/energyDrinkFridge', () => ({ generateEnergyDrinkFridgeSprites: vi.fn() }));
vi.mock('./sprites/npcRubberDuck', () => ({ generateRubberDuckSprite: vi.fn() }));
vi.mock('./sprites/boss', () => ({
  generateBossSprites: vi.fn(),
  generateBossSpritesA: vi.fn(),
  generateBossSpritesB: vi.fn(),
  generateBossSpritesC: vi.fn(),
}));
vi.mock('./sprites/missionItems', () => ({ generateMissionItemSprites: vi.fn() }));

import { drawPlayerWalkFrames, drawPlayerFlipFrames } from './sprites/player';
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
import { generateEnemySpritesA, generateEnemySpritesB } from './sprites/enemies';
import { generateGeirSprite } from './sprites/npcGeir';
import { generateReceptionistSprite } from './sprites/receptionist';
import { generateCoffeeSprites } from './sprites/coffee';
import { generateEnergyDrinkFridgeSprites } from './sprites/energyDrinkFridge';
import { generateRubberDuckSprite } from './sprites/npcRubberDuck';
import { generateBossSpritesA, generateBossSpritesB, generateBossSpritesC } from './sprites/boss';
import { generateMissionItemSprites } from './sprites/missionItems';

/**
 * All generators that SPRITE_PHASES (and therefore generateSprites) invoke.
 * The player uses sub-functions (drawPlayerWalkFrames / drawPlayerFlipFrames)
 * rather than the full generatePlayerSprites, so we check those here.
 * Enemies and boss are split into A/B and A/B/C batches respectively.
 */
const allGenerators = [
  drawPlayerWalkFrames,
  drawPlayerFlipFrames,
  generateTileSprites,
  generateMovingPlatformSprite,
  generateAUTokenSprites,
  generateElevatorSprites,
  generateRoomElevatorSprite,
  generateDoorSprites,
  generateInfoBoardSprite,
  generateLobbyPropSprites,
  generateParticleSprite,
  generatePlantSprites,
  generateInfraSprites,
  generateEnemySpritesA,
  generateEnemySpritesB,
  generateBossSpritesA,
  generateBossSpritesB,
  generateBossSpritesC,
  generateGeirSprite,
  generateReceptionistSprite,
  generateRubberDuckSprite,
  generateCoffeeSprites,
  generateEnergyDrinkFridgeSprites,
  generateMissionItemSprites,
];

function makeScene(playerTextureExists: boolean) {
  return {
    textures: {
      exists: vi.fn().mockReturnValue(playerTextureExists),
      addSpriteSheet: vi.fn(),
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

describe('SPRITE_PHASES', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('is a non-empty array', () => {
    expect(SPRITE_PHASES.length).toBeGreaterThan(0);
  });

  it('every phase has a non-empty string label', () => {
    for (const phase of SPRITE_PHASES) {
      expect(typeof phase.label).toBe('string');
      expect(phase.label.length).toBeGreaterThan(0);
    }
  });

  it('every phase has a run function', () => {
    for (const phase of SPRITE_PHASES) {
      expect(typeof phase.run).toBe('function');
    }
  });

  it('running all phases invokes every sub-generator', () => {
    const scene = makeScene(false);
    for (const phase of SPRITE_PHASES) {
      phase.run(scene as never);
    }
    for (const gen of allGenerators) {
      expect(gen).toHaveBeenCalledTimes(1);
    }
  });

  it('phase labels are unique', () => {
    const labels = SPRITE_PHASES.map((p) => p.label);
    expect(new Set(labels).size).toBe(labels.length);
  });

  it('player phases share a closure: walk phase creates canvas, flip phase registers texture', () => {
    const scene = makeScene(false);
    // Run player walk phase — should call drawPlayerWalkFrames
    SPRITE_PHASES[0]!.run(scene as never);
    expect(drawPlayerWalkFrames).toHaveBeenCalledTimes(1);
    expect(drawPlayerFlipFrames).not.toHaveBeenCalled();

    // Run player flip phase — should call drawPlayerFlipFrames + addSpriteSheet
    SPRITE_PHASES[1]!.run(scene as never);
    expect(drawPlayerFlipFrames).toHaveBeenCalledTimes(1);
    expect(scene.textures.addSpriteSheet).toHaveBeenCalledWith(
      'player',
      expect.anything(),
      { frameWidth: 64, frameHeight: 160 },
    );
  });

  it('has separate phases for enemy batches A and B', () => {
    const scene = makeScene(false);
    const enemyPhaseA = SPRITE_PHASES.find((p) => p.label === 'Drawing enemies (1/2)');
    const enemyPhaseB = SPRITE_PHASES.find((p) => p.label === 'Drawing enemies (2/2)');
    expect(enemyPhaseA).toBeDefined();
    expect(enemyPhaseB).toBeDefined();

    enemyPhaseA!.run(scene as never);
    expect(generateEnemySpritesA).toHaveBeenCalledTimes(1);
    expect(generateEnemySpritesB).not.toHaveBeenCalled();

    enemyPhaseB!.run(scene as never);
    expect(generateEnemySpritesB).toHaveBeenCalledTimes(1);
  });

  it('has separate phases for boss batches A, B, and C', () => {
    const scene = makeScene(false);
    const bossA = SPRITE_PHASES.find((p) => p.label === 'Drawing boss (1/3)');
    const bossB = SPRITE_PHASES.find((p) => p.label === 'Drawing boss (2/3)');
    const bossC = SPRITE_PHASES.find((p) => p.label === 'Drawing boss (3/3)');
    expect(bossA).toBeDefined();
    expect(bossB).toBeDefined();
    expect(bossC).toBeDefined();

    bossA!.run(scene as never);
    expect(generateBossSpritesA).toHaveBeenCalledTimes(1);

    bossB!.run(scene as never);
    expect(generateBossSpritesB).toHaveBeenCalledTimes(1);

    bossC!.run(scene as never);
    expect(generateBossSpritesC).toHaveBeenCalledTimes(1);
  });
});
