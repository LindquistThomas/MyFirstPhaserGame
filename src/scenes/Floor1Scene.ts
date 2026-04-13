import { GAME_HEIGHT, FLOORS } from '../config/gameConfig';
import { LevelScene, LevelConfig } from './LevelScene';

export class Floor1Scene extends LevelScene {
  constructor() {
    super('Floor1Scene', FLOORS.PLATFORM_TEAM);
    this.levelWidth = 2400;
  }

  protected getLevelConfig(): LevelConfig {
    const groundY = GAME_HEIGHT - 32;

    return {
      floorId: FLOORS.PLATFORM_TEAM,
      playerStart: { x: 80, y: groundY - 40 },
      exitPosition: { x: 60, y: groundY - 28 },
      platforms: [
        // Ground floor - full width
        { x: 0, y: groundY, width: 75 },

        // Lower platforms
        { x: 200, y: groundY - 100, width: 5 },
        { x: 400, y: groundY - 140, width: 4 },
        { x: 600, y: groundY - 100, width: 6 },
        { x: 850, y: groundY - 160, width: 4 },

        // Mid platforms
        { x: 100, y: groundY - 250, width: 4 },
        { x: 350, y: groundY - 280, width: 5 },
        { x: 600, y: groundY - 260, width: 3 },
        { x: 800, y: groundY - 300, width: 4 },

        // Upper platforms
        { x: 1050, y: groundY - 180, width: 6 },
        { x: 1300, y: groundY - 220, width: 4 },
        { x: 1500, y: groundY - 150, width: 5 },
        { x: 1750, y: groundY - 250, width: 4 },
        { x: 1950, y: groundY - 180, width: 5 },
        { x: 2150, y: groundY - 120, width: 3 },

        // High platforms with tokens
        { x: 500, y: groundY - 380, width: 3 },
        { x: 900, y: groundY - 400, width: 3 },
        { x: 1600, y: groundY - 350, width: 3 },
      ],
      tokens: [
        // Easy to reach tokens near ground
        { x: 260, y: groundY - 130 },
        { x: 660, y: groundY - 130 },

        // Mid-difficulty tokens
        { x: 400, y: groundY - 310 },
        { x: 850, y: groundY - 330 },
        { x: 1350, y: groundY - 250 },
        { x: 1550, y: groundY - 180 },

        // Hard to reach tokens on high platforms
        { x: 560, y: groundY - 410 },
        { x: 960, y: groundY - 430 },
      ],
    };
  }
}
