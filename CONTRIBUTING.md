# Contributing to So You Want To Be An Architect

## About This Project

A 2D platformer about becoming an IT architect, built with Phaser 3 and
TypeScript. Every sprite and sound is generated procedurally — the game
ships with zero image assets and only a handful of music files.

## Getting Started

1. Clone the repository:
   ```bash
   git clone https://github.com/norconsult-digital/architect-elevator-game.git
   cd architect-elevator-game
   ```

2. Install dependencies and start the dev server:
   ```bash
   npm install
   npm run dev
   ```

3. Open <http://localhost:3000> in your browser.

## Project Conventions

| Area          | Convention                                                                       |
|---------------|----------------------------------------------------------------------------------|
| Language      | TypeScript, strict mode, ES modules                                              |
| Bundler       | Vite                                                                             |
| Framework     | Phaser 3 (Arcade physics)                                                        |
| Config        | `src/config/` — `gameConfig`, `levelData`, `audioConfig`, plus barrel re-exports for per-floor info + quiz |
| Floors        | `src/features/floors/<floor>/` — Scene + `info.ts` + `quiz.ts` (+ optional `enemies.ts`) co-located |
| Scenes        | `src/scenes/` — infrastructure scenes only: `core/` (Boot, Menu), `elevator/` |
| Product scenes | `src/features/products/rooms/` — product content scenes (one per ISY room)   |
| Entities      | `src/entities/` — gameplay objects (Player, Elevator, Token, Enemy)              |
| Systems       | `src/systems/` — cross-cutting logic (EventBus, GameStateManager, Audio, Save, Progression) |
| Input         | `src/input/` — semantic-action layer; import from `input/` only                  |
| UI            | `src/ui/` — dialogs, HUD, icons, buttons                                         |
| Theme tokens  | `src/style/theme.ts` — colour + spacing catalogue (both `0x…` and `#…` forms)    |
| Plugins       | `src/plugins/` — Phaser plugins                                                  |
| Music assets  | `public/music/` — only runtime-loaded files                                      |
| License       | MIT                                                                              |

## Naming conventions

Consistent naming keeps the tree searchable and makes ownership obvious.

### Files

| Kind                                   | Case       | Example                                           |
|----------------------------------------|------------|---------------------------------------------------|
| Scenes (Phaser `Scene` subclasses)     | PascalCase | `PlatformTeamScene.ts`, `ElevatorScene.ts`        |
| Entities (Phaser `GameObject` classes) | PascalCase | `Player.ts`, `Elevator.ts`                        |
| UI widgets / dialogs                   | PascalCase | `QuizDialog.ts`, `InfoIcon.ts`                    |
| Managers (stateful, per-feature)       | PascalCase | `QuizManager.ts`, `SaveManager.ts`                |
| Services (shared, injectable)          | PascalCase | `InputService.ts`, `GameStateManager.ts`          |
| Plugins                                | PascalCase | `DebugPlugin.ts`                                  |
| Pure data / config modules             | camelCase  | `gameConfig.ts`, `levelData.ts`, `theme.ts`       |
| Per-floor feature folder               | lowercase  | `src/features/floors/platform/`                   |
| Per-floor shard files                  | lowercase  | `info.ts`, `quiz.ts`, `enemies.ts`                |
| Config barrel directories              | lowercase  | `config/info/`, `config/quiz/` (re-export only)   |
| Test files                             | mirror src | `<name>.test.ts` next to the module               |

### Class / symbol casing

- **Classes**: PascalCase (`ZoneManager`, `QuizDialog`).
- **Types / interfaces**: PascalCase, no `I` prefix (`FloorData`, not `IFloorData`).
- **Exported constants**: SCREAMING_SNAKE_CASE (`QUIZ_PASS_THRESHOLD`, `FLOORS`).
- **Functions / methods / variables**: camelCase.
- **Scene keys** passed to `scene.start()`: PascalCase matching the class
  name (`'PlatformTeamScene'`, not `'platform_team'`).

### Terminology

One canonical word per concept. No synonyms in code or UI strings.

| Concept                                | Canonical term | Do not use                      |
|----------------------------------------|----------------|---------------------------------|
| The earned currency / progression unit | **AU**         | ~~token~~, ~~points~~, ~~coin~~ |
| The pickup sprite that awards AU       | **token**      | (only use for the sprite)       |
| A room/level (one scene)               | **floor**      | ~~level~~ in user-facing copy   |

If you need a new term, add it to this table in the same PR so the next
contributor doesn't invent a third synonym.

### Language

- User-facing strings: **English**. The game targets an international
  audience.
- Product names that are already Norwegian (e.g. *ISY Beskrivelse*) stay
  as-is; that is the real product name. Everything else — team names,
  scene names, class names, file names — is English.

### Suffixes (what a name tells you)

- `*Scene`  → a Phaser `Scene` subclass.
- `*Manager` → stateful module that owns a feature (quiz records, save
  slots, info-seen flags). Imported directly where it's used, or
  composed into `GameStateManager`. Note: `GameStateManager` itself
  follows the `*Manager` naming for symmetry with what it wraps, but
  it plays the role of a shared injectable service (see below).
- `*Service` → shared, injectable cross-feature collaborator.
  `InputService` (attached as a scene plugin) and `GameStateManager`
  (constructed once in `BootScene.create()` and stashed under
  `scene.registry.get('gameState')`).
- `*Dialog`, `*Icon`, `*Panel` → UI widget built on Phaser containers.
- `*Controller` → orchestration glue inside a scene (e.g.
  `ElevatorController`, `DialogController`). Short-lived, no persistence.
- `*Context` → typed data container for cross-scene hand-off (today:
  `NavigationContext`). No behaviour, just shape.

## Scripts

| Command                     | What it does                                        |
|-----------------------------|-----------------------------------------------------|
| `npm run dev`               | Vite dev server on <http://localhost:3000>          |
| `npm run build`             | Type-check with `tsc`, then bundle with Vite        |
| `npm run typecheck`         | Type-check only (`tsc --noEmit`)                    |
| `npm run lint`              | ESLint over the whole project                       |
| `npm run preview`           | Preview the production build                        |
| `npm test`                  | Unit tests + E2E tests                              |
| `npm run test:all`          | Typecheck + lint + unit (with coverage) + E2E       |
| `npm run test:unit`         | Vitest unit tests (pure logic, jsdom)               |
| `npm run test:unit:watch`   | Vitest watch mode                                   |
| `npm run test:unit:coverage`| Unit tests + coverage (V8, HTML report)             |
| `npm run test:e2e`          | Playwright end-to-end tests                         |
| `npm run test:headed`       | Playwright in headed mode                           |
| `npm run test:ui`           | Playwright UI runner                                |
| `npm run test:visual:update`| Refresh visual-regression snapshots                 |

## Making Changes

1. Create a branch from the default branch.
2. Make your change.
   - Gameplay logic → `systems/` and `entities/`.
   - Rendering / interaction → `scenes/` (infrastructure) or
     `features/floors/<floor>/` (per-floor content).
   - UI widgets → `ui/`.
   - Colours and spacing → `src/style/theme.ts`, not inline hex
     literals.
3. Cross-system communication goes through the typed event bus in
   `src/systems/EventBus.ts` — the `GameEvents` map is the catalog of
   every event name and its payload.
4. Persistent game state should go through `GameStateManager`
   (`src/systems/GameStateManager.ts`), retrieved from
   `scene.registry.get('gameState')`. For new scene/UI code, prefer
   this facade over importing the underlying stores (`SaveManager`,
   `QuizManager`, `InfoDialogManager`, `ProgressionSystem`) directly
   — the facade keeps tests injectable via a single `KVStorage` fake.
   A handful of existing UI modules (e.g. `ui/QuizDialog`,
   `ui/QuizResultsScreen`, `ui/DialogController`) still import those
   stores directly; treat them as a migration target rather than a
   pattern to copy.
5. Scene transitions go through `scenes/NavigationContext.ts`. Pass
   a typed context to `scene.scene.start(key, ctx)` rather than
   stashing spawn hints on `scene.registry`.
6. Scene teardown should use `createSceneLifecycle(scene)` from
   `src/systems/sceneLifecycle.ts` for event-bus and input
   subscriptions — one disposer list that fires on both `shutdown`
   and `destroy`.
7. Run the tests:
   ```bash
   npm run test:all
   ```

   Or, piecewise during development:
   ```bash
   npm run test:unit          # fast, no browser
   npm run test:unit:coverage # with coverage report
   npm run test:e2e           # Playwright, boots Vite
   ```

   **Visual regression:** The `tests/visual.spec.ts` spec uses
   `toHaveScreenshot` for static UI (menu, HUD, dialogs). If you
   intentionally change the visual appearance of one of those, refresh
   the baseline with:

   ```bash
   npm run test:visual:update
   ```

   Review the new snapshots in `tests/visual.spec.ts-snapshots/` before
   committing.
8. Commit with a short, descriptive message.
9. Open a pull request.

See [`docs/architecture.md`](docs/architecture.md) for a module map and
the data-flow overview.

## What Not to Do

- Do not scatter asset generation across scenes; all runtime sprite /
  sound generation happens in `BootScene` via `generateSprites` and
  `generateSounds`.
- Do not duplicate config values — add them to `src/config/` (shared
  constants) or the owning `features/floors/<floor>/` folder (per-floor
  content) once.
- Do not inline colour or spacing magic numbers in scenes or UI. Pull
  from `src/style/theme.ts`. Procedural sprite palettes inside
  `systems/sprites/*` are the allowed exception — they are asset-local.
- Avoid adding new direct imports of `SaveManager`, `QuizManager`,
  `InfoDialogManager`, or `ProgressionSystem` from scenes or UI;
  prefer `GameStateManager` (`scene.registry.get('gameState')`) so
  tests can inject a fake `KVStorage` in one place. Some existing
  UI modules still import these stores directly — those are legacy
  and should migrate, not be duplicated.
- Do not stash spawn state on `scene.registry` for hand-off between
  scenes. Use `NavigationContext` and the typed `scene.scene.start(key,
  ctx)` form.
- Do not add untyped `any`; strict TypeScript is enforced in CI via
  `npm run build`.
- Do not commit `node_modules/`, `dist/`, or Vite cache files (already
  in `.gitignore`).
- Do not introduce new build tools or frameworks without discussion.
