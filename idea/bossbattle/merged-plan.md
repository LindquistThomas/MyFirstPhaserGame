# Boss Battle — Merged Master Plan

> Merged from: `plan.md`, `implementation-plan.md`, `jfb/F4-executive-hostage-feature.md`, `jfb/implementation-plan.md`

---

## Overview — Two-Tier Boss System

The game gets **two boss encounters** at different progression tiers:

| Encounter | Floor | Scene | Unlock | Theme |
|-----------|-------|-------|--------|-------|
| **F4 Hostage Rescue** (mid-boss) | Executive Suite (F4) | `ExecutiveSuiteScene` (extended) | Existing F4 unlock | Die Hard — rescue C-suite from external threat |
| **CEO Showdown** (final boss) | Boss Floor (new floor 6) | `BossArenaScene` (new) | 25 AU | Knowledge Cowboy — hybrid action + architecture quiz |

These are **independent and additive** — F4 hostage rescue layers onto the existing Executive Suite; the CEO fight is a standalone climax scene on a new floor above it. They share some infrastructure (projectile system, SFX patterns) but can be built and shipped separately.

---

## Part 1 — F4 Executive Hostage Rescue ("Die Hard Mode")

### Concept

The Executive Suite (F4) gains a Die Hard–inspired hostage rescue narrative. The C-suite leadership is held by an external threat. Player collects three mission-critical items, disarms a bomb, defeats a mini-boss, and frees the leadership.

### Player Flow

```
1. Enter Executive Suite (F4)
   ↓
2. Discover leadership is held hostage (dialogue/visual hint)
   ↓
3. Collect 3 required items scattered across the floor:
     - Pistol (weapon — on high catwalk / moving platform)
     - Security Key Card (near terrorist patrol zone — risky)
     - Bomb Deactivation Code (behind platforming puzzle)
   ↓
4. Disarm the bomb (zone-gated mini-game)
   ↓
5. Defeat TerroristCommander (requires Pistol)
   ↓
6. Open inner sanctum → free leadership
   ↓
7. Receive bonus AU + achievement
```

### Enemy: TerroristCommander

- **File**: `src/entities/enemies/TerroristCommander.ts`
- Extends `Enemy`. `canBeStomped = false`. `hitCost = 2`.
- Patrol: horizontal bounce between `minX`/`maxX`, faster than Slime, larger sprite.
- Defeat: requires Pistol collected. On stomp/overlap with Pistol equipped → `commander.defeat()` → surrender animation (hands-up tween → fade).
- Add `'terrorist'` to `type` union in `LevelConfig.enemies` and a `case 'terrorist'` in `LevelEnemySpawner.spawn()`.
- Sprite: `enemy_terrorist` — armored, distinct from existing enemies.

### MissionItem Entity

- **File**: `src/entities/MissionItem.ts`
- Extends `Phaser.Physics.Arcade.Sprite`. Static body, glow tween.
- Constructor: `(scene, x, y, texture, itemId: 'pistol' | 'keycard' | 'bomb_code')`.
- Overlap with player → callback → destroy.
- Sprites generated procedurally: `item_pistol`, `item_keycard`, `item_bomb_code`.

### Bomb Disarm Mini-Game

- Visual: `bomb_device` sprite near the inner sanctum door.
- Zone-gated: register `'bomb-zone'` in `ZoneManager`.
- When player enters zone AND has `bomb_code` → show interact prompt.
- On interact: timed indicator bar sweeps left→right. Green target zone in middle. Player holds Interact to lock in — release in green zone = success.
- Success → `bombDisarmed = true`, emit `'sfx:bomb_disarm'`.
- Failure → minor damage, retry available.

### Inner Sanctum & Rescue

- Locked gate sprite blocking inner sanctum.
- Unlock: all 3 items + bomb disarmed + boss defeated.
- Opens with animation + chime.
- Info-dialog with leadership thank-you text + bonus AU via `progression.addAU()`.
- Content entry in `src/features/floors/executive/info.ts` with `contentId: 'executive-hostage-rescued'`.

### Scene Integration (Additive to ExecutiveSuiteScene)

- Scene-local rescue state (no persistence — resets on re-entry):
  ```ts
  private rescueState = {
    collected: new Set<'pistol' | 'keycard' | 'bomb_code'>(),
    bombDisarmed: false,
    bossDefeated: false,
    leadershipFreed: false,
  };
  ```
- Mission HUD overlay: 3 icon slots in top-right (grey → lit). Bomb status indicator (red → green). Scene-local, not in shared HUD.

### F4-Specific EventBus Events

- `sfx:item_pickup` — collecting a mission item
- `sfx:bomb_disarm` — bomb disarmed
- `sfx:boss_defeated` — terrorist commander defeated (shared with CEO fight)
- `sfx:hostage_freed` — leadership rescued

### F4 Audio

- Tension music variant for Executive Suite during active rescue (before completion).
- Victory chime on leadership freed.

### F4 Achievement

- ID: `hostage-rescue`, Label: "Die Hard", Description: "Rescue the C-suite leadership."
- Secret achievement.
- Triggered in `ExecutiveSuiteScene` after `leadershipFreed = true`.

---

## Part 2 — CEO Showdown ("The Knowledge Cowboy")

### Concept

The game's climax encounter. Player reaches a new boss floor and faces a loud, charismatic CEO figure in a hybrid boss battle combining **real-time platformer action** with **architecture knowledge challenges**. The boss is not a villain — he's a knowledge-obsessed executive who pressures the player, shares ideas freely, and keeps repeating: **"We'll manage this together."**

### Core Fantasy

- Surviving a strong personality while proving architectural judgment under pressure.
- Boss feels charismatic, overwhelming, and oddly collaborative.
- Encounter feels different from normal floor rooms — it's the capstone moment.

### New Floor: BOSS (floor 6)

**`src/config/gameConfig.ts`:**
```ts
export const FLOORS = {
  // ... existing ...
  BOSS: 6,
} as const;
```

**`src/config/levelData.ts`:**
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

### Elevator Wiring

- Add `ElevatorCallFloor5: ['gameplay']` to `GameAction`, `ACTION_CONTEXTS`, `DEFAULT_BINDINGS` (K.SIX).
- Render Floor 5 (BOSS) button in `ElevatorScene` / `ProductDoorManager`.

### Arena: BossArenaScene

- **File**: `src/features/floors/boss/BossArenaScene.ts`
- Extends `Phaser.Scene` directly — standalone, no `LevelScene`.
- Register in `SCENE_REGISTRY`.

**Layout (1280 × 960):**
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

**Art direction**: Executive showroom meets architecture war room. Glass, steel, gold accents. Digital whiteboards/strategy screens. Elevator/platform set pieces. Dramatic skyline backdrop.

**Lifecycle:**

| Method | Responsibility |
|--------|---------------|
| `preload()` | Nothing (assets generated in BootScene) |
| `create()` | AU gate check → build arena → spawn player + boss → wire colliders + overlaps → show HUD |
| `update()` | Tick boss AI, tick mug physics, update `BossHealthBar`, check win/loss |
| `shutdown()` | Unsubscribe all EventBus handlers |

**AU gate:** Read `gameState.progression.totalAU`; if < 25 show toast then `this.scene.start('ElevatorScene')`.

**Music:** Add `BossArenaScene: 'music_boss'` in `SCENE_MUSIC` (fall back to `music_executive` until dedicated track exists).

### Boss Entity: CEOBoss

- **File**: `src/entities/CEOBoss.ts`
- Extends `Phaser.Physics.Arcade.Sprite`.

**Visual identity** (The Knowledge Cowboy):
- Bald head, slim frame, tailored dark suit, open collar — no tie.
- Clean silhouette. Points at diagrams/screens, paces during challenge windows.
- Approves good answers even while attacking.
- Signature phrase: **"We'll manage this together."**

**Stats:**

| Field | Value |
|-------|-------|
| Max HP | 10 |
| Phase 2 threshold | HP ≤ 7 |
| Phase 3 threshold | HP ≤ 3 |
| Hitbox | 48 × 64 px |
| Hit cooldown (i-frames) | 500 ms |
| Sprite key | `boss_ceo` |

### Three-Phase Encounter

The fight alternates between **action windows** (dodge + throw mugs) and **knowledge windows** (architecture challenge prompts).

#### Phase 1 — Boardroom Blitz (HP 10–8)

**Action window:**
- Boss does slow left-right patrol.
- Charges player every 5 seconds.
- Environmental hazards: shockwave stomps across platforms, spotlight zones that force movement.
- Player collects coffee mugs from floating platforms (max inventory 3, respawn 10s each).
- Throw mugs with Attack action (K.X) → `CoffeeMugProjectile` at 400px/s.

**Knowledge window** (after ~30s or 2 HP lost):
- Boss presents a short architecture trade-off prompt during a temporary safe window.
- 2–4 response options. Scenario-based, not trivia.
- Correct answer → removes one hazard pattern, boss takes 1 bonus damage.
- Wrong answer → spawns extra hazard, boss recovers 1 HP.
- Topics: scalability vs simplicity, platform ownership vs team autonomy.

#### Phase 2 — Hostile Takeover (HP 7–4)

**Action window:**
- Faster patrol. Boss jumps to floating platforms.
- Throws `BriefcaseProjectile` every 4 seconds (250px/s toward player).
- More spotlight/shockwave pressure.

**Knowledge window:**
- Harder prompts. Topics: cost control vs resilience, delivery speed vs governance.
- Correct answer → disables briefcase throwing for 10s.
- Wrong answer → briefcase throw rate doubles for 10s.

#### Phase 3 — Golden Parachute / "Manage This Together" Inversion (HP 3–0)

**Action window:**
- Max speed. Briefcase throw every 2 seconds.
- 3-second dashes toward player.
- Golden tint on boss sprite.
- Player must bait specific attacks into weak points, activate consoles in correct order, use boss callouts as telegraphs.

**Knowledge window:**
- Boss absorbs the player's successful ideas, reframes them.
- Final prompts: standardization vs local optimization, the right answer may be situational — context is telegraphed.
- Correct answer → boss stunned for 5s (free mug throws).
- Wrong answer → full hazard barrage.

**The encounter should feel collaborative in language, competitive in gameplay.**

### Weapon: Coffee Mug

- Player picks up mugs from floating platforms (max 3 inventory, 10s respawn per platform).
- New `GameAction`: `Attack` → K.X binding.
- **File**: `src/entities/CoffeeMugProjectile.ts` (extends Phaser.Physics.Arcade.Sprite).
- `setVelocityX(facingDir * 400)`.
- Overlap with `CEOBoss` → `boss.takeDamage()`, destroy self, emit `sfx:mug_throw`.
- Destroy on world-bounds exit.
- Sprite: `mug_projectile` (16 × 16, brown mug with steam).

### Boss Projectile: Briefcase

- Phase 2/3 counter-attack.
- **File**: `src/entities/BriefcaseProjectile.ts` (extends Phaser.Physics.Arcade.Sprite).
- `setVelocityX(facingDir * 250)` toward player.
- Overlap with player → damage, destroy self, emit `sfx:hit`.
- Sprite: `briefcase_projectile` (24 × 16, grey briefcase).

### Boss Health Bar

- **File**: `src/ui/BossHealthBar.ts`
- Plain Phaser graphics + text, `scrollFactor(0)`, fixed top-centre.
- Fill gradient: gold (HP > 7) → orange (HP 4–7) → red (HP ≤ 3).
- Shake on hit: `scene.tweens.add({ targets: barGraphic, x: '+=4', duration: 40, yoyo: true, repeat: 2 })`.
- Destroyed on `boss:defeated`.

### Architecture Challenge Prompts (Boss-Local)

Knowledge prompts are **scene-local** (not in the shared quiz system) — they're tailored to the boss encounter's pacing.

**Design principles:**
- Short enough to read during a boss encounter.
- Scenario-based choices, not textbook questions.
- Some "good" answers are situational — context is telegraphed clearly.
- Boss personality comes through in prompt framing: confident, strong opinions, openness to better reasoning.

**Topic categories:**
- Scalability vs simplicity
- Platform ownership vs team autonomy
- Cost control vs resilience
- Delivery speed vs governance
- Standardization vs local optimization

### Resolution — Respectful Knowledge Handoff

When HP drops to 0, `CEOBoss.triggerDefeat()` fires instead of a death animation:

1. AI pauses. Boss plays stagger tween → straightens up → laughs.
2. `boss:dialogue` event fires → `BossArenaScene` shows a 2–3 line dialogue panel.
3. Boss acknowledges player's judgment, shares final architectural wisdom, ends with **"We'll manage this together."**
4. Dialogue closes → `boss:defeated` fires.
5. `VictoryOverlay` shows: major AU grant + `boss-defeated` achievement toast.
6. Boss sprite fades out (no death). Scene returns to elevator after 3s.

**Knowledge gate:** Boss HP cannot drop below 1 unless `phasePromptsAnsweredCorrectly > 0` for the current phase. Players who skip all prompts stay stuck at HP 1 and receive a toast: "You need to answer a challenge first!"

### CEO Fight Achievements

- `boss-defeated` — "Corner Office" — "Defeat the CEO in the Boardroom." (secret)
- `boss-no-damage` — "Untouchable" — "Defeat the CEO without being hit." (secret)

---

## Shared Infrastructure

### New `GameAction`: Attack

- Add `'Attack'` to `GameAction` union + `ACTION_CONTEXTS: ['gameplay']`.
- Bind to `K.X` in `DEFAULT_BINDINGS`.
- Used by: CoffeeMugProjectile (CEO fight) and Pistol (F4 hostage rescue — if we want ranged pistol shots).

### Boss/Hostage SFX

Add family file `src/systems/sounds/boss.ts`, wire via `SoundGenerator.generateSounds()`.

| EventBus Key | Sound | Used By |
|---|---|---|
| `sfx:boss_hit` | Short percussive thud | CEO fight |
| `sfx:boss_defeated` | Descending multi-note fanfare | Both |
| `sfx:mug_throw` | Ceramic whoosh | CEO fight |
| `sfx:boss_phase` | Tense low sting | CEO fight |
| `sfx:briefcase_throw` | Paper-shuffle impact | CEO fight |
| `sfx:item_pickup` | Bright chime | F4 hostage |
| `sfx:bomb_disarm` | Descending beep sequence | F4 hostage |
| `sfx:hostage_freed` | Triumphant brass hit | F4 hostage |

Declare all in `GameEvents` + `SFX_EVENTS`.

Also declare `'boss:defeated': []` in `GameEvents`.

### Boss Sprites

Add family file `src/systems/sprites/boss.ts`, wire via `SpriteGenerator.generate()`.

| Key | Size | Description |
|-----|------|-------------|
| `boss_ceo` | 48 × 64 | Pixel-art CEO: bald, dark suit, open collar, briefcase; golden tint layer for phase 3 |
| `boss_ceo_hit` | 48 × 64 | White-flash variant for i-frame |
| `mug_projectile` | 16 × 16 | Brown mug with steam |
| `briefcase_projectile` | 24 × 16 | Grey briefcase |
| `enemy_terrorist` | 32 × 48 | Armored figure, distinct color |
| `item_pistol` | 16 × 16 | Grey pixel gun |
| `item_keycard` | 16 × 12 | Glowing small card |
| `item_bomb_code` | 16 × 16 | Green data pad |
| `bomb_device` | 24 × 24 | Red blinking device |
| `door_sanctum_locked` | 32 × 48 | Gate with padlock overlay |
| `door_sanctum_open` | 32 × 48 | Gate, open texture |

### Achievements (All)

| ID | Label | Description | Secret | Trigger |
|----|-------|-------------|--------|---------|
| `boss-defeated` | Corner Office | Defeat the CEO in the Boardroom. | ✓ | CEO fight victory |
| `boss-no-damage` | Untouchable | Defeat the CEO without being hit. | ✓ | CEO fight victory + no damage taken |
| `hostage-rescue` | Die Hard | Rescue the C-suite leadership. | ✓ | F4 leadership freed |

Wire in `GameStateManager.checkAchievements()`. `boss-defeated` and `boss-no-damage` use transient scene flags. `hostage-rescue` triggered from `ExecutiveSuiteScene`.

---

## Files Summary

### Files to Create

| Path | Purpose |
|------|---------|
| `src/features/floors/boss/BossArenaScene.ts` | CEO boss arena scene |
| `src/entities/CEOBoss.ts` | CEO boss AI + phase state machine |
| `src/entities/CoffeeMugProjectile.ts` | Player throwable (CEO fight) |
| `src/entities/BriefcaseProjectile.ts` | CEO counter-attack projectile |
| `src/entities/MissionItem.ts` | Collectible item entity (F4 hostage) |
| `src/entities/enemies/TerroristCommander.ts` | F4 mini-boss enemy |
| `src/ui/BossHealthBar.ts` | CEO HP bar (top-centre) |
| `src/systems/sprites/boss.ts` | Procedural sprite generators (boss + hostage) |
| `src/systems/sounds/boss.ts` | Procedural SFX generators (boss + hostage) |

### Files to Edit

| Path | Change |
|------|--------|
| `src/config/gameConfig.ts` | Add `BOSS: 6` to `FLOORS` |
| `src/config/levelData.ts` | Add `BOSS` entry to `LEVEL_DATA` |
| `src/config/audioConfig.ts` | Add `BossArenaScene` to `SCENE_MUSIC`; add SFX_EVENTS entries |
| `src/config/achievements.ts` | Add 3 achievement IDs + entries |
| `src/systems/EventBus.ts` | Declare `boss:defeated` + all `sfx:*` events |
| `src/input/actions.ts` | Add `Attack` + `ElevatorCallFloor5` to `GameAction` + `ACTION_CONTEXTS` |
| `src/input/bindings.ts` | Bind `Attack → K.X`, `ElevatorCallFloor5 → K.SIX` |
| `src/scenes/sceneRegistry.ts` | Register `BossArenaScene` |
| `src/systems/SpriteGenerator.ts` | Import + call boss sprite family |
| `src/systems/SoundGenerator.ts` | Import + call boss SFX family |
| `src/systems/GameStateManager.ts` | Wire achievement checks |
| `src/scenes/elevator/ElevatorScene.ts` | Render Floor 6 (BOSS) button |
| `src/features/floors/executive/ExecutiveSuiteScene.ts` | Add hostage rescue state + items + bomb + sanctum |
| `src/features/floors/executive/info.ts` | Add `executive-hostage-rescued` content |
| `src/features/floors/_shared/LevelScene.ts` | Add `'terrorist'` to enemy type union |
| `src/features/floors/_shared/LevelEnemySpawner.ts` | Add `case 'terrorist'` spawn |

---

## Dependency Graph

```
                     ┌─── F4 HOSTAGE RESCUE ───────────────────┐
                     │                                          │
Phase 1 Foundation:  │  TerroristCommander                     │
                     │  MissionItem entity                     │
                     │  Hostage sprites + SFX                  │
                     │          │                               │
Phase 2 Integration: │  ExecutiveSuiteScene rescue state       │
                     │  Place items / bomb / boss / door       │
                     │  Mission HUD overlay                    │
                     │          │                               │
Phase 3 Polish:      │  Info dialog content                    │
                     │  Hostage-rescue achievement             │
                     │  Tension music                          │
                     │  Bomb disarm mini-game UI               │
                     └──────────────────────────────────────────┘

                     ┌─── CEO SHOWDOWN ────────────────────────┐
                     │                                          │
Phase 1 Foundation:  │  BOSS floor + LEVEL_DATA                │
                     │  BossArenaScene (shell)                 │
                     │  CEOBoss entity + phase AI              │
                     │  CoffeeMugProjectile                    │
                     │  BriefcaseProjectile                    │
                     │  BossHealthBar UI                       │
                     │  CEO sprites + SFX                      │
                     │  Elevator wiring                        │
                     │          │                               │
Phase 2 Encounter:   │  3-phase AI + action windows            │
                     │  Architecture challenge prompts         │
                     │  Quiz ↔ boss HP interaction             │
                     │          │                               │
Phase 3 Polish:      │  Resolution / ending sequence           │
                     │  Boss-defeated achievements             │
                     │  Boss music track                       │
                     │  Victory overlay                        │
                     └──────────────────────────────────────────┘

Shared: Attack GameAction, SFX infrastructure, sprite family file, achievements wiring
```

---

## Scope Recommendation

Ship **F4 Hostage Rescue** and **CEO Showdown** as separate PRs / milestones.

- **Milestone 1**: F4 Hostage Rescue (additive to existing scene, smaller scope)
- **Milestone 2**: CEO Showdown Phase 1 — lightweight first version (one arena, one boss, two hazard patterns, one small set of architecture prompts, single victory flow)
- **Milestone 3**: CEO Showdown Phase 2 — full signature encounter (three distinct phases, expanded animations, multiple prompt pools, unique reward/achievement/post-fight dialogue)

---

## Design Decisions (Resolved)

### Decision 1: CEO Boss Defeat Resolution → **Respectful Knowledge Handoff**

HP reaches 0 **triggers** the ending, but the boss does not collapse into a cartoon death.

**Sequence:**
1. Final mug hit drops HP to 0.
2. Boss staggers, then straightens up — laughs.
3. Short dialogue sequence (2–3 lines): he acknowledges the player's judgment, shares one final piece of architectural wisdom, ends with a last "We'll manage this together."
4. `boss:defeated` event fires after dialogue closes.
5. `VictoryOverlay` shows: major AU grant + `boss-defeated` achievement toast.
6. Boss sprite fades out (no death animation) — scene returns to elevator after 3s.

**Implementation note:** `CEOBoss.triggerDefeat()` pauses AI, plays the stagger-then-steady tween, emits a `'boss:dialogue'` event that `BossArenaScene` handles to show the dialogue panel, then emits `boss:defeated` on close. The `destroy()` call moves to after the dialogue close callback.

---

### Decision 2: CEO Fight Mechanic Balance → **Hybrid (action + knowledge)**

Both mug throws and architecture quiz prompts are required to win.

**Mechanic contract:**
- **Mug throws deal HP damage** (direct action damage).
- **Correct quiz answers disable hazards** and grant a temporary stun window (5s free mug throws).
- **Wrong quiz answers restore 1 HP** and spawn an extra hazard (briefcase barrage or shockwave).
- **Knowledge gate on the final blow:** the boss can only be reduced below 1 HP if the player has answered at least one prompt correctly in the current phase. A missed-all-prompts player stays stuck at HP 1 until they get a prompt right.

**Why hybrid over pure action:** Pure action undersells the "knowledge architect" fantasy that is central to both source documents. Pure knowledge risks losing Phaser platformer energy. The hybrid ensures both skill types matter without either dominating.

**Implementation note:** `CEOBoss` tracks `phasePromptsAnsweredCorrectly: number`. `BossArenaScene` checks this flag before calling `boss.takeDamage()` — if HP would drop to 0 and `phasePromptsAnsweredCorrectly === 0`, the hit clamps to HP 1 and a "You need to answer a challenge first!" toast fires. The quiz panel is a scene-local Phaser container (not the shared `QuizDialog`) to keep boss prompt pacing independent of the global quiz system.

---

### Decision 3: Attack Action Semantics → **Unified `Attack` (K.X)**

Single `Attack` GameAction (K.X) across both encounters. Scene determines projectile type:
- F4 Executive Suite: fires `PistolProjectile` if `rescueState.collected.has('pistol')`.
- CEO Showdown arena: throws `CoffeeMugProjectile` if `mugCount > 0`.

**Why unified:** The player is always doing the same gesture — "throw/fire what I'm holding." Separate bindings would add cognitive load for no gain. Projectile identity is a scene concern, not an input concern.

**Implementation note:** `InputService` exposes `isJustDown('Attack')`. Both scenes check this in their `update()` loop and branch on their local inventory state. No shared projectile base class is needed.
