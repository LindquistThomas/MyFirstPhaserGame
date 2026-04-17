import * as Phaser from 'phaser';
import { INFO_POINTS } from '../config/infoContent';
import { QUIZ_DATA } from '../config/quizData';
import { ProgressionSystem } from '../systems/ProgressionSystem';
import { isQuizPassed, canRetryQuiz, getCooldownRemaining } from '../systems/QuizManager';
import { InfoDialog } from './InfoDialog';
import { QuizDialog } from './QuizDialog';
import { InfoIcon } from './InfoIcon';

export interface DialogControllerOptions {
  progression: ProgressionSystem;
  /**
   * Resolve the InfoIcon associated with a content id so badges can be
   * refreshed after the quiz closes. Returning undefined skips the refresh.
   */
  getIconForContent: (contentId: string) => InfoIcon | undefined;
  /** Scene-specific hook fired right before the info dialog is constructed. */
  onOpen?: (contentId: string) => void;
  /** Scene-specific hook fired after the info dialog is closed. */
  onClose?: (contentId: string) => void;
}

/**
 * Shared orchestrator for info + quiz dialogs.
 *
 * Both HubScene and LevelScene used to carry near-identical
 * `openInfoDialog` / `openQuizDialog` pairs. This class owns that flow:
 * the dialog-open guard, INFO_POINTS / QUIZ_DATA lookups, quiz-status
 * derivation, and parent-to-child badge refresh after a quiz closes.
 *
 * Scene-specific behavior is injected via the `onOpen` / `onClose` hooks
 * and the `getIconForContent` lookup — no scene needs to know how the
 * dialogs are built.
 */
export class DialogController {
  private dialogOpen = false;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly options: DialogControllerOptions,
  ) {}

  get isOpen(): boolean {
    return this.dialogOpen;
  }

  /** Open the info dialog for `contentId`; no-op if any dialog is already open. */
  open(contentId: string): void {
    if (this.dialogOpen) return;

    const infoDef = INFO_POINTS[contentId];
    if (!infoDef) return;

    this.dialogOpen = true;
    this.options.onOpen?.(contentId);

    const hasQuiz = !!QUIZ_DATA[contentId];

    new InfoDialog(
      this.scene,
      infoDef.content,
      () => {
        this.dialogOpen = false;
        this.options.onClose?.(contentId);
      },
      hasQuiz ? {
        onQuizStart: () => this.openQuiz(contentId),
        quizStatus: {
          passed: isQuizPassed(contentId),
          canRetry: canRetryQuiz(contentId),
          cooldownSeconds: Math.ceil(getCooldownRemaining(contentId) / 1000),
        },
      } : undefined,
    );
  }

  private openQuiz(contentId: string): void {
    if (this.dialogOpen) return;

    const infoDef = INFO_POINTS[contentId];
    if (!infoDef) return;

    this.dialogOpen = true;

    new QuizDialog(this.scene, {
      infoId: contentId,
      floorId: infoDef.floorId,
      progression: this.options.progression,
      onClose: () => {
        this.dialogOpen = false;
        const icon = this.options.getIconForContent(contentId);
        if (icon && QUIZ_DATA[contentId]) {
          icon.setQuizBadge(this.scene, isQuizPassed(contentId));
        }
      },
    });
  }
}
