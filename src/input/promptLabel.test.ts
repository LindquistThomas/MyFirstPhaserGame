import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { eventBus } from '../systems/EventBus';
import { setTouchPrimaryOverride } from '../ui/touchPrimary';
import {
  _resetInputModeTrackingForTests,
  actionPrompt,
  detectInputMode,
  initInputModeTracking,
  promptLabel,
} from './promptLabel';

vi.mock('./keyLabels', () => ({
  primaryKeyLabel: vi.fn(() => 'K'),
}));

type GamepadsGetter = () => Array<Gamepad | null>;

function mockGamepads(getter: GamepadsGetter): void {
  Object.defineProperty(navigator, 'getGamepads', {
    configurable: true,
    value: getter,
  });
}

describe('promptLabel', () => {
  beforeEach(() => {
    localStorage.clear();
    eventBus.removeAllListeners();
    _resetInputModeTrackingForTests();
    mockGamepads(() => []);
  });

  afterEach(() => {
    _resetInputModeTrackingForTests();
    eventBus.removeAllListeners();
    localStorage.clear();
  });

  it('detectInputMode precedence: touch override > gamepad > keyboard', () => {
    mockGamepads(() => [{ connected: true } as Gamepad]);

    setTouchPrimaryOverride(true);
    expect(detectInputMode()).toBe('touch');

    setTouchPrimaryOverride(false);
    expect(detectInputMode()).toBe('keyboard');

    setTouchPrimaryOverride(null);
    expect(detectInputMode()).toBe('gamepad');

    mockGamepads(() => []);
    expect(detectInputMode()).toBe('keyboard');
  });

  it('promptLabel falls back to keyboard label when gamepad map entry is missing', async () => {
    const keyLabels = await import('./keyLabels');
    vi.mocked(keyLabels.primaryKeyLabel).mockReturnValue('X');

    expect(promptLabel('Attack', 'gamepad')).toBe('X');
    expect(promptLabel('Pause', 'touch')).toBe('X');
    expect(keyLabels.primaryKeyLabel).toHaveBeenCalledWith('Attack');
    expect(keyLabels.primaryKeyLabel).toHaveBeenCalledWith('Pause');
  });

  it('emits input:mode-changed for gamepad connect/disconnect and touch override changes', () => {
    const listener = vi.fn();
    eventBus.on('input:mode-changed', listener);

    initInputModeTracking();

    mockGamepads(() => [{ connected: true } as Gamepad]);
    window.dispatchEvent(new Event('gamepadconnected'));
    expect(listener).toHaveBeenLastCalledWith('gamepad');

    setTouchPrimaryOverride(true);
    expect(listener).toHaveBeenLastCalledWith('touch');

    setTouchPrimaryOverride(null);
    expect(listener).toHaveBeenLastCalledWith('gamepad');

    mockGamepads(() => []);
    window.dispatchEvent(new Event('gamepaddisconnected'));
    expect(listener).toHaveBeenLastCalledWith('keyboard');
  });

  it('detectInputMode falls back to keyboard when navigator.getGamepads throws', () => {
    mockGamepads(() => {
      throw new Error('gamepad api failure');
    });
    expect(detectInputMode()).toBe('keyboard');
  });

  it('actionPrompt returns touch verbs unchanged and prefixes keyboard labels', () => {
    mockGamepads(() => []);
    expect(actionPrompt('Jump', 'touch')).toBe('Tap and hold');
    expect(actionPrompt('Interact', 'touch')).toBe('Tap');
    expect(actionPrompt('MoveLeft', 'touch')).toBe('Swipe');
    expect(actionPrompt('Confirm', 'keyboard')).toBe('Press X');
  });

  it('ignores storage events for unrelated keys', () => {
    const listener = vi.fn();
    eventBus.on('input:mode-changed', listener);
    initInputModeTracking();

    window.dispatchEvent(new StorageEvent('storage', { key: 'unrelated' }));
    expect(listener).not.toHaveBeenCalled();
  });
});
