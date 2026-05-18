import { describe, expect, it } from 'vitest';

import autoMergeWorkflow from '../../.github/workflows/copilot-pr-automerge.yml?raw';
import issueRoutingWorkflow from '../../.github/workflows/copilot-issue-routing.yml?raw';

describe('Copilot issue routing workflow', () => {
  it('routes only explicitly labelled issues to Copilot', () => {
    expect(issueRoutingWorkflow).toContain('issues:');
    expect(issueRoutingWorkflow).toContain('types: [labeled]');
    expect(issueRoutingWorkflow).toContain("github.event.label.name == 'agent:ready'");
    expect(issueRoutingWorkflow).toContain('COPILOT_AGENT_TOKEN');
  });

  it('uses the Copilot coding-agent assignment API', () => {
    expect(issueRoutingWorkflow).toContain('GraphQL-Features: issues_copilot_assignment_api_support,coding_agent_model_selection');
    expect(issueRoutingWorkflow).toContain('copilot-swe-agent');
    expect(issueRoutingWorkflow).toContain('copilot-swe-agent[bot]');
    expect(issueRoutingWorkflow).toContain('agent_assignment');
  });

  it('surfaces routing failures for human follow-up', () => {
    expect(issueRoutingWorkflow).toContain('agent:assigned');
    expect(issueRoutingWorkflow).toContain('agent:needs-human');
  });
});

describe('Copilot PR auto-merge workflow', () => {
  it('uses pull_request_target only for metadata orchestration', () => {
    expect(autoMergeWorkflow).toContain('pull_request_target:');
    expect(autoMergeWorkflow).not.toContain('actions/checkout');
  });

  it('keeps privileged auto-merge behind Copilot PR guards', () => {
    expect(autoMergeWorkflow).toContain('github.event.pull_request.head.repo.full_name == github.repository');
    expect(autoMergeWorkflow).toContain("github.event.pull_request.user.type == 'Bot'");
    expect(autoMergeWorkflow).toContain("github.event.pull_request.user.login == 'copilot-swe-agent[bot]'");
    expect(autoMergeWorkflow).toContain("startsWith(github.event.pull_request.head.ref, 'copilot/')");
    expect(autoMergeWorkflow).toContain('github.event.pull_request.draft == false');
    expect(autoMergeWorkflow).toContain("!contains(github.event.pull_request.labels.*.name, 'agent:hold')");
  });

  it('requires agent opt-in before enabling auto-merge', () => {
    expect(autoMergeWorkflow).toContain('agent:auto-merge');
    expect(autoMergeWorkflow).toContain('agent:ready');
    expect(autoMergeWorkflow).toContain('allow_auto_merge');
  });

  it('uses GitHub auto-merge instead of direct immediate merge', () => {
    expect(autoMergeWorkflow).toContain('gh pr merge "$PR_NUMBER" --auto --squash --delete-branch');
  });
});
