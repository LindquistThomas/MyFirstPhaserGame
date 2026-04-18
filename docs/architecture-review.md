# Architecture & Structure Review

> A critical review of the repository, focused on **parallel-collaboration
> friction** and **readability**. Ordered by impact vs. effort so the team
> can pick up a subset.

## Context

The project is a Phaser 3 / TypeScript / Vite educational platformer
(~14K LOC). It has strong fundamentals (strict TS, event bus, pluggable
storage, CI with lint/type/unit/E2E, procedural assets) and good docs
(`docs/architecture.md`, `CONTRIBUTING.md`). The critical barriers to
scaling to a team are not missing features — they are:

1. A handful of **god files** that are merge-conflict magnets.
2. **Implicit scene hand-off** via the Phaser scene registry.
3. **Scattered per-floor content** (each floor touches five+ folders).
4. **Naming and organisation drift** (English/Norwegian, `AU`/`token`/
   `points`, flat `scenes/` directory).

This document identifies the concrete changes that will make the
codebase easier for multiple people to work on in parallel.

---

## 1. Findings

### 1a. God files (measured)

| File | Lines | Why it hurts parallel work |
|---|---|---|
| `src/config/quizData.ts` | **2,794** | Every quiz edit touches the same file |
| `src/scenes/ElevatorScene.ts` | **896** | Orchestrates shaft, transitions, product doors, HUD, dialogs |
| `src/scenes/LevelScene.ts` | **683** | Base class with 40+ protected methods used by 6 floor subclasses |
| `src/ui/QuizDialog.ts` | **656** | Question flow + shuffle + feedback + scoring + results screen |
| `src/config/infoContent.ts` | **576** | All educational copy in one file |
| `src/ui/InfoDialog.ts` | **510** | Scrolling + keyboard nav + links + quiz trigger |
| `src/entities/Elevator.ts` | **495** | Physics + docking + ride loop + music cues |
| `src/entities/Player.ts` | **408** | Movement + animation + invulnerability + dust + walk FPS |
| `src/scenes/MenuScene.ts` | **398** | Title rendering, nav, save-slot logic all inline |
| `src/systems/SoundGenerator.ts` | **358** | All SFX synthesis in one file |
| `src/scenes/ArchitectureTeamScene.ts` | **342** | Floor-specific content bloats a scene class |
| `src/ui/InfoIcon.ts` | **327** | Sprite + animation + badge + interactivity |

### 1b. Structural issues

- **Outdated architecture doc.** `docs/architecture.md` still references
  `Floor2Scene.ts` and lists `InputManager.ts` under `systems/`, but the
  code has moved to `src/input/InputService.ts` and the floors have been
  renamed (`PlatformTeamScene`, `ArchitectureTeamScene`,
  `FinanceTeamScene`, `ProductLeadershipScene`, `ExecutiveSuiteScene`).
  Stale docs are a parallel-work tax — newcomers read the wrong map.
- **Flat `scenes/` folder** with 14 top-level files covering boot, menu,
  elevator, 6 floors, hall, and exec suite. Two sub-folders (`elevator/`,
  `products/`) show the pattern started but wasn't applied uniformly.
- **Mixed naming.** Norwegian (`ProductIsyRoad`, `ProductAdminLisens`)
  mixed with English team names; file case inconsistent (`Player.ts`,
  `infoContent.ts`, `LevelScene.ts`).
- **Terminology drift.** "AU", "token", and "points" are used
  interchangeably in code and user-facing strings.
- **Implicit scene hand-off.** `ElevatorScene` writes spawn context to
  `this.registry`; `LevelScene` and floor subclasses read it back — no
  type, no schema, no single owner.
- **Hard-coded singleton wiring.** `ProgressionSystem`, `QuizManager`,
  `InfoDialogManager`, and `SaveManager` are imported directly by scenes
  and UI; nothing is injected. This is why scenes and UI are excluded
  from the unit-test coverage target — they're not testable in
  isolation.
- **Event listener cleanup is ad-hoc.** ~54 `eventBus` call sites across
  the tree; scenes subscribe in `create()` but teardown in `shutdown` is
  inconsistent — memory-leak / double-subscribe risk on scene restart.
- **Hardcoded theme values.** Colors and spacing live as magic numbers
  inside scene graphics calls plus a few constants in `gameConfig.ts`;
  no centralised `theme.ts` token layer.

### 1c. What's working well (do not regress)

- **`src/systems/EventBus.ts`.** Typed `GameEvents` catalog is the spine
  of cross-module communication. Keep.
- **`src/input/`.** Semantic-action layer with context stack and
  `index.ts` facade is a model the rest of the codebase should follow.
- **`src/systems/SaveManager.ts`.** Pluggable `KVStorage` is the only
  system with proper DI — the template for fixing other singletons.
- **`docs/architecture.md`.** The structure is right; the content needs
  an update.
- **Procedural assets.** Zero image/audio deps, fast builds. Keep.

---

## 2. Recommendations, prioritised

### Tier A — high impact, low effort (do first) — ✅ completed

1. **Split `quizData.ts` by floor.** ✅ Done — see `src/config/quiz/`.
   - Layout: `src/config/quiz/index.ts` + `quiz-lobby.ts`,
     `quiz-platform.ts`, `quiz-architecture.ts`, `quiz-finance.ts`,
     `quiz-product.ts`, `quiz-exec.ts`.
   - `index.ts` re-exports `QUIZ_DATA` and `getQuizFor(floorId)`;
     existing callers kept the same import surface.
2. **Split `infoContent.ts` the same way.** ✅ Done — see `src/config/info/`.
3. **Refresh `docs/architecture.md`.** ✅ Done — scene names corrected,
   `InputService` documented, module map updated.
4. **Adopt a naming convention in `CONTRIBUTING.md`.** ✅ Done — file,
   terminology, and class naming rules added.
5. **Group `scenes/` by feature.** ✅ Done — `scenes/core/`,
   `scenes/elevator/`, `scenes/floors/`, `scenes/hall/`,
   `scenes/products/`.

### Tier B — medium impact, medium effort (2–3 days each) — ✅ completed

6. **Introduce `NavigationContext` for scene transitions.** ✅ Done —
   see `src/scenes/NavigationContext.ts`. `scene.start(key, ctx)` is
   now the single hand-off path; registry-based spawn state is gone.
7. **Extract managers out of `LevelScene`.** ✅ Done —
   `LevelEnemySpawner`, `LevelTokenManager`, `LevelZoneSetup`, and
   `createLevelDialogs` under `src/scenes/floors/`. `LevelScene` is a
   thin composition root.
8. **Extract managers out of `ElevatorScene`.** ✅ Done —
   `ElevatorFloorTransitionManager`, `ProductDoorManager`, and
   `ElevatorSceneLayout` under `src/scenes/elevator/`.
9. **Split `QuizDialog` and `InfoDialog`.** ✅ Done — extracted
   `ModalKeyboardNavigator` and `QuizResultsScreen` into `src/ui/`;
   both dialogs share the navigator.
10. **Standardise scene shutdown.** ✅ Done — `src/systems/sceneLifecycle.ts`
    exposes `createSceneLifecycle(scene)` with `add / bindEventBus /
    bindInput / dispose`. Disposers fire on both `shutdown` and
    `destroy`. Applied in `LevelZoneSetup`, `ElevatorZones`, `HUD`,
    `LobbyScene`, and `MenuScene`.

### Tier C — higher effort, strategic (1–2 weeks)

11. **`GameStateManager` facade with DI.** Wraps `ProgressionSystem`,
    `SaveManager`, `QuizManager`, `InfoDialogManager`. Constructed once
    in `main.ts`, passed into scenes via `scene.launch(key, { state })`
    or a lightweight DI container. Unlocks real unit tests for scenes
    (replace the store with an in-memory fake — same pattern as
    `KVStorage`).
12. **`ThemeService` / `src/style/theme.ts`.** Centralise color tokens
    (`color.bg.default`, `color.floor.platform.platform`,
    `text.primary`, …) and spacing. Scenes pull from tokens rather than
    inlining hex values. Enables dark mode / colour-blind palette later
    with zero file-hunting.
13. **Feature folders for floors.**
    ```
    src/features/floors/platform/
      PlatformTeamScene.ts
      info.ts       (slice of infoContent)
      quiz.ts       (slice of quizData)
      enemies.ts    (floor-specific enemy config)
    ```
    Truly isolates a floor to one folder → perfect for parallel
    branches and clean code ownership.
14. **Raise unit-test coverage thresholds** to 80% for `systems/` and
    `input/`, and add 60% for `ui/` and scenes once the
    `GameStateManager` DI lands (scenes become testable).
15. **Split `SoundGenerator.ts`** into `sounds/footsteps.ts`,
    `sounds/ui.ts`, `sounds/combat.ts`, `sounds/quiz.ts` with a thin
    composition root — mirrors the clean `systems/sprites/` pattern
    that already exists.

### Not recommended

- **No route-based scene loader / URL deep-linking.** Not useful for a
  Phaser game; would add complexity without value.
- **No switch to Redux/Zustand/etc.** EventBus + typed catalog already
  does the job; introducing a store would duplicate responsibility.
- **No monorepo / package split.** 14K LOC is premature.

---

## 3. Suggested implementation order

1. Tier A items 1–5 as a short PR series (each item is one PR, 1–3
   hours). Lowest risk, biggest merge-conflict relief. ✅ landed.
2. Tier B item 6 (`NavigationContext`) before 7 and 8 — the manager
   extractions depend on a clean transition contract. ✅ landed.
3. Tier B items 7 and 8 in parallel (different files, different
   reviewers). ✅ landed.
4. Tier B items 9 and 10 any time. ✅ landed.
5. Tier C items only after A+B land and the team is sold on the
   direction.

---

## 4. Critical files by topic

- **Merge-hotspot splits:** `src/config/quizData.ts`,
  `src/config/infoContent.ts`, `src/config/levelData.ts`.
- **Scene refactors:** `src/scenes/ElevatorScene.ts`,
  `src/scenes/LevelScene.ts`, `src/scenes/MenuScene.ts`.
- **UI refactors:** `src/ui/QuizDialog.ts`, `src/ui/InfoDialog.ts`,
  `src/ui/InfoIcon.ts`, `src/ui/HUD.ts`.
- **Entity refactors:** `src/entities/Player.ts`,
  `src/entities/Elevator.ts`.
- **Docs updates:** `docs/architecture.md`, `CONTRIBUTING.md`.
- **Patterns to reuse (don't reinvent):** `src/systems/EventBus.ts`
  (typed pub/sub), `src/systems/SaveManager.ts` (KVStorage DI),
  `src/input/index.ts` (facade pattern), `src/systems/sprites/`
  (composition-root pattern).

---

## 5. Verifying any refactor

Because the recommended changes are either (a) pure file moves/splits
with unchanged public surface, or (b) refactors behind the same API,
the existing tests are the primary safety net:

- `npm run lint` — no new violations.
- `npm run build` — `tsc` passes with strict mode.
- `npm run test:unit` — all existing Vitest suites pass; add a focused
  `*.test.ts` next to any new manager that is extracted.
- `npm test` — Playwright E2E (`menu`, `elevator`, `floors`, `tokens`,
  `quiz`, `progression`, `visual`) all pass unchanged.
- For the `quizData` / `infoContent` splits specifically, the existing
  `config/quizData.test.ts` and `config/infoContent.test.ts` validate
  structural integrity — run them after each split to catch any dropped
  entries.
- Manually run `npm run dev` and complete one full elevator ride + one
  quiz on each floor before merging any scene refactor.
