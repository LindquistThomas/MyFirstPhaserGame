import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { KVStorage } from '../systems/SaveManager';

// Mock touchPrimary to control isTouchPrimary() without pulling in Phaser
// (VirtualGamepad imports InputService which imports Phaser at module level,
// causing canvas feature-detection failures in jsdom). TouchHintOverlay.ts
// imports isTouchPrimary directly from ./touchPrimary, so that is the only
// module that needs to be mocked.
vi.mock('./touchPrimary', () => ({
  isTouchPrimary: vi.fn(() => true),
}));

import { showTouchHintIfNeeded, showTouchHintForced } from './TouchHintOverlay';
import * as TouchHintStore from '../systems/TouchHintStore';
import * as touchPrimary from './touchPrimary';

// --- storage seam -----------------------------------------------------------
function memStorage(): KVStorage & { data: Record<string, string> } {
  const data: Record<string, string> = {};
  return {
    data,
    getItem:    (key) => data[key] ?? null,
    setItem:    (key, value) => { data[key] = value; },
    removeItem: (key) => { delete data[key]; },
  };
}

// --- helpers ----------------------------------------------------------------
function makePad(): HTMLDivElement {
  const pad = document.createElement('div');
  pad.id = 'virtual-pad';
  pad.innerHTML = `
    <div class="vpad-dpad">
      <button class="vpad-btn" data-actions="MoveUp NavigateUp">▲</button>
      <button class="vpad-btn" data-actions="MoveLeft NavigateLeft">◀</button>
      <button class="vpad-btn" data-actions="MoveRight NavigateRight">▶</button>
      <button class="vpad-btn" data-actions="MoveDown NavigateDown">▼</button>
    </div>
    <button class="vpad-btn vpad-btn--action" data-actions="Jump">A</button>
    <button class="vpad-btn vpad-btn--action" data-actions="Interact Confirm">B</button>
  `;
  document.body.appendChild(pad);
  return pad;
}

// ---------------------------------------------------------------------------
describe('showTouchHintIfNeeded', () => {
  let storage: ReturnType<typeof memStorage>;
  let pad: HTMLDivElement;

  beforeEach(() => {
    vi.useFakeTimers();
    storage = memStorage();
    TouchHintStore.setStorage(storage);

    // Default: act as a touch-primary device.
    vi.spyOn(touchPrimary, 'isTouchPrimary').mockReturnValue(true);

    pad = makePad();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
    document.getElementById('touch-hint-overlay')?.remove();
    pad.remove();
  });

  it('creates the overlay on first run (touch primary, not seen)', () => {
    showTouchHintIfNeeded(pad);
    expect(document.getElementById('touch-hint-overlay')).not.toBeNull();
  });

  it('overlay contains the hint message text', () => {
    showTouchHintIfNeeded(pad);
    const msg = document.getElementById('touch-hint-message');
    expect(msg?.textContent).toMatch(/buttons below/i);
  });

  it('does nothing on desktop (isTouchPrimary = false)', () => {
    vi.spyOn(touchPrimary, 'isTouchPrimary').mockReturnValue(false);
    showTouchHintIfNeeded(pad);
    expect(document.getElementById('touch-hint-overlay')).toBeNull();
  });

  it('does nothing when hint has already been seen', () => {
    TouchHintStore.markSeen();
    showTouchHintIfNeeded(pad);
    expect(document.getElementById('touch-hint-overlay')).toBeNull();
  });

  it('adds vpad-hint-pulse to the D-pad and Jump button', () => {
    showTouchHintIfNeeded(pad);
    const dpad = pad.querySelector('.vpad-dpad');
    const jumpBtn = pad.querySelector('[data-actions~="Jump"]');
    expect(dpad?.classList.contains('vpad-hint-pulse')).toBe(true);
    expect(jumpBtn?.classList.contains('vpad-hint-pulse')).toBe(true);
  });

  it('auto-dismisses after 6 s and marks seen', async () => {
    showTouchHintIfNeeded(pad);
    expect(document.getElementById('touch-hint-overlay')).not.toBeNull();

    await vi.advanceTimersByTimeAsync(6_000);

    // markSeen() should have been called.
    expect(TouchHintStore.hasSeen()).toBe(true);
    // Pulse classes removed.
    expect(pad.querySelector('.vpad-dpad')?.classList.contains('vpad-hint-pulse')).toBe(false);
  });

  it('dismisses on virtual-pad button touchstart and marks seen', async () => {
    showTouchHintIfNeeded(pad);

    const btn = pad.querySelector<HTMLElement>('.vpad-btn')!;
    btn.dispatchEvent(new TouchEvent('touchstart', { bubbles: true }));
    await vi.runAllTimersAsync();

    expect(TouchHintStore.hasSeen()).toBe(true);
    expect(pad.querySelector('.vpad-dpad')?.classList.contains('vpad-hint-pulse')).toBe(false);
  });

  it('is idempotent — does not create a second overlay on repeated calls', () => {
    showTouchHintIfNeeded(pad);
    // Second call short-circuits because #touch-hint-overlay already exists.
    showTouchHintIfNeeded(pad);
    const overlays = document.querySelectorAll('#touch-hint-overlay');
    expect(overlays.length).toBe(1);
  });
});

// ---------------------------------------------------------------------------
describe('showTouchHintForced', () => {
  let storage: ReturnType<typeof memStorage>;
  let pad: HTMLDivElement;

  beforeEach(() => {
    vi.useFakeTimers();
    storage = memStorage();
    TouchHintStore.setStorage(storage);
    pad = makePad();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
    document.getElementById('touch-hint-overlay')?.remove();
    pad.remove();
  });

  it('shows the hint even when isTouchPrimary = false', () => {
    vi.spyOn(touchPrimary, 'isTouchPrimary').mockReturnValue(false);
    showTouchHintForced(pad);
    expect(document.getElementById('touch-hint-overlay')).not.toBeNull();
  });

  it('shows the hint even when hasSeen = true', () => {
    TouchHintStore.markSeen();
    showTouchHintForced(pad);
    expect(document.getElementById('touch-hint-overlay')).not.toBeNull();
  });

  it('does NOT mark seen when auto-dismissed after timeout', async () => {
    TouchHintStore.setStorage(storage); // fresh storage, hasSeen=false
    showTouchHintForced(pad);
    await vi.advanceTimersByTimeAsync(6_000);
    // hasSeen should remain false since markOnDismiss=false
    expect(TouchHintStore.hasSeen()).toBe(false);
  });

  it('does NOT mark seen when dismissed by button touch', async () => {
    showTouchHintForced(pad);
    const btn = pad.querySelector<HTMLElement>('.vpad-btn')!;
    btn.dispatchEvent(new TouchEvent('touchstart', { bubbles: true }));
    await vi.runAllTimersAsync();
    expect(TouchHintStore.hasSeen()).toBe(false);
  });

  it('is idempotent — does not create a second overlay if one exists', () => {
    showTouchHintForced(pad);
    showTouchHintForced(pad);
    expect(document.querySelectorAll('#touch-hint-overlay').length).toBe(1);
  });

  it('pulses the D-pad and Jump button', () => {
    showTouchHintForced(pad);
    expect(pad.querySelector('.vpad-dpad')?.classList.contains('vpad-hint-pulse')).toBe(true);
    expect(pad.querySelector('[data-actions~="Jump"]')?.classList.contains('vpad-hint-pulse')).toBe(true);
  });
});
