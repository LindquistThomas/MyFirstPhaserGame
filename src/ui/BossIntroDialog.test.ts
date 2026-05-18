import { describe, expect, it, vi } from 'vitest';
import type * as Phaser from 'phaser';
import { promptLabel } from '../input';
import { BossIntroDialog } from './BossIntroDialog';

vi.mock('phaser', () => ({ default: {} }));
vi.mock('../input', () => ({
  promptLabel: vi.fn((action: string) => {
    if (action === 'Attack') return 'X';
    if (action === 'Jump') return 'Space';
    if (action === 'MoveLeft') return 'A';
    if (action === 'MoveRight') return 'D';
    return 'Enter';
  }),
  pushContext: vi.fn(() => 'token'),
  popContext: vi.fn(),
}));

function makeText() {
  const handlers: Record<string, () => void> = {};
  const obj = {
    setOrigin: vi.fn().mockReturnThis(),
    setScrollFactor: vi.fn().mockReturnThis(),
    setInteractive: vi.fn().mockReturnThis(),
    setColor: vi.fn().mockReturnThis(),
    on: vi.fn((event: string, cb: () => void) => {
      handlers[event] = cb;
      return obj;
    }),
    _trigger: (event: string) => handlers[event]?.(),
  };
  return obj;
}

function makeGraphics() {
  return {
    fillStyle: vi.fn().mockReturnThis(),
    fillRoundedRect: vi.fn().mockReturnThis(),
    lineStyle: vi.fn().mockReturnThis(),
    strokeRoundedRect: vi.fn().mockReturnThis(),
    fillRect: vi.fn().mockReturnThis(),
  };
}

describe('BossIntroDialog', () => {
  it('renders intro card and wires confirm shortcut', () => {
    const complete = vi.fn();
    const scene = {
      add: {
        existing: vi.fn(),
        container: vi.fn(() => ({
          add: vi.fn(),
          setDepth: vi.fn().mockReturnThis(),
          setScrollFactor: vi.fn().mockReturnThis(),
          setAlpha: vi.fn().mockReturnThis(),
          removeAll: vi.fn(),
          destroy: vi.fn(),
        })),
        rectangle: vi.fn(() => ({
          setDepth: vi.fn().mockReturnThis(),
          setScrollFactor: vi.fn().mockReturnThis(),
          setInteractive: vi.fn().mockReturnThis(),
          on: vi.fn().mockReturnThis(),
          destroy: vi.fn(),
        })),
        graphics: vi.fn(() => makeGraphics()),
        text: vi.fn(() => makeText()),
      },
      tweens: { add: vi.fn((cfg: { onComplete?: () => void }) => cfg.onComplete?.()) },
      inputs: {
        on: vi.fn(),
        off: vi.fn(),
        justPressed: vi.fn(() => false),
      },
      events: { once: vi.fn(), off: vi.fn() },
      scale: { on: vi.fn(), off: vi.fn() },
      cameras: { main: { width: 1280, height: 720 } },
    } as unknown as Phaser.Scene;

    const dialog = new BossIntroDialog(scene, complete);
    expect(scene.inputs.on).toHaveBeenCalledWith('Confirm', expect.any(Function));

    const confirmHandler = (scene.inputs.on as ReturnType<typeof vi.fn>).mock.calls[0]?.[1] as (() => void) | undefined;
    const createdTexts = (scene.add.text as ReturnType<typeof vi.fn>).mock.results
      .map((r) => (r as { value?: { _trigger?: (event: string) => void } }).value)
      .filter((v): v is { _trigger?: (event: string) => void } => Boolean(v));
    for (const text of createdTexts) {
      text._trigger?.('pointerover');
      text._trigger?.('pointerout');
      text._trigger?.('pointerdown');
    }
    confirmHandler?.();
    expect(scene.inputs.off).toHaveBeenCalledWith('Confirm', expect.any(Function));
    expect(complete).toHaveBeenCalled();
    expect(dialog).toBeDefined();
  });

  it('renders compact move hint when left/right labels match', () => {
    const promptLabelMock = promptLabel as unknown as ReturnType<typeof vi.fn>;
    promptLabelMock.mockImplementation((action: string) => {
      if (action === 'Attack') return 'X';
      if (action === 'Jump') return 'Space';
      if (action === 'MoveLeft' || action === 'MoveRight') return 'Arrows';
      return 'Enter';
    });

    const scene = {
      add: {
        existing: vi.fn(),
        container: vi.fn(() => ({
          add: vi.fn(),
          setDepth: vi.fn().mockReturnThis(),
          setScrollFactor: vi.fn().mockReturnThis(),
          setAlpha: vi.fn().mockReturnThis(),
          removeAll: vi.fn(),
          destroy: vi.fn(),
        })),
        rectangle: vi.fn(() => ({
          setDepth: vi.fn().mockReturnThis(),
          setScrollFactor: vi.fn().mockReturnThis(),
          setInteractive: vi.fn().mockReturnThis(),
          on: vi.fn().mockReturnThis(),
          destroy: vi.fn(),
        })),
        graphics: vi.fn(() => makeGraphics()),
        text: vi.fn(() => makeText()),
      },
      tweens: { add: vi.fn((cfg: { onComplete?: () => void }) => cfg.onComplete?.()) },
      inputs: {
        on: vi.fn(),
        off: vi.fn(),
        justPressed: vi.fn(() => false),
      },
      events: { once: vi.fn(), off: vi.fn() },
      scale: { on: vi.fn(), off: vi.fn() },
      cameras: { main: { width: 1280, height: 720 } },
    } as unknown as Phaser.Scene;

    const dialog = new BossIntroDialog(scene, vi.fn()) as unknown as {
      onBeforeClose: () => void;
      confirmHandler: (() => void) | null;
    };
    const controlsText = (scene.add.text as ReturnType<typeof vi.fn>).mock.calls
      .map((call) => call[2])
      .find((value): value is string => typeof value === 'string' && value.includes('Move'));
    expect(controlsText).toContain('Arrows');

    dialog.confirmHandler = null;
    expect(() => dialog.onBeforeClose()).not.toThrow();
  });
});
