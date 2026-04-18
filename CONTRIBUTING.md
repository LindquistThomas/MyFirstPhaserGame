# Contributing to So You Want To Be An Architect

## About This Project

A 2D platformer about becoming an IT architect, built with Phaser 3 and
TypeScript. Every sprite and sound is generated procedurally — the game
ships with zero image assets and only a handful of music files.

## Getting Started

1. Clone the repository:
   ```bash
   git clone https://github.com/LindquistThomas/SoYouWantToBeAnArchitect.git
   cd SoYouWantToBeAnArchitect
   ```

2. Install dependencies and start the dev server:
   ```bash
   npm install
   npm run dev
   ```

3. Open <http://localhost:3000> in your browser.

## Project Conventions

| Area          | Convention                                                       |
|---------------|------------------------------------------------------------------|
| Language      | TypeScript, strict mode, ES modules                              |
| Bundler       | Vite                                                             |
| Framework     | Phaser 3 (Arcade physics)                                        |
| Config        | `src/config/` — single source of truth for constants / data     |
| Scenes        | `src/scenes/` — PascalCase, one class per file                  |
| Entities      | `src/entities/` — gameplay objects (Player, Elevator, Token)    |
| Systems       | `src/systems/` — cross-cutting logic (audio, save, progression) |
| Input         | `src/input/` — semantic-action layer; import from `input/` only |
| UI            | `src/ui/` — dialogs, HUD, icons, buttons                        |
| Plugins       | `src/plugins/` — Phaser plugins                                 |
| Music assets  | `public/music/` — only runtime-loaded files                     |
| License       | MIT                                                              |

## Naming conventions

Consistent naming keeps the tree searchable and makes ownership obvious.

### Files

| Kind                                   | Case       | Example                                   |
|----------------------------------------|------------|-------------------------------------------|
| Scenes (Phaser `Scene` subclasses)     | PascalCase | `PlatformTeamScene.ts`                    |
| Entities (Phaser `GameObject` classes) | PascalCase | `Player.ts`, `Elevator.ts`                |
| UI widgets / dialogs                   | PascalCase | `QuizDialog.ts`, `InfoIcon.ts`            |
| Managers (stateful, per-feature)       | PascalCase | `QuizManager.ts`, `SaveManager.ts`        |
| Services (shared, injectable)          | PascalCase | `InputService.ts`                         |
| Plugins                                | PascalCase | `DebugPlugin.ts`                          |
| Pure data / config modules             | camelCase  | `gameConfig.ts`, `levelData.ts`           |
| Config barrels with per-floor shards   | lowercase  | `config/info/`, `config/quiz/`            |
| Per-floor shards inside those barrels  | lowercase  | `config/info/platform.ts`                 |
| Test files                             | mirror src | `<name>.test.ts` next to the module       |

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
  slots, info-seen flags). Imported directly where it's used.
- `*Service` → shared, injectable cross-feature collaborator. Today only
  `InputService`; future examples include `GameStateManager` from
  Tier C.
- `*Dialog`, `*Icon`, `*Panel` → UI widget built on Phaser containers.
- `*Controller` → orchestration glue inside a scene (e.g.
  `ElevatorController`, `DialogController`). Short-lived, no persistence.

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
2. Make your change. Keep gameplay logic in `systems/` and `entities/`,
   and put rendering/interaction code in `scenes/` and `ui/`.
3. Cross-system communication goes through the typed event bus in
   `src/systems/EventBus.ts` — the `GameEvents` map is the catalog of
   every event name and its payload.
4. Run the tests:
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
5. Commit with a short, descriptive message.
6. Open a pull request.

See [`docs/architecture.md`](docs/architecture.md) for a module map and
the data-flow overview.

## What Not to Do

- Do not scatter asset generation across scenes; all runtime sprite /
  sound generation happens in `BootScene` via `generateSprites` and
  `generateSounds`.
- Do not duplicate config values — add them to `src/config/` once.
- Do not add untyped `any`; strict TypeScript is enforced in CI via
  `npm run build`.
- Do not commit `node_modules/`, `dist/`, or Vite cache files (already
  in `.gitignore`).
- Do not introduce new build tools or frameworks without discussion.
