import { type FloorId } from '../../config/gameConfig';
import { getRandomNpcQuestion, type NpcQuestion } from '../../config/npcQuestionBank';
import { settingsStore, type SettingsData } from '../SettingsStore';

export interface NpcQuestionResult {
  question: NpcQuestion;
  source: 'llm' | 'fallback';
}

export interface LlmClientOptions {
  fetchFn?: typeof fetch;
  timeoutMs?: number;
  settings?: SettingsData;
}

type OpenAiChoice = { message?: { content?: unknown } };
type OpenAiResponse = { choices?: OpenAiChoice[] };

const DEFAULT_TIMEOUT_MS = 10_000;
const MAX_TEXT_LEN = 600;
export const OPENAI_CHAT_COMPLETIONS_ENDPOINT = 'https://api.openai.com/v1/chat/completions';
export const OPENAI_NPC_MODEL = 'gpt-4o-mini';
/**
 * Contract for NPC questions: exactly four choices keeps the dialog layout
 * stable and matches existing quiz shortcuts (1–4); `correctIndex` is 0-based
 * so it can be used directly with the returned options array.
 */
export const OPENAI_NPC_SYSTEM_PROMPT = 'Return only JSON for a software architecture multiple-choice question. Shape: {"question":"...","options":["...","...","...","..."],"correctIndex":0,"explanation":"..."}. Keep it concise and practical.';

function sanitizeText(value: unknown, fallback: string, max = MAX_TEXT_LEN): string {
  if (typeof value !== 'string') return fallback;
  const trimmed = value.replace(/\s+/g, ' ').trim();
  return trimmed.length > 0 ? trimmed.slice(0, max) : fallback;
}

function parseCorrectIndex(value: unknown): 0 | 1 | 2 | 3 | null {
  if (typeof value !== 'number' || !Number.isInteger(value)) return null;
  if (value < 0 || value > 3) return null;
  return value as 0 | 1 | 2 | 3;
}

export function validateNpcQuestionPayload(raw: unknown, floorId: FloorId, topic: string): NpcQuestion | null {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  const optionsRaw = r['options'];
  if (!Array.isArray(optionsRaw) || optionsRaw.length !== 4) return null;
  const options = optionsRaw.map((o, i) => sanitizeText(o, `Option ${i + 1}`, 120));
  if (new Set(options).size !== 4) return null;
  const correctIndex = parseCorrectIndex(r['correctIndex']);
  if (correctIndex === null) return null;
  return {
    id: `llm-${Date.now()}-${Math.floor(Math.random() * 100_000)}`,
    floorId,
    topic,
    question: sanitizeText(r['question'], 'Which architecture choice best balances delivery speed and long-term maintainability?'),
    options: [options[0]!, options[1]!, options[2]!, options[3]!] as const,
    correctIndex,
    explanation: sanitizeText(r['explanation'], 'The best answer makes trade-offs explicit and keeps teams able to change safely.'),
  };
}

function extractJsonObject(text: string): unknown | null {
  try {
    return JSON.parse(text);
  } catch {
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start < 0 || end <= start) return null;
    try {
      return JSON.parse(text.slice(start, end + 1));
    } catch {
      return null;
    }
  }
}

async function fetchOpenAiQuestion(
  floorId: FloorId,
  topic: string,
  apiKey: string,
  fetchFn: typeof fetch,
  timeoutMs: number,
): Promise<NpcQuestion | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchFn(OPENAI_CHAT_COMPLETIONS_ENDPOINT, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${apiKey}`,
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: OPENAI_NPC_MODEL,
        temperature: 0.7,
        max_tokens: 450,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content: OPENAI_NPC_SYSTEM_PROMPT,
          },
          {
            role: 'user',
            content: `Create one question about ${topic}. It should fit a light-hearted architecture platformer.`,
          },
        ],
      }),
    });
    if (!response.ok) return null;
    const data = await response.json() as OpenAiResponse;
    const content = data.choices?.[0]?.message?.content;
    if (typeof content !== 'string') return null;
    return validateNpcQuestionPayload(extractJsonObject(content), floorId, topic);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function getNpcQuestion(
  floorId: FloorId,
  topic: string,
  options: LlmClientOptions = {},
): Promise<NpcQuestionResult> {
  const fallback = getRandomNpcQuestion(floorId, topic);
  const settings = options.settings ?? settingsStore.read();
  const fetchFn = options.fetchFn ?? globalThis.fetch;
  const apiKey = settings.llmApiKey.trim();

  if (settings.llmProvider !== 'openai' || apiKey.length === 0 || typeof fetchFn !== 'function') {
    return { question: fallback, source: 'fallback' };
  }

  const question = await fetchOpenAiQuestion(
    floorId,
    topic,
    apiKey,
    fetchFn.bind(globalThis),
    options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
  );

  return question ? { question, source: 'llm' } : { question: fallback, source: 'fallback' };
}
