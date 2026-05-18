# Copilot agent automation

This repository can route selected issues to GitHub Copilot coding agent and
auto-merge the resulting PRs once branch protection says they are green.

## Labels

| Label | Meaning |
| --- | --- |
| `agent:ready` | Maintainer opt-in. Applying this to an issue starts Copilot routing. |
| `agent:assigned` | Workflow successfully assigned the issue to Copilot. |
| `agent:auto-merge` | PR is eligible for guarded auto-merge. |
| `agent:hold` | Kill switch. Auto-merge skips the PR while this label is present. |
| `agent:needs-human` | Routing failed or needs maintainer attention. |

## Issue routing

The `.github/workflows/copilot-issue-routing.yml` workflow runs only when an
issue is labelled `agent:ready`. It assigns the issue to `copilot-swe-agent`
with GitHub's Copilot assignment API and adds a comment explaining the next
step.

The workflow requires a repository secret named `COPILOT_AGENT_TOKEN`. GitHub's
Copilot assignment API requires a user token, such as a fine-grained PAT or
GitHub App user-to-server token, that can assign Copilot coding agent. For a
fine-grained PAT, grant read access to metadata and read/write access to
actions, contents, issues, and pull requests.

The assignment call includes custom instructions asking Copilot to open a
linked, ready-for-review PR and add `agent:auto-merge` when work and tests are
complete.

## PR auto-merge

The `.github/workflows/copilot-pr-automerge.yml` workflow enables GitHub
auto-merge for Copilot PRs only when all guards pass:

- PR comes from this repository, not a fork.
- PR author is the Copilot coding-agent bot.
- PR branch starts with `copilot/`.
- PR is not a draft.
- PR does not have `agent:hold`.
- PR has `agent:auto-merge`, or closes an issue labelled `agent:ready`.
- Repository auto-merge is enabled.

The workflow uses `pull_request_target` for metadata and API calls only. It
does not check out or execute PR code. The merge command uses `gh pr merge
--auto`, so branch protection and required status checks remain authoritative.
When checks pass, GitHub merges the PR and closes it as merged.

## Repository settings

Enable **Settings > General > Pull Requests > Allow auto-merge**.

Branch protection for `main` must require the stable checks from
`docs/ci-approval-policy.md`:

- `Lint + typecheck + unit tests`
- `Playwright E2E complete`
- optionally `Bundle size budget`

For fully automatic merging, do not require pull request reviews on `main`.
Required reviews will intentionally block auto-merge until a maintainer
approves.

## Maintainer workflow

1. Write an issue with clear acceptance criteria and expected validation.
2. Add `agent:ready`.
3. Watch for `agent:assigned`.
4. If Copilot opens a PR that should not merge automatically, add `agent:hold`.
5. If a bad PR merges, revert the merge or open a follow-up fix. Do not use
   stale auto-close rules to hide failed agent work.

## Known constraints

Copilot coding-agent assignment is a public-preview GitHub feature. If GitHub
changes the bot login, branch naming, or assignment API, update both workflows
and `src/config/agentAutomationWorkflow.test.ts`.
