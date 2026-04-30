/**
 * Unit tests for the VirtualGamepad visibility / reactive-detection logic.
 *
 * Mocks that must be set up before any imports that transitively pull in Phaser
 * (InputService → Phaser canvas API) are resolved:
 *   - `../input`         → avoids Phaser canvas feature detection in jsdom
 *   - `./touchPrimary`   → controls isTouchPrimary() per-test
 *   - `./TouchHintOverlay` → prevents DOM side-effects from hint overlay
 *   - `../systems/EventBus` → captures emitted events
 *   - `../systems/SettingsStore` → controls onScreenControls per-test
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock dependencies that pull in Phaser or have complex DOM side-effects.
vi.mock('../input', () => ({
  setVirtualButton: vi.fn(),
  GameAction: {},
}));
vi.mock('./touchPrimary', () => ({
  isTouchPrimary: vi.fn(() => false),
}));
vi.mock('./TouchHintOverlay', () => ({
  showTouchHintIfNeeded: vi.fn(),
  showTouchHintForced: vi.fn(),
}));
vi.mock('../systems/EventBus', () => ({
  eventBus: {
    emit: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
  },
}));
vi.mock('../systems/SettingsStore', () => ({
  settingsStore: {
    read: vi.fn(() => ({ onScreenControls: 'auto' })),
    setOnScreenControls: vi.fn(),
  },
}));

import {
  applyVirtualGamepadVisibility,
  registerReactiveDetection,
  initVirtualGamepad,
  _resetReactiveDetected,
} from './VirtualGamepad';
import * as touchPrimary from './touchPrimary';
import * as TouchHintOverlay from './TouchHintOverlay';
import * as EventBusModule from '../systems/EventBus';
import * as SettingsStoreModule from '../systems/SettingsStore';

// Helpers -------------------------------------------------------------------

function mockSetting(setting: 'auto' | 'always' | 'never'): void {
  vi.mocked(SettingsStoreModule.settingsStore.read).mockReturnValue({
    onScreenControls: setting,
  } as ReturnType<typeof SettingsStoreModule.settingsStore.read>);
}

function getPad(): HTMLElement | null {
  return document.getElementById('virtual-pad');
}

// ---------------------------------------------------------------------------
describe('applyVirtualGamepadVisibility', () => {
  beforeEach(() => {
    _resetReactiveDetected();
    // Default: non-touch device, auto setting
    vi.mocked(touchPrimary.isTouchPrimary).mockReturnValue(false);
    mockSetting('auto');
    // Clean up any pad from previous tests
    document.getElementById('virtual-pad')?.remove();
    vi.mocked(TouchHintOverlay.showTouchHintIfNeeded).mockClear();
    vi.mocked(TouchHintOverlay.showTouchHintForced).mockClear();
  });

  afterEach(() => {
    document.getElementById('virtual-pad')?.remove();
    vi.restoreAllMocks();
  });

  // --- 'never' branch ---
  it("setting='never': hides pad if it exists", () => {
    mockSetting('auto');
    vi.mocked(touchPrimary.isTouchPrimary).mockReturnValue(true);
    applyVirtualGamepadVisibility(); // create and show pad
    expect(getPad()?.classList.contains('active')).toBe(true);

    mockSetting('never');
    applyVirtualGamepadVisibility(); // should hide it
    expect(getPad()?.classList.contains('active')).toBe(false);
  });

  it("setting='never': does not create pad when one doesn't exist", () => {
    mockSetting('never');
    applyVirtualGamepadVisibility();
    expect(getPad()).toBeNull();
  });

  // --- 'always' branch ---
  it("setting='always': shows pad on non-touch device", () => {
    mockSetting('always');
    vi.mocked(touchPrimary.isTouchPrimary).mockReturnValue(false);
    applyVirtualGamepadVisibility();
    expect(getPad()?.classList.contains('active')).toBe(true);
  });

  it("setting='always' on non-touch device: calls showTouchHintForced", () => {
    mockSetting('always');
    vi.mocked(touchPrimary.isTouchPrimary).mockReturnValue(false);
    applyVirtualGamepadVisibility();
    expect(TouchHintOverlay.showTouchHintForced).toHaveBeenCalledTimes(1);
    expect(TouchHintOverlay.showTouchHintIfNeeded).not.toHaveBeenCalled();
  });

  it("setting='always' on touch-primary device: calls showTouchHintIfNeeded", () => {
    mockSetting('always');
    vi.mocked(touchPrimary.isTouchPrimary).mockReturnValue(true);
    applyVirtualGamepadVisibility();
    expect(TouchHintOverlay.showTouchHintIfNeeded).toHaveBeenCalledTimes(1);
    expect(TouchHintOverlay.showTouchHintForced).not.toHaveBeenCalled();
  });

  it("setting='always': no hint on second call (wasHidden=false)", () => {
    mockSetting('always');
    vi.mocked(touchPrimary.isTouchPrimary).mockReturnValue(false);
    applyVirtualGamepadVisibility(); // first call — creates pad, hint fires
    vi.mocked(TouchHintOverlay.showTouchHintForced).mockClear();
    applyVirtualGamepadVisibility(); // second call — pad already active
    expect(TouchHintOverlay.showTouchHintForced).not.toHaveBeenCalled();
  });

  // --- 'auto' branch ---
  it("setting='auto': shows pad when isTouchPrimary=true", () => {
    mockSetting('auto');
    vi.mocked(touchPrimary.isTouchPrimary).mockReturnValue(true);
    applyVirtualGamepadVisibility();
    expect(getPad()?.classList.contains('active')).toBe(true);
  });

  it("setting='auto': calls showTouchHintIfNeeded on touch-primary device", () => {
    mockSetting('auto');
    vi.mocked(touchPrimary.isTouchPrimary).mockReturnValue(true);
    applyVirtualGamepadVisibility();
    expect(TouchHintOverlay.showTouchHintIfNeeded).toHaveBeenCalledTimes(1);
  });

  it("setting='auto': hides pad on non-touch device without reactive detection", () => {
    mockSetting('auto');
    vi.mocked(touchPrimary.isTouchPrimary).mockReturnValue(false);
    applyVirtualGamepadVisibility();
    expect(getPad()).toBeNull();
  });
});

// ---------------------------------------------------------------------------
describe('registerReactiveDetection + reactive session flag', () => {
  beforeEach(() => {
    _resetReactiveDetected();
    vi.mocked(touchPrimary.isTouchPrimary).mockReturnValue(false);
    mockSetting('auto');
    document.getElementById('virtual-pad')?.remove();
    vi.mocked(TouchHintOverlay.showTouchHintIfNeeded).mockClear();
    vi.mocked(TouchHintOverlay.showTouchHintForced).mockClear();
    vi.mocked(EventBusModule.eventBus.emit).mockClear();
  });

  afterEach(() => {
    document.getElementById('virtual-pad')?.remove();
    vi.restoreAllMocks();
  });

  it('emits input:touch_detected on first touchstart', () => {
    registerReactiveDetection();
    window.dispatchEvent(new Event('touchstart'));
    expect(EventBusModule.eventBus.emit).toHaveBeenCalledWith('input:touch_detected');
  });

  it('reactive detection activates pad (auto setting)', () => {
    registerReactiveDetection();
    window.dispatchEvent(new Event('touchstart'));
    expect(getPad()?.classList.contains('active')).toBe(true);
  });

  it('listener is removed after first touchstart (once semantics)', () => {
    registerReactiveDetection();
    window.dispatchEvent(new Event('touchstart'));
    vi.mocked(EventBusModule.eventBus.emit).mockClear();
    window.dispatchEvent(new Event('touchstart'));
    // emit should NOT fire again for input:touch_detected
    expect(EventBusModule.eventBus.emit).not.toHaveBeenCalledWith('input:touch_detected');
  });

  it('reactive detection does not show pad when setting is never', () => {
    mockSetting('never');
    registerReactiveDetection();
    window.dispatchEvent(new Event('touchstart'));
    expect(getPad()).toBeNull();
  });
});

// ---------------------------------------------------------------------------
describe('initVirtualGamepad', () => {
  beforeEach(() => {
    _resetReactiveDetected();
    vi.mocked(touchPrimary.isTouchPrimary).mockReturnValue(false);
    mockSetting('auto');
    document.getElementById('virtual-pad')?.remove();
    vi.mocked(EventBusModule.eventBus.on).mockClear();
  });

  afterEach(() => {
    document.getElementById('virtual-pad')?.remove();
    // Drain the once-listener installed by initVirtualGamepad/registerReactiveDetection
    // so it doesn't bleed into subsequent test files.
    window.dispatchEvent(new Event('touchstart'));
    vi.restoreAllMocks();
  });

  it('subscribes to settings:changed event', () => {
    initVirtualGamepad();
    expect(EventBusModule.eventBus.on).toHaveBeenCalledWith(
      'settings:changed',
      applyVirtualGamepadVisibility,
    );
  });

  it('does not show pad on non-touch device with auto setting', () => {
    initVirtualGamepad();
    expect(getPad()).toBeNull();
  });

  it('shows pad on touch-primary device with auto setting', () => {
    vi.mocked(touchPrimary.isTouchPrimary).mockReturnValue(true);
    initVirtualGamepad();
    expect(getPad()?.classList.contains('active')).toBe(true);
  });

  it('shows pad immediately when setting is always', () => {
    mockSetting('always');
    initVirtualGamepad();
    expect(getPad()?.classList.contains('active')).toBe(true);
  });
});
