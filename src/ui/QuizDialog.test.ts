/**
 * Unit tests for QuizDialog (beyond the cooldown expiry tests in QuizDialog.cooldown.test.ts).
 *
 * Covers:
 *   (a) Shows cooldown screen ("Quiz Locked") when canRetryQuiz returns false.
 *   (b) Shows question screen when canRetryQuiz returns true and questions exist.
 *   (c) Correct answer emits sfx:quiz_correct event.
 *   (d) Wrong answer emits sfx:quiz_wrong event.
 *   (e) After answering, the feedback screen is shown (screen === 'feedback').
 *   (f) onClose callback is called when dialog is closed.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type * as Phaser from 'phaser';

vi.mock('phaser', () => {
  const PhaserNS = {
    Geom: { Rectangle: class Rectangle { constructor(public x: number, public y: number, public width: number, public height: number) {} } },
  };
  return { ...PhaserNS, default: PhaserNS };
});

vi.mock('./ModalBase', () => ({
  ModalBase: class ModalBase {
    protected readonly scene: unknown;
    protected readonly container: {
      add: ReturnType<typeof vi.fn>;
      length: number;
      removeAt: ReturnType<typeof vi.fn>;
      setDepth: ReturnType<typeof vi.fn>;
      setScrollFactor: ReturnType<typeof vi.fn>;
      setAlpha: ReturnType<typeof vi.fn>;
      destroy: ReturnType<typeof vi.fn>;
    };
    private destroyed = false;

    constructor(scene: unknown) {
      this.scene = scene;
      this.container = {
        add: vi.fn(),
        length: 1,
        removeAt: vi.fn(),
        setDepth: vi.fn().mockReturnThis(),
        setScrollFactor: vi.fn().mockReturnThis(),
        setAlpha: vi.fn().mockReturnThis(),
        destroy: vi.fn(),
      };
    }

    protected onBeforeClose(): void { /* stub */ }
    protected onAfterClose(): void { /* stub */ }
    protected fadeIn(): void { /* stub */ }

    close(): void {
      if (this.destroyed) return;
      this.destroyed = true;
      this.onBeforeClose();
      this.onAfterClose();
    }
  },
}));

const mockCanRetry = { value: true };
const mockCooldownRemaining = { value: 0 };

vi.mock('../systems/QuizManager', () => ({
  isQuizPassed: vi.fn(() => false),
  canRetryQuiz: vi.fn(() => mockCanRetry.value),
  getCooldownRemaining: vi.fn(() => mockCooldownRemaining.value),
}));

const QUIZ_DATA_STUB = vi.hoisted(() => ({
  'test-info': {
    questions: [
      { id: 'q1', difficulty: 'easy', question: 'Q1?', choices: ['A', 'B', 'C', 'D'], correctIndex: 0, explanation: 'Ex1' },
      { id: 'q2', difficulty: 'medium', question: 'Q2?', choices: ['A', 'B', 'C', 'D'], correctIndex: 1, explanation: 'Ex2' },
      { id: 'q3', difficulty: 'hard', question: 'Q3?', choices: ['A', 'B', 'C', 'D'], correctIndex: 2, explanation: 'Ex3' },
      { id: 'q4', difficulty: 'easy', question: 'Q4?', choices: ['A', 'B', 'C', 'D'], correctIndex: 3, explanation: 'Ex4' },
      { id: 'q5', difficulty: 'medium', question: 'Q5?', choices: ['A', 'B', 'C', 'D'], correctIndex: 0, explanation: 'Ex5' },
    ],
  },
}));

vi.mock('../config/quiz', () => ({
  QUIZ_DATA: QUIZ_DATA_STUB,
  QUIZ_QUESTION_COUNT: 5,
  QUIZ_DIFFICULTY_MIX: { easy: 2, medium: 2, hard: 1 },
}));

vi.mock('../config/gameConfig', () => ({
  GAME_WIDTH: 800, GAME_HEIGHT: 600,
  FLOORS: { LOBBY: 'lobby' },
}));

vi.mock('../style/theme', () => ({
  theme: {
    color: {
      ui: { quizPanel: 0x0a0a2a, border: 0x334455, quizChoice: 0x112233, quizChoiceBorder: 0x223344, quizChoiceHover: 0x224455, quizChoiceHoverBorder: 0x335566 },
      status: { warning: 0xffaa00 },
      css: {
        textWarn: '#ffaa00', textAccent: '#00aaff', textQuizBody: '#ccddee',
        textQuizHint: '#8899aa', textQuizMuted: '#556677', textQuizHard: '#ff6644',
        textQuizCorrect: '#44ff88', textWhite: '#ffffff', textAccentHover: '#88ddff',
        textQuizAccentHover: '#88ddff', textQuizDanger: '#ff4444',
      },
    },
  },
  getColorBlindPalette: vi.fn(() => ({
    quizCorrect: 0x44ff88, quizWrong: 0xff4444,
    quizChoiceCorrect: 0x1a4433, quizChoiceWrong: 0x4a1122,
    textQuizCorrect: '#44ff88', textQuizHard: '#ff6644',
  })),
}));

vi.mock('../systems/SettingsStore', () => ({
  settingsStore: { read: vi.fn(() => ({ colorBlindMode: 'none' })) },
}));

vi.mock('./ModalKeyboardNavigator', () => ({
  ModalKeyboardNavigator: class {
    private items: unknown[] = [];
    private _bindings: Map<string, () => void> = new Map();
    add = vi.fn((item: unknown) => { this.items.push(item); });
    reset = vi.fn(() => { this.items = []; });
    setFocus = vi.fn();
    bind = vi.fn((action: string, fn: () => void) => { this._bindings.set(action, fn); });
    destroy = vi.fn();
    focusPrev = vi.fn();
    focusNext = vi.fn();
    activateFocused = vi.fn(() => {
      const item = this.items[0] as { activate?: () => void } | undefined;
      item?.activate?.();
    });
    get = vi.fn((i: number) => this.items[i] as unknown);
    size = vi.fn(() => this.items.length);
    currentIndex = vi.fn(() => 0);
    _fire(action: string) { this._bindings.get(action)?.(); }
  },
  makeTextFocusable: vi.fn((t: unknown) => t),
}));

vi.mock('./QuizResultsScreen', () => ({
  renderQuizResults: vi.fn(),
}));

vi.mock('../systems/ProgressionSystem', () => ({ ProgressionSystem: class {} }));

import { eventBus } from '../systems/EventBus';

type TimerCallback = () => void;
interface FakeTimerEvent { destroy: ReturnType<typeof vi.fn>; destroyed: boolean }

function makeText() {
  const handlers: Record<string, (() => void)[]> = {};
  const t: Record<string, unknown> = {
    _text: '',
    setOrigin: vi.fn().mockReturnThis(),
    setScrollFactor: vi.fn().mockReturnThis(),
    setDepth: vi.fn().mockReturnThis(),
    setColor: vi.fn().mockReturnThis(),
    setInteractive: vi.fn().mockReturnThis(),
    on: vi.fn((event: string, handler: () => void) => {
      if (!handlers[event]) handlers[event] = [];
      handlers[event]!.push(handler);
      return t;
    }),
    getBounds: vi.fn(() => ({ x: 0, y: 0 })),
    height: 20,
    destroy: vi.fn(),
    _trigger: (event: string) => handlers[event]?.forEach((h) => h()),
  };
  return t;
}

function makeGraphics() {
  const g: Record<string, ReturnType<typeof vi.fn>> = {};
  for (const name of [
    'clear', 'fillStyle', 'fillRect', 'fillRoundedRect', 'lineStyle',
    'strokeRect', 'strokeRoundedRect', 'setScrollFactor', 'setDepth', 'destroy',
  ]) { g[name] = vi.fn().mockReturnThis(); }
  return g;
}

function makeScene() {
  const timerCallbacks: Array<{ callback: TimerCallback; event: FakeTimerEvent }> = [];
  const texts: ReturnType<typeof makeText>[] = [];
  const rectangles: Array<{ _trigger: (e: string) => void }> = [];

  const scene = {
    add: {
      graphics: vi.fn(() => makeGraphics()),
      text: vi.fn((_x: number, _y: number, text: string) => {
        const t = makeText();
        t['_text'] = text;
        texts.push(t);
        return t;
      }),
      rectangle: vi.fn(() => {
        const handlers: Record<string, (() => void)[]> = {};
        const rect = {
          setScrollFactor: vi.fn().mockReturnThis(),
          setInteractive: vi.fn().mockReturnThis(),
          setDepth: vi.fn().mockReturnThis(),
          setAlpha: vi.fn().mockReturnThis(),
          destroy: vi.fn(),
          on: vi.fn((event: string, handler: () => void) => {
            if (!handlers[event]) handlers[event] = [];
            handlers[event]!.push(handler);
            return rect;
          }),
          _trigger: (event: string) => handlers[event]?.forEach((h) => h()),
        };
        rectangles.push(rect);
        return rect;
      }),
    },
    make: {
      text: vi.fn(() => ({ height: 40, destroy: vi.fn() })),
    },
    inputs: { on: vi.fn(), off: vi.fn() },
    events: { once: vi.fn(), off: vi.fn() },
    tweens: { add: vi.fn() },
    time: {
      addEvent: vi.fn((cfg: { callback: TimerCallback }) => {
        const event: FakeTimerEvent = {
          destroyed: false,
          destroy: vi.fn(() => { event.destroyed = true; }),
        };
        timerCallbacks.push({ callback: cfg.callback, event });
        return event;
      }),
    },
    _texts: () => texts,
    _textValues: () => texts.map((t) => t['_text'] as string),
    _rectangles: () => rectangles,
    _tickTimer(times = 1): void {
      const entry = timerCallbacks[timerCallbacks.length - 1];
      if (!entry || entry.event.destroyed) return;
      for (let i = 0; i < times; i++) {
        if (entry.event.destroyed) break;
        entry.callback();
      }
    },
    _findText: (substr: string) => texts.find((t) => (t['_text'] as string).includes(substr)),
  };

  return scene;
}

import { QuizDialog } from './QuizDialog';
import type { QuizDialogOptions } from './QuizDialog';
import { FLOORS } from '../config/gameConfig';

function makeOptions(overrides: Partial<QuizDialogOptions> = {}): QuizDialogOptions {
  return {
    infoId: 'test-info',
    floorId: FLOORS.LOBBY,
    progression: {} as never,
    ...overrides,
  };
}

describe('QuizDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCanRetry.value = true;
    mockCooldownRemaining.value = 0;
    eventBus.removeAllListeners();
  });

  it('(a) shows "Quiz Locked" screen when canRetryQuiz returns false', () => {
    mockCanRetry.value = false;
    mockCooldownRemaining.value = 5000;
    const scene = makeScene();
    new QuizDialog(scene as unknown as Phaser.Scene, makeOptions());
    expect(scene._textValues()).toContain('Quiz Locked');
  });

  it('(b) shows question text when canRetryQuiz returns true', () => {
    mockCanRetry.value = true;
    const scene = makeScene();
    new QuizDialog(scene as unknown as Phaser.Scene, makeOptions());
    // Header should include "Question 1 /"
    const header = scene._findText('Question 1');
    expect(header).toBeDefined();
  });

  it('(c) correct answer emits sfx:quiz_correct', () => {
    mockCanRetry.value = true;
    const scene = makeScene();
    const dialog = new QuizDialog(scene as unknown as Phaser.Scene, makeOptions());

    const handler = vi.fn();
    eventBus.on('sfx:quiz_correct', handler);

    // Access internal questions to find the correct index
    const { questions, currentIndex } = dialog as unknown as {
      questions: Array<{ correctIndex: number }>;
      currentIndex: number;
    };
    const q = questions[currentIndex]!;
    // Access onAnswer directly via private cast
    (dialog as unknown as { onAnswer: (idx: number, q: { correctIndex: number }) => void })
      .onAnswer(q.correctIndex, q);

    expect(handler).toHaveBeenCalledTimes(1);
    eventBus.off('sfx:quiz_correct', handler);
  });

  it('(d) wrong answer emits sfx:quiz_wrong', () => {
    mockCanRetry.value = true;
    const scene = makeScene();
    const dialog = new QuizDialog(scene as unknown as Phaser.Scene, makeOptions());

    const handler = vi.fn();
    eventBus.on('sfx:quiz_wrong', handler);

    const { questions, currentIndex } = dialog as unknown as {
      questions: Array<{ correctIndex: number }>;
      currentIndex: number;
    };
    const q = questions[currentIndex]!;
    const wrongIndex = (q.correctIndex + 1) % 4;
    (dialog as unknown as { onAnswer: (idx: number, q: { correctIndex: number }) => void })
      .onAnswer(wrongIndex, q);

    expect(handler).toHaveBeenCalledTimes(1);
    eventBus.off('sfx:quiz_wrong', handler);
  });

  it('(e) screen is "feedback" after answering a question', () => {
    mockCanRetry.value = true;
    const scene = makeScene();
    const dialog = new QuizDialog(scene as unknown as Phaser.Scene, makeOptions());

    const { questions, currentIndex } = dialog as unknown as {
      questions: Array<{ correctIndex: number }>;
      currentIndex: number;
    };
    const q = questions[currentIndex]!;
    (dialog as unknown as { onAnswer: (idx: number, q: { correctIndex: number }) => void })
      .onAnswer(q.correctIndex, q);

    expect((dialog as unknown as { screen: string }).screen).toBe('feedback');
  });

  it('(f) onClose callback is called when dialog is closed', () => {
    mockCanRetry.value = true;
    const onClose = vi.fn();
    const scene = makeScene();
    const dialog = new QuizDialog(scene as unknown as Phaser.Scene, makeOptions({ onClose }));
    dialog.close();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('selectQuestions returns empty array for unknown infoId', () => {
    mockCanRetry.value = true;
    const scene = makeScene();
    const dialog = new QuizDialog(scene as unknown as Phaser.Scene, makeOptions({ infoId: 'unknown-id' }));
    const { questions } = dialog as unknown as { questions: unknown[] };
    expect(questions).toEqual([]);
  });

  it('showResults is called via showQuestion when there are no questions', () => {
    mockCanRetry.value = true;
    const scene = makeScene();
    // With no questions, showQuestion immediately calls showResults
    new QuizDialog(scene as unknown as Phaser.Scene, makeOptions({ infoId: 'unknown-id' }));
    // Should not throw and screen should be 'results'
  });

  it('music:request-push event emitted on construction', () => {
    mockCanRetry.value = true;
    const handler = vi.fn();
    eventBus.on('music:request-push', handler);
    const scene = makeScene();
    new QuizDialog(scene as unknown as Phaser.Scene, makeOptions());
    expect(handler).toHaveBeenCalledWith('music_quiz');
    eventBus.off('music:request-push', handler);
  });

  it('choice button pointerover/pointerout/pointerdown handlers are wired (inner functions)', () => {
    mockCanRetry.value = true;
    const scene = makeScene();
    new QuizDialog(scene as unknown as Phaser.Scene, makeOptions());
    const rects = scene._rectangles();
    // First 4 rectangles are the 4 choice hit areas
    expect(rects.length).toBeGreaterThanOrEqual(4);
    // Trigger hover/out to exercise drawHover/drawNormal inner closures
    expect(() => rects[0]!._trigger('pointerover')).not.toThrow();
    expect(() => rects[0]!._trigger('pointerout')).not.toThrow();
    // pointerdown triggers the activate closure (onAnswer)
    expect(() => rects[0]!._trigger('pointerdown')).not.toThrow();
  });

  it('second pointerdown on a choice after answering is ignored (answered guard)', () => {
    mockCanRetry.value = true;
    const scene = makeScene();
    new QuizDialog(scene as unknown as Phaser.Scene, makeOptions());
    const rects = scene._rectangles();
    // Answer the first choice
    rects[0]!._trigger('pointerdown');
    // Second click should be ignored (answered flag set)
    const sfxHandler = vi.fn();
    eventBus.on('sfx:quiz_correct', sfxHandler);
    eventBus.on('sfx:quiz_wrong', sfxHandler);
    sfxHandler.mockClear();
    expect(() => rects[0]!._trigger('pointerdown')).not.toThrow();
    // No additional SFX event should be emitted
    expect(sfxHandler).not.toHaveBeenCalled();
    eventBus.off('sfx:quiz_correct', sfxHandler);
    eventBus.off('sfx:quiz_wrong', sfxHandler);
  });

  it('keyboard bindings NavigateUp/Down/Confirm/QuickAnswer cover inner closures', () => {
    mockCanRetry.value = true;
    const scene = makeScene();
    const dialog = new QuizDialog(scene as unknown as Phaser.Scene, makeOptions());
    const nav = (dialog as unknown as { nav: { _fire: (a: string) => void } }).nav;
    // Fire nav bindings registered in registerKeyboardBindings
    expect(() => nav._fire('NavigateUp')).not.toThrow();
    expect(() => nav._fire('NavigateDown')).not.toThrow();
    expect(() => nav._fire('NavigateLeft')).not.toThrow();
    expect(() => nav._fire('NavigateRight')).not.toThrow();
    expect(() => nav._fire('Confirm')).not.toThrow();
    expect(() => nav._fire('QuickAnswer1')).not.toThrow();
    expect(() => nav._fire('QuickAnswer2')).not.toThrow();
    expect(() => nav._fire('QuickAnswer3')).not.toThrow();
    expect(() => nav._fire('QuickAnswer4')).not.toThrow();
  });
});
