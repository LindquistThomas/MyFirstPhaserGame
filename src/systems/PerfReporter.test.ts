import { describe, it, expect } from 'vitest';
import { PerfReporter } from './PerfReporter';
import type { PerfSample, PerfSampleSink } from './PerfReporter';

function makeSink() {
  const samples: PerfSample[] = [];
  const sink: PerfSampleSink = {
    capturePerfSample(sample) {
      samples.push(sample);
    },
  };
  return { sink, samples };
}

describe('PerfReporter', () => {
  it('computes mean fps and long frames from rolling windows and flushes at interval', () => {
    let now = 0;
    const { sink, samples } = makeSink();
    const reporter = new PerfReporter({
      sink,
      uaHint: 'test',
      getSceneKey: () => 'LobbyScene',
      now: () => now,
      rollingWindowMs: 1_000,
      flushIntervalMs: 60_000,
    });

    const frame = (dt: number) => {
      now += dt;
      reporter.onFrame();
    };

    frame(16);
    for (let i = 0; i < 49; i++) frame(20);
    frame(80);
    reporter.flush();

    expect(samples).toHaveLength(1);
    expect(samples[0]).toMatchObject({
      scene: 'LobbyScene',
      samples: 1,
      long_frames: 1,
      ua_hint: 'test',
    });
    expect(samples[0]!.mean_fps).toBeGreaterThan(45);
    expect(samples[0]!.mean_fps).toBeLessThan(55);
  });

  it('flushes pending sample when scene changes', () => {
    let now = 0;
    let scene = 'MenuScene';
    const { sink, samples } = makeSink();
    const reporter = new PerfReporter({
      sink,
      uaHint: 'test',
      getSceneKey: () => scene,
      now: () => now,
      rollingWindowMs: 200,
      flushIntervalMs: 60_000,
    });

    const frame = (dt: number) => {
      now += dt;
      reporter.onFrame();
    };

    frame(16);
    for (let i = 0; i < 12; i++) frame(16);
    scene = 'BossArenaScene';
    frame(16);

    expect(samples).toHaveLength(1);
    expect(samples[0]).toMatchObject({ scene: 'MenuScene', samples: 1, ua_hint: 'test' });
  });

  it('does not attribute transition gaps to the new scene', () => {
    let now = 0;
    let scene = 'MenuScene';
    const { sink, samples } = makeSink();
    const reporter = new PerfReporter({
      sink,
      uaHint: 'test',
      getSceneKey: () => scene,
      now: () => now,
      rollingWindowMs: 100,
      flushIntervalMs: 60_000,
    });

    const frame = (dt: number) => {
      now += dt;
      reporter.onFrame();
    };

    frame(16);
    frame(100);
    scene = 'BossArenaScene';
    frame(5_000);
    reporter.flush();

    expect(samples).toHaveLength(1);
    expect(samples[0]).toMatchObject({
      scene: 'MenuScene',
      samples: 1,
      long_frames: 1,
    });

    frame(16);
    frame(100);
    reporter.flush();

    expect(samples).toHaveLength(2);
    expect(samples[1]).toMatchObject({
      scene: 'BossArenaScene',
      samples: 1,
      long_frames: 1,
    });
    expect(samples[1]!.mean_fps).toBeGreaterThan(8);
  });

  it('caps emitted perf samples per session', () => {
    let now = 0;
    const { sink, samples } = makeSink();
    const reporter = new PerfReporter({
      sink,
      uaHint: 'test',
      getSceneKey: () => 'SceneA',
      now: () => now,
      rollingWindowMs: 100,
      flushIntervalMs: 1_000,
      maxSamplesPerSession: 3,
    });

    const frame = (dt: number) => {
      now += dt;
      reporter.onFrame();
    };

    frame(16);
    for (let i = 0; i < 100; i++) frame(100);

    expect(samples).toHaveLength(3);
  });

  it('flushes pending bucket during destroy()', () => {
    let now = 0;
    const { sink, samples } = makeSink();
    const reporter = new PerfReporter({
      sink,
      uaHint: 'test',
      getSceneKey: () => 'SceneA',
      now: () => now,
      rollingWindowMs: 100,
      flushIntervalMs: 60_000,
    });

    const frame = (dt: number) => {
      now += dt;
      reporter.onFrame();
    };

    frame(16);
    frame(100);
    reporter.destroy();
    reporter.destroy();

    expect(samples).toHaveLength(1);
  });

  it('does not emit when no complete sample window exists', () => {
    let now = 0;
    const { sink, samples } = makeSink();
    const reporter = new PerfReporter({
      sink,
      uaHint: 'test',
      getSceneKey: () => 'SceneA',
      now: () => now,
      rollingWindowMs: 1_000,
      flushIntervalMs: 1_000,
    });

    now += 16;
    reporter.onFrame();
    now += 16;
    reporter.onFrame();
    reporter.flush();

    expect(samples).toHaveLength(0);
  });
});
