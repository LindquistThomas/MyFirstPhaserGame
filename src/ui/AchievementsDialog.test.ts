/**
 * Unit tests for AchievementsDialog.
 *
 * ModalBase and AchievementManager are stubbed so the dialog can be
 * constructed without a real Phaser scene or localStorage.  The full
 * ACHIEVEMENTS config array is used to ensure every rendering path
 * (unlocked / locked / secret) and the scroll-support branch are exercised.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type * as Phaser from 'phaser';

vi.mock('phaser', () => {
  const Phaser = {
    Math: {
      Clamp: (value: number, min: number, max: number) => Math.min(max, Math.max(min, value)),
    },
  };
  return { ...Phaser, default: Phaser };
});

// ---------------------------------------------------------------------------
// Stub ModalBase
// ---------------------------------------------------------------------------
vi.mock('./ModalBase', () => ({
  ModalBase: class MockModalBase {
    protected readonly scene: unknown;
    protected readonly container: {
      add: ReturnType<typeof vi.fn>;
      setDepth: ReturnType<typeof vi.fn>;
      setScrollFactor: ReturnType<typeof vi.fn>;
      setAlpha: ReturnType<typeof vi.fn>;
    };

    constructor(scene: unknown) {
      this.scene = scene;
      this.container = {
        add: vi.fn(),
        setDepth: vi.fn().mockReturnThis(),
        setScrollFactor: vi.fn().mockReturnThis(),
        setAlpha: vi.fn().mockReturnThis(),
      };
    }

    protected onBeforeClose(): void { /* stub */ }
    protected onAfterClose(): void { /* stub */ }
    protected fadeIn(): void { /* stub */ }

    close(): void {
      this.onBeforeClose();
      this.onAfterClose();
    }
  },
}));

// ---------------------------------------------------------------------------
// Stub AchievementManager
// ---------------------------------------------------------------------------
const mockUnlocked = vi.fn(() => [] as string[]);
vi.mock('../systems/AchievementManager', () => ({
  getUnlocked: () => mockUnlocked(),
}));

// ---------------------------------------------------------------------------
// Scene stub helpers
// ---------------------------------------------------------------------------

function makeGraphics() {
  const g: Record<string, ReturnType<typeof vi.fn>> = {};
  for (const name of [
    'fillStyle', 'fillRoundedRect', 'lineStyle', 'strokeRoundedRect',
    'fillRect', 'lineBetween', 'beginPath', 'arc', 'strokePath',
    'setScrollFactor', 'createGeometryMask',
  ]) {
    g[name] = vi.fn().mockReturnThis();
  }
  g['createGeometryMask'] = vi.fn(() => ({ geometryMask: true }));
  return g;
}

function makeText() {
  const handlers: Record<string, Array<() => void>> = {};
  const t: Record<string, unknown> = {};
  for (const name of [
    'setOrigin', 'setScrollFactor', 'setInteractive', 'setColor', 'destroy',
  ]) {
    t[name] = vi.fn().mockReturnThis();
  }
  t['on'] = vi.fn((event: string, handler: () => void) => {
    if (!handlers[event]) handlers[event] = [];
    handlers[event]!.push(handler);
    return t;
  });
  t['_fire'] = (event: string): void => {
    for (const h of handlers[event] ?? []) h();
  };
  return t;
}

function makeScrollContainer() {
  const c: Record<string, ReturnType<typeof vi.fn>> = {
    add: vi.fn().mockReturnThis(),
    setMask: vi.fn().mockReturnThis(),
  };
  // y is a settable property for scroll offset changes
  (c as unknown as { y: number }).y = 0;
  return c;
}

type InputHandler = () => void;
type WheelHandler = (
  _ptr: unknown, _over: unknown[], _dx: number, dy: number,
) => void;
type EventHandler = () => void;

function makeScene() {
  const inputHandlers: Map<string, InputHandler[]> = new Map();
  const onceHandlers: Map<string, EventHandler[]> = new Map();
  let wheelHandler: WheelHandler | null = null;
  const allText: ReturnType<typeof makeText>[] = [];
  const allScrollContainers: ReturnType<typeof makeScrollContainer>[] = [];

  return {
    add: {
      graphics: vi.fn(() => makeGraphics()),
      text: vi.fn(() => {
        const t = makeText();
        allText.push(t);
        return t;
      }),
      container: vi.fn((_x: number, _y: number) => {
        const c = makeScrollContainer();
        allScrollContainers.push(c);
        return c;
      }),
    },
    make: {
      graphics: vi.fn(() => makeGraphics()),
    },
    input: {
      on: vi.fn((_event: string, handler: WheelHandler) => {
        wheelHandler = handler;
      }),
      off: vi.fn(),
    },
    inputs: {
      on: vi.fn((action: string, handler: InputHandler) => {
        if (!inputHandlers.has(action)) inputHandlers.set(action, []);
        inputHandlers.get(action)!.push(handler);
      }),
      off: vi.fn((action: string, handler: InputHandler) => {
        const list = inputHandlers.get(action) ?? [];
        const idx = list.indexOf(handler);
        if (idx >= 0) list.splice(idx, 1);
      }),
    },
    events: {
      once: vi.fn((event: string, handler: EventHandler) => {
        if (!onceHandlers.has(event)) onceHandlers.set(event, []);
        onceHandlers.get(event)!.push(handler);
      }),
    },
    // helpers
    _fireInput: (action: string) => {
      for (const h of inputHandlers.get(action) ?? []) h();
    },
    _fireShutdown: () => {
      for (const h of onceHandlers.get('shutdown') ?? []) h();
    },
    _fireWheel: (dy: number) => {
      wheelHandler?.(null, [], 0, dy);
    },
    _texts: allText,
    _scrollContainers: allScrollContainers,
  };
}

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { AchievementsDialog } from './AchievementsDialog';
import { ACHIEVEMENTS } from '../config/achievements';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('AchievementsDialog', () => {
  beforeEach(() => {
    mockUnlocked.mockReturnValue([]);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('constructs without throwing (no unlocked achievements)', () => {
    const scene = makeScene();
    expect(() => new AchievementsDialog(scene as unknown as Phaser.Scene)).not.toThrow();
  });

  it('constructs without throwing (some achievements unlocked)', () => {
    mockUnlocked.mockReturnValue(['au-5', 'au-15']);
    const scene = makeScene();
    expect(() => new AchievementsDialog(scene as unknown as Phaser.Scene)).not.toThrow();
  });

  it('constructs without throwing (all non-secret achievements unlocked)', () => {
    mockUnlocked.mockReturnValue(ACHIEVEMENTS.map((a) => a.id));
    const scene = makeScene();
    expect(() => new AchievementsDialog(scene as unknown as Phaser.Scene)).not.toThrow();
  });

  it('adds text and graphics objects for title, count, and each achievement row', () => {
    const scene = makeScene();
    new AchievementsDialog(scene as unknown as Phaser.Scene);
    // At minimum: title + count + close button + labels + descriptions per row
    expect(scene.add.text).toHaveBeenCalled();
    expect(scene.add.graphics).toHaveBeenCalled();
  });

  it('renders the correct unlocked / total count in the subtitle', () => {
    mockUnlocked.mockReturnValue(['au-5', 'au-15']);
    const scene = makeScene();
    new AchievementsDialog(scene as unknown as Phaser.Scene);
    // Count text is the second text created (index 1)
    const countCall = (scene.add.text as ReturnType<typeof vi.fn>).mock.calls.find(
      (args) => typeof args[2] === 'string' && (args[2] as string).includes('/ '),
    );
    expect(countCall).toBeDefined();
    expect(countCall![2]).toBe(`2 / ${ACHIEVEMENTS.length} unlocked`);
  });

  it('calls the optional onClose callback when CLOSE button is clicked', () => {
    const scene = makeScene();
    const onClose = vi.fn();
    new AchievementsDialog(scene as unknown as Phaser.Scene, onClose);
    // The CLOSE button registers a pointerdown handler; fire it
    const closeBtnCall = (scene.add.text as ReturnType<typeof vi.fn>).mock.calls.find(
      (args) => typeof args[2] === 'string' && (args[2] as string).includes('CLOSE'),
    );
    expect(closeBtnCall).toBeDefined();
    // Find the matching text mock result
    const idx = (scene.add.text as ReturnType<typeof vi.fn>).mock.calls.indexOf(closeBtnCall!);
    const textObj = (scene.add.text as ReturnType<typeof vi.fn>).mock.results[idx]?.value as
      ReturnType<typeof makeText>;
    // Fire the pointerdown handler
    (textObj['_fire'] as (event: string) => void)('pointerdown');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('registers a wheel scroll handler when content overflows', () => {
    // With all 18 achievements the total content height exceeds the viewport
    const scene = makeScene();
    new AchievementsDialog(scene as unknown as Phaser.Scene);
    // scene.input.on('wheel', ...) should have been called
    expect(scene.input.on).toHaveBeenCalledWith('wheel', expect.any(Function));
  });

  it('registers PageUp and PageDown keyboard scroll handlers', () => {
    const scene = makeScene();
    new AchievementsDialog(scene as unknown as Phaser.Scene);
    expect(scene.inputs.on).toHaveBeenCalledWith('PageUp', expect.any(Function));
    expect(scene.inputs.on).toHaveBeenCalledWith('PageDown', expect.any(Function));
  });

  it('cleans up wheel and PageUp/PageDown handlers on scene shutdown', () => {
    const scene = makeScene();
    new AchievementsDialog(scene as unknown as Phaser.Scene);
    scene._fireShutdown();
    expect(scene.input.off).toHaveBeenCalledWith('wheel', expect.any(Function));
    expect(scene.inputs.off).toHaveBeenCalledWith('PageUp', expect.any(Function));
    expect(scene.inputs.off).toHaveBeenCalledWith('PageDown', expect.any(Function));
  });

  it('wheel scrolling moves the scroll content container', () => {
    const scene = makeScene();
    new AchievementsDialog(scene as unknown as Phaser.Scene);
    // Grab the scrollContent container (the one passed to add.container)
    const scrollContainer = scene._scrollContainers[0];
    expect(scrollContainer).toBeDefined();
    const initialY = (scrollContainer as unknown as { y: number }).y;
    // Fire the wheel with a positive dy — should increase scrollOffset
    scene._fireWheel(10);
    const afterY = (scrollContainer as unknown as { y: number }).y;
    // y should have changed (scrollOffset increased)
    expect(afterY).not.toBe(initialY);
  });

  it('PageDown increases scroll offset and PageUp decreases it', () => {
    const scene = makeScene();
    new AchievementsDialog(scene as unknown as Phaser.Scene);
    const scrollContainer = scene._scrollContainers[0];
    expect(scrollContainer).toBeDefined();

    // Fire PageDown to scroll down
    scene._fireInput('PageDown');
    const afterDown = (scrollContainer as unknown as { y: number }).y;

    // Fire PageUp to scroll back toward top
    scene._fireInput('PageUp');
    const afterUp = (scrollContainer as unknown as { y: number }).y;

    // After PageDown the container should be higher (y smaller); after PageUp it reverts
    expect(afterDown).toBeLessThan(afterUp);
  });

  it('secret locked achievements render label as "???"', () => {
    mockUnlocked.mockReturnValue([]); // nothing unlocked → secrets stay hidden
    const scene = makeScene();
    new AchievementsDialog(scene as unknown as Phaser.Scene);
    const secretLabels = (scene.add.text as ReturnType<typeof vi.fn>).mock.calls.filter(
      (args) => args[2] === '???',
    );
    // There are 4 secret achievements in the config
    const secretCount = ACHIEVEMENTS.filter((a) => a.secret).length;
    expect(secretLabels.length).toBe(secretCount);
  });

  it('constructs without throwing when no onClose callback is provided', () => {
    const scene = makeScene();
    expect(() => new AchievementsDialog(scene as unknown as Phaser.Scene)).not.toThrow();
  });
});
