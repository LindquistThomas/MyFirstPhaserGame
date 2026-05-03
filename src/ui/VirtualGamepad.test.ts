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
    read: vi.fn(() => ({ onScreenControls: 'auto', hapticsEnabled: true, highContrast: false })),
    setOnScreenControls: vi.fn(),
  },
}));

vi.mock('../systems/MotionPreference', () => ({
  isReducedMotion: vi.fn(() => false),
}));

import {
  applyVirtualGamepadVisibility,
  registerReactiveDetection,
  initVirtualGamepad,
  updateVirtualGamepadContrast,
  _resetReactiveDetected,
} from './VirtualGamepad';
import * as touchPrimary from './touchPrimary';
import * as TouchHintOverlay from './TouchHintOverlay';
import * as EventBusModule from '../systems/EventBus';
import * as SettingsStoreModule from '../systems/SettingsStore';
import * as MotionPreference from '../systems/MotionPreference';

// Helpers -------------------------------------------------------------------

function mockSetting(setting: 'auto' | 'always' | 'never', hapticsEnabled = true): void {
  vi.mocked(SettingsStoreModule.settingsStore.read).mockReturnValue({
    onScreenControls: setting,
    hapticsEnabled,
    highContrast: false,
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

// ---------------------------------------------------------------------------
describe('updateVirtualGamepadContrast', () => {
  beforeEach(() => {
    _resetReactiveDetected();
    vi.mocked(touchPrimary.isTouchPrimary).mockReturnValue(true);
    mockSetting('auto');
    document.getElementById('virtual-pad')?.remove();
  });

  afterEach(() => {
    document.getElementById('virtual-pad')?.remove();
    vi.restoreAllMocks();
  });

  it('is a no-op when the pad is not mounted', () => {
    expect(() => updateVirtualGamepadContrast(true)).not.toThrow();
    expect(() => updateVirtualGamepadContrast(false)).not.toThrow();
  });

  it('adds vpad-high-contrast class when enabled=true', () => {
    applyVirtualGamepadVisibility(); // mounts the pad
    const pad = getPad()!;
    pad.classList.remove('vpad-high-contrast');
    updateVirtualGamepadContrast(true);
    expect(pad.classList.contains('vpad-high-contrast')).toBe(true);
  });

  it('removes vpad-high-contrast class when enabled=false', () => {
    applyVirtualGamepadVisibility(); // mounts the pad
    const pad = getPad()!;
    pad.classList.add('vpad-high-contrast');
    updateVirtualGamepadContrast(false);
    expect(pad.classList.contains('vpad-high-contrast')).toBe(false);
  });

  it('toggles the class in sync with multiple calls', () => {
    applyVirtualGamepadVisibility();
    const pad = getPad()!;
    updateVirtualGamepadContrast(true);
    expect(pad.classList.contains('vpad-high-contrast')).toBe(true);
    updateVirtualGamepadContrast(false);
    expect(pad.classList.contains('vpad-high-contrast')).toBe(false);
    updateVirtualGamepadContrast(true);
    expect(pad.classList.contains('vpad-high-contrast')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
describe('actionsOf / data-actions parsing (via button touch events)', () => {
  beforeEach(() => {
    _resetReactiveDetected();
    vi.mocked(touchPrimary.isTouchPrimary).mockReturnValue(true);
    mockSetting('auto');
    document.getElementById('virtual-pad')?.remove();
  });

  afterEach(() => {
    document.getElementById('virtual-pad')?.remove();
    vi.restoreAllMocks();
  });

  it('buildPad creates buttons with data-actions attributes', () => {
    applyVirtualGamepadVisibility();
    const pad = getPad()!;
    const btns = pad.querySelectorAll('[data-actions]');
    expect(btns.length).toBeGreaterThan(0);
  });

  it('Jump button has data-actions="Jump"', () => {
    applyVirtualGamepadVisibility();
    const pad = getPad()!;
    const jumpBtn = pad.querySelector('[data-actions="Jump"]');
    expect(jumpBtn).not.toBeNull();
  });

  it('touchstart on a button calls setVirtualButton for each action', async () => {
    const inputMod = await import('../input');
    const setVirtualButtonMock = vi.mocked(inputMod.setVirtualButton);
    setVirtualButtonMock.mockClear();
    applyVirtualGamepadVisibility();
    const pad = getPad()!;
    const jumpBtn = pad.querySelector('[data-actions="Jump"]') as HTMLElement;
    const touchStartEvent = new Event('touchstart');
    Object.defineProperty(touchStartEvent, 'preventDefault', { value: vi.fn() });
    Object.defineProperty(touchStartEvent, 'currentTarget', { value: jumpBtn });
    jumpBtn.dispatchEvent(touchStartEvent);
    expect(setVirtualButtonMock).toHaveBeenCalledWith('Jump', true);
  });
});

// ---------------------------------------------------------------------------
describe('haptic feedback on vpad button press', () => {
  let vibrateMock: ReturnType<typeof vi.fn>;
  let originalVibrateDescriptor: PropertyDescriptor | undefined;

  beforeEach(() => {
    _resetReactiveDetected();
    vi.mocked(touchPrimary.isTouchPrimary).mockReturnValue(true);
    mockSetting('auto', true);
    vi.mocked(MotionPreference.isReducedMotion).mockReturnValue(false);
    document.getElementById('virtual-pad')?.remove();

    // Save original descriptor before stubbing so afterEach can restore it.
    originalVibrateDescriptor = Object.getOwnPropertyDescriptor(navigator, 'vibrate');
    vibrateMock = vi.fn();
    Object.defineProperty(navigator, 'vibrate', { value: vibrateMock, writable: true, configurable: true });
  });

  afterEach(() => {
    document.getElementById('virtual-pad')?.remove();
    // Restore navigator.vibrate to its original state to avoid leaking across tests.
    if (originalVibrateDescriptor !== undefined) {
      Object.defineProperty(navigator, 'vibrate', originalVibrateDescriptor);
    } else {
      // Property didn't exist originally — remove the stub.
      try { delete (navigator as unknown as Record<string, unknown>)['vibrate']; } catch { /* non-configurable in some envs */ }
    }
    vi.restoreAllMocks();
  });

  function fireTouchStart(btn: HTMLElement): void {
    const ev = new Event('touchstart');
    Object.defineProperty(ev, 'preventDefault', { value: vi.fn() });
    Object.defineProperty(ev, 'currentTarget', { value: btn });
    btn.dispatchEvent(ev);
  }

  it('calls navigator.vibrate(10) on touchstart when hapticsEnabled=true and not reduced motion', () => {
    applyVirtualGamepadVisibility();
    const jumpBtn = getPad()!.querySelector('[data-actions="Jump"]') as HTMLElement;
    fireTouchStart(jumpBtn);
    expect(vibrateMock).toHaveBeenCalledWith(10);
  });

  it('does NOT call navigator.vibrate when hapticsEnabled=false', () => {
    mockSetting('auto', false);
    applyVirtualGamepadVisibility();
    const jumpBtn = getPad()!.querySelector('[data-actions="Jump"]') as HTMLElement;
    fireTouchStart(jumpBtn);
    expect(vibrateMock).not.toHaveBeenCalled();
  });

  it('does NOT call navigator.vibrate when isReducedMotion() is true', () => {
    vi.mocked(MotionPreference.isReducedMotion).mockReturnValue(true);
    applyVirtualGamepadVisibility();
    const jumpBtn = getPad()!.querySelector('[data-actions="Jump"]') as HTMLElement;
    fireTouchStart(jumpBtn);
    expect(vibrateMock).not.toHaveBeenCalled();
  });
});
