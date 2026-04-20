import { describe, it, expect, vi, beforeEach } from 'vitest';
import { startPillarboxBackdrop } from './pillarboxBackdrop';

interface FakeCanvas {
  id?: string;
  width: number;
  height: number;
  style: Record<string, string>;
  getContext: (type: string) => { drawImage: ReturnType<typeof vi.fn> } | null;
}

function makeFakeCanvas(id: string): FakeCanvas {
  return {
    id,
    width: 0,
    height: 0,
    style: {},
    getContext: vi.fn(() => ({ drawImage: vi.fn() })),
  };
}

function makeEnv(
  viewport = { w: 1920, h: 1080, dpr: 1 },
  withBgCanvas = true,
): {
  win: Window;
  doc: Document;
  bg: FakeCanvas | null;
  src: FakeCanvas;
  rafCallbacks: FrameRequestCallback[];
  runRaf: (t: number) => void;
  resizeListeners: (() => void)[];
  scaleListeners: Record<string, (() => void)[]>;
  fireResize: () => void;
  firePhaserResize: () => void;
} {
  const bg = withBgCanvas ? makeFakeCanvas('pillarbox-bg') : null;
  const src = makeFakeCanvas('game-canvas');
  src.width = 1280;
  src.height = 960;

  const rafCallbacks: FrameRequestCallback[] = [];
  const resizeListeners: (() => void)[] = [];

  const win = {
    innerWidth: viewport.w,
    innerHeight: viewport.h,
    devicePixelRatio: viewport.dpr,
    requestAnimationFrame: vi.fn((cb: FrameRequestCallback) => {
      rafCallbacks.push(cb);
      return rafCallbacks.length;
    }),
    cancelAnimationFrame: vi.fn(),
    addEventListener: vi.fn((ev: string, cb: () => void) => {
      if (ev === 'resize') resizeListeners.push(cb);
    }),
    removeEventListener: vi.fn((ev: string, cb: () => void) => {
      if (ev === 'resize') {
        const i = resizeListeners.indexOf(cb);
        if (i >= 0) resizeListeners.splice(i, 1);
      }
    }),
  } as unknown as Window;

  const doc = {
    getElementById: vi.fn((id: string) => (id === 'pillarbox-bg' ? bg : null)),
  } as unknown as Document;

  const runRaf = (t: number) => {
    const pending = rafCallbacks.splice(0);
    for (const cb of pending) cb(t);
  };

  const scaleListeners: Record<string, (() => void)[]> = {};

  return {
    win,
    doc,
    bg,
    src,
    rafCallbacks,
    runRaf,
    resizeListeners,
    scaleListeners,
    fireResize: () => resizeListeners.slice().forEach((cb) => cb()),
    firePhaserResize: () => (scaleListeners.resize ?? []).slice().forEach((cb) => cb()),
  };
}

describe('startPillarboxBackdrop', () => {
  beforeEach(() => vi.clearAllMocks());

  it('sizes the backdrop canvas to viewport × DPR', () => {
    const env = makeEnv({ w: 1920, h: 1080, dpr: 2 });
    const scale = { on: vi.fn(), off: vi.fn() };
    startPillarboxBackdrop(
      { canvas: env.src as unknown as HTMLCanvasElement, scale },
      { win: env.win, doc: env.doc },
    );
    expect(env.bg!.width).toBe(3840);
    expect(env.bg!.height).toBe(2160);
    expect(env.bg!.style.width).toBe('1920px');
    expect(env.bg!.style.height).toBe('1080px');
  });

  it('draws immediately and schedules an rAF tick', () => {
    const env = makeEnv();
    const ctx = { drawImage: vi.fn() };
    env.bg!.getContext = vi.fn(() => ctx);
    startPillarboxBackdrop(
      { canvas: env.src as unknown as HTMLCanvasElement },
      { win: env.win, doc: env.doc },
    );
    expect(ctx.drawImage).toHaveBeenCalledTimes(1);
    expect(env.win.requestAnimationFrame).toHaveBeenCalledTimes(1);
  });

  it('throttles draws to at most one per throttleMs', () => {
    const env = makeEnv();
    const ctx = { drawImage: vi.fn() };
    env.bg!.getContext = vi.fn(() => ctx);
    startPillarboxBackdrop(
      { canvas: env.src as unknown as HTMLCanvasElement },
      { win: env.win, doc: env.doc, throttleMs: 100 },
    );
    // initial draw
    expect(ctx.drawImage).toHaveBeenCalledTimes(1);
    // tick at 50ms — under throttle, no new draw
    env.runRaf(50);
    expect(ctx.drawImage).toHaveBeenCalledTimes(1);
    // tick at 150ms — over throttle, new draw
    env.runRaf(150);
    expect(ctx.drawImage).toHaveBeenCalledTimes(2);
    // tick at 180ms — under next throttle window, no new draw
    env.runRaf(180);
    expect(ctx.drawImage).toHaveBeenCalledTimes(2);
  });

  it('stop() cancels rAF and removes listeners', () => {
    const env = makeEnv();
    const scale = { on: vi.fn(), off: vi.fn() };
    const h = startPillarboxBackdrop(
      { canvas: env.src as unknown as HTMLCanvasElement, scale },
      { win: env.win, doc: env.doc },
    );
    expect(env.resizeListeners.length).toBe(1);
    h.stop();
    expect(env.win.cancelAnimationFrame).toHaveBeenCalled();
    expect(env.resizeListeners.length).toBe(0);
    expect(scale.off).toHaveBeenCalledWith('resize', expect.any(Function));
    // Subsequent ticks are no-ops.
    const ctx = env.bg!.getContext('2d') as { drawImage: ReturnType<typeof vi.fn> };
    const before = ctx.drawImage.mock.calls.length;
    env.runRaf(1000);
    expect(ctx.drawImage.mock.calls.length).toBe(before);
  });

  it('resize handler rescales the backdrop to new viewport', () => {
    const env = makeEnv({ w: 1000, h: 800, dpr: 1 });
    startPillarboxBackdrop(
      { canvas: env.src as unknown as HTMLCanvasElement },
      { win: env.win, doc: env.doc },
    );
    expect(env.bg!.width).toBe(1000);
    (env.win as unknown as { innerWidth: number }).innerWidth = 2400;
    (env.win as unknown as { innerHeight: number }).innerHeight = 1350;
    env.fireResize();
    expect(env.bg!.width).toBe(2400);
    expect(env.bg!.height).toBe(1350);
  });

  it('returns a no-op handle if #pillarbox-bg is missing', () => {
    const env = makeEnv(undefined, false);
    const h = startPillarboxBackdrop(
      { canvas: env.src as unknown as HTMLCanvasElement },
      { win: env.win, doc: env.doc },
    );
    expect(env.win.requestAnimationFrame).not.toHaveBeenCalled();
    h.stop(); // does not throw
  });

  it('drawImage exceptions are swallowed', () => {
    const env = makeEnv();
    const ctx = {
      drawImage: vi.fn(() => {
        throw new Error('context lost');
      }),
    };
    env.bg!.getContext = vi.fn(() => ctx);
    expect(() =>
      startPillarboxBackdrop(
        { canvas: env.src as unknown as HTMLCanvasElement },
        { win: env.win, doc: env.doc },
      ),
    ).not.toThrow();
  });
});
