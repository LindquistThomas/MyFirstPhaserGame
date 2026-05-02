# So You Want to Be an Architect

A 2D pixel-art platformer about rising through the ranks of IT architecture, built with **Phaser 3**, **TypeScript**, and **Vite**.

Inspired by *Impossible Mission* (Commodore 64).

## Play

The game is deployed automatically to GitHub Pages on every push to `main`.

## Concept

You are an IT architect navigating the **Architecture Elevator** — a central shaft that connects different departments in a corporation. Ride the elevator between floors, explore each department, and collect **AU (Architecture Utility)** points to unlock higher floors and advance your career.

### Controls

| Key | Action |
|-----|--------|
| WASD / Arrow Keys | Move |
| Space | Jump |
| Enter / Click / Tap | Interact (enter doors, show info cards) |
| I | Show info card for nearby zone |
| Esc / P | Pause (during gameplay) |
| M | Toggle audio mute (any scene) |
| 0–5 | Call elevator to floor (inside the cab) |
| X | Attack — throw mug (boss arena) / fire pistol (executive rescue) |

### Floors

Defined in `src/config/gameConfig.ts` (`FLOORS`) and `src/config/levelData.ts` (`LEVEL_DATA`).

| Floor | Department | Notes |
|-------|-----------|-------|
| 0 | Lobby | Ground floor — elevator shaft, no gameplay tokens. |
| 1 | Platform Team / Architecture Team | Split floor: Platform on the left, Architecture on the right. Green — Infrastructure AU. |
| 2 | Products | Rendered directly by `ElevatorScene` / `ProductDoorManager` — one door per ISY product, no standalone scene. |
| 3 | Business | Split floor: Product Leadership on the left, Customer Success on the right. Amber — Business AU. |
| 4 | Executive Suite | Penthouse — Strategy AU. |
| 5 | Boardroom | Boss arena — final encounter, `BossArenaScene`. |

## Bundle size budget

The CI `size-budget` job (`npm run size`) runs `scripts/check-size.cjs` after every build and fails if any of these limits are exceeded:

| Asset | Limit | Rationale |
|-------|-------|-----------|
| `dist/assets/index-*.js` (app chunk, gzipped) | 150 KB | App logic; well under today's size. |
| `dist/assets/phaser-*.js` (engine chunk, gzipped) | 400 KB | Phaser 3.90 gzips to ~330 KB; guards against accidental engine duplication. |
| Total `dist/` excluding `dist/music/**` (gzipped) | 700 KB | JS + HTML payload, minus streamed audio. |
| Eager music assets (raw, from `STATIC_MUSIC_ASSETS`) | 2 MB | First-load audio; currently ~830 KB. |
| **Total music assets** (raw, all `dist/music/**`) | **6.5 MB** | Guards against audio bloat; ~6.0 MB today after orphan cleanup. |

In addition to size budgets, the check fails if any audio file in `dist/music/` is **not declared** in `STATIC_MUSIC_ASSETS` (`src/config/audioConfig.ts`). This prevents orphaned tracks from accumulating unnoticed.

If a PR genuinely needs more weight, raise the appropriate limit in `scripts/check-size.cjs` with a comment explaining why.

## Development

```bash
npm install      # Install dependencies
npm run dev      # Start dev server (localhost:3000)
npm run build    # Production build → dist/
```

### Build flags

| Variable | Default | Effect |
|----------|---------|--------|
| `VITE_EXPOSE_TEST_HOOKS` | `true` (unset) | Attaches `window.__game` and `window.__testHooks` to the browser global. Required by the Playwright E2E suite. Set to `false` to produce a security-hardened bundle where neither global is present. |

Example — hardened build without test globals:

```bash
VITE_EXPOSE_TEST_HOOKS=false npm run build
# Verify:
grep __game dist/assets/*.js || echo "clean"
```

### Playwright screenshot tests

End-to-end tests that boot the game in a real browser and save PNG
screenshots of each scene into `tests/screenshots/` (handy for visually
reviewing how implemented features look):

```bash
npx playwright install chromium   # one-time browser download
npm test                          # run all tests headless
npm run test:headed               # run with a visible browser
npm run test:ui                   # interactive Playwright UI
```

After a run, view the HTML report with `npm run test:report`.

`tests/a11y.spec.ts` runs WCAG 2.1 AA checks using `@axe-core/playwright` against the HTML layer of the game at key scenes (menu, settings, floor with HUD, reduced-motion, high-contrast mode). This gate runs as part of the E2E suite and fails CI if a change introduces an accessibility regression.

## Claude GitHub App Integration

To install the Claude GitHub App on a personal account:

1. Go to https://github.com/apps/claude/installations/select_target
2. Select your personal account (not an organization)
3. Choose either **All repositories** or **Select repositories**
4. Confirm the installation

### Tech Stack

- **Phaser 3** — 2D game framework (Arcade Physics)
- **TypeScript** — type safety
- **Vite** — build tool
- **GitHub Actions** — auto-deploy to GitHub Pages

### Art Style

128×128 pixel-art tiles, all sprites generated programmatically at runtime (zero external image assets).

## License

MIT
