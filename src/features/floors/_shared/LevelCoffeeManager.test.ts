import { beforeEach, describe, expect, it, vi } from 'vitest';
import type * as Phaser from 'phaser';
import type { LevelConfig } from './LevelScene';

vi.mock('phaser', () => ({ default: {} }));

const reducedMotionState = vi.hoisted(() => ({ value: false }));
vi.mock('../../../systems/MotionPreference', () => ({
  isReducedMotion: vi.fn(() => reducedMotionState.value),
}));

const eventBusEmit = vi.hoisted(() => vi.fn());
vi.mock('../../../systems/EventBus', () => ({
  eventBus: { emit: eventBusEmit },
}));

interface MockCoffee {
  x: number;
  y: number;
  collect: ReturnType<typeof vi.fn>;
}
const createdCoffees: MockCoffee[] = [];
vi.mock('../../../entities/Coffee', () => ({
  Coffee: class MockCoffeeImpl {
    collect = vi.fn();
    constructor(
      _scene: unknown,
      public x: number,
      public y: number,
    ) {
      createdCoffees.push(this as unknown as MockCoffee);
    }
  },
}));

import { LevelCoffeeManager } from './LevelCoffeeManager';

beforeEach(() => {
  reducedMotionState.value = false;
  eventBusEmit.mockReset();
  createdCoffees.length = 0;
});

function makeConfig(coffees: Array<{ x: number; y: number }>): LevelConfig {
  return {
    floorId: 'platform-team',
    playerStart: { x: 0, y: 0 },
    exitPosition: { x: 0, y: 0 },
    platforms: [],
    tokens: [],
    roomElevators: [],
    coffees,
  } as unknown as LevelConfig;
}

function makeHarness(options?: { hasParticleTexture?: boolean }) {
  const overlapCalls: Array<(player: unknown, mug: unknown) => void> = [];
  const emitter = {
    emitParticleAt: vi.fn(),
    setDepth: vi.fn(),
    destroy: vi.fn(),
  };
  const sceneEventHandlers: Record<string, Array<() => void>> = {};

  const coffeeGroup = { add: vi.fn() };
  const scene = {
    physics: {
      add: {
        staticGroup: vi.fn(() => coffeeGroup),
        overlap: vi.fn((_a: unknown, _b: unknown, cb: (p: unknown, m: unknown) => void) => overlapCalls.push(cb)),
      },
    },
    textures: { exists: vi.fn(() => options?.hasParticleTexture ?? false) },
    add: {
      particles: vi.fn(() => emitter),
    },
    events: {
      once: vi.fn((event: string, cb: () => void) => {
        if (!sceneEventHandlers[event]) sceneEventHandlers[event] = [];
        sceneEventHandlers[event]!.push(cb);
      }),
    },
  } as unknown as Phaser.Scene;

  const player = {
    sprite: {},
    applyCaffeine: vi.fn(),
  } as unknown as import('../../../entities/Player').Player;

  const mgr = new LevelCoffeeManager({ scene, player });
  return { mgr, scene, player, emitter, sceneEventHandlers, overlapCalls, coffeeGroup };
}

describe('LevelCoffeeManager emitter pooling', () => {
  it('creates one pooled emitter in constructor', () => {
    const { scene } = makeHarness({ hasParticleTexture: true });
    expect(scene.add.particles).toHaveBeenCalledTimes(1);
  });

  it('does not allocate emitter when reduced motion is enabled', () => {
    reducedMotionState.value = true;
    const { scene } = makeHarness({ hasParticleTexture: true });
    expect(scene.add.particles).not.toHaveBeenCalled();
  });

  it('reuses emitter for multiple coffee pickups', () => {
    const { mgr, scene, emitter, overlapCalls } = makeHarness({ hasParticleTexture: true });
    mgr.spawn(makeConfig([{ x: 10, y: 20 }, { x: 30, y: 40 }]));
    mgr.wireColliders();

    overlapCalls[0]!({}, createdCoffees[0]);
    overlapCalls[0]!({}, createdCoffees[1]);

    expect(scene.add.particles).toHaveBeenCalledTimes(1);
    expect(emitter.emitParticleAt).toHaveBeenCalledTimes(2);
  });

  it('destroys pooled emitter on scene shutdown', () => {
    const { emitter, sceneEventHandlers } = makeHarness({ hasParticleTexture: true });
    sceneEventHandlers.shutdown?.forEach(cb => cb());
    expect(emitter.destroy).toHaveBeenCalledTimes(1);
  });
});
