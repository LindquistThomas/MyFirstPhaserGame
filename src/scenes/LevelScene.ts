import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, TILE_SIZE, FLOORS, FloorId } from '../config/gameConfig';
import { LEVEL_DATA, FloorData } from '../config/levelData';
import { Player } from '../entities/Player';
import { Token } from '../entities/Token';
import { HUD } from '../ui/HUD';
import { ProgressionSystem } from '../systems/ProgressionSystem';

export interface LevelConfig {
  floorId: FloorId;
  platforms: Array<{ x: number; y: number; width: number }>;
  tokens: Array<{ x: number; y: number }>;
  exitPosition: { x: number; y: number };
  playerStart: { x: number; y: number };
}

export class LevelScene extends Phaser.Scene {
  protected player!: Player;
  protected hud!: HUD;
  protected progression!: ProgressionSystem;
  protected platformGroup!: Phaser.Physics.Arcade.StaticGroup;
  protected tokenGroup!: Phaser.Physics.Arcade.Group;
  protected exitDoor!: Phaser.GameObjects.Image;
  protected floorData!: FloorData;
  protected floorId!: FloorId;
  protected isTransitioning = false;
  protected interactPrompt?: Phaser.GameObjects.Text;
  protected tokensCollected = 0;
  protected levelWidth = 2048;
  protected levelHeight = GAME_HEIGHT;

  constructor(key: string, floorId: FloorId) {
    super({ key });
    this.floorId = floorId;
  }

  init(): void {
    this.progression = this.registry.get('progression') as ProgressionSystem;
    this.floorData = LEVEL_DATA[this.floorId];
    this.isTransitioning = false;
    this.tokensCollected = 0;
  }

  create(): void {
    this.cameras.main.setBackgroundColor(this.floorData.theme.backgroundColor);

    // World bounds
    this.physics.world.setBounds(0, 0, this.levelWidth, this.levelHeight);

    // Create level elements
    this.createBackground();
    this.createPlatforms();
    this.createTokens();
    this.createExit();
    this.createPlayer();
    this.createUI();

    // Camera
    this.cameras.main.startFollow(this.player.sprite, true, 0.1, 0.1);
    this.cameras.main.setBounds(0, 0, this.levelWidth, this.levelHeight);

    // Collisions
    this.physics.add.collider(this.player.sprite, this.platformGroup);
    this.physics.add.overlap(this.player.sprite, this.tokenGroup, this.onTokenCollect, undefined, this);

    // Floor name banner
    this.showFloorBanner();

    // Fade in
    this.cameras.main.fadeIn(500, 0, 0, 0);
  }

  protected createBackground(): void {
    // Tiled background
    for (let x = 0; x < this.levelWidth; x += TILE_SIZE) {
      for (let y = 0; y < this.levelHeight; y += TILE_SIZE) {
        this.add.image(x, y, 'bg_tile').setDepth(0).setAlpha(0.3);
      }
    }
  }

  protected createPlatforms(): void {
    this.platformGroup = this.physics.add.staticGroup();

    // Override in subclasses for specific layouts
    this.buildPlatforms(this.getLevelConfig());
  }

  protected buildPlatforms(config: LevelConfig): void {
    for (const plat of config.platforms) {
      for (let i = 0; i < plat.width; i++) {
        const tileKey = this.floorId === FLOORS.PLATFORM_TEAM ? 'platform_floor1' : 'platform_floor2';
        const tile = this.platformGroup.create(
          plat.x + i * TILE_SIZE + TILE_SIZE / 2,
          plat.y,
          tileKey
        ) as Phaser.Physics.Arcade.Image;
        tile.setDepth(2);
        tile.refreshBody();
      }
    }
  }

  protected createTokens(): void {
    this.tokenGroup = this.physics.add.group({ allowGravity: false });
    const config = this.getLevelConfig();
    const tokenKey = this.floorId === FLOORS.PLATFORM_TEAM ? 'token_floor1' : 'token_floor2';

    for (const pos of config.tokens) {
      const token = new Token(this, pos.x, pos.y, tokenKey);
      this.tokenGroup.add(token);
    }
  }

  protected createExit(): void {
    const config = this.getLevelConfig();
    this.exitDoor = this.add.image(config.exitPosition.x, config.exitPosition.y, 'door_exit');
    this.exitDoor.setDepth(4);

    // Exit label
    this.add.text(config.exitPosition.x, config.exitPosition.y - 40, '← ELEVATOR', {
      fontFamily: 'monospace',
      fontSize: '10px',
      color: '#aaddff',
    }).setOrigin(0.5).setDepth(5);
  }

  protected createPlayer(): void {
    const config = this.getLevelConfig();
    this.player = new Player(this, config.playerStart.x, config.playerStart.y);
    this.player.sprite.setCollideWorldBounds(true);

    this.interactPrompt = this.add.text(0, 0, '', {
      fontFamily: 'monospace',
      fontSize: '12px',
      color: '#ffdd44',
      backgroundColor: '#00000088',
      padding: { x: 6, y: 3 },
    }).setDepth(20).setVisible(false).setScrollFactor(0);
  }

  protected createUI(): void {
    this.hud = new HUD(this, this.progression);
  }

  protected showFloorBanner(): void {
    const banner = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 100, this.floorData.name, {
      fontFamily: 'monospace',
      fontSize: '36px',
      color: '#ffffff',
      fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(100).setScrollFactor(0);

    const subtitle = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 60, this.floorData.description, {
      fontFamily: 'monospace',
      fontSize: '14px',
      color: '#aabbcc',
    }).setOrigin(0.5).setDepth(100).setScrollFactor(0);

    this.tweens.add({
      targets: [banner, subtitle],
      alpha: 0,
      duration: 500,
      delay: 2000,
      onComplete: () => {
        banner.destroy();
        subtitle.destroy();
      },
    });
  }

  protected onTokenCollect(
    _player: Phaser.Types.Physics.Arcade.GameObjectWithBody | Phaser.Tilemaps.Tile,
    tokenObj: Phaser.Types.Physics.Arcade.GameObjectWithBody | Phaser.Tilemaps.Tile
  ): void {
    const token = tokenObj as Token;
    token.collect();
    this.progression.collectToken(this.floorId);
    this.tokensCollected++;

    // Flash effect on HUD
    this.cameras.main.flash(100, 255, 215, 0, false, undefined, this);
  }

  protected getLevelConfig(): LevelConfig {
    // Override in subclasses
    return {
      floorId: this.floorId,
      platforms: [],
      tokens: [],
      exitPosition: { x: 100, y: GAME_HEIGHT - 80 },
      playerStart: { x: 100, y: GAME_HEIGHT - 100 },
    };
  }

  update(_time: number, delta: number): void {
    if (this.isTransitioning) return;

    this.player.update(delta);
    this.hud.update();
    this.checkExitProximity();
    this.handleExitInteraction();
  }

  private checkExitProximity(): void {
    const dist = Phaser.Math.Distance.Between(
      this.player.sprite.x, this.player.sprite.y,
      this.exitDoor.x, this.exitDoor.y
    );
    if (dist < 50) {
      if (this.interactPrompt) {
        this.interactPrompt.setText('Press E to return to Elevator');
        this.interactPrompt.setPosition(GAME_WIDTH / 2 - 100, 60);
        this.interactPrompt.setVisible(true);
      }
    } else {
      this.interactPrompt?.setVisible(false);
    }
  }

  private handleExitInteraction(): void {
    const inputManager = this.player.getInputManager();
    if (inputManager.isInteractJustPressed()) {
      const dist = Phaser.Math.Distance.Between(
        this.player.sprite.x, this.player.sprite.y,
        this.exitDoor.x, this.exitDoor.y
      );
      if (dist < 50) {
        this.returnToHub();
      }
    }
  }

  protected returnToHub(): void {
    if (this.isTransitioning) return;
    this.isTransitioning = true;

    this.cameras.main.fadeOut(500, 0, 0, 0);
    this.time.delayedCall(500, () => {
      this.scene.start('HubScene');
    });
  }
}
