import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Phaser stub ─────────────────────────────────────────────────────────────

vi.mock('phaser', () => {
  class Scene {
    scene = {
      launch: vi.fn(),
      bringToTop: vi.fn(),
      setVisible: vi.fn(),
      pause: vi.fn(),
      resume: vi.fn(),
      stop: vi.fn(),
      start: vi.fn(),
    };
    registry = {
      get: vi.fn(() => null),
    };
    add = {
      rectangle: vi.fn(() => ({
        setScrollFactor: vi.fn().mockReturnThis(),
        setDepth: vi.fn().mockReturnThis(),
        setInteractive: vi.fn().mockReturnThis(),
      })),
      container: vi.fn(() => ({
        setDepth: vi.fn().mockReturnThis(),
        setScrollFactor: vi.fn().mockReturnThis(),
        setAlpha: vi.fn().mockReturnThis(),
        add: vi.fn(),
      })),
      graphics: vi.fn(() => ({
        fillStyle: vi.fn().mockReturnThis(),
        fillRoundedRect: vi.fn().mockReturnThis(),
        lineStyle: vi.fn().mockReturnThis(),
        strokeRoundedRect: vi.fn().mockReturnThis(),
        lineBetween: vi.fn().mockReturnThis(),
      })),
      text: vi.fn(() => ({
        setOrigin: vi.fn().mockReturnThis(),
        setInteractive: vi.fn().mockReturnThis(),
        setColor: vi.fn().mockReturnThis(),
        setScale: vi.fn().mockReturnThis(),
        on: vi.fn(),
      })),
    };
    tweens = { add: vi.fn() };
    constructor(_config: unknown) {}
  }
  return { default: { Scene }, Scene };
});

vi.mock('../../config/gameConfig', () => ({
  GAME_WIDTH: 1280,
  GAME_HEIGHT: 720,
}));

vi.mock('../../config/levelData', () => ({
  LEVEL_DATA: {},
}));

vi.mock('../../systems/GameStateManager', () => ({
  GameStateManager: class {},
}));

vi.mock('../../ui/HUD', () => ({
  formatPlaytime: (ms: number) => {
    const s = Math.floor(ms / 1000);
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  },
}));

vi.mock('../../systems/EventBus', () => ({
  eventBus: { emit: vi.fn(), on: vi.fn(), off: vi.fn() },
}));

vi.mock('../../style/theme', () => ({
  theme: {
    color: {
      bg: { dark: 0x000000 },
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

vi.mock('../../systems/sceneLifecycle', () => ({
  createSceneLifecycle: vi.fn(() => ({
    add: vi.fn(),
    bindInput: vi.fn(),
    bindEventBus: vi.fn(),
    dispose: vi.fn(),
  })),
}));

vi.mock('../../input', () => ({
  pushContext: vi.fn(() => 0),
  popContext: vi.fn(),
}));

import { PauseScene } from './PauseScene';
import { eventBus } from '../../systems/EventBus';
import { createSceneLifecycle } from '../../systems/sceneLifecycle';

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeScene(): PauseScene {
  const scene = new PauseScene() as unknown as PauseScene;
  // Call init to set parentKey.
  (scene as unknown as { init: (d: { parentKey: string }) => void }).init({ parentKey: 'PlatformTeamScene' });
  // Call create to build panel and register menu items.
  (scene as unknown as { create: () => void }).create();
  return scene;
}

// add.text call order in buildPanel: [0]=title, [1]=Resume btn, [2]=Settings btn, [3]=Quit btn, [4]=hint
type AddTextCall = [number, number, string, unknown];

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('PauseScene', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('menu layout', () => {
    it('has exactly three menu items', () => {
      const scene = makeScene();
      const menuItems = (scene as unknown as { menuItems: unknown[] }).menuItems;
      expect(menuItems).toHaveLength(3);
    });

    it('first item is Resume', () => {
      const scene = makeScene();
      const addTextCalls = (scene.add.text as ReturnType<typeof vi.fn>).mock.calls as AddTextCall[];
      const labels = addTextCalls.map(([, , label]) => label);
      expect(labels[1]).toMatch(/Resume/i);
    });

    it('second item is Settings', () => {
      const scene = makeScene();
      const addTextCalls = (scene.add.text as ReturnType<typeof vi.fn>).mock.calls as AddTextCall[];
      const labels = addTextCalls.map(([, , label]) => label);
      expect(labels[2]).toMatch(/Settings/i);
    });

    it('third item is Quit to Menu', () => {
      const scene = makeScene();
      const addTextCalls = (scene.add.text as ReturnType<typeof vi.fn>).mock.calls as AddTextCall[];
      const labels = addTextCalls.map(([, , label]) => label);
      expect(labels[3]).toMatch(/Quit/i);
    });
  });

  describe('openSettings()', () => {
    it('launches SettingsScene with from=PauseScene', () => {
      const scene = makeScene();
      (scene as unknown as { openSettings: () => void }).openSettings.call(scene);
      expect(scene.scene.launch).toHaveBeenCalledWith('SettingsScene', { from: 'PauseScene' });
    });

    it('brings SettingsScene to top', () => {
      const scene = makeScene();
      (scene as unknown as { openSettings: () => void }).openSettings.call(scene);
      expect(scene.scene.bringToTop).toHaveBeenCalledWith('SettingsScene');
    });

    it('hides PauseScene without stopping it', () => {
      const scene = makeScene();
      (scene as unknown as { openSettings: () => void }).openSettings.call(scene);
      expect(scene.scene.setVisible).toHaveBeenCalledWith(false);
      expect(scene.scene.stop).not.toHaveBeenCalled();
    });

    it('disposes the input lifecycle before launching Settings', () => {
      const scene = makeScene();
      // The lifecycle created by setupKeyboard() is stored in this.lc
      const lc = (scene as unknown as { lc: { dispose: ReturnType<typeof vi.fn> } }).lc;
      (scene as unknown as { openSettings: () => void }).openSettings.call(scene);
      expect(lc.dispose).toHaveBeenCalled();
    });

    it('registers a pause:settings-closed listener to re-activate input', () => {
      const scene = makeScene();
      const callsBefore = vi.mocked(createSceneLifecycle).mock.calls.length;
      (scene as unknown as { openSettings: () => void }).openSettings.call(scene);
      // A new lifecycle must have been created for the settings-return listener
      const results = vi.mocked(createSceneLifecycle).mock.results;
      const resumeLc = results[callsBefore]?.value as { bindEventBus: ReturnType<typeof vi.fn> } | undefined;
      expect(resumeLc?.bindEventBus).toHaveBeenCalledWith('pause:settings-closed', expect.any(Function));
    });
  });

  describe('resumeGame()', () => {
    it('resumes music and parent scene, then stops PauseScene', () => {
      const scene = makeScene();
      (scene as unknown as { resumeGame: () => void }).resumeGame.call(scene);
      expect(eventBus.emit).toHaveBeenCalledWith('music:resume');
      expect(scene.scene.resume).toHaveBeenCalledWith('PlatformTeamScene');
      expect(scene.scene.stop).toHaveBeenCalled();
    });
  });

  describe('quitToMenu()', () => {
    it('stops music, stops parent scene, starts MenuScene', () => {
      const scene = makeScene();
      (scene as unknown as { quitToMenu: () => void }).quitToMenu.call(scene);
      expect(eventBus.emit).toHaveBeenCalledWith('music:stop');
      expect(scene.scene.stop).toHaveBeenCalledWith('PlatformTeamScene');
      expect(scene.scene.start).toHaveBeenCalledWith('MenuScene');
    });
  });
});
