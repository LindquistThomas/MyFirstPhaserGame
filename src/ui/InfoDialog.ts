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
}

export class InfoDialog {
  private scene: Phaser.Scene;
  private container: Phaser.GameObjects.Container;
  private escKey: Phaser.Input.Keyboard.Key | null = null;
  private escHandler: (() => void) | null = null;
  private onClose?: () => void;
  private destroyed = false;

  constructor(scene: Phaser.Scene, content: InfoDialogContent, onClose?: () => void) {
    this.scene = scene;
    this.onClose = onClose;

    this.container = scene.add.container(0, 0);
    this.container.setDepth(200);
    this.container.setScrollFactor(0);
    this.container.setAlpha(0);

    this.buildOverlay();
    this.buildPanel(content);
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

  private buildPanel(content: InfoDialogContent): void {
    const panelW = 620;
    const panelX = (GAME_WIDTH - panelW) / 2;
    let panelH = 0;

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

    const MAX_PANEL_H = GAME_HEIGHT - 40;
    panelH = Math.min(28 + 18 + bodyH + 16 + linksSectionH + CLOSE_BAR_H + PADDING * 2, MAX_PANEL_H);
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
        const linkText = this.scene.add.text(panelX + PADDING + 10, curY, `▸ ${link.label}`, {
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
