import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Phaser stub ──────────────────────────────────────────────────────────────

vi.mock('phaser', () => {
  const makeChainable = () => {
    const o: Record<string, unknown> = {};
    for (const m of [
      'setOrigin', 'setDepth', 'setScrollFactor', 'setInteractive', 'setAlpha',
      'setShadow', 'setColor', 'setScale', 'fillStyle', 'fillRect',
      'lineStyle', 'strokeRect', 'clear', 'on',
    ]) {
      o[m] = vi.fn(() => o);
    }
    o['destroy'] = vi.fn();
    o['add'] = vi.fn();
    return o;
  };

  const makeContainer = () => {
    const items: unknown[] = [];
    const c: Record<string, unknown> = {
      list: items,
    };
    for (const m of ['setDepth', 'setScrollFactor', 'setAlpha', 'setInteractive', 'on', 'destroy']) {
      c[m] = vi.fn(() => c);
    }
    c['add'] = vi.fn((item: unknown) => { items.push(item); });
    return c;
  };

  class Scene {
    cameras = { main: { fadeIn: vi.fn(), fadeOut: vi.fn() } };
    time = { delayedCall: vi.fn() };
    scene = { start: vi.fn(), restart: vi.fn() };
    input = { keyboard: { addKey: vi.fn(() => ({ on: vi.fn(), off: vi.fn() })) } };
    registry = { get: vi.fn(() => ({ resetLoadState: vi.fn() })) };
    add = {
      graphics: vi.fn(() => {
        const g = makeChainable();
        // setInteractive + on needed for background rect
        g.setInteractive = vi.fn(() => g);
        return g;
      }),
      container: vi.fn(() => makeContainer()),
      text: vi.fn(() => makeChainable()),
      rectangle: vi.fn(() => makeChainable()),
    };
    constructor(_config: unknown) {}
  }

  // Minimal Geom stub for Phaser.Geom.Rectangle
  const Rectangle = class {
    constructor(public x: number, public y: number, public w: number, public h: number) {}
    static Contains = vi.fn(() => true);
  };

  return {
    default: {
      Scene,
      Geom: { Rectangle },
      Input: { Keyboard: { KeyCodes: { X: 88 } } },
    },
    Scene,
    Geom: { Rectangle },
    Input: { Keyboard: { KeyCodes: { X: 88 } } },
  };
});

// ── Config / system stubs ────────────────────────────────────────────────────

vi.mock('../../config/gameConfig', () => ({
  GAME_WIDTH: 1280,
  GAME_HEIGHT: 720,
  COLORS: { titleText: '#ffffff' },
  FLOORS: { LOBBY: 0, PLATFORM_TEAM: 1, EXECUTIVE: 4 },
  FLOOR_IDS: [0, 1, 2, 3, 4, 5],
}));

vi.mock('../../config/levelData', () => ({
  LEVEL_DATA: {
    0: { id: 0, name: 'Lobby' },
    1: { id: 1, name: 'Platform Team' },
    4: { id: 4, name: 'Executive Suite' },
  },
}));

vi.mock('../../systems/SaveManager', () => ({
  SAVE_SLOTS: ['slot1', 'slot2', 'slot3'],
  loadSlotInfo: vi.fn(),
  clearSlot: vi.fn(),
  setPlayerSlot: vi.fn(),
  getRecoveryReason: vi.fn(() => 'corrupted'),
}));

vi.mock('../../systems/GameStateManager', () => ({ GameStateManager: class {} }));

vi.mock('../../input', () => ({ pushContext: vi.fn(() => 0), popContext: vi.fn() }));

vi.mock('../../systems/sceneLifecycle', () => ({
  createSceneLifecycle: vi.fn(() => ({ add: vi.fn(), bindInput: vi.fn() })),
}));

vi.mock('../../ui/SaveRecoveryDialog', () => ({
  SaveRecoveryDialog: vi.fn(),
}));

// ── Imports (after mocks) ────────────────────────────────────────────────────

import { SaveSlotScene } from './SaveSlotScene';
import * as SaveManager from '../../systems/SaveManager';
import type { FloorId } from '../../config/gameConfig';

// ── Helper ───────────────────────────────────────────────────────────────────

function getTextLabels(scene: SaveSlotScene): string[] {
  return (scene.add.text as ReturnType<typeof vi.fn>).mock.calls.map(
    (args: unknown[]) => args[2] as string,
  );
}

function buildScene(): SaveSlotScene {
  const scene = new SaveSlotScene();
  (scene as unknown as { create: () => void }).create();
  return scene;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('SaveSlotScene — save card floor display', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows "Floor: Executive Suite" for a slot on the executive floor', () => {
    vi.mocked(SaveManager.loadSlotInfo).mockImplementation((slotId) => {
      if (slotId === 'slot1') {
        return { slotId, exists: true, totalAU: 42, currentFloor: 4 as FloorId, lastPlayedAt: undefined };
      }
      return { slotId, exists: false };
    });

    const scene = buildScene();
    const labels = getTextLabels(scene);
    expect(labels).toContain('Floor: Executive Suite');
  });

  it('shows "Floor: Platform Team" for a slot on floor 1', () => {
    vi.mocked(SaveManager.loadSlotInfo).mockImplementation((slotId) => {
      if (slotId === 'slot1') {
        return { slotId, exists: true, totalAU: 10, currentFloor: 1 as FloorId, lastPlayedAt: undefined };
      }
      return { slotId, exists: false };
    });

    const scene = buildScene();
    const labels = getTextLabels(scene);
    expect(labels).toContain('Floor: Platform Team');
  });

  it('shows "Floor: Lobby" for a slot on floor 0 (actual Lobby)', () => {
    vi.mocked(SaveManager.loadSlotInfo).mockImplementation((slotId) => {
      if (slotId === 'slot1') {
        return { slotId, exists: true, totalAU: 5, currentFloor: 0 as FloorId, lastPlayedAt: undefined };
      }
      return { slotId, exists: false };
    });

    const scene = buildScene();
    const labels = getTextLabels(scene);
    expect(labels).toContain('Floor: Lobby');
  });

  it('shows "Floor: —" when currentFloor is undefined (unknown/invalid floor)', () => {
    vi.mocked(SaveManager.loadSlotInfo).mockImplementation((slotId) => {
      if (slotId === 'slot1') {
        return { slotId, exists: true, totalAU: 0, currentFloor: undefined, lastPlayedAt: undefined };
      }
      return { slotId, exists: false };
    });

    const scene = buildScene();
    const labels = getTextLabels(scene);
    expect(labels).toContain('Floor: —');
  });

  it('shows "NEW GAME" badge for an empty slot', () => {
    vi.mocked(SaveManager.loadSlotInfo).mockReturnValue({ slotId: 'slot1', exists: false });

    const scene = buildScene();
    const labels = getTextLabels(scene);
    expect(labels).toContain('NEW GAME');
  });

  it('shows "RECOVERED" badge instead of "NEW GAME" for a recovered slot', () => {
    vi.mocked(SaveManager.loadSlotInfo).mockReturnValue({
      slotId: 'slot1', exists: false, recovered: true,
    });

    const scene = buildScene();
    const labels = getTextLabels(scene);
    expect(labels).toContain('RECOVERED');
    expect(labels).not.toContain('NEW GAME');
  });

  it('does not render a raw floor number (e.g. "Floor 4")', () => {
    vi.mocked(SaveManager.loadSlotInfo).mockImplementation((slotId) => {
      if (slotId === 'slot1') {
        return { slotId, exists: true, totalAU: 42, currentFloor: 4 as FloorId, lastPlayedAt: undefined };
      }
      return { slotId, exists: false };
    });

    const scene = buildScene();
    const labels = getTextLabels(scene);
    expect(labels).not.toContain('Floor 4');
  });

  it('shows "NG+ AVAILABLE" on slots with bossDefeatedCount >= 1', () => {
    vi.mocked(SaveManager.loadSlotInfo).mockImplementation((slotId) => {
      if (slotId === 'slot1') {
        return {
          slotId,
          exists: true,
          totalAU: 42,
          currentFloor: 4 as FloorId,
          lastPlayedAt: undefined,
          bossDefeatedCount: 1,
        };
      }
      return { slotId, exists: false };
    });

    const scene = buildScene();
    const labels = getTextLabels(scene);
    expect(labels).toContain('NG+ AVAILABLE');
  });

  it('action selector shows NEW GAME+ only when bossDefeatedCount >= 1', () => {
    vi.mocked(SaveManager.loadSlotInfo).mockImplementation((slotId) => {
      if (slotId === 'slot1') {
        return {
          slotId,
          exists: true,
          totalAU: 42,
          currentFloor: 4 as FloorId,
          lastPlayedAt: undefined,
          bossDefeatedCount: 1,
        };
      }
      return { slotId, exists: false };
    });
    const sceneWithNg = buildScene();
    (sceneWithNg as unknown as { activateSelected: () => void }).activateSelected();
    expect(getTextLabels(sceneWithNg)).toContain('[ NEW GAME+ ]');

    vi.clearAllMocks();
    vi.mocked(SaveManager.loadSlotInfo).mockImplementation((slotId) => {
      if (slotId === 'slot1') {
        return { slotId, exists: true, totalAU: 42, currentFloor: 4 as FloorId, lastPlayedAt: undefined, bossDefeatedCount: 0 };
      }
      return { slotId, exists: false };
    });
    const sceneWithoutNg = buildScene();
    (sceneWithoutNg as unknown as { activateSelected: () => void }).activateSelected();
    expect(getTextLabels(sceneWithoutNg)).not.toContain('[ NEW GAME+ ]');
  });
});
