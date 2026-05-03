import { describe, it, expect, vi } from 'vitest';

// ── Minimal Phaser stub ──────────────────────────────────────────────────────

vi.mock('phaser', () => {
  class Scene {
    constructor(_config: unknown) {}
  }
  const Physics = {
    Arcade: {
      Sprite: class ArcadeSprite {
        constructor(_scene: unknown, _x: number, _y: number) {}
      },
      Events: { WORLD_BOUNDS: 'worldbounds' },
    },
  };
  return { default: { Scene, Physics }, Scene, Physics };
});

// ── Stub all heavy entity/system imports ─────────────────────────────────────

vi.mock('../../../entities/Player', () => ({ Player: class Player {} }));
vi.mock('../../../entities/CEOBoss', () => ({
  CEOBoss: class CEOBoss {
    constructor(_scene: unknown, _x: number, _y: number) {}
  },
}));
vi.mock('../../../entities/CoffeeMugProjectile', () => ({
  CoffeeMugProjectile: class CoffeeMugProjectile {},
}));
vi.mock('../../../entities/BriefcaseProjectile', () => ({
  BriefcaseProjectile: class BriefcaseProjectile {},
}));
vi.mock('../../../entities/Checkpoint', () => ({
  Checkpoint: class Checkpoint {},
}));
vi.mock('../../../ui/BossHealthBar', () => ({
  BossHealthBar: class BossHealthBar {},
}));
vi.mock('../../../ui/BossIntroDialog', () => ({
  BossIntroDialog: class BossIntroDialog {},
}));
vi.mock('../../../ui/Toast', () => ({
  Toast: class Toast {},
}));
vi.mock('../../../systems/GameStateManager', () => ({
  GameStateManager: class GameStateManager {},
}));
vi.mock('../../../systems/ProgressionSystem', () => ({
  ProgressionSystem: class ProgressionSystem {},
}));
vi.mock('../../../systems/FloorHitState', () => ({
  FloorHitState: class FloorHitState {
    reset = vi.fn();
  },
}));
vi.mock('../../../systems/EventBus', () => ({
  eventBus: { emit: vi.fn(), on: vi.fn(), off: vi.fn(), once: vi.fn() },
}));
vi.mock('../../../systems/MotionPreference', () => ({
  isReducedMotion: vi.fn(() => false),
}));
vi.mock('../../../input', () => ({
  allKeyLabels: vi.fn(() => 'Enter'),
}));

import { BossArenaScene } from './BossArenaScene';

describe('BossArenaScene — static properties', () => {
  it('MAX_HELD_MUGS is 3', () => {
    expect(BossArenaScene.MAX_HELD_MUGS).toBe(3);
  });

  it('exports a class constructor', () => {
    expect(typeof BossArenaScene).toBe('function');
  });
});

describe('BossArenaScene — constructor smoke test', () => {
  it('instantiates without throwing', () => {
    expect(() => new BossArenaScene()).not.toThrow();
  });

  it('instance is defined after construction', () => {
    const scene = new BossArenaScene();
    expect(scene).toBeDefined();
  });
});
