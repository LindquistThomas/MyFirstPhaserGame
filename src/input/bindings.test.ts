import { describe, it, expect, vi } from 'vitest';

// Mock Phaser with just the runtime surface our input module uses.
// Vitest resolves "phaser" to its uncompiled src which has unresolvable
// require()s (phaser3spectorjs, etc.), so we substitute a stub here.
vi.mock('phaser', () => {
  const KeyCodes = {
    LEFT: 37, UP: 38, RIGHT: 39, DOWN: 40,
    SPACE: 32, ENTER: 13, ESC: 27,
    PAGE_UP: 33, PAGE_DOWN: 34,
    A: 65, B: 66, C: 67, D: 68, I: 73, S: 83, W: 87,
    ONE: 49, TWO: 50, THREE: 51, FOUR: 52,
    F12: 123,
  };
  class ScenePlugin {
    scene: unknown;
    systems: unknown;
    game: unknown;
    pluginKey: string;
    constructor(scene: { sys?: { events?: { once?: (e: string, fn: () => void) => void } } }, pluginManager: { game?: unknown }, pluginKey: string) {
      this.scene = scene;
      this.systems = scene?.sys;
      this.game = pluginManager?.game;
      this.pluginKey = pluginKey;
      scene?.sys?.events?.once?.('boot', () => (this as unknown as { boot?: () => void }).boot?.());
    }
  }
  const phaser = { Input: { Keyboard: { KeyCodes } }, Plugins: { ScenePlugin } };
  return { ...phaser, default: phaser };
});

import * as Phaser from 'phaser';
import {
  ACTION_CONTEXTS,
  ALL_ACTIONS,
  ALWAYS,
  type GameAction,
} from './actions';
import {
  DEFAULT_BINDINGS,
  ALL_BOUND_KEYS,
  actionsForKey,
} from './bindings';
import { keyLabel, primaryKeyLabel, allKeyLabels } from './keyLabels';

const K = Phaser.Input.Keyboard.KeyCodes;

describe('actions', () => {
  it('exposes the expected core set of gameplay actions', () => {
    const expected: GameAction[] = [
      'MoveLeft', 'MoveRight', 'MoveUp', 'MoveDown',
      'Jump', 'Interact', 'ToggleInfo',
      'NavigateUp', 'NavigateDown', 'NavigateLeft', 'NavigateRight',
      'PageUp', 'PageDown',
      'Confirm', 'Cancel',
      'QuickAnswer1', 'QuickAnswer2', 'QuickAnswer3', 'QuickAnswer4',
      'ToggleDebug',
    ];
    for (const a of expected) {
      expect(ALL_ACTIONS).toContain(a);
    }
    expect(ALL_ACTIONS.length).toBe(expected.length);
  });

  it('associates each action with at least one context', () => {
    for (const action of ALL_ACTIONS) {
      const ctxs = ACTION_CONTEXTS[action];
      expect(ctxs).toBeDefined();
      expect(ctxs.length).toBeGreaterThan(0);
    }
  });

  it('restricts gameplay-only actions to the gameplay context', () => {
    expect(ACTION_CONTEXTS.Jump).toEqual(['gameplay']);
    expect(ACTION_CONTEXTS.MoveLeft).toEqual(['gameplay']);
    expect(ACTION_CONTEXTS.Interact).toEqual(['gameplay']);
  });

  it('marks ToggleDebug as always-available', () => {
    expect(ACTION_CONTEXTS.ToggleDebug).toContain(ALWAYS);
  });

  it('makes menu actions available in menu and modal contexts', () => {
    expect(ACTION_CONTEXTS.Confirm).toEqual(expect.arrayContaining(['menu', 'modal']));
    expect(ACTION_CONTEXTS.Cancel).toEqual(expect.arrayContaining(['menu', 'modal']));
  });
});

describe('bindings', () => {
  it('maps arrow keys and WASD to their movement actions', () => {
    expect(DEFAULT_BINDINGS.MoveLeft).toContain(K.LEFT);
    expect(DEFAULT_BINDINGS.MoveLeft).toContain(K.A);
    expect(DEFAULT_BINDINGS.MoveRight).toContain(K.RIGHT);
    expect(DEFAULT_BINDINGS.MoveRight).toContain(K.D);
    expect(DEFAULT_BINDINGS.MoveUp).toContain(K.UP);
    expect(DEFAULT_BINDINGS.MoveUp).toContain(K.W);
    expect(DEFAULT_BINDINGS.MoveDown).toContain(K.DOWN);
    expect(DEFAULT_BINDINGS.MoveDown).toContain(K.S);
  });

  it('reserves Space exclusively for Jump (not Interact/Confirm)', () => {
    // Per the comment in bindings.ts: Space must never trigger a scene
    // transition or dialog by accident — Enter handles those verbs.
    expect(DEFAULT_BINDINGS.Jump).toContain(K.SPACE);
    // Jump is also reserved against Up so pressing Up near an info zone
    // opens the card without also triggering a jump frame.
    expect(DEFAULT_BINDINGS.Jump).not.toContain(K.UP);
    expect(DEFAULT_BINDINGS.Interact).not.toContain(K.SPACE);
    expect(DEFAULT_BINDINGS.Confirm).not.toContain(K.SPACE);
    expect(DEFAULT_BINDINGS.Interact).toContain(K.ENTER);
    expect(DEFAULT_BINDINGS.Confirm).toContain(K.ENTER);
  });

  it('binds ArrowUp as the primary ToggleInfo key', () => {
    expect(DEFAULT_BINDINGS.ToggleInfo).toContain(K.UP);
    expect(DEFAULT_BINDINGS.ToggleInfo[0]).toBe(K.UP);
  });

  it('defines a non-empty binding for every action', () => {
    for (const action of ALL_ACTIONS) {
      expect(DEFAULT_BINDINGS[action].length).toBeGreaterThan(0);
    }
  });

  it('actionsForKey returns every action a given key triggers', () => {
    // Space is reserved for Jump only.
    expect(actionsForKey(K.SPACE)).toEqual(['Jump']);

    // Enter is the multi-verb key: Interact, ToggleInfo, Confirm all listen.
    expect(actionsForKey(K.ENTER)).toEqual(
      expect.arrayContaining(['Interact', 'ToggleInfo', 'Confirm']),
    );

    // Arrow keys drive both gameplay movement and menu navigation.
    expect(actionsForKey(K.LEFT)).toEqual(
      expect.arrayContaining(['MoveLeft', 'NavigateLeft']),
    );

    // Arrow Up drives MoveUp, NavigateUp, and ToggleInfo — but NOT Jump.
    expect(actionsForKey(K.UP)).toEqual(
      expect.arrayContaining(['MoveUp', 'NavigateUp', 'ToggleInfo']),
    );
    expect(actionsForKey(K.UP)).not.toContain('Jump');
  });

  it('actionsForKey returns empty for an unbound key code', () => {
    expect(actionsForKey(-1)).toEqual([]);
    expect(actionsForKey(K.F12)).toEqual([]);
  });

  it('ALL_BOUND_KEYS contains every key referenced by the binding table', () => {
    const every = new Set<number>();
    for (const keys of Object.values(DEFAULT_BINDINGS)) {
      for (const k of keys) every.add(k);
    }
    expect(new Set(ALL_BOUND_KEYS)).toEqual(every);
  });
});

describe('keyLabels', () => {
  it('produces sensible labels for common keys', () => {
    expect(keyLabel(K.SPACE)).toBe('Space');
    expect(keyLabel(K.ENTER)).toBe('Enter');
    expect(keyLabel(K.ESC)).toBe('Esc');
    expect(keyLabel(K.LEFT)).toBe('←');
    expect(keyLabel(K.RIGHT)).toBe('→');
    expect(keyLabel(K.UP)).toBe('↑');
    expect(keyLabel(K.DOWN)).toBe('↓');
    expect(keyLabel(K.W)).toBe('W');
    expect(keyLabel(K.ONE)).toBe('1');
  });

  it('falls back to the numeric keycode for unknown keys', () => {
    expect(keyLabel(9999)).toBe('9999');
  });

  it('primaryKeyLabel returns the label of the first-bound key', () => {
    // Jump binds [SPACE, W] — primary is Space.
    expect(primaryKeyLabel('Jump')).toBe('Space');
    // MoveLeft binds [LEFT, A] — primary is the arrow.
    expect(primaryKeyLabel('MoveLeft')).toBe('←');
    // ToggleInfo is primarily Arrow Up so on-screen hints read "Press ↑".
    expect(primaryKeyLabel('ToggleInfo')).toBe('↑');
  });

  it('allKeyLabels joins every bound key with the given separator', () => {
    // Jump binds [Space, W] — exercises the multi-key join path.
    expect(allKeyLabels('Jump')).toBe('Space/W');
    expect(allKeyLabels('Jump', ', ')).toBe('Space, W');
    // Single-key actions render without a separator.
    expect(allKeyLabels('Interact')).toBe('Enter');
  });
});
