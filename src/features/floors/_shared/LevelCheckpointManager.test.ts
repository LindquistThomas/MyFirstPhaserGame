import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LevelCheckpointManager } from './LevelCheckpointManager';
import type { LevelConfig } from './LevelConfig';

const checkpointRecords: Array<{
  id: string;
  x: number;
  y: number;
  activatedOnSpawn: boolean;
  onActivate: () => void;
  wireOverlap: (physics: unknown, playerSprite: unknown) => void;
}> = [];

vi.mock('../../../entities/Checkpoint', () => ({
  Checkpoint: class MockCheckpoint {
    constructor(
      _scene: unknown,
      x: number,
      y: number,
      id: string,
      onActivate: () => void,
      activatedOnSpawn = false,
    ) {
      checkpointRecords.push({
        id,
        x,
        y,
        activatedOnSpawn,
        onActivate,
        wireOverlap: vi.fn(),
      });
    }

    wireOverlap(physics: unknown, playerSprite: unknown): void {
      checkpointRecords[checkpointRecords.length - 1]?.wireOverlap(physics, playerSprite);
    }
  },
}));

const { emit } = vi.hoisted(() => ({ emit: vi.fn() }));
vi.mock('../../../systems/EventBus', () => ({ eventBus: { emit } }));

describe('LevelCheckpointManager', () => {
  beforeEach(() => {
    checkpointRecords.length = 0;
    emit.mockReset();
  });

  it('hydrates checkpoint activation and persists new activation', () => {
    const activatedIds = ['cp-1'];
    const progression = {
      getActivatedCheckpointIds: vi.fn(() => activatedIds),
      getLatestActivatedCheckpointId: vi.fn(() => 'cp-1'),
      activateCheckpoint: vi.fn(),
      clearActivatedCheckpoints: vi.fn(),
    };
    const floorHazard = {
      registerCheckpoint: vi.fn(),
      getCheckpointPos: vi.fn(() => null),
    };
    const manager = new LevelCheckpointManager({
      scene: {} as never,
      floorId: 1 as never,
      progression: progression as never,
      floorHazard: floorHazard as never,
    });

    const cfg: LevelConfig = {
      floorId: 1 as never,
      platforms: [],
      tokens: [],
      roomElevators: [],
      exitPosition: { x: 0, y: 0 },
      playerStart: { x: 10, y: 20 },
      checkpoints: [
        { id: 'cp-1', x: 100, y: 200 },
        { id: 'cp-2', x: 300, y: 400 },
      ],
    };

    manager.init(cfg, {} as never, {} as never);
    manager.update();
    manager.shutdown();

    expect(checkpointRecords.map((cp) => [cp.id, cp.activatedOnSpawn])).toEqual([
      ['cp-1', true],
      ['cp-2', false],
    ]);
    expect(floorHazard.registerCheckpoint).toHaveBeenCalledWith(100, 200);

    checkpointRecords[1]!.onActivate();
    expect(progression.activateCheckpoint).toHaveBeenCalledWith(1, 'cp-2');
    expect(floorHazard.registerCheckpoint).toHaveBeenCalledWith(300, 400);
    expect(emit).toHaveBeenCalledWith('checkpoint:activate', 'cp-2');
  });

  it('resolves entry spawn and clears stale checkpoint ids', () => {
    const progression = {
      getActivatedCheckpointIds: vi.fn(() => []),
      getLatestActivatedCheckpointId: vi.fn(() => 'gone'),
      activateCheckpoint: vi.fn(),
      clearActivatedCheckpoints: vi.fn(),
    };
    const floorHazard = {
      registerCheckpoint: vi.fn(),
      getCheckpointPos: vi.fn(() => ({ x: 999, y: 555 })),
    };
    const manager = new LevelCheckpointManager({
      scene: {} as never,
      floorId: 7 as never,
      progression: progression as never,
      floorHazard: floorHazard as never,
    });
    const cfg: LevelConfig = {
      floorId: 7 as never,
      platforms: [],
      tokens: [],
      roomElevators: [],
      exitPosition: { x: 0, y: 0 },
      playerStart: { x: 10, y: 20 },
      checkpoints: [{ id: 'cp-1', x: 100, y: 200 }],
    };

    expect(manager.resolveEntrySpawn(cfg)).toEqual({ x: 10, y: 20 });
    expect(progression.clearActivatedCheckpoints).toHaveBeenCalledWith(7);
    expect(manager.resolveRespawnTarget({ x: 1, y: 2 })).toEqual({ x: 999, y: 555 });
  });
});
