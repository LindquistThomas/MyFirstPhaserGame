import { describe, expect, it } from 'vitest';

import source from './FinanceTeamScene.ts?raw';

describe('FinanceTeamScene sceneLifecycle adoption', () => {
  it('creates a scene lifecycle in create()', () => {
    expect(source).toContain('createSceneLifecycle(this)');
  });
});
