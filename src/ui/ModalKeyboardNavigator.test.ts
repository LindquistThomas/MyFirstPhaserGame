/**
 * Unit tests for ModalKeyboardNavigator and makeTextFocusable.
 *
 * ModalKeyboardNavigator has no Phaser runtime dependency beyond
 * `scene.add.text` and `scene.inputs`, so only a lightweight scene stub is
 * required — no full Phaser mock needed.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type * as Phaser from 'phaser';

vi.mock('phaser', () => {
  const Phaser = {};
  return { ...Phaser, default: Phaser };
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeArrowText() {
  const t: Record<string, ReturnType<typeof vi.fn>> = {};
  for (const name of [
    'setOrigin', 'setScrollFactor', 'setDepth', 'setVisible', 'setPosition', 'destroy',
  ]) {
    t[name] = vi.fn().mockReturnThis();
  }
  return t as {
    setOrigin: ReturnType<typeof vi.fn>;
    setScrollFactor: ReturnType<typeof vi.fn>;
    setDepth: ReturnType<typeof vi.fn>;
    setVisible: ReturnType<typeof vi.fn>;
    setPosition: ReturnType<typeof vi.fn>;
    destroy: ReturnType<typeof vi.fn>;
  };
}

type InputHandler = () => void;

function makeScene() {
  const inputHandlers: Map<string, InputHandler[]> = new Map();
  const arrowText = makeArrowText();

  return {
    add: {
      text: vi.fn(() => arrowText),
    },
    inputs: {
      on: vi.fn((action: string, handler: InputHandler) => {
        if (!inputHandlers.has(action)) inputHandlers.set(action, []);
        inputHandlers.get(action)!.push(handler);
      }),
      off: vi.fn((action: string, handler: InputHandler) => {
        const list = inputHandlers.get(action) ?? [];
        const idx = list.indexOf(handler);
        if (idx >= 0) list.splice(idx, 1);
      }),
    },
    _arrow: arrowText,
    _fire: (action: string) => {
      for (const h of inputHandlers.get(action) ?? []) h();
    },
    _handlers: inputHandlers,
  };
}

function makeFocusable(
  bounds = { x: 100, y: 200, width: 80, height: 20 },
) {
  return {
    focus: vi.fn(),
    blur: vi.fn(),
    activate: vi.fn(),
    bounds: vi.fn(() => bounds as unknown as Phaser.Geom.Rectangle),
  };
}

// ---------------------------------------------------------------------------
// Import under test (after mocks)
// ---------------------------------------------------------------------------

import { ModalKeyboardNavigator, makeTextFocusable } from './ModalKeyboardNavigator';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ModalKeyboardNavigator', () => {
  let scene: ReturnType<typeof makeScene>;
  let nav: ModalKeyboardNavigator;

  beforeEach(() => {
    scene = makeScene();
    nav = new ModalKeyboardNavigator(scene as unknown as Phaser.Scene);
  });

  it('constructs and creates an invisible focus arrow at depth 201', () => {
    expect(scene.add.text).toHaveBeenCalledWith(0, 0, '\u25b6', expect.any(Object));
    expect(scene._arrow.setScrollFactor).toHaveBeenCalledWith(0);
    expect(scene._arrow.setDepth).toHaveBeenCalledWith(201);
    expect(scene._arrow.setVisible).toHaveBeenCalledWith(false);
  });

  it('add() appends focusables and returns their indices', () => {
    const f0 = makeFocusable();
    const f1 = makeFocusable();
    expect(nav.add(f0)).toBe(0);
    expect(nav.add(f1)).toBe(1);
    expect(nav.size()).toBe(2);
  });

  it('get() returns the focusable at the given index or undefined', () => {
    const f = makeFocusable();
    nav.add(f);
    expect(nav.get(0)).toBe(f);
    expect(nav.get(99)).toBeUndefined();
  });

  it('currentIndex() is -1 before any focus is set', () => {
    expect(nav.currentIndex()).toBe(-1);
  });

  it('setFocus() calls focus on the new item and blur on the previous', () => {
    const f0 = makeFocusable();
    const f1 = makeFocusable();
    nav.add(f0);
    nav.add(f1);

    nav.setFocus(0);
    expect(f0.focus).toHaveBeenCalledTimes(1);
    expect(f0.blur).not.toHaveBeenCalled();

    nav.setFocus(1);
    expect(f0.blur).toHaveBeenCalledTimes(1);
    expect(f1.focus).toHaveBeenCalledTimes(1);
  });

  it('setFocus() out-of-bounds is a no-op', () => {
    const f = makeFocusable();
    nav.add(f);
    nav.setFocus(5);
    expect(f.focus).not.toHaveBeenCalled();
  });

  it('focusNext() advances focus and wraps around to 0', () => {
    const f0 = makeFocusable();
    const f1 = makeFocusable();
    nav.add(f0);
    nav.add(f1);
    nav.setFocus(1);
    nav.focusNext();
    expect(nav.currentIndex()).toBe(0);
  });

  it('focusPrev() moves focus back and wraps around to last item', () => {
    const f0 = makeFocusable();
    const f1 = makeFocusable();
    nav.add(f0);
    nav.add(f1);
    nav.setFocus(0);
    nav.focusPrev();
    expect(nav.currentIndex()).toBe(1);
  });

  it('activateFocused() calls activate() on the currently focused item', () => {
    const f = makeFocusable();
    nav.add(f);
    nav.setFocus(0);
    nav.activateFocused();
    expect(f.activate).toHaveBeenCalledTimes(1);
  });

  it('reset() clears all focusables, resets index to -1, and hides the arrow', () => {
    nav.add(makeFocusable());
    nav.add(makeFocusable());
    nav.reset();
    expect(nav.size()).toBe(0);
    expect(nav.currentIndex()).toBe(-1);
    // setVisible(false) was called during construction and again on reset
    const calls = scene._arrow.setVisible.mock.calls;
    expect(calls[calls.length - 1]).toEqual([false]);
  });

  it('insert() at an index before the current focus shifts the focus index', () => {
    const f0 = makeFocusable();
    const f1 = makeFocusable();
    const fNew = makeFocusable();
    nav.add(f0);
    nav.add(f1);
    nav.setFocus(1); // focus index = 1
    nav.insert(0, fNew); // insert before index 1 → focus index becomes 2
    expect(nav.currentIndex()).toBe(2);
    expect(nav.get(0)).toBe(fNew);
  });

  it('insert() at index >= current focus does not shift the focus index', () => {
    const f0 = makeFocusable();
    const f1 = makeFocusable();
    const fNew = makeFocusable();
    nav.add(f0);
    nav.add(f1);
    nav.setFocus(0);
    nav.insert(1, fNew); // insert after current focus → no shift
    expect(nav.currentIndex()).toBe(0);
  });

  it('hideArrow() sets the arrow invisible', () => {
    scene._arrow.setVisible.mockClear();
    nav.hideArrow();
    expect(scene._arrow.setVisible).toHaveBeenCalledWith(false);
  });

  it('refreshArrow() positions the arrow relative to the focused item bounds', () => {
    const f = makeFocusable({ x: 200, y: 300, width: 100, height: 24 });
    nav.add(f);
    scene._arrow.setPosition.mockClear();
    scene._arrow.setVisible.mockClear();
    nav.setFocus(0);
    expect(scene._arrow.setPosition).toHaveBeenCalledWith(200 - 14, 300 + 24 / 2);
    expect(scene._arrow.setVisible).toHaveBeenCalledWith(true);
  });

  it('bind() registers a handler and destroy() removes it and destroys the arrow', () => {
    const handler = vi.fn();
    nav.bind('Confirm', handler);
    expect(scene.inputs.on).toHaveBeenCalledWith('Confirm', handler);

    scene._fire('Confirm');
    expect(handler).toHaveBeenCalledTimes(1);

    nav.destroy();
    expect(scene.inputs.off).toHaveBeenCalledWith('Confirm', handler);
    expect(scene._arrow.destroy).toHaveBeenCalled();
  });

  it('destroy() removes all bound handlers', () => {
    const h1 = vi.fn();
    const h2 = vi.fn();
    nav.bind('NavigateUp', h1);
    nav.bind('NavigateDown', h2);
    nav.destroy();
    expect(scene.inputs.off).toHaveBeenCalledWith('NavigateUp', h1);
    expect(scene.inputs.off).toHaveBeenCalledWith('NavigateDown', h2);
  });

  it('focusNext() on an empty list is a no-op', () => {
    expect(() => nav.focusNext()).not.toThrow();
    expect(nav.currentIndex()).toBe(-1);
  });

  it('focusPrev() on an empty list is a no-op', () => {
    expect(() => nav.focusPrev()).not.toThrow();
    expect(nav.currentIndex()).toBe(-1);
  });
});

// ---------------------------------------------------------------------------

describe('makeTextFocusable', () => {
  function makeText() {
    return {
      setColor: vi.fn().mockReturnThis(),
      emit: vi.fn(),
      getBounds: vi.fn(() => ({ x: 10, y: 20, width: 80, height: 16 })),
    };
  }

  it('focus() applies the focus colour', () => {
    const text = makeText();
    const f = makeTextFocusable(text as unknown as Phaser.GameObjects.Text, '#aaa', '#fff');
    f.focus();
    expect(text.setColor).toHaveBeenCalledWith('#fff');
  });

  it('blur() applies the normal colour', () => {
    const text = makeText();
    const f = makeTextFocusable(text as unknown as Phaser.GameObjects.Text, '#aaa', '#fff');
    f.blur();
    expect(text.setColor).toHaveBeenCalledWith('#aaa');
  });

  it('activate() emits a pointerdown event on the text object', () => {
    const text = makeText();
    const f = makeTextFocusable(text as unknown as Phaser.GameObjects.Text, '#aaa', '#fff');
    f.activate();
    expect(text.emit).toHaveBeenCalledWith('pointerdown');
  });

  it('bounds() delegates to text.getBounds()', () => {
    const text = makeText();
    const f = makeTextFocusable(text as unknown as Phaser.GameObjects.Text, '#aaa', '#fff');
    const b = f.bounds();
    expect(text.getBounds).toHaveBeenCalled();
    expect(b).toEqual({ x: 10, y: 20, width: 80, height: 16 });
  });
});
