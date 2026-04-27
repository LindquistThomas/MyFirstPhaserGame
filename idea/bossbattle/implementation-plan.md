# Boss Battle — CEO Boss Fight

## Concept

A final boss fight unlocked at **25 AU**, placed as a new floor (`BOSS: 6`) above the Executive Suite. The player collects coffee mugs from the arena and throws them at the CEO boss while dodging attacks across three escalating phases. Defeating the boss ends the game and awards secret achievements.

---

## AU Budget

| Source | Count | AU range |
|--------|-------|----------|
| Map tokens | 31 | 31 fixed |
| Quizzes (×9, 3–5 AU each) | 9 | 27–45 |
| **Total** | | **58–76** |

Gate cost of **25 AU** is reachable from tokens alone — no extra AU source needed.

---

## New Floor

### `FLOORS.BOSS` (value `6`) — `src/config/gameConfig.ts`

```ts
export const FLOORS = {
  LOBBY: 0,
  PLATFORM_TEAM: 1,
  BUSINESS: 3,
  EXECUTIVE: 4,
  PRODUCTS: 5,
  BOSS: 6,          // ← new
} as const;
```

`FloorId` is auto-derived, so no additional type change needed.

### `LEVEL_DATA` entry — `src/config/levelData.ts`

```ts
[FLOORS.BOSS]: {
  id: FLOORS.BOSS,
  name: 'Boardroom',
  description: 'The CEO awaits. Prove your architectural worth.',
  sceneKey: 'BossArenaScene',
  auRequired: 25,
  auLabel: 'Boss AU',
  totalAU: 0,
  theme: {
    platformColor: 0x2a1a0a,
    backgroundColor: 0x0a0a0a,
    wallColor: 0x3a2a1a,
    tokenColor: 0xffd700,
  },
},
```

---

## Elevator Wiring

`ElevatorCallFloor0`–`ElevatorCallFloor4` already exist in `src/input/actions.ts`.
Add `ElevatorCallFloor5: ['gameplay']` to:
- `GameAction` union in `src/input/actions.ts`
- `ACTION_CONTEXTS` map in `src/input/actions.ts`
- `DEFAULT_BINDINGS` in `src/input/bindings.ts` (bind to digit key `6` / `K.SIX`)
- Button render loop in `ElevatorScene` / `ProductDoorManager` (mirrors existing F4 handling)

---

## Scene — `BossArenaScene`

**File:** `src/features/floors/boss/BossArenaScene.ts`

Extends `Phaser.Scene` directly — no `LevelScene`, no token/info-point machinery.

### Layout (1280 × 960 canvas, TILE_SIZE = 128 px)

```
┌─────────────────────────────────────────┐
│          [boss dais — centre top]        │
│                                          │
│   [platform L]          [platform R]     │
│    (mug spawn)          (mug spawn)      │
│                                          │
│ [player spawn]                           │
│══════════════ ground ════════════════════│
└─────────────────────────────────────────┘
```

### Lifecycle

| Method | Responsibility |
|--------|---------------|
| `preload()` | nothing (assets generated in BootScene) |
| `create()` | AU gate check → build arena → spawn player + boss → wire colliders + overlaps → show HUD |
| `update()` | tick boss AI, tick mug physics, update `BossHealthBar`, check win/loss |
| `shutdown()` | unsubscribe all EventBus handlers |

**AU gate:** read `gameState.progression.totalAU`; if < 25 show toast then `this.scene.start('ElevatorScene')`.

**Win:** listen for `boss:defeated` event → show `VictoryOverlay`, wait 3 s, `this.scene.start('ElevatorScene')`.

**Music:** add `BossArenaScene: 'music_boss'` in `SCENE_MUSIC` in `src/config/audioConfig.ts` (or fall back to `music_executive` until a dedicated track exists).

---

## Boss Entity — `CEOBoss`

**File:** `src/entities/CEOBoss.ts`

Extends `Phaser.Physics.Arcade.Sprite`.

### Stats

| Field | Value |
|-------|-------|
| Max HP | 10 |
| Phase 2 threshold | HP ≤ 7 |
| Phase 3 threshold | HP ≤ 3 |
| Hitbox | 48 × 64 px |
| Hit cooldown (i-frames) | 500 ms |
| Sprite key | `boss_ceo` |

### Phase AI

| Phase | Trigger | Behaviour |
|-------|---------|-----------|
| 1 — Boardroom Blitz | start | Slow left-right patrol; charges player every 5 s |
| 2 — Hostile Takeover | HP ≤ 7 | Faster patrol; jumps to floating platforms; throws `BriefcaseProjectile` every 4 s |
| 3 — Golden Parachute | HP ≤ 3 | Max speed; briefcase throw every 2 s; 3-second dash toward player; golden tint |

### API

```ts
class CEOBoss extends Phaser.Physics.Arcade.Sprite {
  takeDamage(): void;                     // decrement HP, i-frame, phase check, emit sfx:boss_hit
  update(playerX: number, playerY: number): void;  // AI tick
  // emits boss:defeated + plays death animation, then calls destroy()
}
```

Phase transitions emit `sfx:boss_phase` via `eventBus`.

---

## Weapon — Coffee Mug

Player picks up mugs from the two floating platforms (max inventory 3; each platform respawns after 10 s).

### New `GameAction` — `src/input/actions.ts`

Add `'Attack'` to the `GameAction` union, add `Attack: ['gameplay']` to `ACTION_CONTEXTS`, bind `K.X` in `DEFAULT_BINDINGS`.

### `CoffeeMugProjectile` — `src/entities/CoffeeMugProjectile.ts`

Extends `Phaser.Physics.Arcade.Sprite`.

- Launched at `setVelocityX(facingDir * 400)`.
- On overlap with `CEOBoss` → `boss.takeDamage()`, destroy self, emit `sfx:mug_throw` (already emitted at throw time).
- On world-bounds exit → destroy self.
- Sprite key: `mug_projectile`.

### Throw flow in `BossArenaScene.update()`

```ts
if (this.inputs.isJustDown('Attack') && this.mugCount > 0) {
  this.mugCount--;
  new CoffeeMugProjectile(this, player.x, player.y, this.facingDir);
  eventBus.emit('sfx:mug_throw');
}
```

---

## Boss Projectile — `BriefcaseProjectile`

Phase-2/3 boss counter-attack. Extends `Phaser.Physics.Arcade.Sprite`.

- Launched horizontally toward player at `setVelocityX(facingDir * 250)`.
- On overlap with player → player takes damage (emit `sfx:hit`, existing mechanism), destroy self.
- Sprite key: `briefcase_projectile` (24 × 16 px procedural texture).

---

## Boss Health Bar UI — `src/ui/BossHealthBar.ts`

Extends nothing — plain Phaser graphics + text, `scrollFactor(0)`, fixed top-centre.

```ts
class BossHealthBar {
  constructor(scene: Phaser.Scene, label: string, maxHp: number);
  update(currentHp: number): void;   // redraws bar, triggers shake tween if HP changed
  destroy(): void;
}
```

- Fill gradient: gold (HP > 7) → orange (HP 4–7) → red (HP ≤ 3).
- Shake on hit: `scene.tweens.add({ targets: barGraphic, x: '+=4', duration: 40, yoyo: true, repeat: 2 })`.
- Destroyed when `boss:defeated` fires.

---

## Sprites

Add family file `src/systems/sprites/boss.ts`, wire via `SpriteGenerator.generate()`.

| Key | Size | Description |
|-----|------|-------------|
| `boss_ceo` | 48 × 64 | Pixel-art CEO: dark suit, briefcase, angry expression; golden tint layer for phase 3 |
| `boss_ceo_hit` | 48 × 64 | White-flash variant for i-frame |
| `mug_projectile` | 16 × 16 | Brown mug with steam |
| `briefcase_projectile` | 24 × 16 | Grey briefcase |

---

## SFX

Add family file `src/systems/sounds/boss.ts`, wire via `SoundGenerator.generateSounds()`.

| EventBus key | Sound description |
|---|---|
| `sfx:boss_hit` | Short percussive thud |
| `sfx:boss_defeated` | Descending multi-note fanfare (3–4 notes) |
| `sfx:mug_throw` | Ceramic whoosh |
| `sfx:boss_phase` | Tense low sting (phase transition) |
| `sfx:briefcase_throw` | Paper-shuffle impact |

Declare all five in `GameEvents` (`src/systems/EventBus.ts`), add to `SFX_EVENTS` in `src/config/audioConfig.ts`.

Also declare `'boss:defeated': []` in `GameEvents`.

---

## Achievements

Extend `AchievementId` union and `ACHIEVEMENTS` array in `src/config/achievements.ts`:

| id | label | description | secret |
|----|-------|-------------|--------|
| `boss-defeated` | Corner Office | Defeat the CEO in the Boardroom. | ✓ |
| `boss-no-damage` | Untouchable | Defeat the CEO without being hit. | ✓ |

Wire checks in `GameStateManager.checkAchievements()`:
- Track `bossDefeated: boolean` and `tookDamageInBoss: boolean` as transient scene flags (no persistence needed — re-derivable on re-entry).
- `grand-architect` already checks all non-secret IDs; these two are secret so `grand-architect` logic is unaffected.

---

## Files to Create

| Path | Purpose |
|------|---------|
| `src/features/floors/boss/BossArenaScene.ts` | Boss arena scene |
| `src/entities/CEOBoss.ts` | Boss AI + phase state machine |
| `src/entities/CoffeeMugProjectile.ts` | Player throwable |
| `src/entities/BriefcaseProjectile.ts` | Boss counter-attack projectile |
| `src/ui/BossHealthBar.ts` | Top-centre HP bar |
| `src/systems/sprites/boss.ts` | Procedural sprite generators |
| `src/systems/sounds/boss.ts` | Procedural SFX generators |

## Files to Edit

| Path | Change |
|------|--------|
| `src/config/gameConfig.ts` | Add `BOSS: 6` to `FLOORS` |
| `src/config/levelData.ts` | Add `BOSS` entry to `LEVEL_DATA` |
| `src/config/audioConfig.ts` | Add `BossArenaScene` to `SCENE_MUSIC`; add 5 `SFX_EVENTS` entries |
| `src/config/achievements.ts` | Add 2 new `AchievementId` literals + `ACHIEVEMENTS` entries |
| `src/systems/EventBus.ts` | Declare `boss:defeated` + 5 `sfx:boss_*` events in `GameEvents` |
| `src/input/actions.ts` | Add `'Attack'` to `GameAction` union + `ACTION_CONTEXTS`; add `'ElevatorCallFloor5'` |
| `src/input/bindings.ts` | Bind `Attack → K.X`; bind `ElevatorCallFloor5 → K.SIX` |
| `src/scenes/sceneRegistry.ts` | Register `{ key: 'BossArenaScene', cls: BossArenaScene }` |
| `src/systems/SpriteGenerator.ts` | Import + call boss sprite family |
| `src/systems/SoundGenerator.ts` | Import + call boss SFX family |
| `src/systems/GameStateManager.ts` | Wire `boss-defeated` / `boss-no-damage` achievement checks |
| `src/scenes/elevator/ElevatorScene.ts` or `ProductDoorManager.ts` | Render Floor 5 (BOSS) button; handle `ElevatorCallFloor5` |
