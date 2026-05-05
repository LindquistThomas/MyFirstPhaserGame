import * as Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, type FloorId } from '../config/gameConfig';
import { type NpcQuestion } from '../config/npcQuestionBank';
import { getNpcQuestion } from '../systems/llm/LlmClient';
import { ProgressionSystem } from '../systems/ProgressionSystem';
import { eventBus } from '../systems/EventBus';
import { theme } from '../style/theme';
import { ModalBase } from './ModalBase';
import { ModalKeyboardNavigator, makeTextFocusable } from './ModalKeyboardNavigator';

export interface NpcDialogOptions {
  npcName: string;
  topic: string;
  floorId: FloorId;
  progression: ProgressionSystem;
  onClose?: () => void;
}

export class NpcDialog extends ModalBase {
  private readonly nav: ModalKeyboardNavigator;
  private question?: NpcQuestion;
  private answered = false;
  private closed = false;
  private source: 'llm' | 'fallback' = 'fallback';

  constructor(scene: Phaser.Scene, private readonly options: NpcDialogOptions) {
    super(scene);
    this.nav = new ModalKeyboardNavigator(scene);
    this.registerKeyboardBindings();
    this.showLoading();
    this.fadeIn();
    // Reuse the existing quiz tension bed: NPC interactions are single-question
    // architecture challenges and do not warrant another bundled music asset.
    eventBus.emit('music:request-push', 'music_quiz');
    void this.loadQuestion();
  }

  private async loadQuestion(): Promise<void> {
    const result = await getNpcQuestion(this.options.floorId, this.options.topic);
    if (this.closed) return;
    this.question = result.question;
    this.source = result.source;
    this.showQuestion();
  }

  private clearPanel(): void {
    while (this.container.length > 1) this.container.removeAt(1, true);
    this.nav.reset();
  }

  private drawPanel(title: string, height = 560): { panelX: number; panelY: number; panelW: number; padding: number } {
    const panelW = 680;
    const panelX = (GAME_WIDTH - panelW) / 2;
    const panelY = (GAME_HEIGHT - height) / 2;
    const padding = 32;
    const bg = this.scene.add.graphics();
    bg.fillStyle(theme.color.ui.quizPanel, 0.96);
    bg.fillRoundedRect(panelX, panelY, panelW, height, 12);
    bg.lineStyle(2, theme.color.ui.accent, 0.75);
    bg.strokeRoundedRect(panelX, panelY, panelW, height, 12);
    this.container.add(bg);

    this.container.add(this.scene.add.text(GAME_WIDTH / 2, panelY + 24, title, {
      fontFamily: 'monospace', fontSize: '22px', color: theme.color.css.textAccent, fontStyle: 'bold',
    }).setOrigin(0.5, 0));

    const xBtn = this.scene.add.text(panelX + panelW - 22, panelY + 12, 'X', {
      fontFamily: 'monospace', fontSize: '16px', color: theme.color.css.textQuizMuted, fontStyle: 'bold',
    }).setOrigin(0.5, 0).setScrollFactor(0).setInteractive({ useHandCursor: true });
    xBtn.on('pointerdown', () => this.close());
    xBtn.on('pointerover', () => xBtn.setColor(theme.color.css.textQuizDanger));
    xBtn.on('pointerout', () => xBtn.setColor(theme.color.css.textQuizMuted));
    this.container.add(xBtn);
    this.nav.add(makeTextFocusable(xBtn, theme.color.css.textQuizMuted, theme.color.css.textQuizDanger));

    return { panelX, panelY, panelW, padding };
  }

  private showLoading(): void {
    this.clearPanel();
    const { panelY } = this.drawPanel(`${this.options.npcName} asks...`, 260);
    this.container.add(this.scene.add.text(GAME_WIDTH / 2, panelY + 118, 'Printing architecture question...', {
      fontFamily: 'monospace', fontSize: '17px', color: theme.color.css.textQuizBody,
    }).setOrigin(0.5, 0));
    this.nav.setFocus(0);
  }

  private showQuestion(): void {
    if (!this.question) return;
    this.clearPanel();
    this.answered = false;
    const { panelX, panelY, panelW, padding } = this.drawPanel(`${this.options.npcName} asks...`);
    const sourceLabel = this.source === 'llm' ? 'LLM-generated' : 'Offline question bank';

    this.container.add(this.scene.add.text(panelX + padding, panelY + 70, `${sourceLabel} · Topic: ${this.question.topic}`, {
      fontFamily: 'monospace', fontSize: '13px', color: theme.color.css.textQuizMuted,
    }));

    this.container.add(this.scene.add.text(panelX + padding, panelY + 102, this.question.question, {
      fontFamily: 'monospace', fontSize: '17px', color: theme.color.css.textQuizBody,
      wordWrap: { width: panelW - padding * 2 }, lineSpacing: 6,
    }));

    const startY = panelY + 210;
    const choiceH = 54;
    const gap = 10;
    this.question.options.forEach((choice, index) => {
      const y = startY + index * (choiceH + gap);
      const label = `${index + 1}. ${choice}`;
      const txt = this.scene.add.text(panelX + padding + 18, y + 14, label, {
        fontFamily: 'monospace', fontSize: '15px', color: theme.color.css.textQuizBody,
        wordWrap: { width: panelW - padding * 2 - 36 },
      }).setInteractive({ useHandCursor: true });
      const box = this.scene.add.graphics();
      box.fillStyle(theme.color.bg.mid, 0.55).fillRoundedRect(panelX + padding, y, panelW - padding * 2, choiceH, 8);
      box.lineStyle(1, theme.color.ui.border, 0.5).strokeRoundedRect(panelX + padding, y, panelW - padding * 2, choiceH, 8);
      txt.on('pointerover', () => txt.setColor(theme.color.css.textAccent));
      txt.on('pointerout', () => txt.setColor(theme.color.css.textQuizBody));
      txt.on('pointerdown', () => this.answer(index));
      this.container.add([box, txt]);
      this.nav.add(makeTextFocusable(txt, theme.color.css.textQuizBody, theme.color.css.textAccent));
    });

    this.container.add(this.scene.add.text(GAME_WIDTH / 2, panelY + 505, 'Use ↑/↓ + Enter, or press 1–4. Correct answer awards 1 AU.', {
      fontFamily: 'monospace', fontSize: '13px', color: theme.color.css.textQuizHint,
    }).setOrigin(0.5, 0));
    this.nav.setFocus(1);
  }

  private answer(index: number): void {
    if (!this.question || this.answered) return;
    this.answered = true;
    const correct = index === this.question.correctIndex;
    if (correct) {
      this.options.progression.addAU(this.options.floorId, 1);
      eventBus.emit('npc:answer:correct', { npcName: this.options.npcName, questionId: this.question.id });
      eventBus.emit('sfx:quiz_correct');
    } else {
      eventBus.emit('npc:answer:wrong', { npcName: this.options.npcName, questionId: this.question.id });
      eventBus.emit('sfx:quiz_wrong');
    }
    this.showFeedback(correct, index);
  }

  private showFeedback(correct: boolean, selectedIndex: number): void {
    if (!this.question) return;
    this.clearPanel();
    const { panelX, panelY, panelW, padding } = this.drawPanel(correct ? 'Nice architecture call!' : 'Not quite — iterate!', 400);
    const color = correct ? theme.color.css.textQuizCorrect : theme.color.css.textQuizDanger;
    this.container.add(this.scene.add.text(panelX + padding, panelY + 86, correct ? '+1 AU awarded' : 'No AU this time', {
      fontFamily: 'monospace', fontSize: '18px', color, fontStyle: 'bold',
    }));
    this.container.add(this.scene.add.text(panelX + padding, panelY + 130, `Your answer: ${this.question.options[selectedIndex]}`, {
      fontFamily: 'monospace', fontSize: '15px', color: theme.color.css.textQuizBody,
      wordWrap: { width: panelW - padding * 2 },
    }));
    this.container.add(this.scene.add.text(panelX + padding, panelY + 176, `Correct: ${this.question.options[this.question.correctIndex]}`, {
      fontFamily: 'monospace', fontSize: '15px', color: theme.color.css.textAccent,
      wordWrap: { width: panelW - padding * 2 },
    }));
    this.container.add(this.scene.add.text(panelX + padding, panelY + 230, this.question.explanation, {
      fontFamily: 'monospace', fontSize: '15px', color: theme.color.css.textQuizMuted,
      wordWrap: { width: panelW - padding * 2 }, lineSpacing: 6,
    }));

    const closeText = this.scene.add.text(GAME_WIDTH / 2, panelY + 330, '[ Continue ]', {
      fontFamily: 'monospace', fontSize: '16px', color: theme.color.css.textAccent, fontStyle: 'bold',
    }).setOrigin(0.5, 0).setInteractive({ useHandCursor: true });
    closeText.on('pointerdown', () => this.close());
    this.container.add(closeText);
    this.nav.add(makeTextFocusable(closeText, theme.color.css.textAccent, theme.color.css.textWhite));
    this.nav.setFocus(1);
  }

  private registerKeyboardBindings(): void {
    this.nav.bind('NavigateUp', () => this.nav.focusPrev());
    this.nav.bind('NavigateLeft', () => this.nav.focusPrev());
    this.nav.bind('NavigateDown', () => this.nav.focusNext());
    this.nav.bind('NavigateRight', () => this.nav.focusNext());
    this.nav.bind('Confirm', () => this.nav.activateFocused());
    this.nav.bind('QuickAnswer1', () => this.answer(0));
    this.nav.bind('QuickAnswer2', () => this.answer(1));
    this.nav.bind('QuickAnswer3', () => this.answer(2));
    this.nav.bind('QuickAnswer4', () => this.answer(3));
  }

  protected override onBeforeClose(): void {
    this.closed = true;
    eventBus.emit('music:pop');
    this.nav.destroy();
  }

  protected override onAfterClose(): void {
    this.options.onClose?.();
  }
}
