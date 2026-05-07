# So You Want To Be An Architect

<!-- SYNC NOTICE: This file and .github/copilot-instructions.md share the same
     project instructions. When you edit one, update the other to match. -->

A TypeScript + Phaser 3 platformer about IT architecture, bundled with Vite. Progression-based: collect AU (Architecture Utility) to unlock floors of a building, each representing a domain team.

## Repository structure

```
.
├── index.html                # Vite entry (loads src/main.ts)
├── package.json              # Scripts, deps (phaser ^3.90)
├── tsconfig.json             # TypeScript strict
├── vite.config.ts            # Bundler config
├── vitest.config.ts          # Unit tests (jsdom, 80% floor on src/systems & src/input; 65% (60% branches) on src/ui; 60% on src/entities; 20% on src/scenes; 50% on src/features/floors)
├── playwright.config.ts      # E2E / visual tests
├── eslint.config.js
├── public/
│   ├── brand/                # Norconsult Digital wordmark SVG (loaded as `lobby_logo` at boot)
│   └── music/                # MP3/OGG/WAV music tracks; eager subset preloaded in BootScene, rest lazy-loaded by MusicPlugin
├── src/
│   ├── main.ts               # Phaser.Game bootstrap; spreads SCENE_CLASSES from sceneRegistry
│   ├── config/               # gameConfig, levelData, audioConfig, levelGeometry, achievements; info/ and quiz/ barrels
│   ├── entities/             # Player, Enemy (+ enemies/), Token, DroppedAU, Elevator,
│   │                         # MovingPlatform, Coffee, EnergyDrinkFridge, CEOBoss,
│   │                         # CoffeeMugProjectile, BriefcaseProjectile, PistolProjectile,
│   │                         # MissionItem, Checkpoint
│   ├── features/
│   │   ├── floors/           # _shared/ (LevelScene + Level*Manager helpers, coachHints,
│   │   │                       floorAccents/Patterns, sceneBackdrop, validateLevelConfig, defineFloorScene), one dir per floor (lobby/, platform/, architecture/,
│   │   │                       finance/, product/, customer/, executive/, boss/)
│   │   └── products/rooms/   # Per-product content scenes (ProductRoomScene, ProductIsy* etc.)
│   ├── input/                # GameAction enum + DEFAULT_BINDINGS table; InputService scene plugin
│   ├── plugins/              # MusicPlugin, DebugPlugin, ScopedEventBus (Phaser ScenePlugins)
│   ├── scenes/               # core/ (BootScene, MenuScene, SettingsScene,
│   │                         # ControlsScene, PauseScene, SaveSlotScene),
│   │                         # elevator/, NavigationContext, sceneRegistry,
│   │                         # lazySceneLoaders
│   ├── style/                # theme.ts (colour/spacing tokens) + responsive.ts (viewport helpers)
│   ├── systems/              # ProgressionSystem, GameStateManager, EventBus, ZoneManager,
│   │                         # AudioManager, QuizManager, InfoDialogManager, SaveManager,
│   │                         # PersistedStore, SettingsStore, AchievementManager, TouchHintStore,
│   │                         # MotionPreference, CaffeineBuff, FloorHitState, PlaytimeTracker,
│   │                         # Analytics, sceneLifecycle, sliderUtils,
│   │                         # SpriteGenerator (+ sprites/ per-asset families),
│   │                         # SoundGenerator (+ sounds/ per-SFX families)
│   └── ui/                   # InfoDialog, QuizDialog, ModalBase, ElevatorButtons, ElevatorPanel,
│                               InfoIcon, HUD, DialogController, …
├── docs/                     # architecture.md, eventbus-audit.md, archive/ (shipped specs)
├── scripts/                  # check-size.cjs — bundle-size budget gate (used by `npm run size`)
├── idea/                     # design notes / brainstorm dump (not part of build)
├── tests/                    # Playwright specs + helpers/ (see testing section)
└── .github/
    ├── copilot-instructions.md   # Mirror of this file (keep in sync)
    └── skills/                   # add-game-object, caveman-mode, debug-with-playwright, git-worktree, new-scene, setup-project
```

See `docs/architecture.md` for the full module map.

There is **no** `public/assets/` directory. Static files: `public/music/` (MP3/OGG/WAV tracks; the `eager: true` subset of `STATIC_MUSIC_ASSETS` is preloaded in `BootScene.preload()`, the rest are lazy-loaded by `MusicPlugin` on first use) and `public/brand/` (the Norconsult Digital wordmark SVG, loaded as `lobby_logo`). Sprites and SFX are still generated procedurally by `SpriteGenerator` / `SoundGenerator`.

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
| `npm run test:unit:coverage` | Vitest with coverage; 80% floor on `src/systems/**` and `src/input/**`; 65% (60% branches) on `src/ui/**`; 60% on `src/entities/**`; 20% (18% functions) on `src/scenes/**`; 50% (40% branches, 45% functions) on `src/features/floors/**`. |
| `npm run test:e2e` | Playwright integration specs (excludes `@visual`). |
| `npm run test:headed` / `test:ui` | Playwright with visible browser / interactive UI. |
| `npm run test:visual:update` | Run the `@visual` suite and refresh snapshot PNGs — the only script that exercises visual specs. To verify against existing baselines without updating, invoke `npx playwright test tests/visual.spec.ts --grep @visual` directly. |
| `npm run preview` | Serve the production build locally (`vite preview`). |
| `npm run test:unit:watch` | Vitest in watch mode. |
| `npm run test:report` | Open the last Playwright HTML report. |
| `npm run size` | `node scripts/check-size.cjs` — bundle-size budget gate (also runs in CI). |
| `npm test` | `test:unit && test:e2e`. |
| `npm run test:all` | `npm run typecheck && npm run lint && npm run test:unit -- --coverage && npm run test:e2e` — the pre-PR gate. |

**Before declaring work done:** run `npm run typecheck && npm run lint && npm run test:unit`. **Do not run `npm run test:e2e` or `npm run test:all` without asking the user first** — the Playwright suite is slow and should be opt-in. For pure-docs changes, `npm run lint && npm run typecheck` is sufficient.

## Architecture pointers

Short index of where things live. Reach for these instead of re-implementing.

- **`GameStateManager`** (`src/systems/GameStateManager.ts`) — composition root for persistent state. Constructed once in `BootScene.create()` and stashed in `scene.registry` under the key `gameState`. Owns the `ProgressionSystem` and `PlaytimeTracker` instances and exposes facades over `SaveManager`, `QuizManager`, `InfoDialogManager`, `AchievementManager`, and `TouchHintStore`. **New scene/UI code reads it via `this.registry.get('gameState') as GameStateManager` rather than importing the underlying stores directly** — tests inject a fake `KVStorage` into the constructor to swap localStorage atomically. Some legacy UI modules still import the stores directly; treat them as a migration target, not a pattern.
- **`ProgressionSystem`** (`src/systems/ProgressionSystem.ts`) — tracks `totalAU`, `floorAU`, `unlockedFloors`, `currentFloor`, `collectedTokens`. Exposed via `gameState.progression` in scenes — direct construction is reserved for tests. Persists via `SaveManager` (localStorage key `architect_<slot>_v1`; canonical slots `slot1` / `slot2` / `slot3` selected in `SaveSlotScene`. Legacy `architect_default_v1` is migrated to `architect_slot1_v1` on first load — see `src/systems/SaveManager.ts` (`migrateDefaultSlot()`)).
- **`SaveManager`** — infrastructure. Scenes must not import it; use `ProgressionSystem`. The one exception is `SaveManager.hasSave()` for UI checks (e.g. a "Continue" button).
- **`EventBus`** (`src/systems/EventBus.ts`) — typed pub/sub singleton. The `GameEvents` map is the single source of truth for event names and payloads; add new events there and all call sites become type-checked. No Phaser dependency.
- **`ZoneManager`** (`src/systems/ZoneManager.ts`) — registers named zones with arbitrary `check: () => boolean` predicates, emits `zone:enter` / `zone:exit` on state change only. UI reacts to events; `getActiveZone()` is a synchronous query for keyboard handlers. Default pattern for anything that should appear only in a specific area of a scene.
- **`AudioManager`** + **`MusicPlugin`** — fully reactive. Scenes don't play audio directly; entities emit `sfx:*` / `music:*` events. Scene music is auto-driven by `SCENE_MUSIC` in `src/config/audioConfig.ts` via `MusicPlugin`. Player settings (mute, volumes, music style, control bindings) persist under localStorage key `architect_settings_v1` via `SettingsStore` (`src/systems/SettingsStore.ts`). The legacy `architect_audio_muted_v1` key is migrated on first load and then deleted. Reduced-motion override has its own key `architect_reduce_motion_v1` via `MotionPreference` (`src/systems/MotionPreference.ts`); `isReducedMotion()` reads it and falls back to the system `prefers-reduced-motion` query.
- **`SoundGenerator`** — procedural SFX generated at runtime and registered as Phaser audio keys. Music is loaded from `public/music/` (MP3/OGG/WAV). Eager tracks (`STATIC_MUSIC_ASSETS` entries with `eager: true`) preload in `BootScene.preload()`; the rest are lazy-loaded by `MusicPlugin` on first use/request. The procedural lullaby track is also generated here (no separate MusicGenerator module).
- **`SpriteGenerator`** — procedural pixel-art textures for player, enemies, tokens, platforms, elevator cab, etc.
- **`QuizManager`** (localStorage key `architect_quiz_v1`) — quiz completion + cooldowns. Data under `src/config/quiz/` (barrel `index.ts`).
- **`InfoDialogManager`** (localStorage key `architect_info_seen_v1`) — tracks which info dialogs the player has opened. Content under `src/config/info/` (barrel `index.ts`).
- **`AchievementManager`** (localStorage key `architect_achievements_v1`) — tracks unlocked achievement IDs. `checkAchievements()` in `GameStateManager` is the single check-point, called from `LevelScene`, `LevelTokenManager`, `LevelDialogBindings`, `ElevatorScene`, `ExecutiveSuiteScene`, and `BossArenaScene`.
- **`TouchHintStore`** (localStorage key `architect_touch_hint_seen_v1`) — records whether the first-run virtual-gamepad hint has been shown. `clearSeen()` is called in `GameStateManager.resetAll()`.
- **`PlaytimeTracker`** (`src/systems/PlaytimeTracker.ts`) — tracks total + per-floor active playtime and run timer; persists via `PlaytimeSaveAdapter` (10 s flush throttle). Owned by `GameStateManager` as `gameState.playtime`.
- **`Analytics`** (`src/systems/Analytics.ts`) — opt-in analytics. Gated on `VITE_ANALYTICS_ENDPOINT` (build-time) **and** `SettingsStore.analyticsConsent` (runtime). `createAnalyticsService()` returns `null` when endpoint absent → no network path. `BootScene` stores the service in `scene.registry` under key `'analytics'` (`registry.set`); scenes retrieve it via `registry.get('analytics')`. Anonymous client ID under `architect_analytics_client_v1`.
- **`MotionPreference`** (`src/systems/MotionPreference.ts`, localStorage key `architect_reduce_motion_v1`) — persisted user override for reduced motion (`true` / `false` / `null` to follow OS `prefers-reduced-motion`). Read via `isReducedMotion()`.
- **`touchPrimary`** (`src/ui/touchPrimary.ts`, localStorage key `architect_touch_override_v1`) — manual override of the touch-primary detection (`'true'` | `'false'` | unset). Used to force the virtual gamepad on/off in tests and edge devices.
- **`LevelScene`** (`src/features/floors/_shared/LevelScene.ts`) — shared base for floor scenes. Sibling helpers (`LevelDialogBindings`, `LevelEnemySpawner`, `LevelTokenManager`, `LevelZoneSetup`, `LevelCoffeeManager`, `LevelFridgeManager`, `LevelRoomElevators`) compose the shared concerns. Floor-specific scenes (`PlatformTeamScene`, `FinanceTeamScene`, etc.) live under `src/features/floors/<floor>/` and provide a complete `LevelConfig` (see the type definition for required fields such as `floorId`, `playerStart`, `exitPosition`, and `roomElevators`, plus authored collections like `platforms`, `tokens`, `enemies`, and `infoPoints`). Enemy entries use `type: 'slime' | 'bot' | 'scope-creep' | 'astronaut' | 'tech-debt-ghost' | 'terrorist'`. Enemies are scene-local, no persistence; they respawn on re-entry.
- **Input** (`src/input/`) — `GameAction` enum + `DEFAULT_BINDINGS` table. Never reference raw `KeyCode`s elsewhere. `InputService` is a Phaser ScenePlugin mapped to `scene.inputs`.

## Conventions

- **EventBus lifecycle**: subscribe via `this.scopedEvents.on(...)` (auto-cleaned on shutdown) or `const lc = createSceneLifecycle(this); lc.bindEventBus(...)` (also covers input + DOM listeners). Raw `eventBus.on`/`eventBus.once` in `*Scene.ts` files is blocked by ESLint (`eslint.config.js`).
- **Zone-gated UI** (info icons, lobby kiosks, …) starts hidden; `zone:enter`/`zone:exit` reveals and hides it. Never initialise a zone-gated element as visible.
- **Direct calls beat events** for parent→child updates (e.g. refreshing a quiz badge on an `InfoIcon` after a dialog closes). Use EventBus only for loose coupling across systems.
- **Gameplay mechanics that share a widget with content zones** (e.g. in-room lift buttons) must drive visibility from physics state, not from `ZoneManager`. Content zones are for informational content only.
- **Persistent state lives in `ProgressionSystem`**. When adding a new persistent field:
  1. Extend `SaveData` in `SaveManager.ts` and `ProgressionState` in `ProgressionSystem.ts`.
  2. Update `defaultState()`, `persist()`, `loadFromSave()`.
  3. Call `this.persist()` after any mutation that must survive a reload.
- **Text resolution**: `main.ts` monkey-patches `scene.add.text` / `scene.make.text` to default to `resolution: 1.5` so glyphs stay crisp after FIT scaling. Elements that need maximum crispness (HUD AU counter in `CoinCounterController`, dialog title in `InfoDialog`, large menu headings in `MenuScene`) pass `resolution: 2` explicitly in their style object.
- **Test-hook globals**: `main.ts` exposes `window.__game` (Phaser.Game) and `window.__testHooks` (`{ QuizDialog, canRetryQuiz, eventBus }`) whenever `VITE_EXPOSE_TEST_HOOKS !== 'false'` — default-on in dev, preview, and production. Playwright relies on both. Build with `VITE_EXPOSE_TEST_HOOKS=false` for a hardened bundle without the globals (see README "Build flags").

## How to extend

### Add a scene
Follow `.github/skills/new-scene.md`. Key steps: create the scene in the appropriate folder — `src/scenes/core/<Name>Scene.ts` or `src/scenes/elevator/<Name>Scene.ts` for infrastructure scenes, `src/features/products/rooms/<Name>Scene.ts` for product content scenes (floor scenes go under `src/features/floors/` — see the next section) — extend `Phaser.Scene`, register it in `src/scenes/sceneRegistry.ts` (the single source of truth — `main.ts` spreads `SCENE_CLASSES` from there; do **not** edit the `scene:` array in `main.ts` directly), and — if it needs music — add a `SCENE_MUSIC` entry in `src/config/audioConfig.ts`. **Eager vs lazy**: core/elevator scenes go into `EAGER_REGISTRY` in `src/scenes/sceneRegistry.ts` (imported at the top, available at startup); floor, product-room, and boss scenes go into `LOADERS` in `src/scenes/lazySceneLoaders.ts` as `{ key: '<Name>TeamScene', loader: () => import('…').then(m => m.<Name>TeamScene) }` — they are fetched on demand by `ElevatorScene.lazyStartScene()`.

### Add a floor / level
Create `src/features/floors/<floor>/<Name>TeamScene.ts` subclassing `LevelScene` (import from `../_shared/LevelScene`) and provide a `LevelConfig` with the required fields `floorId`, `playerStart`, `exitPosition`, `platforms`, `tokens`, and `roomElevators` (any of these arrays may be `[]`), plus optional content arrays `catwalks`, `movingPlatforms`, `enemies`, `infoPoints`, `coffees`, `fridges`, and `checkpoints`. See `src/features/floors/_shared/LevelScene.ts` for the authoritative full interface. Register in `LEVEL_DATA` (`src/config/levelData.ts`) with unlock cost and theme, and add a lazy entry `{ key: '<Name>TeamScene', loader: () => import('../features/floors/<floor>/<Name>TeamScene').then(m => m.<Name>TeamScene) }` to the `LOADERS` array in `src/scenes/lazySceneLoaders.ts`. `validateSceneRegistry()` runs at boot in dev and will fail loudly if `LEVEL_DATA` keys or `SCENE_MUSIC` keys do not match registered scene keys.

### Add an enemy
Declare it in the scene's `LevelConfig.enemies` array: `{ type: 'slime' | 'bot' | 'scope-creep' | 'astronaut' | 'tech-debt-ghost' | 'terrorist', x, y, minX?, maxX?, speed? }`. `minX`/`maxX` default to `x ± 160` when omitted (per `LevelEnemySpawner.spawn`). Implementations live in `src/entities/enemies/`. To add a new enemy *type*: (1) create the subclass under `src/entities/enemies/<Name>.ts` extending `Enemy`; (2) add the literal to the `type` union in `LevelConfig.enemies` (`src/features/floors/_shared/LevelScene.ts`); (3) add a `case` to the `switch` in `LevelEnemySpawner.spawn()` (`src/features/floors/_shared/LevelEnemySpawner.ts`) that constructs the new subclass.

### Add a sound effect
1. Add the waveform generator to the relevant family file under `src/systems/sounds/<family>.ts` (or create a new family file if none fits). Wire it into `generateSounds()` in `src/systems/SoundGenerator.ts` with `loadWav(scene, '<audio_key>', generateXxxSound())`.
2. Declare the event in `GameEvents` (`src/systems/EventBus.ts`) — TypeScript will now enforce correct usage everywhere.
3. Add the event→key mapping in `SFX_EVENTS` (`src/config/audioConfig.ts`).
4. Emit from the relevant entity: `eventBus.emit('sfx:myevent')`.

### Add music for a scene
1. Put the file in `public/music/<style>/`.
2. Add a `MusicAsset` entry to `STATIC_MUSIC_ASSETS` in `src/config/audioConfig.ts` with `key: 'music_<name>'` and `path: 'music/<file>'` (path is relative to `public/`). Set `eager: true` only if the track must be available at the very start of boot (currently no tracks need this); otherwise omit — `MusicPlugin` lazy-loads it on first scene entry.
3. Add a `SceneKey → music_<name>` entry in `SCENE_MUSIC`. `MusicPlugin` handles playback — no scene code needed.

### Add an info card
Add the entry to the relevant floor's `src/features/floors/<floor>/info.ts`. The barrel `src/config/info/index.ts` lazy-loads each floor's content via `INFO_LOADERS` and merges it into `INFO_POINTS` when `preloadInfoFor(floorId)` runs (called from `LevelScene.init()` and `ElevatorScene.init()`). For an **existing** floor, no other edits needed. For a **new** floor, also add an `INFO_LOADERS` entry keyed by `FLOORS.<NAME>`. Place an info point in the scene's `LevelConfig.infoPoints` with matching `contentId`. Zone IDs default to the content ID.

### Add a quiz
Add the question set to the relevant floor's `src/features/floors/<floor>/quiz.ts`, keyed by `infoId`. The barrel `src/config/quiz/index.ts` mirrors the info-loader pattern — an existing floor needs no further edits; a new floor also needs a `QUIZ_LOADERS` entry. Quiz state is tracked by `QuizManager`.

### Add a zone
Register in the scene's `create()`:
```ts
// Option A — ScopedEventBus (auto-cleaned on shutdown, preferred)
zoneManager.register('my-zone', () => /* boolean */);
this.scopedEvents.on('zone:enter', (id: string) => {
  if (id === 'my-zone') thing.setVisible(true);
});
this.scopedEvents.on('zone:exit', (id: string) => {
  if (id === 'my-zone') thing.setVisible(false);
});
// In update():
zoneManager.update();
```

```ts
// Option B — sceneLifecycle token (also covers input + DOM listeners)
const lc = createSceneLifecycle(this);
zoneManager.register('my-zone', () => /* boolean */);
lc.bindEventBus('zone:enter', (id) => { if (id === 'my-zone') thing.setVisible(true); });
lc.bindEventBus('zone:exit',  (id) => { if (id === 'my-zone') thing.setVisible(false); });
// In update():
zoneManager.update();
```

## Testing

Two suites, different purposes:

- **Vitest (`src/**/*.test.ts`, jsdom)** — pure logic, systems, input mapping. Fast. Coverage floors (per `vitest.config.ts`): 80% on `src/systems/**` and `src/input/**`; 65% (60% branches) on `src/ui/**`; 60% on `src/entities/**`; 20% (18% functions) on `src/scenes/**`; 50% (40% branches, 45% functions) on `src/features/floors/**`. `src/plugins/**`, the procedural sprite/sound generator modules, and `src/main.ts` are excluded entirely (see `vitest.config.ts` for the full exclusion list). Phaser is not instantiated; if a test needs scene-like behaviour, use `tests/helpers/phaserMock.ts`-style shims.
- **Playwright (`tests/*.spec.ts`)** — drives the actual dev server via `window.__game`. Use for end-to-end user flows, scene transitions, and visual snapshots.

Playwright helpers in `tests/helpers/playwright.ts`:

- `waitForGame(page)` — waits for `window.__game`, then focuses the canvas so keyboard input reaches Phaser.
- `waitForScene(page, 'SceneKey')` — waits for the scene to be active and settle.
- `waitForDialogOpen(page, 'SceneKey')` — waits until the scene's `DialogController.isOpen` is `true` (replaces fixed `waitForTimeout` after triggering a dialog).
- `waitForDialogClosed(page, 'SceneKey')` — inverse of the above.
- `seedFullProgressSave(page, { totalAU?, floorAU? })` — pre-populates the save slot and marks the elevator info dialog as seen so it doesn't swallow input.
- `clearStorage(page)` — wipes localStorage before boot.
- `attachErrorWatchers(page).assertClean()` — fails the test if any uncaught `pageerror`/console error leaked.

For detailed Playwright debugging recipes, see `.github/skills/debug-with-playwright.md`.

## Common tripwires

Short list of recurring mistakes. Check here first when something breaks inexplicably.

- **`Space` is Jump only.** Scene transitions and dialog confirmation go through `Enter` (bound to `Confirm` / `Interact` / `ToggleInfo`). In Playwright, press `Enter`, not `Space`, to start the game from `MenuScene`.
- **Never call `eventBus.on`/`eventBus.once` directly in `*Scene.ts`** — ESLint blocks it (`eslint.config.js`). Use `this.scopedEvents.on(...)` (auto-clean on shutdown) or `createSceneLifecycle(this).bindEventBus(...)`.
- **Never `import { saveManager } from '.../SaveManager'` in scene code** — go through `ProgressionSystem`. The one whitelisted exception is `SaveManager.hasSave()` for a "Continue" UI check.
- **Mask graphics for a scrollFactor:0 modal must also set `scrollFactor(0)`.** Otherwise a scrolled camera drags the mask off the modal and the content disappears (`src/ui/InfoDialog.ts`, `src/ui/ModalBase.ts`).
- **Elevator boundary clamp** must only zero velocity when moving *out* of bounds (`src/entities/Elevator.ts`). Clamping unconditionally at the start position blocks upward movement.
- **Platform Y = tile TOP, not tile center.** `LevelScene` adds `TILE_SIZE/2` when placing tiles.
- **Info icons start hidden**; a `zone:enter` is what reveals them. Do not set them visible in `create()`.
- **Local branches use `git worktree`**, not `git checkout -b`. This applies to docs-only and one-line changes too — no size-based exemptions. Switching the primary checkout clobbers shared `node_modules`/`dist`/`playwright-report` and breaks concurrent sessions. See `.github/skills/git-worktree.md`.

## Git branching — MANDATORY worktree-first workflow

**Rule (no exceptions unless the user overrides):** Before making ANY file edit that would land on a branch other than `main`, create a sibling git worktree on a new `fix/…` | `feat/…` | `chore/…` | `docs/…` branch. Sibling path: `<primary-checkout-name>-<slug>` (Windows convention: `C:\code\architect-elevator-game-<slug>`; macOS/Linux convention: `../architect-elevator-game-<slug>`). The primary checkout stays on `main` and is **read-only for edits** during a session. **Full OS-specific commands live in `.github/skills/git-worktree.md` — defer to it.**

This applies to **every** task, including:
- Documentation-only changes (yes, even a one-line README tweak).
- "Trivial" or "tiny" edits — size is not an exemption.
- Updates to `.github/copilot-instructions.md` or `CLAUDE.md` themselves.

Do not rationalize skipping the worktree ("it's just docs", "it's one line", "I'll move it later"). If you catch yourself about to edit a file in the primary checkout (the directory you cloned into) that isn't in the session worktree, **stop and create the worktree first**.

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
