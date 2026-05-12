import { describe, it, expect, beforeEach } from 'vitest';
import {
  CONTENT_CACHE_KEY,
  CONTENT_CACHE_VERSION,
  clearContentCache,
  readContentCache,
  setContentCacheStorage,
  writeInfoFloorToContentCache,
  writeQuizFloorToContentCache,
} from './ContentCache';
import type { KVStorage } from './SaveManager';
import type { InfoPointDef } from '../config/info/types';
import type { QuizDefinition } from '../config/quiz/types';
import { FLOORS } from '../config/gameConfig';

function memoryStorage(): KVStorage & { store: Map<string, string> } {
  const store = new Map<string, string>();
  return {
    store,
    getItem: (k) => (store.has(k) ? store.get(k)! : null),
    setItem: (k, v) => { store.set(k, v); },
    removeItem: (k) => { store.delete(k); },
  };
}

const SAMPLE_INFO: Record<string, InfoPointDef> = {
  'test-info-1': {
    content: {
      id: 'test-info-1',
      title: 'Test Info',
      body: 'Test body text',
    },
    floorId: FLOORS.LOBBY,
  },
};

const SAMPLE_QUIZ: Record<string, QuizDefinition> = {
  'test-info-1': {
    infoId: 'test-info-1',
    questions: [
      {
        id: 'q1',
        difficulty: 'easy',
        question: 'What is 2+2?',
        choices: ['3', '4', '5', '6'],
        correctIndex: 1,
        explanation: 'Basic arithmetic.',
      },
    ],
  },
};

describe('ContentCache', () => {
  let storage: KVStorage & { store: Map<string, string> };

  beforeEach(() => {
    storage = memoryStorage();
    setContentCacheStorage(storage);
  });

  describe('readContentCache', () => {
    it('returns null when storage is empty', () => {
      expect(readContentCache()).toBeNull();
    });

    it('returns null when stored version does not match CONTENT_CACHE_VERSION', () => {
      storage.store.set(
        CONTENT_CACHE_KEY,
        JSON.stringify({ version: '0', infoByFloor: {}, quizByFloor: {} }),
      );
      expect(readContentCache()).toBeNull();
    });

    it('returns null when stored JSON is corrupt', () => {
      storage.store.set(CONTENT_CACHE_KEY, 'not-json{');
      expect(readContentCache()).toBeNull();
    });

    it('returns null when infoByFloor is missing', () => {
      storage.store.set(
        CONTENT_CACHE_KEY,
        JSON.stringify({ version: CONTENT_CACHE_VERSION, quizByFloor: {} }),
      );
      expect(readContentCache()).toBeNull();
    });

    it('returns null when quizByFloor is missing', () => {
      storage.store.set(
        CONTENT_CACHE_KEY,
        JSON.stringify({ version: CONTENT_CACHE_VERSION, infoByFloor: {} }),
      );
      expect(readContentCache()).toBeNull();
    });

    it('returns the payload when version matches and shape is valid', () => {
      const payload = {
        version: CONTENT_CACHE_VERSION,
        infoByFloor: { [String(FLOORS.LOBBY)]: SAMPLE_INFO },
        quizByFloor: { [String(FLOORS.LOBBY)]: SAMPLE_QUIZ },
      };
      storage.store.set(CONTENT_CACHE_KEY, JSON.stringify(payload));
      const result = readContentCache();
      expect(result).not.toBeNull();
      expect(result!.version).toBe(CONTENT_CACHE_VERSION);
      expect(result!.infoByFloor[String(FLOORS.LOBBY)]).toEqual(SAMPLE_INFO);
      expect(result!.quizByFloor[String(FLOORS.LOBBY)]).toEqual(SAMPLE_QUIZ);
    });
  });

  describe('writeInfoFloorToContentCache', () => {
    it('persists info data that can be read back', () => {
      writeInfoFloorToContentCache(FLOORS.LOBBY, SAMPLE_INFO);
      const result = readContentCache();
      expect(result).not.toBeNull();
      expect(result!.infoByFloor[String(FLOORS.LOBBY)]).toEqual(SAMPLE_INFO);
    });

    it('sets version to CONTENT_CACHE_VERSION', () => {
      writeInfoFloorToContentCache(FLOORS.LOBBY, SAMPLE_INFO);
      expect(readContentCache()!.version).toBe(CONTENT_CACHE_VERSION);
    });

    it('initialises quizByFloor as empty when writing the first entry', () => {
      writeInfoFloorToContentCache(FLOORS.LOBBY, SAMPLE_INFO);
      expect(readContentCache()!.quizByFloor).toEqual({});
    });

    it('merges multiple floor writes without overwriting previous entries', () => {
      const infoFloor1: Record<string, InfoPointDef> = {
        'floor1-info': {
          content: { id: 'floor1-info', title: 'F1', body: 'Floor 1 body' },
          floorId: FLOORS.PLATFORM_TEAM,
        },
      };
      writeInfoFloorToContentCache(FLOORS.LOBBY, SAMPLE_INFO);
      writeInfoFloorToContentCache(FLOORS.PLATFORM_TEAM, infoFloor1);
      const result = readContentCache();
      expect(result!.infoByFloor[String(FLOORS.LOBBY)]).toEqual(SAMPLE_INFO);
      expect(result!.infoByFloor[String(FLOORS.PLATFORM_TEAM)]).toEqual(infoFloor1);
    });

    it('preserves existing quizByFloor entries across info writes', () => {
      writeQuizFloorToContentCache(FLOORS.LOBBY, SAMPLE_QUIZ);
      writeInfoFloorToContentCache(FLOORS.LOBBY, SAMPLE_INFO);
      const result = readContentCache();
      expect(result!.quizByFloor[String(FLOORS.LOBBY)]).toEqual(SAMPLE_QUIZ);
    });
  });

  describe('writeQuizFloorToContentCache', () => {
    it('persists quiz data that can be read back', () => {
      writeQuizFloorToContentCache(FLOORS.LOBBY, SAMPLE_QUIZ);
      const result = readContentCache();
      expect(result).not.toBeNull();
      expect(result!.quizByFloor[String(FLOORS.LOBBY)]).toEqual(SAMPLE_QUIZ);
    });

    it('sets version to CONTENT_CACHE_VERSION', () => {
      writeQuizFloorToContentCache(FLOORS.LOBBY, SAMPLE_QUIZ);
      expect(readContentCache()!.version).toBe(CONTENT_CACHE_VERSION);
    });

    it('initialises infoByFloor as empty when writing the first entry', () => {
      writeQuizFloorToContentCache(FLOORS.LOBBY, SAMPLE_QUIZ);
      expect(readContentCache()!.infoByFloor).toEqual({});
    });

    it('merges multiple floor writes without overwriting previous entries', () => {
      const quizFloor3: Record<string, QuizDefinition> = {
        'biz-info': {
          infoId: 'biz-info',
          questions: [
            {
              id: 'bq1',
              difficulty: 'medium',
              question: 'Finance?',
              choices: ['Yes', 'No', 'Maybe', 'Always'],
              correctIndex: 0,
              explanation: 'Yes.',
            },
          ],
        },
      };
      writeQuizFloorToContentCache(FLOORS.LOBBY, SAMPLE_QUIZ);
      writeQuizFloorToContentCache(FLOORS.BUSINESS, quizFloor3);
      const result = readContentCache();
      expect(result!.quizByFloor[String(FLOORS.LOBBY)]).toEqual(SAMPLE_QUIZ);
      expect(result!.quizByFloor[String(FLOORS.BUSINESS)]).toEqual(quizFloor3);
    });

    it('preserves existing infoByFloor entries across quiz writes', () => {
      writeInfoFloorToContentCache(FLOORS.LOBBY, SAMPLE_INFO);
      writeQuizFloorToContentCache(FLOORS.LOBBY, SAMPLE_QUIZ);
      const result = readContentCache();
      expect(result!.infoByFloor[String(FLOORS.LOBBY)]).toEqual(SAMPLE_INFO);
    });
  });

  describe('clearContentCache', () => {
    it('removes the persisted entry', () => {
      writeInfoFloorToContentCache(FLOORS.LOBBY, SAMPLE_INFO);
      expect(readContentCache()).not.toBeNull();
      clearContentCache();
      expect(readContentCache()).toBeNull();
      expect(storage.store.has(CONTENT_CACHE_KEY)).toBe(false);
    });
  });

  describe('version handling', () => {
    it('overwrites a stale-version entry on the next write', () => {
      // Seed an old-version entry directly in storage.
      storage.store.set(
        CONTENT_CACHE_KEY,
        JSON.stringify({ version: '0', infoByFloor: {}, quizByFloor: {} }),
      );
      // A new write should replace the stale entry.
      writeInfoFloorToContentCache(FLOORS.LOBBY, SAMPLE_INFO);
      const result = readContentCache();
      expect(result!.version).toBe(CONTENT_CACHE_VERSION);
      expect(result!.infoByFloor[String(FLOORS.LOBBY)]).toEqual(SAMPLE_INFO);
    });
  });
});
