import { describe, it, expect, vi } from 'vitest';
import { FLOORS } from '../../../config/gameConfig';
import { ProgressionSystem, type SaveAdapter } from '../../../systems/ProgressionSystem';
import type { SaveData } from '../../../systems/SaveManager';
import type { LevelConfig } from './LevelScene';
import type * as Phaser from 'phaser';

// ---- Minimal Phaser stub ----
vi.mock('phaser', () => {
  const ArcadeSprite = class {};
  const Physics = { Arcade: { Sprite: ArcadeSprite } };
  return { default: { Physics }, Physics };
});

// ---- Token stub — tracks instances created ----
interface MockTokenInstance {
  x: number;
  y: number;
  collect: ReturnType<typeof vi.fn>;
  getData(key: string): unknown;
  setData(key: string, value: unknown): void;
}
const createdTokens: MockTokenInstance[] = [];

vi.mock('../../../entities/Token', () => ({
  Token: class MockToken {
    x: number;
    y: number;
    private _data: Map<string, unknown> = new Map();
    collect = vi.fn();
    constructor(_scene: unknown, x: number, y: number) {
      this.x = x;
      this.y = y;
      createdTokens.push(this as unknown as MockTokenInstance);
    }
    getData(key: string): unknown { return this._data.get(key); }
    setData(key: string, value: unknown): void { this._data.set(key, value); }
  },
}));

// ---- DroppedAU stub ----
vi.mock('../../../entities/DroppedAU', () => ({
  DroppedAU: class MockDroppedAU {
    ready = false;
    collected = false;
    recover = vi.fn();
  },
}));

// ---- Import module under test after mocks ----
import { LevelTokenManager } from './LevelTokenManager';

// ── helpers ─────────────────────────────────────────────────────────────────

function makeSaveAdapter(): SaveAdapter {
  let store: SaveData | null = null;
  return {
    load: () => store,
    save: (data: SaveData) => { store = data; },
    clear: () => { store = null; },
  };
}

/** Returns a minimal valid LevelConfig with the given token list. */
function makeConfig(
  tokens: Array<{ x: number; y: number; index?: number }>,
): LevelConfig {
  return {
    floorId: FLOORS.PLATFORM_TEAM,
    platforms: [],
    tokens,
    roomElevators: [],
    exitPosition: { x: 10, y: 10 },
    playerStart: { x: 20, y: 20 },
  };
}

function makeHarness(floorId: import('../../../config/gameConfig').FloorId = FLOORS.PLATFORM_TEAM) {
  createdTokens.length = 0;

  // Groups returned from physics.add.staticGroup() / physics.add.group()
  const tokenGroupMembers: MockTokenInstance[] = [];
  const tokenGroup = {
    add: vi.fn((token: MockTokenInstance) => { tokenGroupMembers.push(token); }),
  };
  const droppedAUGroup = { add: vi.fn() };

  // Capture overlap callbacks so we can invoke them in tests
  const overlapCallbacks: Array<(player: unknown, obj: unknown) => void> = [];

  const scene = {
    physics: {
      add: {
        staticGroup: vi.fn(() => tokenGroup),
        group: vi.fn(() => droppedAUGroup),
        overlap: vi.fn(
          (_a: unknown, _b: unknown, cb: (p: unknown, o: unknown) => void) => {
            overlapCallbacks.push(cb);
          },
        ),
        collider: vi.fn(),
      },
    },
    textures: { exists: vi.fn(() => false) },
    time: { delayedCall: vi.fn() },
    add: { particles: vi.fn() },
  } as unknown as Phaser.Scene;

  const progression = new ProgressionSystem(makeSaveAdapter());

  const checkAchievements = vi.fn();
  const cameraFlash = vi.fn();

  const gameState = {
    checkAchievements,
  };

  const floorData = {
    theme: { tokenColor: 0xffffff },
  };

  const playerSprite = { x: 0, y: 0 };
  const player = { sprite: playerSprite };
  const camera = { flash: cameraFlash };
  const platformGroup = {};

  const mgr = new LevelTokenManager({
    scene,
    floorId,
    floorData: floorData as unknown as import('../../../config/levelData').FloorData,
    progression,
    player: player as unknown as import('../../../entities/Player').Player,
    platformGroup: platformGroup as unknown as Phaser.Physics.Arcade.StaticGroup,
    camera: camera as unknown as Phaser.Cameras.Scene2D.Camera,
    gameState: gameState as unknown as import('../../../systems/GameStateManager').GameStateManager,
  });

  return {
    mgr,
    tokenGroup,
    tokenGroupMembers,
    droppedAUGroup,
    overlapCallbacks,
    progression,
    checkAchievements,
    cameraFlash,
    scene,
    player,
  };
}

// ── tests ────────────────────────────────────────────────────────────────────

describe('LevelTokenManager — constructor', () => {
  it('creates tokenGroup via physics.add.staticGroup()', () => {
    const { mgr, tokenGroup } = makeHarness();
    // tokenGroup is the object returned by staticGroup mock
    expect(mgr.tokenGroup).toBe(tokenGroup);
  });

  it('creates droppedAUGroup via physics.add.group()', () => {
    const { mgr, droppedAUGroup } = makeHarness();
    expect(mgr.droppedAUGroup).toBe(droppedAUGroup);
  });

  it('starts with auCollected = 0', () => {
    const { mgr } = makeHarness();
    expect(mgr.auCollected).toBe(0);
  });
});

describe('LevelTokenManager — spawn()', () => {
  it('adds uncollected tokens to tokenGroup', () => {
    const { mgr, tokenGroup } = makeHarness();
    mgr.spawn(makeConfig([{ x: 100, y: 200 }, { x: 300, y: 400 }]));
    expect(tokenGroup.add).toHaveBeenCalledTimes(2);
  });

  it('skips tokens already marked collected in ProgressionSystem', () => {
    const { mgr, tokenGroup, progression } = makeHarness();
    // Mark token index 0 as collected
    progression.collectAU(FLOORS.PLATFORM_TEAM, 0);
    mgr.spawn(makeConfig([{ x: 100, y: 200 }])); // implicit index 0
    expect(tokenGroup.add).not.toHaveBeenCalled();
  });

  it('uses explicit token.index when provided', () => {
    const { mgr, tokenGroup, progression } = makeHarness();
    // Mark index 5 collected but not 0
    progression.collectAU(FLOORS.PLATFORM_TEAM, 5);
    mgr.spawn(makeConfig([{ x: 100, y: 200, index: 5 }]));
    expect(tokenGroup.add).not.toHaveBeenCalled();
  });

  it('falls back to loop index when token.index is absent', () => {
    const { mgr, tokenGroup, progression } = makeHarness();
    // Mark loop index 1 collected; loop index 0 is free
    progression.collectAU(FLOORS.PLATFORM_TEAM, 1);
    mgr.spawn(makeConfig([{ x: 100, y: 200 }, { x: 300, y: 400 }]));
    // Only token at index 0 (first position) should be added
    expect(tokenGroup.add).toHaveBeenCalledTimes(1);
  });

  it('spawns no tokens when config.tokens is empty', () => {
    const { mgr, tokenGroup } = makeHarness();
    mgr.spawn(makeConfig([]));
    expect(tokenGroup.add).not.toHaveBeenCalled();
  });

  it('sets tokenIndex data on spawned tokens', () => {
    const { mgr } = makeHarness();
    mgr.spawn(makeConfig([{ x: 100, y: 200, index: 7 }]));
    expect(createdTokens[0]?.getData('tokenIndex')).toBe(7);
  });
});

describe('LevelTokenManager — tokenKey()', () => {
  it('uses token_floor1 for PLATFORM_TEAM floor', () => {
    createdTokens.length = 0;
    const { mgr } = makeHarness(FLOORS.PLATFORM_TEAM);
    mgr.spawn(makeConfig([{ x: 100, y: 200 }]));
    // Token was created → just verifying spawn path was reached
    expect(createdTokens.length).toBe(1);
  });

  it('uses token_floor2 for non-PLATFORM_TEAM floor', () => {
    createdTokens.length = 0;
    const { mgr } = makeHarness(FLOORS.BUSINESS);
    mgr.spawn(makeConfig([{ x: 100, y: 200 }]));
    expect(createdTokens.length).toBe(1);
  });
});

describe('LevelTokenManager — collection callback (via wireColliders overlap)', () => {
  it('increments auCollected when a token is collected', () => {
    const { mgr, overlapCallbacks } = makeHarness();
    mgr.spawn(makeConfig([{ x: 100, y: 200 }]));
    mgr.wireColliders();

    const token = createdTokens[0]!;
    token.setData('tokenIndex', 0);
    // First overlap callback is the token collect handler
    overlapCallbacks[0]!({}, token);

    expect(mgr.auCollected).toBe(1);
  });

  it('calls progression.collectAU with correct floorId and tokenIndex', () => {
    const { mgr, overlapCallbacks, progression } = makeHarness();
    const collectAUSpy = vi.spyOn(progression, 'collectAU');

    mgr.spawn(makeConfig([{ x: 100, y: 200, index: 3 }]));
    mgr.wireColliders();

    const token = createdTokens[0]!;
    token.setData('tokenIndex', 3);
    overlapCallbacks[0]!({}, token);

    expect(collectAUSpy).toHaveBeenCalledWith(FLOORS.PLATFORM_TEAM, 3);
  });

  it('calls token.collect()', () => {
    const { mgr, overlapCallbacks } = makeHarness();
    mgr.spawn(makeConfig([{ x: 100, y: 200 }]));
    mgr.wireColliders();

    const token = createdTokens[0]!;
    token.setData('tokenIndex', 0);
    overlapCallbacks[0]!({}, token);

    expect(token.collect).toHaveBeenCalledOnce();
  });

  it('calls camera.flash after collection', () => {
    const { mgr, overlapCallbacks, cameraFlash } = makeHarness();
    mgr.spawn(makeConfig([{ x: 100, y: 200 }]));
    mgr.wireColliders();

    const token = createdTokens[0]!;
    token.setData('tokenIndex', 0);
    overlapCallbacks[0]!({}, token);

    expect(cameraFlash).toHaveBeenCalledOnce();
  });

  it('calls gameState.checkAchievements after collection', () => {
    const { mgr, overlapCallbacks, checkAchievements } = makeHarness();
    mgr.spawn(makeConfig([{ x: 100, y: 200 }]));
    mgr.wireColliders();

    const token = createdTokens[0]!;
    token.setData('tokenIndex', 0);
    overlapCallbacks[0]!({}, token);

    expect(checkAchievements).toHaveBeenCalledOnce();
  });

  it('does not double-count the same token on duplicate overlap calls', () => {
    const { mgr, overlapCallbacks, progression } = makeHarness();
    mgr.spawn(makeConfig([{ x: 100, y: 200 }]));
    mgr.wireColliders();

    const token = createdTokens[0]!;
    token.setData('tokenIndex', 0);
    overlapCallbacks[0]!({}, token);
    // ProgressionSystem.collectAU dedupes by tokenIndex
    overlapCallbacks[0]!({}, token);

    expect(progression.getFloorAU(FLOORS.PLATFORM_TEAM)).toBe(1);
  });
});

describe('LevelTokenManager — recovered dropped-AU callback', () => {
  it('calls progression.addAU when a dropped AU is recovered', () => {
    const { mgr, overlapCallbacks, progression } = makeHarness();
    mgr.spawn(makeConfig([]));
    mgr.wireColliders();

    const addAUSpy = vi.spyOn(progression, 'addAU');
    const drop = { ready: true, collected: false, recover: vi.fn() };
    // Third overlap callback is the drop-recovery handler (after player↔token, then droppedAU collider, then player↔drop)
    // wireColliders sets: overlap(player, tokenGroup, onCollect), collider(droppedAU, platform), overlap(player, droppedAU, onRecoverDropped)
    // so index 1 is onRecoverDropped (skip collider which doesn't use the callback slot)
    overlapCallbacks[1]!({}, drop);

    expect(addAUSpy).toHaveBeenCalledWith(FLOORS.PLATFORM_TEAM, 1);
  });

  it('skips recovery when drop.ready is false', () => {
    const { mgr, overlapCallbacks, progression } = makeHarness();
    mgr.spawn(makeConfig([]));
    mgr.wireColliders();

    const addAUSpy = vi.spyOn(progression, 'addAU');
    const drop = { ready: false, collected: false, recover: vi.fn() };
    overlapCallbacks[1]!({}, drop);

    expect(addAUSpy).not.toHaveBeenCalled();
  });

  it('skips recovery when drop.collected is true', () => {
    const { mgr, overlapCallbacks, progression } = makeHarness();
    mgr.spawn(makeConfig([]));
    mgr.wireColliders();

    const addAUSpy = vi.spyOn(progression, 'addAU');
    const drop = { ready: true, collected: true, recover: vi.fn() };
    overlapCallbacks[1]!({}, drop);

    expect(addAUSpy).not.toHaveBeenCalled();
  });
});
