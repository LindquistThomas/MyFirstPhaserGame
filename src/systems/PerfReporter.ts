import * as Phaser from 'phaser';

const DEFAULT_LONG_FRAME_MS = 50;
const DEFAULT_ROLLING_WINDOW_MS = 1_000;
const DEFAULT_FLUSH_INTERVAL_MS = 60_000;
const DEFAULT_MAX_SAMPLES_PER_SESSION = 12;

export interface PerfSample {
  scene: string;
  mean_fps: number;
  long_frames: number;
  samples: number;
  ua_hint: string;
}

export interface PerfSampleSink {
  capturePerfSample(sample: PerfSample): void;
}

export interface PerfReporterOptions {
  sink: PerfSampleSink;
  getSceneKey: () => string;
  now?: () => number;
  uaHint?: string;
  longFrameMs?: number;
  rollingWindowMs?: number;
  flushIntervalMs?: number;
  maxSamplesPerSession?: number;
}

export class PerfReporter {
  private readonly sink: PerfSampleSink;
  private readonly getSceneKey: () => string;
  private readonly now: () => number;
  private readonly uaHint: string;
  private readonly longFrameMs: number;
  private readonly rollingWindowMs: number;
  private readonly flushIntervalMs: number;
  private readonly maxSamplesPerSession: number;

  private activeScene: string;
  private lastFrameAt: number | null = null;
  private lastFlushAt: number;
  private windowElapsedMs = 0;
  private windowFrames = 0;
  private windowLongFrames = 0;
  private bucketFpsSum = 0;
  private bucketSamples = 0;
  private bucketLongFrames = 0;
  private sentSamples = 0;
  private destroyed = false;

  constructor(options: PerfReporterOptions) {
    this.sink = options.sink;
    this.getSceneKey = options.getSceneKey;
    this.now = options.now ?? (() => performance.now());
    this.uaHint = options.uaHint ?? getUserAgentHint();
    this.longFrameMs = options.longFrameMs ?? DEFAULT_LONG_FRAME_MS;
    this.rollingWindowMs = options.rollingWindowMs ?? DEFAULT_ROLLING_WINDOW_MS;
    this.flushIntervalMs = options.flushIntervalMs ?? DEFAULT_FLUSH_INTERVAL_MS;
    this.maxSamplesPerSession = options.maxSamplesPerSession ?? DEFAULT_MAX_SAMPLES_PER_SESSION;
    this.activeScene = this.getSceneKey() || 'unknown';
    this.lastFlushAt = this.now();
  }

  onFrame(): void {
    if (this.destroyed || this.sentSamples >= this.maxSamplesPerSession) return;

    const t = this.now();
    const currentScene = this.getSceneKey() || 'unknown';
    if (currentScene !== this.activeScene) {
      this.finalizeWindow();
      this.flush();
      this.activeScene = currentScene;
      this.lastFrameAt = t;
      return;
    }

    if (this.lastFrameAt !== null) {
      const dt = Math.max(0, t - this.lastFrameAt);
      this.windowElapsedMs += dt;
      this.windowFrames += 1;
      if (dt > this.longFrameMs) this.windowLongFrames += 1;
      if (this.windowElapsedMs >= this.rollingWindowMs) this.finalizeWindow();
      if (t - this.lastFlushAt >= this.flushIntervalMs) this.flush();
    }

    this.lastFrameAt = t;
  }

  flush(): void {
    if (this.destroyed || this.sentSamples >= this.maxSamplesPerSession || this.bucketSamples === 0) {
      this.lastFlushAt = this.now();
      return;
    }

    this.sink.capturePerfSample({
      scene: this.activeScene,
      mean_fps: round2(this.bucketFpsSum / this.bucketSamples),
      long_frames: this.bucketLongFrames,
      samples: this.bucketSamples,
      ua_hint: this.uaHint,
    });
    this.sentSamples += 1;
    this.bucketFpsSum = 0;
    this.bucketSamples = 0;
    this.bucketLongFrames = 0;
    this.lastFlushAt = this.now();
  }

  destroy(): void {
    if (this.destroyed) return;
    this.finalizeWindow();
    this.flush();
    this.destroyed = true;
  }

  private finalizeWindow(): void {
    if (this.windowFrames === 0 || this.windowElapsedMs <= 0) {
      this.windowElapsedMs = 0;
      this.windowFrames = 0;
      this.windowLongFrames = 0;
      return;
    }

    const fps = (this.windowFrames * 1_000) / this.windowElapsedMs;
    this.bucketFpsSum += fps;
    this.bucketSamples += 1;
    this.bucketLongFrames += this.windowLongFrames;
    this.windowElapsedMs = 0;
    this.windowFrames = 0;
    this.windowLongFrames = 0;
  }
}

export interface PerfReporterHandle {
  destroy(): void;
}

export function createGamePerfReporter(
  game: Phaser.Game,
  sink: PerfSampleSink,
): PerfReporterHandle {
  const reporter = new PerfReporter({
    sink,
    getSceneKey: () => getActiveSceneKey(game),
  });
  const onPreRender = (): void => {
    reporter.onFrame();
  };
  game.events.on('prerender', onPreRender);
  return {
    destroy: () => {
      game.events.off('prerender', onPreRender);
      reporter.destroy();
    },
  };
}

function getActiveSceneKey(game: Phaser.Game): string {
  const active = game.scene.getScenes(true);
  const scene = active[active.length - 1];
  return scene?.scene.key ?? 'unknown';
}

function getUserAgentHint(): string {
  if (typeof navigator === 'undefined') return 'unknown';
  const uaData = (navigator as Navigator & { userAgentData?: { mobile?: boolean; platform?: string } }).userAgentData;
  if (uaData) {
    const platform = uaData.platform || 'unknown';
    return uaData.mobile ? `${platform}:mobile` : `${platform}:desktop`;
  }
  return navigator.platform || 'unknown';
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
