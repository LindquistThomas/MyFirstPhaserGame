import { describe, expect, it } from 'vitest';
import source from './PlatformTeamScene.ts?raw';

describe('PlatformTeamScene sceneLifecycle adoption', () => {
  it('creates a scene lifecycle in create()', () => {
    expect(source).toContain('createSceneLifecycle(this)');
  });
});
