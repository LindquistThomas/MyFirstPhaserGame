import { describe, it, expect, vi } from 'vitest';
import { FLOORS } from '../../config/gameConfig';
import { defaultSettings } from '../SettingsStore';
import { getNpcQuestion, validateNpcQuestionPayload } from './LlmClient';

function settings(overrides: Partial<ReturnType<typeof defaultSettings>> = {}) {
  return { ...defaultSettings(), ...overrides };
}

describe('LlmClient', () => {
  it('uses fallback bank when provider is disabled', async () => {
    const fetchFn = vi.fn();
    const result = await getNpcQuestion(FLOORS.PLATFORM_TEAM, 'platform architecture', {
      fetchFn: fetchFn as unknown as typeof fetch,
      settings: settings({ llmProvider: 'none', llmApiKey: '' }),
    });
    expect(result.source).toBe('fallback');
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('returns validated OpenAI JSON when configured', async () => {
    const fetchFn = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: JSON.stringify({
          question: 'What helps teams evolve systems safely?',
          options: ['No tests', 'Explicit contracts', 'Hidden coupling', 'Manual deploys'],
          correctIndex: 1,
          explanation: 'Contracts make expectations testable across boundaries.',
        }) } }],
      }),
    });
    const result = await getNpcQuestion(FLOORS.PLATFORM_TEAM, 'platform architecture', {
      fetchFn: fetchFn as unknown as typeof fetch,
      settings: settings({ llmProvider: 'openai', llmApiKey: 'sk-test' }),
    });
    expect(result.source).toBe('llm');
    expect(result.question.correctIndex).toBe(1);
    expect(fetchFn).toHaveBeenCalledWith(
      'https://api.openai.com/v1/chat/completions',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('falls back when provider response is malformed', async () => {
    const fetchFn = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: '{"question":"bad","options":["one"],"correctIndex":0}' } }] }),
    });
    const result = await getNpcQuestion(FLOORS.PLATFORM_TEAM, 'platform architecture', {
      fetchFn: fetchFn as unknown as typeof fetch,
      settings: settings({ llmProvider: 'openai', llmApiKey: 'sk-test' }),
    });
    expect(result.source).toBe('fallback');
  });

  it('falls back on HTTP errors', async () => {
    const fetchFn = vi.fn().mockResolvedValue({ ok: false, json: async () => ({}) });
    const result = await getNpcQuestion(FLOORS.PLATFORM_TEAM, 'platform architecture', {
      fetchFn: fetchFn as unknown as typeof fetch,
      settings: settings({ llmProvider: 'openai', llmApiKey: 'sk-test' }),
    });
    expect(result.source).toBe('fallback');
  });

  it('rejects duplicate options in LLM payloads', () => {
    const parsed = validateNpcQuestionPayload({
      question: 'Pick one',
      options: ['A', 'A', 'B', 'C'],
      correctIndex: 0,
      explanation: 'No duplicates.',
    }, FLOORS.PLATFORM_TEAM, 'platform architecture');
    expect(parsed).toBeNull();
  });
});
