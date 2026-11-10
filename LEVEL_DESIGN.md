# World 1 "Green Forest": level design (as built)

Six levels authored as data in `levels/1-1.mjs … 1-6.mjs` with the shared builder
(`fill/ground/ledge/water/back`). One grid everywhere: **1 tile = 32 px = one original
16 px cell at 2×**; every level is 22 rows (704 px) tall with water surfacing at row
20, so the 960×540 view shows the original 30 × 16.9 cells. Rows count from the top.
Column ranges below are tiles. The approved brief is `RESEARCH_PROGRESSION.md`; where
the build differs, this file says so.

## Rules the geometry follows

| Move (measured on the model, tests re-check) | Reach | Used for |
| --- | --- | --- |
| Held jump (any form) | 93 px up; crosses ≤ 11 water tiles | 2-tile steps; 3 tiles never (a test scans all six maps) |
| White double jump | 175 px up; crosses ≤ 19 tiles (air jump saved for the fall) | 4-tile walls/ledges; 5 only on mastery lines |
| Bounce off a card | 195 px over the card's floor | 1-2 trampolines, stomps from perches |
| Bounce + white air jump | 277 px over the card's floor | 1-2's 7-tile wall and 8-tile ledge |
| Green jump + dash | crosses ≤ 17 tiles | 1-4's 12/14-tile gaps need it as green |
| Dash | 145 px, gravity-free | 1-4's 20-tile gaps need it as white too |
| Card body | 48 × 84 px | a 3-tile corridor fits a card but not a jump over it |

- One new idea per level, in introduce → develop → twist → conclude order; older ideas
  return as recombination. The opening of each level is easier than the previous
  level's ending (the sawtooth).
- A midpoint checkpoint sits just before each twist (two in 1-5 and 1-6). No marker can
  be inside any card's cone in any patrol position or facing (tested); risers of 2-tile
  steps shield them. Longest gap: 9.4 s of baseline route time (limit 12 s).
- Three stickers per level: ★1 on the main line tracing the new move, ★2 off the line,
  ★3 mastery combining it with an older idea.
- At most two hint bubbles per level, each idea taught in exactly one level.

## 1-1 Home Cliff — jump → double jump (120 columns)

Kit: white. No dash, no awake cards, no water before the midpoint.

| Columns | Beat | Content | Stickers / CP |
| --- | --- | --- | --- |
| 0–33 | Introduce | The old home cliff (row 12) and first steps: 2-tile drop, 1-tile drop, a 1-tile step up, a 4-tile ditch only 2 deep with a walk-out step | CP start; ★1 on the ditch's arc |
| 34–59 | Develop | 2-tile steps and dry 3-tile ditches; a one-way slab (51–54) level with the step beside it | ★2 above the slab: a held jump from it |
| 60–95 | Twist | Flat dry run-up, then a 4-tile wall (71) and a second 4-tile step (77): a single jump (93 px) can't, a double jump can; "jump, jump" bubble after two short jumps and 2 s; 2-tile steps back down | CP mid (62) |
| 96–119 | Conclude | The first water (4 tiles) with a bank 4 tiles up; the goal face (113); two stacked 4-tile slabs above the bank; a dozing card waits past the goal (a 1-2 preview) | ★3 on the top slab (two straight-up double jumps) |

Hints: ◀▶ after 4 s idle; "jump, jump". The goal stands before the end wall: passing
above it from the slabs only drops Rubik behind it, a 2-tile step from the face.

## 1-2 Sleeping Cards — bounce → bounce refreshes the air jump → GREEN GET (135 columns)

Kit: white. Every card dozes forever (`trampoline`): never sees, never stuns, only
bounces. Rubik can't stand on a card, so an island holding one is a springboard.

| Columns | Beat | Content | Stickers / CP |
| --- | --- | --- | --- |
| 0–28 | Introduce | A dozing card in a 1-tile notch blocks the path (solid; its head is 52 px above the path); hop on it. The bank after it is 13 tiles so a full bounce (~300 px) lands dry | CP start; ★1 at the first bounce's apex |
| 29–63 | Develop | 35 tiles of water with four 1-tile islands (34, 41, 48, 56), a card on each, 7–8 tiles apart: ride the bounces (let go of right a little) | — |
| 64–106 | Twist | Far bank (row 18); a card before a **7-tile wall** (82): bounce, then jump in the air — a bounce loop until you do; an **8-tile ledge** (70–74) off to the left; a second low floor with a card and a card on a 2-tile pedestal under a high nook (103–105, row 8) | CP mid (66); ★2 on the 8-tile ledge; ★3 in the nook (floor card → pedestal card → air jump) |
| 107–134 | Conclude | 2-tile steps up to a run-up under the old Stage 1 rock overhang (2 tiles of headroom, 6 tall): every walk, run, jump or double jump off the edge lands on the **glowing card** (±24 px stomp catch). Green swirls in at the bounce apex → **GREEN GET** (1.2 s card, checkpoint saved) → the goal face fills green | auto CP "green" |

No hints: the geometry teaches it. Tests prove no double jump reaches the 7-tile wall
top or the 8-tile ledge from the floor below.

## 1-3 Hide in Green — disguise → white/green trade-off (124 columns)

Kit: white, green; spawns green; no dash. `spears: false`: a spotted Rubik is charged
and bumped back, never speared (the spear is taught in 1-5). No water.

| Columns | Beat | Content | Stickers / CP |
| --- | --- | --- | --- |
| 0–25 | Introduce | An open glade; a patrol walks toward green Rubik, its cone sweeps him, it hums (♪) and walks through him. It turns 392+ px short of the start face | CP start |
| 26–60 | Develop | The old disguise corridor: a 3-tile canopy, two patrols, a 1-tile step between them | ★1 on the step |
| 61–83 | Twist | A 4-tile wall green can't climb ("white card + Z" after 2 s of green jumps); a lookout on top facing away: its first "?" at white Rubik gives room to swap ("green card + X") | CP mid (63, the corridor exit) |
| 21–60 (above) | Off line | White up a slab (21–24) onto the canopy roof, green past the roof lookout, white up to a high slab | ★2 on the high slab |
| 81–123 | Conclude | A 2-tile step down (its riser shields the late face), green through a floor patrol, white up a 4-tile step, green past the alcove lookout; the goal | CP late (82); ★3 in the swap alcove 5 tiles above the lookout (green jump through it, white air jump at the apex) |

Hints: "white card + Z", "green card + X".

## 1-4 Storm Dash — dash → refills chain dashes (154 columns)

Kit: white, green; dash **off** until the swirl. Storm tint. `spears: false`.

| Columns | Beat | Content | Stickers / CP |
| --- | --- | --- | --- |
| 0–19 | Introduce | A stray storm swirl on a stump (8): hop on it → **DASH GET** (card, checkpoint). Flat ground to try it | CP start; auto CP "dash" |
| 20–31 | Introduce | Gap A: 8 tiles of water + a recovery rock 2 down = 12 tiles bank to bank. Green needs the dash (white may double-jump it); the Shift/DASH bubble after two slow rock landings or falls | ★1 on the jump + dash line |
| 32–69 | Develop | A 12-tile gap up to a 2-higher bank, then a 14-tile gap: one air dash per airtime, landing restores it (Rubik dims when spent, flashes on a refill) | — |
| 70–121 | Twist | **20 tiles** of water with a refill orb at the apex (white needs the dash too), then 20 tiles with a dozing card on a pillar mid-gap (its bounce refills the dash) | CP mid (72); ★2 on a low dash right off the pillar card's bounce, then an air jump to the bank |
| 122–153 | Conclude | Orb → card → orb chain over 19 tiles onto an island with a green patrol (go green before landing); the goal | CP late (123); ★3 on the high line: double jump, dash, a high orb, dash, straight to the island |

Hint: Shift/DASH. The HUD gets a dash glyph at the GET and a Shift keycap for the first
three dashes. Tests sweep every takeoff tick and air-jump timing: green never jumps the
12/14-tile gaps and white never double-jumps the 20-tile gaps without dashing.

Differs from the brief: the brief's 16–19-tile "white needs the dash" gaps assumed a
15-tile double jump; the measured double jump crosses 19, so the twist gaps are 20.

## 1-5 Lookouts — the awareness ladder and the spear → a red card sees green (124 columns)

Kit: white, green, dash. Dusk tint. Spears on.

| Columns | Beat | Content | Stickers / CP |
| --- | --- | --- | --- |
| 0–34 | Introduce | An open arena under the start ledge (its face cuts the cone): one patrol shows the whole ladder in the open — "?" → "!" (0.45 s beat) → charge 240 px/s (Rubik runs 330) → wind-up → a jumpable spear → 0.7 s recovery to stomp | CP start; ★1 high above the arena: a stomp bounce off the teaching card (a double jump falls short) |
| 35–58 | Develop | 4-tile steps (white) under a patrol and a turning sentry; 2-tile blocks cut their cones; the "…" look-back telegraphs each turn | — |
| 59–82 | Twist | The old enforcer post: a red sentry (turns every 3 s) sees green; wait it out, stomp it from the perch, or hop | CP post (62, shielded by the step); ★2 on the perch behind it |
| 83–123 | Conclude | A green patrol and a red sentry with crossing cones: stay green for one and time or stomp the other; the goal on a 2-tile block | CP cross (85, on a block whose risers cut both cones); ★3 at the end of a high line of slabs (row 10) far above both cones |

No hint bubbles. Risk (brief §11): two ideas in one level; watch first plays here.

## 1-6 The Vault — recombination → theft → REVERSE (136 columns)

Kit: white, green, dash; red at the theft. Night tint. The beacon rises from the vault.
Old Stage 1 geometry (vault steps, chamber, burst cards, alcove, roof gates,
escape-only card) is reused at an offset of −70 columns.

| Columns | Beat | Content | Stickers / CP |
| --- | --- | --- | --- |
| 0–20 | Introduce | The home cliff (the finish line) and its 2-tile steps; the roof gates are already visible | CP start; CP steps (15, the riser shields it) |
| 21–53 | Develop | A short canopy with one patrol (1-3); a 4-tile white ledge with a lookout and the swap alcove (1-3/1-5) | ★1 in the swap alcove |
| 54–83 | Develop | A jump down to an island, then 16 tiles with a refill orb (1-4) | CP bank (86) |
| 84–132 | Develop | Vault steps (the red guard turns every 1.6 s + 0.4 s look-back; stair 3 is below every chamber cone), a landing patrol, the chamber with crossing cones | CP stairs (98) |
| 110–132 | Twist | Touch the vault: hit-stop, **RED GET**, REVERSE. Two stones drop into the chamber door (a 5-row room: no gap left), so the first red smash is forced and safe; the burst cards wake and charge | auto CP "vault" (stair 3); ★2 in the alcove behind a stone (knock both burst cards, smash it) |
| 132 → 0 | Conclude | Right to left: cards face home, an escape-only card on the island (bounce off it — the stomp refills the dash up to the ledge), green past the lookout and the corridor patrol, or the roof shortcut: from the ledge's edge, jump + red dash through the stacked gate (6 tiles above the ledge, out of a white double jump's reach inbound), run the roof, dash the mid gate | ★3 between the roof gates |

Every climb home is ≤ 2 tiles (red jumps once). No fail timer; the "Quick" par (18 s
= the baseline escape 11.96 s × 1.5) greys out at zero. Carrying the stolen red to the
home cliff top ends the level and World 1.

## Routes (`tests/routes.mjs`)

Generated by `tests/generate-routes.mjs` (planner `tests/route-planner.mjs`, scripts
`tests/route-scripts.mjs`) by stepping the real model with commands such as "run to
x", "air-jump at the apex", "wait until the guard faces away" and, where a moving card
makes timing matter, trying a few timings on deterministic forks and keeping the first
that passes. Only the ordinary inputs are recorded; tests replay them from scratch.

| Level | Baseline | Mastery |
| --- | --- | --- |
| 1-1 | 11.6 s, ★1 | 16.1 s, 3/3 |
| 1-2 | 18.8 s, ★1, GREEN GET | 24.2 s, 3/3 |
| 1-3 | 11.9 s, ★1, unseen | 18.5 s, 3/3, unseen |
| 1-4 | 14.1 s, ★1, DASH GET | 13.6 s, 3/3 |
| 1-5 | 18.2 s, ★2, unseen | 23.2 s, 3/3, spotted once |
| 1-6 | 27.8 s, escape 12.0 s, unseen | 33.3 s, 3/3, escape 13.4 s |

All zero deaths. These are QA reachability times; first plays should be several times
longer (the brief targets 60–120 s, 120–150 s for 1-6).

## Known design limits

- Cards follow fixed timers, so a human's arrival time decides a patrol's facing; the
  "?" stage and riser cover exist for that reason.
- 1-1 and 1-3's QA routes are short (~12 s): the levels are as long as their idea needs
  (brief pitfall 3). If playtests find 1-1 and 1-2 slow, merge them before adding cards.
- 1-5's perch-to-perch jump passes the enforcer without a stomp; ★2 there is therefore
  an easy off-line reward. 1-5's baseline also collects ★2.
- White can double-jump 1-4's develop gaps; only green needs the dash there (as the
  brief intends); the twist gaps force it for everyone.
- The world map has no World 2 teaser; `bg2` stays in the archive.
- World 2 "Blue Mountains" is not built (brief §8).
