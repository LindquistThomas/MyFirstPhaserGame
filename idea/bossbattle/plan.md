# Boss Battle Level Plan

## Working title
- **The Knowledge Cowboy**

## Core fantasy
- Player reaches a high-stakes floor and faces a loud, confident boss figure.
- Boss reads as tall, slim, bald, sharply dressed, suit-without-tie, with a noticeable accent.
- He is not framed as a pure villain; he pressures the player, shares ideas freely, absorbs counter-ideas, and keeps repeating: **"We'll manage this together."**
- Encounter should feel like surviving a strong personality while proving architectural judgment under pressure.

## Design goals
- Mix **action skill** and **knowledge skill** in one memorable set-piece.
- Make the boss feel charismatic, overwhelming, and oddly collaborative.
- Test whether the player can stay calm, read signals, and make good architecture decisions.
- Deliver a climax that feels different from normal floor rooms.

## Recommended direction
- **Recommend hybrid encounter** over fully live-action or fully turn-based.
- Use short real-time action windows between compact decision moments.
- Reason: pure action undersells the "knowledge-loving architect" fantasy; pure turn-based risks losing Phaser platformer energy.

## Encounter structure

### 1. Intro: boardroom showdown
- Player enters a penthouse-style arena: polished floor, skyline backdrop, presentation screens, suspended platforms.
- Boss arrives with swagger, oversized confidence, and a friendly-but-intense welcome.
- He opens with a variation of: **"We'll manage this together."**
- Arena tutorializes two rules:
  - survive pressure
  - answer architecture challenges correctly to expose boss weak points

### 2. Phase one: pressure and positioning
- Boss attacks through environment control instead of direct brawling.
- Example hazards:
  - shockwave stomps across platforms
  - flying slide decks / documents
  - spotlight zones that force movement
  - timed elevator/platform repositioning
- Player objective: collect **Insight Tokens** or trigger **Knowledge Consoles** while avoiding damage.
- Tone: boss dominates the room through confidence and noise.

### 3. Phase two: architecture challenge
- Boss presents short architecture trade-off prompts during temporary safe windows.
- Player must choose between 2-4 responses.
- Questions should reward practical architecture judgment, not trivia.
- Good topic categories:
  - scalability vs simplicity
  - platform ownership vs team autonomy
  - cost control vs resilience
  - delivery speed vs governance
  - standardization vs local optimization
- Correct answers weaken boss posture, disable hazards, or power the next interaction.
- Wrong answers restore boss momentum, spawn extra hazards, or extend the phase.

### 4. Phase three: "manage this together" inversion
- Boss becomes more animated and starts absorbing the player's successful ideas.
- Mechanics now require the player to use what they learned:
  - bait specific attacks into weak points
  - activate the right console in the right order
  - use boss callouts as telegraphs
- This phase should feel collaborative in language, competitive in gameplay.
- Player wins by proving better judgment under pressure, not by brute-force damage.

### 5. Resolution
- Boss does not collapse into cartoon defeat.
- Better ending: he laughs, accepts the result, shares one final line of respect, and turns the fight into a knowledge handoff.
- Reward can be a major AU grant, floor unlock, achievement, or symbolic "architect approval" moment.

## Knowledge design principles
- Keep prompts short enough to read during a boss encounter.
- Prefer scenario-based choices over textbook questions.
- Make at least some "good" answers situational, then telegraph the intended context clearly.
- Reuse boss personality in the prompts: confident framing, strong opinions, openness to better reasoning.

## Boss personality and presentation
- Loud, confident, fast-talking, visibly energized by discussion.
- Accent should come through in rhythm and phrasing, not parody.
- Visually clean silhouette:
  - bald head
  - slim frame
  - tailored suit
  - open collar, no tie
- Signature behavior:
  - points at diagrams/screens
  - paces during challenge windows
  - approves good answers even while attacking
  - repeats **"We'll manage this together"** as both comfort and pressure

## Arena and art direction
- Theme: executive showroom meets architecture war room.
- Visual ingredients:
  - glass, steel, gold accents
  - digital whiteboards or strategy screens
  - elevator/platform set pieces
  - dramatic skyline or top-floor backdrop
- Audio mood:
  - confident, punchy boss cue
  - boardroom-tech sound palette
  - clear telegraph sounds for attack vs question windows

## Recommended repo fit
- Treat this as a **bespoke climax scene**, not a normal `LevelScene` room, unless scope is intentionally reduced.
- Reason: multi-phase pacing, question windows, and boss state likely exceed the current shared floor-room pattern.
- Best fit likely:
  - standalone boss scene registered in `SCENE_REGISTRY`
  - optional tie-in to the Executive floor or a newly unlocked final floor
  - supporting quiz/info data only if reuse is valuable; otherwise keep boss prompts scene-local

## Scope options

### Option A: lightweight first version
- One arena
- One boss
- Two hazard patterns
- One small set of architecture prompts
- Single victory flow
- Best if goal is to ship fast and learn

### Option B: full signature encounter
- Three distinct phases
- Expanded boss animation and voice flavor text
- Multiple prompt pools with partial randomization
- Unique reward / achievement / post-fight dialogue
- Best if this should become the game's capstone moment

## Key decisions still open
- Is this the **final game climax** or a **single themed floor challenge**?
- Should prompt answers be **multiple choice**, **ordering**, or **pair matching**?
- Should failure reset the whole fight or only the current phase?
- Should correct answers give direct damage, shield breaks, or temporary control of the arena?

## Recommendation summary
- Build toward a **hybrid boss battle** with real-time movement + short architecture decision windows.
- Position the boss as a charismatic knowledge-obsessed executive/cowboy figure, not a one-note villain.
- Start with **Option A** to prove the loop, then expand to Option B if the fight feels fun and readable.
