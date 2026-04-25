import * as Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, COLORS } from '../../config/gameConfig';
import { SOUNDTRACK_PLAYLIST } from '../../config/audioConfig';
import { GameStateManager } from '../../systems/GameStateManager';
import { eventBus } from '../../systems/EventBus';
import { pushContext, popContext } from '../../input';
import { createSceneLifecycle } from '../../systems/sceneLifecycle';
import type { NavigationContext } from '../NavigationContext';

/**
 * Title screen.
 *
 * Sets the tone for the whole game with an animated city scene: distant
 * skyline silhouette, a featured skyscraper with twinkling windows, an
 * elevator cab riding floor-by-floor with the player sprite inside, and
 * a starfield drifting overhead. The title and buttons live in a single
 * column on the left; the cityscape fills the right two-thirds.
 */
export class MenuScene extends Phaser.Scene {
  private static readonly SOUNDTRACK_BUTTON_Y_WITH_SAVE_OFFSET = 160;
  private static readonly SOUNDTRACK_BUTTON_Y_NO_SAVE_OFFSET = 100;

  private windowRects: Phaser.GameObjects.Rectangle[] = [];
  private menuButtons: Array<{ btn: Phaser.GameObjects.Text; action: () => void }> = [];
  private selectedIndex = 0;
  private soundtrackButton?: Phaser.GameObjects.Text;
  /** -1 so first playNextSoundtrack() wraps to index 0 (first track). */
  private soundtrackIndex = -1;

  constructor() {
    super({ key: 'MenuScene' });
  }

  create(): void {
    this.cameras.main.setBackgroundColor(0x05060f);
    this.menuButtons = [];
    this.selectedIndex = 0;

    this.createStarfield();
    this.createSkylineBackdrop();
    this.createFeaturedBuilding();
    this.createTitlePanel();
    this.createControlsFooter();

    this.setupKeyboardNavigation();
    this.updateSelection();
    this.cameras.main.fadeIn(800, 0, 0, 0);
  }

  private setupKeyboardNavigation(): void {
    const contextToken = pushContext('menu');
    const lifecycle = createSceneLifecycle(this);
    lifecycle.add(() => popContext(contextToken));
    lifecycle.bindInput('NavigateUp', () => this.moveSelection(-1));
    lifecycle.bindInput('NavigateDown', () => this.moveSelection(1));
    lifecycle.bindInput('Confirm', () => this.activateSelection());
  }

  private moveSelection(delta: number): void {
    if (this.menuButtons.length === 0) return;
    const n = this.menuButtons.length;
    this.selectedIndex = (this.selectedIndex + delta + n) % n;
    this.updateSelection();
  }

  private activateSelection(): void {
    const entry = this.menuButtons[this.selectedIndex];
    if (entry) entry.action();
  }

  private updateSelection(): void {
    this.menuButtons.forEach((entry, i) => {
      if (i === this.selectedIndex) {
        entry.btn.setColor('#ffffff').setScale(1.08);
      } else {
        entry.btn.setColor(COLORS.titleText).setScale(1.0);
      }
    });
  }

  /* ---- background layers ---- */

  /** Slow-twinkling starfield across the upper sky. */
  private createStarfield(): void {
    const stars = this.add.graphics().setDepth(0);
    const draw = (alpha: number) => {
      stars.clear();
      for (let i = 0; i < 80; i++) {
        const x = (i * 137.5) % GAME_WIDTH;
        const y = ((i * 73.3) % (GAME_HEIGHT * 0.55));
        const a = alpha * (0.4 + ((i * 31) % 7) / 10);
        stars.fillStyle(0xffffff, a);
        stars.fillRect(x, y, 1.5, 1.5);
      }
    };
    draw(1);
    this.tweens.addCounter({
      from: 0.5, to: 1, duration: 2400, ease: 'Sine.easeInOut',
      yoyo: true, repeat: -1,
      onUpdate: (tw) => draw(tw.getValue() ?? 1),
    });

    // Soft moon
    const moon = this.add.graphics().setDepth(0);
    moon.fillStyle(0xfff6cc, 0.9);
    moon.fillCircle(GAME_WIDTH - 140, 110, 36);
    moon.fillStyle(0x05060f, 1);
    moon.fillCircle(GAME_WIDTH - 122, 100, 32);
  }

  /** Distant skyline of varied dark buildings forming the city horizon. */
  private createSkylineBackdrop(): void {
    const g = this.add.graphics().setDepth(1);
    const horizonY = GAME_HEIGHT - 180;
    let x = 0;
    let seed = 17;
    while (x < GAME_WIDTH) {
      // deterministic pseudo-random widths/heights so the skyline is stable
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      const w = 36 + (seed % 60);
      const h = 80 + ((seed >> 8) % 220);
      g.fillStyle(0x12162a, 1);
      g.fillRect(x, horizonY - h, w, h + 200);

      // a few randomly lit windows
      const winCols = Math.max(1, Math.floor(w / 14));
      const winRows = Math.max(2, Math.floor(h / 22));
      for (let r = 0; r < winRows; r++) {
        for (let c = 0; c < winCols; c++) {
          seed = (seed * 1664525 + 1013904223) & 0x7fffffff;
          if ((seed & 7) === 0) {
            g.fillStyle(0xffd470, 0.55);
            g.fillRect(x + 4 + c * 14, horizonY - h + 8 + r * 22, 6, 8);
          }
        }
      }
      x += w + 4;
    }

    // Ground band
    g.fillStyle(0x080a18, 1);
    g.fillRect(0, GAME_HEIGHT - 30, GAME_WIDTH, 30);
  }

  /**
   * Centre-piece skyscraper with a 6-floor window grid, an internal lift
   * shaft and a cab that rides up and down with the player inside it.
   * Windows twinkle on a timer to suggest a city that's alive.
   */
  private createFeaturedBuilding(): void {
    const FLOORS = 6;
    const FLOOR_H = 70;
    const buildingX = GAME_WIDTH / 2 + 220;
    const buildingW = 320;
    const topY = GAME_HEIGHT - 80 - FLOORS * FLOOR_H;
    const bottomY = topY + FLOORS * FLOOR_H;

    // Building silhouette
    const body = this.add.graphics().setDepth(2);
    body.fillStyle(0x1c2138, 1);
    body.fillRect(buildingX - buildingW / 2, topY - 24, buildingW, FLOORS * FLOOR_H + 24);
    // Roof structure
    body.fillStyle(0x252b48, 1);
    body.fillRect(buildingX - 28, topY - 56, 56, 32);
    body.fillStyle(0xff5566, 1);
    body.fillCircle(buildingX, topY - 60, 4); // antenna light

    // Floor separators
    body.lineStyle(1, 0x0c0f1c, 1);
    for (let f = 1; f < FLOORS; f++) {
      const y = topY + f * FLOOR_H;
      body.lineBetween(buildingX - buildingW / 2, y, buildingX + buildingW / 2, y);
    }

    // Window grid (skip the centre column — that's the elevator shaft)
    const cols = 6;
    const colW = buildingW / cols;
    for (let f = 0; f < FLOORS; f++) {
      for (let c = 0; c < cols; c++) {
        if (c === 2 || c === 3) continue; // shaft columns
        const wx = buildingX - buildingW / 2 + c * colW + colW / 2;
        const wy = topY + f * FLOOR_H + FLOOR_H / 2 + 4;
        const lit = Math.random() < 0.55;
        const rect = this.add.rectangle(wx, wy, colW * 0.55, FLOOR_H * 0.45,
          lit ? 0xffd470 : 0x2a2f4a, 1).setDepth(2);
        this.windowRects.push(rect);
      }
    }
    // Twinkle a handful of windows every beat.
    this.time.addEvent({
      delay: 600, loop: true, callback: () => {
        for (let i = 0; i < 4; i++) {
          const r = this.windowRects[Math.floor(Math.random() * this.windowRects.length)];
          if (!r) continue;
          const lit = (r.fillColor === 0xffd470);
          r.setFillStyle(lit ? 0x2a2f4a : 0xffd470, 1);
        }
      },
    });

    // Elevator shaft — darker column down the building's centre
    const shaftW = colW * 1.6;
    const shaftX = buildingX;
    const shaft = this.add.graphics().setDepth(2);
    shaft.fillStyle(0x0a0d1c, 1);
    shaft.fillRect(shaftX - shaftW / 2, topY, shaftW, FLOORS * FLOOR_H);
    shaft.lineStyle(1, 0x2a2f4a, 1);
    shaft.lineBetween(shaftX - shaftW / 2, topY, shaftX - shaftW / 2, bottomY);
    shaft.lineBetween(shaftX + shaftW / 2, topY, shaftX + shaftW / 2, bottomY);

    // Floor-stop indicators inside the shaft
    for (let f = 0; f < FLOORS; f++) {
      const y = topY + f * FLOOR_H + FLOOR_H / 2;
      shaft.fillStyle(0x33ff99, 0.35);
      shaft.fillRect(shaftX - shaftW / 2 + 2, y - 1, shaftW - 4, 2);
    }

    // Elevator cab + player rider — composed in a container so they tween together
    const cabW = shaftW - 8;
    const cabH = FLOOR_H - 14;
    const cab = this.add.container(shaftX, bottomY - FLOOR_H / 2).setDepth(3);

    const cabBg = this.add.graphics();
    cabBg.fillStyle(0x162244, 1);
    cabBg.fillRect(-cabW / 2, -cabH / 2, cabW, cabH);
    cabBg.lineStyle(2, 0x33d6ff, 0.95);
    cabBg.strokeRect(-cabW / 2, -cabH / 2, cabW, cabH);
    cabBg.fillStyle(0x33d6ff, 0.9);
    cabBg.fillRect(-cabW / 2, -cabH / 2 - 4, cabW, 4); // top bar
    cab.add(cabBg);

    // Cables up to the roof
    const cables = this.add.graphics().setDepth(3);
    const drawCables = () => {
      cables.clear();
      cables.lineStyle(1, 0x55556a, 0.8);
      cables.lineBetween(shaftX - 8, topY, shaftX - 8, cab.y - cabH / 2);
      cables.lineBetween(shaftX + 8, topY, shaftX + 8, cab.y - cabH / 2);
    };
    drawCables();

    // Player sprite riding the cab. Idle frame 0 if the spritesheet is loaded.
    if (this.textures.exists('player')) {
      const player = this.add.sprite(0, 4, 'player', 0).setDepth(4);
      // Scale so the 64×160 sprite fits the cab nicely.
      const scale = Math.min(cabW / 80, cabH / 110);
      player.setScale(scale);
      cab.add(player);
    } else {
      const stick = this.add.graphics();
      stick.fillStyle(0xfff0c0, 1);
      stick.fillRect(-3, -10, 6, 20);
      stick.fillCircle(0, -16, 4);
      cab.add(stick);
    }

    // Ride loop: stop at each floor for a beat, then move to the next.
    const stops: number[] = [];
    for (let f = 0; f < FLOORS; f++) {
      stops.push(topY + f * FLOOR_H + FLOOR_H / 2);
    }
    let idx = FLOORS - 1; // start at the bottom
    const goNext = () => {
      idx = (idx + 1) % (FLOORS * 2 - 2);
      // Bounce: 0..F-1 going up, then back down.
      const rideTo = idx < FLOORS ? idx : (FLOORS * 2 - 2 - idx);
      this.tweens.add({
        targets: cab,
        y: stops[rideTo],
        duration: 900,
        ease: 'Sine.easeInOut',
        onUpdate: drawCables,
        onComplete: () => {
          drawCables();
          this.time.delayedCall(700, goNext);
        },
      });
    };
    this.time.delayedCall(600, goNext);
  }

  /* ---- foreground UI ---- */

  private createTitlePanel(): void {
    const cx = 360;
    const cy = GAME_HEIGHT / 2;
    const TEXT_DEPTH = 20;

    // Semi-transparent backdrop so the left column reads clearly over the skyline.
    const panel = this.add.graphics().setDepth(TEXT_DEPTH - 1);
    panel.fillStyle(0x05060f, 0.55);
    panel.fillRect(0, cy - 260, 720, 440);

    // Title with a soft glow (stack of offset shadows).
    const titleStyle: Phaser.Types.GameObjects.Text.TextStyle = {
      fontFamily: 'monospace', fontSize: '44px',
      color: COLORS.titleText, fontStyle: 'bold',
    };
    const subStyle: Phaser.Types.GameObjects.Text.TextStyle = {
      fontFamily: 'monospace', fontSize: '70px',
      color: '#ffffff', fontStyle: 'bold',
    };
    this.add.text(cx, cy - 220, 'SO YOU WANT', titleStyle).setOrigin(0.5)
      .setShadow(0, 0, '#0099cc', 18, true, true).setDepth(TEXT_DEPTH);
    this.add.text(cx, cy - 170, 'TO BE AN', titleStyle).setOrigin(0.5)
      .setShadow(0, 0, '#0099cc', 18, true, true).setDepth(TEXT_DEPTH);
    const headline = this.add.text(cx, cy - 100, 'ARCHITECT', subStyle).setOrigin(0.5)
      .setShadow(0, 0, '#33ddff', 24, true, true).setDepth(TEXT_DEPTH);

    // Subtle title pulse (scale only the headline so the surrounding lines stay still).
    this.tweens.add({
      targets: headline, scale: 1.03, duration: 1800,
      ease: 'Sine.easeInOut', yoyo: true, repeat: -1,
    });

    // Glow color loop — interpolate the shadow hue between two cyan tones
    // on a 3 s yoyo so the title subtly breathes in colour as well as scale.
    const from = { r: 0x00, g: 0xd4, b: 0xff };
    const to = { r: 0x88, g: 0xff, b: 0xff };
    const toHex = (r: number, g: number, b: number): string => {
      const c = (n: number) => Math.round(n).toString(16).padStart(2, '0');
      return `#${c(r)}${c(g)}${c(b)}`;
    };
    this.tweens.addCounter({
      from: 0, to: 1, duration: 3000, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
      onUpdate: (tw) => {
        const t = tw.getValue() ?? 0;
        const r = from.r + (to.r - from.r) * t;
        const g = from.g + (to.g - from.g) * t;
        const b = from.b + (to.b - from.b) * t;
        headline.setShadow(0, 0, toHex(r, g, b), 24, true, true);
      },
    });

    this.add.text(cx, cy - 50, 'Ride the elevator. Translate between floors.', {
      fontFamily: 'monospace', fontSize: '14px', color: '#9fb1c8',
    }).setOrigin(0.5).setDepth(TEXT_DEPTH);

    // Start button
    const startAction = () => this.startGame();
    const btn = this.makeButton(cx, cy + 40, '[ START GAME ]', 26, startAction);
    btn.setDepth(TEXT_DEPTH);
    this.menuButtons.push({ btn, action: startAction });

    const gameState = this.registry.get('gameState') as GameStateManager;
    if (gameState?.hasSave()) {
      const continueAction = () => this.continueGame();
      const contBtn = this.makeButton(cx, cy + 100, '[ CONTINUE ]', 22, continueAction);
      contBtn.setDepth(TEXT_DEPTH);
      this.menuButtons.push({ btn: contBtn, action: continueAction });
    }

    if (SOUNDTRACK_PLAYLIST.length > 0) {
      const soundtrackYOffset = gameState?.hasSave()
        ? MenuScene.SOUNDTRACK_BUTTON_Y_WITH_SAVE_OFFSET
        : MenuScene.SOUNDTRACK_BUTTON_Y_NO_SAVE_OFFSET;
      const soundtrackY = cy + soundtrackYOffset;
      const soundtrackAction = () => this.playNextSoundtrack();
      const soundtrackBtn = this.makeButton(cx, soundtrackY, '[ SOUNDTRACK MODE ]', 20, soundtrackAction);
      soundtrackBtn.setDepth(TEXT_DEPTH);
      this.menuButtons.push({ btn: soundtrackBtn, action: soundtrackAction });
      this.soundtrackButton = soundtrackBtn;
    }

    const settingsYOffset = gameState?.hasSave() ? 220 : 160;
    const settingsAction = () => this.openSettings();
    const settingsBtn = this.makeButton(cx, cy + settingsYOffset, '[ SETTINGS ]', 20, settingsAction);
    settingsBtn.setDepth(TEXT_DEPTH);
    this.menuButtons.push({ btn: settingsBtn, action: settingsAction });
  }

  private makeButton(
    x: number,
    y: number,
    label: string,
    fontPx: number,
    onClick: () => void,
  ): Phaser.GameObjects.Text {
    const btn = this.add.text(x, y, label, {
      fontFamily: 'monospace', fontSize: `${fontPx}px`, color: COLORS.titleText,
      padding: { x: 24, y: 12 },
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    btn.on('pointerover', () => {
      const idx = this.menuButtons.findIndex((e) => e.btn === btn);
      if (idx >= 0) {
        this.selectedIndex = idx;
        this.updateSelection();
      }
    });
    btn.on('pointerout', () => this.updateSelection());
    btn.on('pointerdown', onClick);
    return btn;
  }

  private createControlsFooter(): void {
    const cx = GAME_WIDTH / 2;
    this.add.text(cx, GAME_HEIGHT - 60, '\u2191\u2193 / W S: Select   |   Enter / Tap: Confirm', {
      fontFamily: 'monospace', fontSize: '14px', color: '#7a8aa3',
    }).setOrigin(0.5).setDepth(10);

    this.add.text(cx, GAME_HEIGHT - 35, 'Collect AU to unlock new floors  \u2022  Inspired by Impossible Mission (C64)', {
      fontFamily: 'monospace', fontSize: '12px', color: '#5e6e85',
    }).setOrigin(0.5).setDepth(10);
  }

  private startGame(): void {
    this.cameras.main.fadeOut(500, 0, 0, 0);
    const ctx: NavigationContext = { loadSave: false };
    this.time.delayedCall(500, () => this.scene.start('ElevatorScene', ctx));
  }

  private continueGame(): void {
    this.cameras.main.fadeOut(500, 0, 0, 0);
    const ctx: NavigationContext = { loadSave: true };
    this.time.delayedCall(500, () => this.scene.start('ElevatorScene', ctx));
  }

  private openSettings(): void {
    this.cameras.main.fadeOut(300, 0, 0, 0);
    this.time.delayedCall(300, () => this.scene.start('SettingsScene', { from: 'MenuScene' }));
  }

  private playNextSoundtrack(): void {
    if (SOUNDTRACK_PLAYLIST.length === 0) return;
    this.soundtrackIndex = (this.soundtrackIndex + 1) % SOUNDTRACK_PLAYLIST.length;
    const next = SOUNDTRACK_PLAYLIST[this.soundtrackIndex];
    eventBus.emit('music:play', next.key);
    this.soundtrackButton?.setText(`[ SOUNDTRACK: ${next.label} ]`).setInteractive({ useHandCursor: true });
  }
}
