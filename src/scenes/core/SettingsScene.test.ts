import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Phaser stub ─────────────────────────────────────────────────────────────

vi.mock('phaser', () => {
  const delayedCallbacks: Array<() => void> = [];

  class Scene {
    cameras = {
      main: {
        fadeOut: vi.fn(),
        fadeIn: vi.fn(),
      },
    };
    scene = {
      start: vi.fn(),
      stop: vi.fn(),
      setVisible: vi.fn(),
    };
    time = {
      delayedCall: vi.fn((_ms: number, cb: () => void) => {
        delayedCallbacks.push(cb);
      }),
    };
    add = {
      graphics: vi.fn(() => ({
        setDepth: vi.fn().mockReturnThis(),
        fillStyle: vi.fn().mockReturnThis(),
        fillRect: vi.fn().mockReturnThis(),
        fillRoundedRect: vi.fn().mockReturnThis(),
        lineStyle: vi.fn().mockReturnThis(),
        strokeRect: vi.fn().mockReturnThis(),
        strokeRoundedRect: vi.fn().mockReturnThis(),
        fillCircle: vi.fn().mockReturnThis(),
        clear: vi.fn().mockReturnThis(),
      })),
      text: vi.fn(() => ({
        setOrigin: vi.fn().mockReturnThis(),
        setDepth: vi.fn().mockReturnThis(),
        setColor: vi.fn().mockReturnThis(),
        setScale: vi.fn().mockReturnThis(),
        setText: vi.fn().mockReturnThis(),
        on: vi.fn(),
      })),
    };
    registry = {
      get: vi.fn(() => null),
    };
    _delayedCallbacks = delayedCallbacks;
    constructor(_config: unknown) {}
  }
  return { default: { Scene }, Scene };
});

vi.mock('../../config/gameConfig', () => ({
  GAME_WIDTH: 1280,
  GAME_HEIGHT: 720,
}));

vi.mock('../../style/theme', () => ({
  theme: {
    color: {
      bg: { overlay: 0x000000, shaft: 0x111111, mid: 0x222222 },
      ui: { panel: 0x111111, border: 0x333333, accent: 0xffffff, accentAlt: 0xeeeeee },
      css: {
        textAccent: '#ff0',
        textWhite: '#fff',
        textMuted: '#aaa',
        bgPanel: '#222',
        textPrimary: '#ccc',
        textPanel: '#bbb',
      },
    },
  },
  getHighContrastCss: vi.fn((enabled: boolean) => enabled
    ? { textPrimary: '#ffffff', textSecondary: '#ffffff', textAccent: '#ffeb3b', textPanel: '#ffffff', bgPanel: '#000000', bgDialog: '#000000cc' }
    : { textPrimary: '#ccc', textSecondary: '#aaa', textAccent: '#ff0', textPanel: '#bbb', bgPanel: '#222', bgDialog: '#00000088' }
  ),
}));

vi.mock('../../systems/SettingsStore', () => ({
  settingsStore: {
    read: vi.fn(() => ({
      masterVolume: 80,
      musicVolume: 70,
      sfxVolume: 90,
      muteAll: false,
      musicStyle: '8bit-chiptune',
      highContrast: false,
      textScale: 1,
      reducedMotion: false,
      onScreenControls: 'auto',
      hapticsEnabled: true,
      colorBlindMode: 'off',
      hideTutorials: false,
    })),
    setMasterVolume: vi.fn(),
    setMusicVolume: vi.fn(),
    setSfxVolume: vi.fn(),
    setMuteAll: vi.fn(),
    setMusicStyle: vi.fn(),
    setHighContrast: vi.fn(),
    setTextScale: vi.fn(),
    setOnScreenControls: vi.fn(),
    setHapticsEnabled: vi.fn(),
    setColorBlindMode: vi.fn(),
    setHideTutorials: vi.fn(),
    setReducedMotion: vi.fn(),
  },
}));

vi.mock('../../systems/MotionPreference', () => ({
  getReducedMotionOverride: vi.fn(() => null),
  setReducedMotionOverride: vi.fn(),
}));

vi.mock('../../systems/GameStateManager', () => ({
  GameStateManager: class {},
}));

vi.mock('../../systems/sceneLifecycle', () => ({
  createSceneLifecycle: vi.fn(() => ({
    add: vi.fn(),
    bindInput: vi.fn(),
    bindEventBus: vi.fn(),
  })),
}));

vi.mock('../../input', () => ({
  pushContext: vi.fn(() => 0),
  popContext: vi.fn(),
}));

vi.mock('../../systems/sliderUtils', () => ({
  clampSlider: vi.fn((v: number) => v),
}));

vi.mock('../../systems/EventBus', () => ({
  eventBus: { emit: vi.fn(), on: vi.fn(), off: vi.fn() },
}));

import { SettingsScene } from './SettingsScene';
import { eventBus } from '../../systems/EventBus';
import * as SettingsStoreModule from '../../systems/SettingsStore';

// ── Helpers ──────────────────────────────────────────────────────────────────

// Cast to a plain object so private fields are accessible without intersection conflicts.
type MockSettingsScene = Record<string, unknown> & {
  scene: { start: ReturnType<typeof vi.fn>; stop: ReturnType<typeof vi.fn>; setVisible: ReturnType<typeof vi.fn> };
  _delayedCallbacks: Array<() => void>;
};

function makeSettings(from?: string): MockSettingsScene {
  const scene = new SettingsScene() as unknown as MockSettingsScene & {
    init: (d: { from?: string }) => void;
    create: () => void;
  };
  scene.init({ from });
  scene.create();
  return scene;
}

function flushDelayed(scene: MockSettingsScene): void {
  const cbs = scene._delayedCallbacks.splice(0);
  for (const cb of cbs) cb();
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('SettingsScene.goBack()', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('starts callerScene when called from MenuScene (normal flow)', () => {
    const scene = makeSettings('MenuScene');
    (scene as unknown as { goBack: () => void }).goBack();
    flushDelayed(scene);
    expect(scene.scene.start).toHaveBeenCalledWith('MenuScene');
    expect(scene.scene.stop).not.toHaveBeenCalled();
  });

  it('stops SettingsScene and makes PauseScene visible when callerScene is PauseScene', () => {
    const scene = makeSettings('PauseScene');
    (scene as unknown as { goBack: () => void }).goBack();
    flushDelayed(scene);
    expect(scene.scene.stop).toHaveBeenCalled();
    expect(scene.scene.setVisible).toHaveBeenCalledWith(true, 'PauseScene');
    expect(scene.scene.start).not.toHaveBeenCalled();
  });

  it('emits pause:settings-closed before stopping when callerScene is PauseScene', () => {
    const scene = makeSettings('PauseScene');
    (scene as unknown as { goBack: () => void }).goBack();
    flushDelayed(scene);
    const emitCalls = vi.mocked(eventBus.emit).mock.calls;
    const emitIdx = emitCalls.findIndex((c) => c[0] === 'pause:settings-closed');
    expect(emitIdx).toBeGreaterThanOrEqual(0);
    // emit must happen before stop so PauseScene re-activates while
    // SettingsScene's 'modal' context is still on the stack.
    const emitOrder = vi.mocked(eventBus.emit).mock.invocationCallOrder[emitIdx];
    const stopOrder = vi.mocked(scene.scene.stop).mock.invocationCallOrder[0];
    expect(emitOrder).toBeLessThan(stopOrder!);
  });

  it('defaults callerScene to MenuScene when no from is provided', () => {
    const scene = makeSettings();
    expect(scene['callerScene']).toBe('MenuScene');
  });
});

// ── Helper: access private items/activate/adjust ─────────────────────────────

type PrivateScene = {
  items: Array<{
    kind: string;
    label: string;
    get?: () => unknown;
    set?: (v: unknown) => void;
    options?: readonly string[];
  }>;
  selectedIndex: number;
  activate: () => void;
  adjust: (d: number) => void;
};

function findItemIndex(scene: MockSettingsScene, label: string): number {
  const s = scene as unknown as PrivateScene;
  return s.items.findIndex((i) => i.label === label);
}

function activateItem(scene: MockSettingsScene, label: string): void {
  const s = scene as unknown as PrivateScene;
  const idx = findItemIndex(scene, label);
  expect(idx, `item "${label}" not found`).toBeGreaterThanOrEqual(0);
  s.selectedIndex = idx;
  s.activate();
}

// ── Accessibility items ───────────────────────────────────────────────────────

describe('SettingsScene accessibility items', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('buildItems includes a HIGH CONTRAST toggle', () => {
    const scene = makeSettings('MenuScene');
    const idx = findItemIndex(scene, 'HIGH CONTRAST');
    expect(idx).toBeGreaterThanOrEqual(0);
    const item = (scene as unknown as PrivateScene).items[idx];
    expect(item?.kind).toBe('toggle');
  });

  it('HIGH CONTRAST toggle calls setHighContrast(true) when activated while off', () => {
    vi.mocked(SettingsStoreModule.settingsStore.read).mockReturnValue({
      ...vi.mocked(SettingsStoreModule.settingsStore.read)(),
      highContrast: false,
    } as ReturnType<typeof SettingsStoreModule.settingsStore.read>);
    const scene = makeSettings('MenuScene');
    activateItem(scene, 'HIGH CONTRAST');
    expect(vi.mocked(SettingsStoreModule.settingsStore.setHighContrast)).toHaveBeenCalledWith(true);
  });

  it('HIGH CONTRAST toggle calls setHighContrast(false) when activated while on', () => {
    vi.mocked(SettingsStoreModule.settingsStore.read).mockReturnValue({
      ...vi.mocked(SettingsStoreModule.settingsStore.read)(),
      highContrast: true,
    } as ReturnType<typeof SettingsStoreModule.settingsStore.read>);
    const scene = makeSettings('MenuScene');
    activateItem(scene, 'HIGH CONTRAST');
    expect(vi.mocked(SettingsStoreModule.settingsStore.setHighContrast)).toHaveBeenCalledWith(false);
  });

  it('buildItems includes a TEXT SIZE cycle', () => {
    const scene = makeSettings('MenuScene');
    const idx = findItemIndex(scene, 'TEXT SIZE');
    expect(idx).toBeGreaterThanOrEqual(0);
    const item = (scene as unknown as PrivateScene).items[idx];
    expect(item?.kind).toBe('cycle');
  });

  it('TEXT SIZE cycle options are 100%, 115%, 130%, 150%', () => {
    const scene = makeSettings('MenuScene');
    const idx = findItemIndex(scene, 'TEXT SIZE');
    const item = (scene as unknown as PrivateScene).items[idx];
    expect(item?.options).toEqual(['100%', '115%', '130%', '150%']);
  });

  it('TEXT SIZE activate calls setTextScale(1.15) when currently at 100%', () => {
    vi.mocked(SettingsStoreModule.settingsStore.read).mockReturnValue({
      ...vi.mocked(SettingsStoreModule.settingsStore.read)(),
      textScale: 1,
    } as ReturnType<typeof SettingsStoreModule.settingsStore.read>);
    const scene = makeSettings('MenuScene');
    activateItem(scene, 'TEXT SIZE');
    expect(vi.mocked(SettingsStoreModule.settingsStore.setTextScale)).toHaveBeenCalledWith(1.15);
  });

  it('TEXT SIZE activate cycles through all four steps', () => {
    const scene = makeSettings('MenuScene');
    const s = scene as unknown as PrivateScene;
    const idx = findItemIndex(scene, 'TEXT SIZE');
    s.selectedIndex = idx;

    const steps: Array<{ scale: number; expectedCall: number }> = [
      { scale: 1, expectedCall: 1.15 },
      { scale: 1.15, expectedCall: 1.3 },
      { scale: 1.3, expectedCall: 1.5 },
      { scale: 1.5, expectedCall: 1 },
    ];

    for (const { scale, expectedCall } of steps) {
      vi.mocked(SettingsStoreModule.settingsStore.read).mockReturnValue({
        ...vi.mocked(SettingsStoreModule.settingsStore.read)(),
        textScale: scale,
      } as ReturnType<typeof SettingsStoreModule.settingsStore.read>);
      vi.mocked(SettingsStoreModule.settingsStore.setTextScale).mockClear();
      s.activate();
      expect(
        vi.mocked(SettingsStoreModule.settingsStore.setTextScale),
        `activating at scale=${scale}`,
      ).toHaveBeenCalledWith(expectedCall);
    }
  });
});
