import { describe, expect, it } from 'vitest';

import ciWorkflow from '../../.github/workflows/ci.yml?raw';

const workflowNameValues = ciWorkflow
  .split('\n')
  .map((line) => line.trim())
  .filter((line) => line.startsWith('name: '))
  .map((line) => line.slice('name: '.length));

describe('CI required-check job names', () => {
  it('keeps the lint/unit required check name stable', () => {
    expect(workflowNameValues).toContain('Lint + typecheck + unit tests');
  });

  it('keeps the fan-in required check name stable', () => {
    expect(ciWorkflow).toContain('e2e-complete:');
    expect(workflowNameValues).toContain('Playwright E2E complete');
  });

  it('does not include obsolete shard-era check names', () => {
    expect(workflowNameValues).not.toContain('Playwright E2E (shard 1/2)');
    expect(workflowNameValues).not.toContain('Playwright E2E (shard 2/2)');
    expect(workflowNameValues).not.toContain('Playwright E2E (shard 1/4)');
    expect(workflowNameValues).not.toContain('Playwright E2E (shard 2/4)');
    expect(workflowNameValues).not.toContain('Playwright E2E (shard 3/4)');
    expect(workflowNameValues).not.toContain('Playwright E2E (shard 4/4)');
  });
});
