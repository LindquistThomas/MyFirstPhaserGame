import * as Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, FLOORS, TILE_SIZE, COLORS, FloorId } from '../config/gameConfig';
import { LEVEL_DATA } from '../config/levelData';
import { Player } from '../entities/Player';
import { Elevator } from '../entities/Elevator';
import { HUD } from '../ui/HUD';
import { ElevatorPanel } from '../ui/ElevatorPanel';
import { ProgressionSystem } from '../systems/ProgressionSystem';

export class HubScene extends Phaser.Scene {
  private player!: Player;
  private elevator!: Elevator;
  private hud!: HUD;
  private elevatorPanel?: ElevatorPanel;
  private progression!: ProgressionSystem;
  private platforms!: Phaser.Physics.Arcade.StaticGroup;
  private doors: Map<FloorId, Phaser.GameObjects.Image> = new Map();
  private nearDoor: FloorId | null = null;
  private interactPrompt?: Phaser.GameObjects.Text;
  private isTransitioning = false;

  /** The shaft is wider in the 128-px world. */
  private static readonly SHAFT_WIDTH = 220;

  constructor() {
    super({ key: 'HubScene' });
  }

  init(): void {
    if (!this.registry.get('progression')) {
      this.registry.set('progression', new ProgressionSystem());
    }
    this.progression = this.registry.get('progression') as ProgressionSystem;
  }

  create(): void {
    this.isTransitioning = false;
    this.doors.clear();
    this.cameras.main.setBackgroundColor(COLORS.background);

    const worldHeight = 1600;
    this.physics.world.setBounds(0, 0, GAME_WIDTH, worldHeight);

    this.createShaftBackground(worldHeight);
    this.createPlatforms(worldHeight);
    this.createDoors(worldHeight);
    this.createPlayer(worldHeight);   // player first so elevator collider works
    this.createElevator(worldHeight);
    this.createUI();

    this.cameras.main.startFollow(this.player.sprite, true, 0.1, 0.1);
    this.cameras.main.setBounds(0, 0, GAME_WIDTH, worldHeight);
    this.cameras.main.fadeIn(500, 0, 0, 0);
  }

  /* ---- background ---- */
  private createShaftBackground(worldHeight: number): void {
    const cx = GAME_WIDTH / 2;
    const sw = HubScene.SHAFT_WIDTH;

    for (let y = 0; y < worldHeight; y += TILE_SIZE) {
      this.add.tileSprite(cx, y, sw, TILE_SIZE, 'elevator_shaft').setDepth(0);
    }

    const rail = this.add.graphics();
    rail.fillStyle(0x1a3a5a, 0.8);
    rail.fillRect(cx - sw / 2 - 6, 0, 6, worldHeight);
    rail.fillRect(cx + sw / 2, 0, 6, worldHeight);
    rail.setDepth(1);
  }

  /* ---- platforms ---- */
  private createPlatforms(worldHeight: number): void {
    this.platforms = this.physics.add.staticGroup();
    const positions = this.getFloorYPositions(worldHeight);
    const cx = GAME_WIDTH / 2;
    const sw = HubScene.SHAFT_WIDTH;

    for (const [floorId, y] of Object.entries(positions)) {
      // Left side
      for (let x = 0; x < cx - sw / 2; x += TILE_SIZE) {
        const t = this.platforms.create(x + TILE_SIZE / 2, y, 'platform_tile') as Phaser.Physics.Arcade.Image;
        t.setDepth(2).refreshBody();
      }
      // Right side
      for (let x = cx + sw / 2; x < GAME_WIDTH; x += TILE_SIZE) {
        const t = this.platforms.create(x + TILE_SIZE / 2, y, 'platform_tile') as Phaser.Physics.Arcade.Image;
        t.setDepth(2).refreshBody();
      }

      const fId = Number(floorId) as FloorId;
      const fd = LEVEL_DATA[fId];

      // Floor label
      this.add.text(20, y - 60, `F${fId}`, {
        fontFamily: 'monospace', fontSize: '28px',
        color: COLORS.hudText, fontStyle: 'bold',
      }).setDepth(5);

      if (fd) {
        this.add.text(80, y - 56, fd.name, {
          fontFamily: 'monospace', fontSize: '18px', color: '#8899bb',
        }).setDepth(5);
      }
    }
  }

  /* ---- doors ---- */
  private createDoors(worldHeight: number): void {
    const positions = this.getFloorYPositions(worldHeight);
    const doorX = GAME_WIDTH - 140;

    for (const [floorId, y] of Object.entries(positions)) {
      const fId = Number(floorId) as FloorId;
      if (fId === FLOORS.LOBBY) continue;

      const unlocked = this.progression.isFloorUnlocked(fId);
      const door = this.add.image(doorX, y - 56, unlocked ? 'door_unlocked' : 'door_locked');
      door.setDepth(4);
      this.doors.set(fId, door);

      if (!unlocked) {
        const need = this.progression.getAUNeededForFloor(fId);
        this.add.text(doorX, y - 120, `Need ${need} more AU`, {
          fontFamily: 'monospace', fontSize: '14px', color: '#ff6666',
        }).setOrigin(0.5).setDepth(5);
      }
    }
  }

  /* ---- elevator ---- */
  private createElevator(worldHeight: number): void {
    const positions = this.getFloorYPositions(worldHeight);
    const cx = GAME_WIDTH / 2;
    const startY = positions[this.progression.getCurrentFloor()] - 8;

    this.elevator = new Elevator(this, cx, startY);

    for (const [id, y] of Object.entries(positions)) {
      this.elevator.addFloor(Number(id), y - 8);
    }

    this.physics.add.collider(this.player.sprite, this.elevator.platform);
  }

  /* ---- player ---- */
  private createPlayer(worldHeight: number): void {
    const positions = this.getFloorYPositions(worldHeight);
    const y = positions[this.progression.getCurrentFloor()] - 80;

    this.player = new Player(this, GAME_WIDTH / 2, y);
    this.physics.add.collider(this.player.sprite, this.platforms);

    this.interactPrompt = this.add.text(0, 0, '', {
      fontFamily: 'monospace', fontSize: '16px',
      color: '#ffdd44', backgroundColor: '#00000088',
      padding: { x: 8, y: 4 },
    }).setDepth(20).setVisible(false);
  }

  /* ---- UI ---- */
  private createUI(): void {
    this.hud = new HUD(this, this.progression);
    this.elevatorPanel = new ElevatorPanel(this, this.progression, (fId) => {
      if (!this.elevator.getIsMoving()) {
        this.elevator.moveToFloor(fId, () => this.progression.setCurrentFloor(fId));
      }
    });
  }

  /* ---- helpers ---- */
  private getFloorYPositions(worldHeight: number): Record<number, number> {
    return {
      [FLOORS.LOBBY]: worldHeight - 128,
      [FLOORS.PLATFORM_TEAM]: worldHeight - 600,
      [FLOORS.CLOUD_TEAM]: worldHeight - 1072,
    };
  }

  /* ---- update loop ---- */
  update(_time: number, delta: number): void {
    if (this.isTransitioning) return;
    this.player.update(delta);
    this.hud.update();
    this.checkDoorProximity();
    this.handleInteraction();
  }

  private checkDoorProximity(): void {
    this.nearDoor = null;
    for (const [fId, door] of this.doors) {
      const d = Phaser.Math.Distance.Between(
        this.player.sprite.x, this.player.sprite.y, door.x, door.y,
      );
      if (d < 90 && this.progression.isFloorUnlocked(fId)) {
        this.nearDoor = fId;
        this.interactPrompt?.setText('Press E to enter').setPosition(door.x - 60, door.y - 80).setVisible(true);
        return;
      }
    }
    this.interactPrompt?.setVisible(false);
  }

  private handleInteraction(): void {
    if (this.player.getInputManager().isInteractJustPressed() && this.nearDoor !== null) {
      this.enterFloor(this.nearDoor);
    }
  }

  private enterFloor(floorId: FloorId): void {
    if (this.isTransitioning) return;
    this.isTransitioning = true;
    const fd = LEVEL_DATA[floorId];
    this.cameras.main.fadeOut(500, 0, 0, 0);
    this.time.delayedCall(500, () => this.scene.start(fd.sceneKey));
  }
}
