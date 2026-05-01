import { vi } from 'vitest';

export type MockFn = ReturnType<typeof vi.fn>;

export function makeGraphicsMock() {
  const g: Record<string, unknown> = {};
  const chained = [
    'clear', 'fillStyle', 'fillCircle', 'fillRect', 'fillRoundedRect',
    'fillGradientStyle', 'lineStyle', 'beginPath', 'moveTo', 'lineTo',
    'strokePath', 'fillEllipse', 'arc', 'setPosition', 'setAlpha',
    'setVisible', 'setX', 'setScale',
  ];
  for (const name of chained) {
    g[name] = vi.fn().mockReturnThis();
  }
  (g as unknown as { scene: unknown }).scene = {};
  return g as unknown as {
    clear: MockFn; setPosition: MockFn; setAlpha: MockFn; setVisible: MockFn; setX: MockFn;
    fillStyle: MockFn; fillCircle: MockFn; fillRect: MockFn; fillRoundedRect: MockFn;
    lineStyle: MockFn; beginPath: MockFn; moveTo: MockFn; lineTo: MockFn; strokePath: MockFn;
    fillEllipse: MockFn; arc: MockFn; scene: unknown;
  };
}

export function makeTextMock(initialText = '') {
  const t: Record<string, unknown> = { text: initialText, x: 0, y: 0 };
  t.setOrigin = vi.fn().mockReturnValue(t);
  t.setText = vi.fn((s: string) => { (t as { text: string }).text = s; return t; });
  t.setScrollFactor = vi.fn().mockReturnValue(t);
  t.setDepth = vi.fn().mockReturnValue(t);
  t.setY = vi.fn((y: number) => { (t as { y: number }).y = y; return t; });
  t.setAlpha = vi.fn().mockReturnValue(t);
  t.setVisible = vi.fn().mockReturnValue(t);
  t.setStyle = vi.fn().mockReturnValue(t);
  t.destroy = vi.fn();
  return t as unknown as {
    text: string; x: number; y: number;
    setOrigin: MockFn; setText: MockFn; setScrollFactor: MockFn;
    setDepth: MockFn; setY: MockFn; setAlpha: MockFn; setVisible: MockFn;
    setStyle: MockFn; destroy: MockFn;
  };
}

export type FakeScene = ReturnType<typeof makeSceneMock>;

type Listener = (...args: unknown[]) => void;

export function makeSceneMock(muted = false) {
  const onceHandlers: Record<string, Listener[]> = {};
  const graphics: Array<ReturnType<typeof makeGraphicsMock>> = [];
  const zones: Array<{ setInteractive: MockFn; on: MockFn; zoneHandlers: Map<string, Listener> }> = [];

  return {
    add: {
      container: vi.fn(() => ({
        add: vi.fn(),
        setDepth: vi.fn().mockReturnThis(),
        setScrollFactor: vi.fn().mockReturnThis(),
        setAlpha: vi.fn().mockReturnThis(),
        setVisible: vi.fn().mockReturnThis(),
        alpha: 1,
      })),
      graphics: vi.fn(() => {
        const g = makeGraphicsMock();
        graphics.push(g);
        return g;
      }),
      text: vi.fn((_x: number, _y: number, text = '') => makeTextMock(text as string)),
      zone: vi.fn(() => {
        const zoneHandlers = new Map<string, Listener>();
        const z = {
          setInteractive: vi.fn().mockReturnThis(),
          on: vi.fn((event: string, handler: Listener) => {
            zoneHandlers.set(event, handler);
            return z;
          }),
          zoneHandlers,
        };
        zones.push(z);
        return z;
      }),
    },
    tweens: {
      add: vi.fn((cfg: Record<string, unknown>) => ({ stop: vi.fn(), ...cfg })),
    },
    time: {
      now: 0,
      delayedCall: vi.fn(),
      addEvent: vi.fn(),
    },
    registry: {
      get: vi.fn((key: string) => (key === 'audio' ? { isMuted: () => muted } : undefined)),
    },
    events: {
      once: vi.fn((event: string, handler: Listener) => {
        (onceHandlers[event] ??= []).push(handler);
      }),
      emit: (event: string) => {
        const handlers = onceHandlers[event] ?? [];
        onceHandlers[event] = [];
        handlers.forEach((fn) => fn());
      },
    },
    scale: {
      displaySize: { width: 1280 },
      on: vi.fn(),
      off: vi.fn(),
    },
    graphics,
    zones,
  };
}
