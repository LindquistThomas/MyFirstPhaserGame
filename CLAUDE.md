# So You Want To Be An Architect

<!-- SYNC NOTICE: This file and .github/copilot-instructions.md share the same
     project instructions. When you edit one, update the other to match. -->

A TypeScript + Phaser 3 platformer about IT architecture, bundled with Vite. Progression-based: collect AU (Architecture Units) to unlock floors of a building, each representing a domain team.

## Repository structure

```
.
├── index.html                # Vite entry (loads src/main.ts)
├── package.json              # Scripts, deps (phaser ^3.90)
├── tsconfig.json             # TypeScript strict
├── vite.config.ts            # Bundler config
├── vitest.config.ts          # Unit tests (jsdom, 60% floor on src/systems & src/input)
├── playwright.config.ts      # E2E / visual tests
├── eslint.config.js
├── public/
│   └── music/                # MP3/OGG music tracks loaded in BootScene
├── src/
│   ├── main.ts               # Phaser.Game config + scene registration
│   ├── config/               # gameConfig, levelData, audioConfig; info/ and quiz/ barrel dirs
│   ├── entities/             # Player, Enemy (+ enemies/), Token, DroppedAU, Elevator
│   ├── features/floors/      # _shared/LevelScene + helpers, one dir per floor team scene
│   ├── input/                # Typed action bindings (actions.ts, bindings.ts, InputService)
│   ├── plugins/              # MusicPlugin, DebugPlugin (Phaser ScenePlugins)
│   ├── scenes/               # core/ (BootScene, MenuScene), elevator/, NavigationContext
│   ├── systems/              # ProgressionSystem, EventBus, ZoneManager, AudioManager,
│   │                         # QuizManager, InfoDialogManager, SaveManager,
│   │                         # SpriteGenerator, SoundGenerator, MusicGenerator
│   └── ui/                   # InfoDialog, ModalBase, ElevatorButtons, InfoIcon, HUD, …
├── tests/                    # Playwright specs + helpers/ (see testing section)
└── .github/
    ├── copilot-instructions.md   # Mirror of this file (keep in sync)
    └── skills/                   # add-game-object, caveman-mode, debug-with-playwright, git-worktree, new-scene, setup-project
```

There is **no** `public/assets/` directory — only `public/music/` exists today. Procedural sprites and SFX are generated at runtime by `SpriteGenerator` and `SoundGenerator`; only music is shipped as static files.

## Language, tooling, scripts

- **TypeScript** (strict), ES modules. Never introduce `.js` source files.
- Scenes, entities, UI components, and systems use **PascalCase** filenames matching the exported class.
- Config / tooling files use lowercase (`vite.config.ts`, `eslint.config.js`).
- Package manager: **npm** (lockfile is `package-lock.json`).

Scripts from `package.json`:

| Script | Purpose |
| --- | --- |
| `npm run dev` | Vite dev server (`window.__game` / `__testHooks` always on unless `VITE_EXPOSE_TEST_HOOKS=false`). |
| `npm run build` | `tsc && vite build` — typecheck is part of the build. |
| `npm run lint` | ESLint across the repo. |
| `npm run typecheck` | `tsc --noEmit`. |
| `npm run test:unit` | Vitest (pure logic; jsdom). |
| `npm run test:unit:coverage` | Vitest with coverage; 60% floor on `src/systems/**` and `src/input/**`. |
| `npm run test:e2e` | Playwright integration specs. |
| `npm run test:headed` / `test:ui` | Playwright with visible browser / interactive UI. |
| `npm run test:visual:update` | Refresh visual snapshot PNGs. |
| `npm test` | `test:unit && test:e2e`. |
| `npm run test:all` | `typecheck && lint && test:unit --coverage && test:e2e` — the pre-PR gate. |

**Before declaring work done:** run `npm run typecheck && npm run lint && npm run test:unit`. **Do not run `npm run test:e2e` or `npm run test:all` without asking the user first** — the Playwright suite is slow and should be opt-in. For pure-docs changes, `npm run lint && npm run typecheck` is sufficient.

## Architecture pointers

Short index of where things live. Reach for these instead of re-implementing.

- **`ProgressionSystem`** (`src/systems/ProgressionSystem.ts`) — the only public API for save/load. Tracks `totalAU`, `floorAU`, `unlockedFloors`, `currentFloor`, `collectedTokens`. Persists via `SaveManager` (localStorage key `architect_<slot>_v1`; default slot `default` → `architect_default_v1`).
- **`SaveManager`** — infrastructure. Scenes must not import it; use `ProgressionSystem`. The one exception is `SaveManager.hasSave()` for UI checks (e.g. a "Continue" button).
- **`EventBus`** (`src/systems/EventBus.ts`) — typed pub/sub singleton. The `GameEvents` map is the single source of truth for event names and payloads; add new events there and all call sites become type-checked. No Phaser dependency.
- **`ZoneManager`** (`src/systems/ZoneManager.ts`) — registers named zones with arbitrary `check: () => boolean` predicates, emits `zone:enter` / `zone:exit` on state change only. UI reacts to events; `getActiveZone()` is a synchronous query for keyboard handlers. Default pattern for anything that should appear only in a specific area of a scene.
- **`AudioManager`** + **`MusicPlugin`** — fully reactive. Scenes don't play audio directly; entities emit `sfx:*` / `music:*` events. Scene music is auto-driven by `SCENE_MUSIC` in `src/config/audioConfig.ts` via `MusicPlugin`. Mute state persists under localStorage key `architect_audio_muted_v1`.
- **`SoundGenerator`** — procedural SFX generated at runtime and registered as Phaser audio keys. Music is loaded from `public/music/` in `BootScene.preload()` (MP3/OGG). `MusicGenerator` is a retained but unused procedural fallback.
- **`SpriteGenerator`** — procedural pixel-art textures for player, enemies, tokens, platforms, elevator cab, etc.
- **`QuizManager`** (localStorage key `architect_quiz_v1`) — quiz completion + cooldowns. Data under `src/config/quiz/` (barrel `index.ts`).
- **`InfoDialogManager`** (localStorage key `architect_info_seen_v1`) — tracks which info dialogs the player has opened. Content under `src/config/info/` (barrel `index.ts`).
- **`LevelScene`** (`src/features/floors/_shared/LevelScene.ts`) — shared base for floor scenes. Sibling helpers (`LevelDialogBindings`, `LevelEnemySpawner`, `LevelTokenManager`, `LevelZoneSetup`) compose the shared concerns. Floor-specific scenes (`PlatformTeamScene`, `FinanceTeamScene`, etc.) live under `src/features/floors/<floor>/` and provide a `LevelConfig` with platforms, tokens, enemies (`type: 'slime' | 'bot'`), and info points. Enemies are scene-local, no persistence; they respawn on re-entry.
- **Input** (`src/input/`) — `GameAction` enum + `DEFAULT_BINDINGS` table. Never reference raw `KeyCode`s elsewhere. `InputService` is a Phaser ScenePlugin mapped to `scene.inputs`.

## Conventions

- **EventBus lifecycle**: always unsubscribe handlers in the scene's `shutdown` event. EventBus is a singleton; Phaser scenes are reused between start/stop, so handlers accumulate forever if not cleaned up.
- **Zone-gated UI** (info icons, lobby kiosks, …) starts hidden; `zone:enter`/`zone:exit` reveals and hides it. Never initialise a zone-gated element as visible.
- **Direct calls beat events** for parent→child updates (e.g. refreshing a quiz badge on an `InfoIcon` after a dialog closes). Use EventBus only for loose coupling across systems.
- **Gameplay mechanics that share a widget with content zones** (e.g. in-room lift buttons) must drive visibility from physics state, not from `ZoneManager`. Content zones are for informational content only.
- **Persistent state lives in `ProgressionSystem`**. When adding a new persistent field:
  1. Extend `SaveData` in `SaveManager.ts` and `ProgressionState` in `ProgressionSystem.ts`.
  2. Update `defaultState()`, `persist()`, `loadFromSave()`.
  3. Call `this.persist()` after any mutation that must survive a reload.
- **Text resolution**: `main.ts` monkey-patches `scene.add.text` / `scene.make.text` to default to `resolution: 2` so glyphs stay crisp after FIT scaling. Don't re-override this unless you have a reason.
- **Test-hook globals**: `main.ts` exposes `window.__game` (Phaser.Game) and `window.__testHooks` (`{ QuizDialog, canRetryQuiz }`) whenever `VITE_EXPOSE_TEST_HOOKS !== 'false'` — default-on in dev, preview, and production. Playwright relies on both. Build with `VITE_EXPOSE_TEST_HOOKS=false` for a hardened bundle without the globals (see README "Build flags").

## How to extend

### Add a scene
Follow `.github/skills/new-scene.md`. Key steps: create the scene in the appropriate folder — `src/scenes/core/<Name>Scene.ts` or `src/scenes/elevator/<Name>Scene.ts` for infrastructure scenes, `src/features/products/rooms/<Name>Scene.ts` for product content scenes (floor scenes go under `src/features/floors/` — see the next section) — extend `Phaser.Scene`, register it in the `scene:` array in `src/main.ts`, and — if it needs music — add a `SCENE_MUSIC` entry in `src/config/audioConfig.ts`.

### Add a floor / level
Create `src/features/floors/<floor>/<Name>TeamScene.ts` subclassing `LevelScene` (import from `../_shared/LevelScene`) and provide a `LevelConfig` (platforms, `tokens`, `enemies`, `infoPoints`). Register in `LEVEL_DATA` (`src/config/levelData.ts`) with unlock cost and theme, and in the scene array in `main.ts`.

### Add an enemy
Declare it in the scene's `LevelConfig.enemies` array: `{ type: 'slime' | 'bot', x, y, minX, maxX, speed }`. Implementations live in `src/entities/enemies/`. To add a new enemy *type*, create the class there and handle it in `Enemy.ts`.

### Add a sound effect
1. Generate the waveform in `SoundGenerator.generateSounds()` and register the audio key.
2. Declare the event in `GameEvents` (`src/systems/EventBus.ts`) — TypeScript will now enforce correct usage everywhere.
3. Add the event→key mapping in `SFX_EVENTS` (`src/config/audioConfig.ts`).
4. Emit from the relevant entity: `eventBus.emit('sfx:myevent')`.

### Add music for a scene
1. Put the file in `public/music/` and load it in `BootScene.preload()` with key `music_<name>`.
2. Add a `SceneKey → music_<name>` entry in `SCENE_MUSIC`. `MusicPlugin` handles playback — no scene code needed.

### Add an info card
Add the entry under `src/config/info/` (re-exported from `index.ts`). Place an info point in the relevant scene's `LevelConfig.infoPoints` with matching `id`. Zone IDs default to the content ID, so the same string identifies both the zone and the dialog.

### Add a quiz
Add the question set under `src/config/quiz/` (re-exported from `index.ts`) keyed by ID. Quiz state is tracked automatically by `QuizManager`.

### Add a zone
Register in the scene's `create()`:
```ts
zoneManager.register('my-zone', () => /* boolean */);
const onEnter = (id: string) => { if (id === 'my-zone') thing.setVisible(true); };
const onExit  = (id: string) => { if (id === 'my-zone') thing.setVisible(false); };
eventBus.on('zone:enter', onEnter);
eventBus.on('zone:exit', onExit);
this.events.once('shutdown', () => {
  eventBus.off('zone:enter', onEnter);
  eventBus.off('zone:exit', onExit);
});
// In update():
zoneManager.update();
```

## Testing

Two suites, different purposes:

- **Vitest (`src/**/*.test.ts`, jsdom)** — pure logic, systems, input mapping. Fast. Has a 60% coverage floor on `src/systems/**` and `src/input/**`. Phaser is not instantiated; if a test needs scene-like behaviour, use `tests/helpers/phaserMock.ts`-style shims.
- **Playwright (`tests/*.spec.ts`)** — drives the actual dev server via `window.__game`. Use for end-to-end user flows, scene transitions, and visual snapshots.

Playwright helpers in `tests/helpers/playwright.ts`:

- `waitForGame(page)` — waits for `window.__game`, then focuses the canvas so keyboard input reaches Phaser.
- `waitForScene(page, 'SceneKey')` — waits for the scene to be active and settle.
- `seedFullProgressSave(page, { totalAU?, floorAU? })` — pre-populates the save slot and marks the elevator info dialog as seen so it doesn't swallow input.
- `clearStorage(page)` — wipes localStorage before boot.
- `attachErrorWatchers(page).assertClean()` — fails the test if any uncaught `pageerror`/console error leaked.

For detailed Playwright debugging recipes, see `.github/skills/debug-with-playwright.md`.

## Common tripwires

Short list of recurring mistakes. Check here first when something breaks inexplicably.

- **`Space` is Jump only.** Scene transitions and dialog confirmation go through `Enter` (bound to `Confirm` / `Interact` / `ToggleInfo`). In Playwright, press `Enter`, not `Space`, to start the game from `MenuScene`.
- **Unsubscribe EventBus handlers on scene shutdown** (see Conventions). Missing this produces ghost handlers that fire for every future scene instance.
- **Never `import { saveManager } from '.../SaveManager'` in scene code** — go through `ProgressionSystem`. The one whitelisted exception is `SaveManager.hasSave()` for a "Continue" UI check.
- **Mask graphics for a scrollFactor:0 modal must also set `scrollFactor(0)`.** Otherwise a scrolled camera drags the mask off the modal and the content disappears (`src/ui/InfoDialog.ts`, `src/ui/ModalBase.ts`).
- **Elevator boundary clamp** must only zero velocity when moving *out* of bounds (`src/entities/Elevator.ts`). Clamping unconditionally at the start position blocks upward movement.
- **Platform Y = tile TOP, not tile center.** `LevelScene` adds `TILE_SIZE/2` when placing tiles.
- **Info icons start hidden**; a `zone:enter` is what reveals them. Do not set them visible in `create()`.
- **Local branches use `git worktree`**, not `git checkout -b`. This applies to docs-only and one-line changes too — no size-based exemptions. Switching the primary checkout clobbers shared `node_modules`/`dist`/`playwright-report` and breaks concurrent sessions. See `.github/skills/git-worktree.md`.

## Git branching — MANDATORY worktree-first workflow

**Rule (no exceptions unless the user overrides):** Before making ANY file edit that would land on a branch other than `main`, create a sibling git worktree at `C:\code\SoYouWantToBeAnArchitect-<slug>` on a new `fix/…` | `feat/…` | `chore/…` | `docs/…` branch. The primary checkout at `C:\code\SoYouWantToBeAnArchitect` stays on `main` and is **read-only for edits** during a session.

This applies to **every** task, including:
- Documentation-only changes (yes, even a one-line README tweak).
- "Trivial" or "tiny" edits — size is not an exemption.
- Updates to `.github/copilot-instructions.md` or `CLAUDE.md` themselves.

Do not rationalize skipping the worktree ("it's just docs", "it's one line", "I'll move it later"). If you catch yourself about to edit a file in `C:\code\SoYouWantToBeAnArchitect` that isn't in the session worktree, **stop and create the worktree first**.

The only exception: the user explicitly says to work on the current checkout / on `main` / without a worktree. Treat anything less explicit than that as "use a worktree".

Full workflow and integration steps live in `.github/skills/git-worktree.md`.

### Session workflow

1. **Start of session**: create a worktree branch for the session's work **before** touching any file. Ask the user for a short topic if it isn't obvious from the first request.
2. **During the session**: commit to that branch as normal. If a second unrelated task comes up, spin up an additional worktree rather than mixing concerns.
3. **End of session / work complete — ALWAYS open a PR.** Every coding session must end with a pull request. This is non-negotiable: the Copilot auto-review runs against PRs, and the sooner the PR exists the sooner that review can start. As soon as the session's work is committed and pushed, call `create_pull_request` — do not wait for the user to ask, do not stop at "pushed to branch", do not offer "PR or local merge" as a choice. If the user wants to merge locally instead, they will tell you; default to opening a PR. **Keep the worktree and branch alive after the PR is opened/merged** so the user can continue or revisit it. Only delete a worktree when the user explicitly asks.
4. **PRs are ALWAYS ready for review, NEVER drafts.** When calling `create_pull_request`, you **must** pass `draft: false` explicitly. Do not rely on defaults, do not omit the flag, do not pass `draft: true` under any circumstances. The only exception is if the user explicitly, in this session, asks for a draft PR — and even then, confirm before doing it. Shipping a draft PR when the user didn't ask for one is a critical failure: it blocks the Copilot auto-review from starting, which defeats the entire point of opening the PR.

## Response style

**Caveman mode is the default.** Every reply is terse-but-technical: drop articles / auxiliaries / hedging, prefer fragments and bullets, keep file paths / symbols / event names / numbers verbatim. Full rules and examples in `.github/skills/caveman-mode.md`. Opt out only when the user asks for verbose prose or requests a plan / design doc / PR description / commit message / review rationale.

## AI collaboration

When responding to feature requests or design ideas:

- **Challenge before implementing.** Identify trade-offs, edge cases, and simpler alternatives. Don't just build the first thing that comes to mind.
- **Offer options for non-trivial decisions.** Present at least two approaches with brief pros/cons; let the user choose.
- **Resist over-engineering.** If a 10-line change beats a new abstraction, say so.
- **Question assumptions.** "Do we actually need this?" is a valid question.
- **One change at a time.** Keep diffs small and reviewable; run the narrowest relevant checks (typecheck, lint, unit) before declaring done. **Ask the user before running `npm run test:e2e` or `npm run test:all`** — the Playwright suite is slow and should be opt-in.
