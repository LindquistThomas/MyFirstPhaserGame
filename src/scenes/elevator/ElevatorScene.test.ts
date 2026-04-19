import { describe, expect, it } from 'vitest';

import source from './ElevatorScene.ts?raw';

describe('ElevatorScene sceneLifecycle adoption', () => {
  it('creates a scene lifecycle in init()', () => {
    expect(source).toContain('createSceneLifecycle(this)');
  });
});
