import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { KVStorage } from '../systems/SaveManager';

// Mock VirtualGamepad to avoid pulling in Phaser (InputService imports it at
// module level which triggers canvas feature-detection that fails in jsdom).
vi.mock('./VirtualGamepad', () => ({
  isTouchPrimary: vi.fn(() => true),
}));

import { showTouchHintIfNeeded } from './TouchHintOverlay';
import * as TouchHintStore from '../systems/TouchHintStore';
import * as VirtualGamepad from './VirtualGamepad';

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
    vi.spyOn(VirtualGamepad, 'isTouchPrimary').mockReturnValue(true);

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
    vi.spyOn(VirtualGamepad, 'isTouchPrimary').mockReturnValue(false);
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
    // Second call: hasSeen() returns true now so it short-circuits.
    showTouchHintIfNeeded(pad);
    const overlays = document.querySelectorAll('#touch-hint-overlay');
    expect(overlays.length).toBe(1);
  });
});
