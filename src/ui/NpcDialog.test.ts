import { describe, expect, it, vi, beforeEach } from 'vitest';
import type * as Phaser from 'phaser';

vi.mock('phaser', () => ({ default: {} }));

const getNpcQuestion = vi.hoisted(() => vi.fn(async () => ({
  source: 'fallback' as const,
  question: {
    id: 'q1',
    topic: 'architecture',
    question: 'Pick best trade-off?',
    options: ['A', 'B', 'C', 'D'],
    correctIndex: 1,
    explanation: 'Because B balances speed and risk.',
  },
})));
vi.mock('../systems/llm/LlmClient', () => ({ getNpcQuestion }));

const eventEmit = vi.hoisted(() => vi.fn());
vi.mock('../systems/EventBus', () => ({ eventBus: { emit: eventEmit } }));

vi.mock('./ModalKeyboardNavigator', () => ({
  ModalKeyboardNavigator: class {
    add = vi.fn();
    reset = vi.fn();
    setFocus = vi.fn();
    bind = vi.fn();
    destroy = vi.fn();
    focusPrev = vi.fn();
    focusNext = vi.fn();
    activateFocused = vi.fn();
  },
  makeTextFocusable: vi.fn((t: unknown) => t),
}));

vi.mock('./ModalBase', () => {
  class ModalBase {
    protected scene: Phaser.Scene;
    protected container: { length: number; add: (obj: unknown) => void; removeAt: (index: number) => void };
    constructor(scene: Phaser.Scene) {
      this.scene = scene;
      const items: unknown[] = [{}];
      this.container = {
        get length() {
          return items.length;
        },
        add: (obj: unknown) => {
          if (Array.isArray(obj)) items.push(...obj);
          else items.push(obj);
        },
        removeAt: (_index: number) => {
          items.pop();
        },
      };
    }
    protected fadeIn = vi.fn();
    close(): void {
      (this as unknown as { onBeforeClose?: () => void }).onBeforeClose?.();
      (this as unknown as { onAfterClose?: () => void }).onAfterClose?.();
    }
  }
  return { ModalBase };
});

import { NpcDialog } from './NpcDialog';

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

function makeScene() {
  const texts: Array<ReturnType<typeof makeText>> = [];
  return {
    add: {
      graphics: vi.fn(() => ({
        fillStyle: vi.fn().mockReturnThis(),
        fillRoundedRect: vi.fn().mockReturnThis(),
        lineStyle: vi.fn().mockReturnThis(),
        strokeRoundedRect: vi.fn().mockReturnThis(),
      })),
      text: vi.fn(() => {
        const text = makeText();
        texts.push(text);
        return text;
      }),
    },
    _texts: () => texts,
  } as unknown as Phaser.Scene;
}

describe('NpcDialog', () => {
  beforeEach(() => {
    eventEmit.mockClear();
    getNpcQuestion.mockClear();
  });

  it('loads question, handles correct answer, and closes with callback', async () => {
    const progression = { addAU: vi.fn() };
    const onClose = vi.fn();
    const scene = makeScene();
    const dialog = new NpcDialog(scene, {
      npcName: 'Ada',
      topic: 'architecture',
      floorId: 'platform-team' as never,
      progression: progression as never,
      onClose,
    });

    await Promise.resolve();
    await Promise.resolve();
    const allTexts = (scene as unknown as { _texts: () => Array<{ _trigger: (event: string) => void }> })._texts();
    for (const text of allTexts) {
      text._trigger('pointerover');
      text._trigger('pointerout');
    }
    (dialog as unknown as { answer: (index: number) => void }).answer(1);

    expect(getNpcQuestion).toHaveBeenCalled();
    expect(progression.addAU).toHaveBeenCalledWith('platform-team', 1);
    expect(eventEmit).toHaveBeenCalledWith('npc:answer:correct', { npcName: 'Ada', questionId: 'q1' });

    dialog.close();
    expect(eventEmit).toHaveBeenCalledWith('music:pop');
    expect(onClose).toHaveBeenCalled();
  });

  it('emits wrong-answer event when selected option is incorrect', async () => {
    const dialog = new NpcDialog(makeScene(), {
      npcName: 'Ada',
      topic: 'architecture',
      floorId: 'platform-team' as never,
      progression: { addAU: vi.fn() } as never,
    });
    await Promise.resolve();
    await Promise.resolve();

    (dialog as unknown as { answer: (index: number) => void }).answer(0);
    expect(eventEmit).toHaveBeenCalledWith('npc:answer:wrong', { npcName: 'Ada', questionId: 'q1' });
  });
});
