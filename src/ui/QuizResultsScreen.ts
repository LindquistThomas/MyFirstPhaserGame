import * as Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, FloorId } from '../config/gameConfig';
import { QUIZ_REWARDS, QUIZ_PASS_THRESHOLD } from '../config/quiz';
import { ProgressionSystem } from '../systems/ProgressionSystem';
import { saveQuizResult } from '../systems/QuizManager';
import { eventBus } from '../systems/EventBus';
import { ModalKeyboardNavigator, makeTextFocusable } from './ModalKeyboardNavigator';

export interface QuizResultsScreenOptions {
  scene: Phaser.Scene;
  container: Phaser.GameObjects.Container;
  navigator: ModalKeyboardNavigator;
  progression: ProgressionSystem;
  floorId: FloorId;
  infoId: string;
  score: number;
  total: number;
  /** Whether the player already passed this quiz before this attempt. */
  alreadyPassed: boolean;
  onClose: () => void;
}

/**
 * Render the end-of-quiz summary panel.
 *
 * Persists the score, awards AU (only on first pass), emits success/fail SFX,
 * and displays the appropriate celebration.
 *
 * Extracted from QuizDialog so the quiz flow class stays focused on
 * question navigation.
 */
export function renderQuizResults(options: QuizResultsScreenOptions): void {
  const { scene, container, navigator, progression, floorId, infoId, score, total, alreadyPassed, onClose } = options;

  const passed = score >= QUIZ_PASS_THRESHOLD;
  const perfect = score === total;

  saveQuizResult(infoId, score);

  let auAwarded = 0;
  if (passed && !alreadyPassed) {
    auAwarded = perfect ? QUIZ_REWARDS.perfect : QUIZ_REWARDS.pass;
    progression.addAU(floorId, auAwarded);
  }

  eventBus.emit(passed ? 'sfx:quiz_success' : 'sfx:quiz_fail');

  const PANEL_W = 620;
  const PADDING = 32;
  const panelX = (GAME_WIDTH - PANEL_W) / 2;
  const panelH = passed ? 340 : 280;
  const panelY = (GAME_HEIGHT - panelH) / 2;

  const bg = scene.add.graphics();
  bg.fillStyle(0x0a0a2a, 0.95);
  bg.fillRoundedRect(panelX, panelY, PANEL_W, panelH, 10);
  bg.lineStyle(2, passed ? 0xffd700 : 0xff4444, 0.7);
  bg.strokeRoundedRect(panelX, panelY, PANEL_W, panelH, 10);
  container.add(bg);

  let curY = panelY + PADDING;

  const titleText = passed
    ? (perfect ? 'PERFECT SCORE!' : 'QUIZ PASSED!')
    : 'NOT QUITE...';
  const titleColor = passed ? '#ffd700' : '#ff6644';

  const title = scene.add.text(GAME_WIDTH / 2, curY, titleText, {
    fontFamily: 'monospace', fontSize: '28px', color: titleColor, fontStyle: 'bold',
  }).setOrigin(0.5, 0);
  container.add(title);

  if (passed) {
    scene.tweens.add({
      targets: title, scaleX: 1.15, scaleY: 1.15,
      duration: 300, yoyo: true, repeat: 1, ease: 'Sine.easeInOut',
    });
  }

  curY += 50;

  const scoreText = scene.add.text(
    GAME_WIDTH / 2, curY,
    `Score:  ${score} / ${total}`,
    { fontFamily: 'monospace', fontSize: '20px', color: '#c0c8d4' },
  ).setOrigin(0.5, 0);
  container.add(scoreText);

  curY += 40;

  if (passed && auAwarded > 0) {
    const auText = scene.add.text(
      GAME_WIDTH / 2, curY,
      `+${auAwarded} AU Earned!`,
      { fontFamily: 'monospace', fontSize: '22px', color: '#ffd700', fontStyle: 'bold' },
    ).setOrigin(0.5, 0);
    container.add(auText);

    scene.tweens.add({
      targets: auText, alpha: { from: 1, to: 0.6 },
      duration: 600, yoyo: true, repeat: 2, ease: 'Sine.easeInOut',
    });

    curY += 40;
    scene.cameras.main.flash(200, 255, 215, 0);
  } else if (passed && alreadyPassed) {
    const alreadyText = scene.add.text(
      GAME_WIDTH / 2, curY,
      'Quiz already completed \u2014 no additional AU',
      { fontFamily: 'monospace', fontSize: '15px', color: '#8899aa' },
    ).setOrigin(0.5, 0);
    container.add(alreadyText);
    curY += 40;
  } else {
    const failHint = scene.add.text(
      GAME_WIDTH / 2, curY,
      'Read the info text and try again!',
      { fontFamily: 'monospace', fontSize: '15px', color: '#8899aa' },
    ).setOrigin(0.5, 0);
    container.add(failHint);
    curY += 40;
  }

  if (passed) {
    spawnCelebrationParticles(scene);
  }

  const closeBtn = scene.add.text(GAME_WIDTH / 2, curY + 10, '[  CLOSE  ]', {
    fontFamily: 'monospace', fontSize: '16px', color: '#00d4ff', fontStyle: 'bold',
  }).setOrigin(0.5, 0).setScrollFactor(0).setInteractive({ useHandCursor: true });

  closeBtn.on('pointerover', () => closeBtn.setColor('#88ddff'));
  closeBtn.on('pointerout', () => closeBtn.setColor('#00d4ff'));
  closeBtn.on('pointerdown', () => onClose());
  container.add(closeBtn);

  navigator.attachArrowTo(container);
  navigator.add(makeTextFocusable(closeBtn, '#00d4ff', '#88ddff'));
  navigator.setFocus(0);
}

function spawnCelebrationParticles(scene: Phaser.Scene): void {
  if (!scene.textures.exists('quiz_particle')) {
    const g = scene.add.graphics();
    g.fillStyle(0xffffff);
    g.fillRect(0, 0, 6, 6);
    g.generateTexture('quiz_particle', 6, 6);
    g.destroy();
  }

  const cx = GAME_WIDTH / 2;
  const cy = GAME_HEIGHT / 2 - 40;

  const emitter = scene.add.particles(cx, cy, 'quiz_particle', {
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
  emitter.setScrollFactor(0);
  emitter.explode(30);

  scene.time.delayedCall(1500, () => {
    emitter.destroy();
  });
}
