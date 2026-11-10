# Color Rush Heist: progression brief (one stage becomes a campaign)

Research only (2026-11-09). No game code was changed and nothing was committed. This answers the user's
feedback (translated): *"develop it further with more game-design technique, like Mario Bros.: show
mechanics slowly over several levels so the player feels progress and learning, instead of everything
at once."* Read it with `RESEARCH.md` (the Stage 1 brief) and `LEVEL_DESIGN.md` (what is built). Jump
numbers in §5 were re-measured from the `model.mjs` constants; the dev squad must confirm them in tests.
External claims are linked in §13.

## 1. Summary (ranked)

1. **Split Stage 1 into World 1 "Green Forest": six short levels** (60–120 s first play, about 10
   minutes in all), each with **one new idea** in kishōtenketsu order: introduce safely, develop,
   twist, conclude. Today's map supplies about 200 of the roughly 850 columns.
2. **Inputs unlock over time.** Each level has a fixed *kit*, with three GET moments: **GREEN** at
   the end of 1-2, **DASH** at the start of 1-4 and **RED** at the 1-6 theft. The HUD grows with them.
3. **1-6 "The Vault" is the climax:** every earlier verb returns compressed, then the theft starts the
   REVERSE escape. Red smash is the only new verb, handed over at the peak.
4. **A side-view world map built from `bg1`** that regains color with each clear. The red beacon gets
   closer every level, and the vault is the world's "castle" node.
5. **Three stickers per level** (main line, off-line, mastery), plus "Unseen" and "Quick" stamps and
   derived world medals. Progress is saved locally, and a sticker is never lost.
6. **Hints are a per-save budget:** at most two per level, and nothing is taught twice.
7. **The opening stays:** title → comic → iris → colorless Rubik in 1-1. The map appears after 1-1.
8. **World 2 "Blue Mountains"** is planned (§8) but built only after feedback on World 1.

## 2. What the references teach

| Source | Technique | Apply to CRH |
|---|---|---|
| SMB World 1-1 (Miyamoto) | Players should "gradually and naturally understand what they're doing" | 1-1 has no enemies; geometry teaches jump, then double jump |
| 3D Land/3D World (Hayashida; GMTK) | One core concept per level: introduce, develop, twist, conclude; a safe start; the idea is dropped once mastered | Every level in §6 uses these four beats |
| Mario Wonder (Ask the Developer) | A surprise in every course; keep the player's trust in the rules | One twist per level, never a rule change |
| SMB3 (Wikipedia; Koncewicz) | Map with paths; themed worlds; an airship ends each world; elements return in new combinations | Map (§9.1); 1-6 as the "airship"; recombination in every level |
| NSMB (MarioWiki) | Three Star Coins per level; a full world set unlocks a bonus level; checkpoint flags | Three stickers per level; a midpoint face |
| Celeste (Wikipedia; GDC) | Optional berries; B-sides via a hidden cassette; Game Informer said the berries lacked extrinsic motivation | Stickers must earn something visible (§9.5) |
| Shovel Knight (Boss Fight Books) | "You teach A, then you teach B, then you put A and B together"; a fogged map | Linear unlocks; World 2 fogged until World 1 is clear |
| Mega Man / MMX | Weapon Get shows Mega Man in the new color; the X intro teaches with no text | Rubik changes color: the GET card shows the new-color sprite |
| Portal commentary | Valve "inserted two test chambers" before a lesson that came too fast; slow puzzles caused fatigue | Split lessons across levels; alternate stealth and traversal levels |
| Baba Is You (Teikari) | Levels were "prone to having unintended solutions" until tested | Reachability tests for each level's gate (§10) |
| Kirby (Sakurai) | "We need to be kind to beginners" | Gentle main line; challenge lives in stickers and stamps |
| Gris (MCV) | "A game that evolved visually, not only mechanically" | Forest and map regain color with Rubik |
| Super Meat Boy (McMillen) | The remaining penalty is restart time | Keep the 0.45 s respawn; short levels make Retry cheap |
| Branyiczky (difficulty) | Nested curves with a "flattened peak" | A sawtooth (§7) |

## 3. What players say

- **Front-loading drives people away.** Adrian Chmielarz quit *Mirror's Edge* when it "quickly went"
  from basic moves to complex combos. Teddy Diefenbach recommends unlocking inputs over time.
- **Over-teaching is also a complaint.** A *Wonder* review says its badge tutorials "stretch almost
  all the way to the end of the game", which made it feel small.
- **Badly spaced checkpoints frustrate:** an *Itorah* review calls them "really far apart or far too
  close".
- **Bite-sized levels are welcome** when they vary the pace (TechRadar on Wonder's "Break Time!").
- **Collectibles need a payoff** (Game Informer on Celeste's strawberries).
- **Scale:** itch jam developers report games of 2–10 minutes, so about 10 minutes of World 1 in six
  resumable chunks feels like a full game.

## 4. Diagnosis: why Stage 1 feels like "everything at once"

- The 42 s baseline route meets **about a dozen new ideas**: jump, stomp, absorb, disguise, the
  white/green trade-off, "?", mid-air swap, dash, refills, enforcers, theft, REVERSE and smash. A human
  first play (roughly 3–4 minutes) still meets one about every 20 s, with no time to master any.
- Green arrives at 4.4 s, and dash works from frame one although it is first needed at column 113.
  Five hint bubbles share one stage. Nothing persists, so there is no journey and no way to practise
  one section.
- The sections are already modular (beat, sticker and checkpoint each), so the split is mostly
  re-authoring, not a redesign.

## 5. Campaign rules (measurable)

1. **One new idea per level, plus one twist** from the same rules; older ideas return as recombination.
2. **Length:** 100–160 columns; QA route 15–35 s; first play 60–120 s. The finale may run to 150 s,
   with its escape ≤ 45 s.
3. **Checkpoints:** a start face plus a midpoint just *before* the twist, so a retry never replays the
   introduction (two midpoints in 1-5 and 1-6). Gaps ≤ 12 s of route time; never inside a cone.
4. **Sawtooth:** each level's first beat is easier than the previous level's last. Introductions are
   safe: no water, and enemies asleep or walking away.
5. **Stickers:** ★1 on the main line, tracing the new move's arc; ★2 off the line, using the idea
   cleverly; ★3 mastery, combining it with an older idea.
6. **Fixed kits:** a level always plays with the forms and dash it was designed for, even on replays,
   so sticker gates and QA routes stay valid.
7. **Hint budget:** at most two bubbles per level, saved per player; nothing is re-taught.
8. **Rules never change:** a card can't see its own color, cones are the detection area, cards are
   solid, and only spears and water kill.
9. **Geometry against the measured envelope** (flat ground, full run speed; card head = 84 px):

| Move | Rise | Flat reach | Design use |
|---|---|---|---|
| Single jump (held) | ≈ 93 px | ≈ 8–9 tiles | 2-tile steps; 3 tiles never |
| White double jump | ≈ 175 px | ≈ 15 tiles | 4-tile ledges; note it already crosses 10-tile "dash" gaps |
| Stomp bounce | ≈ 114 px over the head | ≈ 10 tiles | Springboards to 4–5-tile ledges |
| Bounce + white air jump | ≈ 196 px over the head (feet ≈ 280 px over the card's floor) | ≈ 16 tiles | 8-tile ledges (256 px) that the double jump can never reach |
| Jump + dash | ≈ 93 px | ≈ 14 tiles | Green needs dash for 10–13 tiles |
| Double jump + dash | ≈ 175 px | ≈ 20 tiles | 16–19-tile gaps make dash necessary for white too |

## 6. World 1 "Green Forest", level by level

| Lv | Name | New idea | Twist | Kit at start | GET | Columns | First play | Ends with |
|---|---|---|---|---|---|---|---|---|
| 1-1 | Home Cliff | Jump | Double jump | white | — | ~120 | 45–75 s | Goal face (a dozing card visible beyond it) |
| 1-2 | Sleeping Cards | Stomp/bounce | Bounce refreshes the air jump | white | GREEN at the end | ~130 | 60–90 s | GREEN GET, then the goal face |
| 1-3 | Hide in Green | Disguise | White/green trade-off | white, green (spawn green) | — | ~150 | 75–110 s | Goal face |
| 1-4 | Storm Dash | Dash | Refills chain dashes | white, green | DASH at the start | ~140 | 60–100 s | Goal face |
| 1-5 | Lookouts | Awareness and spear | A red card sees green | white, green, dash | — | ~160 | 90–120 s | Goal face |
| 1-6 | The Vault | The heist (recombination) | REVERSE + red smash | all of W1 | RED at the theft | ~150, run both ways | 120–150 s | Back at the level's start → World clear |

The **goal face** is a 2× chalk cube face on a stick, the same art language as the checkpoints, so it
needs no new art. Touching it fills it with Rubik's current color and spins it (§9.2).

### 1-1 Home Cliff: jump → double jump

| Columns | Beat | Content | Sticker / CP |
|---|---|---|---|
| 0–12 | Introduce | Today's home cliff and chalk face; the red beacon is tiny on the horizon. ◀▶ bubble after 4 s idle | CP start |
| 13–33 | Introduce | Today's first steps: 2-tile drop, 1-tile step, 4-tile ditch with a 2-tile floor and a walk-out step | ★1 on the ditch's jump arc |
| 34–60 | Develop | Rhythm of 2-tile steps and dry 3–5-tile ditches; one-way slabs 2 tiles up | ★2 just above a slab: only a *held* jump reaches it, and a tap lands safely below |
| 61 | — | Midpoint face | CP mid |
| 62–90 | Twist | A 4-tile wall on dry, flat ground; an "air jump" bubble (jump key ×2) after 2 s and ≥ 2 failed jumps; then a stair of 4-tile steps | — |
| 91–120 | Conclude | Double jumps over the first water (≤ 4 tiles, a 2-tile ledge beyond); goal face; the sleeping card of 1-2 is visible past it | ★3 two stacked 4-tile ledges above the goal (two double jumps) |

- **Assets and story:** Tileset, drained `bg1`/`bg1-sky`, `rubik_white`; the comic plays before 1-1
  on a new save.
- **Tuning:** no water before the midpoint. The wall is exactly 128 px (96 px stays banned). The lesson
  is *jump twice*, not a color, so the "white + Z" bubble moves to 1-3.

### 1-2 Sleeping Cards: stomp → green

| Columns | Beat | Content | Sticker / CP |
|---|---|---|---|
| 0–20 | Introduce | A card trampoline: a dozing card stands in a 1-tile notch across the path (solid, never wakes), and any hop lands on its head (`catch: 24`) | ★1 at the bounce apex (marks the arc) |
| 21–55 | Develop | Dozing cards on 1-tile islands over water, 4–6 tiles apart; the bounce carries Rubik across | — |
| 56 | — | Midpoint | CP mid |
| 57–95 | Twist | Bounce + air jump: 8-tile ledges (bounce feet ≈ 280 px vs. the double jump's 175 px) | ★2 on the first 8-tile ledge; ★3 a two-card bounce chain into a high nook |
| 96–130 | Conclude | Today's overhang drop onto the glowing card (unskippable); green swirls in → **GREEN GET**; goal face right after, filling green | — |

- **Returns:** double jump. **Assets:** `inimigo_verde` idle row, `rubik_storm`, `rubik_green`.
- **Tuning:** no awake cards. Test that nothing above 6 tiles is reachable without a bounce. The
  level ends on the GET, so the reward *is* the finale.

### 1-3 Hide in Green: disguise → trade-off

| Columns | Beat | Content | Sticker / CP |
|---|---|---|---|
| 0–25 | Introduce | Rubik spawns green in an open glade. One patrol walks *toward* him; its cone sweeps him, it hums ♪ and walks past. No pits | — |
| 26–60 | Develop | Today's disguise corridor (3-tile canopy, two solid patrols; wait for gaps) | ★1 on a 1-tile step between the patrols |
| 61 | — | Midpoint | CP mid |
| 62–95 | Twist | Today's 4-tile wall (green can't climb: "white + Z" bubble), then the lookout facing away; its first "?" while Rubik is white gives room to back off or swap ("green + X" bubble) | ★2 on a canopy-roof route where a roof lookout forces white→green→white swaps |
| 96–150 | Conclude | Alternating rhythm: green past a patrol, white up a 4-tile step, green past a lookout | ★3 today's swap alcove (green jump, then white air jump mid-air) |

- **Returns:** double jump, and stomping an awake card from above (it is stunned for 3 s).
- **Tuning:** "?" is introduced here only as a warning. The spear stays out of reach (canopy), and
  being seen simply knocks Rubik back. Retire the "back" safety net: green is already owned.

### 1-4 Storm Dash: dash → refills

| Columns | Beat | Content | Sticker / CP |
|---|---|---|---|
| 0–12 | Introduce | A stray storm swirl on a stump; touching it gives **DASH GET**. Flat ground to try it | — |
| 13–40 | Introduce | Today's Gap A (10–12 tiles with a recovery rock 2 tiles down). Green needs the dash, white may double-jump it; dash bubble after two slow rock landings | ★1 on the jump+dash line |
| 41–70 | Develop | Gaps of 12, then 14 tiles; one air dash per airtime; landing restores it (Rubik dims and flashes) | — |
| 71 | — | Midpoint | CP mid |
| 72–105 | Twist | Today's water stretch, widened to 16–19 tiles so white needs the dash too, with a refill orb at the apex; a dozing card on a pillar mid-gap as a stomp refill | ★2 on the second dash line |
| 106–140 | Conclude | An orb → card → orb chain; a green patrol on the landing island (go green before landing) | ★3 the high double + dash + orb + dash line |

- **Returns:** stomp (as a refill), disguise, double jump.
- **Tuning:** a fast traversal level between two stealth levels (the Portal note). Scan-test that no
  develop or twist gap can be crossed without the dash.

### 1-5 Lookouts: awareness → red sees green

| Columns | Beat | Content | Sticker / CP |
|---|---|---|---|
| 0–30 | Introduce | An open arena with no ceiling, under a lookout on a white-only ledge. The full ladder in the open: ? → ! (0.45 s beat) → charge at 240 px/s (Rubik runs 330) → wind-up → jumpable spear → 0.7 s recovery to stomp | ★1 above the recovery spot (bounce off the stunned card) |
| 31–70 | Develop | Cover: 2-tile steps cut cones; read the 0.4 s look-back before each turn; dash past a back | — |
| 71 | — | CP shielded by a step | CP 1 |
| 72–110 | Twist | Today's enforcer post: the red cone glows *bright* on green Rubik. Wait out the 3 s turns, stomp from the perch, or white-hop | ★2 on the perch behind it |
| 111 | — | — | CP 2 |
| 112–160 | Conclude | Crossing cones: a green patrol and a red sentry overlap; stay green for one and time (or stomp) the other | ★3 a never-seen line above both cones |

- **Assets:** `inimigo3-Sheet`; the full attack rows of `inimigo_verde`.
- **Tuning:** this is the riskiest level because it carries two ideas. The red card is the same rule
  applied to a new color, but if testers stall, move the enforcer into 1-6's opening.

### 1-6 The Vault: recombination → REVERSE

| Columns | Beat | Content | Sticker / CP |
|---|---|---|---|
| 0–15 | Introduce | A small start cliff (the escape's finish); the beacon now rises from inside this level; a sealed stone is seen but inert | CP start |
| 16–60 | Develop | Greatest hits in compressed form: a short canopy with one patrol (1-3), a dash + orb gap (1-4), a lookout ledge (1-5) | ★1 the swap alcove |
| 61–110 | Develop | Today's vault steps (the guard turns every 2 s), landing patrol and chamber with crossing cones | CP on stair 1 |
| 111–150 | Twist | Touching the vault gives hit-stop, **RED GET** and the REVERSE card; "Run home!"; burst cards charge. The chamber exit is sealed by a stone, so the first smash is forced and safe | ★2 alcove behind a stone · auto CP |
| 150→0 | Conclude | Escape right to left through the same level remixed: cards face home, an escape-only island card, a roof shortcut of stone gates over the canopy; every climb is ≤ 2 tiles or has a springboard | ★3 between the roof gates |

- **Why it is a climax:** the beacon has grown closer in every level, every verb returns, red smash
  is new power at the peak, the music shifts ×1.12, the level becomes its own remix, and World clear
  colors the map.
- **Tuning:** inbound ≤ 70 s of first play and escape ≤ 45 s, with no fail timer. Re-derive the
  "Quick" par as the baseline escape × 1.5.

## 7. Idea matrix (I = introduced, D = developed, T = twist, R = returns)

| Idea | 1-1 | 1-2 | 1-3 | 1-4 | 1-5 | 1-6 |
|---|---|---|---|---|---|---|
| Jump / held height | I D | R | R | R | R | R |
| Double jump | T | R | R | R | R | R |
| Stomp / bounce | — | I D T | R | R | R | R |
| Green disguise | — | GET | I D | R | R | R |
| White/green swap | — | — | T | R | R | R |
| Dash + refills | — | — | — | I D T | R | R |
| ?/!, spear, cover | — | — | warning | — | I D | R |
| Red enforcer | — | — | — | — | T | R |
| Theft, REVERSE, smash | — | — | — | — | — | T |

Expected deaths per first play, to be measured rather than assumed: 1-1 ≈ 0–1, rising to about 4 in
1-6. Each level's opening must be easier than the previous level's conclusion.

## 8. World 2 "Blue Mountains" (phase 2, only after feedback)

`tileset_ice.png` has the same atlas layout as `Tileset.png` (checked by eye), so the auto-tiler only
swaps the image. `bg2exp` is the sky strip above `bg2` (`level_blue.tscn`, y = −99.75). The original
level mixed green and blue cards.

| Lv | New idea | Twist | Tuning |
|---|---|---|---|
| 2-1 Frozen Steps | Slick ice tops (marked with a 2 px glint line) | Ice plus dash momentum | Acceleration 2600 → 1400 and braking 3300 → 1000 px/s² (≈ 55 px stopping distance); every teaching slide ends at a wall |
| 2-2 Blue Watch | Blue cards see every form | A green card beside a blue one | Cover and timing only; blue cones always bright |
| 2-3 Rockfall | Telegraphed falling rocks (0.8 s of dust and shadow) | A rock stuns a charging card | Draw rocks from ice-tileset block cells, **not** the unverified `player/Rock1–2` |
| 2-4 Smash Peaks | Red smash inbound on ice-sealed stones | Smash, refund, smash chains over gaps | Builds the canopy chain Stage 1 could not fit |
| 2-5 Nervous Watch | Fast-turning sentries (the original's 0.5 s flip time) | The first mandatory mid-air swap | Generous 0.15 s swap cooldown; one gate only |
| 2-6 Blue Vault | Summit heist (recombination) | BLUE GET → full-color storm | Optional 20 s "full-color lap" where no card can see Rubik, then `end_game.png` |

`inimigo2-Sheet` (110×86 cells) appears to be row 0 walk ×9, row 1 attack ×8, row 2 idle ×2, a
different row order from the red sheet; verify it. Shipping World 2 moves `bg2`, `bg2exp`,
`tileset_ice`, `inimigo2-Sheet` and `rubik_blue` (ending only) to *screen* in `art-manifest.json`.
Files stay byte-identical; any desaturation happens at runtime.

## 9. Progress and reward systems

### 9.1 World map (original art only)

- **Layout:** a 960×540 side view, `bg1-sky` over `bg1`, with a path of slab cells (atlas row 0,
  cells 12–17) at y ≈ 420.
- **Nodes:** chalk faces about 140 px apart; 1-6 is `cofre.png` at 2× under the red beacon. Locked
  nodes are a faint outline, open ones bob, and cleared ones fill with the color gained there. Each
  node shows three sticker pips and any stamps.
- **Color:** the forest's `colorAmount` is 0.12 per cleared level from 1-1 to 1-5, then 1.0 after 1-6
  (the existing `color` compositing).
- **Rubik** (2× run row) walks node to node in 0.35 s: ←/→ to walk, Enter/Space/↑ to enter, Esc/P for
  the menu. On touch, tap a node to walk there and tap again or JUMP to enter. Reduced motion snaps.
- **HUD:** owned form cards top-left; "11/18" stickers, fullscreen and pause top-right. A bottom panel
  shows the name, best time, sticker slots and stamps.
- **Unlocks** are linear: after a clear, the chalk path to the next node draws in (0.6 s).
- **World 2 teaser:** `bg2` peaks at the right edge, fogged until World 1 is clear (Shovel Knight).

### 9.2 Intro card, level clear, world clear

- **Intro card:** an Uno-style card ("1-3" at 64 px, "Hide in Green" at 32 px, sticker slots) over the
  dimmed first frame for 1 s (0.5 s on replays). Input goes live at 0.4 s; any key skips.
- **Level clear:** 0.25 s of hit-stop; the goal face flips and fills with Rubik's color; the `cutout`
  iris closes. Tally: time and best, stickers flying into slots (0.15 s each, with sound), stamps.
  **Continue** (default) or Retry. At most 3 s, skippable.
- **World clear:** today's results screen, retitled, with world totals and the three world medals.
  Then one narration box in the comic's caption style ("Green and red are back. Blue is up in the
  mountains."), followed by World 2 or `end_game.png` if World 2 isn't built.

### 9.3 HUD growth

| Level | Form cards | Keys shown | Dash | Extras |
|---|---|---|---|---|
| 1-1 | white | none (only one form) | locked, no glyph | 3-slot sticker strip |
| 1-2 | white; green dealt at the GET | X with green, Z on white | locked | — |
| 1-3 | white, green | Z, X | locked | — |
| 1-4 → 1-5 | white, green | Z, X | DASH GET: state shown on Rubik; a Shift/DASH keycap for the first 3 dashes | — |
| 1-6 | + red at the theft | Z, X, C | yes | Par clock and home arrow after the theft |

Touch shows only the pads of the current kit: no DASH pad before 1-4 and no red card before the theft.

### 9.4 GET moments (Mega Man's color change, literally)

Hit-stop, storm, then a 1.2 s card: new-color Rubik at 4×, the form card with its key, and one
caption of at most six words ("Green cards can't see green."). The card is then dealt into the HUD
(the existing `chipDeal`). Each GET saves a checkpoint, so a death can't undo it.

### 9.5 Stickers, stamps, medals

- **Stickers:** ids like `"1-3:2"`, permanent and saved on touch; replays show them as faint outlines.
- **Stamps:** "Unseen" (no "!") on levels with awake cards (1-3 onward); "Quick" on 1-6 only.
- **World medals** reuse today's three: *Full face* (18/18), *Ghost* (Unseen on 1-3 to 1-6) and
  *Quick getaway*.
- **Payoff** (the Celeste lesson): a 3/3 level gets a gold rim on its node. Later, 18/18 could unlock
  a remix level (NSMB U's Superstar Road).

### 9.6 Save format

```json
{ "v": 1, "last": "1-3", "comicSeen": true,
  "hints": { "move": "done", "airjump": "done", "white": "shown" },
  "levels": { "1-1": { "clear": true, "best": 52.4, "stickers": [1, 3], "unseen": null, "quick": null } } }
```

Use the existing `store` (wrapped in try) under `color-rush-heist:save`. If storage is blocked,
progress lasts for the visit. A clear is saved at the goal and a sticker on pickup; mid-level positions
are not saved.

### 9.7 Front-end flow

- **New save:** title → comic → iris → 1-1 → clear → **first map reveal** (Rubik walks to 1-2).
- **Returning player:** title → map, with Rubik on the last node and the comic skipped (as today).
- **Pause:** Resume, Back to checkpoint, Restart level, **Map**, settings, Controls, Art, Credits.

## 10. Implementation notes for the squad

- **Levels as data:** a `levels/` folder with `builder.mjs` (today's `fill/ground/ledge/water/back`),
  one frozen module per level and `index.mjs` for the order. A level carries `id`, `name`, `kit {forms,
  dash, start}`, `unlocks`, the map entities as today, `goal` or `vault` + `escape`, `hints`, `par` and
  `beacon`.
- **Model:** `createGame(level, save)`, with `g.level` replacing the module-level imports, a per-game
  stone map, and a generalized `win()`. The simulation stays pure. Put order, unlocks, kits, save
  migration, stamps and medals in a pure, tested `campaign.mjs`.
- **`game.mjs`:** add `map`, `intro` and `clear` screens; `L` becomes the current level.
- **Tests:** run today's rule tests over every level; add kit-gate tests (the 1-2 ledges need a bounce,
  the 1-4 gaps need the dash); give each level baseline and mastery routes; test campaign persistence
  and storage failure; keep the 103-image test, with `tilesOnScreen()` covering all levels.
- **QA hooks:** `__game.loadLevel(id)`, `resetSave()`, `getState().level/.kit/.save`. In the browser,
  check map input, unlocks, reload persistence and a blocked-storage iframe.
- **Docs:** update README, LEVEL_DESIGN (one section per level) and `common/SHARED_MEMORY.md`.

## 11. Pitfalls

1. **Scope:** about 850 columns versus 208 today. Reuse today's sections, keep four beats per level,
   add no new art or verbs in World 1, and build World 2 only after feedback.
2. **Re-teaching:** never repeat an earlier level's safe introduction or show a bubble twice.
3. **Padding:** a level is as long as its idea needs; don't stretch 1-1 to hit 60 s.
4. **Two-idea spikes:** stacking novelty on peak challenge makes a wall. Watch 1-5 and the first smash.
5. **A slow start:** 1-1 and 1-2 have no threat. Keep them short and lively; if playtests find them
   slow, merge them before adding enemies.
6. **Losing progress:** never wipe stickers or clears; put a checkpoint before every twist.
7. **Narrative drift:** Rubik starts colorless at home after the comic. Green comes from a card, red
   from the vault, and blue is the ending, never an earlier ability.
8. **Precision swaps:** mid-air swaps stay optional (stickers only) until 2-5.
9. **Unverified art:** keep `player/` archive-only.
10. **Independence:** one standalone game, with a plain green page around it.

## 12. What to playtest first

Time to first green; whether 1-1/1-2 feel slow; whether "?" in 1-3 reads as a warning; whether each
form sees why the 1-4 gaps need the dash; deaths and quits in 1-5; 1-6 first-play length (≤ 150 s);
whether the map's color and pips read without explanation; whether stickers pull players into replays.

## 13. Sources

- Hayashida on kishōtenketsu: [Game Developer](https://www.gamedeveloper.com/design/the-secret-to-i-mario-i-level-design); GMTK on 3D World: [Engadget](https://www.engadget.com/2015/03/17/super-mario-3d-world-design/), [MCV](https://www.mcvuk.com/development/video-nintendos-level-design-secrets-in-four-steps)
- Miyamoto on World 1-1: [Game Developer](https://gamedeveloper.com/design/how-miyamoto-built-i-super-mario-bros-i-legendary-world-1-1)
- Wonder: [Nintendo, Ask the Developer vol. 11](https://www.nintendo.com/us/whatsnew/ask-the-developer-vol-11-super-mario-bros-wonder-part-1), [TechRadar review](https://www.techradar.com/gaming/nintendo-switch/super-mario-bros-wonder-review-sheer-joy-in-video-game-form), [Deseret review](https://www.deseret.com/entertainment/2024/06/04/super-mario-bros-wonder-review/)
- SMB3: [Wikipedia](https://en.wikipedia.org/wiki/Super_Mario_Bros._3), [Koncewicz, SMB3 lessons part 2](https://www.gamedeveloper.com/design/super-mario-bros-3-level-design-lessons-part-2)
- NSMB: [Star Coin](https://www.mariowiki.com/Star_Coin), [Checkpoint Flag](https://www.mariowiki.com/Checkpoint_Flag)
- Celeste: [Wikipedia](https://en.wikipedia.org/wiki/Celeste_(video_game)), [GDC: Designing Celeste](https://gdcvault.com/play/1024307/Level-Design-Workshop-Designing-Celeste)
- Shovel Knight: [Kotaku / Boss Fight Books](https://kotaku.com/how-shovel-knights-developers-modernized-nes-game-desig-1829767941)
- Mega Man: [Special Weapon (Weapon Get colors)](https://megamanwiki.com/wiki/Special_Weapon_(Classic_era)), [Nintendo Life on the MMX intro](https://nintendolife.com/features/soapbox-mega-man-xs-tutorial-is-the-perfect-intro-to-capcoms-sublime-sub-series)
- Portal: [developer commentary](https://theportalwiki.com/wiki/Portal_developer_commentary)
- Baba Is You: [Game Pilgrim interview](https://gamepilgrim.com/2019/04/06/developer-interview-hempuli-oy/)
- Kirby: [Nintendo Life on Sakurai](https://www.nintendolife.com/news/2023/09/random-kirbys-dream-land-is-all-about-being-kind-to-beginners-says-sakurai)
- Gris: [MCV](https://www.mcvuk.com/development/50-shades-of-gris-how-nomada-studio-created-a-game-that-evolves-visually-not-only-mechanically)
- Super Meat Boy: [McMillen, Game Developer](https://gamedeveloper.com/design/raw-meat-game-design-tips-from-team-meat-s-edmund-mcmillen)
- Difficulty curves: [Branyiczky, fractal curves](https://www.gamedeveloper.com/design/doing-difficulty-right-fractal-curves)
- Tutorial pacing: [Game Developer, The art of the tutorial](https://gamedeveloper.com/design/the-art-of-the-tutorial-when-to-hold-a-player-s-hand-when-to-let-it-go)
- Checkpoint complaints: [Itorah review](https://www.playstationcountry.com/?p=21924)
- Jam game length: [itch.io forum](https://itch.io/jam/brackeys-5/topic/1215687/how-long-is-the-average-play-time-of-a-jam-game)
- Original project facts: `../refs/color-theft-story/scenes/level_blue.tscn` (help texts, soldier mix, flip times), `scripts/soldier.gd`, `scripts/world.gd`

## 14. Every card has a job (2026-11-10, revision five playtest)

The user's playtest, translated: *"In CRH I get stuck here, not knowing what to do next. The movement is
good and the levels are on the right track, but the enemies exist just to exist: it is very easy to walk
between them. And this final room isn't fun at all, several of them on top of each other; there's no fun
for the player."* The screenshot is 1-6's vault chamber just after the theft: red Rubik at the sealed door,
the red vault guard behind him, the landing card outside, a chaser off-screen, the Quick seal already
struck through.

### 14.1 What was measured (before)

A route audit stepped both QA routes of every level and recorded, per card: stomps/bounces/knocks, time
inside its drawn cone in a colour it sees, time inside its cone turned around (its facing is what let Rubik
pass), time inside its cone disguised (a hum), how soon before entering that cone Rubik had swapped to its
colour, and the closest approach.

- **Walk-throughs:** most engagements were hums with no swap in the previous 2 s. Rubik was already
  green and simply walked through. Examples: 1-3's corridor pair, 1-4's island card.
- **Never engaged by the guided line:** 1-2 `chain-a`/`chain-b`, which the baseline double-jumps; only the
  mastery stomped them, for no reward. 1-5 `cross-green` never came within 192 px on either route.
- **The vault room:** inbound, green Rubik walked among the landing patrol and both "burst" cards; only the
  red sentry mattered. After the theft, model probes from the theft state found:
  - Standing still for 8 s: speared twice.
  - Pushing against the sealed door: speared after about 5 s.
  - Smashing once, then walking: bumped back by the landing card, then speared.
  - Each death respawned Rubik inside the sealed room with the chasers reset.

  That is a death loop with no in-world cue for the smash-then-knock sequence. It is why the player was
  stuck.
- **A sequence break:** inbound, white can double-jump from the home cliff onto the canopy roof, and from
  the roof's left end 63% of a jump-timing sweep hopped the 2-tile mid gate onto sticker 3 (probably how
  the screenshot's run already held ★3).

### 14.2 What the references say

| Source | Technique | Applied here |
|---|---|---|
| Koncewicz, [SMB3 level design lessons, part 1](https://www.gamedeveloper.com/design/super-mario-bros-3-level-design-lessons-part-1) (Game Developer, 2011) | A threat first appears where it is low-risk, then returns combined with others, layering complexity gradually | One card per beat in the escape, each with a different verb; pairs only where their colours interlock |
| Kerr, [How Miyamoto built World 1-1](https://www.gamedeveloper.com/design/how-miyamoto-built-i-super-mario-bros-i-legendary-world-1-1) (Game Developer, 2015); [World 1-1](https://en.wikipedia.org/wiki/World_1-1) | The first Goomba walks at Mario on flat ground, cheap to lose to: the enemy teaches without text | The alarm card stands where the forced first smash carries into it, so the first knock is taught by the same press |
| Nutt, [The secret to Mario level design](https://www.gamedeveloper.com/design/the-secret-to-i-mario-i-level-design) (Game Developer, 2012); GMTK, [Super Mario 3D World's 4 Step Level Design](https://www.youtube.com/watch?v=dBmIkEvEBtA) (2015) | Introduce, develop, twist, conclude; drop an idea once it has done its work | Cards that repeated an earlier beat with no new decision were removed (1-2's pair, 1-3's twin) |
| Kumar, [Mark of the Ninja's five stealth design rules](https://gamedeveloper.com/design/-i-mark-of-the-ninja-i-s-five-stealth-design-rules) (Game Developer, 2012); Alexander, [Reinventing stealth in 2D](https://gamedeveloper.com/design/reinventing-stealth-in-2d-with-i-mark-of-the-ninja-i-) (2012) | Show the player exactly what guards perceive and why they react (clarity over mystery), with a checkpoint between encounters | The cone already is the detection area; now the hum also overrides "?" when a card can't see Rubik's colour, and the sealed door carries its own cue |
| GMTK, [How Stealth Game Guards See and Hear](https://www.youtube.com/watch?v=Ay-5g36oFfc) (School of Stealth, 2020) | Perception rules decide what kind of stealth the player gets | Disguise alone is not a decision; a card earns its place where the colour that passes it is wrong for the next thing (a white climb, a red smash) |
| Thompson, [The AI of DOOM (2016)](https://www.gamedeveloper.com/design/cyber-demons-the-ai-of-doom-2016-) (Game Developer, 2018) | Readable enemy roles, plus an attack-token cap on how many enemies attack at once | No stacked cards (tested); after the theft, nothing in the sealed room can attack red |
| The Level Design Book, [Encounter](https://book.leveldesignbook.com/process/combat/encounter) and [Enemy](https://book.leveldesignbook.com/process/combat/enemy) | Use only a few enemy types at once; two types make a readable relationship; visible-but-unreachable enemies let players plan | The vault room is one card inbound; 1-5's red/green pair stands side by side; the alarm card is visible through the door before the smash |
| Keren, [Boss battle design fundamentals](https://www.gamedeveloper.com/design/video-boss-battle-design-fundamentals) (GDC 2018 summary, Game Developer) | A climax tests skills the player already has | The vault room recombines the red sentry (1-5), stair cover, the stomp from behind (1-2), then the new red verbs, one at a time |

GDC Vault's Anderson talk ("Of Choice and Breaking New Ground", 2013) was seen only as a session page,
and Eurogamer's Goomba-vs-Koopa video only in search snippets. Neither is used for a claim.

### 14.3 The rule adopted

Every card declares a job, and `tests/model.test.mjs` proves each job on the routes:

| Job | Proof on the routes |
|---|---|
| `gate` | The guided line must stomp it |
| `refill` | Stomped mid-gap for the dash |
| `knock` | A red dash knocks it |
| `watch` | A route spends time in its cone, or its turned cone, in a colour it sees: its facing is what the line times |
| `swap` | The guided line swaps to its colour less than 2 s before entering its cone |
| `teach` | One per level: the idea's first card |
| `disguise` | It walks through Rubik where he can't go around it. Allowed only in 1-3 and 1-4, where hiding in plain sight is the lesson |

Two cards on one floor keep at least 2 tiles between their bodies unless they are a declared pair.

### 14.4 What changed

The per-card table is in `LEVEL_DESIGN.md`.

- **1-6:** the vault room is one red sentry inbound. After the theft:
  - Nothing in the sealed room can see red.
  - An escape-only alarm card stares at the door, inside the reach of a dash fired from the doorway, so the
    smash knocks it too. Fired from deeper in the room, the dash stops in the doorway; the refunded dash
    or green answers the card's "?".
  - The door pulses, storm streaks run into it, and the dash key sits on the upper stone until the doorway
    opens.
  - The chasers are gone, and the mid roof gate is stacked three high.
- **1-5:** the green crossing card left the red sentry's floor (it overlapped it) and now patrols a 4-tile
  goal block. White can climb it but can't walk past the card's body, so the player swaps to green before
  landing (P2's lesson), waits for its back, or stomps it. A first version had the card watching the climb
  from the floor; a real-key test showed an impatient white climb left the cone in about 0.2 s, earned only
  a "?" and still won unseen, so that version was dropped.
- **1-3:** one corridor patrol, not two.
- **1-2:** the pair after the wall is gone, leaving a breather before the finale.
- **1-4:** unchanged; its cards already worked as refills and a disguise landing.

Skill gradient (D2, expert vs guided): 1-4 2.3% (unchanged), 1-5 11.2% (was 4.8%: the guided line lands
after the red sentry's stomp and climbs the goal block, while the expert's held bounce reaches the high
line), 1-6 escape 8.0% (was 8.4%). Only 1-5 moved meaningfully. All three are still below the rubric's 15%.
Raising them further would mean stronger dash carry, which is a level-design call (see `MOVEMENT_AUDIT.md`).

**Not verified:** whether players now find the cards fun. That needs the user's playtest. Watch first:
whether the knock reads as Rubik's doing rather than an accident, and whether 1-5's last climb feels fair.
