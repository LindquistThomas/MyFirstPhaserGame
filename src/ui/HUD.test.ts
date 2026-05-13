import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type * as Phaser from 'phaser';
import { eventBus } from '../systems/EventBus';
import { ProgressionSystem } from '../systems/ProgressionSystem';
import { FLOORS, GAME_WIDTH } from '../config/gameConfig';
import { setPlayerSlot, setStorage, type KVStorage } from '../systems/SaveManager';
import { settingsStore } from '../systems/SettingsStore';

vi.mock('../systems/MotionPreference', () => ({
  isReducedMotion: vi.fn(() => false),
}));

vi.mock('phaser', () => {
  const keyCodes = new Proxy({}, { get: () => 0 });
  class Container {
    constructor(_scene: unknown, _x: number, _y: number) {}
    add(): this { return this; }
    setDepth(): this { return this; }
    setScrollFactor(): this { return this; }
    setVisible(): this { return this; }
  }
  class ScenePlugin {
    constructor(_scene: unknown, _pluginManager: unknown) {}
    boot(): void {}
  }
  const Phaser = {
    GameObjects: { Container },
    Math: {
      Clamp: (value: number, min: number, max: number) => Math.min(max, Math.max(min, value)),
    },
    Input: {
      Keyboard: { KeyCodes: keyCodes },
    },
    Plugins: { ScenePlugin },
  };
  return { ...Phaser, default: Phaser };
});

import { HUD } from './HUD';

type Listener = (...args: unknown[]) => void;

function makeGraphics() {
  const g: Record<string, unknown> = {};
  const chained = [
    'clear',
    'fillStyle',
    'fillCircle',
    'fillRect',
    'fillRoundedRect',
    'strokeRoundedRect',
    'fillGradientStyle',
    'lineStyle',
    'beginPath',
    'moveTo',
    'lineTo',
    'strokePath',
    'fillEllipse',
    'arc',
    'setPosition',
    'setAlpha',
    'setVisible',
    'setX',
    'setScale',
  ];
  for (const name of chained) {
    g[name] = vi.fn().mockReturnThis();
  }
  (g as unknown as { scene: unknown }).scene = {};
  return g as unknown as ReturnType<typeof vi.fn> & {
    clear: ReturnType<typeof vi.fn>;
    setPosition: ReturnType<typeof vi.fn>;
  };
}

function makeText(text: string) {
  const t: Record<string, unknown> = {
    text,
    x: 0,
    y: 0,
  };
  t.setOrigin = vi.fn().mockReturnValue(t);
  t.setText = vi.fn((s: string) => {
    (t as { text: string }).text = s;
    return t;
  });
  t.setScrollFactor = vi.fn().mockReturnValue(t);
  t.setDepth = vi.fn().mockReturnValue(t);
  t.setY = vi.fn((y: number) => {
    (t as { y: number }).y = y;
    return t;
  });
  t.setAlpha = vi.fn().mockReturnValue(t);
  t.setColor = vi.fn().mockReturnValue(t);
  t.setVisible = vi.fn().mockReturnValue(t);
  t.setStyle = vi.fn().mockReturnValue(t);
  t.destroy = vi.fn();
  return t as unknown as {
    text: string;
    x: number;
    y: number;
    setOrigin: ReturnType<typeof vi.fn>;
    setText: ReturnType<typeof vi.fn>;
    setScrollFactor: ReturnType<typeof vi.fn>;
    setDepth: ReturnType<typeof vi.fn>;
    setY: ReturnType<typeof vi.fn>;
    setAlpha: ReturnType<typeof vi.fn>;
    setColor: ReturnType<typeof vi.fn>;
    setVisible: ReturnType<typeof vi.fn>;
    setStyle: ReturnType<typeof vi.fn>;
    destroy: ReturnType<typeof vi.fn>;
  };
}

function memoryStorage(): KVStorage {
  const store = new Map<string, string>();
  return {
    getItem: (key) => (store.has(key) ? store.get(key)! : null),
    setItem: (key, value) => { store.set(key, value); },
    removeItem: (key) => { store.delete(key); },
  };
}

function makeScene(muted = false) {
  const onceHandlers: Record<string, Listener[]> = {};
  const zoneHandlers = new Map<string, Listener>();
  const texts: Array<ReturnType<typeof makeText>> = [];
  const graphics: Array<ReturnType<typeof makeGraphics>> = [];
  const zones: Array<{ on: ReturnType<typeof vi.fn> }> = [];

  const scene = {
    add: {
      container: vi.fn(() => ({
        add: vi.fn(),
        setDepth: vi.fn().mockReturnThis(),
        setScrollFactor: vi.fn().mockReturnThis(),
        setAlpha: vi.fn().mockReturnThis(),
        setVisible: vi.fn().mockReturnThis(),
        alpha: 1,
      })),
      graphics: vi.fn(() => {
        const g = makeGraphics();
        graphics.push(g);
        return g;
      }),
      text: vi.fn((_x: number, _y: number, text: string) => {
        const t = makeText(text);
        texts.push(t);
        return t;
      }),
      existing: vi.fn(),
      zone: vi.fn(() => {
        const z = {
          setInteractive: vi.fn().mockReturnThis(),
          on: vi.fn((event: string, handler: Listener) => {
            zoneHandlers.set(event, handler);
            return z;
          }),
        };
        zones.push(z);
        return z;
      }),
    },
    tweens: {
      add: vi.fn((config: Record<string, unknown>) => ({
        stop: vi.fn(),
        targets: config.targets,
        onComplete: config.onComplete as (() => void) | undefined,
      })),
    },
    time: {
      delayedCall: vi.fn(),
      addEvent: vi.fn(),
    },
    registry: {
      get: vi.fn((key: string) => (key === 'audio' ? { isMuted: () => muted } : undefined)),
    },
    events: {
      once: vi.fn((event: string, handler: Listener) => {
        (onceHandlers[event] ??= []).push(handler);
      }),
      emit: (event: string) => {
        const handlers = onceHandlers[event] ?? [];
        onceHandlers[event] = [];
        handlers.forEach((fn) => fn());
      },
    },
    /** Mock Phaser ScaleManager — displaySize.width defaults to GAME_WIDTH so tests use 'wide' tokens. */
    scale: {
      displaySize: { width: GAME_WIDTH },
      on: vi.fn(),
      off: vi.fn(),
    },
    zoneHandlers,
    texts,
    graphics,
    zones,
  };

  return scene;
}

describe('HUD', () => {
  let progression: ProgressionSystem;
  let scene: ReturnType<typeof makeScene> | undefined;
  let toggleSpy: ReturnType<typeof vi.fn<() => void>> | undefined;

  beforeEach(() => {
    setPlayerSlot('hud-test');
    setStorage(memoryStorage());
    progression = new ProgressionSystem();
    progression.reset();
    scene = undefined;
    toggleSpy = undefined;
  });

  afterEach(() => {
    scene?.events.emit('shutdown');
    if (toggleSpy) eventBus.off('audio:toggle-mute', toggleSpy);
  });

  it('updates AU/floor labels and animates coin when AU increases', () => {
    scene = makeScene(false);
    const hud = new HUD(scene as unknown as Phaser.Scene, progression);

    progression.addAU(FLOORS.LOBBY, 2);
    hud.update();

    const auTextCall = scene.add.text.mock.calls.findIndex(
      ([x, y, initialText]) => x === 46 && y === 6 && initialText === 'AU: 0',
    );
    const floorTextCall = scene.add.text.mock.calls.findIndex(
      ([x, y, initialText]) => x === GAME_WIDTH - 48 && y === 10 && initialText === '',
    );
    expect(auTextCall).toBeGreaterThan(-1);
    expect(floorTextCall).toBeGreaterThan(-1);
    const auText = scene.add.text.mock.results[auTextCall]?.value as ReturnType<typeof makeText>;
    const floorText = scene.add.text.mock.results[floorTextCall]?.value as ReturnType<typeof makeText>;

    expect(auText.setText).toHaveBeenCalledWith('AU: 2');
    expect(floorText.setText).toHaveBeenCalledWith(expect.stringContaining('F0:'));
    // update() triggers a tween for the coin-punch, a tween for the +N flyer,
    // and a progress-strip fill tween. Exact count is not asserted to allow
    // future tween additions to coexist without breaking the test.
    expect(scene.tweens.add).toHaveBeenCalled();
  });

  it('does not add new progress tweens when AU and floor are unchanged between updates', () => {
    scene = makeScene(false);
    const hud = new HUD(scene as unknown as Phaser.Scene, progression);

    // create() now triggers an initial render (including a progress tween), so
    // tweens should already exist after construction.
    const tweensAfterInit = (scene.tweens.add as ReturnType<typeof vi.fn>).mock.calls.length;
    expect(tweensAfterInit).toBeGreaterThan(0);

    // Subsequent update() calls with no state change must not queue more tweens.
    hud.update();
    hud.update();
    hud.update();
    expect((scene.tweens.add as ReturnType<typeof vi.fn>).mock.calls.length).toBe(tweensAfterInit);
  });

  it('shows a toast when progression:au_milestone fires and unsubscribes on shutdown', () => {
    scene = makeScene(false);
    const hud = new HUD(scene as unknown as Phaser.Scene, progression);
    const toast = (hud as unknown as { toast: { show: (msg: string) => void } }).toast;
    const showSpy = vi.spyOn(toast, 'show').mockImplementation(() => {});

    eventBus.emit('progression:au_milestone', 15);
    expect(showSpy).toHaveBeenCalledWith('\u2B50 15 AU collected!');

    // After shutdown the lifecycle handler must be disconnected.
    scene.events.emit('shutdown');
    showSpy.mockClear();
    eventBus.emit('progression:au_milestone', 30);
    expect(showSpy).not.toHaveBeenCalled();
  });

  it('emits toggle event on mute click and unsubscribes from mute-changed on shutdown', () => {
    scene = makeScene(false);
    new HUD(scene as unknown as Phaser.Scene, progression);

    toggleSpy = vi.fn<() => void>();
    eventBus.on('audio:toggle-mute', toggleSpy);

    scene.zoneHandlers.get('pointerup')?.();
    expect(toggleSpy).toHaveBeenCalledTimes(1);

    const muteGraphics = scene.graphics.find((g) =>
      g.setPosition.mock.calls.some(([x, y]) => x === GAME_WIDTH - 24 && y === 22),
    );
    expect(muteGraphics).toBeDefined();
    if (!muteGraphics) throw new Error('muteGraphics not found');
    const clearCountBefore = muteGraphics.clear.mock.calls.length;
    eventBus.emit('audio:mute-changed', true);
    expect(muteGraphics.clear.mock.calls.length).toBeGreaterThan(clearCountBefore);

    const clearCountAfterBind = muteGraphics.clear.mock.calls.length;
    scene.events.emit('shutdown');
    eventBus.emit('audio:mute-changed', false);
    expect(muteGraphics.clear.mock.calls.length).toBe(clearCountAfterBind);
  });

  it('relayouts with compact tokens when resize crosses into compact size class', () => {
    scene = makeScene(false);
    // Start at wide (GAME_WIDTH = 1280)
    new HUD(scene as unknown as Phaser.Scene, progression);

    // Capture the resize handler registered on scene.scale
    const resizeCall = (scene.scale.on as ReturnType<typeof vi.fn>).mock.calls.find(
      (args: unknown[]) => args[0] === 'resize',
    ) as [string, () => void] | undefined;
    expect(resizeCall).toBeDefined();
    const onResize = resizeCall![1];

    // Simulate crossing into the compact size class (< 700 px)
    scene.scale.displaySize.width = 375;
    onResize();

    // auText should have been restyled with the compact font
    const auTextCall = scene.add.text.mock.calls.findIndex(
      (args: unknown[]) => args[0] === 46 && args[1] === 6 && args[2] === 'AU: 0',
    );
    const auText = scene.add.text.mock.results[auTextCall]?.value as ReturnType<typeof makeText>;
    expect(auText.setStyle).toHaveBeenCalledWith(expect.objectContaining({ fontSize: '28px' }));

    // Centre title should be hidden on compact
    const titleText = scene.texts.find((t) => t.text === 'SO YOU WANT TO BE AN ARCHITECT');
    expect(titleText?.setVisible).toHaveBeenCalledWith(false);
  });

  it('does not relayout when resize stays within the same size class', () => {
    scene = makeScene(false);
    new HUD(scene as unknown as Phaser.Scene, progression);

    const resizeCall = (scene.scale.on as ReturnType<typeof vi.fn>).mock.calls.find(
      (args: unknown[]) => args[0] === 'resize',
    ) as [string, () => void] | undefined;
    const onResize = resizeCall![1];

    // Resize stays within 'wide' class — no relayout expected
    scene.scale.displaySize.width = 1100;
    onResize();

    const auTextCall = scene.add.text.mock.calls.findIndex(
      (args: unknown[]) => args[0] === 46 && args[1] === 6 && args[2] === 'AU: 0',
    );
    const auText = scene.add.text.mock.results[auTextCall]?.value as ReturnType<typeof makeText>;
    expect(auText.setStyle).not.toHaveBeenCalled();
  });

  it('unsubscribes resize handler from scene.scale on shutdown', () => {
    scene = makeScene(false);
    new HUD(scene as unknown as Phaser.Scene, progression);

    expect((scene.scale.off as ReturnType<typeof vi.fn>).mock.calls.length).toBe(0);

    scene.events.emit('shutdown');

    expect(scene.scale.off).toHaveBeenCalledWith('resize', expect.any(Function), expect.anything());
  });

  it('suppresses the persistence:unavailable toast when registry flag is false', () => {
    scene = makeScene(false);
    // Override registry to return persistenceAvailable=false.
    (scene.registry.get as ReturnType<typeof vi.fn>).mockImplementation((key: string) => {
      if (key === 'audio') return { isMuted: () => false };
      if (key === 'persistenceAvailable') return false;
      return undefined;
    });
    const hud = new HUD(scene as unknown as Phaser.Scene, progression);
    const toast = (hud as unknown as { toast: { show: (msg: string) => void } }).toast;
    const showSpy = vi.spyOn(toast, 'show').mockImplementation(() => {});

    // All reason codes are suppressed when boot probe flagged storage unavailable.
    eventBus.emit('persistence:failed', { reason: 'unavailable' });
    eventBus.emit('persistence:failed', { reason: 'quota' });
    eventBus.emit('persistence:failed', { reason: 'unknown' });
    expect(showSpy).not.toHaveBeenCalled();
  });

  it('still shows persistence:failed toasts when registry flag is true', () => {
    scene = makeScene(false);
    (scene.registry.get as ReturnType<typeof vi.fn>).mockImplementation((key: string) => {
      if (key === 'audio') return { isMuted: () => false };
      if (key === 'persistenceAvailable') return true;
      return undefined;
    });
    const hud = new HUD(scene as unknown as Phaser.Scene, progression);
    const toast = (hud as unknown as { toast: { show: (msg: string) => void } }).toast;
    const showSpy = vi.spyOn(toast, 'show').mockImplementation(() => {});

    eventBus.emit('persistence:failed', { reason: 'unavailable' });
    expect(showSpy).toHaveBeenCalledWith(
      expect.stringContaining('Browser storage is unavailable'),
    );
  });

  it('shows quota toast when persistenceAvailable is true', () => {
    scene = makeScene(false);
    (scene.registry.get as ReturnType<typeof vi.fn>).mockImplementation((key: string) => {
      if (key === 'audio') return { isMuted: () => false };
      if (key === 'persistenceAvailable') return true;
      return undefined;
    });
    const hud = new HUD(scene as unknown as Phaser.Scene, progression);
    const toast = (hud as unknown as { toast: { show: (msg: string) => void } }).toast;
    const showSpy = vi.spyOn(toast, 'show').mockImplementation(() => {});

    eventBus.emit('persistence:failed', { reason: 'quota' });
    expect(showSpy).toHaveBeenCalledWith(expect.stringContaining('Storage full'));
  });

  it('destroys subcontrollers and toast on shutdown', () => {
    scene = makeScene(false);
    const hud = new HUD(scene as unknown as Phaser.Scene, progression) as unknown as {
      coinCtrl: { destroy: () => void };
      progressCtrl: { destroy: () => void };
      muteCtrl: { destroy: () => void };
      caffeineCtrl: { destroy: () => void };
      achievementCtrl: { destroy: () => void };
      toast: { destroy: () => void };
    };

    const coinDestroy = vi.spyOn(hud.coinCtrl, 'destroy');
    const progressDestroy = vi.spyOn(hud.progressCtrl, 'destroy');
    const muteDestroy = vi.spyOn(hud.muteCtrl, 'destroy');
    const caffeineDestroy = vi.spyOn(hud.caffeineCtrl, 'destroy');
    const achievementDestroy = vi.spyOn(hud.achievementCtrl, 'destroy');
    const toastDestroy = vi.spyOn(hud.toast, 'destroy');

    scene.events.emit('shutdown');

    expect(coinDestroy).toHaveBeenCalled();
    expect(progressDestroy).toHaveBeenCalled();
    expect(muteDestroy).toHaveBeenCalled();
    expect(caffeineDestroy).toHaveBeenCalled();
    expect(achievementDestroy).toHaveBeenCalled();
    expect(toastDestroy).toHaveBeenCalled();
  });
});

// ── HUD timer widget ────────────────────────────────────────────────────────

describe('HUD — playtime timer widget', () => {
  let progression: ProgressionSystem;
  let scene: ReturnType<typeof makeScene> | undefined;

  beforeEach(() => {
    setPlayerSlot('hud-timer-test');
    setStorage(memoryStorage());
    settingsStore.setShowRunTimer(true);
    progression = new ProgressionSystem();
    progression.reset();
    scene = undefined;
  });

  afterEach(() => {
    scene?.events.emit('shutdown');
  });

  function makeTracker(runMs = 0) {
    return {
      getRunElapsedMs: vi.fn(() => runMs),
    };
  }

  it('creates a timer text element when playtime tracker is provided', () => {
    scene = makeScene(false);
    const tracker = makeTracker(0);
    new HUD(scene as unknown as Phaser.Scene, progression, tracker as never);
    // Timer text is created in top-right with initial text '0:00'
    const timerCall = scene.add.text.mock.calls.find(
      ([x, y, text]: [number, number, string]) => x === GAME_WIDTH - 10 && y === 32 && text === '0:00',
    );
    expect(timerCall).toBeDefined();
    // The timer text should be visible (not hidden) when a tracker is provided on wide viewport.
    const timerText = scene.texts.find((t) => t.text === '0:00');
    expect(timerText).toBeDefined();
    if (!timerText) throw new Error('timer text not found');
    // setVisible(true) or setVisible was not called with false on wide viewport.
    const setVisibleCalls = (timerText.setVisible as ReturnType<typeof vi.fn>).mock.calls;
    const lastCall = setVisibleCalls[setVisibleCalls.length - 1];
    expect(lastCall?.[0]).not.toBe(false);
  });

  it('updates timer text on each update() call when tracker is provided', () => {
    scene = makeScene(false);
    const tracker = makeTracker(90_000); // 1 min 30 sec
    const hud = new HUD(scene as unknown as Phaser.Scene, progression, tracker as never);

    hud.update();

    // After update, the timer text has been updated from '0:00' to '1:30'.
    // Find by checking texts that had setText called with '1:30'.
    const timerText = scene.texts.find((t) =>
      (t.setText as ReturnType<typeof vi.fn>).mock.calls.some(([s]) => s === '1:30'),
    );
    expect(timerText).toBeDefined();
  });

  it('timer text is created but hidden when no tracker is provided', () => {
    scene = makeScene(false);
    new HUD(scene as unknown as Phaser.Scene, progression);
    // Timer text is still created (always), just hidden.
    const timerText = scene.texts.find((t) => t.text === '0:00');
    expect(timerText).toBeDefined();
    if (!timerText) throw new Error('timer text not found');
    expect(timerText.setVisible).toHaveBeenCalledWith(false);
  });

  it('hides timer text when SHOW RUN TIMER setting is disabled', () => {
    scene = makeScene(false);
    settingsStore.setShowRunTimer(false);
    const tracker = makeTracker(0);
    new HUD(scene as unknown as Phaser.Scene, progression, tracker as never);

    const timerText = scene.texts.find((t) => t.text === '0:00');
    expect(timerText).toBeDefined();
    if (!timerText) throw new Error('timer text not found');
    expect(timerText.setVisible).toHaveBeenCalledWith(false);
  });
});
