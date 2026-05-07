import { describe, expect, it } from 'vitest';

import ciWorkflow from '../../.github/workflows/ci.yml?raw';

const uncommentedWorkflow = ciWorkflow
  .split('\n')
  .filter((line) => !line.trimStart().startsWith('#'))
  .join('\n');

describe('CI required-check job names', () => {
  it('keeps the lint/unit required check name stable', () => {
    expect(uncommentedWorkflow).toContain('name: Lint + typecheck + unit tests');
  });

  it('keeps the fan-in required check name stable', () => {
    expect(uncommentedWorkflow).toContain('e2e-complete:');
    expect(uncommentedWorkflow).toContain('name: Playwright E2E complete');
  });

  it('does not reference obsolete 2-shard check names', () => {
    expect(uncommentedWorkflow).not.toContain('Playwright E2E (shard 1/2)');
    expect(uncommentedWorkflow).not.toContain('Playwright E2E (shard 2/2)');
  });
});
