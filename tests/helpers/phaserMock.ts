/**
 * Minimal Phaser test double for unit-testing entity logic without booting
 * a real Phaser game. This intentionally only implements the surface area
 * used by the entity classes under test — extend as needed.
 *
 * Design notes:
 * - All getters/setters the code under test invokes must be present, but
 *   they can be stubs that just record their arguments.
 * - Prefer extracting pure helpers out of entities over growing this mock.
 */
import { vi } from 'vitest';

export interface FakeBody {
  velocity: { x: number; y: number };
  blocked: { up: boolean; down: boolean; left: boolean; right: boolean };
  touching: { up: boolean; down: boolean; left: boolean; right: boolean };
  enable: boolean;
  setAllowGravity: (allow: boolean) => FakeBody;
  setImmovable: (immovable: boolean) => FakeBody;
}

export function createFakeBody(): FakeBody {
  const body: FakeBody = {
    velocity: { x: 0, y: 0 },
    blocked: { up: false, down: false, left: false, right: false },
    touching: { up: false, down: false, left: false, right: false },
    enable: true,
    setAllowGravity: vi.fn(() => body),
    setImmovable: vi.fn(() => body),
  };
  return body;
}

export interface FakeSprite {
  x: number;
  y: number;
  body: FakeBody;
  anims: {
    play: (key: string, ignoreIfPlaying?: boolean) => FakeSprite;
    msPerFrame: number;
  };
  lastAnimKey: string | null;
  setDepth: (d: number) => FakeSprite;
  setPosition: (x: number, y: number) => FakeSprite;
  setVelocity: (x: number, y?: number) => FakeSprite;
  setVelocityX: (x: number) => FakeSprite;
  setVelocityY: (y: number) => FakeSprite;
  setSize: (w: number, h: number) => FakeSprite;
  setOffset: (x: number, y: number) => FakeSprite;
  setCollideWorldBounds: (b: boolean) => FakeSprite;
  setFlipX: (b: boolean) => FakeSprite;
  setAlpha: (a: number) => FakeSprite;
  setScale: (x: number, y?: number) => FakeSprite;
  setImmovable: (b: boolean) => FakeSprite;
  on: (event: string, handler: unknown, ctx?: unknown) => FakeSprite;
  destroy: () => void;
}

export function createFakeSprite(x = 0, y = 0, body: FakeBody = createFakeBody()): FakeSprite {
  const sprite: FakeSprite = {
    x,
    y,
    body,
    lastAnimKey: null,
    anims: {
      play: vi.fn(function (this: { lastAnimKey: string | null }, key: string) {
        sprite.lastAnimKey = key;
        return sprite;
      }) as unknown as FakeSprite['anims']['play'],
      msPerFrame: 100,
    },
    setDepth: vi.fn(() => sprite),
    setSize: vi.fn(() => sprite),
    setOffset: vi.fn(() => sprite),
    setCollideWorldBounds: vi.fn(() => sprite),
    setFlipX: vi.fn(() => sprite),
    setAlpha: vi.fn(() => sprite),
    setScale: vi.fn(() => sprite),
    setImmovable: vi.fn(() => sprite),
    on: vi.fn(() => sprite),
    destroy: vi.fn(),
    setPosition: vi.fn((nx: number, ny: number) => {
      sprite.x = nx;
      sprite.y = ny;
      return sprite;
    }),
    setVelocity: vi.fn((vx: number, vy = 0) => {
      sprite.body.velocity.x = vx;
      sprite.body.velocity.y = vy;
      return sprite;
    }),
    setVelocityX: vi.fn((vx: number) => {
      sprite.body.velocity.x = vx;
      return sprite;
    }),
    setVelocityY: vi.fn((vy: number) => {
      sprite.body.velocity.y = vy;
      return sprite;
    }),
  };
  return sprite;
}

interface PendingCall { at: number; cb: () => void }

export interface FakeScene {
  time: { now: number; delayedCall: (ms: number, cb: () => void) => void };
  tweens: { add: (config: Record<string, unknown>) => { stop: () => void; targets: unknown; onComplete?: () => void } };
  anims: {
    exists: (key: string) => boolean;
    create: (config: Record<string, unknown>) => void;
    generateFrameNumbers: (key: string, cfg: Record<string, unknown>) => unknown;
  };
  physics: {
    add: {
      image: (x: number, y: number, key: string) => FakeSprite;
      sprite: (x: number, y: number, key: string, frame?: number) => FakeSprite;
      existing: (obj: unknown, isStatic?: boolean) => void;
    };
  };
  add: {
    existing: (obj: unknown) => unknown;
    graphics: () => { clear: () => void; setDepth: (n: number) => unknown; lineStyle: (...a: unknown[]) => unknown; fillStyle: (...a: unknown[]) => unknown; fillRect: (...a: unknown[]) => unknown; strokeRect: (...a: unknown[]) => unknown; fillCircle: (...a: unknown[]) => unknown; strokeCircle: (...a: unknown[]) => unknown; fillTriangle: (...a: unknown[]) => unknown; lineBetween: (...a: unknown[]) => unknown };
    particles: () => { setDepth: (n: number) => unknown; setPosition: (x: number, y: number) => unknown; explode: (n: number) => unknown };
    image: (x: number, y: number, key: string) => { x: number; y: number; setDepth: (n: number) => unknown; setAlpha: (a: number) => unknown; setTint: (t: number) => unknown; setScale: (s: number) => unknown; setScrollFactor: (s: number) => unknown; destroy: () => void };
  };
  textures: { exists: (key: string) => boolean };
  inputs: { horizontal: () => number; justPressed: (action: string) => boolean };
  advanceTime: (ms: number) => void;
  runDelayedCalls: () => void;
}

export function createFakeScene(overrides: Partial<FakeScene> = {}): FakeScene {
  const pending: PendingCall[] = [];
  const graphicsStub = () => {
    const g = {
      clear: vi.fn(),
      setDepth: vi.fn(() => g),
      lineStyle: vi.fn(() => g),
      fillStyle: vi.fn(() => g),
      fillRect: vi.fn(() => g),
      strokeRect: vi.fn(() => g),
      fillCircle: vi.fn(() => g),
      strokeCircle: vi.fn(() => g),
      fillTriangle: vi.fn(() => g),
      lineBetween: vi.fn(() => g),
    };
    return g;
  };
  const scene: FakeScene = {
    time: {
      now: 0,
      delayedCall: (ms, cb) => { pending.push({ at: scene.time.now + ms, cb }); },
    },
    tweens: {
      add: vi.fn((config: Record<string, unknown>) => ({
        stop: vi.fn(),
        targets: config['targets'],
        onComplete: config['onComplete'] as (() => void) | undefined,
      })),
    },
    anims: {
      exists: () => false,
      create: vi.fn(),
      generateFrameNumbers: vi.fn(() => []),
    },
    physics: {
      add: {
        image: (x, y) => createFakeSprite(x, y),
        sprite: (x, y) => createFakeSprite(x, y),
        existing: vi.fn(),
      },
    },
    add: {
      existing: vi.fn((obj) => obj),
      graphics: graphicsStub,
      particles: () => ({
        setDepth: vi.fn(),
        setPosition: vi.fn(),
        explode: vi.fn(),
      }),
      image: (x: number, y: number, _key: string) => {
        const img = {
          x,
          y,
          setDepth: vi.fn(() => img),
          setAlpha: vi.fn(() => img),
          setTint: vi.fn(() => img),
          setScale: vi.fn(() => img),
          setScrollFactor: vi.fn(() => img),
          destroy: vi.fn(),
        };
        return img;
      },
    },
    textures: { exists: () => true },
    inputs: {
      horizontal: () => 0,
      justPressed: () => false,
    },
    advanceTime: (ms: number) => { scene.time.now += ms; },
    runDelayedCalls: () => {
      const ready = pending.filter((p) => p.at <= scene.time.now);
      for (const p of ready) p.cb();
      const remaining = pending.filter((p) => p.at > scene.time.now);
      pending.splice(0, pending.length, ...remaining);
    },
    ...overrides,
  };
  return scene;
}
