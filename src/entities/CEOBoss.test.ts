import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createFakeScene } from '../../tests/helpers/phaserMock';
import type * as Phaser from 'phaser';
import { eventBus } from '../systems/EventBus';

function makeFakeBody() {
  const body: {
    velocity: { x: number; y: number };
    enable: boolean;
    blocked: { down: boolean };
    setCollideWorldBounds: ReturnType<typeof vi.fn>;
    setSize: ReturnType<typeof vi.fn>;
    setOffset: ReturnType<typeof vi.fn>;
    setVelocity: ReturnType<typeof vi.fn>;
    setVelocityX: ReturnType<typeof vi.fn>;
    setVelocityY: ReturnType<typeof vi.fn>;
  } = {
    velocity: { x: 0, y: 0 },
    enable: true,
    blocked: { down: false },
    setCollideWorldBounds: vi.fn(() => body),
    setSize: vi.fn(() => body),
    setOffset: vi.fn(() => body),
    setVelocity: vi.fn((x: number, y: number) => { body.velocity.x = x; body.velocity.y = y; return body; }),
    setVelocityX: vi.fn((v: number) => { body.velocity.x = v; return body; }),
    setVelocityY: vi.fn((v: number) => { body.velocity.y = v; return body; }),
  };
  return body;
}

vi.mock('phaser', () => {
  class Sprite {
    scene: unknown;
    x: number;
    y: number;
    body = makeFakeBody();
    private _listeners: Map<string, ((...args: unknown[]) => void)[]> = new Map();

    constructor(scene: unknown, x: number, y: number) {
      this.scene = scene;
      this.x = x;
      this.y = y;
    }

    setDepth() { return this; }
    setFlipX() { return this; }
    setTint() { return this; }
    setTexture() { return this; }
    setAngle() { return this; }
    destroy() { /* no-op */ }

    emit(event: string, ...args: unknown[]): void {
      const handlers = this._listeners.get(event) ?? [];
      handlers.forEach((fn) => fn(...args));
    }
    on(event: string, fn: (...args: unknown[]) => void): this {
      const list = this._listeners.get(event) ?? [];
      list.push(fn);
      this._listeners.set(event, list);
      return this;
    }
    once(event: string, fn: (...args: unknown[]) => void): this {
      return this.on(event, fn);
    }
    off(event: string, fn: (...args: unknown[]) => void): this {
      const list = (this._listeners.get(event) ?? []).filter((f) => f !== fn);
      this._listeners.set(event, list);
      return this;
    }
  }

  const Phaser = { Physics: { Arcade: { Sprite } } };
  return { ...Phaser, default: Phaser };
});

import { CEOBoss } from './CEOBoss';

describe('CEOBoss', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('initialises with MAX_HP, phase 1, and correct body dimensions', () => {
    const scene = createFakeScene();
    const boss = new CEOBoss(scene as unknown as Phaser.Scene, 640, 500, 200, 1000);
    const body = boss.body as unknown as ReturnType<typeof makeFakeBody>;

    expect(boss.currentHp).toBe(CEOBoss.MAX_HP);
    expect(boss.phase).toBe(1);
    expect(boss.defeated).toBe(false);
    expect(body.setSize).toHaveBeenCalledWith(44, 58);
    expect(body.setOffset).toHaveBeenCalledWith(2, 6);
  });

  it('takeDamage() reduces HP and emits sfx:boss_hit', () => {
    const scene = createFakeScene();
    const boss = new CEOBoss(scene as unknown as Phaser.Scene, 640, 500, 200, 1000);
    const hitSpy = vi.fn();
    eventBus.on('sfx:boss_hit', hitSpy);

    const result = boss.takeDamage();

    expect(result).toBe(true);
    expect(boss.currentHp).toBe(9);
    expect(hitSpy).toHaveBeenCalledTimes(1);

    eventBus.off('sfx:boss_hit', hitSpy);
  });

  it('takeDamage() respects i-frame cooldown', () => {
    const scene = createFakeScene();
    const boss = new CEOBoss(scene as unknown as Phaser.Scene, 640, 500, 200, 1000);

    boss.takeDamage(); // triggers i-frame
    const result = boss.takeDamage(); // should be blocked

    expect(result).toBe(false);
    expect(boss.currentHp).toBe(9); // only one hit
  });

  it('knowledge gate prevents HP from dropping to 0 without a correct answer', () => {
    const scene = createFakeScene();
    const boss = new CEOBoss(scene as unknown as Phaser.Scene, 640, 500, 200, 1000);

    // Drain to HP = 1 by bypassing i-frames
    for (let i = 0; i < 9; i++) {
      (boss as unknown as { iFrameTimer: number }).iFrameTimer = 0;
      boss.takeDamage();
    }
    expect(boss.currentHp).toBe(1);

    // Next hit is blocked by knowledge gate
    (boss as unknown as { iFrameTimer: number }).iFrameTimer = 0;
    const result = boss.takeDamage();
    expect(result).toBe(false);
    expect(boss.currentHp).toBe(1);
  });

  it('takeDamage(true) bypasses knowledge gate', () => {
    const scene = createFakeScene();
    const boss = new CEOBoss(scene as unknown as Phaser.Scene, 640, 500, 200, 1000);

    for (let i = 0; i < 9; i++) {
      (boss as unknown as { iFrameTimer: number }).iFrameTimer = 0;
      boss.takeDamage();
    }
    expect(boss.currentHp).toBe(1);

    (boss as unknown as { iFrameTimer: number }).iFrameTimer = 0;
    const result = boss.takeDamage(true);
    expect(result).toBe(true);
    expect(boss.currentHp).toBe(0);
    expect(boss.defeated).toBe(true);
  });

  it('transitions from phase 1 → 2 at HP ≤ 7', () => {
    const scene = createFakeScene();
    const boss = new CEOBoss(scene as unknown as Phaser.Scene, 640, 500, 200, 1000);
    const phaseSpy = vi.fn();
    eventBus.on('sfx:boss_phase', phaseSpy);

    // Drain 3 HP with no knowledge gate issue (HP goes 10 → 7)
    for (let i = 0; i < 3; i++) {
      (boss as unknown as { iFrameTimer: number }).iFrameTimer = 0;
      boss.takeDamage(true);
    }

    expect(boss.phase).toBe(2);
    expect(phaseSpy).toHaveBeenCalledTimes(1);

    eventBus.off('sfx:boss_phase', phaseSpy);
  });

  it('transitions from phase 2 → 3 at HP ≤ 3', () => {
    const scene = createFakeScene();
    const boss = new CEOBoss(scene as unknown as Phaser.Scene, 640, 500, 200, 1000);

    for (let i = 0; i < 7; i++) {
      (boss as unknown as { iFrameTimer: number }).iFrameTimer = 0;
      boss.takeDamage(true);
    }

    expect(boss.phase).toBe(3);
  });

  it('onCorrectAnswer() grants a correct-prompt credit and deals damage', () => {
    const scene = createFakeScene();
    const boss = new CEOBoss(scene as unknown as Phaser.Scene, 640, 500, 200, 1000);

    boss.onCorrectAnswer();

    expect(boss.phasePromptsAnsweredCorrectly).toBe(1);
    expect(boss.currentHp).toBe(9);
  });

  it('onWrongAnswer() heals the boss and resets chargeTimer', () => {
    const scene = createFakeScene();
    const boss = new CEOBoss(scene as unknown as Phaser.Scene, 640, 500, 200, 1000);

    // Drain to HP=8
    (boss as unknown as { iFrameTimer: number }).iFrameTimer = 0;
    boss.takeDamage(true);
    expect(boss.currentHp).toBe(9);

    // Drain one more
    (boss as unknown as { iFrameTimer: number }).iFrameTimer = 0;
    boss.takeDamage(true);
    expect(boss.currentHp).toBe(8);

    // Advance chargeTimer so it's non-zero before the wrong answer
    (boss as unknown as { chargeTimer: number }).chargeTimer = 4000;

    boss.onWrongAnswer();
    expect(boss.currentHp).toBe(9); // healed 1, capped at phase 1 max (10)
    expect((boss as unknown as { chargeTimer: number }).chargeTimer).toBe(0);
  });

  it('update() does nothing when defeated', () => {
    const scene = createFakeScene();
    const boss = new CEOBoss(scene as unknown as Phaser.Scene, 640, 500, 200, 1000);
    boss.defeated = true;

    expect(() => boss.update(16, 400, 400)).not.toThrow();
  });

  it('update() reverses patrol direction at minX and maxX', () => {
    const scene = createFakeScene();
    const boss = new CEOBoss(scene as unknown as Phaser.Scene, 600, 500, 200, 1000);
    const body = boss.body as unknown as ReturnType<typeof makeFakeBody>;

    boss.x = 200;
    body.velocity.x = -80;
    // Suppress charge by setting timer high
    (boss as unknown as { chargeTimer: number }).chargeTimer = 10000;
    boss.update(16, 640, 500);
    expect(body.velocity.x).toBeGreaterThan(0);

    boss.x = 1000;
    body.velocity.x = 80;
    (boss as unknown as { chargeTimer: number }).chargeTimer = 10000;
    boss.update(16, 640, 500);
    expect(body.velocity.x).toBeLessThan(0);
  });

  it('triggerDefeat() sets defeated, disables body, and emits defeatDialogue after tween', () => {
    const scene = createFakeScene();
    const boss = new CEOBoss(scene as unknown as Phaser.Scene, 640, 500, 200, 1000);
    const dialogueSpy = vi.fn();
    boss.on('defeatDialogue', dialogueSpy);

    boss.triggerDefeat();

    expect(boss.defeated).toBe(true);
    expect((boss.body as unknown as ReturnType<typeof makeFakeBody>).enable).toBe(false);
    // Simulate the stagger tween completing
    const tweenCalls = (scene.tweens.add as ReturnType<typeof vi.fn>).mock.calls;
    const staggerTween = tweenCalls[tweenCalls.length - 1]?.[0] as Record<string, unknown>;
    if (typeof staggerTween.onComplete === 'function') {
      (staggerTween.onComplete as () => void)();
    }
    expect(dialogueSpy).toHaveBeenCalledTimes(1);
  });

  it('triggerDefeat() is idempotent', () => {
    const scene = createFakeScene();
    const boss = new CEOBoss(scene as unknown as Phaser.Scene, 640, 500, 200, 1000);

    boss.triggerDefeat();
    boss.triggerDefeat();

    expect(scene.tweens.add).toHaveBeenCalledTimes(1);
  });

  it('fadeOut() emits boss:defeated and destroys', () => {
    const scene = createFakeScene();
    const boss = new CEOBoss(scene as unknown as Phaser.Scene, 640, 500, 200, 1000);
    const defeatedSpy = vi.fn();
    eventBus.on('boss:defeated', defeatedSpy);

    boss.fadeOut();

    // Simulate the fade tween completing
    const tweenCalls = (scene.tweens.add as ReturnType<typeof vi.fn>).mock.calls;
    const fadeTween = tweenCalls[tweenCalls.length - 1]?.[0] as Record<string, unknown>;
    if (typeof fadeTween.onComplete === 'function') {
      (fadeTween.onComplete as () => void)();
    }

    expect(defeatedSpy).toHaveBeenCalledTimes(1);

    eventBus.off('boss:defeated', defeatedSpy);
  });

  it('update() emits throwBriefcase event in phase 2 when timer expires', () => {
    const scene = createFakeScene();
    const boss = new CEOBoss(scene as unknown as Phaser.Scene, 640, 500, 200, 1000);
    const briefcaseSpy = vi.fn();
    boss.on('throwBriefcase', briefcaseSpy);

    // Push to phase 2
    for (let i = 0; i < 3; i++) {
      (boss as unknown as { iFrameTimer: number }).iFrameTimer = 0;
      boss.takeDamage(true);
    }
    expect(boss.phase).toBe(2);

    // Force briefcase timer to expired and charge timer to high (no charge)
    (boss as unknown as { briefcaseTimer: number }).briefcaseTimer = -1;
    (boss as unknown as { chargeTimer: number }).chargeTimer = 10000;

    boss.update(16, 640, 500);

    expect(briefcaseSpy).toHaveBeenCalled();
  });
});
