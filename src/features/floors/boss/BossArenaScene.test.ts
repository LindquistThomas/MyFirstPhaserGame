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

import { BossArenaScene, PROMPTS, DIALOGUES, AU_GATE } from './BossArenaScene';

// ── Static properties ────────────────────────────────────────────────────────

describe('BossArenaScene — static properties', () => {
  it('MAX_HELD_MUGS is 3', () => {
    expect(BossArenaScene.MAX_HELD_MUGS).toBe(3);
  });

  it('exports a class constructor', () => {
    expect(typeof BossArenaScene).toBe('function');
  });
});

// ── Constructor smoke tests ───────────────────────────────────────────────────

describe('BossArenaScene — constructor smoke test', () => {
  it('instantiates without throwing', () => {
    expect(() => new BossArenaScene()).not.toThrow();
  });

  it('instance is defined after construction', () => {
    const scene = new BossArenaScene();
    expect(scene).toBeDefined();
  });
});

// ── AU_GATE constant ──────────────────────────────────────────────────────────

describe('BossArenaScene — AU_GATE', () => {
  it('AU_GATE equals 25', () => {
    expect(AU_GATE).toBe(25);
  });
});

// ── PROMPTS data ──────────────────────────────────────────────────────────────

describe('BossArenaScene — PROMPTS', () => {
  it('has exactly 5 entries', () => {
    expect(PROMPTS).toHaveLength(5);
  });

  it('every prompt has scenario, options (3), correct (0|1|2), and feedback', () => {
    for (const [i, p] of PROMPTS.entries()) {
      expect(typeof p.scenario, `prompt[${i}].scenario`).toBe('string');
      expect(p.scenario.length, `prompt[${i}].scenario non-empty`).toBeGreaterThan(0);

      expect(Array.isArray(p.options), `prompt[${i}].options is array`).toBe(true);
      expect(p.options, `prompt[${i}].options has 3 entries`).toHaveLength(3);
      for (const [j, opt] of p.options.entries()) {
        expect(typeof opt, `prompt[${i}].options[${j}] is string`).toBe('string');
        expect(opt.length, `prompt[${i}].options[${j}] non-empty`).toBeGreaterThan(0);
      }

      expect([0, 1, 2], `prompt[${i}].correct is 0|1|2`).toContain(p.correct);

      expect(typeof p.feedback, `prompt[${i}].feedback`).toBe('string');
      expect(p.feedback.length, `prompt[${i}].feedback non-empty`).toBeGreaterThan(0);
    }
  });

  it('correct indices across all prompts are: 1, 0, 0, 1, 2', () => {
    expect(PROMPTS.map((p) => p.correct)).toEqual([1, 0, 0, 1, 2]);
  });

  it('no two prompts share the same scenario', () => {
    const scenarios = PROMPTS.map((p) => p.scenario);
    expect(new Set(scenarios).size).toBe(scenarios.length);
  });

  it('no two prompts share the same feedback', () => {
    const feedbacks = PROMPTS.map((p) => p.feedback);
    expect(new Set(feedbacks).size).toBe(feedbacks.length);
  });

  it('prompt[0] scenario covers build-vs-buy', () => {
    expect(PROMPTS[0]!.scenario).toContain('in-house');
  });

  it('prompt[1] scenario covers horizontal scaling', () => {
    expect(PROMPTS[1]!.scenario).toContain('10×');
  });

  it('prompt[2] scenario covers shared library ownership', () => {
    expect(PROMPTS[2]!.scenario).toContain('shared library');
  });

  it('prompt[3] scenario covers security trade-off with CEO deadline', () => {
    expect(PROMPTS[3]!.scenario).toContain('security');
  });

  it('prompt[4] scenario covers governance / cloud-provider exception', () => {
    expect(PROMPTS[4]!.scenario).toContain('cloud');
  });
});

// ── DIALOGUES data ────────────────────────────────────────────────────────────

describe('BossArenaScene — DIALOGUES', () => {
  it('has exactly 3 entries', () => {
    expect(DIALOGUES).toHaveLength(3);
  });

  it('every dialogue has a lines array of exactly 3 strings', () => {
    for (const [i, d] of DIALOGUES.entries()) {
      expect(Array.isArray(d.lines), `dialogue[${i}].lines is array`).toBe(true);
      expect(d.lines, `dialogue[${i}].lines has 3 entries`).toHaveLength(3);
      for (const [j, line] of d.lines.entries()) {
        expect(typeof line, `dialogue[${i}].lines[${j}] is string`).toBe('string');
        expect(line.length, `dialogue[${i}].lines[${j}] non-empty`).toBeGreaterThan(0);
      }
    }
  });

  it('all three dialogues share the same closing line', () => {
    const closingLines = DIALOGUES.map((d) => d.lines[2]);
    expect(new Set(closingLines).size).toBe(1);
  });

  it('each dialogue has a distinct opening line', () => {
    const openingLines = DIALOGUES.map((d) => d.lines[0]);
    expect(new Set(openingLines).size).toBe(3);
  });

  it('dialogue[0] opens with "Not bad."', () => {
    expect(DIALOGUES[0]!.lines[0]).toBe('"Not bad."');
  });

  it('dialogue[1] opens with "Impressive."', () => {
    expect(DIALOGUES[1]!.lines[0]).toBe('"Impressive."');
  });

  it('dialogue[2] opens with "Ha!"', () => {
    expect(DIALOGUES[2]!.lines[0]).toBe('"Ha!"');
  });
});
