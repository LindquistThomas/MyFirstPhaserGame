import { describe, it, expect, vi } from 'vitest';
import type * as Phaser from 'phaser';
import type { FloorId } from '../../../config/gameConfig';

// ---- Phaser stub ----
vi.mock('phaser', () => ({
  default: {},
}));

// ---- DialogController stub — vi.fn() captures constructor call args ----
const mockDialogControllerCtor = vi.hoisted(() => vi.fn());

vi.mock('../../../ui/DialogController', () => ({
  DialogController: class MockDialogController {
    constructor(scene: unknown, opts: unknown) {
      mockDialogControllerCtor(scene, opts);
    }
    get isOpen() { return false; }
    open = vi.fn();
  },
}));

// ---- INFO_POINTS / QUIZ_DATA stubs (not needed for these tests) ----
vi.mock('../../../config/info', () => ({ INFO_POINTS: {}, getInfoReadiness: vi.fn(() => Promise.resolve()) }));
vi.mock('../../../config/quiz', () => ({ QUIZ_DATA: {} }));
vi.mock('../../../systems/QuizManager', () => ({
  isQuizPassed: vi.fn(() => false),
  canRetryQuiz: vi.fn(() => false),
  getCooldownRemaining: vi.fn(() => 0),
}));

import { createLevelDialogs } from './LevelDialogBindings';

const STUB_FLOOR_ID = 0 as FloorId;

// ── helpers ─────────────────────────────────────────────────────────────────

interface CapturedOpts {
  progression: unknown;
  getIconForContent: (id: string) => unknown;
  onOpen?: (id: string) => void;
  onClose?: (id: string) => void;
}

/** Returns the options object captured by the last DialogController constructor call. */
function lastCapturedOpts(): CapturedOpts {
  const calls = mockDialogControllerCtor.mock.calls;
  return calls[calls.length - 1]![1] as CapturedOpts;
}

function makeGameState(overrides: Partial<{
  markSeen: ReturnType<typeof vi.fn>;
  checkAchievements: ReturnType<typeof vi.fn>;
  progression: unknown;
  isQuizPassed: ReturnType<typeof vi.fn>;
}> = {}) {
  return {
    markSeen: overrides.markSeen ?? vi.fn(),
    checkAchievements: overrides.checkAchievements ?? vi.fn(),
    progression: overrides.progression ?? {},
    isQuizPassed: overrides.isQuizPassed ?? vi.fn(() => false),
  } as unknown as import('../../../systems/GameStateManager').GameStateManager;
}

// ── tests ────────────────────────────────────────────────────────────────────

describe('createLevelDialogs', () => {
  it('returns a DialogController instance', () => {
    mockDialogControllerCtor.mockClear();
    const scene = {} as Phaser.Scene;
    const gameState = makeGameState();
    const result = createLevelDialogs(scene, {
      gameState,
      getIcon: () => undefined,
      floorId: STUB_FLOOR_ID,
    });
    // The returned object is the mocked DialogController
    expect(result).toBeDefined();
  });

  it('passes gameState.progression to DialogController', () => {
    mockDialogControllerCtor.mockClear();
    const progressionStub = { foo: true };
    const gameState = makeGameState({ progression: progressionStub });
    createLevelDialogs({} as Phaser.Scene, { gameState, getIcon: () => undefined, floorId: STUB_FLOOR_ID });
    expect(lastCapturedOpts().progression).toBe(progressionStub);
  });

  it('passes getIcon callback through as getIconForContent', () => {
    mockDialogControllerCtor.mockClear();
    const getIcon = vi.fn(() => undefined);
    const gameState = makeGameState();
    createLevelDialogs({} as Phaser.Scene, { gameState, getIcon, floorId: STUB_FLOOR_ID });
    lastCapturedOpts().getIconForContent('test-id');
    expect(getIcon).toHaveBeenCalledWith('test-id');
  });
});

describe('createLevelDialogs — onOpen callback', () => {
  it('calls gameState.markSeen with the contentId', () => {
    mockDialogControllerCtor.mockClear();
    const markSeen = vi.fn();
    const gameState = makeGameState({ markSeen });
    createLevelDialogs({} as Phaser.Scene, { gameState, getIcon: () => undefined, floorId: STUB_FLOOR_ID });
    lastCapturedOpts().onOpen?.('my-content');
    expect(markSeen).toHaveBeenCalledWith('my-content');
  });

  it('calls gameState.checkAchievements', () => {
    mockDialogControllerCtor.mockClear();
    const checkAchievements = vi.fn();
    const gameState = makeGameState({ checkAchievements });
    createLevelDialogs({} as Phaser.Scene, { gameState, getIcon: () => undefined, floorId: STUB_FLOOR_ID });
    lastCapturedOpts().onOpen?.('my-content');
    expect(checkAchievements).toHaveBeenCalledOnce();
  });
});

describe('createLevelDialogs — onClose callback', () => {
  it('calls markAsSeen on the returned icon when it exists', () => {
    mockDialogControllerCtor.mockClear();
    const markAsSeen = vi.fn();
    const fakeIcon = { markAsSeen, setQuizBadge: vi.fn() } as unknown as import('../../../ui/InfoIcon').InfoIcon;
    const getIcon = vi.fn(() => fakeIcon);
    const gameState = makeGameState();
    createLevelDialogs({} as Phaser.Scene, { gameState, getIcon, floorId: STUB_FLOOR_ID });
    lastCapturedOpts().onClose?.('my-content');
    expect(markAsSeen).toHaveBeenCalledOnce();
  });

  it('does not throw when getIcon returns undefined', () => {
    mockDialogControllerCtor.mockClear();
    const gameState = makeGameState();
    createLevelDialogs({} as Phaser.Scene, { gameState, getIcon: () => undefined, floorId: STUB_FLOOR_ID });
    expect(() => lastCapturedOpts().onClose?.('my-content')).not.toThrow();
  });

  it('calls gameState.checkAchievements after close', () => {
    mockDialogControllerCtor.mockClear();
    const checkAchievements = vi.fn();
    const gameState = makeGameState({ checkAchievements });
    createLevelDialogs({} as Phaser.Scene, { gameState, getIcon: () => undefined, floorId: STUB_FLOOR_ID });
    lastCapturedOpts().onClose?.('my-content');
    expect(checkAchievements).toHaveBeenCalledOnce();
  });

  it('calls getIcon with the correct contentId on close', () => {
    mockDialogControllerCtor.mockClear();
    const getIcon = vi.fn(() => undefined);
    const gameState = makeGameState();
    createLevelDialogs({} as Phaser.Scene, { gameState, getIcon, floorId: STUB_FLOOR_ID });
    lastCapturedOpts().onClose?.('specific-id');
    expect(getIcon).toHaveBeenCalledWith('specific-id');
  });
});
