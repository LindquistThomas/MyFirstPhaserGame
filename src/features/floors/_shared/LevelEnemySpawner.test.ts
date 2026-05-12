import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FLOORS } from '../../../config/gameConfig';
import type { LevelConfig } from './LevelScene';
import type * as Phaser from 'phaser';

// ---- Minimal Phaser stub ----
vi.mock('phaser', () => {
  const ArcadeSprite = class {};
  const Physics = { Arcade: { Sprite: ArcadeSprite } };
  return { default: { Physics }, Physics };
});

// ---- Enemy stubs — track which class was instantiated ----
const lastCreated: { type: string; x: number; y: number; opts: unknown } = {
  type: '',
  x: 0,
  y: 0,
  opts: {},
};

function makeEnemyClass(type: string) {
  return class MockEnemy {
    defeated = false;
    canBeStomped = false;
    collidesWithLevel = false;
    hitCost = 1;
    knockbackX = 200;
    knockbackY = -300;
    x: number;
    y: number;
    active = true;
    body: { enable: boolean } = { enable: true };
    setActive = vi.fn((v: boolean) => { this.active = v; });
    update = vi.fn();
    onStomp = vi.fn();

    constructor(_scene: unknown, x: number, y: number, opts: unknown) {
      lastCreated.type = type;
      lastCreated.x = x;
      lastCreated.y = y;
      lastCreated.opts = opts;
      this.x = x;
      this.y = y;
    }
  };
}

vi.mock('../../../entities/enemies/Slime', () => ({ Slime: makeEnemyClass('slime') }));
vi.mock('../../../entities/enemies/BureaucracyBot', () => ({ BureaucracyBot: makeEnemyClass('bot') }));
vi.mock('../../../entities/enemies/ScopeCreep', () => ({ ScopeCreep: makeEnemyClass('scope-creep') }));
vi.mock('../../../entities/enemies/ArchitectureAstronaut', () => ({
  ArchitectureAstronaut: makeEnemyClass('astronaut'),
}));
vi.mock('../../../entities/enemies/TechDebtGhost', () => ({
  TechDebtGhost: makeEnemyClass('tech-debt-ghost'),
}));
vi.mock('../../../entities/enemies/TerroristCommander', () => ({
  TerroristCommander: makeEnemyClass('terrorist'),
}));

// DroppedAU referenced by applyHit
const droppedAUConstructorSpy = vi.fn();
vi.mock('../../../entities/DroppedAU', () => ({
  DroppedAU: class MockDroppedAU {
    active = true;
    reset = vi.fn();
    constructor() {
      droppedAUConstructorSpy();
    }
  },
}));

vi.mock('../../../systems/EventBus', () => ({
  eventBus: { emit: vi.fn(), on: vi.fn(), off: vi.fn() },
}));

vi.mock('../../../systems/MotionPreference', () => ({
  isReducedMotion: vi.fn(() => false),
}));

import { LevelEnemySpawner, OFFSCREEN_ENEMY_MARGIN_PX } from './LevelEnemySpawner';
import { DroppedAU } from '../../../entities/DroppedAU';
import { ProgressionSystem, type SaveAdapter } from '../../../systems/ProgressionSystem';
import type { SaveData } from '../../../systems/SaveManager';
import type { WorldModifiers } from '../../../systems/WorldModifiers';

// ── helpers ─────────────────────────────────────────────────────────────────

function makeSaveAdapter(): SaveAdapter {
  let store: SaveData | null = null;
  return {
    load: () => store,
    save: (data: SaveData) => { store = data; },
    clear: () => { store = null; },
  };
}

function makeHarness(cameraWorldView?: { left: number; right: number; top: number; bottom: number }) {
  const overlapCallbacks: Array<(player: unknown, enemy: unknown) => void> = [];
  const colliderArgs: unknown[][] = [];
  const progression = new ProgressionSystem(makeSaveAdapter());

  const worldView = cameraWorldView ?? { left: 0, right: 800, top: 0, bottom: 600 };

  const scene = {
    physics: {
      add: {
        overlap: vi.fn((_a: unknown, _b: unknown, cb: (p: unknown, e: unknown) => void) => {
          overlapCallbacks.push(cb);
        }),
        collider: vi.fn((...args: unknown[]) => { colliderArgs.push(args); }),
        group: vi.fn(() => ({ add: vi.fn() })),
      },
    },
    cameras: {
      main: { worldView },
    },
  } as unknown as Phaser.Scene;

  const playerSprite = {
    x: 0,
    y: 0,
    body: { bottom: 0, velocity: { y: 0 } },
    setVelocityY: vi.fn(),
  };
  const player = {
    sprite: playerSprite,
    isInvulnerable: vi.fn(() => false),
    getIsFlipping: vi.fn(() => false),
    takeHit: vi.fn(),
  };

  const cameraShake = vi.fn();
  const camera = { shake: cameraShake };
  const platformGroup = {};
  const droppedAUPool: Array<{ active: boolean; reset: ReturnType<typeof vi.fn> }> = [];
  const droppedAUGroup = {
    get: vi.fn(() => {
      const inactive = droppedAUPool.find((drop) => !drop.active);
      if (inactive) {
        inactive.active = true;
        return inactive;
      }
      if (droppedAUPool.length >= 32) return null;
      const Ctor = DroppedAU as unknown as new () => { active: boolean; reset: ReturnType<typeof vi.fn> };
      const created = new Ctor();
      created.active = true;
      droppedAUPool.push(created);
      return created;
    }),
    killAndHide: vi.fn((drop: { active: boolean }) => {
      drop.active = false;
    }),
  };

  const spawner = new LevelEnemySpawner({
    scene,
    floorId: FLOORS.PLATFORM_TEAM,
    progression,
    player: player as unknown as import('../../../entities/Player').Player,
    platformGroup: platformGroup as unknown as Phaser.Physics.Arcade.StaticGroup,
    droppedAUGroup: droppedAUGroup as unknown as Phaser.Physics.Arcade.Group,
    camera: camera as unknown as Phaser.Cameras.Scene2D.Camera,
    worldModifiers,
  });

  return { spawner, overlapCallbacks, colliderArgs, player, camera, progression, droppedAUGroup, droppedAUPool };
}

function enemyEntry(
  type: NonNullable<LevelConfig['enemies']>[number]['type'],
  x = 500,
  y = 800,
  overrides: Partial<{ minX: number; maxX: number; speed: number }> = {},
): NonNullable<LevelConfig['enemies']>[number] {
  return { type, x, y, ...overrides };
}

function makeConfig(
  enemies: NonNullable<LevelConfig['enemies']>,
): LevelConfig {
  return {
    enemies,
    floorId: FLOORS.PLATFORM_TEAM,
    platforms: [],
    tokens: [],
    roomElevators: [],
    exitPosition: { x: 10, y: 10 },
    playerStart: { x: 20, y: 20 },
  };
}

// ── tests ────────────────────────────────────────────────────────────────────

describe('LevelEnemySpawner — spawn()', () => {
  beforeEach(() => {
    droppedAUConstructorSpy.mockClear();
    lastCreated.type = '';
    lastCreated.x = 0;
    lastCreated.y = 0;
    lastCreated.opts = {};
  });

  it('leaves enemies array empty when config has no enemies', () => {
    const { spawner } = makeHarness();
    spawner.spawn(makeConfig([]));
    expect(spawner.enemies).toHaveLength(0);
  });

  it('leaves enemies array empty when enemies key is absent', () => {
    const { spawner } = makeHarness();
    spawner.spawn({
      floorId: FLOORS.PLATFORM_TEAM,
      platforms: [],
      tokens: [],
      roomElevators: [],
      exitPosition: { x: 10, y: 10 },
      playerStart: { x: 20, y: 20 },
    });
    expect(spawner.enemies).toHaveLength(0);
  });

  it('spawns a Slime for type="slime"', () => {
    const { spawner } = makeHarness();
    spawner.spawn(makeConfig([enemyEntry('slime')]));
    expect(lastCreated.type).toBe('slime');
    expect(spawner.enemies).toHaveLength(1);
  });

  it('spawns a BureaucracyBot for type="bot"', () => {
    const { spawner } = makeHarness();
    spawner.spawn(makeConfig([enemyEntry('bot')]));
    expect(lastCreated.type).toBe('bot');
  });

  it('spawns a ScopeCreep for type="scope-creep"', () => {
    const { spawner } = makeHarness();
    spawner.spawn(makeConfig([enemyEntry('scope-creep')]));
    expect(lastCreated.type).toBe('scope-creep');
  });

  it('spawns an ArchitectureAstronaut for type="astronaut"', () => {
    const { spawner } = makeHarness();
    spawner.spawn(makeConfig([enemyEntry('astronaut')]));
    expect(lastCreated.type).toBe('astronaut');
  });

  it('spawns a TechDebtGhost for type="tech-debt-ghost"', () => {
    const { spawner } = makeHarness();
    spawner.spawn(makeConfig([enemyEntry('tech-debt-ghost')]));
    expect(lastCreated.type).toBe('tech-debt-ghost');
  });

  it('spawns a TerroristCommander for type="terrorist"', () => {
    const { spawner } = makeHarness();
    spawner.spawn(makeConfig([enemyEntry('terrorist')]));
    expect(lastCreated.type).toBe('terrorist');
  });

  it('spawns multiple enemies when multiple entries are provided', () => {
    const { spawner } = makeHarness();
    spawner.spawn(makeConfig([enemyEntry('slime'), enemyEntry('bot'), enemyEntry('scope-creep')]));
    expect(spawner.enemies).toHaveLength(3);
  });
});

describe('LevelEnemySpawner — dropped AU pooling', () => {
  beforeEach(() => {
    droppedAUConstructorSpy.mockClear();
  });

  it('uses group.get() and reset() when dropping AU after a hit', () => {
    const { spawner, progression, droppedAUGroup } = makeHarness();
    progression.addAU(FLOORS.PLATFORM_TEAM, 3);
    const enemy = { hitCost: 3, knockbackX: 200, knockbackY: -300, x: 100 };

    (spawner as unknown as { applyHit: (enemyObj: unknown) => void }).applyHit(enemy);

    expect(droppedAUGroup.get).toHaveBeenCalledTimes(3);
    const createdDrops = droppedAUGroup.get.mock.results
      .map((result: { value: unknown }) => result.value)
      .filter((value: unknown): value is { reset: ReturnType<typeof vi.fn> } => value !== null);
    for (const drop of createdDrops) {
      expect(drop.reset).toHaveBeenCalledTimes(1);
    }
  });

  it('caps constructor allocations to the pool max size during 100 drops', () => {
    const { spawner, progression, droppedAUPool } = makeHarness();
    progression.addAU(FLOORS.PLATFORM_TEAM, 100);
    const enemy = { hitCost: 100, knockbackX: 200, knockbackY: -300, x: 100 };

    (spawner as unknown as { applyHit: (enemyObj: unknown) => void }).applyHit(enemy);

    expect(droppedAUPool).toHaveLength(32);
    expect(droppedAUConstructorSpy).toHaveBeenCalledTimes(32);
  });
});

describe('LevelEnemySpawner — minX/maxX defaults', () => {
  beforeEach(() => { lastCreated.opts = {}; });

  it('defaults minX to x - 160 when not provided', () => {
    const { spawner } = makeHarness();
    spawner.spawn(makeConfig([enemyEntry('slime', 500)]));
    expect((lastCreated.opts as { minX: number }).minX).toBe(340); // 500 - 160
  });

  it('defaults maxX to x + 160 when not provided', () => {
    const { spawner } = makeHarness();
    spawner.spawn(makeConfig([enemyEntry('slime', 500)]));
    expect((lastCreated.opts as { maxX: number }).maxX).toBe(660); // 500 + 160
  });

  it('uses explicit minX when provided', () => {
    const { spawner } = makeHarness();
    spawner.spawn(makeConfig([enemyEntry('slime', 500, 800, { minX: 200 })]));
    expect((lastCreated.opts as { minX: number }).minX).toBe(200);
  });

  it('uses explicit maxX when provided', () => {
    const { spawner } = makeHarness();
    spawner.spawn(makeConfig([enemyEntry('slime', 500, 800, { maxX: 900 })]));
    expect((lastCreated.opts as { maxX: number }).maxX).toBe(900);
  });

  it('passes speed through when provided', () => {
    const { spawner } = makeHarness();
    spawner.spawn(makeConfig([enemyEntry('slime', 500, 800, { speed: 80 })]));
    expect((lastCreated.opts as { speed: number }).speed).toBe(80);
  });

  it('uses built-in default speed when speed is not provided', () => {
    const { spawner } = makeHarness();
    spawner.spawn(makeConfig([enemyEntry('slime')]));
    expect((lastCreated.opts as { speed: number }).speed).toBe(50);
  });

  it('applies enemy speed multiplier from world modifiers', () => {
    const { spawner } = makeHarness({
      enemySpeedMultiplier: 1.25,
      enemyContactDamageMultiplier: 1,
      bossHpMultiplier: 1,
      hardQuizOnly: false,
    });
    spawner.spawn(makeConfig([enemyEntry('slime', 500, 800, { speed: 80 })]));
    expect((lastCreated.opts as { speed: number }).speed).toBe(100);
  });

  it('applies enemy contact-damage multiplier from world modifiers', () => {
    const { spawner } = makeHarness({
      enemySpeedMultiplier: 1,
      enemyContactDamageMultiplier: 1.5,
      bossHpMultiplier: 1,
      hardQuizOnly: false,
    });
    spawner.spawn(makeConfig([enemyEntry('slime')]));
    expect(spawner.enemies[0]?.hitCost).toBe(2);
  });
});

describe('LevelEnemySpawner — wireColliders()', () => {
  it('does nothing when enemies array is empty', () => {
    const { spawner, overlapCallbacks } = makeHarness();
    spawner.wireColliders();
    expect(overlapCallbacks).toHaveLength(0);
  });

  it('registers a player↔enemy overlap when enemies are present', () => {
    const { spawner, overlapCallbacks } = makeHarness();
    spawner.spawn(makeConfig([enemyEntry('slime')]));
    spawner.wireColliders();
    // One overlap callback registered (player vs. enemies array)
    expect(overlapCallbacks.length).toBeGreaterThanOrEqual(1);
  });
});

describe('LevelEnemySpawner — update()', () => {
  it('calls update() on each non-defeated enemy', () => {
    const { spawner } = makeHarness();
    spawner.spawn(makeConfig([enemyEntry('slime'), enemyEntry('bot')]));
    spawner.update(1000, 16);
    for (const enemy of spawner.enemies) {
      expect((enemy as unknown as { update: ReturnType<typeof vi.fn> }).update).toHaveBeenCalledWith(1000, 16);
    }
  });

  it('skips defeated enemies', () => {
    const { spawner } = makeHarness();
    spawner.spawn(makeConfig([enemyEntry('slime')]));
    const enemy = spawner.enemies[0]!;
    (enemy as { defeated: boolean }).defeated = true;
    spawner.update(1000, 16);
    expect((enemy as unknown as { update: ReturnType<typeof vi.fn> }).update).not.toHaveBeenCalled();
  });

  it('calls update() on an on-screen enemy and not on an off-screen enemy', () => {
    // Camera worldView: left=0, right=800, top=0, bottom=600
    // Margin=256, so active zone: x in [-256, 1056], y in [-256, 856]
    // on-screen enemy at (400, 300) — well inside
    // off-screen enemy at (2000, 300) — far outside right edge
    const onScreenX = 400;
    const offScreenX = 2000;
    const spawner = makeHarness().spawner;
    spawner.spawn(makeConfig([
      enemyEntry('slime', onScreenX, 300),
      enemyEntry('bot', offScreenX, 300),
    ]));

    spawner.update(0, 16);

    const [onEnemy, offEnemy] = spawner.enemies as unknown as Array<{
      update: ReturnType<typeof vi.fn>;
      active: boolean;
      body: { enable: boolean };
      setActive: ReturnType<typeof vi.fn>;
    }>;

    expect(onEnemy!.update).toHaveBeenCalledWith(0, 16);
    expect(offEnemy!.update).not.toHaveBeenCalled();
    expect(offEnemy!.active).toBe(false);
    expect(offEnemy!.body.enable).toBe(false);
  });

  it('re-enables physics body and resumes update() when off-screen enemy comes back on-screen', () => {
    // Start with enemy off-screen
    const spawner = makeHarness({ left: 0, right: 800, top: 0, bottom: 600 }).spawner;
    spawner.spawn(makeConfig([enemyEntry('slime', 2000, 300)]));
    spawner.update(0, 16);

    const enemy = spawner.enemies[0] as unknown as {
      update: ReturnType<typeof vi.fn>;
      active: boolean;
      body: { enable: boolean };
      setActive: ReturnType<typeof vi.fn>;
      x: number;
    };

    expect(enemy.active).toBe(false);
    expect(enemy.body.enable).toBe(false);

    // Move enemy on-screen and update again
    enemy.x = 400;
    enemy.update.mockClear();
    spawner.update(16, 16);

    expect(enemy.active).toBe(true);
    expect(enemy.body.enable).toBe(true);
    expect(enemy.update).toHaveBeenCalledWith(16, 16);
  });

  it('exports OFFSCREEN_ENEMY_MARGIN_PX as 256', () => {
    expect(OFFSCREEN_ENEMY_MARGIN_PX).toBe(256);
  });
});
