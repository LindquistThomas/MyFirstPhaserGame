import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

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
}));

vi.mock('../../systems/SettingsStore', () => ({
  settingsStore: {
    read: vi.fn(() => ({
      masterVolume: 80,
      musicVolume: 70,
      sfxVolume: 90,
      muteAll: false,
      musicStyle: '8bit-chiptune',
    })),
    setMasterVolume: vi.fn(),
    setMusicVolume: vi.fn(),
    setSfxVolume: vi.fn(),
    setMuteAll: vi.fn(),
    setMusicStyle: vi.fn(),
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

vi.mock('../../ui/WelcomeModal', () => ({
  WelcomeModal: vi.fn(),
}));

vi.mock('../../ui/TouchHintOverlay', () => ({
  showTouchHintForcedWithPersist: vi.fn(),
}));

vi.mock('../../systems/TouchHintStore', () => ({
  clearSeen: vi.fn(),
}));

vi.mock('../../ui/ariaLive', () => ({
  announce: vi.fn(),
}));

import { SettingsScene } from './SettingsScene';
import { eventBus } from '../../systems/EventBus';
import { WelcomeModal } from '../../ui/WelcomeModal';
import { showTouchHintForcedWithPersist } from '../../ui/TouchHintOverlay';
import * as TouchHintStore from '../../systems/TouchHintStore';
import { announce } from '../../ui/ariaLive';

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

// ── openHowToPlay ─────────────────────────────────────────────────────────────

describe('SettingsScene.openHowToPlay()', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('sets helpModalOpen, creates WelcomeModal with source "help", and announces', () => {
    const scene = makeSettings();
    (scene as unknown as { openHowToPlay: () => void }).openHowToPlay();

    // helpModalOpen is immediately true while the modal is open.
    expect(scene['helpModalOpen']).toBe(true);

    // WelcomeModal was constructed with source:'help'.
    expect(vi.mocked(WelcomeModal)).toHaveBeenCalledWith(
      expect.anything(),
      expect.any(Function),
      'help',
    );

    // ariaLive announcement is emitted.
    expect(vi.mocked(announce)).toHaveBeenCalledWith('Help opened');
  });

  it('clears helpModalOpen when the WelcomeModal onComplete callback fires', () => {
    const scene = makeSettings();
    (scene as unknown as { openHowToPlay: () => void }).openHowToPlay();
    expect(scene['helpModalOpen']).toBe(true);

    // Simulate modal close by invoking the onComplete callback directly.
    const onComplete = vi.mocked(WelcomeModal).mock.calls[0]?.[1] as () => void;
    onComplete();
    expect(scene['helpModalOpen']).toBe(false);
  });

  it('does NOT schedule a delayedCall guard reset (guard is driven by onComplete now)', () => {
    const scene = makeSettings();
    const delayedCallBefore = (scene as unknown as { time: { delayedCall: ReturnType<typeof vi.fn> } }).time.delayedCall.mock.calls.length;
    (scene as unknown as { openHowToPlay: () => void }).openHowToPlay();
    const delayedCallAfter = (scene as unknown as { time: { delayedCall: ReturnType<typeof vi.fn> } }).time.delayedCall.mock.calls.length;
    // No additional delayedCall should have been scheduled by openHowToPlay().
    expect(delayedCallAfter).toBe(delayedCallBefore);
  });
});

// ── activate / goBack guard ───────────────────────────────────────────────────

describe('SettingsScene.helpModalOpen guard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('activate() is a no-op when helpModalOpen is true', () => {
    const scene = makeSettings();
    (scene as unknown as { helpModalOpen: boolean }).helpModalOpen = true;
    (scene as unknown as { activate: () => void }).activate();
    // WelcomeModal should not be instantiated again.
    expect(vi.mocked(WelcomeModal)).not.toHaveBeenCalled();
  });

  it('goBack() is blocked when helpModalOpen is true', () => {
    const scene = makeSettings('MenuScene');
    (scene as unknown as { helpModalOpen: boolean }).helpModalOpen = true;
    (scene as unknown as { goBack: () => void }).goBack();
    flushDelayed(scene);
    expect(scene.scene.start).not.toHaveBeenCalled();
    expect(scene.scene.stop).not.toHaveBeenCalled();
  });
});

// ── resetTouchHint ────────────────────────────────────────────────────────────

describe('SettingsScene.resetTouchHint()', () => {
  let pad: HTMLDivElement;

  beforeEach(() => {
    vi.clearAllMocks();
    pad = document.createElement('div');
    pad.id = 'virtual-pad';
    document.body.appendChild(pad);
  });

  afterEach(() => {
    pad.remove();
  });

  it('calls TouchHintStore.clearSeen()', () => {
    const scene = makeSettings();
    (scene as unknown as { resetTouchHint: () => void }).resetTouchHint();
    expect(vi.mocked(TouchHintStore.clearSeen)).toHaveBeenCalledTimes(1);
  });

  it('calls showTouchHintForcedWithPersist with the pad element', () => {
    const scene = makeSettings();
    (scene as unknown as { resetTouchHint: () => void }).resetTouchHint();
    expect(vi.mocked(showTouchHintForcedWithPersist)).toHaveBeenCalledWith(pad);
  });

  it('does not call showTouchHintForcedWithPersist when virtual-pad is absent', () => {
    pad.remove();
    const scene = makeSettings();
    (scene as unknown as { resetTouchHint: () => void }).resetTouchHint();
    expect(vi.mocked(showTouchHintForcedWithPersist)).not.toHaveBeenCalled();
  });
});
