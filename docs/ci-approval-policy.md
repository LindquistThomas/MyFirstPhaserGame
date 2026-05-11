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

## Branch protection required checks (`main`)

When CI shard counts change, required checks in branch protection can go stale.

In **Settings → Branches → `main` → Require status checks to pass before merging**:

- Keep `Lint + typecheck + unit tests`
- Keep `Playwright E2E complete` (fan-in)
- Keep or remove `Bundle size budget` per team preference
- Remove per-shard checks if present:
  - `Playwright E2E (shard 1/2)`, `Playwright E2E (shard 2/2)`
  - `Playwright E2E (shard 1/4)`, `Playwright E2E (shard 2/4)`, `Playwright E2E (shard 3/4)`, `Playwright E2E (shard 4/4)`

Per-shard names are implementation details and can change over time. Branch protection
must require only stable fan-in checks.

## Optional API command to set required checks (maintainer token required)

```bash
curl -X PATCH \
  -H "Accept: application/vnd.github+json" \
  -H "Authorization: Bearer <ADMIN_OR_MAINTAINER_TOKEN>" \
  https://api.github.com/repos/norconsult-digital/architect-elevator-game/branches/main/protection/required_status_checks \
  -d '{
    "strict": true,
    "contexts": [
      "Lint + typecheck + unit tests",
      "Playwright E2E complete"
    ]
  }'
```

> If your team wants `Bundle size budget` as required, add it to `contexts`.

## Optional API command (maintainer token required)

```bash
curl -X PUT \
  -H "Accept: application/vnd.github+json" \
  -H "Authorization: Bearer <ADMIN_OR_MAINTAINER_TOKEN>" \
  https://api.github.com/repos/norconsult-digital/architect-elevator-game/actions/permissions/fork-pr-contributor-approval \
  -d '{"approval_policy":"first_time_contributors_new_to_github"}'
```
