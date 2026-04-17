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
| UI            | `src/ui/` — dialogs, HUD, icons, buttons                        |
| Plugins       | `src/plugins/` — Phaser plugins                                 |
| Music assets  | `public/music/` — only runtime-loaded files                     |
| License       | MIT                                                              |

## Scripts

| Command                    | What it does                                 |
|----------------------------|----------------------------------------------|
| `npm run dev`              | Vite dev server on <http://localhost:3000>   |
| `npm run build`            | Type-check with `tsc`, then bundle with Vite |
| `npm run preview`          | Preview the production build                 |
| `npm test`                 | Playwright end-to-end tests                  |
| `npm run test:unit`        | Vitest unit tests (pure logic, jsdom)        |
| `npm run test:unit:watch`  | Vitest watch mode                            |

## Making Changes

1. Create a branch from the default branch.
2. Make your change. Keep gameplay logic in `systems/` and `entities/`,
   and put rendering/interaction code in `scenes/` and `ui/`.
3. Cross-system communication goes through the typed event bus in
   `src/systems/EventBus.ts` — the `GameEvents` map is the catalog of
   every event name and its payload.
4. Run the tests:
   ```bash
   npm run test:unit
   npm run build
   npm test
   ```
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
