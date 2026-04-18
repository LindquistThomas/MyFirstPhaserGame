import * as Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, FloorId } from '../config/gameConfig';
import { QuizQuestion, QuizDifficulty, QUIZ_DATA, QUIZ_QUESTION_COUNT, QUIZ_DIFFICULTY_MIX } from '../config/quiz';
import { ProgressionSystem } from '../systems/ProgressionSystem';
import { isQuizPassed } from '../systems/QuizManager';
import { eventBus } from '../systems/EventBus';
import { ModalBase } from './ModalBase';
import { ModalKeyboardNavigator, makeTextFocusable } from './ModalKeyboardNavigator';
import { renderQuizResults } from './QuizResultsScreen';

export interface QuizDialogOptions {
  infoId: string;
  floorId: FloorId;
  progression: ProgressionSystem;
  onClose?: () => void;
}

/**
 * Multiple-choice quiz overlay.
 *
 * Uses the shared {@link ModalBase} for container/overlay/fade lifecycle,
 * {@link ModalKeyboardNavigator} for focus ring + keyboard bindings, and
 * {@link renderQuizResults} for the end-of-quiz summary.
 *
 * This class owns question selection, current-question state, and the
 * question + feedback rendering.
 */
export class QuizDialog extends ModalBase {
  private readonly options: QuizDialogOptions;
  private questions: QuizQuestion[];
  private currentIndex = 0;
  private score = 0;
  private answered = false;
  private alreadyPassed: boolean;
  private screen: 'question' | 'feedback' | 'results' = 'question';

  private nav!: ModalKeyboardNavigator;

  constructor(scene: Phaser.Scene, options: QuizDialogOptions) {
    super(scene);
    this.options = options;
    this.alreadyPassed = isQuizPassed(options.infoId);
    this.questions = this.selectQuestions(options.infoId);

    this.nav = new ModalKeyboardNavigator(scene, this.container);
    this.registerKeyboardBindings();
    this.showQuestion();
    this.fadeIn();
    eventBus.emit('music:push', 'music_quiz');
  }

  /** Pick a difficulty-balanced set of questions per QUIZ_DIFFICULTY_MIX. */
  private selectQuestions(infoId: string): QuizQuestion[] {
    const def = QUIZ_DATA[infoId];
    if (!def) return [];

    const byDiff: Record<QuizDifficulty, QuizQuestion[]> = { easy: [], medium: [], hard: [] };
    for (const q of def.questions) {
      byDiff[q.difficulty].push(q);
    }

    const shuffle = <T>(arr: T[]): T[] => {
      const a = arr.slice();
      for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
      }
      return a;
    };

    const selected: QuizQuestion[] = [];
    for (const diff of ['easy', 'medium', 'hard'] as QuizDifficulty[]) {
      const want = QUIZ_DIFFICULTY_MIX[diff];
      selected.push(...shuffle(byDiff[diff]).slice(0, want));
    }

    // Fall back: if a pool is short on a difficulty, top up from any remaining.
    if (selected.length < QUIZ_QUESTION_COUNT) {
      const usedIds = new Set(selected.map((q) => q.id));
      const leftover = shuffle(def.questions.filter((q) => !usedIds.has(q.id)));
      selected.push(...leftover.slice(0, QUIZ_QUESTION_COUNT - selected.length));
    }

    // Final shuffle so difficulty order isn't predictable within an attempt.
    return shuffle(selected);
  }

  private clearPanel(): void {
    // Remove everything except the overlay (index 0)
    while (this.container.length > 1) {
      this.container.removeAt(1, true);
    }
    this.nav.reset();
  }

  /* ---- question rendering ---- */

  private showQuestion(): void {
    this.clearPanel();
    this.answered = false;
    this.screen = 'question';

    const q = this.questions[this.currentIndex];
    if (!q) { this.showResults(); return; }

    const PANEL_W = 620;
    const PADDING = 32;
    const panelX = (GAME_WIDTH - PANEL_W) / 2;
    const CHOICE_H = 52;
    const CHOICE_GAP = 8;

    const qMeasure = this.scene.make.text({
      x: 0, y: 0,
      text: q.question,
      style: { fontFamily: 'monospace', fontSize: '16px', color: '#c0c8d4',
        wordWrap: { width: PANEL_W - PADDING * 2 }, lineSpacing: 6 },
      add: false,
    });
    const qHeight = qMeasure.height;
    qMeasure.destroy();

    const headerH = 70;
    const choicesH = 4 * CHOICE_H + 3 * CHOICE_GAP;
    const closeBarH = 44;
    const hintH = 24;
    const panelH = Math.min(headerH + qHeight + 20 + choicesH + hintH + closeBarH + PADDING * 2, GAME_HEIGHT - 40);
    const panelY = Math.max(20, (GAME_HEIGHT - panelH) / 2);

    const bg = this.scene.add.graphics();
    bg.fillStyle(0x0a0a2a, 0.95);
    bg.fillRoundedRect(panelX, panelY, PANEL_W, panelH, 10);
    bg.lineStyle(2, 0x00aaff, 0.7);
    bg.strokeRoundedRect(panelX, panelY, PANEL_W, panelH, 10);
    this.container.add(bg);

    let curY = panelY + PADDING;

    const header = this.scene.add.text(
      GAME_WIDTH / 2, curY,
      `Question ${this.currentIndex + 1} / ${this.questions.length}`,
      { fontFamily: 'monospace', fontSize: '22px', color: '#00d4ff', fontStyle: 'bold' },
    ).setOrigin(0.5, 0);
    this.container.add(header);

    const diffColors: Record<QuizDifficulty, string> = {
      easy: '#44ff88', medium: '#ffdd44', hard: '#ff6644',
    };
    const badge = this.scene.add.text(
      GAME_WIDTH / 2, curY + 30,
      `[${q.difficulty.toUpperCase()}]`,
      { fontFamily: 'monospace', fontSize: '14px', color: diffColors[q.difficulty], fontStyle: 'bold' },
    ).setOrigin(0.5, 0);
    this.container.add(badge);

    curY += headerH;

    const qText = this.scene.add.text(panelX + PADDING, curY, q.question, {
      fontFamily: 'monospace', fontSize: '16px', color: '#c0c8d4',
      wordWrap: { width: PANEL_W - PADDING * 2 }, lineSpacing: 6,
    });
    this.container.add(qText);
    curY += qHeight + 20;

    for (let i = 0; i < q.choices.length; i++) {
      const choiceY = curY + i * (CHOICE_H + CHOICE_GAP);
      this.createChoiceButton(panelX + PADDING, choiceY, PANEL_W - PADDING * 2, CHOICE_H, i, q);
    }

    const hintY = curY + 4 * CHOICE_H + 3 * CHOICE_GAP + 6;
    const hint = this.scene.add.text(
      GAME_WIDTH / 2, hintY,
      '[\u2191\u2193] Navigate   [1-4 / A-D] Answer   [Enter] Select   [Esc] Close',
      { fontFamily: 'monospace', fontSize: '12px', color: '#667788' },
    ).setOrigin(0.5, 0);
    this.container.add(hint);

    const xBtn = this.scene.add.text(panelX + PANEL_W - 18, panelY + 10, 'X', {
      fontFamily: 'monospace', fontSize: '16px', color: '#8899aa', fontStyle: 'bold',
    }).setOrigin(0.5, 0).setScrollFactor(0).setInteractive({ useHandCursor: true });
    xBtn.on('pointerover', () => xBtn.setColor('#ff6666'));
    xBtn.on('pointerout', () => xBtn.setColor('#8899aa'));
    xBtn.on('pointerdown', () => this.close());
    this.container.add(xBtn);
    this.nav.add(makeTextFocusable(xBtn, '#8899aa', '#ff6666'));

    this.nav.attachArrowTo(this.container);
    this.nav.setFocus(0);
  }

  private createChoiceButton(
    x: number, y: number, w: number, h: number,
    index: number, question: QuizQuestion,
  ): void {
    const prefix = String.fromCharCode(65 + index); // A, B, C, D
    const label = `${prefix}.  ${question.choices[index]}`;

    const btnBg = this.scene.add.graphics();
    const drawNormal = () => {
      btnBg.clear();
      btnBg.fillStyle(0x1a2a3a, 1);
      btnBg.fillRoundedRect(x, y, w, h, 6);
      btnBg.lineStyle(1, 0x2a4a6a, 0.6);
      btnBg.strokeRoundedRect(x, y, w, h, 6);
    };
    const drawHover = () => {
      btnBg.clear();
      btnBg.fillStyle(0x2a4a6a, 1);
      btnBg.fillRoundedRect(x, y, w, h, 6);
      btnBg.lineStyle(1, 0x4a6a8a, 0.8);
      btnBg.strokeRoundedRect(x, y, w, h, 6);
    };
    drawNormal();
    this.container.add(btnBg);

    const btnText = this.scene.add.text(x + 16, y + h / 2, label, {
      fontFamily: 'monospace', fontSize: '15px', color: '#c0c8d4',
      wordWrap: { width: w - 32 },
    }).setOrigin(0, 0.5);
    this.container.add(btnText);

    const hitArea = this.scene.add.rectangle(x + w / 2, y + h / 2, w, h)
      .setScrollFactor(0)
      .setInteractive({ useHandCursor: true })
      .setAlpha(0.001);
    this.container.add(hitArea);

    hitArea.on('pointerover', () => {
      if (this.answered) return;
      drawHover();
      btnText.setColor('#ffffff');
    });

    hitArea.on('pointerout', () => {
      if (this.answered) return;
      drawNormal();
      btnText.setColor('#c0c8d4');
    });

    const activate = () => {
      if (this.answered) return;
      this.onAnswer(index, question);
    };
    hitArea.on('pointerdown', activate);

    this.nav.add({
      focus: () => { drawHover(); btnText.setColor('#ffffff'); },
      blur: () => { drawNormal(); btnText.setColor('#c0c8d4'); },
      activate,
      bounds: () => new Phaser.Geom.Rectangle(x, y, w, h),
    });
  }

  private onAnswer(selectedIndex: number, question: QuizQuestion): void {
    this.answered = true;
    const correct = selectedIndex === question.correctIndex;
    if (correct) this.score++;

    eventBus.emit(correct ? 'sfx:quiz_correct' : 'sfx:quiz_wrong');
    this.showAnswerFeedback(question, selectedIndex);
  }

  private showAnswerFeedback(question: QuizQuestion, selectedIndex: number): void {
    this.clearPanel();
    this.screen = 'feedback';

    const correct = selectedIndex === question.correctIndex;
    const PANEL_W = 620;
    const PADDING = 32;
    const panelX = (GAME_WIDTH - PANEL_W) / 2;
    const CHOICE_H = 52;
    const CHOICE_GAP = 8;

    const qMeasure = this.scene.make.text({
      x: 0, y: 0, text: question.question,
      style: { fontFamily: 'monospace', fontSize: '16px', color: '#c0c8d4',
        wordWrap: { width: PANEL_W - PADDING * 2 }, lineSpacing: 6 },
      add: false,
    });
    const qHeight = qMeasure.height;
    qMeasure.destroy();

    const expMeasure = this.scene.make.text({
      x: 0, y: 0, text: question.explanation,
      style: { fontFamily: 'monospace', fontSize: '14px', color: '#8899aa',
        wordWrap: { width: PANEL_W - PADDING * 2 - 12 }, lineSpacing: 4 },
      add: false,
    });
    const expHeight = expMeasure.height;
    expMeasure.destroy();

    const headerH = 70;
    const choicesH = 4 * CHOICE_H + 3 * CHOICE_GAP;
    const explanationH = expHeight + 24;
    const nextBtnH = 52;
    const panelH = Math.min(
      headerH + qHeight + 20 + choicesH + explanationH + nextBtnH + PADDING * 2,
      GAME_HEIGHT - 40,
    );
    const panelY = Math.max(20, (GAME_HEIGHT - panelH) / 2);

    const bg = this.scene.add.graphics();
    bg.fillStyle(0x0a0a2a, 0.95);
    bg.fillRoundedRect(panelX, panelY, PANEL_W, panelH, 10);
    bg.lineStyle(2, correct ? 0x44ff88 : 0xff4444, 0.7);
    bg.strokeRoundedRect(panelX, panelY, PANEL_W, panelH, 10);
    this.container.add(bg);

    let curY = panelY + PADDING;

    const diffColors: Record<QuizDifficulty, string> = {
      easy: '#44ff88', medium: '#ffdd44', hard: '#ff6644',
    };
    const resultText = correct ? 'Correct!' : 'Wrong!';
    const resultColor = correct ? '#44ff88' : '#ff6644';

    const header = this.scene.add.text(
      GAME_WIDTH / 2, curY, resultText,
      { fontFamily: 'monospace', fontSize: '22px', color: resultColor, fontStyle: 'bold' },
    ).setOrigin(0.5, 0);
    this.container.add(header);

    const badge = this.scene.add.text(
      GAME_WIDTH / 2, curY + 30,
      `Question ${this.currentIndex + 1} / ${this.questions.length}  [${question.difficulty.toUpperCase()}]`,
      { fontFamily: 'monospace', fontSize: '14px', color: diffColors[question.difficulty] },
    ).setOrigin(0.5, 0);
    this.container.add(badge);

    curY += headerH;

    const qText = this.scene.add.text(panelX + PADDING, curY, question.question, {
      fontFamily: 'monospace', fontSize: '16px', color: '#8899aa',
      wordWrap: { width: PANEL_W - PADDING * 2 }, lineSpacing: 6,
    });
    this.container.add(qText);
    curY += qHeight + 20;

    for (let i = 0; i < question.choices.length; i++) {
      const choiceY = curY + i * (CHOICE_H + CHOICE_GAP);
      const prefix = String.fromCharCode(65 + i);
      const isCorrect = i === question.correctIndex;
      const isSelected = i === selectedIndex;

      let fillColor = 0x1a2a3a;
      let borderColor = 0x2a4a6a;
      let textColor = '#667788';

      if (isCorrect) {
        fillColor = 0x1a4a2a;
        borderColor = 0x44ff88;
        textColor = '#44ff88';
      } else if (isSelected && !isCorrect) {
        fillColor = 0x4a1a1a;
        borderColor = 0xff4444;
        textColor = '#ff6644';
      }

      const btnBg = this.scene.add.graphics();
      btnBg.fillStyle(fillColor, 1);
      btnBg.fillRoundedRect(panelX + PADDING, choiceY, PANEL_W - PADDING * 2, CHOICE_H, 6);
      btnBg.lineStyle(isCorrect || isSelected ? 2 : 1, borderColor, isCorrect || isSelected ? 1 : 0.6);
      btnBg.strokeRoundedRect(panelX + PADDING, choiceY, PANEL_W - PADDING * 2, CHOICE_H, 6);
      this.container.add(btnBg);

      const marker = isCorrect ? '\u2713' : (isSelected ? '\u2717' : ' ');
      const btnText = this.scene.add.text(
        panelX + PADDING + 16, choiceY + CHOICE_H / 2,
        `${prefix}. ${marker} ${question.choices[i]}`,
        { fontFamily: 'monospace', fontSize: '15px', color: textColor,
          wordWrap: { width: PANEL_W - PADDING * 2 - 32 } },
      ).setOrigin(0, 0.5);
      this.container.add(btnText);
    }

    curY += 4 * CHOICE_H + 3 * CHOICE_GAP + 16;

    const expText = this.scene.add.text(panelX + PADDING + 6, curY, question.explanation, {
      fontFamily: 'monospace', fontSize: '14px', color: '#8899aa',
      wordWrap: { width: PANEL_W - PADDING * 2 - 12 }, lineSpacing: 4,
    });
    this.container.add(expText);

    const expBorder = this.scene.add.graphics();
    expBorder.fillStyle(correct ? 0x44ff88 : 0xff4444, 0.6);
    expBorder.fillRect(panelX + PADDING, curY - 2, 3, expHeight + 4);
    this.container.add(expBorder);

    curY += explanationH;

    const isLast = this.currentIndex >= this.questions.length - 1;
    const nextLabel = isLast ? '[  SEE RESULTS  ]' : '[  NEXT QUESTION  ]';

    const nextBtn = this.scene.add.text(GAME_WIDTH / 2, curY, nextLabel, {
      fontFamily: 'monospace', fontSize: '16px', color: '#00d4ff', fontStyle: 'bold',
    }).setOrigin(0.5, 0).setScrollFactor(0).setInteractive({ useHandCursor: true });

    nextBtn.on('pointerover', () => nextBtn.setColor('#88ddff'));
    nextBtn.on('pointerout', () => nextBtn.setColor('#00d4ff'));
    nextBtn.on('pointerdown', () => {
      this.currentIndex++;
      if (this.currentIndex < this.questions.length) {
        this.showQuestion();
      } else {
        this.showResults();
      }
    });
    this.container.add(nextBtn);
    this.nav.add(makeTextFocusable(nextBtn, '#00d4ff', '#88ddff'));

    const xBtn = this.scene.add.text(panelX + PANEL_W - 18, panelY + 10, 'X', {
      fontFamily: 'monospace', fontSize: '16px', color: '#8899aa', fontStyle: 'bold',
    }).setOrigin(0.5, 0).setScrollFactor(0).setInteractive({ useHandCursor: true });
    xBtn.on('pointerover', () => xBtn.setColor('#ff6666'));
    xBtn.on('pointerout', () => xBtn.setColor('#8899aa'));
    xBtn.on('pointerdown', () => this.close());
    this.container.add(xBtn);
    this.nav.add(makeTextFocusable(xBtn, '#8899aa', '#ff6666'));

    this.nav.attachArrowTo(this.container);
    this.nav.setFocus(0);
  }

  private showResults(): void {
    this.clearPanel();
    this.screen = 'results';

    renderQuizResults({
      scene: this.scene,
      container: this.container,
      navigator: this.nav,
      progression: this.options.progression,
      floorId: this.options.floorId,
      infoId: this.options.infoId,
      score: this.score,
      total: this.questions.length,
      alreadyPassed: this.alreadyPassed,
      onClose: () => this.close(),
    });
  }

  protected override onAfterClose(): void {
    this.options.onClose?.();
  }

  /* ---- keyboard bindings ---- */

  private registerKeyboardBindings(): void {
    const prev = () => this.nav.focusPrev();
    const next = () => this.nav.focusNext();
    const activate = () => this.nav.activateFocused();
    const pickAnswer = (index: number) => () => {
      if (this.screen !== 'question' || this.answered) return;
      const q = this.questions[this.currentIndex];
      if (!q || index >= q.choices.length) return;
      this.nav.setFocus(index);
      this.nav.get(index)?.activate();
    };

    this.nav.bind('NavigateUp', prev);
    this.nav.bind('NavigateLeft', prev);
    this.nav.bind('NavigateDown', next);
    this.nav.bind('NavigateRight', next);
    this.nav.bind('Confirm', activate);
    this.nav.bind('QuickAnswer1', pickAnswer(0));
    this.nav.bind('QuickAnswer2', pickAnswer(1));
    this.nav.bind('QuickAnswer3', pickAnswer(2));
    this.nav.bind('QuickAnswer4', pickAnswer(3));
  }

  protected override onBeforeClose(): void {
    eventBus.emit('music:pop');
    this.nav.destroy();
  }
}
