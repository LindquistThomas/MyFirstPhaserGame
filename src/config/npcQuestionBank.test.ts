import { describe, it, expect } from 'vitest';
import { FLOOR_IDS } from './gameConfig';
import { getNpcQuestionsForFloor, getRandomNpcQuestion, NPC_QUESTION_BANK } from './npcQuestionBank';

describe('npcQuestionBank', () => {
  it('has at least three fallback questions for every floor', () => {
    for (const floorId of FLOOR_IDS) {
      expect(getNpcQuestionsForFloor(floorId).length).toBeGreaterThanOrEqual(3);
    }
  });

  it('keeps every question in strict four-option multiple-choice shape', () => {
    for (const questions of Object.values(NPC_QUESTION_BANK)) {
      for (const q of questions) {
        expect(q.question.length).toBeGreaterThan(0);
        expect(q.options).toHaveLength(4);
        expect(q.correctIndex).toBeGreaterThanOrEqual(0);
        expect(q.correctIndex).toBeLessThan(4);
        expect(q.options[q.correctIndex]?.length).toBeGreaterThan(0);
        expect(q.explanation.length).toBeGreaterThan(0);
      }
    }
  });

  it('falls back to floor pool when topic has no match', () => {
    const q = getRandomNpcQuestion(FLOOR_IDS[0]!, 'missing-topic');
    expect(getNpcQuestionsForFloor(FLOOR_IDS[0]!).map((candidate) => candidate.id)).toContain(q.id);
  });
});
