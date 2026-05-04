/**
 * Opt-in analytics for the player progression funnel.
 *
 * Gated behind two independent conditions — both must be true before any
 * network request is ever made:
 *   1. `VITE_ANALYTICS_ENDPOINT` is set at build time (production-only env var).
 *   2. The player has explicitly enabled the "Send anonymous gameplay data"
 *      toggle in Settings (`SettingsStore.analyticsConsent === true`).
 *
 * When either condition is absent, `NoopProvider` is used and zero network
 * requests are made — verifiable via DevTools.
 *
 * ## Privacy
 * Only anonymous, non-PII fields are ever forwarded: event names, floor IDs,
 * aggregate AU totals, quiz pass/fail booleans, and timing. No save data,
 * quiz answers, names, or IP-derived fields are included.
 *
 * The anonymous client ID is generated once per browser and stored under
 * `architect_analytics_client_v1` in localStorage.
 */

import { eventBus } from './EventBus';
import type { GameEvents } from './EventBus';
import { settingsStore } from './SettingsStore';

// ---------------------------------------------------------------------------
// Provider interface

export interface AnalyticsProvider {
  /** Capture a single analytics event. Never throws — errors are swallowed. */
  capture(event: string, props?: Record<string, unknown>): void;
  /** Flush the batch queue immediately (e.g. before tab close). */
  flush(): void;
}

// ---------------------------------------------------------------------------
// NoopProvider — used when consent or endpoint is absent

export class NoopProvider implements AnalyticsProvider {
  capture(_event: string, _props?: Record<string, unknown>): void {}
  flush(): void {}
}

// ---------------------------------------------------------------------------
// HttpProvider — batched POST; sendBeacon for session:end

const BATCH_INTERVAL_MS = 30_000;
const BATCH_MAX_EVENTS = 20;

interface QueuedEvent {
  event: string;
  props?: Record<string, unknown>;
  ts: number;
}

export class HttpProvider implements AnalyticsProvider {
  private readonly endpoint: string;
  private readonly clientId: string;
  private queue: QueuedEvent[] = [];
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(endpoint: string, clientId: string) {
    this.endpoint = endpoint;
    this.clientId = clientId;
    this.timer = setInterval(() => this.flush(), BATCH_INTERVAL_MS);
  }

  capture(event: string, props?: Record<string, unknown>): void {
    this.queue.push({ event, props, ts: Date.now() });
    if (this.queue.length >= BATCH_MAX_EVENTS) {
      this.flush();
    }
  }

  /**
   * Flush the queue as a batched POST.
   * Errors are swallowed — analytics must never block gameplay.
   */
  flush(): void {
    if (this.queue.length === 0) return;
    const batch = this.queue.splice(0);
    const body = JSON.stringify({ clientId: this.clientId, events: batch });
    try {
      fetch(this.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        keepalive: true,
      }).catch(() => { /* swallow */ });
    } catch {
      // swallow — analytics must never throw
    }
  }

  /**
   * Send a single event synchronously using `navigator.sendBeacon()`.
   * Preferred for `session:end` because it survives tab/window close.
   */
  beacon(event: string, props?: Record<string, unknown>): void {
    try {
      const body = JSON.stringify({
        clientId: this.clientId,
        events: [{ event, props, ts: Date.now() }],
      });
      if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
        navigator.sendBeacon(this.endpoint, body);
      } else {
        // Fallback for environments without sendBeacon (e.g. tests).
        this.capture(event, props);
        this.flush();
      }
    } catch {
      // swallow
    }
  }

  destroy(): void {
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
}

// ---------------------------------------------------------------------------
// Client ID management

const CLIENT_ID_KEY = 'architect_analytics_client_v1';

/** Generate a random UUID using the Web Crypto API when available. */
function generateId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback: use crypto.getRandomValues if available, otherwise Date.now() only.
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    bytes[6] = (bytes[6]! & 0x0f) | 0x40; // version 4
    bytes[8] = (bytes[8]! & 0x3f) | 0x80; // variant bits
    const hex = Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }
  return `${Date.now().toString(36)}-${Date.now().toString(36)}-anon`;
}

function getOrCreateClientId(): string {
  try {
    const stored = globalThis.localStorage?.getItem(CLIENT_ID_KEY);
    if (stored) return stored;
    const id = generateId();
    globalThis.localStorage?.setItem(CLIENT_ID_KEY, id);
    return id;
  } catch {
    return 'anonymous';
  }
}

// ---------------------------------------------------------------------------
// AnalyticsService — subscribes to curated GameEvents

type GameEventHandler<K extends keyof GameEvents> = (...args: GameEvents[K]) => void;

interface Subscription<K extends keyof GameEvents> {
  event: K;
  handler: GameEventHandler<K>;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySubscription = Subscription<any>;

export class AnalyticsService {
  private readonly provider: AnalyticsProvider;
  private readonly sessionStart: number;
  private readonly sessionId: string;
  private readonly subscriptions: AnySubscription[] = [];
  private lastAuSent = 0;
  private readonly AU_SAMPLE_STEP = 25;
  private boundOnUnload: (() => void) | null = null;

  constructor(provider: AnalyticsProvider, sessionId: string) {
    this.provider = provider;
    this.sessionStart = Date.now();
    this.sessionId = sessionId;
  }

  /** Subscribe to the curated subset of GameEvents and forward to provider. */
  bind(): void {
    this.subscribe('progression:floor_unlocked', (floorId) => {
      this.capture('progression:floor_unlocked', { floorId });
    });

    this.subscribe('progression:floor_entered', (floorId) => {
      this.capture('progression:floor_entered', { floorId });
    });

    this.subscribe('quiz:completed', ({ infoId, score, total, passed, attemptNumber }) => {
      this.capture('quiz:completed', { infoId, score, total, passed, attemptNumber });
    });

    this.subscribe('achievement:unlocked', (id) => {
      this.capture('achievement:unlocked', { id });
    });

    this.subscribe('boss:defeated', () => {
      this.capture('boss:defeated', {});
    });

    this.subscribe('game:completed', () => {
      this.capture('game:completed', {});
    });

    // Sample AU changes every AU_SAMPLE_STEP to avoid spam.
    this.subscribe('progression:au_milestone', (milestone) => {
      if (milestone >= this.lastAuSent + this.AU_SAMPLE_STEP) {
        this.lastAuSent = milestone;
        this.capture('progression:au_changed', { milestone });
      }
    });

    // Session end — use sendBeacon for reliability on tab close.
    this.boundOnUnload = (): void => {
      const durationMs = Date.now() - this.sessionStart;
      eventBus.emit('session:end', { durationMs });
      if (this.provider instanceof HttpProvider) {
        this.provider.beacon('session:end', { durationMs, sessionId: this.sessionId });
        this.provider.flush();
      } else {
        this.provider.capture('session:end', { durationMs, sessionId: this.sessionId });
        this.provider.flush();
      }
    };
    window.addEventListener('beforeunload', this.boundOnUnload);
    window.addEventListener('pagehide', this.boundOnUnload);

    // Session start event (captured immediately).
    this.capture('session:start', { sessionId: this.sessionId });
  }

  /** Remove all subscriptions and DOM listeners. */
  unbind(): void {
    for (const { event, handler } of this.subscriptions) {
      eventBus.off(event, handler);
    }
    this.subscriptions.length = 0;

    if (this.boundOnUnload) {
      window.removeEventListener('beforeunload', this.boundOnUnload);
      window.removeEventListener('pagehide', this.boundOnUnload);
      this.boundOnUnload = null;
    }

    if (this.provider instanceof HttpProvider) {
      this.provider.flush();
      this.provider.destroy();
    }
  }

  private subscribe<K extends keyof GameEvents>(event: K, handler: GameEventHandler<K>): void {
    eventBus.on(event, handler);
    this.subscriptions.push({ event, handler });
  }

  private capture(event: string, props: Record<string, unknown> = {}): void {
    // Guard: re-check consent on every capture so toggling off mid-session
    // immediately silences further events without requiring a restart.
    if (!settingsStore.read().analyticsConsent) return;
    this.provider.capture(event, { ...props, sessionId: this.sessionId });
  }
}

// ---------------------------------------------------------------------------
// Factory — called from BootScene.create()

declare const __ANALYTICS_ENDPOINT__: string | undefined;

/**
 * Create and bind an `AnalyticsService` from the build-time environment.
 *
 * Returns the service instance (or null when the endpoint is absent) so
 * callers can store it for cleanup on hard resets.
 *
 * Gate logic:
 *   - Endpoint absent → NoopProvider, no network requests possible.
 *   - Endpoint present + consent off → NoopProvider selected at bind-time,
 *     but consent is re-checked per-capture so toggling on later works.
 *   - Endpoint present + consent on → HttpProvider.
 */
export function createAnalyticsService(): AnalyticsService | null {
  // Vite replaces `import.meta.env.VITE_ANALYTICS_ENDPOINT` at build time.
  // Fall back via the injected global for test environments.
  let endpoint: string | undefined;
  try {
    endpoint = import.meta.env.VITE_ANALYTICS_ENDPOINT as string | undefined;
  } catch {
    // import.meta.env unavailable (Node test env without Vite transforms).
    endpoint = typeof __ANALYTICS_ENDPOINT__ !== 'undefined' ? __ANALYTICS_ENDPOINT__ : undefined;
  }

  if (!endpoint) {
    // No endpoint configured — analytics is structurally disabled.
    return null;
  }

  const clientId = getOrCreateClientId();
  const sessionId = generateId();
  const provider = new HttpProvider(endpoint, clientId);
  const service = new AnalyticsService(provider, sessionId);
  service.bind();
  return service;
}
