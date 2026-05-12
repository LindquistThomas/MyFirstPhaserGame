import { describe, expect, it, vi, beforeEach } from 'vitest';

const createdCheckpoints: Array<{
  id: string;
  x: number;
  y: number;
  onActivate: () => void;
  activatedOnSpawn: boolean;
}> = [];

const playerCtor = vi.fn();

vi.mock('phaser', () => {
  class Scene {
    constructor(_config?: unknown) {}
  }
  return { default: { Scene }, Scene };
});

vi.mock('../../../config/gameConfig', () => ({
  GAME_WIDTH: 1280,
  GAME_HEIGHT: 720,
  TILE_SIZE: 64,
  FLOORS: { LOBBY: 0, PLATFORM_TEAM: 1 },
}));

vi.mock('../../../config/levelData', () => ({
  LEVEL_DATA: {
    0: { id: 0, name: 'Lobby', theme: { backgroundColor: 0, tokenColor: 0xffffff }, auRequired: 0 },
    1: { id: 1, name: 'Platform', theme: { backgroundColor: 0, tokenColor: 0xffffff }, auRequired: 0 },
  },
}));

vi.mock('../../../entities/Player', () => ({
  Player: class Player {
    sprite = { setCollideWorldBounds: vi.fn() };
    setPosition = vi.fn();
    constructor(scene: unknown, x: number, y: number) {
      playerCtor(scene, x, y);
    }
  },
}));

vi.mock('../../../entities/Checkpoint', () => ({
  Checkpoint: class Checkpoint {
    trigger = {};
    activated: boolean;
    constructor(
      _scene: unknown,
      x: number,
      y: number,
      id: string,
      onActivate: () => void,
      activatedOnSpawn = false,
    ) {
      this.activated = activatedOnSpawn;
      createdCheckpoints.push({ id, x, y, onActivate, activatedOnSpawn });
    }
    wireOverlap(): void {}
  },
}));

vi.mock('../../../entities/Enemy', () => ({ Enemy: class Enemy {} }));
vi.mock('../../../ui/HUD', () => ({ HUD: class HUD {} }));
vi.mock('../../../ui/DialogController', () => ({ DialogController: class DialogController {} }));
vi.mock('../../../systems/FloorHitState', () => ({ FloorHitState: class FloorHitState {
  registerCheckpoint = vi.fn();
  reset = vi.fn();
  getCheckpointPos = vi.fn(() => null);
  recordHit = vi.fn(() => false);
  isDangerZone = vi.fn(() => false);
} }));
vi.mock('../../../input', () => ({ allKeyLabels: () => 'E' }));
vi.mock('../../../entities/MovingPlatform', () => ({ MovingPlatform: class MovingPlatform {} }));
vi.mock('./LevelEnemySpawner', () => ({ LevelEnemySpawner: class LevelEnemySpawner {} }));
vi.mock('./LevelTokenManager', () => ({ LevelTokenManager: class LevelTokenManager {} }));
vi.mock('./LevelCoffeeManager', () => ({ LevelCoffeeManager: class LevelCoffeeManager {} }));
vi.mock('./LevelFridgeManager', () => ({ LevelFridgeManager: class LevelFridgeManager {} }));
vi.mock('./LevelZoneSetup', () => ({ LevelZoneSetup: class LevelZoneSetup {} }));
vi.mock('./LevelRoomElevators', () => ({ LevelRoomElevators: class LevelRoomElevators {} }));
vi.mock('./LevelDialogBindings', () => ({ createLevelDialogs: vi.fn(() => ({})) }));
vi.mock('./sceneBackdrop', () => ({ drawSceneBackdrop: vi.fn() }));
vi.mock('./floorAccents', () => ({ drawFloorAccents: vi.fn() }));
vi.mock('../../../style/theme', () => ({ theme: { color: { css: { textWarn: '#fff', bgDialog: '#000' } }, space: { sm: 4, xs: 2 } } }));
vi.mock('../../../systems/MotionPreference', () => ({ isReducedMotion: () => false }));
vi.mock('../../../systems/sceneLifecycle', () => ({ createSceneLifecycle: vi.fn(() => ({})) }));
vi.mock('../../../ui/CallElevatorButton', () => ({ CallElevatorButton: class CallElevatorButton {} }));
vi.mock('../../../systems/EventBus', () => ({ eventBus: { emit: vi.fn() } }));
vi.mock('../../../systems/SettingsStore', () => ({ settingsStore: { read: () => ({ hideTutorials: false }) } }));
vi.mock('./coachHints', () => ({ getCoachHint: () => null }));
vi.mock('../../../config/quiz', () => ({ preloadQuizFor: vi.fn(() => Promise.resolve()) }));
vi.mock('../../../config/info', () => ({ preloadInfoFor: vi.fn(() => Promise.resolve()) }));
vi.mock('./dailyChallengeLayout', () => ({ applyDailyChallengeLayout: (_cfg: unknown) => _cfg }));
vi.mock('../../../systems/DailyChallenge', () => ({ getDailyState: vi.fn(() => null) }));
vi.mock('../../../systems/DailyChallengeStore', () => ({
  hasCompletionStreakEndingAt: vi.fn(() => false),
  recordResult: vi.fn(),
}));

import { LevelScene, type LevelConfig } from './LevelScene';

describe('LevelScene checkpoint persistence', () => {
  beforeEach(() => {
    createdCheckpoints.length = 0;
    playerCtor.mockReset();
  });

  it('hydrates activated checkpoints and persists activation, then uses checkpoint spawn on re-entry', () => {
    const checkpointState: string[] = [];
    const progression = {
      getActivatedCheckpointIds: vi.fn(() => [...checkpointState]),
      getLatestActivatedCheckpointId: vi.fn(() => checkpointState[checkpointState.length - 1] ?? null),
      activateCheckpoint: vi.fn((_floorId: number, checkpointId: string) => {
        const without = checkpointState.filter((id) => id !== checkpointId);
        without.push(checkpointId);
        checkpointState.splice(0, checkpointState.length, ...without);
      }),
    };

    const cfg: LevelConfig = {
      floorId: 1,
      platforms: [],
      tokens: [],
      roomElevators: [],
      exitPosition: { x: 0, y: 0 },
      playerStart: { x: 100, y: 200 },
      checkpoints: [
        { id: 'cp-1', x: 400, y: 500 },
        { id: 'cp-2', x: 700, y: 500 },
      ],
    };

    const firstEntry = {
      floorId: 1,
      progression,
      floorHazard: { registerCheckpoint: vi.fn() },
      physics: {},
      player: { sprite: {} },
      getResolvedLevelConfig: () => cfg,
      add: { text: vi.fn(() => ({ setDepth: vi.fn().mockReturnThis(), setVisible: vi.fn().mockReturnThis() })) },
    };

    (LevelScene.prototype as unknown as { spawnCheckpoints: (cfg: LevelConfig) => void }).spawnCheckpoints.call(firstEntry, cfg);
    expect(createdCheckpoints.map((cp) => [cp.id, cp.activatedOnSpawn])).toEqual([
      ['cp-1', false],
      ['cp-2', false],
    ]);

    const activated = createdCheckpoints.find((cp) => cp.id === 'cp-1');
    expect(activated).toBeDefined();
    activated?.onActivate();
    expect(progression.activateCheckpoint).toHaveBeenCalledWith(1, 'cp-1');
    expect(checkpointState).toEqual(['cp-1']);

    const secondEntry = {
      floorId: 1,
      progression,
      floorHazard: { registerCheckpoint: vi.fn() },
      physics: {},
      player: { sprite: {} },
      getResolvedLevelConfig: () => cfg,
      add: { text: vi.fn(() => ({ setDepth: vi.fn().mockReturnThis(), setVisible: vi.fn().mockReturnThis() })) },
      resolveEntrySpawn(this: unknown, levelCfg: LevelConfig) {
        return (LevelScene.prototype as unknown as { resolveEntrySpawn: (cfg: LevelConfig) => { x: number; y: number } })
          .resolveEntrySpawn.call(this, levelCfg);
      },
    };

    (LevelScene.prototype as unknown as { createPlayer: () => void }).createPlayer.call(secondEntry);
    expect(playerCtor).toHaveBeenCalledWith(secondEntry, 400, 500);

    createdCheckpoints.length = 0;
    (LevelScene.prototype as unknown as { spawnCheckpoints: (cfg: LevelConfig) => void }).spawnCheckpoints.call(secondEntry, cfg);
    expect(createdCheckpoints.map((cp) => [cp.id, cp.activatedOnSpawn])).toEqual([
      ['cp-1', true],
      ['cp-2', false],
    ]);
    expect(secondEntry.floorHazard.registerCheckpoint).toHaveBeenCalledWith(400, 500);
  });
});
