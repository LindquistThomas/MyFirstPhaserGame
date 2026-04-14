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
| E | Interact (enter doors, call elevator) |

### Floors

| Floor | Department | Theme |
|-------|-----------|-------|
| F0 | Lobby | Hub — the elevator shaft |
| F1 | Platform Team | Green — Infrastructure tokens |
| F2 | Cloud Team | Blue — Cloud certification tokens |

## Development

```bash
npm install      # Install dependencies
npm run dev      # Start dev server (localhost:3000)
npm run build    # Production build → dist/
```

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
