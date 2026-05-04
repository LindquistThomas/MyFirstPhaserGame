import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { eventBus } from './EventBus';
import { NoopProvider, HttpProvider, AnalyticsService } from './Analytics';
import type { AnalyticsProvider } from './Analytics';
import { settingsStore } from './SettingsStore';
import { FLOORS } from '../config/gameConfig';

// ---------------------------------------------------------------------------
// Helpers

function makeSessionId(): string {
  return 'test-session-' + Math.random().toString(36).slice(2);
}

/** Typed stub implementing AnalyticsProvider for test isolation. */
function makeMockProvider(): AnalyticsProvider & { captureCalls: Array<[string, Record<string, unknown>?]>; flushCount: number } {
  const captureCalls: Array<[string, Record<string, unknown>?]> = [];
  let flushCount = 0;
  return {
    captureCalls,
    get flushCount() { return flushCount; },
    capture(event: string, props?: Record<string, unknown>): void {
      captureCalls.push([event, props]);
    },
    flush(): void {
      flushCount++;
    },
  };
}

// ---------------------------------------------------------------------------

describe('NoopProvider', () => {
  it('capture() does nothing and does not throw', () => {
    const p = new NoopProvider();
    expect(() => p.capture('any:event', { foo: 1 })).not.toThrow();
  });

  it('flush() does nothing and does not throw', () => {
    const p = new NoopProvider();
    expect(() => p.flush()).not.toThrow();
  });
});

// ---------------------------------------------------------------------------

describe('HttpProvider', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(new Response())));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('batches events and flushes via fetch', () => {
    const provider = new HttpProvider('https://example.com/collect', 'client-1');
    provider.capture('session:start', { sessionId: 's1' });
    provider.capture('progression:floor_entered', { floorId: FLOORS.LOBBY });
    provider.flush();

    expect(fetch).toHaveBeenCalledOnce();
    const mockFetch = fetch as ReturnType<typeof vi.fn>;
    const [url, opts] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://example.com/collect');
    const body = JSON.parse(opts.body as string) as { clientId: string; events: unknown[] };
    expect(body.clientId).toBe('client-1');
    expect(body.events).toHaveLength(2);

    provider.destroy();
  });

  it('does not flush when queue is empty', () => {
    const provider = new HttpProvider('https://example.com/collect', 'client-1');
    provider.flush();
    expect(fetch).not.toHaveBeenCalled();
    provider.destroy();
  });

  it('auto-flushes when queue reaches BATCH_MAX_EVENTS (20)', () => {
    const provider = new HttpProvider('https://example.com/collect', 'client-1');
    for (let i = 0; i < 20; i++) {
      provider.capture(`event-${i}`);
    }
    // Should have flushed automatically at 20 events.
    expect(fetch).toHaveBeenCalledOnce();
    provider.destroy();
  });

  it('auto-flushes on timer interval', () => {
    const provider = new HttpProvider('https://example.com/collect', 'client-1');
    provider.capture('test:event');
    vi.advanceTimersByTime(30_001);
    expect(fetch).toHaveBeenCalledOnce();
    provider.destroy();
  });

  it('beacon() uses sendBeacon when available', () => {
    const mockBeacon = vi.fn(() => true);
    vi.stubGlobal('navigator', { sendBeacon: mockBeacon });

    const provider = new HttpProvider('https://example.com/collect', 'client-1');
    provider.beacon('session:end', { durationMs: 5000 });

    expect(mockBeacon).toHaveBeenCalledOnce();
    const call = mockBeacon.mock.calls[0] as unknown as [string, string];
    const [url, body] = call;
    expect(url).toBe('https://example.com/collect');
    const parsed = JSON.parse(body) as { clientId: string; events: Array<{ event: string }> };
    expect(parsed.events[0]?.event).toBe('session:end');

    provider.destroy();
  });

  it('beacon() falls back to capture+flush when sendBeacon unavailable', () => {
    vi.stubGlobal('navigator', {});

    const provider = new HttpProvider('https://example.com/collect', 'client-1');
    provider.beacon('session:end', { durationMs: 5000 });

    expect(fetch).toHaveBeenCalledOnce();
    provider.destroy();
  });

  it('swallows fetch errors silently', () => {
    const mockFetch = fetch as ReturnType<typeof vi.fn>;
    mockFetch.mockImplementation(() => Promise.reject(new Error('Network error')));
    const provider = new HttpProvider('https://example.com/collect', 'client-1');
    provider.capture('test:event');
    expect(() => provider.flush()).not.toThrow();
    provider.destroy();
  });
});

// ---------------------------------------------------------------------------

describe('AnalyticsService', () => {
  let mockProvider: ReturnType<typeof makeMockProvider>;

  beforeEach(() => {
    localStorage.clear();
    eventBus.removeAllListeners();
    settingsStore._store.setStorage(globalThis.localStorage);
    // Ensure analytics consent is off by default.
    settingsStore.setAnalyticsConsent(false);
    mockProvider = makeMockProvider();
  });

  afterEach(() => {
    eventBus.removeAllListeners();
    localStorage.clear();
  });

  it('does NOT call capture() when analyticsConsent is false', () => {
    const service = new AnalyticsService(mockProvider, makeSessionId());
    service.bind();

    // session:start should be suppressed
    expect(mockProvider.captureCalls).toHaveLength(0);

    // Emit a curated event
    eventBus.emit('progression:floor_entered', FLOORS.LOBBY);
    expect(mockProvider.captureCalls).toHaveLength(0);

    service.unbind();
  });

  it('calls capture() for curated events when analyticsConsent is true', () => {
    settingsStore.setAnalyticsConsent(true);

    const service = new AnalyticsService(mockProvider, makeSessionId());
    service.bind();

    // session:start is captured immediately in bind()
    expect(mockProvider.captureCalls[0]?.[0]).toBe('session:start');

    const beforeCount = mockProvider.captureCalls.length;
    eventBus.emit('progression:floor_entered', FLOORS.LOBBY);
    expect(mockProvider.captureCalls).toHaveLength(beforeCount + 1);
    const lastCall = mockProvider.captureCalls[mockProvider.captureCalls.length - 1];
    expect(lastCall?.[0]).toBe('progression:floor_entered');
    expect(lastCall?.[1]).toMatchObject({ floorId: FLOORS.LOBBY });

    service.unbind();
  });

  it('forwards progression:floor_unlocked', () => {
    settingsStore.setAnalyticsConsent(true);
    const service = new AnalyticsService(mockProvider, makeSessionId());
    service.bind();
    const before = mockProvider.captureCalls.length;

    eventBus.emit('progression:floor_unlocked', FLOORS.PLATFORM_TEAM);
    const newCall = mockProvider.captureCalls[before];
    expect(newCall?.[0]).toBe('progression:floor_unlocked');
    expect(newCall?.[1]).toMatchObject({ floorId: FLOORS.PLATFORM_TEAM });

    service.unbind();
  });

  it('forwards quiz:completed', () => {
    settingsStore.setAnalyticsConsent(true);
    const service = new AnalyticsService(mockProvider, makeSessionId());
    service.bind();
    const before = mockProvider.captureCalls.length;

    eventBus.emit('quiz:completed', { infoId: 'arch-101', score: 3, total: 4, passed: true, attemptNumber: 1 });
    const newCall = mockProvider.captureCalls[before];
    expect(newCall?.[0]).toBe('quiz:completed');
    expect(newCall?.[1]).toMatchObject({ infoId: 'arch-101', score: 3, total: 4, passed: true, attemptNumber: 1 });

    service.unbind();
  });

  it('forwards achievement:unlocked', () => {
    settingsStore.setAnalyticsConsent(true);
    const service = new AnalyticsService(mockProvider, makeSessionId());
    service.bind();
    const before = mockProvider.captureCalls.length;

    eventBus.emit('achievement:unlocked', 'au-5', 'Architecture Spark');
    const newCall = mockProvider.captureCalls[before];
    expect(newCall?.[0]).toBe('achievement:unlocked');
    expect(newCall?.[1]).toMatchObject({ id: 'au-5' });

    service.unbind();
  });

  it('forwards boss:defeated', () => {
    settingsStore.setAnalyticsConsent(true);
    const service = new AnalyticsService(mockProvider, makeSessionId());
    service.bind();
    const before = mockProvider.captureCalls.length;

    eventBus.emit('boss:defeated');
    expect(mockProvider.captureCalls[before]?.[0]).toBe('boss:defeated');

    service.unbind();
  });

  it('forwards game:completed', () => {
    settingsStore.setAnalyticsConsent(true);
    const service = new AnalyticsService(mockProvider, makeSessionId());
    service.bind();
    const before = mockProvider.captureCalls.length;

    eventBus.emit('game:completed');
    expect(mockProvider.captureCalls[before]?.[0]).toBe('game:completed');

    service.unbind();
  });

  it('samples progression:au_milestone every AU_SAMPLE_STEP (25)', () => {
    settingsStore.setAnalyticsConsent(true);
    const service = new AnalyticsService(mockProvider, makeSessionId());
    service.bind();

    const auCalls = () => mockProvider.captureCalls.filter(([e]) => e === 'progression:au_changed');

    // Milestone below sample step — not sent
    eventBus.emit('progression:au_milestone', 5);
    expect(auCalls()).toHaveLength(0);

    // Milestone at sample step — sent
    eventBus.emit('progression:au_milestone', 25);
    expect(auCalls()).toHaveLength(1);
    expect(auCalls()[0]?.[1]).toMatchObject({ milestone: 25 });

    // Same milestone again — not re-sent
    eventBus.emit('progression:au_milestone', 25);
    expect(auCalls()).toHaveLength(1);

    // Next step — sent
    eventBus.emit('progression:au_milestone', 50);
    expect(auCalls()).toHaveLength(2);

    service.unbind();
  });

  it('respects consent toggle mid-session (off → on)', () => {
    settingsStore.setAnalyticsConsent(false);
    const service = new AnalyticsService(mockProvider, makeSessionId());
    service.bind();

    // Emitting while consent is off → no capture
    eventBus.emit('progression:floor_entered', FLOORS.LOBBY);
    expect(mockProvider.captureCalls).toHaveLength(0);

    // Toggle consent on
    settingsStore.setAnalyticsConsent(true);

    // Now emitting should work
    eventBus.emit('progression:floor_entered', FLOORS.LOBBY);
    expect(mockProvider.captureCalls).toHaveLength(1);

    service.unbind();
  });

  it('cleans up subscriptions on unbind() — events no longer forwarded', () => {
    settingsStore.setAnalyticsConsent(true);
    const service = new AnalyticsService(mockProvider, makeSessionId());
    service.bind();
    service.unbind();
    const afterUnbind = mockProvider.captureCalls.length;

    eventBus.emit('progression:floor_entered', FLOORS.LOBBY);
    expect(mockProvider.captureCalls).toHaveLength(afterUnbind);
  });

  it('includes sessionId in every captured event', () => {
    settingsStore.setAnalyticsConsent(true);
    const sid = makeSessionId();
    const service = new AnalyticsService(mockProvider, sid);
    service.bind();

    // First call is session:start
    expect(mockProvider.captureCalls[0]?.[1]).toMatchObject({ sessionId: sid });

    const before = mockProvider.captureCalls.length;
    eventBus.emit('progression:floor_entered', FLOORS.LOBBY);
    expect(mockProvider.captureCalls[before]?.[1]).toMatchObject({ sessionId: sid });

    service.unbind();
  });

  it('does not call capture() when consent is false — verified zero network requests', () => {
    settingsStore.setAnalyticsConsent(false);
    const spyCapture = vi.spyOn(mockProvider, 'capture');
    const service = new AnalyticsService(mockProvider, makeSessionId());
    service.bind();

    eventBus.emit('progression:floor_entered', FLOORS.LOBBY);
    eventBus.emit('achievement:unlocked', 'au-5', 'Test');
    eventBus.emit('quiz:completed', { infoId: 'test', score: 3, total: 4, passed: true, attemptNumber: 1 });

    expect(spyCapture).not.toHaveBeenCalled();

    service.unbind();
  });
});
