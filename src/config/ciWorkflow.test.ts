import { describe, expect, it } from 'vitest';

import ciWorkflow from '../../.github/workflows/ci.yml?raw';
import deployWorkflow from '../../.github/workflows/deploy.yml?raw';

const workflowNameValues = ciWorkflow
  .split('\n')
  .map((line) => line.trim())
  .filter((line) => line.startsWith('name: '))
  .map((line) => line.slice('name: '.length));

function getJobBlock(jobId: string): string {
  const lines = ciWorkflow.split('\n');
  const start = lines.findIndex((line) => line === `  ${jobId}:`);
  if (start < 0) return '';

  const end = lines.findIndex((line, index) => index > start && /^ {2}[a-z0-9-]+:$/.test(line));
  const jobLines = end < 0 ? lines.slice(start) : lines.slice(start, end);
  return jobLines.join('\n');
}

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

  it('allows doc-only changes to skip shards while keeping fan-in green', () => {
    const e2eJobBlock = getJobBlock('e2e');
    const e2eCompleteJobBlock = getJobBlock('e2e-complete');

    expect(e2eJobBlock).toContain("if: needs.changes.outputs.code == 'true'");
    expect(e2eCompleteJobBlock).toContain('if [ "$e2e" = "success" ] || [ "$e2e" = "skipped" ]; then');
  });

  it('keys pull request concurrency by PR number and cancels only PR superseded runs', () => {
    expect(ciWorkflow).toContain("github.event_name == 'pull_request'");
    expect(ciWorkflow).toContain("format('ci-pr-{0}', github.event.pull_request.number)");
    expect(ciWorkflow).toContain("cancel-in-progress: ${{ github.event_name == 'pull_request' }}");
    expect(ciWorkflow).not.toContain('pull_request_target');
  });

  it('seeds the code paths-filter with an inclusive pattern before doc exclusions', () => {
    expect(ciWorkflow).toContain('code:\n              - \'**\'\n              - \'!docs/**\'');
    expect(ciWorkflow).not.toContain("!.github/workflows/**");
  });
});

describe('Deploy workflow gates', () => {
  it('deploys after successful CI completion for main instead of directly on push', () => {
    expect(deployWorkflow).toContain('workflow_run:');
    expect(deployWorkflow).toContain('workflows: [CI]');
    expect(deployWorkflow).toContain('types: [completed]');
    expect(deployWorkflow).not.toContain('push:\n    branches: [main]');
  });

  it('checks out the CI-validated commit when deploy starts from workflow_run', () => {
    expect(deployWorkflow).toContain("github.event.workflow_run.conclusion == 'success'");
    expect(deployWorkflow).toContain("github.event.workflow_run.event == 'push'");
    expect(deployWorkflow).toContain("github.event.workflow_run.head_branch == 'main'");
    expect(deployWorkflow).toContain('ref: ${{ github.event_name == \'workflow_run\' && github.event.workflow_run.head_sha || github.sha }}');
  });
});
