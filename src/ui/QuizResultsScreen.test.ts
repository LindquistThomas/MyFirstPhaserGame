/**
 * Unit tests for QuizResultsScreen (renderQuizResults).
 *
 * Covers:
 *   (a) Pass copy ("QUIZ PASSED!") shown when score meets pass threshold.
 *   (b) Fail copy ("NOT QUITE...") shown when score is below pass threshold.
 *   (c) Perfect copy ("PERFECT SCORE!") shown when score equals total.
 *   (d) "Close" button triggers onClose callback when clicked.
 *   (e) AU awarded on first pass; not awarded on already-passed.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type * as Phaser from 'phaser';

vi.mock('phaser', () => ({ default: {} }));
vi.mock('../config/gameConfig', () => ({
  GAME_WIDTH: 800, GAME_HEIGHT: 600,
  FLOORS: { LOBBY: 'lobby', PLATFORM: 'platform' },
  FloorId: {},
}));

// saveQuizResult / getQuizRecord stubbed so tests don't touch localStorage
vi.mock('../systems/QuizManager', () => ({
  saveQuizResult: vi.fn(),
  getQuizRecord: vi.fn(() => ({ attempts: 1 })),
  recordQuizPass: vi.fn(() => ({
    quizBonusAU: 5,
    floorMasteryBonusAU: 0,
    totalBonusAU: 5,
    floorMasteryEarned: false,
  })),
}));

// isReducedMotion controllable per test
const mockReducedMotion = { value: true };
vi.mock('../systems/MotionPreference', () => ({
  isReducedMotion: vi.fn(() => mockReducedMotion.value),
}));

vi.mock('./ModalKeyboardNavigator', () => ({
  ModalKeyboardNavigator: class {
    add = vi.fn();
    reset = vi.fn();
    setFocus = vi.fn();
    bind = vi.fn();
    destroy = vi.fn();
    focusPrev = vi.fn();
    focusNext = vi.fn();
    activateFocused = vi.fn();
    get = vi.fn(() => undefined);
    size = vi.fn(() => 0);
    currentIndex = vi.fn(() => 0);
  },
  makeTextFocusable: vi.fn((t: unknown) => t),
}));

const PASS_THRESHOLD = 3; // must match real QUIZ_PASS_THRESHOLD

vi.mock('../config/quiz', () => ({
  QUIZ_REWARDS: { pass: 3, perfect: 5 },
  QUIZ_PASS_THRESHOLD: 3,
  getQuizInfoIdsForFloor: vi.fn(() => []),
}));

// ---------------------------------------------------------------------------
// Scene stub
// ---------------------------------------------------------------------------

type FakeText = {
  _text: string;
  setOrigin: ReturnType<typeof vi.fn>;
  setScrollFactor: ReturnType<typeof vi.fn>;
  setInteractive: ReturnType<typeof vi.fn>;
  on: ReturnType<typeof vi.fn>;
  setColor: ReturnType<typeof vi.fn>;
  _trigger: (event: string) => void;
  [key: string]: unknown;
};

function makeText(): FakeText {
  const handlers: Record<string, () => void> = {};
  const obj: FakeText = {
    _text: '',
    setOrigin: vi.fn().mockReturnThis(),
    setScrollFactor: vi.fn().mockReturnThis(),
    setInteractive: vi.fn().mockReturnThis(),
    on: vi.fn((event: string, handler: () => void) => {
      handlers[event] = handler;
      return obj;
    }),
    setColor: vi.fn().mockReturnThis(),
    _trigger: (event: string) => handlers[event]?.(),
  };
  return obj;
}

function makeGraphics() {
  const g: Record<string, ReturnType<typeof vi.fn>> = {};
  for (const name of ['fillStyle', 'fillRoundedRect', 'lineStyle', 'strokeRoundedRect', 'fillRect', 'generateTexture', 'destroy']) {
    g[name] = vi.fn().mockReturnThis();
  }
  return g;
}

function makeContainer() {
  const children: unknown[] = [];
  return {
    add: vi.fn((child: unknown) => { children.push(child); }),
    _children: () => children,
  };
}

function makeScene() {
  const texts: ReturnType<typeof makeText>[] = [];

  const scene = {
    add: {
      graphics: vi.fn(() => makeGraphics()),
      text: vi.fn((x: number, y: number, text: string, _style: unknown) => {
        const t = makeText();
        t._text = text;
        texts.push(t);
        return t;
      }),
      particles: vi.fn(() => ({
        setDepth: vi.fn().mockReturnThis(),
        setScrollFactor: vi.fn().mockReturnThis(),
        setPosition: vi.fn().mockReturnThis(),
        explode: vi.fn(),
        destroy: vi.fn(),
      })),
    },
    tweens: { add: vi.fn() },
    cameras: { main: { flash: vi.fn() } },
    time: { delayedCall: vi.fn() },
    textures: { exists: vi.fn(() => false) },
    events: { once: vi.fn() },
    _texts: () => texts,
    _textValues: () => texts.map((t) => t._text),
  };

  return scene;
}

import { renderQuizResults } from './QuizResultsScreen';
import type { QuizResultsScreenOptions } from './QuizResultsScreen';
import { ModalKeyboardNavigator } from './ModalKeyboardNavigator';
import { FLOORS } from '../config/gameConfig';
import { eventBus } from '../systems/EventBus';

function makeProgressionSystem() {
  return { addAU: vi.fn() };
}

function makeNav() {
  return new ModalKeyboardNavigator({} as unknown as Phaser.Scene);
}

function makeOptions(
  overrides: Partial<QuizResultsScreenOptions> = {},
): QuizResultsScreenOptions {
  const scene = makeScene();
  const container = makeContainer();
  return {
    scene: scene as unknown as Phaser.Scene,
    container: container as unknown as Phaser.GameObjects.Container,
    navigator: makeNav(),
    progression: makeProgressionSystem() as unknown as import('../systems/ProgressionSystem').ProgressionSystem,
    floorId: FLOORS.LOBBY,
    infoId: 'test-info',
    score: PASS_THRESHOLD,
    total: 5,
    alreadyPassed: false,
    onClose: vi.fn(),
    ...overrides,
  };
}

describe('renderQuizResults', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockReducedMotion.value = true;
    eventBus.removeAllListeners();
  });

  it('(a) shows "QUIZ PASSED!" title text when score meets threshold', () => {
    const opts = makeOptions({ score: PASS_THRESHOLD, total: 5 });
    renderQuizResults(opts);
    const scene = opts.scene as unknown as ReturnType<typeof makeScene>;
    expect(scene._textValues()).toContain('QUIZ PASSED!');
  });

  it('(b) shows "NOT QUITE..." title text when score is below threshold', () => {
    const opts = makeOptions({ score: PASS_THRESHOLD - 1, total: 5 });
    renderQuizResults(opts);
    const scene = opts.scene as unknown as ReturnType<typeof makeScene>;
    expect(scene._textValues()).toContain('NOT QUITE...');
  });

  it('(c) shows "PERFECT SCORE!" when score equals total', () => {
    const opts = makeOptions({ score: 5, total: 5 });
    renderQuizResults(opts);
    const scene = opts.scene as unknown as ReturnType<typeof makeScene>;
    expect(scene._textValues()).toContain('PERFECT SCORE!');
  });

  it('(d) Close button pointerdown triggers onClose', () => {
    const onClose = vi.fn();
    const opts = makeOptions({ score: PASS_THRESHOLD, total: 5, onClose });
    renderQuizResults(opts);
    const scene = opts.scene as unknown as ReturnType<typeof makeScene>;

    // Find the close button — its text starts with '[  CLOSE  ]'
    const closeBtn = scene._texts().find((t) => (t._text).startsWith('[  CLOSE  ]'));
    expect(closeBtn).toBeDefined();
    closeBtn!._trigger('pointerdown');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('(e) awards AU via progression.addAU on first pass', () => {
    const progression = makeProgressionSystem();
    const opts = makeOptions({
      score: PASS_THRESHOLD, total: 5,
      alreadyPassed: false,
      progression: progression as unknown as import('../systems/ProgressionSystem').ProgressionSystem,
    });
    renderQuizResults(opts);
    expect(progression.addAU).toHaveBeenCalledTimes(1);
  });

  it('(e2) does NOT award AU when quiz was already passed', () => {
    const progression = makeProgressionSystem();
    const opts = makeOptions({
      score: PASS_THRESHOLD, total: 5,
      alreadyPassed: true,
      progression: progression as unknown as import('../systems/ProgressionSystem').ProgressionSystem,
    });
    renderQuizResults(opts);
    expect(progression.addAU).not.toHaveBeenCalled();
  });

  it('emits quiz:completed event with correct payload', () => {
    const handler = vi.fn();
    eventBus.on('quiz:completed', handler);

    const opts = makeOptions({ score: PASS_THRESHOLD, total: 5 });
    renderQuizResults(opts);

    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({ infoId: 'test-info', score: PASS_THRESHOLD, total: 5, passed: true }),
    );

    eventBus.off('quiz:completed', handler);
  });

  it('animations and particles spawn when motion is enabled (reducedMotion=false)', () => {
    mockReducedMotion.value = false;
    const opts = makeOptions({ score: PASS_THRESHOLD, total: 5, alreadyPassed: false });
    // Should not throw — exercises the tweens.add + particles code paths
    expect(() => renderQuizResults(opts)).not.toThrow();
    const scene = opts.scene as unknown as ReturnType<typeof makeScene>;
    // Tweens should have been added for title scale + auText pulse
    expect(scene.tweens.add).toHaveBeenCalled();
    // Particles should have been spawned
    expect(scene.add.particles).toHaveBeenCalled();
  });

  it('perfect score with motion enabled exercises title-only tween path', () => {
    mockReducedMotion.value = false;
    const opts = makeOptions({ score: 5, total: 5, alreadyPassed: false });
    expect(() => renderQuizResults(opts)).not.toThrow();
    const scene = opts.scene as unknown as ReturnType<typeof makeScene>;
    expect(scene.tweens.add).toHaveBeenCalled();
  });

  it('fail result with motion enabled does NOT spawn particles', () => {
    mockReducedMotion.value = false;
    const opts = makeOptions({ score: PASS_THRESHOLD - 1, total: 5 });
    renderQuizResults(opts);
    const scene = opts.scene as unknown as ReturnType<typeof makeScene>;
    // Particles only spawn on pass
    expect(scene.add.particles).not.toHaveBeenCalled();
  });
});
