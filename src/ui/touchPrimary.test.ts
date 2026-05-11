/**
 * Unit tests for touchPrimary.ts
 *
 * Covers:
 *   (a) localStorage "true" override returns true regardless of touch detection.
 *   (b) localStorage "false" override returns false regardless of touch detection.
 *   (c) No override + jsdom defaults → false (jsdom has no touch events).
 *   (d) No override + ontouchstart present + coarse pointer → true.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('isTouchPrimary', () => {
  let localStorageMock: Record<string, string | null>;

  beforeEach(async () => {
    localStorageMock = {};
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(
      (key: string) => localStorageMock[key] ?? null,
    );
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(
      (key: string, value: string) => { localStorageMock[key] = value; },
    );
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(
      (key: string) => { delete localStorageMock[key]; },
    );
    // Force module re-evaluation since the function reads localStorage on every call.
    vi.resetModules();
  });

  it('(a) localStorage "true" override returns true', async () => {
    localStorageMock['architect_touch_override_v1'] = 'true';
    const { isTouchPrimary } = await import('./touchPrimary');
    expect(isTouchPrimary()).toBe(true);
  });

  it('(b) localStorage "false" override returns false', async () => {
    localStorageMock['architect_touch_override_v1'] = 'false';
    const { isTouchPrimary } = await import('./touchPrimary');
    expect(isTouchPrimary()).toBe(false);
  });

  it('(c) no override — defaults to false in jsdom (no ontouchstart)', async () => {
    // jsdom does not define window.ontouchstart by default
    delete (window as unknown as Record<string, unknown>)['ontouchstart'];
    const { isTouchPrimary } = await import('./touchPrimary');
    expect(isTouchPrimary()).toBe(false);
  });

  it('(d) no override + ontouchstart + coarse pointer → true', async () => {
    // Simulate a touch-primary environment
    (window as unknown as Record<string, unknown>)['ontouchstart'] = null;
    // jsdom may not have matchMedia; define it returning coarse pointer
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      configurable: true,
      value: (_query: string): MediaQueryList =>
        ({ matches: false } as unknown as MediaQueryList),
    });

    const { isTouchPrimary } = await import('./touchPrimary');
    expect(isTouchPrimary()).toBe(true);

    // Cleanup
    delete (window as unknown as Record<string, unknown>)['ontouchstart'];
  });
});
