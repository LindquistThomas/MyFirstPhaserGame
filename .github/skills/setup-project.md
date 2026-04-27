# Skill: Setup Project

## Purpose

Bring a fresh clone of this repo to a runnable state, verify the toolchain, and confirm the dev server is serving the game. Use this skill when:

- You've just cloned the repo.
- `node_modules/` is missing or stale (e.g. after switching Node versions).
- You want to confirm typecheck / lint / unit tests still pass before starting work.

The project is already scaffolded (TypeScript strict, Phaser 3.90, Vite, Vitest, Playwright) — there is no "bootstrap from empty directory" step.

## Prerequisites

- **Node.js** — match what `package.json` / the lockfile were last built against. Any recent LTS (≥ 18) generally works.
- **npm** — the lockfile is `package-lock.json`. Do not substitute pnpm / yarn.

## Steps

1. Install dependencies:
   ```bash
   npm install
   ```
   This installs Phaser, Vite, Vitest, Playwright, ESLint, TypeScript, and everything declared in `devDependencies`.

2. (First-time only) Install Playwright browsers if you plan to run E2E tests:
   ```bash
   npx playwright install
   ```

3. Run the dev server to confirm the toolchain works end-to-end:
   ```bash
   npm run dev
   ```
   Vite serves on `http://localhost:3000` (port configured in `vite.config.ts`). The game should boot into `MenuScene`.

4. Run the fast local checks before starting or finishing work:
   ```bash
   npm run typecheck
   npm run lint
   npm run test:unit
   ```
   These three together are the "pre-PR gate" for pure-docs changes; for code changes, consider `npm run test:all` (slow — ask the user first).

## Scripts reference

From `package.json`:

| Script | Purpose |
| --- | --- |
| `npm run dev` | Vite dev server (`window.__game` / `__testHooks` always on unless `VITE_EXPOSE_TEST_HOOKS=false`). |
| `npm run build` | `tsc && vite build` — typecheck is part of the build. |
| `npm run preview` | Serve the production build locally. |
| `npm run lint` | ESLint across the repo. |
| `npm run typecheck` | `tsc --noEmit`. |
| `npm run test:unit` | Vitest (pure logic; jsdom). |
| `npm run test:unit:watch` | Vitest in watch mode. |
| `npm run test:unit:coverage` | Vitest with coverage; 80% floor on `src/systems/**` and `src/input/**`; 60% floor on `src/ui/**` and `src/entities/**`. |
| `npm run test:e2e` | Playwright integration specs. |
| `npm run test:headed` / `test:ui` | Playwright with visible browser / interactive UI. |
| `npm run test:report` | Open the last Playwright HTML report. |
| `npm run test:visual:update` | Refresh visual snapshot PNGs. |
| `npm test` | `test:unit && test:e2e`. |
| `npm run test:all` | `typecheck && lint && test:unit --coverage && test:e2e` — opt-in, slow. |

## Conventions to keep in mind

- **TypeScript strict, ES modules.** Do not add `.js` source files.
- **No `public/assets/` directory.** Sprites and SFX are generated procedurally at runtime by `SpriteGenerator` and `SoundGenerator`. Static files: `public/music/` (MP3/OGG tracks) and `public/brand/` (the Norconsult Digital wordmark SVG, loaded as `lobby_logo` at boot).
- **Filenames.** Scenes, entities, UI components, and systems use PascalCase filenames matching the exported class. Config / tooling files are lowercase.
- **Test-hook globals.** `src/main.ts` exposes `window.__game` (Phaser.Game) and `window.__testHooks` (`{ QuizDialog, canRetryQuiz, eventBus }`) whenever `VITE_EXPOSE_TEST_HOOKS !== 'false'` — default-on in dev, preview, and production. Playwright relies on both. Build with `VITE_EXPOSE_TEST_HOOKS=false` for a hardened bundle (see README "Build flags").

## Adding new scenes / floors / content

See the companion skills:

- `.github/skills/new-scene.md` — adding a Phaser scene (infrastructure, floor, or product room).
- `CLAUDE.md` → "How to extend" — the canonical how-to index for floors, enemies, sound effects, music, info cards, quizzes, and zones.

## Notes

- `.gitignore` already covers `node_modules/`, `dist/`, Vite cache, Playwright reports, and coverage output.
- If `npm install` fails with peer-dep errors, check your Node version against the lockfile's build environment rather than forcing `--legacy-peer-deps`.
