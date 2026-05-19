import { beforeEach, describe, expect, it, vi } from 'vitest';
import type * as Phaser from 'phaser';
import { LevelCheckpointManager } from './LevelCheckpointManager';
import type { LevelConfig } from './LevelConfig';

vi.mock('phaser', () => ({ default: {} }));

const eventBusEmit = vi.hoisted(() => vi.fn());
vi.mock('../../../systems/EventBus', () => ({
  eventBus: { emit: eventBusEmit },
}));

const checkpointRecords = vi.hoisted(() => [] as Array<{
  onReach: () => void;
  wireOverlap: ReturnType<typeof vi.fn>;
}>);
vi.mock('../../../entities/Checkpoint', () => ({
  Checkpoint: class Checkpoint {
    wireOverlap = vi.fn();

    constructor(
      _scene: unknown,
      _x: number,
      _y: number,
      _id: string,
      onReach: () => void,
    ) {
      checkpointRecords.push({
        onReach,
        wireOverlap: this.wireOverlap,
      });
    }
  },
}));

describe('LevelCheckpointManager', () => {
  beforeEach(() => {
    eventBusEmit.mockReset();
    checkpointRecords.length = 0;
  });

  function makeConfig(): LevelConfig {
    return {
      floorId: 'platform-team',
      playerStart: { x: 0, y: 0 },
      exitPosition: { x: 0, y: 0 },
      platforms: [],
      tokens: [],
      roomElevators: [],
      checkpoints: [{ x: 10, y: 20, id: 'cp-1' }],
    } as unknown as LevelConfig;
  }

  it('throws if spawn() is called before setPlayer()', () => {
    const scene = { physics: {} } as Phaser.Scene;
    const manager = new LevelCheckpointManager({
      scene,
      floorId: 'platform-team' as never,
      progression: {} as never,
      getIsTransitioning: () => false,
      getPlayerStart: () => ({ x: 0, y: 0 }),
    });

    expect(() => manager.spawn(makeConfig())).toThrow(/before setPlayer/i);
  });

  it('emits checkpoint activation and progress when the checkpoint is reached', () => {
    const player = { sprite: {} } as unknown as import('../../../entities/Player').Player;
    const scene = { physics: {} } as Phaser.Scene;
    const manager = new LevelCheckpointManager({
      scene,
      floorId: 'platform-team' as never,
      progression: {} as never,
      getIsTransitioning: () => false,
      getPlayerStart: () => ({ x: 0, y: 0 }),
    });

    manager.setPlayer(player);
    manager.spawn(makeConfig());
    checkpointRecords[0]!.onReach();

    expect(checkpointRecords[0]!.wireOverlap).toHaveBeenCalledWith(scene.physics, player.sprite);
    expect(eventBusEmit).toHaveBeenCalledWith('checkpoint:activate', 'cp-1');
    expect(eventBusEmit).toHaveBeenCalledWith('checkpoint:reached', { index: 1, total: 1 });
  });
});
