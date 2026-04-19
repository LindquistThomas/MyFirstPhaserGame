import { describe, expect, it } from 'vitest';

import source from './ElevatorSceneLayout.ts?raw';

describe('ElevatorSceneLayout sceneLifecycle adoption', () => {
  it('creates a scene lifecycle in constructor()', () => {
    expect(source).toContain('createSceneLifecycle(deps.scene)');
  });
});
