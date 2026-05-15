import { afterEach, describe, expect, it, vi } from 'vitest';
import type * as Phaser from 'phaser';
import { eventBus } from '../systems/EventBus';
import { FLOORS, FloorId } from '../config/gameConfig';
import { LEVEL_DATA } from '../config/levelData';

vi.mock('phaser', () => {
  const Phaser = {
    Scenes: {
      Events: { SHUTDOWN: 'shutdown' },
    },
  };
  return { ...Phaser, default: Phaser };
});

// ── Minimal scene stubs ───────────────────────────────────────────────────

type PointerHandler = () => void;

function makeGraphics() {
  const g: Record<string, ReturnType<typeof vi.fn>> = {};
  for (const name of [
    'clear', 'fillStyle', 'fillRoundedRect', 'lineStyle', 'strokeRoundedRect',
    'setDepth', 'setScrollFactor',
  ]) {
    g[name] = vi.fn().mockReturnThis();
  }
  return g as unknown as Record<string, ReturnType<typeof vi.fn>>;
}

function makeText() {
  const t: Record<string, ReturnType<typeof vi.fn>> = {};
  t.setOrigin = vi.fn().mockReturnThis();
  return t;
}

function makeRectangle() {
  const handlers: Record<string, PointerHandler> = {};
  const r = {
    setInteractive: vi.fn().mockReturnThis(),
    setAlpha: vi.fn().mockReturnThis(),
    on: vi.fn((event: string, fn: PointerHandler) => {
      handlers[event] = fn;
      return r;
    }),
    _fire: (event: string) => handlers[event]?.(),
  };
  return r;
}

type ContainerItem = { destroy?: ReturnType<typeof vi.fn> };

function makeContainer() {
  const list: ContainerItem[] = [];
  const c = {
    add: vi.fn((item: ContainerItem) => { list.push(item); return c; }),
    addAt: vi.fn((item: ContainerItem, _idx: number) => { list.splice(_idx, 0, item); return c; }),
    setDepth: vi.fn().mockReturnThis(),
    setScrollFactor: vi.fn().mockReturnThis(),
    setVisible: vi.fn().mockReturnThis(),
    setAlpha: vi.fn().mockReturnThis(),
    destroy: vi.fn(),
    list,
    x: 0,
    y: 0,
  };
  return c;
}

function makeScene() {
  const onceHandlers: Record<string, (() => void)[]> = {};
  const containers: ReturnType<typeof makeContainer>[] = [];
  const rectangles: ReturnType<typeof makeRectangle>[] = [];

  const scene = {
    add: {
      container: vi.fn((_x: number, _y: number) => {
        const c = makeContainer();
        containers.push(c);
        return c;
      }),
      graphics: vi.fn(() => {
        const g = makeGraphics();
        // Push a fake destroy so rebuildButtons can call it.
        (g as unknown as { destroy: ReturnType<typeof vi.fn> }).destroy = vi.fn();
        return g;
      }),
      text: vi.fn((_x: number, _y: number, _s: string) => {
        const t = makeText();
        (t as unknown as { destroy: ReturnType<typeof vi.fn> }).destroy = vi.fn();
        return t;
      }),
      rectangle: vi.fn((_x: number, _y: number, _w: number, _h: number) => {
        const r = makeRectangle();
        (r as unknown as { destroy: ReturnType<typeof vi.fn> }).destroy = vi.fn();
        rectangles.push(r);
        return r;
      }),
    },
    tweens: {
      add: vi.fn(() => ({ stop: vi.fn() })),
    },
    events: {
      once: vi.fn((event: string, handler: () => void) => {
        (onceHandlers[event] ??= []).push(handler);
      }),
      emit: (event: string) => {
        const handlers = onceHandlers[event] ?? [];
        onceHandlers[event] = [];
        handlers.forEach(fn => fn());
      },
    },
    _containers: containers,
    _rectangles: rectangles,
  };

  return scene;
}

// ── Minimal ProgressionSystem stub ────────────────────────────────────────

function makeProgression(unlockedIds: FloorId[] = [FLOORS.LOBBY, FLOORS.PLATFORM_TEAM]) {
  const unlockedSet = new Set(unlockedIds);
  return {
    isFloorUnlocked: vi.fn((floorId: FloorId) => unlockedSet.has(floorId)),
    getAUNeededForFloor: vi.fn((_floorId: FloorId) => 5),
  };
}

// ── Import under test ─────────────────────────────────────────────────────

import { ElevatorPanel } from './ElevatorPanel';

describe('ElevatorPanel', () => {
  afterEach(() => {
    eventBus.removeAllListeners();
    vi.clearAllMocks();
  });

  it('creates a container on construction', () => {
    const scene = makeScene();
    const progression = makeProgression();

    new ElevatorPanel(
      scene as unknown as Phaser.Scene,
      progression as never,
      vi.fn(),
    );

    expect(scene.add.container).toHaveBeenCalled();
  });

  it('starts hidden and show() makes it visible', () => {
    const scene = makeScene();
    const progression = makeProgression();

    const panel = new ElevatorPanel(
      scene as unknown as Phaser.Scene,
      progression as never,
      vi.fn(),
    );

    const container = scene._containers[0]!;
    // Container starts hidden on construction.
    expect(container.setVisible).toHaveBeenCalledWith(false);

    panel.show();
    expect(container.setVisible).toHaveBeenCalledWith(true);
  });

  it('hide() sets container invisible and resets fade state', () => {
    const scene = makeScene();
    const progression = makeProgression();
    const panel = new ElevatorPanel(
      scene as unknown as Phaser.Scene,
      progression as never,
      vi.fn(),
    );

    panel.show();
    panel.hide();

    const container = scene._containers[0]!;
    expect(container.setVisible).toHaveBeenCalledWith(false);
    expect(container.setAlpha).toHaveBeenCalledWith(1.0);
  });

  it('toggle() switches visibility on/off', () => {
    const scene = makeScene();
    const progression = makeProgression();
    const panel = new ElevatorPanel(
      scene as unknown as Phaser.Scene,
      progression as never,
      vi.fn(),
    );

    const container = scene._containers[0]!;
    const visibleCallsBefore = (container.setVisible as ReturnType<typeof vi.fn>).mock.calls.length;

    panel.toggle(); // hidden → visible
    expect(container.setVisible).toHaveBeenLastCalledWith(true);

    panel.toggle(); // visible → hidden
    expect(container.setVisible).toHaveBeenLastCalledWith(false);

    // Ensure extra calls actually happened.
    expect((container.setVisible as ReturnType<typeof vi.fn>).mock.calls.length).toBeGreaterThan(visibleCallsBefore);
  });

  it('rebuildButtons creates one button row per floor in LEVEL_DATA', () => {
    const scene = makeScene();
    const progression = makeProgression();

    const panel = new ElevatorPanel(
      scene as unknown as Phaser.Scene,
      progression as never,
      vi.fn(),
    );

    const expectedFloorCount = Object.keys(LEVEL_DATA).length;

    panel.show(); // triggers rebuildButtons()

    // rebuildButtons calls scene.add.container once per floor row.
    // The outer container is created in buildContainer(), so total containers
    // should be 1 (outer) + N floors.
    const totalContainers = scene._containers.length;
    expect(totalContainers).toBe(1 + expectedFloorCount);
  });

  it('unlocked floors render a hit area (rectangle); locked floors do not', () => {
    const scene = makeScene();
    // Only lobby is unlocked; all others are locked.
    const progression = makeProgression([FLOORS.LOBBY]);

    const panel = new ElevatorPanel(
      scene as unknown as Phaser.Scene,
      progression as never,
      vi.fn(),
    );

    panel.show();

    // Exactly one floor is unlocked so exactly one hit-area rectangle should exist.
    expect(scene._rectangles.length).toBe(1);
  });

  it('clicking an unlocked floor button calls onSelect with the correct floorId', () => {
    const scene = makeScene();
    const progression = makeProgression([FLOORS.LOBBY]);
    const onSelect = vi.fn();

    const panel = new ElevatorPanel(
      scene as unknown as Phaser.Scene,
      progression as never,
      onSelect,
    );

    panel.show();

    // The single hit-area corresponds to the unlocked lobby floor.
    scene._rectangles[0]!._fire('pointerdown');
    expect(onSelect).toHaveBeenCalledWith(FLOORS.LOBBY);
  });

  it('subscribes to progression:floor_unlocked and rebuilds buttons on unlock', () => {
    const scene = makeScene();
    const progression = makeProgression([FLOORS.LOBBY]);

    const panel = new ElevatorPanel(
      scene as unknown as Phaser.Scene,
      progression as never,
      vi.fn(),
    );

    panel.show();
    const rectanglesBeforeUnlock = scene._rectangles.length;

    // Simulate a new floor being unlocked — panel should rebuild.
    progression.isFloorUnlocked.mockImplementation((id: FloorId) =>
      id === FLOORS.LOBBY || id === FLOORS.PLATFORM_TEAM,
    );
    eventBus.emit('progression:floor_unlocked', FLOORS.PLATFORM_TEAM);

    // Now two floors are unlocked so two hit-area rectangles should exist.
    expect(scene._rectangles.length).toBeGreaterThan(rectanglesBeforeUnlock);
  });

  it('unsubscribes from progression:floor_unlocked on scene shutdown', () => {
    const scene = makeScene();
    const progression = makeProgression([FLOORS.LOBBY]);

    const panel = new ElevatorPanel(
      scene as unknown as Phaser.Scene,
      progression as never,
      vi.fn(),
    );

    panel.show();

    // Trigger scene shutdown — the panel should unsubscribe its EventBus handler.
    scene.events.emit('shutdown');

    // After shutdown, emitting the event must NOT trigger rebuildButtons.
    // If it did, more containers would be added.
    const containerCountAfterShutdown = scene._containers.length;
    eventBus.emit('progression:floor_unlocked', FLOORS.PLATFORM_TEAM);
    expect(scene._containers.length).toBe(containerCountAfterShutdown);
  });

  it('progression:floor_unlocked rebuilds buttons eagerly even when panel is hidden', () => {
    const scene = makeScene();
    const progression = makeProgression([FLOORS.LOBBY]);

    new ElevatorPanel(
      scene as unknown as Phaser.Scene,
      progression as never,
      vi.fn(),
    );

    // Panel starts hidden; do not call show().
    const containerCountBefore = scene._containers.length;

    progression.isFloorUnlocked.mockImplementation((id: FloorId) =>
      id === FLOORS.LOBBY || id === FLOORS.PLATFORM_TEAM,
    );
    eventBus.emit('progression:floor_unlocked', FLOORS.PLATFORM_TEAM);

    // rebuildButtons runs unconditionally on the event, regardless of visibility,
    // so new button containers are added even while the panel is hidden.
    expect(scene._containers.length).toBeGreaterThan(containerCountBefore);
  });

  it('renders static "<auRequired> AU" hints for locked floors with a positive requirement', () => {
    const scene = makeScene();
    const progression = makeProgression([]);

    const panel = new ElevatorPanel(
      scene as unknown as Phaser.Scene,
      progression as never,
      vi.fn(),
    );

    panel.show();

    const hintTexts = (scene.add.text as ReturnType<typeof vi.fn>).mock.calls
      .map((call) => call[2])
      .filter((text) => typeof text === 'string' && text.endsWith(' AU'));
    expect(hintTexts).toContain('8 AU');
    expect(hintTexts).toContain('9 AU');
    expect(hintTexts).toContain('21 AU');
    expect(hintTexts).toContain('28 AU');
    expect(hintTexts).not.toContain('0 AU');
  });
});
