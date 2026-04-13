import { GAME_HEIGHT, FLOORS } from '../config/gameConfig';
import { LevelScene, LevelConfig } from './LevelScene';

export class Floor2Scene extends LevelScene {
  constructor() {
    super('Floor2Scene', FLOORS.CLOUD_TEAM);
    this.levelWidth = 2800;
  }

  protected getLevelConfig(): LevelConfig {
    const groundY = GAME_HEIGHT - 32;

    return {
      floorId: FLOORS.CLOUD_TEAM,
      playerStart: { x: 80, y: groundY - 40 },
      exitPosition: { x: 60, y: groundY - 28 },
      platforms: [
        // Ground - has gaps (clouds theme: floating platforms)
        { x: 0, y: groundY, width: 8 },
        { x: 320, y: groundY, width: 6 },
        { x: 640, y: groundY, width: 5 },
        { x: 960, y: groundY, width: 8 },
        { x: 1350, y: groundY, width: 4 },
        { x: 1600, y: groundY, width: 5 },
        { x: 1900, y: groundY, width: 6 },
        { x: 2300, y: groundY, width: 8 },

        // Floating cloud platforms - varied heights
        { x: 250, y: groundY - 120, width: 3 },
        { x: 450, y: groundY - 200, width: 3 },
        { x: 180, y: groundY - 300, width: 3 },
        { x: 680, y: groundY - 150, width: 4 },
        { x: 900, y: groundY - 250, width: 3 },
        { x: 1100, y: groundY - 180, width: 4 },
        { x: 1300, y: groundY - 320, width: 3 },
        { x: 1500, y: groundY - 250, width: 3 },
        { x: 1700, y: groundY - 160, width: 4 },
        { x: 1900, y: groundY - 280, width: 3 },
        { x: 2100, y: groundY - 200, width: 4 },
        { x: 2350, y: groundY - 320, width: 3 },
        { x: 2550, y: groundY - 250, width: 3 },

        // Sky-high platforms
        { x: 400, y: groundY - 400, width: 2 },
        { x: 800, y: groundY - 420, width: 2 },
        { x: 1200, y: groundY - 440, width: 2 },
        { x: 1600, y: groundY - 400, width: 2 },
        { x: 2000, y: groundY - 430, width: 2 },
        { x: 2400, y: groundY - 450, width: 2 },
      ],
      tokens: [
        // Ground-level tokens in gaps
        { x: 280, y: groundY - 30 },
        { x: 600, y: groundY - 30 },

        // Mid-height tokens on platforms
        { x: 310, y: groundY - 150 },
        { x: 740, y: groundY - 180 },
        { x: 1160, y: groundY - 210 },
        { x: 1560, y: groundY - 280 },
        { x: 1760, y: groundY - 190 },
        { x: 2160, y: groundY - 230 },

        // Sky-high tokens (hardest)
        { x: 432, y: groundY - 430 },
        { x: 1232, y: groundY - 470 },
      ],
    };
  }
}
