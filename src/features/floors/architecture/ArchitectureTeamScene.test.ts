import { describe, expect, it } from 'vitest';

import source from './ArchitectureTeamScene.ts?raw';

describe('ArchitectureTeamScene sceneLifecycle adoption', () => {
  it('creates a scene lifecycle in create()', () => {
    expect(source).toContain('createSceneLifecycle(this)');
  });
});
