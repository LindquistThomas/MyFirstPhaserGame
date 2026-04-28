import * as Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../config/gameConfig';
import { theme } from '../style/theme';
import { settingsStore } from '../systems/SettingsStore';
import { ModalBase } from './ModalBase';

export interface BombDisarmOptions {
  /** Called when the player successfully disarms the bomb. */
  onSuccess: () => void;
  /** Called when the player fails (wrong wire or timeout). */
  onFailure: () => void;
  /** Seconds the player has to complete the mini-game (default 12). */
  timeLimit?: number;
}

/** Colour data for one wire. */
interface WireData {
  label: string;
  hex: number;
  css: string;
}

const WIRES: WireData[] = [
  { label: 'RED',    hex: 0xcc2222, css: '#cc2222' },
  { label: 'BLUE',   hex: 0x2266cc, css: '#4488ee' },
  { label: 'GREEN',  hex: 0x22aa44, css: '#44cc66' },
  { label: 'YELLOW', hex: 0xccaa00, css: '#ffdd44' },
];

/** Number of wires shown per attempt (always a subset of WIRES). */
const WIRE_COUNT = 3;

/** Shuffle an array in-place (Fisher-Yates). */
function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

/**
 * Bomb-disarm mini-game modal.
 *
 * Presents WIRE_COUNT coloured wires arranged side-by-side and a hidden
 * correct cut order. The player navigates between wires with
 * NavigateLeft / NavigateRight (or QuickAnswer1–3 to cut directly) and
 * presses Confirm to cut the selected wire.  Cutting the next wire in the
 * correct sequence advances progress; cutting the wrong one triggers failure.
 * A countdown timer provides a time-pressure element.
 *
 * Reduced-motion mode (`SettingsStore.reducedMotion`) disables all pulsing
 * and flashing animations.
 */
export class BombDisarmDialog extends ModalBase {
  private readonly opts: Required<BombDisarmOptions>;

  /** Guard to prevent success/failure from firing more than once. */
  private resultFired = false;

  /** Subset of wires shown this attempt. */
  private readonly wires: WireData[];
  /** The order in which wires must be cut (indices into `this.wires`). */
  private readonly correctOrder: number[];

  private cursorIdx = 0;
  private nextCutStep = 0;

  private timeRemaining: number;
  private timerText!: Phaser.GameObjects.Text;
  private timerEvent?: Phaser.Time.TimerEvent;

  private wireGfxList: Phaser.GameObjects.Graphics[] = [];
  private wireLabelList: Phaser.GameObjects.Text[] = [];
  private cursorGfx!: Phaser.GameObjects.Graphics;
  private sequenceLabels: Phaser.GameObjects.Text[] = [];

  private leftHandler: (() => void) | null = null;
  private rightHandler: (() => void) | null = null;
  private confirmHandler: (() => void) | null = null;
  private q1Handler: (() => void) | null = null;
  private q2Handler: (() => void) | null = null;
  private q3Handler: (() => void) | null = null;

  private readonly reducedMotion: boolean;

  /** Flash tween references so they can be stopped on close. */
  private flashTween?: Phaser.Tweens.Tween;

  constructor(scene: Phaser.Scene, opts: BombDisarmOptions) {
    super(scene);
    this.opts = { timeLimit: 12, ...opts };
    this.timeRemaining = this.opts.timeLimit;
    this.reducedMotion = settingsStore.read().reducedMotion;

    // Select WIRE_COUNT wires from the pool and a random cut order.
    this.wires = shuffle(WIRES).slice(0, WIRE_COUNT);
    this.correctOrder = shuffle([0, 1, 2]);

    this.buildPanel();
    this.registerHandlers();
    this.startTimer();
    this.fadeIn();
  }

  // ------------------------------------------------------------------ teardown

  protected override onBeforeClose(): void {
    this.timerEvent?.remove();
    this.flashTween?.stop();
    if (this.leftHandler)    { this.scene.inputs.off('NavigateLeft',   this.leftHandler);    this.leftHandler = null; }
    if (this.rightHandler)   { this.scene.inputs.off('NavigateRight',  this.rightHandler);   this.rightHandler = null; }
    if (this.confirmHandler) { this.scene.inputs.off('Confirm',        this.confirmHandler); this.confirmHandler = null; }
    if (this.q1Handler)      { this.scene.inputs.off('QuickAnswer1',   this.q1Handler);      this.q1Handler = null; }
    if (this.q2Handler)      { this.scene.inputs.off('QuickAnswer2',   this.q2Handler);      this.q2Handler = null; }
    if (this.q3Handler)      { this.scene.inputs.off('QuickAnswer3',   this.q3Handler);      this.q3Handler = null; }
  }

  protected override onAfterClose(): void { /* result handled inside success/failure paths */ }

  // ------------------------------------------------------------------ layout

  private buildPanel(): void {
    const PW = 520;
    const PH = 380;
    const px = (GAME_WIDTH - PW) / 2;
    const py = (GAME_HEIGHT - PH) / 2;
    const PAD = 28;

    // Background panel
    const bg = this.scene.add.graphics();
    bg.fillStyle(0x08081a, 0.97);
    bg.fillRoundedRect(px, py, PW, PH, 10);
    bg.lineStyle(2, 0xcc2222, 0.9);
    bg.strokeRoundedRect(px, py, PW, PH, 10);
    this.container.add(bg);

    // Top danger bar
    const dangerBar = this.scene.add.graphics();
    dangerBar.fillStyle(0xcc2222, 1);
    dangerBar.fillRect(px + 10, py, PW - 20, 4);
    this.container.add(dangerBar);

    // Title
    const title = this.scene.add.text(
      GAME_WIDTH / 2, py + PAD,
      '⚠  BOMB DISARM SEQUENCE  ⚠',
      { fontFamily: 'monospace', fontSize: '16px', color: '#ff4444', fontStyle: 'bold' },
    ).setOrigin(0.5, 0).setScrollFactor(0);
    this.container.add(title);

    // Subtitle — correct-order instruction
    const subY = py + PAD + 28;
    const subtitle = this.scene.add.text(
      GAME_WIDTH / 2, subY,
      'Cut wires in the order shown below.\nWrong wire or timeout = failure.',
      { fontFamily: 'monospace', fontSize: '12px', color: theme.color.css.textMuted, align: 'center' },
    ).setOrigin(0.5, 0).setScrollFactor(0);
    this.container.add(subtitle);

    // ---- Correct-order display ----
    const seqY = subY + 58;
    const seqLabelX = GAME_WIDTH / 2 - ((WIRE_COUNT * 80 + (WIRE_COUNT - 1) * 12) / 2);
    for (let i = 0; i < WIRE_COUNT; i++) {
      const wire = this.wires[this.correctOrder[i]!]!;
      const cx = seqLabelX + i * 92 + 40;

      // Step number
      const stepNum = this.scene.add.text(cx, seqY, `${i + 1}.`, {
        fontFamily: 'monospace', fontSize: '11px', color: theme.color.css.textMuted,
      }).setOrigin(0.5, 0).setScrollFactor(0);
      this.container.add(stepNum);

      // Colored wire label
      const lbl = this.scene.add.text(cx, seqY + 16, wire.label, {
        fontFamily: 'monospace', fontSize: '13px', color: wire.css, fontStyle: 'bold',
      }).setOrigin(0.5, 0).setScrollFactor(0);
      this.container.add(lbl);
      this.sequenceLabels.push(lbl);

      if (i < WIRE_COUNT - 1) {
        const arrow = this.scene.add.text(seqLabelX + i * 92 + 80, seqY + 16, '→', {
          fontFamily: 'monospace', fontSize: '13px', color: theme.color.css.textMuted,
        }).setOrigin(0.5, 0).setScrollFactor(0);
        this.container.add(arrow);
      }
    }

    // ---- Wire display ----
    const wireAreaY = seqY + 76;
    const wireSpacing = PW / (WIRE_COUNT + 1);
    const wireH = 90;
    const wireW = 14;

    for (let i = 0; i < WIRE_COUNT; i++) {
      const wire = this.wires[i]!;
      const wx = px + wireSpacing * (i + 1);
      const wyTop = wireAreaY;

      // Wire body
      const gfx = this.scene.add.graphics();
      gfx.fillStyle(wire.hex, 1);
      gfx.fillRect(wx - wireW / 2, wyTop, wireW, wireH);
      this.container.add(gfx);
      this.wireGfxList.push(gfx);

      // Wire label
      const lbl = this.scene.add.text(wx, wyTop + wireH + 8, wire.label, {
        fontFamily: 'monospace', fontSize: '11px', color: wire.css, align: 'center',
      }).setOrigin(0.5, 0).setScrollFactor(0);
      this.container.add(lbl);
      this.wireLabelList.push(lbl);
    }

    // Cursor (drawn in its own layer above wires)
    this.cursorGfx = this.scene.add.graphics();
    this.container.add(this.cursorGfx);
    this.drawCursor(px, wireAreaY, wireSpacing, wireH, wireW);

    // Key hints
    const hintY = py + PH - PAD - 28;
    const hints = this.scene.add.text(
      GAME_WIDTH / 2, hintY,
      '← → Navigate   Enter/Space Cut   1/2/3 Direct   Esc Cancel',
      { fontFamily: 'monospace', fontSize: '11px', color: theme.color.css.textDisabled, align: 'center' },
    ).setOrigin(0.5, 0).setScrollFactor(0);
    this.container.add(hints);

    // Timer
    this.timerText = this.scene.add.text(
      GAME_WIDTH / 2, py + PH - PAD,
      this.formatTimer(this.timeRemaining),
      { fontFamily: 'monospace', fontSize: '18px', color: '#ffdd44', fontStyle: 'bold' },
    ).setOrigin(0.5, 1).setScrollFactor(0);
    this.container.add(this.timerText);
  }

  private drawCursor(panelX: number, wireAreaY: number, wireSpacing: number, wireH: number, wireW: number): void {
    this.cursorGfx.clear();
    const wx = panelX + wireSpacing * (this.cursorIdx + 1);
    const pad = 5;
    this.cursorGfx.lineStyle(2, 0xffffff, 0.9);
    this.cursorGfx.strokeRect(wx - wireW / 2 - pad, wireAreaY - pad, wireW + pad * 2, wireH + pad * 2);
  }

  private formatTimer(seconds: number): string {
    return `⏱ ${Math.ceil(seconds)}s`;
  }

  // ------------------------------------------------------------------ input

  private registerHandlers(): void {
    const PW = 520;
    const py = (GAME_HEIGHT - 380) / 2;
    const px = (GAME_WIDTH - PW) / 2;
    const wireAreaY = py + 28 + 28 + 58 + 76;
    const wireSpacing = PW / (WIRE_COUNT + 1);
    const wireH = 90;
    const wireW = 14;

    this.leftHandler = () => {
      this.cursorIdx = (this.cursorIdx - 1 + WIRE_COUNT) % WIRE_COUNT;
      this.drawCursor(px, wireAreaY, wireSpacing, wireH, wireW);
    };
    this.rightHandler = () => {
      this.cursorIdx = (this.cursorIdx + 1) % WIRE_COUNT;
      this.drawCursor(px, wireAreaY, wireSpacing, wireH, wireW);
    };
    this.confirmHandler = () => this.cutWire(this.cursorIdx);
    this.q1Handler = () => { if (WIRE_COUNT >= 1) this.cutWire(0); };
    this.q2Handler = () => { if (WIRE_COUNT >= 2) this.cutWire(1); };
    this.q3Handler = () => { if (WIRE_COUNT >= 3) this.cutWire(2); };

    this.scene.inputs.on('NavigateLeft',  this.leftHandler);
    this.scene.inputs.on('NavigateRight', this.rightHandler);
    this.scene.inputs.on('Confirm',       this.confirmHandler);
    this.scene.inputs.on('QuickAnswer1',  this.q1Handler);
    this.scene.inputs.on('QuickAnswer2',  this.q2Handler);
    this.scene.inputs.on('QuickAnswer3',  this.q3Handler);
  }

  // ------------------------------------------------------------------ game logic

  private cutWire(wireIdx: number): void {
    const expectedWireIdx = this.correctOrder[this.nextCutStep];
    if (wireIdx !== expectedWireIdx) {
      this.triggerFailure();
      return;
    }

    // Mark this wire as cut
    const gfx = this.wireGfxList[wireIdx];
    const lbl = this.wireLabelList[wireIdx];
    if (gfx) {
      gfx.clear();
      // Draw cut wire (split halves)
      const wire = this.wires[wireIdx]!;
      const PW = 520;
      const py = (GAME_HEIGHT - 380) / 2;
      const px = (GAME_WIDTH - PW) / 2;
      const wireAreaY = py + 28 + 28 + 58 + 76;
      const wireSpacing = PW / (WIRE_COUNT + 1);
      const wx = px + wireSpacing * (wireIdx + 1);
      const wireW = 14;
      const wireH = 90;
      const gapY = wireAreaY + wireH * 0.45;
      // Top half
      gfx.fillStyle(wire.hex, 0.4);
      gfx.fillRect(wx - wireW / 2, wireAreaY, wireW, gapY - wireAreaY - 4);
      // Bottom half (droops)
      gfx.fillRect(wx - wireW / 2 + 3, gapY + 4, wireW, wireAreaY + wireH - gapY - 4);
    }
    if (lbl) lbl.setColor(theme.color.css.textDisabled);

    // Strike through the sequence label
    const seqLbl = this.sequenceLabels[this.nextCutStep];
    if (seqLbl) seqLbl.setColor(theme.color.css.textDisabled);

    this.nextCutStep++;

    if (this.nextCutStep >= WIRE_COUNT) {
      this.triggerSuccess();
    }
  }

  private triggerSuccess(): void {
    if (this.resultFired) return;
    this.resultFired = true;
    if (this.reducedMotion) {
      this.close();
      this.opts.onSuccess();
      return;
    }
    // Brief green flash before close
    const flash = this.scene.add.rectangle(
      GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x00aa44, 0,
    ).setScrollFactor(0).setDepth(201);
    this.flashTween = this.scene.tweens.add({
      targets: flash,
      alpha: { from: 0.45, to: 0 },
      duration: 350,
      onComplete: () => {
        flash.destroy();
        this.close();
        this.opts.onSuccess();
      },
    });
  }

  private triggerFailure(): void {
    if (this.resultFired) return;
    this.resultFired = true;
    if (this.reducedMotion) {
      this.close();
      this.opts.onFailure();
      return;
    }
    // Brief red flash before close
    const flash = this.scene.add.rectangle(
      GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0xcc2222, 0,
    ).setScrollFactor(0).setDepth(201);
    this.flashTween = this.scene.tweens.add({
      targets: flash,
      alpha: { from: 0.5, to: 0 },
      duration: 350,
      onComplete: () => {
        flash.destroy();
        this.close();
        this.opts.onFailure();
      },
    });
  }

  // ------------------------------------------------------------------ timer

  private startTimer(): void {
    this.timerEvent = this.scene.time.addEvent({
      delay: 250,
      repeat: this.opts.timeLimit * 4 - 1,
      callback: () => {
        this.timeRemaining -= 0.25;
        if (this.timerText) {
          this.timerText.setText(this.formatTimer(Math.max(0, this.timeRemaining)));
          // Turn red in last 3 seconds
          if (this.timeRemaining <= 3) {
            this.timerText.setColor('#ff4444');
            if (!this.reducedMotion && this.timeRemaining > 0) {
              this.scene.tweens.add({
                targets: this.timerText,
                scaleX: { from: 1, to: 1.15 },
                scaleY: { from: 1, to: 1.15 },
                duration: 120,
                yoyo: true,
              });
            }
          }
        }
        if (this.timeRemaining <= 0) {
          this.timerEvent?.remove();
          this.triggerFailure();
        }
      },
    });
  }
}
