import * as Phaser from 'phaser';
import { INFO_POINTS, getInfoReadiness } from '../config/info';
import { QUIZ_DATA } from '../config/quiz';
import { type FloorId } from '../config/gameConfig';
import { ProgressionSystem } from '../systems/ProgressionSystem';
import { isQuizPassed, canRetryQuiz, getCooldownRemaining } from '../systems/QuizManager';
import { InfoDialog } from './InfoDialog';
import { QuizDialog } from './QuizDialog';
import { InfoIcon } from './InfoIcon';
import { Toast } from './Toast';

/** How long (ms) to wait for the lazy info import before giving up. */
const READINESS_TIMEOUT_MS = 2_000;

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
  /**
   * Floor whose lazy-import readiness to await when `INFO_POINTS` is not yet
   * populated for the requested content id.  If omitted the controller falls
   * back to the original silent no-op behaviour for unknown ids.
   */
  floorId?: FloorId;
}

/**
 * Shared orchestrator for info + quiz dialogs.
 *
 * Both ElevatorScene and LevelScene used to carry near-identical
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
  private _loadingToast: Toast | null = null;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly options: DialogControllerOptions,
  ) {}

  get isOpen(): boolean {
    return this.dialogOpen;
  }

  /** Open the info dialog for `contentId`; no-op if any dialog is already open. */
  open(contentId: string): void {
    void this._openAsync(contentId);
  }

  private async _openAsync(contentId: string): Promise<void> {
    if (this.dialogOpen) return;

    let infoDef = INFO_POINTS[contentId];

    if (!infoDef && this.options.floorId !== undefined) {
      // Data not ready yet — await the in-flight lazy import (with a 2 s cap).
      const toast = this._getOrCreateToast();
      toast?.show('Loading…', READINESS_TIMEOUT_MS + 500);

      let timedOut = false;
      await Promise.race([
        getInfoReadiness(this.options.floorId),
        new Promise<void>((resolve) => setTimeout(() => { timedOut = true; resolve(); }, READINESS_TIMEOUT_MS)),
      ]);

      // Dismiss the loading toast now that the wait is over.
      this._loadingToast?.destroy();
      this._loadingToast = null;

      if (timedOut) {
        console.warn(`[DialogController] Timed out waiting for info data for "${contentId}"`);
        return;
      }

      // Guard: another open() call may have succeeded during the await.
      if (this.dialogOpen) return;
      infoDef = INFO_POINTS[contentId];
    }

    if (!infoDef) return;

    // Final guard: a concurrent open() may have won the race.
    if (this.dialogOpen) return;

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

  /**
   * Lazily create the loading-toast on first use.
   * Returns null if the scene doesn't expose the required Phaser APIs
   * (e.g. in unit tests that stub the scene as a bare object).
   */
  private _getOrCreateToast(): Toast | null {
    if (this._loadingToast) return this._loadingToast;
    try {
      this._loadingToast = new Toast(this.scene);
    } catch {
      return null;
    }
    return this._loadingToast;
  }
}
