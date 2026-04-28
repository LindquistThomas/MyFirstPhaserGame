/**
 * Per-floor and lobby decoration sprites for the elevator scene.
 *
 * Extracted from `ElevatorSceneLayout` to keep that file as a thin
 * orchestrator. This module is purely Phaser-dependent (no pure-math
 * helpers worth testing in isolation) — test coverage lands in the Playwright
 * visual-regression suite.
 *
 * Exports a single entry-point `drawAllDecorations(scene, deps)` that
 * places all lobby and floor-specific decoration objects and returns the
 * mutable bounds/references needed by `ElevatorSceneLayout` for zone logic.
 */
import type * as Phaser from 'phaser';
import { GAME_WIDTH, FLOORS, TILE_SIZE, FloorId } from '../../config/gameConfig';
import { theme } from '../../style/theme';

const FLOOR_TILE_ROWS = 2;
const FLOOR_H = FLOOR_TILE_ROWS * TILE_SIZE; // 256

/** Dependencies used by floor decoration draw functions. */
export interface FloorDecorationsDeps {
  shaftWidth: number;
  shaftExtent: { top: number; bottom: number };
  floorYPositions: Record<FloorId, number>;
}

/** Result returned by `drawAllDecorations`. */
export interface AllDecorationsResult {
  /** Bounds of Geir Harald's pacing range on the F4 walkway. */
  geirBounds?: { x: number; y: number; width: number; height: number };
  /** Bounds of the reception desk proximity area. */
  receptionBounds?: { x: number; y: number; width: number; height: number };
  /** The receptionist's speech-bubble Container; hidden by default. */
  receptionistBubble?: Phaser.GameObjects.Container;
  /** Bounds of the lobby sofa proximity area. */
  sofaBounds?: { x: number; y: number; width: number; height: number };
  /** World point where the player stands while seated on the sofa. */
  sofaSitPoint?: { x: number; y: number };
  /**
   * Setter that adjusts the lobby clock speed multiplier. 1 = real time;
   * >1 fast-forwards the virtual time shown by the wall clock.
   */
  setClockSpeed: (multiplier: number) => void;
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

/**
 * Place all elevator-scene decorations (lobby + every floor band) and return
 * the bounds/references required by `ElevatorSceneLayout` for zone logic.
 */
export function drawAllDecorations(
  scene: Phaser.Scene,
  deps: FloorDecorationsDeps,
): AllDecorationsResult {
  const lobbyResult = _drawLobbyDecorations(scene, deps);
  _drawBelowLobbyFoundation(scene, deps);
  const floorResult = _drawFloorDecorations(scene, deps);

  return {
    geirBounds: floorResult.geirBounds,
    receptionBounds: lobbyResult.receptionBounds,
    receptionistBubble: lobbyResult.receptionistBubble,
    sofaBounds: lobbyResult.sofaBounds,
    sofaSitPoint: lobbyResult.sofaSitPoint,
    setClockSpeed: lobbyResult.setClockSpeed,
  };
}

// ---------------------------------------------------------------------------
// Lobby decorations
// ---------------------------------------------------------------------------

interface LobbyDecorResult {
  receptionBounds?: { x: number; y: number; width: number; height: number };
  receptionistBubble?: Phaser.GameObjects.Container;
  sofaBounds?: { x: number; y: number; width: number; height: number };
  sofaSitPoint?: { x: number; y: number };
  setClockSpeed: (multiplier: number) => void;
}

function _drawLobbyDecorations(
  scene: Phaser.Scene,
  deps: FloorDecorationsDeps,
): LobbyDecorResult {
  const positions = deps.floorYPositions;
  const lobbyY = positions[FLOORS.LOBBY];
  const floorBottom = lobbyY + FLOOR_H;

  const signY = lobbyY + 75;
  const signX = 260;
  scene.add.image(signX, signY, 'lobby_logo').setDepth(2);

  scene.add.image(60, floorBottom - 40, 'plant_tall').setDepth(3);

  const deskX = 200;
  const deskY = floorBottom - 45;
  scene.add.image(deskX, deskY - 30, 'receptionist').setDepth(2);
  scene.add.image(deskX, deskY, 'reception_desk').setDepth(3);

  scene.add.image(deskX + 30, floorBottom - 6, 'welcome_mat').setDepth(2).setTint(0x1a237e);

  const receptionBounds = { x: deskX - 80, y: deskY - 60, width: 160, height: 120 };
  const receptionistBubble = _createSpeechBubble(scene, deskX + 40, deskY - 90, 'Welcome 😊');
  receptionistBubble.setVisible(false);

  scene.add.image(395, floorBottom - 60, 'info_board').setDepth(3);
  scene.add.image(455, floorBottom - 32, 'plant_small').setDepth(3);

  const { setClockSpeed } = _createLobbyClock(scene, 1000, lobbyY + 75, 34);
  const sofaX = 960;
  const sofaY = floorBottom - 30;
  scene.add.image(sofaX, sofaY, 'sofa').setDepth(3);
  const sofaSitPoint = { x: sofaX, y: sofaY };
  const sofaBounds = { x: sofaX - 80, y: floorBottom - 70, width: 160, height: 100 };
  scene.add.image(1070, floorBottom - 14, 'coffee_table').setDepth(3);
  scene.add.image(1120, floorBottom - 48, 'floor_lamp').setDepth(3);
  scene.add.image(1210, floorBottom - 40, 'plant_tall').setDepth(3);

  return { receptionBounds, receptionistBubble, sofaBounds, sofaSitPoint, setClockSpeed };
}

/**
 * Build a live, real-time analog wall clock. Returns a `setClockSpeed` setter
 * so the caller can fast-forward virtual time when the player sits on the sofa.
 */
function _createLobbyClock(
  scene: Phaser.Scene,
  cx: number,
  cy: number,
  radius: number,
): { setClockSpeed: (multiplier: number) => void } {
  const rimOuter = radius + 4;
  const rimInner = radius + 2;

  const face = scene.add.graphics().setDepth(2);
  face.fillStyle(0x37474f);
  face.fillCircle(cx, cy, rimOuter);
  face.fillStyle(0x263238);
  face.fillCircle(cx, cy, rimInner);
  face.fillStyle(0xeceff1);
  face.fillCircle(cx, cy, radius);
  face.fillStyle(0x263238);
  for (let i = 0; i < 12; i++) {
    const angle = (i / 12) * Math.PI * 2 - Math.PI / 2;
    const tx = cx + Math.cos(angle) * (radius - 5);
    const ty = cy + Math.sin(angle) * (radius - 5);
    const size = i % 3 === 0 ? 4 : 2;
    face.fillRect(Math.round(tx - size / 2), Math.round(ty - size / 2), size, size);
  }

  const hands = scene.add.graphics().setDepth(3);
  const pin = scene.add.graphics().setDepth(4);
  pin.fillStyle(theme.color.ui.accent);
  pin.fillCircle(cx, cy, Math.max(2, Math.round(radius * 0.06)));

  const hourLen = radius * 0.50;
  const minuteLen = radius * 0.75;
  const secondLen = radius * 0.85;
  const hourTail = radius * 0.15;
  const minuteTail = radius * 0.18;
  const secondTail = radius * 0.22;
  const hourW = Math.max(3, Math.round(radius * 0.08));
  const minuteW = Math.max(2, Math.round(radius * 0.05));
  const secondW = Math.max(1, Math.round(radius * 0.025));

  const drawHand = (
    angle: number,
    length: number,
    tail: number,
    width: number,
    color: number,
  ) => {
    const dx = Math.cos(angle);
    const dy = Math.sin(angle);
    hands.lineStyle(width, color, 1);
    hands.beginPath();
    hands.moveTo(cx - dx * tail, cy - dy * tail);
    hands.lineTo(cx + dx * length, cy + dy * length);
    hands.strokePath();
  };

  let clockVirtualMs = Date.now();
  let clockSpeedMultiplier = 1;
  const tickMs = 200;

  const render = (): void => {
    const now = new Date(clockVirtualMs);
    const hh = now.getHours();
    const mm = now.getMinutes();
    const ss = now.getSeconds();

    const secondAngle = (ss / 60) * Math.PI * 2 - Math.PI / 2;
    const minuteAngle = ((mm + ss / 60) / 60) * Math.PI * 2 - Math.PI / 2;
    const hourAngle = (((hh % 12) + mm / 60) / 12) * Math.PI * 2 - Math.PI / 2;

    hands.clear();
    drawHand(hourAngle, hourLen, hourTail, hourW, 0x263238);
    drawHand(minuteAngle, minuteLen, minuteTail, minuteW, 0x263238);
    drawHand(secondAngle, secondLen, secondTail, secondW, 0xe53935);
  };

  render();
  const timer = scene.time.addEvent({
    delay: tickMs,
    loop: true,
    callback: () => {
      clockVirtualMs += tickMs * clockSpeedMultiplier;
      render();
    },
  });

  // Phaser.Scenes.Events is available at runtime via the scene's event emitter.
  scene.events.once('shutdown', () => {
    timer.remove(false);
  });

  return {
    setClockSpeed: (multiplier: number) => {
      clockSpeedMultiplier = Math.max(0, multiplier);
    },
  };
}

/**
 * Build a small speech bubble Container anchored at (x, y) as the bottom
 * centre of the tail. Used for the receptionist's greeting.
 */
function _createSpeechBubble(
  scene: Phaser.Scene,
  x: number,
  y: number,
  message: string,
): Phaser.GameObjects.Container {
  const padX = 10;
  const padY = 6;
  const txt = scene.make.text({
    x: 0,
    y: 0,
    text: message,
    style: {
      fontFamily: 'monospace',
      fontSize: '16px',
      color: '#102027',
      fontStyle: 'bold',
    },
  }).setOrigin(0.5);
  const w = Math.ceil(txt.width) + padX * 2;
  const h = Math.ceil(txt.height) + padY * 2;

  const gfx = scene.add.graphics();
  gfx.fillStyle(0xffffff, 0.96);
  gfx.fillRoundedRect(-w / 2, -h / 2, w, h, 6);
  gfx.lineStyle(2, 0x102027, 1);
  gfx.strokeRoundedRect(-w / 2, -h / 2, w, h, 6);
  gfx.fillStyle(0xffffff, 0.96);
  gfx.fillTriangle(-6, h / 2 - 1, 6, h / 2 - 1, 0, h / 2 + 8);
  gfx.lineStyle(2, 0x102027, 1);
  gfx.strokeTriangle(-6, h / 2 - 1, 6, h / 2 - 1, 0, h / 2 + 8);

  const container = scene.add.container(x, y - h / 2 - 6, [gfx, txt]);
  container.setDepth(12);
  return container;
}

// ---------------------------------------------------------------------------
// Below-lobby foundation
// ---------------------------------------------------------------------------

function _drawBelowLobbyFoundation(
  scene: Phaser.Scene,
  deps: FloorDecorationsDeps,
): void {
  const positions = deps.floorYPositions;
  const lobbyY = positions[FLOORS.LOBBY];
  const walkY = lobbyY + FLOOR_H;
  const bottom = deps.shaftExtent.bottom;
  const h = bottom - walkY;
  if (h <= 0) return;

  const cx = GAME_WIDTH / 2;
  const sw = deps.shaftWidth;
  const leftEdge = cx - sw / 2;
  const rightEdge = cx + sw / 2;

  const leftWidth = leftEdge - 12;
  const rightX = rightEdge + 12;
  const rightWidth = GAME_WIDTH - rightX;

  const g = scene.add.graphics().setDepth(1);

  const paintBand = (x: number, w: number): void => {
    if (w <= 0) return;
    g.fillStyle(0x2b2b33, 1);
    g.fillRect(x, walkY, w, h);
    g.fillStyle(0x14141a, 0.55);
    g.fillRect(x, walkY, w, 4);
    g.fillStyle(0x3d3d48, 1);
    g.fillRect(x, walkY + 6, w, 2);
    g.fillStyle(0x1a1a22, 1);
    g.fillRect(x, walkY + 8, w, 1);
    const seamY = walkY + Math.floor(h * 0.55);
    g.fillStyle(0x3d3d48, 1);
    g.fillRect(x, seamY, w, 1);
    g.fillStyle(0x1a1a22, 1);
    g.fillRect(x, seamY + 1, w, 1);
    g.fillStyle(0x14141a, 0.8);
    g.fillRect(x, bottom - 3, w, 3);
    g.fillStyle(0x444450, 1);
    for (let i = 0; i < Math.floor(w / 18); i++) {
      const sx = x + 4 + ((i * 47) % Math.max(1, w - 8));
      const sy = walkY + 12 + ((i * 11) % Math.max(1, h - 18));
      g.fillRect(sx, sy, 1, 1);
    }
  };

  const paintVent = (vx: number, vy: number, vw = 34, vh = 20): void => {
    g.fillStyle(0x0e0e14, 1);
    g.fillRect(vx - 1, vy - 1, vw + 2, vh + 2);
    g.fillStyle(0x1a1a22, 1);
    g.fillRect(vx, vy, vw, vh);
    g.fillStyle(0x55606e, 1);
    for (let ly = vy + 3; ly < vy + vh - 2; ly += 4) {
      g.fillRect(vx + 2, ly, vw - 4, 1);
    }
    g.fillStyle(0x3d3d48, 1);
    g.fillRect(vx - 1, vy - 1, vw + 2, 1);
  };

  paintBand(0, leftWidth);
  paintBand(rightX, rightWidth);

  const ventY = walkY + Math.max(14, Math.floor(h * 0.3));
  if (leftWidth >= 80) paintVent(leftEdge - 12 - 60, ventY);
  if (rightWidth >= 80) paintVent(rightX + 26, ventY);
  if (rightWidth >= 260) paintVent(rightX + 200, ventY + 6, 40, 16);
  if (leftWidth >= 260) paintVent(80, ventY + 6, 40, 16);
}

// ---------------------------------------------------------------------------
// Per-floor decorations
// ---------------------------------------------------------------------------

interface FloorDecorResult {
  geirBounds?: { x: number; y: number; width: number; height: number };
}

function _drawFloorDecorations(
  scene: Phaser.Scene,
  deps: FloorDecorationsDeps,
): FloorDecorResult {
  const positions = deps.floorYPositions;
  const rightEdge = GAME_WIDTH / 2 + deps.shaftWidth / 2;

  // F1 — Platform Team / Architecture Team
  const f1Bottom = positions[FLOORS.PLATFORM_TEAM] + FLOOR_H;
  _drawF1PlatformDecorations(scene, f1Bottom);
  _drawF1ArchitectureDecorations(scene, f1Bottom, rightEdge);

  // PRODUCTS — keep ambient dressing minimal; product doors dominate.
  const fProductsBottom = positions[FLOORS.PRODUCTS] + FLOOR_H;
  scene.add.image(150, fProductsBottom - 60, 'info_board').setDepth(3);
  scene.add.image(rightEdge + 440, fProductsBottom - 40, 'plant_tall').setDepth(3);

  // F3 — Business (Product Leadership left, Customer Success right)
  const f3Bottom = positions[FLOORS.BUSINESS] + FLOOR_H;
  _drawF3ProductLeadershipDecorations(scene, f3Bottom);
  _drawF3CustomerSuccessDecorations(scene, f3Bottom, rightEdge);

  // F4 — Executive Suite
  const f4Bottom = positions[FLOORS.EXECUTIVE] + FLOOR_H;
  scene.add.image(120, f4Bottom - 40, 'plant_tall').setDepth(3);
  scene.add.image(280, f4Bottom - 60, 'info_board').setDepth(3);

  const GEIR_MIN_X = 150;
  const GEIR_MAX_X = 260;
  const geir = scene.add
    .sprite(200, f4Bottom, 'npc_geir', 0)
    .setOrigin(0.5, 1)
    .setDepth(3);
  geir.play('geir_walk');
  scene.tweens.add({
    targets: geir,
    x: { from: GEIR_MIN_X, to: GEIR_MAX_X },
    duration: 2400,
    yoyo: true,
    repeat: -1,
    onYoyo: () => geir.setFlipX(true),
    onRepeat: () => geir.setFlipX(false),
  });
  const label = scene.add
    .text(200, f4Bottom - 140, 'Geir Harald', {
      fontFamily: 'monospace',
      fontSize: '12px',
      color: theme.color.css.textPale,
      fontStyle: 'bold',
      backgroundColor: theme.color.css.bgPanel,
      padding: { x: 6, y: 2 },
    })
    .setOrigin(0.5)
    .setDepth(4);
  const syncGeirLabelPosition = () => {
    label.x = geir.x;
  };
  scene.events.on('update', syncGeirLabelPosition);
  scene.events.once('shutdown', () => {
    scene.events.off('update', syncGeirLabelPosition);
  });
  const pad = 50;
  const geirBounds = {
    x: GEIR_MIN_X - pad,
    y: f4Bottom - 140,
    width: GEIR_MAX_X - GEIR_MIN_X + pad * 2,
    height: 150,
  };
  scene.add.image(rightEdge + 120, f4Bottom - 40, 'plant_tall').setDepth(3);
  scene.add.image(rightEdge + 280, f4Bottom - 36, 'desk_monitor').setDepth(3);
  scene.add.image(GAME_WIDTH - 100, f4Bottom - 40, 'plant_tall').setDepth(11);

  return { geirBounds };
}

function _drawF1PlatformDecorations(scene: Phaser.Scene, f1Bottom: number): void {
  scene.add.image(100, f1Bottom - 50, 'server_rack')
    .setDepth(3).setName('f1-left-server-rack-1');
  scene.add.image(170, f1Bottom - 50, 'server_rack')
    .setDepth(3).setName('f1-left-server-rack-2');
  scene.add.image(290, f1Bottom - 36, 'desk_monitor')
    .setDepth(3).setName('f1-left-desk-monitor');
  const dashMonitor = scene.add.image(400, f1Bottom - 22, 'monitor_dash')
    .setDepth(3).setName('f1-left-monitor-dash');
  scene.add.image(480, f1Bottom - 10, 'router')
    .setDepth(3).setName('f1-left-router');

  scene.tweens.add({
    targets: dashMonitor,
    alpha: 0.65,
    duration: 420,
    yoyo: true,
    repeat: -1,
    ease: 'Sine.easeInOut',
  });
}

function _drawF1ArchitectureDecorations(
  scene: Phaser.Scene,
  f1Bottom: number,
  rightEdge: number,
): void {
  const c4Board = scene.add
    .rectangle(rightEdge + 90, f1Bottom - 56, 120, 86, 0xf0eee2, 1)
    .setDepth(3).setStrokeStyle(2, 0xa8a79a, 1).setName('f1-right-c4-board');
  scene.add.text(c4Board.x, c4Board.y - 30, 'C4 CONTEXT', {
    fontFamily: 'monospace', fontSize: '10px', color: '#3a4a66', fontStyle: 'bold',
  }).setOrigin(0.5).setDepth(4);

  const adrBody = scene.add
    .rectangle(rightEdge + 250, f1Bottom - 58, 110, 92, 0x2a1e12, 1)
    .setDepth(3).setStrokeStyle(2, 0x7a5e36, 1).setName('f1-right-adr-terminal');
  scene.add.rectangle(adrBody.x, adrBody.y - 26, 90, 44, 0x08140a, 1).setDepth(4);
  scene.add.text(adrBody.x, adrBody.y + 14, 'ADR LOG', {
    fontFamily: 'monospace', fontSize: '9px', color: '#f5c36a',
  }).setOrigin(0.5).setDepth(4);
  const cursor = scene.add
    .rectangle(adrBody.x + 34, adrBody.y - 6, 4, 10, 0xe0b860, 1)
    .setDepth(5).setName('f1-right-adr-cursor');
  scene.tweens.add({
    targets: cursor, alpha: 0.15, duration: 260, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
  });

  const slicePanel = scene.add
    .rectangle(rightEdge + 410, f1Bottom - 58, 120, 94, 0x1a2238, 1)
    .setDepth(3).setStrokeStyle(2, 0x3b5a8a, 1).setName('f1-right-slice-panel');
  scene.add.text(slicePanel.x, slicePanel.y - 34, 'SLICES', {
    fontFamily: 'monospace', fontSize: '10px', color: '#e8f1ff', fontStyle: 'bold',
  }).setOrigin(0.5).setDepth(4);
  const highlight = scene.add
    .rectangle(slicePanel.x, slicePanel.y - 10, 96, 14, 0xfff2b0, 0.4)
    .setDepth(5).setName('f1-right-slice-highlight');
  scene.tweens.add({
    targets: highlight,
    y: highlight.y + 28,
    duration: 900,
    yoyo: true,
    repeat: -1,
    ease: 'Sine.easeInOut',
  });
}

function _drawF3ProductLeadershipDecorations(scene: Phaser.Scene, f3Bottom: number): void {
  const boardX = 160;
  const boardY = f3Bottom - 58;
  const board = scene.add
    .rectangle(boardX, boardY, 220, 110, 0xf4ecd8, 1)
    .setDepth(3).setStrokeStyle(2, 0x8a6a3a, 1).setName('f3-left-roadmap-board');
  scene.add.text(board.x, board.y - 44, 'ROADMAP', {
    fontFamily: 'monospace', fontSize: '10px', color: '#5a3a1a', fontStyle: 'bold',
  }).setOrigin(0.5).setDepth(4);

  const laneColors = [0xc98b5b, 0x5e8d6e, 0x5b7ac9];
  for (let i = 0; i < 3; i++) {
    const laneY = board.y - 18 + i * 18;
    scene.add.rectangle(board.x, laneY, 200, 12, laneColors[i], 0.35)
      .setDepth(4).setName(`f3-left-roadmap-lane-${i}`);
    for (let j = 0; j < 4; j++) {
      const pegX = board.x - 80 + j * 54;
      scene.add.circle(pegX, laneY, 3, laneColors[i], 1).setDepth(5);
    }
  }

  const nowMarker = scene.add
    .rectangle(board.x - 96, board.y - 10, 2, 66, 0xd23a3a, 0.9)
    .setDepth(6).setName('f3-left-roadmap-now-marker');
  scene.tweens.add({
    targets: nowMarker, x: board.x + 96, duration: 4800, yoyo: true, repeat: -1,
    ease: 'Sine.easeInOut',
  });

  const wallX = 360;
  const wallY = f3Bottom - 58;
  const wallBg = scene.add
    .rectangle(wallX, wallY, 120, 100, 0x2d2520, 1)
    .setDepth(3).setStrokeStyle(2, 0x4a3b2a, 1).setName('f3-left-outcomes-wall');
  scene.add.text(wallBg.x, wallBg.y - 38, 'OUTCOMES', {
    fontFamily: 'monospace', fontSize: '9px', color: '#e8d4a8', fontStyle: 'bold',
  }).setOrigin(0.5).setDepth(4);
  const postitColors = [0xffe066, 0xff9f66, 0x9be37a, 0x66c3ff, 0xffa8d0, 0xffe066];
  for (let i = 0; i < 6; i++) {
    const col = i % 3;
    const row = Math.floor(i / 3);
    scene.add.rectangle(
      wallBg.x - 32 + col * 32,
      wallBg.y - 10 + row * 24,
      22, 18, postitColors[i], 0.95,
    ).setDepth(4).setName(`f3-left-outcomes-postit-${i}`);
  }

  scene.add.image(480, f3Bottom - 40, 'plant_tall').setDepth(3).setName('f3-left-plant');
}

function _drawF3CustomerSuccessDecorations(
  scene: Phaser.Scene,
  f3Bottom: number,
  rightEdge: number,
): void {
  const gaugeX = rightEdge + 90;
  const gaugeY = f3Bottom - 60;
  const gaugeBody = scene.add
    .rectangle(gaugeX, gaugeY, 120, 96, 0x1a2a3a, 1)
    .setDepth(3).setStrokeStyle(2, 0x3a6a9a, 1).setName('f3-right-nps-gauge');
  scene.add.text(gaugeBody.x, gaugeBody.y - 34, 'NPS', {
    fontFamily: 'monospace', fontSize: '10px', color: '#e8f1ff', fontStyle: 'bold',
  }).setOrigin(0.5).setDepth(4);
  scene.add.rectangle(gaugeBody.x - 28, gaugeBody.y - 6, 24, 8, 0xd23a3a, 1).setDepth(4);
  scene.add.rectangle(gaugeBody.x,      gaugeBody.y - 6, 24, 8, 0xe8c23a, 1).setDepth(4);
  scene.add.rectangle(gaugeBody.x + 28, gaugeBody.y - 6, 24, 8, 0x3aa85e, 1).setDepth(4);
  const needle = scene.add
    .rectangle(gaugeBody.x, gaugeBody.y - 6, 2, 34, 0xffffff, 1)
    .setOrigin(0.5, 1).setDepth(5).setName('f3-right-nps-needle');
  scene.tweens.add({
    targets: needle, angle: { from: -55, to: 55 }, duration: 2400,
    yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
  });
  scene.add.text(gaugeBody.x, gaugeBody.y + 30, '+42', {
    fontFamily: 'monospace', fontSize: '12px', color: '#9be37a', fontStyle: 'bold',
  }).setOrigin(0.5).setDepth(4);

  const queueX = rightEdge + 250;
  const queueY = f3Bottom - 60;
  const queueBody = scene.add
    .rectangle(queueX, queueY, 120, 96, 0x0f1a22, 1)
    .setDepth(3).setStrokeStyle(2, 0x2a5a7a, 1).setName('f3-right-ticket-queue');
  scene.add.text(queueBody.x, queueBody.y - 34, 'TICKETS', {
    fontFamily: 'monospace', fontSize: '9px', color: '#6ec6ff', fontStyle: 'bold',
  }).setOrigin(0.5).setDepth(4);
  const rowColors = [0x2a3a4a, 0x2a3a4a, 0x2a3a4a, 0x2a3a4a];
  rowColors.forEach((color, i) => {
    scene.add.rectangle(queueBody.x, queueBody.y - 12 + i * 14, 100, 10, color, 1).setDepth(4);
  });
  const activeRow = scene.add
    .rectangle(queueBody.x, queueBody.y - 12, 100, 10, 0x6ec6ff, 0.35)
    .setDepth(5).setName('f3-right-ticket-active-row');
  scene.tweens.add({
    targets: activeRow, y: queueBody.y + 30, duration: 2200, repeat: -1, ease: 'Linear',
    onRepeat: () => { activeRow.y = queueBody.y - 12; },
  });

  const slaX = rightEdge + 410;
  const slaY = f3Bottom - 60;
  const slaBody = scene.add
    .rectangle(slaX, slaY, 120, 96, 0x15221a, 1)
    .setDepth(3).setStrokeStyle(2, 0x3aa85e, 1).setName('f3-right-sla-tile');
  scene.add.text(slaBody.x, slaBody.y - 34, 'SLA', {
    fontFamily: 'monospace', fontSize: '10px', color: '#9be37a', fontStyle: 'bold',
  }).setOrigin(0.5).setDepth(4);
  scene.add.text(slaBody.x, slaBody.y - 2, '99.9%', {
    fontFamily: 'monospace', fontSize: '16px', color: '#c8ffb0', fontStyle: 'bold',
  }).setOrigin(0.5).setDepth(4);
  const pulse = scene.add
    .circle(slaBody.x + 44, slaBody.y - 34, 4, 0x3aff6a, 1)
    .setDepth(5).setName('f3-right-sla-pulse');
  scene.tweens.add({
    targets: pulse, alpha: 0.25, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
  });

  scene.add.image(rightEdge + 500, f3Bottom - 40, 'plant_tall')
    .setDepth(3).setName('f3-right-plant');
}
