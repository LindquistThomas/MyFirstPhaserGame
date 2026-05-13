import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as Phaser from 'phaser';
import type { LazySceneLoader } from '../lazySceneLoaders';

const { testLazyLoaders } = vi.hoisted(() => ({
  testLazyLoaders: new Map<string, LazySceneLoader>(),
}));

// ── Phaser stub ──────────────────────────────────────────────────────────────
// Only the surface ElevatorScene extends (Phaser.Scene constructor).
vi.mock('phaser', () => {
  class Scene {
    constructor(_config?: unknown) {}
  }
  return { default: { Scene }, Scene };
});

// ── Heavy entity / UI / system stubs ─────────────────────────────────────────
// Mock everything ElevatorScene imports so the module loads cleanly without
// pulling in real Phaser or unrelated business logic.
vi.mock('../../entities/Player', () => ({ Player: class {} }));
vi.mock('../../entities/Elevator', () => ({ Elevator: class {} }));
vi.mock('../../ui/HUD', () => ({ HUD: class {} }));
vi.mock('../../ui/ElevatorButtons', () => ({ ElevatorButtons: class {} }));
vi.mock('../../ui/ElevatorPanel', () => ({ ElevatorPanel: class {} }));
vi.mock('../../ui/WelcomeModal', () => ({ WelcomeModal: class {} }));
vi.mock('../../ui/ControlHintsOverlay', () => ({ ControlHintsOverlay: class {} }));
vi.mock('../../ui/SceneLoadingOverlay', () => ({ SceneLoadingOverlay: class {} }));
vi.mock('../../systems/ProgressionSystem', () => ({ ProgressionSystem: class {} }));
vi.mock('../../systems/GameStateManager', () => ({ GameStateManager: class {} }));
vi.mock('../../ui/DialogController', () => ({ DialogController: class {} }));
vi.mock('../../systems/ZoneManager', () => ({ ZoneManager: class {} }));
vi.mock('./ElevatorZones', () => ({
  ElevatorZones: class {},
  ELEVATOR_INFO_ID: 'elevator-info',
  WELCOME_BOARD_ID: 'welcome-board',
  GEIR_F4_ID: 'geir-f4',
  SOFA_SIT_ID: 'sofa-sit',
}));
vi.mock('./ElevatorController', () => ({ ElevatorController: class {} }));
vi.mock('./ElevatorSceneLayout', () => ({ ElevatorSceneLayout: class {} }));
vi.mock('./ProductDoorManager', () => ({
  ProductDoorManager: class { static doors = []; },
}));
vi.mock('./ElevatorFloorTransitionManager', () => ({
  ElevatorFloorTransitionManager: class {
    static resolveSceneKey = vi.fn(() => 'PlatformTeamScene');
  },
}));
vi.mock('../../systems/EventBus', () => ({
  eventBus: { emit: vi.fn(), on: vi.fn(), off: vi.fn() },
}));
vi.mock('../../config/quiz', () => ({ preloadQuizFor: vi.fn(() => Promise.resolve()) }));
vi.mock('../../config/info', () => ({ preloadInfoFor: vi.fn(() => Promise.resolve()) }));
vi.mock('../../plugins/MusicPlugin', () => ({ prefetchSceneMusic: vi.fn() }));
vi.mock('../../style/theme', () => ({
  theme: {
    color: {
      sky: { horizon: 0x000000 },
      css: { textWhite: '#fff', bgPanel: '#000' },
    },
  },
}));
vi.mock('../../config/gameConfig', () => ({
  GAME_WIDTH: 1280,
  GAME_HEIGHT: 960,
  FLOORS: { LOBBY: 0, PLATFORM_TEAM: 1, PRODUCTS: 5, BUSINESS: 3, EXECUTIVE: 4, BOSS: 6 },
  TILE_SIZE: 128,
  COLORS: { titleText: '#fff' },
  FLOOR_IDS: [0, 1, 3, 4, 5, 6],
}));

vi.mock('../lazySceneLoaders', () => ({
  LAZY_SCENE_LOADERS: testLazyLoaders,
}));

import { ElevatorScene } from './ElevatorScene';

// ── Internal view of ElevatorScene for test access ───────────────────────────

type SceneInternal = {
  isTransitioning: boolean;
  retrySceneKey: string | null;
  time: { delayedCall: (ms: number, fn: () => void) => void };
  inputs: {
    justPressed: ReturnType<typeof vi.fn>;
    isDown: ReturnType<typeof vi.fn>;
  };
  scene: {
    get: ReturnType<typeof vi.fn>;
    add: ReturnType<typeof vi.fn>;
    start: ReturnType<typeof vi.fn>;
  };
  cameras: { main: { fadeIn: ReturnType<typeof vi.fn>; fadeOut: ReturnType<typeof vi.fn> } };
  sceneLoadingOverlay?: {
    showLoading: ReturnType<typeof vi.fn>;
    showError: ReturnType<typeof vi.fn>;
    hide: ReturnType<typeof vi.fn>;
    message: string;
  };
  lazyStartScene: (key: string) => Promise<void>;
  update: (time: number, delta: number) => void;
};

/**
 * Build a minimal ElevatorScene instance with only the surface that
 * lazyStartScene() needs. The delayedCall stub fires immediately so tests
 * don't need real timers.
 */
function makeStub(): SceneInternal {
  const stub = new ElevatorScene() as unknown as SceneInternal;

  // isTransitioning starts false (mirrors create() reset).
  stub.isTransitioning = false;
  stub.retrySceneKey = null;
  testLazyLoaders.clear();

  // Fire delayedCall callbacks synchronously so the fade Promise resolves
  // in the same micro-task turn as the await inside lazyStartScene().
  stub.time = { delayedCall: (_ms, fn) => fn() };
  stub.inputs = {
    justPressed: vi.fn(() => false),
    isDown: vi.fn(() => false),
  };

  // scene.get() returning null tells lazyStartScene there is no loader in
  // LAZY_SCENE_LOADERS (the Map is empty in tests), so it falls through to
  // the simple `await fadeDelay` branch.
  stub.scene = {
    get: vi.fn(() => null),
    add: vi.fn(),
    start: vi.fn(),
  };

  stub.cameras = {
    main: { fadeIn: vi.fn(), fadeOut: vi.fn() },
  };
  const overlay = {
    message: '',
    showLoading: vi.fn(() => { overlay.message = 'Loading...'; }),
    showError: vi.fn((message: string, hint: string) => { overlay.message = `${message} ${hint}`; }),
    hide: vi.fn(),
  };
  stub.sceneLoadingOverlay = overlay;
  (stub as unknown as { waitForAnimationMs: (ms: number) => Promise<void> }).waitForAnimationMs =
    vi.fn(async () => undefined);

  return stub;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('ElevatorScene.lazyStartScene() — isTransitioning guard', () => {
  let stub: SceneInternal;

  beforeEach(() => {
    stub = makeStub();
  });

  it('starts the target scene on a single call', async () => {
    await stub.lazyStartScene('PlatformTeamScene');

    expect(stub.scene.start).toHaveBeenCalledTimes(1);
    expect(stub.scene.start).toHaveBeenCalledWith('PlatformTeamScene');
  });

  it('sets isTransitioning = true synchronously before the first await', () => {
    // Do not await — we want to inspect the flag before the async work settles.
    void stub.lazyStartScene('PlatformTeamScene');

    expect(stub.isTransitioning).toBe(true);
  });

  it('second concurrent call is a no-op — only one scene.start fires', async () => {
    // Both calls happen in the same synchronous turn.
    // The first run sets isTransitioning = true before yielding, so the
    // second call sees the flag and returns without doing any work.
    const first = stub.lazyStartScene('PlatformTeamScene');
    const second = stub.lazyStartScene('ArchitectureTeamScene');

    await Promise.all([first, second]);

    expect(stub.scene.start).toHaveBeenCalledTimes(1);
    expect(stub.scene.start).toHaveBeenCalledWith('PlatformTeamScene');
  });

  it('resets isTransitioning = false when the scene fails to load', async () => {
    stub.scene.start = vi.fn(() => { throw new Error('network error'); });

    await stub.lazyStartScene('PlatformTeamScene');

    expect(stub.isTransitioning).toBe(false);
    expect(stub.cameras.main.fadeIn).toHaveBeenCalled();
  });

  it('allows a fresh transition after an error resets the flag', async () => {
    // First call fails → flag reset.
    stub.scene.start = vi.fn()
      .mockImplementationOnce(() => { throw new Error('first fail'); })
      .mockImplementationOnce(() => { /* success */ });

    await stub.lazyStartScene('PlatformTeamScene');
    expect(stub.isTransitioning).toBe(false);

    // Second call should proceed normally now that the flag was cleared.
    await stub.lazyStartScene('ArchitectureTeamScene');
    expect(stub.scene.start).toHaveBeenCalledTimes(2);
    expect(stub.scene.start).toHaveBeenNthCalledWith(2, 'ArchitectureTeamScene');
  });

  it('shows loading overlay text when lazy loader is still pending', async () => {
    let resolveLoader: ((cls: new (...args: never[]) => Phaser.Scene) => void) | undefined;
    testLazyLoaders.set(
      'PlatformTeamScene',
      () => new Promise((resolve) => { resolveLoader = resolve; }),
    );

    const transition = stub.lazyStartScene('PlatformTeamScene');
    await Promise.resolve();
    await Promise.resolve();

    expect(stub.sceneLoadingOverlay?.showLoading).toHaveBeenCalledTimes(1);
    expect(stub.sceneLoadingOverlay?.message).toContain('Loading');

    resolveLoader?.(class MockScene extends Phaser.Scene {});
    await transition;
  });

  it('shows retry copy and stores retry key when lazy loader fails', async () => {
    testLazyLoaders.set(
      'PlatformTeamScene',
      () => Promise.reject(new Error('chunk download failed')),
    );

    await stub.lazyStartScene('PlatformTeamScene');

    expect(stub.retrySceneKey).toBe('PlatformTeamScene');
    expect(stub.sceneLoadingOverlay?.showError).toHaveBeenCalledWith(
      'Could not load floor',
      'Press Enter to retry',
    );
  });

  it('retry prompt binds Confirm to reattempt lazyStartScene()', () => {
    stub.retrySceneKey = 'PlatformTeamScene';
    stub.inputs.justPressed = vi.fn((action: string) => action === 'Confirm');
    const retrySpy = vi.spyOn(stub, 'lazyStartScene').mockResolvedValue();

    stub.update(0, 16);

    expect(stub.cameras.main.fadeOut).toHaveBeenCalled();
    expect(retrySpy).toHaveBeenCalledWith('PlatformTeamScene');
  });
});

describe('ElevatorScene.init() — mode propagation', () => {
  it('writes NG+ world modifiers to registry when starting ngplus', () => {
    const scene = new ElevatorScene() as unknown as {
      registry: { get: ReturnType<typeof vi.fn>; set: ReturnType<typeof vi.fn> };
      init: (data?: { loadSave?: boolean; startMode?: 'normal' | 'ngplus' }) => void;
      progression: { getMode: () => 'normal' | 'ngplus' };
    };

    const progression = { getMode: vi.fn(() => 'ngplus') };
    const gameState = {
      applyInitialLoad: vi.fn(),
      progression,
    };

    scene.registry = {
      get: vi.fn((key: string) => (key === 'gameState' ? gameState : undefined)),
      set: vi.fn(),
    };

    scene.init({ loadSave: false, startMode: 'ngplus' });

    expect(gameState.applyInitialLoad).toHaveBeenCalledWith(false, 'ngplus');
    expect(scene.registry.set).toHaveBeenCalledWith(
      'worldModifiers',
      expect.objectContaining({ enemySpeedMultiplier: 1.25, enemyContactDamageMultiplier: 1.5 }),
    );
  });
});
