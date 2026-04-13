import Phaser from 'phaser';
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
  private floorLabels: Map<FloorId, Phaser.GameObjects.Text> = new Map();
  private nearDoor: FloorId | null = null;
  private interactPrompt?: Phaser.GameObjects.Text;
  private isTransitioning = false;

  constructor() {
    super({ key: 'HubScene' });
  }

  init(): void {
    // Get or create progression system (shared via registry)
    if (!this.registry.get('progression')) {
      this.registry.set('progression', new ProgressionSystem());
    }
    this.progression = this.registry.get('progression') as ProgressionSystem;
  }

  create(): void {
    this.isTransitioning = false;
    this.cameras.main.setBackgroundColor(COLORS.background);

    // World bounds - tall enough for all floors
    const worldHeight = 800;
    this.physics.world.setBounds(0, 0, GAME_WIDTH, worldHeight);

    this.createShaftBackground();
    this.createPlatforms(worldHeight);
    this.createDoors(worldHeight);
    this.createElevator(worldHeight);
    this.createPlayer(worldHeight);
    this.createUI();

    // Camera follows player
    this.cameras.main.startFollow(this.player.sprite, true, 0.1, 0.1);
    this.cameras.main.setBounds(0, 0, GAME_WIDTH, worldHeight);

    // Fade in
    this.cameras.main.fadeIn(500, 0, 0, 0);
  }

  private createShaftBackground(): void {
    // Draw elevator shaft background strips
    const shaftX = GAME_WIDTH / 2;
    const shaftWidth = 120;

    for (let y = 0; y < 800; y += TILE_SIZE) {
      const bg = this.add.tileSprite(shaftX, y, shaftWidth, TILE_SIZE, 'elevator_shaft');
      bg.setDepth(0);
    }

    // Shaft rails
    const leftRail = this.add.graphics();
    leftRail.fillStyle(0x1a3a5a, 0.8);
    leftRail.fillRect(shaftX - shaftWidth / 2 - 4, 0, 4, 800);
    leftRail.setDepth(1);

    const rightRail = this.add.graphics();
    rightRail.fillStyle(0x1a3a5a, 0.8);
    rightRail.fillRect(shaftX + shaftWidth / 2, 0, 4, 800);
    rightRail.setDepth(1);
  }

  private createPlatforms(worldHeight: number): void {
    this.platforms = this.physics.add.staticGroup();

    // Floor positions (from bottom to top)
    const floorYPositions = this.getFloorYPositions(worldHeight);

    // Create floor platforms on both sides of the elevator shaft
    const shaftX = GAME_WIDTH / 2;
    const shaftWidth = 120;

    for (const [floorId, yPos] of Object.entries(floorYPositions)) {
      const y = yPos;

      // Left platform
      for (let x = 0; x < shaftX - shaftWidth / 2; x += TILE_SIZE) {
        const tile = this.platforms.create(x + TILE_SIZE / 2, y, 'platform_tile') as Phaser.Physics.Arcade.Image;
        tile.setDepth(2);
        tile.refreshBody();
      }

      // Right platform
      for (let x = shaftX + shaftWidth / 2; x < GAME_WIDTH; x += TILE_SIZE) {
        const tile = this.platforms.create(x + TILE_SIZE / 2, y, 'platform_tile') as Phaser.Physics.Arcade.Image;
        tile.setDepth(2);
        tile.refreshBody();
      }

      // Floor number label on the left wall
      const floorNum = Number(floorId);
      const label = this.add.text(16, y - 40, `F${floorNum}`, {
        fontFamily: 'monospace',
        fontSize: '20px',
        color: COLORS.hudText,
        fontStyle: 'bold',
      });
      label.setDepth(5);
      this.floorLabels.set(floorNum as FloorId, label);

      // Floor name
      const floorData = LEVEL_DATA[floorNum as FloorId];
      if (floorData) {
        this.add.text(60, y - 38, floorData.name, {
          fontFamily: 'monospace',
          fontSize: '13px',
          color: '#8899bb',
        }).setDepth(5);
      }
    }
  }

  private createDoors(worldHeight: number): void {
    const floorYPositions = this.getFloorYPositions(worldHeight);
    const doorX = GAME_WIDTH - 100;

    for (const [floorId, yPos] of Object.entries(floorYPositions)) {
      const fId = Number(floorId) as FloorId;
      if (fId === FLOORS.LOBBY) continue; // No door for lobby

      const isUnlocked = this.progression.isFloorUnlocked(fId);
      const doorKey = isUnlocked ? 'door_unlocked' : 'door_locked';

      const door = this.add.image(doorX, yPos - 28, doorKey);
      door.setDepth(4);
      this.doors.set(fId, door);

      // Token requirement label
      if (!isUnlocked) {
        const needed = this.progression.getTokensNeededForFloor(fId);
        this.add.text(doorX, yPos - 64, `Need ${needed} more tokens`, {
          fontFamily: 'monospace',
          fontSize: '10px',
          color: '#ff6666',
        }).setOrigin(0.5).setDepth(5);
      }
    }
  }

  private createElevator(worldHeight: number): void {
    const floorYPositions = this.getFloorYPositions(worldHeight);
    const shaftX = GAME_WIDTH / 2;
    const currentFloor = this.progression.getCurrentFloor();
    const startY = floorYPositions[currentFloor] - 6;

    this.elevator = new Elevator(this, shaftX, startY);

    // Register floor positions
    for (const [floorId, yPos] of Object.entries(floorYPositions)) {
      this.elevator.addFloor(Number(floorId), yPos - 6);
    }

    // Collide player with elevator
    this.physics.add.collider(this.player?.sprite || this.add.zone(0, 0, 0, 0), this.elevator.platform);
  }

  private createPlayer(worldHeight: number): void {
    const floorYPositions = this.getFloorYPositions(worldHeight);
    const currentFloor = this.progression.getCurrentFloor();
    const startY = floorYPositions[currentFloor] - 30;
    const startX = GAME_WIDTH / 2;

    this.player = new Player(this, startX, startY);

    // Collisions
    this.physics.add.collider(this.player.sprite, this.platforms);
    this.physics.add.collider(this.player.sprite, this.elevator.platform);

    // Interact prompt
    this.interactPrompt = this.add.text(0, 0, '', {
      fontFamily: 'monospace',
      fontSize: '12px',
      color: '#ffdd44',
      backgroundColor: '#00000088',
      padding: { x: 6, y: 3 },
    }).setDepth(20).setVisible(false);
  }

  private createUI(): void {
    this.hud = new HUD(this, this.progression);

    // Elevator panel
    this.elevatorPanel = new ElevatorPanel(this, this.progression, (floorId: FloorId) => {
      this.onFloorSelected(floorId);
    });
  }

  private getFloorYPositions(worldHeight: number): Record<number, number> {
    return {
      [FLOORS.LOBBY]: worldHeight - 64,
      [FLOORS.PLATFORM_TEAM]: worldHeight - 280,
      [FLOORS.CLOUD_TEAM]: worldHeight - 496,
    };
  }

  private onFloorSelected(floorId: FloorId): void {
    if (this.elevator.getIsMoving()) return;

    this.elevator.moveToFloor(floorId, () => {
      this.progression.setCurrentFloor(floorId);
    });
  }

  update(_time: number, delta: number): void {
    if (this.isTransitioning) return;

    this.player.update(delta);
    this.hud.update();
    this.checkDoorProximity();
    this.handleInteraction();

    // Keep player riding the elevator
    if (this.elevator.getIsMoving()) {
      const body = this.player.sprite.body as Phaser.Physics.Arcade.Body;
      if (body.touching.down || body.blocked.down) {
        // Player stays with elevator
      }
    }
  }

  private checkDoorProximity(): void {
    this.nearDoor = null;
    for (const [floorId, door] of this.doors) {
      const dist = Phaser.Math.Distance.Between(
        this.player.sprite.x, this.player.sprite.y,
        door.x, door.y
      );
      if (dist < 50 && this.progression.isFloorUnlocked(floorId)) {
        this.nearDoor = floorId;
        if (this.interactPrompt) {
          this.interactPrompt.setText('Press E to enter');
          this.interactPrompt.setPosition(door.x - 40, door.y - 50);
          this.interactPrompt.setVisible(true);
        }
        return;
      }
    }
    this.interactPrompt?.setVisible(false);
  }

  private handleInteraction(): void {
    const inputManager = this.player.getInputManager();

    if (inputManager.isInteractJustPressed()) {
      if (this.nearDoor !== null) {
        this.enterFloor(this.nearDoor);
      }
    }
  }

  private enterFloor(floorId: FloorId): void {
    if (this.isTransitioning) return;
    this.isTransitioning = true;

    const floorData = LEVEL_DATA[floorId];
    this.cameras.main.fadeOut(500, 0, 0, 0);
    this.time.delayedCall(500, () => {
      this.scene.start(floorData.sceneKey);
    });
  }
}
