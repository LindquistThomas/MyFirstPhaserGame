import { beforeEach, describe, expect, it, vi } from 'vitest';
import type * as Phaser from 'phaser';
import { DialogController } from './DialogController';
import type { ProgressionSystem } from '../systems/ProgressionSystem';
import { InfoDialog } from './InfoDialog';
import { QuizDialog } from './QuizDialog';
import { canRetryQuiz, getCooldownRemaining, isQuizPassed } from '../systems/QuizManager';

vi.mock('./InfoDialog', () => ({ InfoDialog: vi.fn() }));
vi.mock('./QuizDialog', () => ({ QuizDialog: vi.fn() }));
vi.mock('../systems/QuizManager', () => ({
  isQuizPassed: vi.fn(() => false),
  canRetryQuiz: vi.fn(() => true),
  getCooldownRemaining: vi.fn(() => 0),
}));

describe('DialogController', () => {
  const scene = {} as Phaser.Scene;
  const progression = {} as unknown as ProgressionSystem;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('ignores unknown content ids', () => {
    const controller = new DialogController(scene, {
      progression,
      getIconForContent: () => undefined,
    });

    controller.open('does-not-exist');
    expect(InfoDialog).not.toHaveBeenCalled();
    expect(controller.isOpen).toBe(false);
  });

  it('opens info dialog for known content and closes cleanly', () => {
    const onOpen = vi.fn();
    const onClose = vi.fn();
    const controller = new DialogController(scene, {
      progression,
      getIconForContent: () => undefined,
      onOpen,
      onClose,
    });

    controller.open('architecture-elevator');
    expect(controller.isOpen).toBe(true);
    expect(onOpen).toHaveBeenCalledWith('architecture-elevator');
    expect(InfoDialog).toHaveBeenCalledTimes(1);

    const infoDialogArgs = vi.mocked(InfoDialog).mock.calls[0]!;
    const closeCb = infoDialogArgs[2];
    const options = infoDialogArgs[3];
    expect(options).toMatchObject({
      quizStatus: { passed: false, canRetry: true, cooldownSeconds: 0 },
    });
    (closeCb as () => void)();
    expect(controller.isOpen).toBe(false);
    expect(onClose).toHaveBeenCalledWith('architecture-elevator');
  });

  it('passes no quiz options for info cards without quizzes', () => {
    const controller = new DialogController(scene, {
      progression,
      getIconForContent: () => undefined,
    });

    controller.open('welcome-board');
    const infoDialogArgs = vi.mocked(InfoDialog).mock.calls[0]!;
    const options = infoDialogArgs[3];
    expect(options).toBeUndefined();
  });

  it('opens quiz from info flow and refreshes icon badge on quiz close', () => {
    vi.mocked(isQuizPassed)
      .mockReturnValueOnce(false)
      .mockReturnValue(true);
    vi.mocked(canRetryQuiz).mockReturnValue(true);
    vi.mocked(getCooldownRemaining).mockReturnValue(0);

    const icon = { setQuizBadge: vi.fn() };
    const controller = new DialogController(scene, {
      progression,
      getIconForContent: () => icon as never,
    });

    controller.open('architecture-elevator');

    const infoDialogArgs = vi.mocked(InfoDialog).mock.calls[0]!;
    const closeInfo = infoDialogArgs[2] as () => void;
    const infoOptions = infoDialogArgs[3];
    closeInfo();
    infoOptions?.onQuizStart?.();

    expect(QuizDialog).toHaveBeenCalledTimes(1);
    expect(controller.isOpen).toBe(true);

    const quizDialogArgs = vi.mocked(QuizDialog).mock.calls[0]!;
    const quizOptions = quizDialogArgs[1] as { onClose: () => void };
    quizOptions.onClose();

    expect(controller.isOpen).toBe(false);
    expect(icon.setQuizBadge).toHaveBeenCalledWith(scene, true);
  });
});
