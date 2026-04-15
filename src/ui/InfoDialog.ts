import * as Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../config/gameConfig';

export interface InfoDialogLink {
  label: string;
  url: string;
}

export interface InfoDialogContent {
  id: string;
  title: string;
  body: string;
  links?: InfoDialogLink[];
  extendedInfo?: {
    title: string;
    body: string;
  };
}

export interface QuizButtonState {
  passed: boolean;
  canRetry: boolean;
  cooldownSeconds: number;
}

export interface InfoDialogOptions {
  onQuizStart?: () => void;
  quizStatus?: QuizButtonState;
}

export class InfoDialog {
  private scene: Phaser.Scene;
  private container: Phaser.GameObjects.Container;
  private escKey: Phaser.Input.Keyboard.Key | null = null;
  private escHandler: (() => void) | null = null;
  private onClose?: () => void;
  private destroyed = false;
  private extendedExpanded = false;
  private cooldownTimer?: Phaser.Time.TimerEvent;

  constructor(
    scene: Phaser.Scene,
    content: InfoDialogContent,
    onClose?: () => void,
    options?: InfoDialogOptions,
  ) {
    this.scene = scene;
    this.onClose = onClose;

    this.container = scene.add.container(0, 0);
    this.container.setDepth(200);
    this.container.setScrollFactor(0);
    this.container.setAlpha(0);

    this.buildOverlay();
    this.buildPanel(content, options);
    this.registerEscKey();

    scene.tweens.add({ targets: this.container, alpha: 1, duration: 200 });
  }

  private buildOverlay(): void {
    const overlay = this.scene.add.rectangle(
      GAME_WIDTH / 2, GAME_HEIGHT / 2,
      GAME_WIDTH, GAME_HEIGHT,
      0x000000, 0.65,
    );
    overlay.setInteractive();
    this.container.add(overlay);
  }

  private buildPanel(content: InfoDialogContent, options?: InfoDialogOptions): void {
    const panelW = 620;
    const panelX = (GAME_WIDTH - panelW) / 2;

    const PADDING = 32;
    const LINK_LINE_H = 30;
    const CLOSE_BAR_H = 44;

    const bodyMeasure = this.scene.make.text({
      x: 0, y: 0,
      text: content.body,
      style: {
        fontFamily: 'monospace', fontSize: '15px', color: '#c0c8d4',
        wordWrap: { width: panelW - PADDING * 2 }, lineSpacing: 6,
      },
      add: false,
    });
    const bodyH = bodyMeasure.height;
    bodyMeasure.destroy();

    const linksCount = content.links?.length ?? 0;
    const linksSectionH = linksCount > 0 ? 28 + linksCount * LINK_LINE_H + 8 : 0;

    const hasExtended = !!content.extendedInfo;
    const extendedToggleH = hasExtended ? 36 : 0;

    const hasQuiz = !!options?.onQuizStart;
    const quizBtnH = hasQuiz ? 40 : 0;

    const MAX_PANEL_H = GAME_HEIGHT - 40;
    let panelH = Math.min(
      28 + 18 + bodyH + 16 + linksSectionH + extendedToggleH + quizBtnH + CLOSE_BAR_H + PADDING * 2,
      MAX_PANEL_H,
    );
    const panelY = Math.max(20, (GAME_HEIGHT - panelH) / 2);

    const bg = this.scene.add.graphics();
    bg.fillStyle(0x0a0a2a, 0.95);
    bg.fillRoundedRect(panelX, panelY, panelW, panelH, 10);
    bg.lineStyle(2, 0x00aaff, 0.7);
    bg.strokeRoundedRect(panelX, panelY, panelW, panelH, 10);
    this.container.add(bg);

    let curY = panelY + PADDING;

    const title = this.scene.add.text(GAME_WIDTH / 2, curY, content.title, {
      fontFamily: 'monospace', fontSize: '24px', color: '#00d4ff', fontStyle: 'bold',
    }).setOrigin(0.5, 0);
    this.container.add(title);
    curY += 28 + 18;

    const body = this.scene.add.text(panelX + PADDING, curY, content.body, {
      fontFamily: 'monospace', fontSize: '15px', color: '#c0c8d4',
      wordWrap: { width: panelW - PADDING * 2 }, lineSpacing: 6,
    });
    this.container.add(body);
    curY += bodyH + 16;

    if (content.links && content.links.length > 0) {
      const linksHeader = this.scene.add.text(panelX + PADDING, curY, 'Learn more:', {
        fontFamily: 'monospace', fontSize: '13px', color: '#7799aa', fontStyle: 'bold',
      });
      this.container.add(linksHeader);
      curY += 24;

      for (const link of content.links) {
        const linkText = this.scene.add.text(panelX + PADDING + 10, curY, `\u25b8 ${link.label}`, {
          fontFamily: 'monospace', fontSize: '14px', color: '#44aaff',
        }).setInteractive({ useHandCursor: true });

        linkText.on('pointerover', () => linkText.setColor('#88ddff'));
        linkText.on('pointerout', () => linkText.setColor('#44aaff'));
        linkText.on('pointerdown', () => {
          window.open(link.url, '_blank', 'noopener,noreferrer');
        });

        this.container.add(linkText);
        curY += LINK_LINE_H;
      }
    }

    if (hasExtended && content.extendedInfo) {
      const extInfo = content.extendedInfo;
      curY += 4;

      const toggleText = this.scene.add.text(panelX + PADDING, curY, '[+]  Deep Dive', {
        fontFamily: 'monospace', fontSize: '14px', color: '#00aaff', fontStyle: 'bold',
      }).setInteractive({ useHandCursor: true });
      this.container.add(toggleText);

      toggleText.on('pointerover', () => toggleText.setColor('#88ddff'));
      toggleText.on('pointerout', () => toggleText.setColor('#00aaff'));

      const extContainer = this.scene.add.container(0, 0);
      extContainer.setVisible(false);
      this.container.add(extContainer);

      const extBodyMeasure = this.scene.make.text({
        x: 0, y: 0, text: extInfo.body,
        style: { fontFamily: 'monospace', fontSize: '14px', color: '#a0b0c0',
          wordWrap: { width: panelW - PADDING * 2 - 16 }, lineSpacing: 5 },
        add: false,
      });
      const extBodyH = extBodyMeasure.height;
      extBodyMeasure.destroy();

      toggleText.on('pointerdown', () => {
        this.extendedExpanded = !this.extendedExpanded;

        if (this.extendedExpanded) {
          toggleText.setText('[-]  Deep Dive');

          let ey = curY + 28;

          const extTitle = this.scene.add.text(panelX + PADDING + 12, ey, extInfo.title, {
            fontFamily: 'monospace', fontSize: '15px', color: '#00d4ff', fontStyle: 'bold',
          });
          extContainer.add(extTitle);
          ey += 24;

          const extBorder = this.scene.add.graphics();
          extBorder.fillStyle(0x00aaff, 0.4);
          extBorder.fillRect(panelX + PADDING + 4, ey - 2, 3, extBodyH + 4);
          extContainer.add(extBorder);

          const extBody = this.scene.add.text(panelX + PADDING + 16, ey, extInfo.body, {
            fontFamily: 'monospace', fontSize: '14px', color: '#a0b0c0',
            wordWrap: { width: panelW - PADDING * 2 - 16 }, lineSpacing: 5,
          });
          extContainer.add(extBody);

          extContainer.setVisible(true);

          const newPanelH = Math.min(panelH + extBodyH + 36, MAX_PANEL_H);
          bg.clear();
          bg.fillStyle(0x0a0a2a, 0.95);
          bg.fillRoundedRect(panelX, panelY, panelW, newPanelH, 10);
          bg.lineStyle(2, 0x00aaff, 0.7);
          bg.strokeRoundedRect(panelX, panelY, panelW, newPanelH, 10);
        } else {
          toggleText.setText('[+]  Deep Dive');
          extContainer.removeAll(true);
          extContainer.setVisible(false);

          bg.clear();
          bg.fillStyle(0x0a0a2a, 0.95);
          bg.fillRoundedRect(panelX, panelY, panelW, panelH, 10);
          bg.lineStyle(2, 0x00aaff, 0.7);
          bg.strokeRoundedRect(panelX, panelY, panelW, panelH, 10);
        }
      });

      curY += extendedToggleH;
    }

    // Quiz button
    if (hasQuiz && options?.onQuizStart) {
      const quizStatus = options.quizStatus;
      let quizLabel: string;
      let quizColor: string;
      let clickable = true;

      if (quizStatus?.passed) {
        quizLabel = '[\u2713  QUIZ PASSED]';
        quizColor = '#44ff88';
      } else if (quizStatus && !quizStatus.canRetry && quizStatus.cooldownSeconds > 0) {
        quizLabel = `[RETRY IN ${quizStatus.cooldownSeconds}s]`;
        quizColor = '#556677';
        clickable = false;
      } else {
        quizLabel = '[\u2606  TAKE QUIZ]';
        quizColor = '#ffd700';
      }

      const quizBtn = this.scene.add.text(GAME_WIDTH / 2, curY, quizLabel, {
        fontFamily: 'monospace', fontSize: '15px', color: quizColor, fontStyle: 'bold',
      }).setOrigin(0.5, 0);
      this.container.add(quizBtn);

      if (clickable) {
        quizBtn.setInteractive({ useHandCursor: true });
        const onQuizStart = options.onQuizStart;
        const hoverColor = quizStatus?.passed ? '#88ffbb' : '#ffed4a';
        quizBtn.on('pointerover', () => quizBtn.setColor(hoverColor));
        quizBtn.on('pointerout', () => quizBtn.setColor(quizColor));
        quizBtn.on('pointerdown', () => {
          this.close();
          // Slight delay so close animation finishes before quiz opens
          this.scene.time.delayedCall(200, () => onQuizStart());
        });
      }

      // If on cooldown, update the label every second
      if (quizStatus && !quizStatus.canRetry && quizStatus.cooldownSeconds > 0) {
        let remaining = quizStatus.cooldownSeconds;
        this.cooldownTimer = this.scene.time.addEvent({
          delay: 1000,
          repeat: remaining - 1,
          callback: () => {
            remaining--;
            if (remaining <= 0) {
              quizBtn.setText('[\u2606  TAKE QUIZ]');
              quizBtn.setColor('#ffd700');
              quizBtn.setInteractive({ useHandCursor: true });
              const onQuizStart = options!.onQuizStart!;
              quizBtn.on('pointerover', () => quizBtn.setColor('#ffed4a'));
              quizBtn.on('pointerout', () => quizBtn.setColor('#ffd700'));
              quizBtn.on('pointerdown', () => {
                this.close();
                this.scene.time.delayedCall(200, () => onQuizStart());
              });
            } else {
              quizBtn.setText(`[RETRY IN ${remaining}s]`);
            }
          },
        });
      }

      curY += quizBtnH;
    }

    curY = panelY + panelH - CLOSE_BAR_H - 4;
    const closeText = this.scene.add.text(GAME_WIDTH / 2, curY, '[ESC]  Close', {
      fontFamily: 'monospace', fontSize: '14px', color: '#556677',
    }).setOrigin(0.5, 0).setInteractive({ useHandCursor: true });

    closeText.on('pointerover', () => closeText.setColor('#88aacc'));
    closeText.on('pointerout', () => closeText.setColor('#556677'));
    closeText.on('pointerdown', () => this.close());
    this.container.add(closeText);

    const xBtn = this.scene.add.text(panelX + panelW - 18, panelY + 10, 'X', {
      fontFamily: 'monospace', fontSize: '16px', color: '#556677', fontStyle: 'bold',
    }).setOrigin(0.5, 0).setInteractive({ useHandCursor: true });

    xBtn.on('pointerover', () => xBtn.setColor('#ff6666'));
    xBtn.on('pointerout', () => xBtn.setColor('#556677'));
    xBtn.on('pointerdown', () => this.close());
    this.container.add(xBtn);
  }

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
    if (this.cooldownTimer) {
      this.cooldownTimer.destroy();
    }
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
        this.onClose?.();
      },
    });
  }
}
