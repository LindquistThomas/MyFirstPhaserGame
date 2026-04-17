import * as Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../config/gameConfig';
import { eventBus } from '../systems/EventBus';
import { ModalBase } from './ModalBase';

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

interface Focusable {
  text: Phaser.GameObjects.Text;
  normalColor: string;
  focusColor: string;
}

export class InfoDialog extends ModalBase {
  private readonly onCloseCallback?: () => void;
  private extendedExpanded = false;
  private cooldownTimer?: Phaser.Time.TimerEvent;

  /** Keyboard-focusable buttons in visual order (links, deep-dive, quiz, close). */
  private focusables: Focusable[] = [];
  private focusIndex = -1;
  private focusArrow?: Phaser.GameObjects.Text;
  private upKey?: Phaser.Input.Keyboard.Key;
  private downKey?: Phaser.Input.Keyboard.Key;
  private enterKey?: Phaser.Input.Keyboard.Key;
  private navHandler?: () => void;

  constructor(
    scene: Phaser.Scene,
    content: InfoDialogContent,
    onClose?: () => void,
    options?: InfoDialogOptions,
  ) {
    super(scene);
    this.onCloseCallback = onClose;

    this.buildPanel(content, options);
    this.registerKeyboardNav();

    eventBus.emit('sfx:info_open');
    this.fadeIn();
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
        fontFamily: 'monospace', fontSize: '14px', color: '#a0b8cc', fontStyle: 'bold',
      });
      this.container.add(linksHeader);
      curY += 24;

      for (const link of content.links) {
        const linkText = this.scene.add.text(panelX + PADDING + 10, curY, `\u25b8 ${link.label}`, {
          fontFamily: 'monospace', fontSize: '15px', color: '#44aaff',
        }).setScrollFactor(0).setInteractive({ useHandCursor: true });

        linkText.on('pointerover', () => linkText.setColor('#88ddff'));
        linkText.on('pointerout', () => linkText.setColor('#44aaff'));
        linkText.on('pointerdown', () => {
          eventBus.emit('sfx:link_click');
          window.open(link.url, '_blank', 'noopener,noreferrer');
        });

        this.container.add(linkText);
        this.focusables.push({ text: linkText, normalColor: '#44aaff', focusColor: '#88ddff' });
        curY += LINK_LINE_H;
      }
    }

    let quizBtnRef: Phaser.GameObjects.Text | null = null;
    let closeTextRef: Phaser.GameObjects.Text | null = null;

    if (hasExtended && content.extendedInfo) {
      const extInfo = content.extendedInfo;
      curY += 4;

      const toggleY = curY;
      const toggleText = this.scene.add.text(panelX + PADDING, toggleY, '[+]  Deep Dive', {
        fontFamily: 'monospace', fontSize: '15px', color: '#00aaff', fontStyle: 'bold',
      }).setScrollFactor(0).setInteractive({ useHandCursor: true });
      this.container.add(toggleText);
      this.focusables.push({ text: toggleText, normalColor: '#00aaff', focusColor: '#88ddff' });

      toggleText.on('pointerover', () => toggleText.setColor('#88ddff'));
      toggleText.on('pointerout', () => toggleText.setColor('#00aaff'));

      const extContainer = this.scene.add.container(0, 0);
      extContainer.setVisible(false);
      this.container.add(extContainer);

      const extBodyMeasure = this.scene.make.text({
        x: 0, y: 0, text: extInfo.body,
        style: { fontFamily: 'monospace', fontSize: '15px', color: '#a0b0c0',
          wordWrap: { width: panelW - PADDING * 2 - 16 }, lineSpacing: 5 },
        add: false,
      });
      const extBodyH = extBodyMeasure.height;
      extBodyMeasure.destroy();

      toggleText.on('pointerdown', () => {
        this.extendedExpanded = !this.extendedExpanded;
        const shift = Math.min(extBodyH + 36, MAX_PANEL_H - panelH);

        if (this.extendedExpanded) {
          toggleText.setText('[-]  Deep Dive');

          let ey = toggleY + 28;

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
            fontFamily: 'monospace', fontSize: '15px', color: '#a0b0c0',
            wordWrap: { width: panelW - PADDING * 2 - 16 }, lineSpacing: 5,
          });
          extContainer.add(extBody);

          extContainer.setVisible(true);

          if (quizBtnRef) quizBtnRef.y += shift;
          if (closeTextRef) closeTextRef.y += shift;

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

          if (quizBtnRef) quizBtnRef.y -= shift;
          if (closeTextRef) closeTextRef.y -= shift;

          bg.clear();
          bg.fillStyle(0x0a0a2a, 0.95);
          bg.fillRoundedRect(panelX, panelY, panelW, panelH, 10);
          bg.lineStyle(2, 0x00aaff, 0.7);
          bg.strokeRoundedRect(panelX, panelY, panelW, panelH, 10);
        }
        // Arrow indicator must follow the button that just moved.
        this.refreshFocusArrow();
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
        quizColor = '#8899aa';
        clickable = false;
      } else {
        quizLabel = '[\u2606  TAKE QUIZ]';
        quizColor = '#ffd700';
      }

      const quizBtn = this.scene.add.text(GAME_WIDTH / 2, curY, quizLabel, {
        fontFamily: 'monospace', fontSize: '15px', color: quizColor, fontStyle: 'bold',
      }).setOrigin(0.5, 0).setScrollFactor(0);
      quizBtnRef = quizBtn;
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
        this.focusables.push({ text: quizBtn, normalColor: quizColor, focusColor: hoverColor });
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
              // Promote the now-clickable quiz button into the focus ring,
              // slotting it just before the close button at the end.
              this.focusables.splice(this.focusables.length - 1, 0, {
                text: quizBtn, normalColor: '#ffd700', focusColor: '#ffed4a',
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
    const closeText = this.scene.add.text(GAME_WIDTH / 2, curY, '[\u2190\u2193\u2191] Navigate   [Enter] Select   [Esc] Close', {
      fontFamily: 'monospace', fontSize: '13px', color: '#8899aa',
    }).setOrigin(0.5, 0).setScrollFactor(0).setInteractive({ useHandCursor: true });
    closeTextRef = closeText;

    closeText.on('pointerover', () => closeText.setColor('#88aacc'));
    closeText.on('pointerout', () => closeText.setColor('#8899aa'));
    closeText.on('pointerdown', () => this.close());
    this.container.add(closeText);
    this.focusables.push({ text: closeText, normalColor: '#8899aa', focusColor: '#88aacc' });

    const xBtn = this.scene.add.text(panelX + panelW - 18, panelY + 10, 'X', {
      fontFamily: 'monospace', fontSize: '16px', color: '#8899aa', fontStyle: 'bold',
    }).setOrigin(0.5, 0).setScrollFactor(0).setInteractive({ useHandCursor: true });

    xBtn.on('pointerover', () => xBtn.setColor('#ff6666'));
    xBtn.on('pointerout', () => xBtn.setColor('#8899aa'));
    xBtn.on('pointerdown', () => this.close());
    this.container.add(xBtn);
  }

  /** Set up arrow-key navigation and Enter-to-activate. */
  private registerKeyboardNav(): void {
    if (!this.scene.input.keyboard || this.focusables.length === 0) return;

    const kb = this.scene.input.keyboard;
    this.upKey = kb.addKey(Phaser.Input.Keyboard.KeyCodes.UP);
    this.downKey = kb.addKey(Phaser.Input.Keyboard.KeyCodes.DOWN);
    this.enterKey = kb.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER);

    // Arrow pointer drawn to the left of the focused button.
    this.focusArrow = this.scene.add.text(0, 0, '\u25b6', {
      fontFamily: 'monospace', fontSize: '16px', color: '#ffd700', fontStyle: 'bold',
    }).setOrigin(0.5, 0.5).setScrollFactor(0).setVisible(false);
    this.container.add(this.focusArrow);

    this.setFocus(0);

    const up = this.upKey, down = this.downKey, enter = this.enterKey;
    this.navHandler = () => {
      if (Phaser.Input.Keyboard.JustDown(up)) {
        this.setFocus((this.focusIndex - 1 + this.focusables.length) % this.focusables.length);
      } else if (Phaser.Input.Keyboard.JustDown(down)) {
        this.setFocus((this.focusIndex + 1) % this.focusables.length);
      } else if (Phaser.Input.Keyboard.JustDown(enter)) {
        this.activateFocused();
      }
    };
    this.scene.events.on('update', this.navHandler);
  }

  private setFocus(index: number): void {
    if (index < 0 || index >= this.focusables.length) return;
    const prev = this.focusables[this.focusIndex];
    if (prev) prev.text.setColor(prev.normalColor);
    this.focusIndex = index;
    const cur = this.focusables[index];
    cur.text.setColor(cur.focusColor);
    this.refreshFocusArrow();
  }

  /** Reposition the arrow indicator next to the currently focused button. */
  private refreshFocusArrow(): void {
    if (!this.focusArrow || this.focusIndex < 0) return;
    const cur = this.focusables[this.focusIndex];
    const b = cur.text.getBounds();
    this.focusArrow.setPosition(b.x - 14, b.y + b.height / 2);
    this.focusArrow.setVisible(true);
  }

  private activateFocused(): void {
    const cur = this.focusables[this.focusIndex];
    if (!cur) return;
    // Fire the button's registered pointerdown handler. For the quiz button
    // while on cooldown this is a no-op — it only has listeners once clickable.
    cur.text.emit('pointerdown');
  }

  protected override onBeforeClose(): void {
    if (this.cooldownTimer) {
      this.cooldownTimer.destroy();
    }
    if (this.navHandler) {
      this.scene.events.off('update', this.navHandler);
      this.navHandler = undefined;
    }
    this.upKey?.destroy();
    this.downKey?.destroy();
    this.enterKey?.destroy();
    this.upKey = this.downKey = this.enterKey = undefined;
  }

  protected override onAfterClose(): void {
    this.onCloseCallback?.();
  }
}
