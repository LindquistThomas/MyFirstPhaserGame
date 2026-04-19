import * as Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../config/gameConfig';
import { theme } from '../style/theme';
import { eventBus } from '../systems/EventBus';
import { ModalBase } from './ModalBase';
import { ModalKeyboardNavigator, makeTextFocusable } from './ModalKeyboardNavigator';

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

export class InfoDialog extends ModalBase {
  private readonly onCloseCallback?: () => void;
  private extendedExpanded = false;
  private cooldownTimer?: Phaser.Time.TimerEvent;

  private nav!: ModalKeyboardNavigator;

  /* ---- scrolling state ---- */
  private scrollContent?: Phaser.GameObjects.Container;
  private scrollMaskGfx?: Phaser.GameObjects.Graphics;
  private scrollBarThumb?: Phaser.GameObjects.Rectangle;
  private scrollBarTrack?: Phaser.GameObjects.Rectangle;
  private scrollOffset = 0;
  private maxScroll = 0;
  private contentViewportTop = 0;
  private contentViewportH = 0;
  private contentInnerH = 0;
  /** Items (in scrollContent coordinates) that should auto-scroll into view when focused. */
  private focusYMap = new Map<Phaser.GameObjects.Text, { y: number; h: number }>();
  private wheelHandler?: (_ptr: unknown, _over: unknown[], _dx: number, dy: number) => void;

  constructor(
    scene: Phaser.Scene,
    content: InfoDialogContent,
    onClose?: () => void,
    options?: InfoDialogOptions,
  ) {
    super(scene);
    this.onCloseCallback = onClose;

    this.nav = new ModalKeyboardNavigator(scene);
    this.buildPanel(content, options);
    this.registerKeyboardNav();
    this.registerWheelScroll();

    eventBus.emit('sfx:info_open');
    this.fadeIn();
  }

  private buildPanel(content: InfoDialogContent, options?: InfoDialogOptions): void {
    const panelW = 620;
    const panelX = (GAME_WIDTH - panelW) / 2;
    const PADDING = 32;
    const LINK_LINE_H = 30;
    const CLOSE_BAR_H = 44;
    const TITLE_H = 28;
    const TITLE_GAP = 18;

    // Fixed, tall panel. Content scrolls inside a viewport between the
    // sticky title (top) and sticky quiz/close footer (bottom).
    const panelH = GAME_HEIGHT - 40;
    const panelY = 20;

    const hasQuiz = !!options?.onQuizStart;
    const quizBtnH = hasQuiz ? 40 : 0;
    const footerH = quizBtnH + CLOSE_BAR_H + 16;
    const footerY = panelY + panelH - footerH;

    const bg = this.scene.add.graphics();
    bg.fillStyle(0x0a0a2a, 0.95);
    bg.fillRoundedRect(panelX, panelY, panelW, panelH, 10);
    bg.lineStyle(2, theme.color.ui.border, 0.7);
    bg.strokeRoundedRect(panelX, panelY, panelW, panelH, 10);
    this.container.add(bg);

    // --- title (sticky) ---
    const titleY = panelY + PADDING;
    const title = this.scene.add.text(GAME_WIDTH / 2, titleY, content.title, {
      fontFamily: 'monospace', fontSize: '24px', color: theme.color.css.textTitle, fontStyle: 'bold',
    }).setOrigin(0.5, 0);
    this.container.add(title);

    const titleSepY = titleY + TITLE_H + TITLE_GAP - 10;
    const sep = this.scene.add.graphics();
    sep.lineStyle(1, theme.color.ui.border, 0.3);
    sep.lineBetween(panelX + 20, titleSepY, panelX + panelW - 20, titleSepY);
    sep.lineBetween(panelX + 20, footerY - 2, panelX + panelW - 20, footerY - 2);
    this.container.add(sep);

    // --- scroll viewport region ---
    const contentTop = titleSepY + 8;
    const contentBottom = footerY - 8;
    const contentH = contentBottom - contentTop;
    this.contentViewportTop = contentTop;
    this.contentViewportH = contentH;

    // Scroll container — children positioned in local coordinates starting at 0.
    const scrollContent = this.scene.add.container(0, contentTop);
    this.scrollContent = scrollContent;
    this.container.add(scrollContent);

    // Geometry mask clips children to the visible viewport.
    // The mask graphics must share the container's scrollFactor(0) — otherwise
    // when the camera is scrolled the mask clips a region that's nowhere near
    // the modal's screen-space position, hiding all scroll-content children.
    const maskGfx = this.scene.make.graphics({ x: 0, y: 0 }, false);
    maskGfx.setScrollFactor(0);
    maskGfx.fillStyle(0xffffff);
    maskGfx.fillRect(panelX, contentTop, panelW, contentH);
    this.scrollMaskGfx = maskGfx;
    scrollContent.setMask(maskGfx.createGeometryMask());

    // --- populate scroll container ---
    let cy = 0;

    const body = this.scene.add.text(PADDING, cy, content.body, {
      fontFamily: 'monospace', fontSize: '15px', color: '#c0c8d4',
      wordWrap: { width: panelW - PADDING * 2 }, lineSpacing: 6,
    }).setX(panelX + PADDING);
    scrollContent.add(body);
    cy += body.height + 16;

    if (content.links && content.links.length > 0) {
      const linksHeader = this.scene.add.text(panelX + PADDING, cy, 'Learn more:', {
        fontFamily: 'monospace', fontSize: '14px', color: '#a0b8cc', fontStyle: 'bold',
      });
      scrollContent.add(linksHeader);
      cy += 24;

      for (const link of content.links) {
        const linkText = this.scene.add.text(panelX + PADDING + 10, cy, `\u25b8 ${link.label}`, {
          fontFamily: 'monospace', fontSize: '15px', color: '#44aaff',
        }).setInteractive({ useHandCursor: true });

        linkText.on('pointerover', () => linkText.setColor('#88ddff'));
        linkText.on('pointerout', () => linkText.setColor('#44aaff'));
        linkText.on('pointerdown', () => {
          eventBus.emit('sfx:link_click');
          window.open(link.url, '_blank', 'noopener,noreferrer');
        });

        scrollContent.add(linkText);
        this.nav.add(makeTextFocusable(linkText, '#44aaff', '#88ddff'));
        this.focusYMap.set(linkText, { y: cy, h: LINK_LINE_H });
        cy += LINK_LINE_H;
      }
    }

    if (content.extendedInfo) {
      const extInfo = content.extendedInfo;
      cy += 4;

      const toggleY = cy;
      const toggleText = this.scene.add.text(panelX + PADDING, toggleY, '[+]  Deep Dive', {
        fontFamily: 'monospace', fontSize: '15px', color: '#00aaff', fontStyle: 'bold',
      }).setInteractive({ useHandCursor: true });
      scrollContent.add(toggleText);
      this.nav.add(makeTextFocusable(toggleText, '#00aaff', '#88ddff'));
      this.focusYMap.set(toggleText, { y: toggleY, h: 28 });

      toggleText.on('pointerover', () => toggleText.setColor('#88ddff'));
      toggleText.on('pointerout', () => toggleText.setColor('#00aaff'));

      const extContainer = this.scene.add.container(0, 0);
      extContainer.setVisible(false);
      scrollContent.add(extContainer);

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

        if (this.extendedExpanded) {
          toggleText.setText('[-]  Deep Dive');
          let ey = toggleY + 28;

          const extTitle = this.scene.add.text(panelX + PADDING + 12, ey, extInfo.title, {
            fontFamily: 'monospace', fontSize: '15px', color: theme.color.css.textTitle, fontStyle: 'bold',
          });
          extContainer.add(extTitle);
          ey += 24;

          const extBorder = this.scene.add.graphics();
          extBorder.fillStyle(theme.color.ui.border, 0.4);
          extBorder.fillRect(panelX + PADDING + 4, ey - 2, 3, extBodyH + 4);
          extContainer.add(extBorder);

          const extBody = this.scene.add.text(panelX + PADDING + 16, ey, extInfo.body, {
            fontFamily: 'monospace', fontSize: '15px', color: '#a0b0c0',
            wordWrap: { width: panelW - PADDING * 2 - 16 }, lineSpacing: 5,
          });
          extContainer.add(extBody);

          extContainer.setVisible(true);
          this.contentInnerH = Math.max(this.contentInnerH, toggleY + 28 + 24 + extBodyH + 16);
        } else {
          toggleText.setText('[+]  Deep Dive');
          extContainer.removeAll(true);
          extContainer.setVisible(false);
          this.contentInnerH = toggleY + 28;
        }
        this.recomputeScrollBounds();
        this.refreshFocusArrowWithVisibility();
      });

      cy += 28;
    }

    this.contentInnerH = cy;

    // --- footer (sticky): quiz button + close/hint ---
    if (hasQuiz && options?.onQuizStart) {
      this.createQuizButton(options, panelX, panelW, footerY + 6, panelY, panelH);
    }

    const closeY = footerY + quizBtnH + 10;
    const closeText = this.scene.add.text(GAME_WIDTH / 2, closeY, '[\u2190\u2193\u2191] Navigate   [Enter] Select   [Esc] Close', {
      fontFamily: 'monospace', fontSize: '13px', color: '#8899aa',
    }).setOrigin(0.5, 0).setInteractive({ useHandCursor: true });

    closeText.on('pointerover', () => closeText.setColor('#88aacc'));
    closeText.on('pointerout', () => closeText.setColor('#8899aa'));
    closeText.on('pointerdown', () => this.close());
    this.container.add(closeText);
    this.nav.add(makeTextFocusable(closeText, '#8899aa', '#88aacc'));

    const xBtn = this.scene.add.text(panelX + panelW - 18, panelY + 10, 'X', {
      fontFamily: 'monospace', fontSize: '16px', color: '#8899aa', fontStyle: 'bold',
    }).setOrigin(0.5, 0).setInteractive({ useHandCursor: true });

    xBtn.on('pointerover', () => xBtn.setColor('#ff6666'));
    xBtn.on('pointerout', () => xBtn.setColor('#8899aa'));
    xBtn.on('pointerdown', () => this.close());
    this.container.add(xBtn);

    // --- scrollbar (only shown when content overflows viewport) ---
    const trackX = panelX + panelW - 12;
    this.scrollBarTrack = this.scene.add.rectangle(
      trackX, contentTop + contentH / 2, 4, contentH, 0x22334a, 1,
    ).setOrigin(0.5).setVisible(false);
    this.scrollBarThumb = this.scene.add.rectangle(
      trackX, contentTop, 4, 40, 0x6699cc, 1,
    ).setOrigin(0.5, 0).setVisible(false);
    this.container.add(this.scrollBarTrack);
    this.container.add(this.scrollBarThumb);

    this.recomputeScrollBounds();
  }

  private createQuizButton(
    options: InfoDialogOptions,
    panelX: number, panelW: number,
    quizY: number, _panelY: number, _panelH: number,
  ): void {
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

    const quizBtn = this.scene.add.text(GAME_WIDTH / 2, quizY, quizLabel, {
      fontFamily: 'monospace', fontSize: '15px', color: quizColor, fontStyle: 'bold',
    }).setOrigin(0.5, 0);
    this.container.add(quizBtn);

    const onQuizStart = options.onQuizStart!;
    if (clickable) {
      quizBtn.setInteractive({ useHandCursor: true });
      const hoverColor = quizStatus?.passed ? '#88ffbb' : '#ffed4a';
      quizBtn.on('pointerover', () => quizBtn.setColor(hoverColor));
      quizBtn.on('pointerout', () => quizBtn.setColor(quizColor));
      quizBtn.on('pointerdown', () => {
        this.close();
        this.scene.time.delayedCall(200, () => onQuizStart());
      });
      this.nav.add(makeTextFocusable(quizBtn, quizColor, hoverColor));
    }

    // If on cooldown, update the label every second and promote into focus ring when ready.
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
            quizBtn.on('pointerover', () => quizBtn.setColor('#ffed4a'));
            quizBtn.on('pointerout', () => quizBtn.setColor('#ffd700'));
            quizBtn.on('pointerdown', () => {
              this.close();
              this.scene.time.delayedCall(200, () => onQuizStart());
            });
            // Promote into focus ring just before the close button.
            this.nav.insert(this.nav.size() - 1, makeTextFocusable(quizBtn, '#ffd700', '#ffed4a'));
          } else {
            quizBtn.setText(`[RETRY IN ${remaining}s]`);
          }
        },
      });
    }
  }

  /* ---- scrolling ---- */

  private recomputeScrollBounds(): void {
    this.maxScroll = Math.max(0, this.contentInnerH - this.contentViewportH);
    if (this.scrollOffset > this.maxScroll) this.scrollOffset = this.maxScroll;
    this.applyScroll();

    const showBar = this.maxScroll > 0;
    this.scrollBarTrack?.setVisible(showBar);
    this.scrollBarThumb?.setVisible(showBar);
    if (showBar && this.scrollBarThumb) {
      const trackH = this.contentViewportH;
      const thumbH = Math.max(30, trackH * (this.contentViewportH / this.contentInnerH));
      this.scrollBarThumb.height = thumbH;
    }
  }

  private applyScroll(): void {
    if (!this.scrollContent) return;
    this.scrollContent.y = this.contentViewportTop - this.scrollOffset;

    if (this.scrollBarThumb && this.maxScroll > 0) {
      const trackH = this.contentViewportH - this.scrollBarThumb.height;
      this.scrollBarThumb.y = this.contentViewportTop + (this.scrollOffset / this.maxScroll) * trackH;
    }
    this.refreshFocusArrowWithVisibility();
  }

  private scrollBy(delta: number): void {
    const next = Phaser.Math.Clamp(this.scrollOffset + delta, 0, this.maxScroll);
    if (next === this.scrollOffset) return;
    this.scrollOffset = next;
    this.applyScroll();
  }

  private scrollTo(offset: number): void {
    const next = Phaser.Math.Clamp(offset, 0, this.maxScroll);
    if (next === this.scrollOffset) return;
    this.scrollOffset = next;
    this.applyScroll();
  }

  private registerWheelScroll(): void {
    this.wheelHandler = (_ptr, _over, _dx, dy) => {
      if (this.maxScroll <= 0) return;
      this.scrollBy(dy * 0.5);
    };
    this.scene.input.on('wheel', this.wheelHandler);
  }

  /* ---- keyboard navigation ---- */

  private registerKeyboardNav(): void {
    if (this.nav.size() === 0) return;
    this.nav.setFocus(0);
    this.ensureFocusedVisible();

    this.nav.bind('NavigateUp', () => { this.nav.focusPrev(); this.ensureFocusedVisible(); });
    this.nav.bind('NavigateDown', () => { this.nav.focusNext(); this.ensureFocusedVisible(); });
    this.nav.bind('Confirm', () => this.nav.activateFocused());
    this.nav.bind('PageUp', () => this.scrollBy(-this.contentViewportH * 0.8));
    this.nav.bind('PageDown', () => this.scrollBy(this.contentViewportH * 0.8));
  }

  /** Resolve the focused focusable back to the underlying Text so we can
   *  consult focusYMap (only scrollable items are keyed there). */
  private focusedText(): Phaser.GameObjects.Text | undefined {
    const cur = this.nav.get(this.nav.currentIndex());
    if (!cur) return undefined;
    const b = cur.bounds();
    for (const text of this.focusYMap.keys()) {
      const tb = text.getBounds();
      if (tb.x === b.x && tb.y === b.y) return text;
    }
    return undefined;
  }

  /** If the focused item lives in the scroll container and is outside the
   *  viewport, scroll the minimum amount needed to reveal it. */
  private ensureFocusedVisible(): void {
    const text = this.focusedText();
    if (!text) { this.refreshFocusArrowWithVisibility(); return; }
    const pos = this.focusYMap.get(text);
    if (!pos) { this.refreshFocusArrowWithVisibility(); return; }
    const visibleTop = this.scrollOffset;
    const visibleBottom = this.scrollOffset + this.contentViewportH;
    if (pos.y < visibleTop) {
      this.scrollTo(pos.y - 8);
    } else if (pos.y + pos.h > visibleBottom) {
      this.scrollTo(pos.y + pos.h - this.contentViewportH + 8);
    } else {
      this.refreshFocusArrowWithVisibility();
    }
  }

  /** Refresh arrow position, but hide it if the focused item scrolled out. */
  private refreshFocusArrowWithVisibility(): void {
    const text = this.focusedText();
    if (text) {
      const pos = this.focusYMap.get(text);
      if (pos) {
        const visibleTop = this.scrollOffset;
        const visibleBottom = this.scrollOffset + this.contentViewportH;
        if (pos.y + pos.h < visibleTop || pos.y > visibleBottom) {
          this.nav.hideArrow();
          return;
        }
      }
    }
    this.nav.refreshArrow();
  }

  protected override onBeforeClose(): void {
    if (this.cooldownTimer) {
      this.cooldownTimer.destroy();
    }
    this.nav.destroy();
    if (this.wheelHandler) {
      this.scene.input.off('wheel', this.wheelHandler);
      this.wheelHandler = undefined;
    }

    this.scrollContent?.clearMask(true);
    this.scrollMaskGfx?.destroy();
    this.scrollMaskGfx = undefined;
  }

  protected override onAfterClose(): void {
    this.onCloseCallback?.();
  }
}
