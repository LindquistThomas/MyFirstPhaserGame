# Skill: Git Worktree for Local Branches

## Why

The primary checkout at `C:\code\architect-elevator-game` keeps `main`'s `node_modules`, `dist/`, `playwright-report/`, and `test-results/` intact. Running `git checkout -b` in place blows those away (or at least invalidates Vite/Playwright caches) and breaks any concurrent agent session. Worktrees sidestep that.

## Convention

- Sibling directory: `C:\code\architect-elevator-game-<slug>` on Windows, `../architect-elevator-game-<slug>` (or `~/code/architect-elevator-game-<slug>`) on macOS/Linux.
- Branch name: `<type>/<slug>` with `<type>` ∈ { `fix`, `feat`, `chore`, `docs`, … } and `<slug>` in kebab-case.

> **Note on primary-checkout names.** The examples below use `architect-elevator-game` as the primary clone directory name on both Windows and macOS/Linux (matching the GitHub repo name). If your local clone uses a different directory name, substitute it in every `..\…` / `../…` path below — the worktree sibling path is always `<primary-checkout-name>-<slug>`.

## Create

**Windows (PowerShell):**

```powershell
# From the primary checkout, on main
git worktree add ..\architect-elevator-game-<slug> -b <type>/<slug>
cd ..\architect-elevator-game-<slug>
npm install    # each worktree has its own node_modules
# …edit, build (npm run build), test (npm run test:all), commit…
```

**macOS / Linux (bash / zsh):**

```bash
# From the primary checkout, on main
git worktree add ../architect-elevator-game-<slug> -b <type>/<slug>
cd ../architect-elevator-game-<slug>
npm install
# …edit, build (npm run build), test (npm run test:all), commit…
```

## Integrate back into main

Ask the user whether to **rebase** or **merge**, then from the primary checkout:

**Windows (PowerShell):**

```powershell
cd ..\architect-elevator-game
git fetch origin

# Rebase path (linear history):
git -C ..\architect-elevator-game-<slug> rebase origin/main
git merge --ff-only <type>/<slug>

# Or merge path (preserve branch topology):
git merge --no-ff <type>/<slug>
```

**macOS / Linux:**

```bash
cd ../architect-elevator-game
git fetch origin

# Rebase path (linear history):
git -C ../architect-elevator-game-<slug> rebase origin/main
git merge --ff-only <type>/<slug>

# Or merge path (preserve branch topology):
git merge --no-ff <type>/<slug>
```

## Clean up

**Windows (PowerShell):**

```powershell
git worktree remove ..\architect-elevator-game-<slug>
git branch -d <type>/<slug>
```

**macOS / Linux:**

```bash
git worktree remove ../architect-elevator-game-<slug>
git branch -d <type>/<slug>
```

## Rules

- Never force-remove a worktree with uncommitted changes without confirming with the user first.
- Don't symlink `node_modules` across worktrees — Vite and Playwright caches can collide.
- `playwright-report/` and `test-results/` are per-worktree; don't copy them back into `main`.
- If the user explicitly asks to work on the primary checkout (no worktree), honour that.
