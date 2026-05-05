import { describe, it, expect, vi, beforeEach } from 'vitest';
import type * as Phaser from 'phaser';
import { FLOORS } from '../../../config/gameConfig';

const npcInstances: Array<{ id: string; displayName: string; topic: string; x: number; y: number; update: ReturnType<typeof vi.fn>; isPlayerNearby: ReturnType<typeof vi.fn> }> = [];

vi.mock('phaser', () => {
  const Phaser = {
    Math: {
      Distance: {
        Between: (x1: number, y1: number, x2: number, y2: number) => Math.hypot(x2 - x1, y2 - y1),
      },
    },
  };
  return { ...Phaser, default: Phaser };
});

vi.mock('../../../input', () => ({ allKeyLabels: () => 'Enter' }));

vi.mock('../../../entities/Npc', () => ({
  Npc: class MockNpc {
    id: string;
    displayName: string;
    topic: string;
    x: number;
    y: number;
    update = vi.fn();
    isPlayerNearby = vi.fn(() => false);

    constructor(_scene: unknown, config: { id: string; name: string; topic: string; x: number; y: number }) {
      this.id = config.id;
      this.displayName = config.name;
      this.topic = config.topic;
      this.x = config.x;
      this.y = config.y;
      npcInstances.push(this);
    }
  },
}));

vi.mock('../../../ui/NpcDialog', () => ({ NpcDialog: vi.fn() }));

import { LevelNpcManager } from './LevelNpcManager';

function makeDeps(interact = false) {
  const prompt = { setText: vi.fn(() => prompt), setPosition: vi.fn(() => prompt), setVisible: vi.fn(() => prompt) };
  const dialogs = { isOpen: false, openCustom: vi.fn((create: (onClose: () => void) => void) => { create(vi.fn()); return true; }) };
  return {
    scene: {
      physics: { add: { collider: vi.fn() } },
      inputs: { justPressed: vi.fn(() => interact) },
    } as unknown as Phaser.Scene,
    floorId: FLOORS.PLATFORM_TEAM,
    progression: { addAU: vi.fn() } as never,
    player: { sprite: { x: 100, y: 100 } as Phaser.Physics.Arcade.Sprite },
    platformGroup: {} as Phaser.Physics.Arcade.StaticGroup,
    dialogs: dialogs as never,
    prompt: prompt as unknown as Phaser.GameObjects.Text,
    _prompt: prompt,
    _dialogs: dialogs,
  };
}

describe('LevelNpcManager', () => {
  beforeEach(() => {
    npcInstances.length = 0;
    vi.clearAllMocks();
  });

  it('spawns configured NPCs', () => {
    const deps = makeDeps();
    const mgr = new LevelNpcManager(deps);
    mgr.spawn({
      floorId: FLOORS.PLATFORM_TEAM,
      platforms: [],
      tokens: [],
      roomElevators: [],
      exitPosition: { x: 0, y: 0 },
      playerStart: { x: 0, y: 0 },
      npcs: [{ id: 'a', name: 'Ada', x: 10, y: 20, topic: 'architecture basics' }],
    });
    expect(mgr.npcs).toHaveLength(1);
  });

  it('opens NPC dialog when interacting near an NPC', () => {
    const deps = makeDeps(true);
    const mgr = new LevelNpcManager(deps);
    mgr.spawn({
      floorId: FLOORS.PLATFORM_TEAM,
      platforms: [],
      tokens: [],
      roomElevators: [],
      exitPosition: { x: 0, y: 0 },
      playerStart: { x: 0, y: 0 },
      npcs: [{ id: 'a', name: 'Ada', x: 10, y: 20, topic: 'architecture basics' }],
    });
    npcInstances[0]!.isPlayerNearby.mockReturnValue(true);
    expect(mgr.update(0, 16)).toBe(true);
    expect(deps._prompt.setVisible).toHaveBeenCalledWith(true);
    expect(deps._dialogs.openCustom).toHaveBeenCalledTimes(1);
  });
});
