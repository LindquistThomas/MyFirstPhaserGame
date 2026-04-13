import { GAME_HEIGHT, FLOORS } from '../config/gameConfig';
import { LevelScene, LevelConfig } from './LevelScene';

export class Floor2Scene extends LevelScene {
  constructor() {
    super('Floor2Scene', FLOORS.CLOUD_TEAM);
    this.levelWidth = 4800;
  }

  protected getLevelConfig(): LevelConfig {
    const ground = GAME_HEIGHT - 64;

    return {
      floorId: FLOORS.CLOUD_TEAM,
      playerStart: { x: 150, y: ground - 140 },
      exitPosition: { x: 100, y: ground - 56 },
      platforms: [
        // Ground with cloud-gaps
        { x: 0, y: ground, width: 6 },
        { x: 900, y: ground, width: 5 },
        { x: 1600, y: ground, width: 4 },
        { x: 2400, y: ground, width: 6 },
        { x: 3400, y: ground, width: 4 },
        { x: 4100, y: ground, width: 5 },

        // Floating cloud platforms – varied heights
        { x: 640, y: ground - 200, width: 2 },
        { x: 1050, y: ground - 340, width: 2 },
        { x: 450, y: ground - 480, width: 2 },
        { x: 1500, y: ground - 240, width: 3 },
        { x: 2000, y: ground - 400, width: 2 },
        { x: 2600, y: ground - 280, width: 3 },
        { x: 3100, y: ground - 440, width: 2 },
        { x: 3600, y: ground - 260, width: 3 },
        { x: 4000, y: ground - 400, width: 2 },
        { x: 4400, y: ground - 340, width: 2 },

        // Sky-high platforms
        { x: 800, y: ground - 580, width: 2 },
        { x: 1700, y: ground - 600, width: 2 },
        { x: 2800, y: ground - 620, width: 2 },
        { x: 3800, y: ground - 580, width: 2 },
      ],
      tokens: [
        // Ground gap rewards
        { x: 780, y: ground - 40 },
        { x: 1500, y: ground - 40 },

        // Mid-height
        { x: 710, y: ground - 240 },
        { x: 1580, y: ground - 280 },
        { x: 2080, y: ground - 440 },
        { x: 2720, y: ground - 320 },
        { x: 3700, y: ground - 300 },
        { x: 4460, y: ground - 380 },

        // Sky-high
        { x: 870, y: ground - 620 },
        { x: 2870, y: ground - 660 },
      ],
    };
  }
}
