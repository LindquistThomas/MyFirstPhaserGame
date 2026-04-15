import * as Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, FloorId } from '../config/gameConfig';
import { QuizQuestion, QuizDifficulty, QUIZ_DATA, QUIZ_REWARDS, QUIZ_PASS_THRESHOLD } from '../config/quizData';
import { ProgressionSystem } from '../systems/ProgressionSystem';
import { saveQuizResult, isQuizPassed } from '../systems/QuizManager';
import { eventBus } from '../systems/EventBus';

export interface QuizDialogOptions {
  infoId: string;
  floorId: FloorId;
  progression: ProgressionSystem;
  onClose?: () => void;
}

/**
 * Multiple-choice quiz overlay.
 *
 * Follows the same Phaser Container + overlay pattern as InfoDialog:
 * depth 200, scrollFactor 0, fade in/out tweens.
 */
export class QuizDialog {
  private scene: Phaser.Scene;
  private container: Phaser.GameObjects.Container;
  private options: QuizDialogOptions;
  private questions: QuizQuestion[];
  private currentIndex = 0;
  private score = 0;
  private answered = false;
  private destroyed = false;
  private escKey: Phaser.Input.Keyboard.Key | null = null;
  private escHandler: (() => void) | null = null;
  private alreadyPassed: boolean;

  constructor(scene: Phaser.Scene, options: QuizDialogOptions) {
    this.scene = scene;
    this.options = options;
    this.alreadyPassed = isQuizPassed(options.infoId);
    this.questions = this.selectQuestions(options.infoId);

    this.container = scene.add.container(0, 0);
    this.container.setDepth(200);
    this.container.setScrollFactor(0);
    this.container.setAlpha(0);

    this.buildOverlay();
    this.showQuestion();
    this.registerEscKey();

    scene.tweens.add({ targets: this.container, alpha: 1, duration: 200 });
  }

  /** Pick 1 easy + 1 medium + 1 hard from the question pool. */
  private selectQuestions(infoId: string): QuizQuestion[] {
    const def = QUIZ_DATA[infoId];
    if (!def) return [];

    const byDiff: Record<QuizDifficulty, QuizQuestion[]> = { easy: [], medium: [], hard: [] };
    for (const q of def.questions) {
      byDiff[q.difficulty].push(q);
    }

    const pick = (arr: QuizQuestion[]): QuizQuestion =>
      arr[Math.floor(Math.random() * arr.length)];

    const selected: QuizQuestion[] = [];
    if (byDiff.easy.length) selected.push(pick(byDiff.easy));
    if (byDiff.medium.length) selected.push(pick(byDiff.medium));
    if (byDiff.hard.length) selected.push(pick(byDiff.hard));
    return selected;
  }

  private buildOverlay(): void {
    const overlay = this.scene.add.rectangle(
      GAME_WIDTH / 2, GAME_HEIGHT / 2,
      GAME_WIDTH, GAME_HEIGHT,
      0x000000, 0.65,
    );
    overlay.setScrollFactor(0).setInteractive(); // block clicks through
    this.container.add(overlay);
  }

  private clearPanel(): void {
    // Remove everything except the overlay (index 0)
    while (this.container.length > 1) {
      this.container.removeAt(1, true);
    }
  }

  /* ---- question rendering ---- */

  private showQuestion(): void {
    this.clearPanel();
    this.answered = false;

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
    const panelH = Math.min(headerH + qHeight + 20 + choicesH + closeBarH + PADDING * 2, GAME_HEIGHT - 40);
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
      { fontFamily: 'monospace', fontSize: '13px', color: diffColors[q.difficulty], fontStyle: 'bold' },
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

    const xBtn = this.scene.add.text(panelX + PANEL_W - 18, panelY + 10, 'X', {
      fontFamily: 'monospace', fontSize: '16px', color: '#556677', fontStyle: 'bold',
    }).setOrigin(0.5, 0).setScrollFactor(0).setInteractive({ useHandCursor: true });
    xBtn.on('pointerover', () => xBtn.setColor('#ff6666'));
    xBtn.on('pointerout', () => xBtn.setColor('#556677'));
    xBtn.on('pointerdown', () => this.close());
    this.container.add(xBtn);
  }

  private createChoiceButton(
    x: number, y: number, w: number, h: number,
    index: number, question: QuizQuestion,
  ): void {
    const prefix = String.fromCharCode(65 + index); // A, B, C, D
    const label = `${prefix}.  ${question.choices[index]}`;

    const btnBg = this.scene.add.graphics();
    btnBg.fillStyle(0x1a2a3a, 1);
    btnBg.fillRoundedRect(x, y, w, h, 6);
    btnBg.lineStyle(1, 0x2a4a6a, 0.6);
    btnBg.strokeRoundedRect(x, y, w, h, 6);
    this.container.add(btnBg);

    const btnText = this.scene.add.text(x + 16, y + h / 2, label, {
      fontFamily: 'monospace', fontSize: '14px', color: '#c0c8d4',
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
      btnBg.clear();
      btnBg.fillStyle(0x2a4a6a, 1);
      btnBg.fillRoundedRect(x, y, w, h, 6);
      btnBg.lineStyle(1, 0x4a6a8a, 0.8);
      btnBg.strokeRoundedRect(x, y, w, h, 6);
      btnText.setColor('#ffffff');
    });

    hitArea.on('pointerout', () => {
      if (this.answered) return;
      btnBg.clear();
      btnBg.fillStyle(0x1a2a3a, 1);
      btnBg.fillRoundedRect(x, y, w, h, 6);
      btnBg.lineStyle(1, 0x2a4a6a, 0.6);
      btnBg.strokeRoundedRect(x, y, w, h, 6);
      btnText.setColor('#c0c8d4');
    });

    hitArea.on('pointerdown', () => {
      if (this.answered) return;
      this.onAnswer(index, question);
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
      style: { fontFamily: 'monospace', fontSize: '13px', color: '#8899aa',
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
      { fontFamily: 'monospace', fontSize: '13px', color: diffColors[question.difficulty] },
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
        { fontFamily: 'monospace', fontSize: '14px', color: textColor,
          wordWrap: { width: PANEL_W - PADDING * 2 - 32 } },
      ).setOrigin(0, 0.5);
      this.container.add(btnText);
    }

    curY += 4 * CHOICE_H + 3 * CHOICE_GAP + 16;

    const expText = this.scene.add.text(panelX + PADDING + 6, curY, question.explanation, {
      fontFamily: 'monospace', fontSize: '13px', color: '#8899aa',
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

    const xBtn = this.scene.add.text(panelX + PANEL_W - 18, panelY + 10, 'X', {
      fontFamily: 'monospace', fontSize: '16px', color: '#556677', fontStyle: 'bold',
    }).setOrigin(0.5, 0).setScrollFactor(0).setInteractive({ useHandCursor: true });
    xBtn.on('pointerover', () => xBtn.setColor('#ff6666'));
    xBtn.on('pointerout', () => xBtn.setColor('#556677'));
    xBtn.on('pointerdown', () => this.close());
    this.container.add(xBtn);
  }

  private showResults(): void {
    this.clearPanel();

    const total = this.questions.length;
    const passed = this.score >= QUIZ_PASS_THRESHOLD;
    const perfect = this.score === total;

    saveQuizResult(this.options.infoId, this.score);

    // AU only awarded on first pass
    let auAwarded = 0;
    if (passed && !this.alreadyPassed) {
      auAwarded = perfect ? QUIZ_REWARDS.perfect : QUIZ_REWARDS.pass;
      this.options.progression.addAU(this.options.floorId, auAwarded);
    }

    eventBus.emit(passed ? 'sfx:quiz_success' : 'sfx:quiz_fail');

    const PANEL_W = 620;
    const PADDING = 32;
    const panelX = (GAME_WIDTH - PANEL_W) / 2;
    const panelH = passed ? 340 : 280;
    const panelY = (GAME_HEIGHT - panelH) / 2;

    const bg = this.scene.add.graphics();
    bg.fillStyle(0x0a0a2a, 0.95);
    bg.fillRoundedRect(panelX, panelY, PANEL_W, panelH, 10);
    bg.lineStyle(2, passed ? 0xffd700 : 0xff4444, 0.7);
    bg.strokeRoundedRect(panelX, panelY, PANEL_W, panelH, 10);
    this.container.add(bg);

    let curY = panelY + PADDING;

    const titleText = passed
      ? (perfect ? 'PERFECT SCORE!' : 'QUIZ PASSED!')
      : 'NOT QUITE...';
    const titleColor = passed ? '#ffd700' : '#ff6644';

    const title = this.scene.add.text(GAME_WIDTH / 2, curY, titleText, {
      fontFamily: 'monospace', fontSize: '28px', color: titleColor, fontStyle: 'bold',
    }).setOrigin(0.5, 0);
    this.container.add(title);

    if (passed) {
      this.scene.tweens.add({
        targets: title, scaleX: 1.15, scaleY: 1.15,
        duration: 300, yoyo: true, repeat: 1, ease: 'Sine.easeInOut',
      });
    }

    curY += 50;

    const scoreText = this.scene.add.text(
      GAME_WIDTH / 2, curY,
      `Score:  ${this.score} / ${total}`,
      { fontFamily: 'monospace', fontSize: '20px', color: '#c0c8d4' },
    ).setOrigin(0.5, 0);
    this.container.add(scoreText);

    curY += 40;

    if (passed && auAwarded > 0) {
      const auText = this.scene.add.text(
        GAME_WIDTH / 2, curY,
        `+${auAwarded} AU Earned!`,
        { fontFamily: 'monospace', fontSize: '22px', color: '#ffd700', fontStyle: 'bold' },
      ).setOrigin(0.5, 0);
      this.container.add(auText);

      this.scene.tweens.add({
        targets: auText, alpha: { from: 1, to: 0.6 },
        duration: 600, yoyo: true, repeat: 2, ease: 'Sine.easeInOut',
      });

      curY += 40;

      this.scene.cameras.main.flash(200, 255, 215, 0);
    } else if (passed && this.alreadyPassed) {
      const alreadyText = this.scene.add.text(
        GAME_WIDTH / 2, curY,
        'Quiz already completed \u2014 no additional AU',
        { fontFamily: 'monospace', fontSize: '14px', color: '#556677' },
      ).setOrigin(0.5, 0);
      this.container.add(alreadyText);
      curY += 40;
    } else {
      const failHint = this.scene.add.text(
        GAME_WIDTH / 2, curY,
        'Read the info text and try again!',
        { fontFamily: 'monospace', fontSize: '15px', color: '#8899aa' },
      ).setOrigin(0.5, 0);
      this.container.add(failHint);
      curY += 40;
    }

    if (passed) {
      this.spawnCelebrationParticles();
    }

    const closeBtn = this.scene.add.text(GAME_WIDTH / 2, curY + 10, '[  CLOSE  ]', {
      fontFamily: 'monospace', fontSize: '16px', color: '#00d4ff', fontStyle: 'bold',
    }).setOrigin(0.5, 0).setScrollFactor(0).setInteractive({ useHandCursor: true });

    closeBtn.on('pointerover', () => closeBtn.setColor('#88ddff'));
    closeBtn.on('pointerout', () => closeBtn.setColor('#00d4ff'));
    closeBtn.on('pointerdown', () => this.close());
    this.container.add(closeBtn);
  }

  private spawnCelebrationParticles(): void {
    if (!this.scene.textures.exists('quiz_particle')) {
      const g = this.scene.add.graphics();
      g.fillStyle(0xffffff);
      g.fillRect(0, 0, 6, 6);
      g.generateTexture('quiz_particle', 6, 6);
      g.destroy();
    }

    const cx = GAME_WIDTH / 2;
    const cy = GAME_HEIGHT / 2 - 40;

    const emitter = this.scene.add.particles(cx, cy, 'quiz_particle', {
      speed: { min: 80, max: 250 },
      angle: { min: 0, max: 360 },
      scale: { start: 1.2, end: 0 },
      lifespan: 1200,
      quantity: 30,
      tint: [0xffd700, 0xffed4a, 0x00d4ff, 0x44ff88, 0xff6644],
      gravityY: 120,
      emitting: false,
    });
    emitter.setDepth(201);

    emitter.explode(30);

    this.scene.time.delayedCall(1500, () => {
      emitter.destroy();
    });
  }

  /* ---- lifecycle ---- */

  private registerEscKey(): void {
    if (!this.scene.input.keyboard) return;
    this.escKey = this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);
    this.escHandler = () => {
      if (this.escKey?.isDown) this.close();
    };
    this.scene.events.on('update', this.escHandler);
  }

  close(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    if (this.escHandler) {
      this.scene.events.off('update', this.escHandler);
    }
    if (this.escKey) {
      this.escKey.destroy();
    }
    this.scene.tweens.add({
      targets: this.container, alpha: 0, duration: 150,
      onComplete: () => {
        this.container.destroy();
        this.options.onClose?.();
      },
    });
  }
}
