import * as Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, FLOORS } from '../../../config/gameConfig';
import { Player } from '../../../entities/Player';
import { CEOBoss } from '../../../entities/CEOBoss';
import { CoffeeMugProjectile } from '../../../entities/CoffeeMugProjectile';
import { BriefcaseProjectile } from '../../../entities/BriefcaseProjectile';
import { Checkpoint } from '../../../entities/Checkpoint';
import { BossHealthBar } from '../../../ui/BossHealthBar';
import { BossIntroDialog } from '../../../ui/BossIntroDialog';
import { Toast } from '../../../ui/Toast';
import { GameStateManager } from '../../../systems/GameStateManager';
import { ProgressionSystem } from '../../../systems/ProgressionSystem';
import { FloorHitState } from '../../../systems/FloorHitState';
import { eventBus } from '../../../systems/EventBus';
import { isReducedMotion } from '../../../systems/MotionPreference';
import { allKeyLabels } from '../../../input';
import {
  PERSISTENT_TEXTURE_KEYS,
  clearSceneOwnedTextureKeys,
  ensureBossArenaSprites,
  getSceneOwnedTextureKeys,
} from '../../../systems/SpriteGenerator';
import { ensureBossRescueSounds } from '../../../systems/SoundGenerator';
import { createSceneLifecycle } from '../../../systems/sceneLifecycle';

/** Architecture quiz prompts used during knowledge windows. */
export interface BossPrompt {
  scenario: string;
  options: [string, string, string];
  /** Index (0-based) of the correct answer. */
  correct: 0 | 1 | 2;
  feedback: string;
}

/** AU required to enter the boss arena (used in create() gate check). */
export const AU_GATE = 30;

/** Exported for unit tests only — do not consume in scene code outside this file. */
export const PROMPTS: BossPrompt[] = [
  {
    scenario: 'Your platform team wants to build everything in-house. Your product team needs to ship in 4 weeks. What do you advise?',
    options: ['Build in-house — full control', 'Buy a SaaS tool — ship now', 'Delay the product team'],
    correct: 1,
    feedback: 'Pragmatism over purity. Buy and iterate.',
  },
  {
    scenario: 'A service is getting 10× the expected load. The quick fix is 5× more instances. The proper fix is 3 months of refactoring. Choose.',
    options: ['Scale horizontally now, refactor next quarter', 'Refactor first — debt compounds', 'Ignore it — it will stabilise'],
    correct: 0,
    feedback: 'Buy time with scale. Pay the debt deliberately, not accidentally.',
  },
  {
    scenario: 'Two teams want to own the same shared library. Standardise centrally or let each fork?',
    options: ['Centralise — consistency wins', 'Fork — teams move faster', 'Neither — deprecate the library'],
    correct: 0,
    feedback: 'Shared capability with clear ownership beats N forks diverging silently.',
  },
  {
    scenario: 'The CEO wants a new feature in 2 weeks but it will require cutting corners on security. What do you recommend?',
    options: ['Deliver with the shortcuts — deadline is king', 'Negotiate scope — ship a safe MVP', 'Refuse entirely'],
    correct: 1,
    feedback: 'Architect the conversation, not just the system. An MVP is not a compromise.',
  },
  {
    scenario: 'Governance board mandates a single approved cloud provider. One team\'s workload would run 40% cheaper on a different cloud. Do you allow an exception?',
    options: ['No — standards exist for a reason', 'Yes — cost savings justify exceptions', 'Pilot it, measure, then decide'],
    correct: 2,
    feedback: 'Principles over rules. Gather data before institutionalising the exception.',
  },
];

/** Exported for unit tests only — do not consume in scene code outside this file. */
export const DIALOGUES = [
  { lines: ['"Not bad."', '"You think faster than most."', '"We\'ll manage this together."'] },
  { lines: ['"Impressive."', '"You\'ve studied the elevator, I see."', '"We\'ll manage this together."'] },
  { lines: ['"Ha!"', '"You actually understand the trade-offs."', '"We\'ll manage this together."'] },
];

const MUG_PICKUP_PLATFORM_OFFSET_Y = 16;
const MUG_PLATFORM_HEIGHT_ABOVE_GROUND = 300;

/**
 * Boss arena scene — CEO Showdown.
 *
 * Standalone scene (extends Phaser.Scene directly — no LevelScene base).
 * AU gate: requires 30 AU. Three-phase hybrid fight:
 *   - Throw mugs (K.X) to deal damage.
 *   - Answer architecture prompts during knowledge windows to disable hazards
 *     and earn the right to finish the boss (knowledge gate).
 * Boss ends with a respectful knowledge handoff cutscene.
 */
export class BossArenaScene extends Phaser.Scene {
  private player!: Player;
  private boss!: CEOBoss;
  private healthBar!: BossHealthBar;
  private gameState!: GameStateManager;
  private progression!: ProgressionSystem;

  private platformGroup!: Phaser.Physics.Arcade.StaticGroup;
  private mugGroup!: Phaser.Physics.Arcade.Group;
  private briefcaseGroup!: Phaser.Physics.Arcade.Group;

  /** Number of mugs currently held (inventory counter). */
  private heldMugs = 0;
  static readonly MAX_HELD_MUGS = 3;

  /** Mug pickup platforms — each has a respawn timer. */
  private mugPlatforms: Array<{ x: number; y: number; count: number; respawnMs: number; elapsed: number }> = [];
  private mugCountText?: Phaser.GameObjects.Text;
  private readonly maxMugsPerPlatform = 1;

  private promptActive = false;
  private promptPanel?: Phaser.GameObjects.Container;
  private promptTimer = 30000; // ms until first prompt

  private isTransitioning = false;
  private playerHitCount = 0;

  /** Mechanic-hint toast shown at fight start and on phase transitions. Assigned in buildUI(). */
  private mechHintToast!: Toast;

  /** Per-visit hit / checkpoint tracking. */
  private readonly floorHazard = new FloorHitState();
  /** Danger vignette overlay. */
  private dangerVignette?: Phaser.GameObjects.Graphics;
  /** Heartbeat SFX accumulator (ms). */
  private heartbeatElapsed = 0;
  private static readonly HEARTBEAT_INTERVAL_MS = 850;

  constructor() {
    super({ key: 'BossArenaScene' });
  }

  init(): void {
    this.gameState = this.registry.get('gameState') as GameStateManager;
    this.progression = this.gameState.progression;
    this.floorHazard.reset();
    this.heartbeatElapsed = 0;
    this.playerHitCount = 0;
  }

  create(): void {
    // AU gate — needs AU_GATE AU to enter
    if (this.progression.getTotalAU() < AU_GATE) {
      this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2, `You need ${AU_GATE} AU to reach the Boardroom.`, {
        fontFamily: 'monospace', fontSize: '20px', color: '#ff4444',
      }).setOrigin(0.5);
      this.time.delayedCall(2500, () => this.scene.start('ElevatorScene'));
      return;
    }

    this.cameras.main.setBackgroundColor(0x0a0a0a);
    this.physics.world.setBounds(0, 0, GAME_WIDTH, GAME_HEIGHT);
    ensureBossArenaSprites(this);
    ensureBossRescueSounds(this);

    this.buildArena();
    this.spawnPlayer();
    this.spawnBoss();
    this.buildUI();
    this.wireColliders();
    this.spawnInitialMugPickups();
    this.spawnCheckpoint();
    this.buildDangerVignette();

    this.cameras.main.fadeIn(600, 0, 0, 0);

    // Check first visit BEFORE marking it — intro modal fires exactly once.
    const isFirstVisit = !this.progression.hasVisitedFloor(FLOORS.BOSS);
    this.progression.markFloorVisited(FLOORS.BOSS);
    this.gameState.checkAchievements();

    this.scopedEvents.on('boss:phase_changed', this.onPhaseChanged);
    const lc = createSceneLifecycle(this);
    lc.add(() => this.onShutdown());

    // Start playtime tracking for the boss floor.
    const tracker = this.gameState.playtime;
    tracker.setFloor(FLOORS.BOSS);
    tracker.resume();
    // Phaser automatically removes these listeners on shutdown.
    this.events.on(Phaser.Scenes.Events.PAUSE, () => tracker.pause(), this);
    this.events.on(Phaser.Scenes.Events.RESUME, () => tracker.resume(), this);

    if (isFirstVisit) {
      // Freeze the arena until the player dismisses the intro card.
      this.isTransitioning = true;
      this.physics.pause();
      new BossIntroDialog(this, () => {
        this.physics.resume();
        this.isTransitioning = false;
        this.showMechanicHint(`${allKeyLabels('Attack')} — Throw mug  |  Collect mugs from the side platforms`);
      });
    } else {
      // Brief reminder on every replay — unobtrusive bottom-right toast.
      this.time.delayedCall(1500, () => {
        this.showMechanicHint(`${allKeyLabels('Attack')} — Throw mug`);
      });
    }
  }

  private buildArena(): void {
    const G = GAME_HEIGHT - 64;

    this.platformGroup = this.physics.add.staticGroup();

    // Draw ground
    const groundGfx = this.add.graphics().setDepth(2);
    groundGfx.fillStyle(0x2a1a0a, 1);
    groundGfx.fillRect(0, G, GAME_WIDTH, GAME_HEIGHT - G);
    groundGfx.lineStyle(2, 0xffd700, 0.6);
    groundGfx.lineBetween(0, G, GAME_WIDTH, G);

    // Ground static body (single wide tile)
    const ground = this.platformGroup.create(GAME_WIDTH / 2, G + (GAME_HEIGHT - G) / 2, '__DEFAULT') as Phaser.Physics.Arcade.Image;
    ground.setVisible(false);
    const gb = ground.body as Phaser.Physics.Arcade.StaticBody;
    gb.setSize(GAME_WIDTH, GAME_HEIGHT - G);
    ground.refreshBody();

    // Boss dais — centre elevated platform
    this.addPlatformTile(GAME_WIDTH / 2 - 64, G - 200, 128, 16, 0x3a2a1a);

    // Left + right mug platforms
    this.addPlatformTile(160, G - MUG_PLATFORM_HEIGHT_ABOVE_GROUND, 96, 14, 0x2a1a0a);
    this.addPlatformTile(GAME_WIDTH - 256, G - MUG_PLATFORM_HEIGHT_ABOVE_GROUND, 96, 14, 0x2a1a0a);

    // Mug spawn points (linked to pickup platforms)
    this.mugPlatforms = [
      {
        x: 208,
        y: G - MUG_PLATFORM_HEIGHT_ABOVE_GROUND - MUG_PICKUP_PLATFORM_OFFSET_Y,
        count: 0,
        respawnMs: 10000,
        elapsed: 0,
      },
      {
        x: GAME_WIDTH - 208,
        y: G - MUG_PLATFORM_HEIGHT_ABOVE_GROUND - MUG_PICKUP_PLATFORM_OFFSET_Y,
        count: 0,
        respawnMs: 10000,
        elapsed: 0,
      },
    ];

    // Ambient backdrop — strategy war-room feel
    this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x0a0a0a).setOrigin(0, 0).setDepth(0);
    // Subtle grid lines
    const bg = this.add.graphics().setDepth(1);
    bg.lineStyle(1, 0x1a1a2a, 0.4);
    for (let y = 0; y < GAME_HEIGHT; y += 64) bg.lineBetween(0, y, GAME_WIDTH, y);
    for (let x = 0; x < GAME_WIDTH; x += 64) bg.lineBetween(x, 0, x, GAME_HEIGHT);

    // Digital whiteboard (decorative)
    const wbX = GAME_WIDTH - 160;
    const wbY = G - 320;
    this.add.rectangle(wbX, wbY, 140, 90, 0x0a1a2a).setDepth(3);
    this.add.rectangle(wbX, wbY, 140, 90, 0x000000, 0).setStrokeStyle(2, 0x4466aa).setDepth(3);
    this.add.text(wbX, wbY, 'ARCHITECTURE\nSTRATEGY\n2026', {
      fontFamily: 'monospace', fontSize: '11px', color: '#4488cc', align: 'center',
    }).setOrigin(0.5).setDepth(3);
  }

  private addPlatformTile(x: number, y: number, w: number, h: number, color: number): void {
    const g = this.add.graphics().setDepth(2);
    g.fillStyle(color, 1);
    g.fillRect(x, y, w, h);
    g.lineStyle(1, 0xffd700, 0.4);
    g.strokeRect(x, y, w, h);

    const tile = this.platformGroup.create(x + w / 2, y + h / 2, '__DEFAULT') as Phaser.Physics.Arcade.Image;
    tile.setVisible(false);
    const tb = tile.body as Phaser.Physics.Arcade.StaticBody;
    tb.setSize(w, h);
    tile.refreshBody();
  }

  private spawnPlayer(): void {
    const { cpX, cpY, defaultSpawn } = this.getCheckpointPlacement();
    const checkpointId = this.progression.getLatestActivatedCheckpointId(FLOORS.BOSS);
    const hasBossCheckpoint = checkpointId === 'boss-cp-1';
    const spawn = hasBossCheckpoint ? { x: cpX, y: cpY } : defaultSpawn;
    this.player = new Player(this, spawn.x, spawn.y);
    if (hasBossCheckpoint) {
      this.floorHazard.registerCheckpoint(spawn.x, spawn.y);
    }
    this.physics.add.collider(this.player.sprite, this.platformGroup);
  }

  private spawnBoss(): void {
    const G = GAME_HEIGHT - 64;
    this.boss = new CEOBoss(this, GAME_WIDTH - 200, G - 80, 64, GAME_WIDTH - 64);
    this.physics.add.collider(this.boss, this.platformGroup);

    this.boss.on('throwBriefcase', (playerX: number) => this.spawnBriefcase(playerX));
    this.boss.on('defeatDialogue', () => this.showDefeatDialogue());
    this.boss.on('bossBarrage', () => {
      for (const offsetY of [-30, 0, 30]) {
        this.spawnBriefcase(this.player.sprite.x, offsetY);
      }
    });
  }

  private buildUI(): void {
    this.healthBar = new BossHealthBar(this, 'CEO — The Knowledge Cowboy', CEOBoss.MAX_HP);

    this.mugCountText = this.add.text(20, 20, 'Mugs: 0', {
      fontFamily: 'monospace', fontSize: '14px', color: '#ffd700',
    }).setScrollFactor(0).setDepth(60);

    const attackHint = allKeyLabels('Attack');
    this.add.text(GAME_WIDTH / 2, GAME_HEIGHT - 20, `${attackHint} — Throw Mug  |  Collect mugs from platforms  |  Answer challenges to unlock the final blow`, {
      fontFamily: 'monospace', fontSize: '12px', color: '#888899',
    }).setOrigin(0.5).setScrollFactor(0).setDepth(60);

    this.mechHintToast = new Toast(this);
  }

  private wireColliders(): void {
    this.mugGroup = this.physics.add.group();
    this.briefcaseGroup = this.physics.add.group();

    // Briefcases hit player
    this.physics.add.overlap(
      this.player.sprite,
      this.briefcaseGroup,
      (_, bc) => {
        const b = bc as BriefcaseProjectile;
        if (!this.player.isInvulnerable()) {
          this.playerHitCount++;
          this.player.takeHit(0, -260);
          eventBus.emit('sfx:hit');
          if (!isReducedMotion()) this.cameras.main.shake(120, 0.005);
          const shouldRespawn = this.floorHazard.recordHit();
          if (shouldRespawn) {
            this.triggerRespawn();
          }
        }
        b.destroySelf();
      },
    );
  }

  update(_time: number, delta: number): void {
    if (this.isTransitioning) return;
    if (!this.boss || this.boss.defeated) return;

    this.player.update(delta);
    this.boss.update(delta, this.player.sprite.x, this.player.sprite.y);
    this.healthBar.update(this.boss.currentHp);
    this.updateDangerState(delta);

    // Mug platform respawns (visual + pickup items managed inline)
    for (const mp of this.mugPlatforms) {
      if (mp.count < this.maxMugsPerPlatform) {
        mp.elapsed += delta;
        if (mp.elapsed >= mp.respawnMs) {
          mp.elapsed = 0;
          this.spawnMugPickup(mp);
        }
      }
    }

    // Attack input — throw held mug
    if (this.inputs.justPressed('Attack')) {
      this.throwMug();
    }

    // Knowledge window timer
    if (!this.promptActive) {
      this.promptTimer -= delta;
      if (this.promptTimer <= 0) {
        this.promptTimer = this.boss.phase === 1 ? 25000 : this.boss.phase === 2 ? 18000 : 12000;
        this.showPrompt();
      }
    }

    this.mugCountText?.setText(`Mugs: ${this.heldMugs}`);

    // Throttled playtime persist.
    this.gameState.playtime.update();
  }

  private spawnInitialMugPickups(): void {
    for (const mp of this.mugPlatforms) {
      if (mp.count < this.maxMugsPerPlatform) {
        this.spawnMugPickup(mp);
      }
    }
  }

  private spawnMugPickup(mp: { x: number; y: number; count: number; elapsed: number }): void {
    mp.count++;
    const pickup = this.add.image(mp.x, mp.y, 'mug_projectile').setDepth(5);
    this.physics.add.existing(pickup, true);
    this.physics.add.overlap(
      this.player.sprite,
      pickup,
      () => {
        if (this.heldMugs >= BossArenaScene.MAX_HELD_MUGS) return;
        pickup.destroy();
        this.heldMugs++;
        mp.count = Math.max(0, mp.count - 1);
        mp.elapsed = 0;
        eventBus.emit('sfx:item_pickup');
      },
    );
  }

  private throwMug(): void {
    if (this.heldMugs === 0) return;
    this.heldMugs--;

    // Spawn projectile
    const facingRight = !this.player.sprite.flipX;
    const mug = new CoffeeMugProjectile(
      this,
      this.player.sprite.x + (facingRight ? 20 : -20),
      this.player.sprite.y - 10,
      facingRight,
    );
    this.mugGroup.add(mug);
    eventBus.emit('sfx:mug_throw');
    // Wire overlap for this projectile against the boss
    this.physics.add.overlap(
      mug,
      this.boss,
      () => {
        if (!this.boss.defeated) {
          const hit = this.boss.takeDamage();
          this.healthBar.update(this.boss.currentHp);
          if (!hit && this.boss.currentHp <= 1 && this.boss.phasePromptsAnsweredCorrectly === 0) {
            this.showToast('Answer a challenge first!');
          }
        }
        mug.destroySelf();
      },
    );
  }

  private spawnBriefcase(playerX: number, yOffset = 0): void {
    const toRight = playerX > this.boss.x;
    const bc = new BriefcaseProjectile(
      this,
      this.boss.x + (toRight ? 30 : -30),
      this.boss.y + yOffset,
      toRight,
    );
    this.briefcaseGroup.add(bc);
  }

  private showPrompt(): void {
    if (this.promptActive || this.boss.defeated) return;
    this.promptActive = true;

    const prompt = PROMPTS[Math.floor(Math.random() * PROMPTS.length)]!;
    const panelW = 760;
    const panelH = 220;
    const px = GAME_WIDTH / 2;
    const py = GAME_HEIGHT / 2 + 80;

    const bg = this.add.graphics();
    bg.fillStyle(0x0a0a1a, 0.95);
    bg.fillRoundedRect(-panelW / 2, -panelH / 2, panelW, panelH, 8);
    bg.lineStyle(2, 0xffd700, 0.8);
    bg.strokeRoundedRect(-panelW / 2, -panelH / 2, panelW, panelH, 8);

    const title = this.add.text(-panelW / 2 + 16, -panelH / 2 + 12, '⚡ ARCHITECTURE CHALLENGE', {
      fontFamily: 'monospace', fontSize: '13px', color: '#ffd700', fontStyle: 'bold',
    });
    const scenarioText = this.add.text(0, -panelH / 2 + 34, prompt.scenario, {
      fontFamily: 'monospace', fontSize: '13px', color: '#ccddff',
      wordWrap: { width: panelW - 32 }, align: 'center',
    }).setOrigin(0.5, 0);

    const buttons: Phaser.GameObjects.Text[] = [];
    const optionY = -panelH / 2 + 100;
    const optionSpacing = 34;
    for (let i = 0; i < 3; i++) {
      const btn = this.add.text(0, optionY + i * optionSpacing, `${i + 1}. ${prompt.options[i]}`, {
        fontFamily: 'monospace', fontSize: '12px', color: '#aabbcc',
        backgroundColor: '#1a1a2a', padding: { x: 10, y: 4 },
      }).setOrigin(0.5, 0).setInteractive({ useHandCursor: true });

      btn.on('pointerover', () => btn.setColor('#ffd700'));
      btn.on('pointerout', () => btn.setColor('#aabbcc'));
      btn.on('pointerdown', () => this.resolvePrompt(prompt, i as 0 | 1 | 2, container));
      buttons.push(btn);
    }

    const container = this.add.container(px, py, [bg, title, scenarioText, ...buttons])
      .setScrollFactor(0)
      .setDepth(80);

    this.promptPanel = container;

    // Also listen for keyboard 1/2/3
    const K = Phaser.Input.Keyboard.KeyCodes;
    const handler = (key: Phaser.Input.Keyboard.Key) => {
      const k = key.keyCode;
      if (k === K.ONE)   this.resolvePrompt(prompt, 0, container);
      else if (k === K.TWO)   this.resolvePrompt(prompt, 1, container);
      else if (k === K.THREE) this.resolvePrompt(prompt, 2, container);
    };
    this.input.keyboard?.on('keydown', handler);
    container.setData('keyHandler', handler);
  }

  private resolvePrompt(
    prompt: BossPrompt,
    chosen: 0 | 1 | 2,
    container: Phaser.GameObjects.Container,
  ): void {
    const handler = container.getData('keyHandler');
    if (handler) this.input.keyboard?.off('keydown', handler);
    container.destroy();
    this.promptPanel = undefined;
    this.promptActive = false;

    const correct = chosen === prompt.correct;
    eventBus.emit(correct ? 'sfx:quiz_correct' : 'sfx:quiz_wrong');

    // Feedback toast
    const toast = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 20, prompt.feedback, {
      fontFamily: 'monospace', fontSize: '14px',
      color: correct ? '#44ff88' : '#ff4444',
      backgroundColor: '#0a0a1a', padding: { x: 12, y: 6 },
    }).setOrigin(0.5).setScrollFactor(0).setDepth(80);

    const phaseBefore = this.boss.phase;
    if (correct) {
      this.boss.onCorrectAnswer();
      this.healthBar.update(this.boss.currentHp);
      if (phaseBefore === 2) {
        this.showToast('Briefcases disabled for 10s!', '#44ff88', GAME_HEIGHT / 2 + 20, 200);
      } else if (phaseBefore === 3) {
        this.showToast('Boss stunned! Attack now!', '#44ff88', GAME_HEIGHT / 2 + 20, 200);
      }
    } else {
      this.boss.onWrongAnswer();
      this.healthBar.update(this.boss.currentHp);
      if (phaseBefore === 2) {
        this.showToast('Rage mode! Faster briefcases!', '#ff8844', GAME_HEIGHT / 2 + 20, 200);
      } else if (phaseBefore === 3) {
        this.showToast('BARRAGE!', '#ff8844', GAME_HEIGHT / 2 + 20, 200);
      }
    }

    this.tweens.add({
      targets: toast,
      alpha: 0,
      y: toast.y - 40,
      duration: 2000,
      delay: 1200,
      onComplete: () => toast.destroy(),
    });
  }

  private showToast(text: string, color = '#ff8844', y = GAME_HEIGHT / 2, delay = 0): void {
    this.time.delayedCall(delay, () => {
      const toast = this.add.text(GAME_WIDTH / 2, y, text, {
        fontFamily: 'monospace', fontSize: '14px',
        color,
        backgroundColor: '#0a0a1a', padding: { x: 12, y: 6 },
      }).setOrigin(0.5).setScrollFactor(0).setDepth(80);
      this.tweens.add({
        targets: toast,
        alpha: 0,
        y: toast.y - 40,
        duration: 2000,
        delay: 1200,
        onComplete: () => toast.destroy(),
      });
    });
  }

  private showDefeatDialogue(): void {
    this.isTransitioning = true;
    const dialogue = DIALOGUES[Math.floor(Math.random() * DIALOGUES.length)]!;
    const panelW = 540;
    const panelH = 130;
    const px = GAME_WIDTH / 2;
    const py = GAME_HEIGHT / 2 - 60;

    const bg = this.add.graphics();
    bg.fillStyle(0x0a0a1a, 0.95);
    bg.fillRoundedRect(-panelW / 2, -panelH / 2, panelW, panelH, 8);
    bg.lineStyle(2, 0xffd700, 1);
    bg.strokeRoundedRect(-panelW / 2, -panelH / 2, panelW, panelH, 8);

    const speaker = this.add.text(-panelW / 2 + 12, -panelH / 2 + 10, 'CEO — The Knowledge Cowboy', {
      fontFamily: 'monospace', fontSize: '12px', color: '#ffd700', fontStyle: 'bold',
    });

    let lineIdx = 0;
    const lineText = this.add.text(0, -8, '', {
      fontFamily: 'monospace', fontSize: '15px', color: '#e0e0f0',
      wordWrap: { width: panelW - 32 }, align: 'center',
    }).setOrigin(0.5);

    const hint = this.add.text(panelW / 2 - 12, panelH / 2 - 10, `Press ${allKeyLabels('Interact')}`, {
      fontFamily: 'monospace', fontSize: '11px', color: '#666677',
    }).setOrigin(1, 1);

    const container = this.add.container(px, py, [bg, speaker, lineText, hint])
      .setScrollFactor(0).setDepth(90);

    let finished = false;
    const enableAdvanceCall: { event?: Phaser.Time.TimerEvent } = {};
    const showNextLine = (): void => {
      if (finished) return;
      if (lineIdx < dialogue.lines.length) {
        lineText.setText(dialogue.lines[lineIdx] ?? '');
        lineIdx++;
      } else {
        finished = true;
        this.inputs.off('Interact', showNextLine);
        enableAdvanceCall.event?.remove(false);
        container.destroy();
        this.boss.fadeOut();
        this.time.delayedCall(1400, () => this.showVictory());
      }
    };
    showNextLine();

    enableAdvanceCall.event = this.time.delayedCall(600, () => {
      this.inputs.on('Interact', showNextLine);
    });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.inputs.off('Interact', showNextLine);
      enableAdvanceCall.event?.remove(false);
    });
  }

  private showVictory(): void {
    const noDamage = this.playerHitCount === 0;

    // Award AU
    this.progression.addAU(FLOORS.BOSS, 20);
    this.gameState.checkBossAchievements(true, noDamage);
    eventBus.emit('game:completed');

    // Capture the run elapsed time BEFORE recordClear() clears runStartedAt,
    // so we always display the time for THIS run (not just the best ever).
    const tracker = this.gameState.playtime;
    const thisRunMs = tracker.getRunElapsedMs(); // 0 when no run was active
    const isNewBest = tracker.recordClear();
    const bestMs = tracker.getBestClearMs();
    tracker.flush();

    const overlay = this.add.graphics().setScrollFactor(0).setDepth(100);
    overlay.fillStyle(0x000000, 0.7);
    overlay.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 80, '✓  ARCHITECT APPROVED', {
      fontFamily: 'monospace', fontSize: '32px', color: '#ffd700', fontStyle: 'bold',
    }).setOrigin(0.5).setScrollFactor(0).setDepth(101);

    this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 30, '+20 Architecture Utility', {
      fontFamily: 'monospace', fontSize: '18px', color: '#e0e0f0',
    }).setOrigin(0.5).setScrollFactor(0).setDepth(101);

    // Clear time display — only shown when a run was active.
    if (thisRunMs > 0) {
      this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 10, `Run time: ${this._formatMs(thisRunMs)}`, {
        fontFamily: 'monospace', fontSize: '15px', color: '#aaddff',
      }).setOrigin(0.5).setScrollFactor(0).setDepth(101);

      if (isNewBest) {
        this.mechHintToast.show(`⏱ New best run: ${this._formatMs(thisRunMs)}`);
        this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 34, '⭐ NEW BEST!', {
          fontFamily: 'monospace', fontSize: '17px', color: '#ffd700', fontStyle: 'bold',
        }).setOrigin(0.5).setScrollFactor(0).setDepth(101);
      } else if (bestMs !== undefined) {
        this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 34, `Best: ${this._formatMs(bestMs)}`, {
          fontFamily: 'monospace', fontSize: '13px', color: '#888',
        }).setOrigin(0.5).setScrollFactor(0).setDepth(101);
      }
    }

    if (noDamage) {
      this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 62, '🏆  Untouchable', {
        fontFamily: 'monospace', fontSize: '16px', color: '#ffd700',
      }).setOrigin(0.5).setScrollFactor(0).setDepth(101);
    }

    this.time.delayedCall(3500, () => {
      this.cameras.main.fadeOut(600, 0, 0, 0);
      this.time.delayedCall(600, () => this.scene.start('ElevatorScene', {
        fromFloor: FLOORS.BOSS, spawnSide: 'left',
      } satisfies import('../../../scenes/NavigationContext').NavigationContext));
    });
  }

  /** Format milliseconds as M:SS for the victory screen. */
  private _formatMs(ms: number): string {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }

  private onPhaseChanged = (phase: number): void => {
    const reducedMotion = isReducedMotion();

    // Camera reaction
    if (!reducedMotion) {
      this.cameras.main.shake(150, 0.008);
      this.cameras.main.flash(200, 255, 255, 255, false);
    }

    // HP bar glow
    this.healthBar.flash(phase);

    // Phase-specific toasts
    if (phase === 2) {
      this.showToast('⚡ HOSTILE TAKEOVER', '#ff8800', GAME_HEIGHT / 2 - 60);
      // Mechanic hint — brief reminder about the new attack pattern
      this.showMechanicHint('⚡ Watch the briefcase volley — jump to dodge');
    } else if (phase === 3) {
      this.showToast('💀 GOLDEN PARACHUTE', '#ff2222', GAME_HEIGHT / 2 - 60);
      // Rage tell — warn player about the faster briefcase pattern
      this.showToast('⚠ RAGE MODE — Briefcases incoming!', '#ff8844', GAME_HEIGHT / 2 - 20, 600);
    }
  };

  /** Show a transient mechanic hint in the bottom-right Toast. */
  private showMechanicHint(message: string): void {
    this.mechHintToast.show(message);
  }

  private onShutdown(): void {
    // Flush playtime before the scene is destroyed.
    this.gameState.playtime.pause();
    this.gameState.playtime.flush();
    // showPrompt() stores its raw 1/2/3 keyboard handler on the active panel.
    const promptHandler = this.promptPanel?.getData('keyHandler');
    if (promptHandler) this.input.keyboard?.off('keydown', promptHandler);
    const ownedKeys = getSceneOwnedTextureKeys(this);
    for (const key of ownedKeys) {
      if (PERSISTENT_TEXTURE_KEYS.has(key)) continue;
      if (this.textures.exists(key)) this.textures.remove(key);
    }
    clearSceneOwnedTextureKeys(this);
  }

  /* ---- checkpoint ---- */

  private spawnCheckpoint(): void {
    // Place the checkpoint on the left mug platform — gives a mid-arena
    // respawn point after the player reaches the elevated area.
    const { cpX, cpY } = this.getCheckpointPlacement();
    const cpId = 'boss-cp-1';
    const activatedOnSpawn = this.progression.getActivatedCheckpointIds(FLOORS.BOSS).includes(cpId);
    const cp = new Checkpoint(this, cpX, cpY, cpId, () => {
      this.floorHazard.registerCheckpoint(cpX, cpY);
      this.progression.activateCheckpoint(FLOORS.BOSS, cpId);
      eventBus.emit('checkpoint:activate', cpId);
    }, activatedOnSpawn);
    if (activatedOnSpawn) {
      this.floorHazard.registerCheckpoint(cpX, cpY);
    }
    cp.wireOverlap(this.physics, this.player.sprite);
  }

  private getCheckpointPlacement(): { cpX: number; cpY: number; defaultSpawn: { x: number; y: number } } {
    const G = GAME_HEIGHT - 64;
    return {
      cpX: 208,
      cpY: G - MUG_PLATFORM_HEIGHT_ABOVE_GROUND - MUG_PICKUP_PLATFORM_OFFSET_Y - 20,
      defaultSpawn: { x: 140, y: G - 80 },
    };
  }

  private buildDangerVignette(): void {
    this.dangerVignette = this.add.graphics()
      .setDepth(98)
      .setScrollFactor(0)
      .setVisible(false);
    const g = this.dangerVignette;
    const alpha = 0.35;
    const w = GAME_WIDTH;
    const h = GAME_HEIGHT;
    const band = 80;
    g.fillStyle(0xff2222, alpha);
    g.fillRect(0,       0,       w,    band);
    g.fillRect(0,       h - band, w,   band);
    g.fillRect(0,       0,       band, h);
    g.fillRect(w - band, 0,      band, h);
  }

  /* ---- respawn ---- */

  private triggerRespawn(): void {
    const cp = this.floorHazard.getCheckpointPos();
    const G = GAME_HEIGHT - 64;
    const target = cp ?? { x: 140, y: G - 80 };

    this.floorHazard.reset();
    this.heartbeatElapsed = 0;
    this.dangerVignette?.setVisible(false);

    if (!isReducedMotion()) {
      this.cameras.main.flash(180, 255, 255, 255, true);
    }
    this.player.setPosition(target.x, target.y);
  }

  /* ---- danger state ---- */

  private updateDangerState(delta: number): void {
    const inDanger = this.floorHazard.isDangerZone()
      && this.progression.getFloorAU(FLOORS.BOSS) <= 1;

    if (this.dangerVignette) {
      this.dangerVignette.setVisible(inDanger && !isReducedMotion());
    }

    if (inDanger) {
      this.heartbeatElapsed += delta;
      if (this.heartbeatElapsed >= BossArenaScene.HEARTBEAT_INTERVAL_MS) {
        this.heartbeatElapsed = 0;
        eventBus.emit('sfx:heartbeat');
      }
    } else {
      this.heartbeatElapsed = 0;
    }
  }
}
