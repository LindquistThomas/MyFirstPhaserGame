# CI policy for this repository

## Trigger: `pull_request` (not `pull_request_target`)

`ci.yml` uses `on: pull_request`. This means:

- Check runs are posted to the **PR head SHA**, so they appear on the PR Checks tab and can gate merges.
- Copilot coding-agent PRs open branches inside this repo (not forks), so no approval step is required before the workflow starts.
- The `auto-approve-bot-ci.yml` workflow was removed; it is no longer needed.

## Required branch-protection checks for `main`

Configure in **Settings → Branches → `main` → Require status checks to pass**:

| Check name | Notes |
|---|---|
| `Lint + typecheck + unit tests` | Always required |
| `Playwright E2E complete` | Fan-in job; do **not** require individual shard names |
| `Bundle size budget` | Recommended |

Remove any stale per-shard entries (`Playwright E2E (shard 1/4)` … `shard 4/4`) if present.

### API command (maintainer token required)

```bash
curl -X PUT \
  -H "Accept: application/vnd.github+json" \
  -H "Authorization: Bearer <ADMIN_OR_MAINTAINER_TOKEN>" \
  https://api.github.com/repos/norconsult-digital/architect-elevator-game/branches/main/protection \
  -d '{
    "required_status_checks": {
      "strict": false,
      "contexts": [
        "Lint + typecheck + unit tests",
        "Playwright E2E complete",
        "Bundle size budget"
      ]
    },
    "enforce_admins": false,
    "required_pull_request_reviews": null,
    "restrictions": null
  }'
```

## If external-fork PRs are ever introduced

Add a separate `pull_request_target` workflow scoped **only** to the approval/labelling step. Keep the build/test jobs in a `pull_request` workflow so check runs still land on the PR head SHA.
