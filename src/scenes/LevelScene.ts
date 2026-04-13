import * as Phaser from 'phaser';
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
  protected auCollected = 0;
  protected levelWidth = 3200;
  protected levelHeight = GAME_HEIGHT;

  constructor(key: string, floorId: FloorId) {
    super({ key });
    this.floorId = floorId;
  }

  init(): void {
    this.progression = this.registry.get('progression') as ProgressionSystem;
    this.floorData = LEVEL_DATA[this.floorId];
    this.isTransitioning = false;
    this.auCollected = 0;
  }

  create(): void {
    this.cameras.main.setBackgroundColor(this.floorData.theme.backgroundColor);
    this.physics.world.setBounds(0, 0, this.levelWidth, this.levelHeight);

    this.createBackground();
    this.createPlatforms();
    this.createTokens();
    this.createExit();
    this.createPlayer();
    this.createUI();

    this.cameras.main.startFollow(this.player.sprite, true, 0.1, 0.1);
    this.cameras.main.setBounds(0, 0, this.levelWidth, this.levelHeight);

    this.physics.add.collider(this.player.sprite, this.platformGroup);
    this.physics.add.overlap(
      this.player.sprite,
      this.tokenGroup,
      this.onAUCollect as Phaser.Types.Physics.Arcade.ArcadePhysicsCallback,
      undefined,
      this,
    );

    this.showFloorBanner();
    this.cameras.main.fadeIn(500, 0, 0, 0);
  }

  protected createBackground(): void {
    for (let x = 0; x < this.levelWidth; x += TILE_SIZE) {
      for (let y = 0; y < this.levelHeight; y += TILE_SIZE) {
        this.add.image(x, y, 'bg_tile').setDepth(0).setAlpha(0.3);
      }
    }
  }

  protected createPlatforms(): void {
    this.platformGroup = this.physics.add.staticGroup();
    this.buildPlatforms(this.getLevelConfig());
  }

  protected buildPlatforms(config: LevelConfig): void {
    const tileKey = this.floorId === FLOORS.PLATFORM_TEAM ? 'platform_floor1' : 'platform_floor2';
    for (const plat of config.platforms) {
      for (let i = 0; i < plat.width; i++) {
        const t = this.platformGroup.create(
          plat.x + i * TILE_SIZE + TILE_SIZE / 2, plat.y, tileKey,
        ) as Phaser.Physics.Arcade.Image;
        t.setDepth(2).refreshBody();
      }
    }
  }

  protected createTokens(): void {
    this.tokenGroup = this.physics.add.group({ allowGravity: false });
    const config = this.getLevelConfig();
    const tokenKey = this.floorId === FLOORS.PLATFORM_TEAM ? 'token_floor1' : 'token_floor2';
    for (const pos of config.tokens) {
      this.tokenGroup.add(new Token(this, pos.x, pos.y, tokenKey));
    }
  }

  protected createExit(): void {
    const c = this.getLevelConfig();
    this.exitDoor = this.add.image(c.exitPosition.x, c.exitPosition.y, 'door_exit').setDepth(4);
    this.add.text(c.exitPosition.x, c.exitPosition.y - 70, '← ELEVATOR', {
      fontFamily: 'monospace', fontSize: '14px', color: '#aaddff',
    }).setOrigin(0.5).setDepth(5);
  }

  protected createPlayer(): void {
    const c = this.getLevelConfig();
    this.player = new Player(this, c.playerStart.x, c.playerStart.y);
    this.player.sprite.setCollideWorldBounds(true);

    this.interactPrompt = this.add.text(0, 0, '', {
      fontFamily: 'monospace', fontSize: '16px',
      color: '#ffdd44', backgroundColor: '#00000088',
      padding: { x: 8, y: 4 },
    }).setDepth(20).setVisible(false).setScrollFactor(0);
  }

  protected createUI(): void {
    this.hud = new HUD(this, this.progression);
  }

  protected showFloorBanner(): void {
    const banner = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 140, this.floorData.name, {
      fontFamily: 'monospace', fontSize: '48px', color: '#ffffff', fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(100).setScrollFactor(0);

    const sub = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 80, this.floorData.description, {
      fontFamily: 'monospace', fontSize: '18px', color: '#aabbcc',
    }).setOrigin(0.5).setDepth(100).setScrollFactor(0);

    this.tweens.add({
      targets: [banner, sub], alpha: 0, duration: 500, delay: 2000,
      onComplete: () => { banner.destroy(); sub.destroy(); },
    });
  }

  protected onAUCollect(
    _player: Phaser.Types.Physics.Arcade.GameObjectWithBody | Phaser.Tilemaps.Tile,
    tokenObj: Phaser.Types.Physics.Arcade.GameObjectWithBody | Phaser.Tilemaps.Tile,
  ): void {
    const token = tokenObj as Token;
    token.collect();
    this.progression.collectAU(this.floorId);
    this.auCollected++;
    this.cameras.main.flash(100, 255, 215, 0, false, undefined, this);
  }

  protected getLevelConfig(): LevelConfig {
    return {
      floorId: this.floorId,
      platforms: [],
      tokens: [],
      exitPosition: { x: 120, y: GAME_HEIGHT - 180 },
      playerStart: { x: 120, y: GAME_HEIGHT - 200 },
    };
  }

  update(_time: number, delta: number): void {
    if (this.isTransitioning) return;
    this.player.update(delta);
    this.hud.update();
    this.checkExitProximity();
  }

  private checkExitProximity(): void {
    const d = Phaser.Math.Distance.Between(
      this.player.sprite.x, this.player.sprite.y,
      this.exitDoor.x, this.exitDoor.y,
    );
    if (d < 90) {
      this.interactPrompt?.setText('Press E → Elevator').setPosition(GAME_WIDTH / 2 - 80, 70).setVisible(true);
      if (this.player.getInputManager().isInteractJustPressed()) this.returnToHub();
    } else {
      this.interactPrompt?.setVisible(false);
    }
  }

  protected returnToHub(): void {
    if (this.isTransitioning) return;
    this.isTransitioning = true;
    this.cameras.main.fadeOut(500, 0, 0, 0);
    this.time.delayedCall(500, () => this.scene.start('HubScene'));
  }
}
