import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { announce, initAriaLive } from './ariaLive';
import { eventBus } from '../systems/EventBus';
import { FLOORS } from '../config/gameConfig';

const REGION_ID = 'game-aria-live';

function createRegion(): HTMLElement {
  let el = document.getElementById(REGION_ID);
  if (!el) {
    el = document.createElement('div');
    el.id = REGION_ID;
    el.setAttribute('aria-live', 'polite');
    document.body.appendChild(el);
  }
  return el;
}

describe('announce', () => {
  let el: HTMLElement;

  beforeEach(() => {
    vi.useFakeTimers();
    el = createRegion();
    el.textContent = '';
  });

  afterEach(() => {
    el.remove();
    vi.useRealTimers();
  });

  it('writes the message to the live region after a tick', async () => {
    announce('Hello screen reader');
    // Element is cleared synchronously, then set after a setTimeout.
    expect(el.textContent).toBe('');
    await vi.runAllTimersAsync();
    expect(el.textContent).toBe('Hello screen reader');
  });

  it('clears the element first to force re-announcement of repeated text', async () => {
    el.textContent = 'old text';
    announce('new text');
    expect(el.textContent).toBe('');
  });

  it('only delivers the last message when called twice within the delay window', async () => {
    announce('first message');
    announce('second message');
    await vi.runAllTimersAsync();
    expect(el.textContent).toBe('second message');
  });

  it('is a no-op when the live region is absent', () => {
    el.remove();
    expect(() => announce('test')).not.toThrow();
  });
});

describe('initAriaLive', () => {
  let el: HTMLElement;

  beforeEach(() => {
    vi.useFakeTimers();
    el = createRegion();
    el.textContent = '';
    eventBus.removeAllListeners();
    initAriaLive();
  });

  afterEach(() => {
    eventBus.removeAllListeners();
    el.remove();
    vi.useRealTimers();
  });

  it('announces quiz success on sfx:quiz_success', async () => {
    eventBus.emit('sfx:quiz_success');
    await vi.runAllTimersAsync();
    expect(el.textContent).toBe('Quiz passed!');
  });

  it('announces quiz fail on sfx:quiz_fail', async () => {
    eventBus.emit('sfx:quiz_fail');
    await vi.runAllTimersAsync();
    expect(el.textContent).toMatch(/failed/i);
  });

  it('announces floor unlock with floor name', async () => {
    eventBus.emit('progression:floor_unlocked', FLOORS.PLATFORM_TEAM);
    await vi.runAllTimersAsync();
    expect(el.textContent).toMatch(/platform team/i);
    expect(el.textContent).toMatch(/unlocked/i);
  });

  it('announces AU milestone with total count', async () => {
    eventBus.emit('progression:au_milestone', 50);
    await vi.runAllTimersAsync();
    expect(el.textContent).toContain('50');
    expect(el.textContent).toMatch(/architecture units/i);
  });
});
