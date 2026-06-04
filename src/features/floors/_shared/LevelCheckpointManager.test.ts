import { beforeEach, describe, expect, it, vi } from 'vitest';
import type * as Phaser from 'phaser';
import { FLOORS } from '../../../config/gameConfig';
import { LevelCheckpointManager } from './LevelCheckpointManager';

vi.mock('phaser', () => ({ default: {} }));

const reducedMotionState = vi.hoisted(() => ({ value: false }));
vi.mock('../../../systems/MotionPreference', () => ({
  isReducedMotion: vi.fn(() => reducedMotionState.value),
}));

const eventBusEmit = vi.hoisted(() => vi.fn());
vi.mock('../../../systems/EventBus', () => ({
  eventBus: { emit: eventBusEmit },
}));

interface MockCheckpoint {
  id: string;
  wireOverlap: ReturnType<typeof vi.fn>;
  triggerActivate: () => void;
}
const createdCheckpoints: MockCheckpoint[] = [];

vi.mock('../../../entities/Checkpoint', () => ({
  Checkpoint: class MockCheckpointImpl {
    readonly wireOverlap = vi.fn();

    constructor(
      _scene: unknown,
      _x: number,
      _y: number,
      public id: string,
      private readonly onActivate: () => void,
    ) {
      createdCheckpoints.push(this as unknown as MockCheckpoint);
    }

    triggerActivate(): void {
      this.onActivate();
    }
  },
}));

beforeEach(() => {
  reducedMotionState.value = false;
  eventBusEmit.mockReset();
  createdCheckpoints.length = 0;
});

function makeHarness(options?: { transitioning?: boolean; floorAU?: number }) {
  const vignette = {
    setDepth: vi.fn(),
    setScrollFactor: vi.fn(),
    setVisible: vi.fn(),
    fillStyle: vi.fn(),
    fillRect: vi.fn(),
  };
  vignette.setDepth.mockReturnValue(vignette);
  vignette.setScrollFactor.mockReturnValue(vignette);
  vignette.setVisible.mockReturnValue(vignette);
  vignette.fillStyle.mockReturnValue(vignette);
  vignette.fillRect.mockReturnValue(vignette);

  const flash = vi.fn();
  const scene = {
    add: { graphics: vi.fn(() => vignette) },
    cameras: { main: { flash } },
    physics: { add: {} },
  } as unknown as Phaser.Scene;

  const progression = {
    getFloorAU: vi.fn(() => options?.floorAU ?? 1),
  } as unknown as import('../../../systems/ProgressionSystem').ProgressionSystem;

  const player = {
    sprite: {},
    setPosition: vi.fn(),
  } as unknown as import('../../../entities/Player').Player;

  const mgr = new LevelCheckpointManager({
    scene,
    floorId: FLOORS.PLATFORM_TEAM,
    progression,
    getIsTransitioning: () => options?.transitioning ?? false,
    getPlayerStart: () => ({ x: 10, y: 20 }),
  });

  return { mgr, scene, player, progression, vignette, flash };
}

describe('LevelCheckpointManager', () => {
  it('throws when spawn() is called before setPlayer()', () => {
    const { mgr } = makeHarness();
    expect(() => {
      mgr.spawn({
        floorId: FLOORS.PLATFORM_TEAM,
        playerStart: { x: 0, y: 0 },
        exitPosition: { x: 0, y: 0 },
        platforms: [],
        tokens: [],
        roomElevators: [],
        checkpoints: [{ id: 'cp-1', x: 100, y: 200 }],
      });
    }).toThrow('LevelCheckpointManager.spawn() called before setPlayer()');
  });

  it('spawns checkpoints after setPlayer() and emits checkpoint events on activate', () => {
    const { mgr, scene, player } = makeHarness();
    mgr.setPlayer(player);

    mgr.spawn({
      floorId: FLOORS.PLATFORM_TEAM,
      playerStart: { x: 0, y: 0 },
      exitPosition: { x: 0, y: 0 },
      platforms: [],
      tokens: [],
      roomElevators: [],
      checkpoints: [{ id: 'cp-1', x: 100, y: 200 }, { id: 'cp-2', x: 300, y: 400 }],
    });

    expect(createdCheckpoints).toHaveLength(2);
    expect(createdCheckpoints[0]?.wireOverlap).toHaveBeenCalledWith((scene as { physics: unknown }).physics, player.sprite);
    createdCheckpoints[0]?.triggerActivate();
    expect(mgr.floorHazard.getCheckpointPos()).toEqual({ x: 100, y: 200 });
    expect(eventBusEmit).toHaveBeenCalledWith('checkpoint:activate', 'cp-1');
    expect(eventBusEmit).toHaveBeenCalledWith('checkpoint:reached', { index: 1, total: 2 });
  });

  it('respawns player at checkpoint with camera flash when motion is enabled', () => {
    const { mgr, player, flash, vignette } = makeHarness();
    mgr.setPlayer(player);
    mgr.createDangerVignette();
    mgr.floorHazard.registerCheckpoint(222, 333);
    mgr.onPlayerHit();
    mgr.onPlayerHit();

    mgr.triggerRespawn();

    expect(player.setPosition).toHaveBeenCalledWith(222, 333);
    expect(flash).toHaveBeenCalledWith(180, 255, 255, 255, true);
    expect(vignette.setVisible).toHaveBeenCalledWith(false);
    expect(mgr.floorHazard.getHitCount()).toBe(0);
  });

  it('emits heartbeat in danger zone and skips camera flash when reduced motion is enabled', () => {
    const { mgr, player, flash, progression, vignette } = makeHarness();
    reducedMotionState.value = true;
    mgr.setPlayer(player);
    mgr.createDangerVignette();
    mgr.onPlayerHit();
    mgr.onPlayerHit();
    progression.getFloorAU = vi.fn(() => 1);

    mgr.updateDangerState(850);
    mgr.triggerRespawn();

    expect(eventBusEmit).toHaveBeenCalledWith('sfx:heartbeat');
    expect(vignette.setVisible).toHaveBeenCalledWith(false);
    expect(flash).not.toHaveBeenCalled();
  });
});
