import { GAME_HEIGHT, FLOORS } from '../config/gameConfig';
import { LevelScene, LevelConfig } from './LevelScene';

export class Floor1Scene extends LevelScene {
  constructor() {
    super('Floor1Scene', FLOORS.PLATFORM_TEAM);
    this.levelWidth = 4096;
  }

  protected getLevelConfig(): LevelConfig {
    const ground = GAME_HEIGHT - 64;

    return {
      floorId: FLOORS.PLATFORM_TEAM,
      playerStart: { x: 150, y: ground - 140 },
      exitPosition: { x: 100, y: ground - 56 },
      platforms: [
        // Ground spans most of the level
        { x: 0, y: ground, width: 30 },

        // Lower stepping platforms
        { x: 512, y: ground - 180, width: 3 },
        { x: 900, y: ground - 260, width: 2 },
        { x: 1280, y: ground - 180, width: 4 },
        { x: 1800, y: ground - 300, width: 3 },

        // Mid platforms
        { x: 256, y: ground - 420, width: 3 },
        { x: 768, y: ground - 460, width: 3 },
        { x: 1400, y: ground - 500, width: 2 },
        { x: 1920, y: ground - 440, width: 3 },

        // Upper platforms
        { x: 2400, y: ground - 280, width: 4 },
        { x: 2900, y: ground - 380, width: 3 },
        { x: 3400, y: ground - 300, width: 3 },

        // High challenge platforms
        { x: 1024, y: ground - 620, width: 2 },
        { x: 2000, y: ground - 640, width: 2 },
        { x: 3000, y: ground - 560, width: 2 },
      ],
      tokens: [
        // Easy ground-adjacent
        { x: 600, y: ground - 220 },
        { x: 1400, y: ground - 220 },

        // Mid difficulty
        { x: 380, y: ground - 460 },
        { x: 860, y: ground - 500 },
        { x: 1980, y: ground - 480 },
        { x: 2520, y: ground - 320 },

        // Hard – high platforms
        { x: 1090, y: ground - 660 },
        { x: 2060, y: ground - 680 },
      ],
    };
  }
}
