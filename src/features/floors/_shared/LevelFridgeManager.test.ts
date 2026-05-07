import { beforeEach, describe, expect, it, vi } from 'vitest';
import type * as Phaser from 'phaser';
import type { LevelConfig } from './LevelScene';

vi.mock('phaser', () => ({
  default: {
    Math: {
      Distance: {
        Between: (x1: number, y1: number, x2: number, y2: number) => Math.hypot(x1 - x2, y1 - y2),
      },
    },
  },
  Math: {
    Distance: {
      Between: (x1: number, y1: number, x2: number, y2: number) => Math.hypot(x1 - x2, y1 - y2),
    },
  },
}));

const reducedMotionState = vi.hoisted(() => ({ value: false }));
vi.mock('../../../systems/MotionPreference', () => ({
  isReducedMotion: vi.fn(() => reducedMotionState.value),
}));

const eventBusEmit = vi.hoisted(() => vi.fn());
vi.mock('../../../systems/EventBus', () => ({
  eventBus: { emit: eventBusEmit },
}));

vi.mock('../../../input', () => ({
  allKeyLabels: vi.fn(() => 'E'),
}));

interface MockFridge {
  x: number;
  y: number;
  displayHeight: number;
  opened: boolean;
  open: ReturnType<typeof vi.fn>;
}
const createdFridges: MockFridge[] = [];
vi.mock('../../../entities/EnergyDrinkFridge', () => ({
  ENERGY_DRINK_DURATION_MS: 15000,
  EnergyDrinkFridge: class MockFridgeImpl {
    displayHeight = 48;
    opened = false;
    open = vi.fn(() => {
      this.opened = true;
    });
    constructor(
      _scene: unknown,
      public x: number,
      public y: number,
    ) {
      createdFridges.push(this as unknown as MockFridge);
    }
  },
}));

import { LevelFridgeManager } from './LevelFridgeManager';

beforeEach(() => {
  reducedMotionState.value = false;
  eventBusEmit.mockReset();
  createdFridges.length = 0;
});

function makeConfig(fridges: Array<{ x: number; y: number }>): LevelConfig {
  return {
    floorId: 'platform-team',
    playerStart: { x: 0, y: 0 },
    exitPosition: { x: 0, y: 0 },
    platforms: [],
    tokens: [],
    roomElevators: [],
    fridges,
  } as unknown as LevelConfig;
}

function makeHarness(options?: { hasParticleTexture?: boolean; justPressed?: boolean }) {
  const emitter = {
    emitParticleAt: vi.fn(),
    setDepth: vi.fn(),
    destroy: vi.fn(),
  };
  const sceneEventHandlers: Record<string, Array<() => void>> = {};
  const prompt = {
    setDepth: vi.fn(() => prompt),
    setVisible: vi.fn(() => prompt),
    setText: vi.fn(() => prompt),
    setPosition: vi.fn(() => prompt),
  };

  const playerSprite = { x: 0, y: 0 };
  const scene = {
    add: {
      text: vi.fn(() => prompt),
      particles: vi.fn(() => emitter),
    },
    textures: { exists: vi.fn(() => options?.hasParticleTexture ?? false) },
    events: {
      once: vi.fn((event: string, cb: () => void) => {
        if (!sceneEventHandlers[event]) sceneEventHandlers[event] = [];
        sceneEventHandlers[event]!.push(cb);
      }),
    },
    inputs: {
      justPressed: vi.fn(() => options?.justPressed ?? false),
    },
  } as unknown as Phaser.Scene;

  const player = {
    sprite: playerSprite,
    applyCaffeine: vi.fn(),
  } as unknown as import('../../../entities/Player').Player;

  const mgr = new LevelFridgeManager({ scene, player });
  return { mgr, scene, player, playerSprite, prompt, emitter, sceneEventHandlers };
}

describe('LevelFridgeManager emitter pooling', () => {
  it('creates one pooled emitter in constructor', () => {
    const { scene } = makeHarness({ hasParticleTexture: true });
    expect(scene.add.particles).toHaveBeenCalledTimes(1);
  });

  it('does not allocate emitter when reduced motion is enabled', () => {
    reducedMotionState.value = true;
    const { scene } = makeHarness({ hasParticleTexture: true });
    expect(scene.add.particles).not.toHaveBeenCalled();
  });

  it('reuses emitter when opening fridges', () => {
    const { mgr, scene, emitter, playerSprite } = makeHarness({ hasParticleTexture: true, justPressed: true });
    mgr.spawn(makeConfig([{ x: 20, y: 30 }, { x: 30, y: 40 }]));

    playerSprite.x = 20;
    playerSprite.y = 30;
    mgr.update();
    playerSprite.x = 30;
    playerSprite.y = 40;
    mgr.update();

    expect(scene.add.particles).toHaveBeenCalledTimes(1);
    expect(emitter.emitParticleAt).toHaveBeenCalledTimes(2);
    expect(createdFridges[0]?.open).toHaveBeenCalledTimes(1);
    expect(createdFridges[1]?.open).toHaveBeenCalledTimes(1);
  });

  it('destroys pooled emitter on scene shutdown', () => {
    const { emitter, sceneEventHandlers } = makeHarness({ hasParticleTexture: true });
    sceneEventHandlers.shutdown?.forEach(cb => cb());
    expect(emitter.destroy).toHaveBeenCalledTimes(1);
  });
});
