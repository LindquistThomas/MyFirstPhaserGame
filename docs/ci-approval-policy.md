# CI approval policy for Copilot-authored PRs

Copilot branches in this repository are in-repo branches, not forks. If Actions is configured to require approval for first-time contributors, workflow runs can get stuck with conclusion `action_required` and required checks never execute.

## Recommended repository setting

In **Settings → Actions → General → Fork pull request workflows from outside collaborators**, set approval policy to:

- **Require approval for first-time contributors who are new to GitHub**

Equivalent API value:

- `first_time_contributors_new_to_github`

## One-time unblock for already stuck PRs

After changing the setting, trigger a new run on each affected PR by either:

- pushing an empty commit to the PR branch, or
- using **Approve and run** on the existing pending run.

## Optional API command (maintainer token required)

```bash
curl -X PUT \
  -H "Accept: application/vnd.github+json" \
  -H "Authorization: Bearer <ADMIN_OR_MAINTAINER_TOKEN>" \
  https://api.github.com/repos/norconsult-digital/architect-elevator-game/actions/permissions/fork-pr-contributor-approval \
  -d '{"approval_policy":"first_time_contributors_new_to_github"}'
```
