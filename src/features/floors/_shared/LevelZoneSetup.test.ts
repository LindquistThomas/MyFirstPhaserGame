import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { LevelConfig } from './LevelScene';
import type * as Phaser from 'phaser';

// ---- Phaser stub — LevelZoneSetup uses Phaser.Geom.Rectangle and Phaser.Math.Distance ----
// Use vi.hoisted() so these refs are available inside the vi.mock() factory (which is hoisted).
const { distanceBetween, rectContains } = vi.hoisted(() => ({
  distanceBetween: vi.fn(() => 50), // default: player is inside circle zone
  rectContains: vi.fn(() => false),
}));

vi.mock('phaser', () => {
  return {
    default: {
      Geom: {
        Rectangle: class Rectangle {
          constructor(
            public x: number,
            public y: number,
            public width: number,
            public height: number,
          ) {}
          static Contains = rectContains;
        },
      },
      Math: {
        Distance: { Between: distanceBetween },
      },
    },
    Geom: {
      Rectangle: class Rectangle {
        constructor(
          public x: number,
          public y: number,
          public width: number,
          public height: number,
        ) {}
        static Contains = rectContains;
      },
    },
    Math: {
      Distance: { Between: distanceBetween },
    },
  };
});

// ---- InfoIcon stub ----
interface MockIconInstance {
  visible: boolean;
  setVisible: ReturnType<typeof vi.fn>;
  setQuizBadge: ReturnType<typeof vi.fn>;
  markAsSeen: ReturnType<typeof vi.fn>;
  startCooldown: ReturnType<typeof vi.fn>;
}
const createdIcons: MockIconInstance[] = [];

vi.mock('../../../ui/InfoIcon', () => ({
  InfoIcon: class MockInfoIcon {
    visible = true; // will be set to false by create()
    setVisible = vi.fn((v: boolean) => { this.visible = v; });
    setQuizBadge = vi.fn();
    markAsSeen = vi.fn();
    startCooldown = vi.fn();
    constructor() {
      createdIcons.push(this as unknown as MockIconInstance);
    }
  },
}));

// ---- QUIZ_DATA stub — return no quiz data by default ----
vi.mock('../../../config/quiz', () => ({
  QUIZ_DATA: {} as Record<string, unknown>,
}));

// ---- QuizManager stub (getCooldownRemaining) ----
vi.mock('../../../systems/QuizManager', () => ({
  getCooldownRemaining: vi.fn(() => 0),
}));

// ---- GameStateManager stub ----
vi.mock('../../../systems/GameStateManager', () => ({
  GameStateManager: class {},
}));

import { LevelZoneSetup } from './LevelZoneSetup';
import { eventBus } from '../../../systems/EventBus';

// ── helpers ─────────────────────────────────────────────────────────────────

function makeSceneStub(): Phaser.Scene {
  const handlers: Map<string, (() => void)[]> = new Map();
  return {
    events: {
      once: vi.fn((event: string, handler: () => void) => {
        const list = handlers.get(event) ?? [];
        list.push(handler);
        handlers.set(event, list);
      }),
      off: vi.fn(),
      on: vi.fn(),
    },
    inputs: { on: vi.fn(), off: vi.fn() },
    _handlers: handlers, // for test inspection
  } as unknown as Phaser.Scene;
}

function makePlayerStub(x = 0, y = 0) {
  const sprite = { x, y };
  return { sprite } as unknown as import('../../../entities/Player').Player;
}

function makeDialogsStub() {
  return { open: vi.fn(), isOpen: false } as unknown as import('../../../ui/DialogController').DialogController;
}

function makeGameStateStub() {
  return {
    isQuizPassed: vi.fn(() => false),
  } as unknown as import('../../../systems/GameStateManager').GameStateManager;
}

function makeInfoPoint(
  id: string,
  x = 200,
  y = 400,
): NonNullable<LevelConfig['infoPoints']>[number] {
  return { contentId: id, x, y };
}

function makeHarness(infoPoints: NonNullable<LevelConfig['infoPoints']> = []) {
  createdIcons.length = 0;
  distanceBetween.mockClear();
  rectContains.mockClear();

  const scene = makeSceneStub();
  const player = makePlayerStub();
  const dialogs = makeDialogsStub();
  const gameState = makeGameStateStub();

  const zoneSetup = new LevelZoneSetup({ scene, player, dialogs, gameState });
  const config = { infoPoints } as Pick<LevelConfig, 'infoPoints'>;
  zoneSetup.create(config as LevelConfig);

  return { zoneSetup, scene, player, dialogs, gameState };
}

// ── tests ────────────────────────────────────────────────────────────────────

describe('LevelZoneSetup — create()', () => {
  beforeEach(() => {
    createdIcons.length = 0;
  });

  it('does nothing when infoPoints is empty', () => {
    const { zoneSetup } = makeHarness([]);
    expect(zoneSetup.iconsByContentId.size).toBe(0);
    expect(createdIcons).toHaveLength(0);
  });

  it('does nothing when infoPoints is absent', () => {
    const { zoneSetup } = makeHarness(undefined as unknown as NonNullable<LevelConfig['infoPoints']>);
    expect(zoneSetup.iconsByContentId.size).toBe(0);
  });

  it('creates one InfoIcon per info point', () => {
    makeHarness([makeInfoPoint('ip-1'), makeInfoPoint('ip-2')]);
    expect(createdIcons).toHaveLength(2);
  });

  it('starts each icon as hidden', () => {
    makeHarness([makeInfoPoint('ip-1')]);
    const icon = createdIcons[0]!;
    // setVisible(false) must have been called during create()
    expect(icon.setVisible).toHaveBeenCalledWith(false);
  });

  it('maps each icon by contentId in iconsByContentId', () => {
    const { zoneSetup } = makeHarness([makeInfoPoint('ip-alpha'), makeInfoPoint('ip-beta')]);
    expect(zoneSetup.iconsByContentId.has('ip-alpha')).toBe(true);
    expect(zoneSetup.iconsByContentId.has('ip-beta')).toBe(true);
  });

  it('registers a zone for each info point', () => {
    const { zoneSetup } = makeHarness([makeInfoPoint('zone-a')]);
    // getActiveZone queries the underlying ZoneManager;
    // after create() the zone exists but is inactive (player not in zone)
    distanceBetween.mockReturnValue(200); // outside zone
    zoneSetup.update();
    expect(zoneSetup.getActiveZone()).toBeNull();
  });
});

describe('LevelZoneSetup — zone enter/exit via EventBus', () => {
  beforeEach(() => {
    createdIcons.length = 0;
  });

  it('makes the icon visible on zone:enter', () => {
    makeHarness([makeInfoPoint('ip-vis')]);
    const icon = createdIcons[0]!;
    // Simulate entering the zone by emitting the event directly
    eventBus.emit('zone:enter', 'ip-vis');
    expect(icon.visible).toBe(true);
  });

  it('hides the icon on zone:exit', () => {
    makeHarness([makeInfoPoint('ip-hide')]);
    const icon = createdIcons[0]!;
    // Enter then exit
    eventBus.emit('zone:enter', 'ip-hide');
    eventBus.emit('zone:exit', 'ip-hide');
    expect(icon.visible).toBe(false);
  });

  it('does not affect icons from a different zone id', () => {
    makeHarness([makeInfoPoint('ip-a'), makeInfoPoint('ip-b')]);
    const [iconA, iconB] = createdIcons;
    eventBus.emit('zone:enter', 'ip-a');
    // iconB should still be hidden
    expect(iconA?.visible).toBe(true);
    expect(iconB?.setVisible).not.toHaveBeenCalledWith(true);
  });
});

describe('LevelZoneSetup — update() drives zone transitions', () => {
  beforeEach(() => {
    createdIcons.length = 0;
  });

  it('emits zone:enter when player moves into circle zone', () => {
    const { zoneSetup } = makeHarness([makeInfoPoint('ip-circle', 200, 400)]);
    const enterSpy = vi.fn();
    eventBus.on('zone:enter', enterSpy);

    distanceBetween.mockReturnValue(50); // inside default 120 px radius
    zoneSetup.update();

    eventBus.off('zone:enter', enterSpy);
    expect(enterSpy).toHaveBeenCalledWith('ip-circle');
  });

  it('emits zone:exit when player moves out of circle zone', () => {
    const { zoneSetup } = makeHarness([makeInfoPoint('ip-out', 200, 400)]);
    const exitSpy = vi.fn();
    eventBus.on('zone:exit', exitSpy);

    // First enter
    distanceBetween.mockReturnValue(50);
    zoneSetup.update();

    // Then exit
    distanceBetween.mockReturnValue(200);
    zoneSetup.update();

    eventBus.off('zone:exit', exitSpy);
    expect(exitSpy).toHaveBeenCalledWith('ip-out');
  });

  it('does not emit duplicate zone:enter on consecutive ticks inside zone', () => {
    const { zoneSetup } = makeHarness([makeInfoPoint('ip-dup', 200, 400)]);
    const enterSpy = vi.fn();
    eventBus.on('zone:enter', enterSpy);

    distanceBetween.mockReturnValue(50);
    zoneSetup.update();
    zoneSetup.update(); // second tick — player still inside

    eventBus.off('zone:enter', enterSpy);
    expect(enterSpy).toHaveBeenCalledTimes(1);
  });
});

describe('LevelZoneSetup — rect zone shape', () => {
  beforeEach(() => {
    createdIcons.length = 0;
  });

  it('uses Rectangle.Contains for rect-shaped zones', () => {
    const { zoneSetup } = makeHarness([
      {
        contentId: 'ip-rect',
        x: 300,
        y: 500,
        zone: { shape: 'rect', width: 100, height: 80 },
      },
    ]);

    rectContains.mockReturnValue(true);
    zoneSetup.update();

    expect(rectContains).toHaveBeenCalled();
  });

  it('emits zone:enter for rect zone when Contains returns true', () => {
    const { zoneSetup } = makeHarness([
      {
        contentId: 'ip-rect2',
        x: 300,
        y: 500,
        zone: { shape: 'rect', width: 100, height: 80 },
      },
    ]);

    const enterSpy = vi.fn();
    eventBus.on('zone:enter', enterSpy);

    rectContains.mockReturnValue(true);
    zoneSetup.update();

    eventBus.off('zone:enter', enterSpy);
    expect(enterSpy).toHaveBeenCalledWith('ip-rect2');
  });
});

describe('LevelZoneSetup — getActiveZone()', () => {
  beforeEach(() => {
    createdIcons.length = 0;
  });

  it('returns null when no zone is active', () => {
    const { zoneSetup } = makeHarness([makeInfoPoint('ip-q')]);
    distanceBetween.mockReturnValue(999);
    zoneSetup.update();
    expect(zoneSetup.getActiveZone()).toBeNull();
  });

  it('returns the active zone id', () => {
    const { zoneSetup } = makeHarness([makeInfoPoint('ip-active')]);
    distanceBetween.mockReturnValue(10);
    zoneSetup.update();
    expect(zoneSetup.getActiveZone()).toBe('ip-active');
  });
});

describe('LevelZoneSetup — clear()', () => {
  beforeEach(() => {
    createdIcons.length = 0;
  });

  it('empties iconsByContentId', () => {
    const { zoneSetup } = makeHarness([makeInfoPoint('ip-clr')]);
    expect(zoneSetup.iconsByContentId.size).toBe(1);
    zoneSetup.clear();
    expect(zoneSetup.iconsByContentId.size).toBe(0);
  });

  it('clears zone registrations so getActiveZone returns null', () => {
    const { zoneSetup } = makeHarness([makeInfoPoint('ip-clr2')]);
    distanceBetween.mockReturnValue(10);
    zoneSetup.update();
    zoneSetup.clear();
    expect(zoneSetup.getActiveZone()).toBeNull();
  });
});

describe('LevelZoneSetup — getDebugZones()', () => {
  beforeEach(() => {
    createdIcons.length = 0;
  });

  it('returns one entry per registered info point', () => {
    const { zoneSetup } = makeHarness([makeInfoPoint('d1'), makeInfoPoint('d2')]);
    expect(zoneSetup.getDebugZones()).toHaveLength(2);
  });

  it('shape is circle for default zone', () => {
    const { zoneSetup } = makeHarness([makeInfoPoint('d-circle')]);
    const [zone] = zoneSetup.getDebugZones();
    expect(zone?.shape).toBe('circle');
  });

  it('shape is rect for rect zone', () => {
    const { zoneSetup } = makeHarness([
      { contentId: 'd-rect', x: 0, y: 0, zone: { shape: 'rect', width: 50, height: 50 } },
    ]);
    const [zone] = zoneSetup.getDebugZones();
    expect(zone?.shape).toBe('rect');
  });

  it('marks the active zone in debug output', () => {
    const { zoneSetup } = makeHarness([makeInfoPoint('d-active')]);
    distanceBetween.mockReturnValue(10);
    zoneSetup.update();
    const [zone] = zoneSetup.getDebugZones();
    expect(zone?.active).toBe(true);
  });

  it('marks inactive zones correctly', () => {
    const { zoneSetup } = makeHarness([makeInfoPoint('d-inactive')]);
    distanceBetween.mockReturnValue(999);
    zoneSetup.update();
    const [zone] = zoneSetup.getDebugZones();
    expect(zone?.active).toBe(false);
  });
});
