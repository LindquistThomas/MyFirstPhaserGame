import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LevelCheckpointManager } from './LevelCheckpointManager';
import type { LevelConfig } from './LevelConfig';
import type { Player } from '../../../entities/Player';

// ── Mocks ────────────────────────────────────────────────────────────────────

const checkpointRecords: Array<{
  id: string;
  x: number;
  y: number;
  onActivate: () => void;
}> = [];

vi.mock('../../../entities/Checkpoint', () => ({
  Checkpoint: class MockCheckpoint {
    constructor(
      _scene: unknown,
      public readonly x: number,
      public readonly y: number,
      public readonly id: string,
      public readonly onActivate: () => void,
    ) {
      checkpointRecords.push({ id, x, y, onActivate });
    }
    wireOverlap = vi.fn();
  },
}));

const { emit } = vi.hoisted(() => ({ emit: vi.fn() }));
vi.mock('../../../systems/EventBus', () => ({ eventBus: { emit } }));

const { isReducedMotion } = vi.hoisted(() => ({ isReducedMotion: vi.fn(() => false) }));
vi.mock('../../../systems/MotionPreference', () => ({ isReducedMotion }));

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeGraphics() {
  const g = {
    setDepth: vi.fn(),
    setScrollFactor: vi.fn(),
    setVisible: vi.fn(),
    fillStyle: vi.fn(),
    fillRect: vi.fn(),
  };
  g.setDepth.mockReturnValue(g);
  g.setScrollFactor.mockReturnValue(g);
  g.setVisible.mockReturnValue(g);
  return g;
}

function makePlayer() {
  return { sprite: { body: {} }, setPosition: vi.fn() } as unknown as Player;
}

function makeDeps(overrides: {
  getIsTransitioning?: () => boolean;
  getPlayerStart?: () => { x: number; y: number };
  floorAU?: number;
} = {}) {
  const graphics = makeGraphics();
  const flash = vi.fn();
  const scene = {
    add: { graphics: vi.fn(() => graphics) },
    physics: { add: { overlap: vi.fn() } },
    cameras: { main: { flash } },
  } as unknown as import('phaser').Scene;

  const floorAU = overrides.floorAU ?? 10;
  const progression = {
    getFloorAU: vi.fn(() => floorAU),
  } as unknown as import('../../../systems/ProgressionSystem').ProgressionSystem;

  return {
    deps: {
      scene,
      floorId: 1 as never,
      progression,
      getIsTransitioning: overrides.getIsTransitioning ?? (() => false),
      getPlayerStart: overrides.getPlayerStart ?? (() => ({ x: 50, y: 100 })),
    },
    graphics,
    flash,
  };
}

function makeConfig(checkpoints?: LevelConfig['checkpoints']): LevelConfig {
  return {
    floorId: 1 as never,
    platforms: [],
    tokens: [],
    roomElevators: [],
    exitPosition: { x: 0, y: 0 },
    playerStart: { x: 50, y: 100 },
    checkpoints,
  };
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('LevelCheckpointManager — spawn()', () => {
  beforeEach(() => {
    checkpointRecords.length = 0;
    emit.mockReset();
  });

  it('does nothing when checkpoints array is absent', () => {
    const { deps } = makeDeps();
    const manager = new LevelCheckpointManager(deps);
    manager.setPlayer(makePlayer());
    manager.spawn(makeConfig());
    expect(checkpointRecords).toHaveLength(0);
  });

  it('does nothing when checkpoints array is empty', () => {
    const { deps } = makeDeps();
    const manager = new LevelCheckpointManager(deps);
    manager.setPlayer(makePlayer());
    manager.spawn(makeConfig([]));
    expect(checkpointRecords).toHaveLength(0);
  });

  it('throws if spawn() is called before setPlayer()', () => {
    const { deps } = makeDeps();
    const manager = new LevelCheckpointManager(deps);
    expect(() => manager.spawn(makeConfig([{ id: 'cp', x: 0, y: 0 }]))).toThrow(
      'LevelCheckpointManager.spawn() called before setPlayer()',
    );
  });

  it('creates a Checkpoint entity for each entry', () => {
    const { deps } = makeDeps();
    const manager = new LevelCheckpointManager(deps);
    manager.setPlayer(makePlayer());
    manager.spawn(makeConfig([
      { id: 'cp-a', x: 100, y: 200 },
      { id: 'cp-b', x: 300, y: 400 },
    ]));
    expect(checkpointRecords).toHaveLength(2);
    expect(checkpointRecords[0]!.id).toBe('cp-a');
    expect(checkpointRecords[1]!.id).toBe('cp-b');
  });

  it('onActivate callback registers checkpoint position and emits event', () => {
    const { deps } = makeDeps();
    const manager = new LevelCheckpointManager(deps);
    manager.setPlayer(makePlayer());
    manager.spawn(makeConfig([{ id: 'cp-x', x: 77, y: 88 }]));

    checkpointRecords[0]!.onActivate();

    expect(manager.floorHazard.getCheckpointPos()).toEqual({ x: 77, y: 88 });
    expect(emit).toHaveBeenCalledWith('checkpoint:activate', 'cp-x');
  });
});

describe('LevelCheckpointManager — onPlayerHit()', () => {
  it('does not trigger respawn before 3 hits', () => {
    const { deps } = makeDeps();
    const player = makePlayer();
    const manager = new LevelCheckpointManager(deps);
    manager.setPlayer(player);
    manager.onPlayerHit();
    manager.onPlayerHit();
    expect(player.setPosition).not.toHaveBeenCalled();
  });

  it('triggers respawn on the 3rd hit', () => {
    const { deps } = makeDeps();
    const player = makePlayer();
    const manager = new LevelCheckpointManager(deps);
    manager.setPlayer(player);
    manager.onPlayerHit();
    manager.onPlayerHit();
    manager.onPlayerHit();
    expect(player.setPosition).toHaveBeenCalledTimes(1);
  });
});

describe('LevelCheckpointManager — triggerRespawn()', () => {
  beforeEach(() => {
    checkpointRecords.length = 0;
    emit.mockReset();
    isReducedMotion.mockReturnValue(false);
  });

  it('respawns at playerStart when no checkpoint is active', () => {
    const { deps } = makeDeps({ getPlayerStart: () => ({ x: 10, y: 20 }) });
    const player = makePlayer();
    const manager = new LevelCheckpointManager(deps);
    manager.setPlayer(player);
    manager.triggerRespawn();
    expect(player.setPosition).toHaveBeenCalledWith(10, 20);
  });

  it('respawns at active checkpoint position when one exists', () => {
    const { deps } = makeDeps({ getPlayerStart: () => ({ x: 10, y: 20 }) });
    const player = makePlayer();
    const manager = new LevelCheckpointManager(deps);
    manager.setPlayer(player);
    manager.spawn(makeConfig([{ id: 'cp-1', x: 500, y: 300 }]));
    checkpointRecords[0]!.onActivate();

    manager.triggerRespawn();
    expect(player.setPosition).toHaveBeenCalledWith(500, 300);
  });

  it('does nothing when a transition is in progress', () => {
    const { deps } = makeDeps({ getIsTransitioning: () => true });
    const player = makePlayer();
    const manager = new LevelCheckpointManager(deps);
    manager.setPlayer(player);
    manager.triggerRespawn();
    expect(player.setPosition).not.toHaveBeenCalled();
  });

  it('flashes the camera when reduced-motion is off', () => {
    const { deps, flash } = makeDeps();
    isReducedMotion.mockReturnValue(false);
    const manager = new LevelCheckpointManager(deps);
    manager.setPlayer(makePlayer());
    manager.triggerRespawn();
    expect(flash).toHaveBeenCalled();
  });

  it('skips camera flash when reduced-motion is on', () => {
    const { deps, flash } = makeDeps();
    isReducedMotion.mockReturnValue(true);
    const manager = new LevelCheckpointManager(deps);
    manager.setPlayer(makePlayer());
    manager.triggerRespawn();
    expect(flash).not.toHaveBeenCalled();
  });

  it('resets floorHazard hit count after respawn', () => {
    const { deps } = makeDeps();
    const player = makePlayer();
    const manager = new LevelCheckpointManager(deps);
    manager.setPlayer(player);
    manager.onPlayerHit();
    manager.onPlayerHit();
    manager.onPlayerHit(); // 3rd hit triggers respawn
    expect(manager.floorHazard.getHitCount()).toBe(0);
  });
});

describe('LevelCheckpointManager — createDangerVignette()', () => {
  it('creates a graphics object on the scene', () => {
    const { deps, graphics } = makeDeps();
    const manager = new LevelCheckpointManager(deps);
    manager.createDangerVignette();
    expect(deps.scene.add.graphics).toHaveBeenCalled();
    expect(graphics.setDepth).toHaveBeenCalledWith(98);
    expect(graphics.setScrollFactor).toHaveBeenCalledWith(0);
    expect(graphics.setVisible).toHaveBeenCalledWith(false);
  });
});

describe('LevelCheckpointManager — updateDangerState()', () => {
  beforeEach(() => { emit.mockReset(); });

  it('hides vignette when not in danger zone', () => {
    const { deps, graphics } = makeDeps({ floorAU: 10 });
    const manager = new LevelCheckpointManager(deps);
    manager.setPlayer(makePlayer());
    manager.createDangerVignette();
    manager.updateDangerState(16);
    expect(graphics.setVisible).toHaveBeenLastCalledWith(false);
  });

  it('shows vignette when in danger zone and AU <= 1', () => {
    const { deps, graphics } = makeDeps({ floorAU: 1 });
    isReducedMotion.mockReturnValue(false);
    const manager = new LevelCheckpointManager(deps);
    manager.setPlayer(makePlayer());
    manager.createDangerVignette();
    // Two hits → hitCount = 2 = RESPAWN_THRESHOLD - 1 → isDangerZone() true
    manager.onPlayerHit();
    manager.onPlayerHit();
    manager.updateDangerState(16);
    expect(graphics.setVisible).toHaveBeenLastCalledWith(true);
  });

  it('emits sfx:heartbeat after accumulating enough delta', () => {
    const { deps } = makeDeps({ floorAU: 0 });
    const manager = new LevelCheckpointManager(deps);
    manager.setPlayer(makePlayer());
    manager.createDangerVignette();
    manager.onPlayerHit();
    manager.onPlayerHit();
    // 850ms interval — drive it over in two calls
    manager.updateDangerState(500);
    manager.updateDangerState(400);
    expect(emit).toHaveBeenCalledWith('sfx:heartbeat');
  });
});
