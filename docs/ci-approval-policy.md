# CI policy for this repository

## Trigger: `pull_request` (not `pull_request_target`)

`ci.yml` uses `on: pull_request`. This means:

- Check runs are posted to the **PR head SHA**, so they appear on the PR Checks tab and can gate merges.
- Copilot coding-agent PRs open branches inside this repo (not forks), so no approval step is required before the workflow starts.
- The `auto-approve-bot-ci.yml` workflow was removed; it is no longer needed.

## Security tradeoff decision for PR CI

Team decision: **Option C** (no `pull_request_target` execution of PR head code).

- CI runs only from `pull_request` / `push` / `merge_group`.
- We do **not** run untrusted PR code with a base-branch token.
- This removes the `pull_request_target` + checkout(PR head SHA) token-exfiltration risk class from normal PR CI.
- If external fork contributors are needed later, prefer a two-stage model (`pull_request` build/test + `workflow_run` privileged follow-up) instead of reintroducing `pull_request_target` test execution.

## Required branch-protection checks for `main`

Configure in **Settings → Branches → `main` → Require status checks to pass**:

| Check name | Notes |
|---|---|
| `Lint + typecheck + unit tests` | Always required |
| `Playwright E2E complete` | Fan-in job; do **not** require individual shard names |
| `Bundle size budget` | Recommended |

Remove any stale per-shard entries listed in **Branch protection required checks (`main`)** below.

> CI cannot read live branch-protection settings. A repository admin must verify this list manually in the branch settings UI (or via API).

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

For a docs-only PR (`docs/**` only), the shard jobs are intentionally skipped by `ci.yml` and `Playwright E2E complete` reports success via fan-in. This is expected and should still allow merge when required checks above are configured correctly.

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

## Optional API command to set Actions approval policy (maintainer token required)

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
