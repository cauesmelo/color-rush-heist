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
| Held stomp bounce | 195 px over the card's floor (a tap: ~150) | stomps from perches, 1-2's pit and chain |
| Stomp + white air jump | 277 px over the card's floor | 1-2's 7-tile wall and 8-tile ledge |
| Green dash-jump / jump + dash | crosses ≤ 13 / ≤ 17 tiles | 1-4's 12/14-tile gaps need the dash as green |
| Dash | 145 px, gravity-free, horizontal only | 1-4's 20-tile orb gap needs it as white too |
| Ledge assist | a lip ≤ 12 px above the feet is stepped onto | below every gating height (93+12 < 128, 175+12 < 192) |
| Support (movement audit) | the feet (±11 px), not the 40 px box; a box edge alone on a lip scrambles on (moving toward it) or slips off within 4 ticks | the takeoff point is unchanged (coyote counts from the feet); the audit's gap lab gives the same envelope before and after |
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
- Every card is awake: patrols (some at 60-70% pace for introductions), sentries
  turning on timers, and `fixed` lookouts that hold one facing. A stomp works from
  above or behind; a card facing the side Rubik came from, or an aware one, has its
  spear up (drawn) and pops him away.

## 1-1 Home Cliff — jump → double jump (120 columns)

Kit: white. No dash, no awake cards, no water before the midpoint.

| Columns | Beat | Content | Stickers / CP |
| --- | --- | --- | --- |
| 0–33 | Introduce | The old home cliff (row 12) and first steps: 2-tile drop, 1-tile drop, a 1-tile step up, a 4-tile ditch only 2 deep with a walk-out step | CP start; ★1 on the ditch's arc |
| 34–59 | Develop | 2-tile steps and dry 3-tile ditches; a one-way slab (51–54) level with the step beside it | ★2 above the slab: a held jump from it |
| 60–95 | Twist | Flat dry run-up, then a 4-tile wall (71) and a second 4-tile step (77): a single jump (93 px) can't, a double jump can; "jump, jump" bubble after two short jumps and 2 s; 2-tile steps back down | CP mid (62) |
| 96–119 | Conclude | The first water (4 tiles) with a bank 4 tiles up; the goal face (113); two stacked 4-tile slabs above the bank | ★3 on the top slab (two straight-up double jumps) |

Hints: ◀▶ after 4 s idle; "jump, jump". No cards at all: 1-1 is only about the body.
The goal stands before the end wall: passing above it from the slabs only drops Rubik
behind it, a 2-tile step from the face.

## 1-2 Stomping Ground — stomp → stomp from behind → GREEN GET (134 columns)

Rebuilt after the user's feedback ("no sleeping enemies; I like the head stomp").
Kit: white. Every card is awake; `spears: false` (being seen only gets Rubik pushed).
No Unseen stamp: this is the stomp lesson, not a stealth level.

| Columns | Beat | Content | Stickers / CP |
| --- | --- | --- | --- |
| 0–32 | Introduce | A slow patrol (60% pace) in a dry pit 4 tiles below the start cliff; its cone is in the pit, so Rubik watches from above, jumps onto its back while it walks away, and the held bounce clears the far rim. Falling in costs nothing: a double jump climbs out | CP start; ★1 at the first bounce's peak; CP "chain" on the rim |
| 33–64 | Develop | 30 tiles of water with four 1-tile islands, each with a lookout staring ahead (fixed, facing the way Rubik travels): bounce from back to back | ★3 (mastery) on a slab 8 tiles over the last island: a held bounce + air jump |
| 65–106 | Twist | A far bank 2 below the islands (under the last cone), a 2-tile block whose riser shields the mid face, then a patrol pacing before a 7-tile wall: drop behind it while it walks to the wall, stomp, air-jump at the peak; an 8-tile ledge off to the left. Then a patrol and a pedestal lookout to bounce over | CP mid (65); ★2 on the 8-tile ledge; CP "wall" on the wall top |
| 107–133 | Conclude | 2-tile steps up to the old Stage 1 run-up under its rock overhang: every walk, run, jump or double jump off the edge lands on the back of the **green card**, a lookout facing away that always takes the stomp. Green swirls in → **GREEN GET** → the goal face fills green | auto CP "green" |

Hint: "from behind", shown after the first spear-up (a drawn card with an arrow onto
its back), retired by the first stomp. Tests prove no double jump reaches the 7-tile
wall top, the 8-tile ledge or the ★3 slab.

## 1-3 Hide in Green — disguise → white/green trade-off (124 columns)

Kit: white, green; spawns green; no dash. `spears: false`: a spotted Rubik is charged
and bumped back, never speared (the spear is taught in 1-5). No water, so only two
checkpoints (start, midpoint).

| Columns | Beat | Content | Stickers / CP |
| --- | --- | --- | --- |
| 0–25 | Introduce | An open glade; a patrol walks toward green Rubik, its cone sweeps him, it hums (♪) and walks through him. It turns 392+ px short of the start face | CP start |
| 26–60 | Develop | The old disguise corridor: a 3-tile canopy, two patrols, a 1-tile step between them | ★1 on the step |
| 61–83 | Twist | A 4-tile wall green can't climb ("white card + Z" after 2 s of green jumps); a lookout on top facing away: its first "?" at white Rubik gives room to swap ("green card + X") | CP mid (63, the corridor exit) |
| 21–60 (above) | Off line | White up a slab (21–24) onto the canopy roof, green past the roof lookout, white up to a high slab | ★2 on the high slab |
| 81–113 | Conclude | A 2-tile step down, green through a floor patrol, white up a 4-tile step, green past the alcove lookout | ★3 in the swap alcove 5 tiles above the lookout (green jump through it, white air jump) |
| 114–167 | Finale | Two pillars and a goal platform over a dry pit, 12 tiles apart, each with a lookout turning every 2.2 s. Only white's double jump makes a hop (green jumps 11), and a hop takes ~0.9 s, longer than the 0.6 s a card needs to spot white Rubik. So wait as green, and hop out behind the card you stand by while it faces you; go green again before landing. Seen as white → the card charges and shoves Rubik into the pit (climb back, ~8 s) | — |

Hints: "white card + Z", "green card + X". "Unseen" is earned here (the finale).

## 1-4 Storm Dash — dash → refills chain dashes (154 columns)

Kit: white, green, **starting green** (no double jump, so the dash is the guided way
over); dash **off** until the swirl. Storm tint. `spears: false`. No Unseen stamp.

| Columns | Beat | Content | Stickers / CP |
| --- | --- | --- | --- |
| 0–19 | Introduce | A stray storm swirl on a stump (8): hop on it → **DASH GET** (card, checkpoint). Flat ground to try it | CP start; auto CP "dash" |
| 20–31 | Introduce | Gap A: 8 tiles of water + a recovery rock 2 down = 12 tiles bank to bank. Green needs the dash (white may double-jump it); the Shift/DASH bubble after two slow rock landings or falls | ★1 on the jump + dash line |
| 32–69 | Develop | A 12-tile gap, then a 14-tile gap, bank to bank at the same height (a short hop + dash lands; the ledge assist catches a lip): one air dash per airtime, landing restores it | CP "gap2" on the bank between them |
| 70–121 | Twist | **20 tiles** of water with a refill orb at the apex (white needs the dash too), then 20 tiles with a lookout on a pillar mid-gap, facing the way Rubik flies: stomp its back to refill the dash | CP mid (72); ★2 on a low dash right off that stomp's refill, then an air jump to the bank |
| 122–153 | Conclude | Orb → lookout → orb chain over 19 tiles onto an island with a green patrol (Rubik is green); the goal | CP late (123); ★3 on the high line: double jump, dash, a high orb, dash, straight to the island |

Hint: Shift/DASH. Storm wisps (the swirl's streaks) drift across the lip of every
gap the main line dashes. The HUD gets a dash glyph at the GET and a Shift keycap for
the first three dashes. Tests sweep every takeoff tick and air-jump timing: green
never jumps the 12/14-tile gaps and white never double-jumps the 20-tile orb gap
without dashing (the pillar gap's lookout is a refill: stomping it also refreshes
white's air jump, an intended alternative).

Differs from the brief: the brief's 16–19-tile "white needs the dash" gaps assumed a
15-tile double jump; the measured double jump crosses 19, so the twist gaps are 20.

## 1-5 Lookouts — the awareness ladder and the spear → a red card sees green (124 columns)

Kit: white, green, dash. Dusk tint. Spears on.

| Columns | Beat | Content | Stickers / CP |
| --- | --- | --- | --- |
| 0–34 | Introduce | An open arena under the start ledge (its face cuts the cone): one patrol shows the whole ladder in the open — "?" → "!" (0.45 s beat) → charge 240 px/s (Rubik runs 330) → wind-up → a jumpable spear → 0.7 s recovery to stomp | CP start; ★1 high above the arena: a stomp bounce off the teaching card (a double jump falls short) |
| 35–58 | Develop | 4-tile steps (white) under a patrol and a turning sentry; 2-tile blocks cut their cones; the "…" look-back telegraphs each turn | — |
| 59–82 | Twist | The old enforcer post: a red sentry (turns every 3 s) sees green; wait it out, stomp it from the perch while it faces away, or hop. Facing Rubik, its spear is up: a run-and-jump at it can't stomp it | CP post (62, shielded by the step); ★2 on the perch behind it |
| 83–123 | Conclude | A green patrol and a red sentry with crossing cones: stay green for one and time or stomp the other; the goal on a 2-tile block | CP cross (85, on a block whose risers cut both cones); ★3 at the end of a high line of slabs (row 10) far above both cones |

No hint bubbles. Risk (brief §11): two ideas in one level; watch first plays here.

## 1-6 The Vault — recombination → theft → REVERSE (136 columns)

Kit: white, green, dash; red at the theft. Night tint. The beacon rises from the vault.
Old Stage 1 geometry (vault steps, chamber, the room's two cards, alcove, roof gates,
escape-only card) is reused at an offset of −70 columns.

| Columns | Beat | Content | Stickers / CP |
| --- | --- | --- | --- |
| 0–20 | Introduce | The home cliff (the finish line) and its 2-tile steps; the roof gates are already visible | CP start; CP steps (15, the riser shields it) |
| 21–53 | Develop | A short canopy with one patrol (1-3); a 4-tile white ledge with a lookout and the swap alcove (1-3/1-5) | ★1 in the swap alcove |
| 54–83 | Develop | A jump down to an island, then 16 tiles with a refill orb (1-4) | CP bank (90, 6 tiles of runway from the water) |
| 84–132 | Develop | Vault steps (the red guard turns every 2.6 s + 0.4 s look-back; stair 3 is below every chamber cone), a landing patrol, the chamber with two patrols behind the vault (green, so green Rubik walks among them) | CP stairs (98); CP stair 3 (104) |
| 110–132 | Twist | Touch the vault: hit-stop, **RED GET**, REVERSE. Two stones drop into the chamber door (a 5-row room: no gap left), so the first red smash is forced; the room's patrols turn and chase - after every card has held still through the REVERSE card plus 0.8 s | auto CP "vault" **inside the room by the door**; ★2 in the alcove behind a stone (knock both patrols, smash it) |
| 132 → 0 | Conclude | Right to left: cards face home; an escape-only card waits on the island facing the incoming Rubik (spear up: land clear of it as green, or knock it with a red dash); green past the lookout and the corridor patrol, or the roof shortcut: from the ledge's edge, jump + red dash through the stacked gate (6 tiles above the ledge, out of a white double jump's reach inbound), run the roof, dash the mid gate | ★3 between the roof gates |

Every climb home is ≤ 2 tiles (red jumps once). No fail timer; the "Quick" par (18 s
= the baseline escape 12.2 s × 1.5) is shown as the seal it awards, struck through at
zero. A death after the theft respawns inside the sealed room (every card held
1.25 s), so the forced smash always happens. Carrying the stolen red to the
home cliff top ends the level and World 1.

## Routes (`tests/routes.mjs`)

Generated by `tests/generate-routes.mjs` (planner `tests/route-planner.mjs`, scripts
`tests/route-scripts.mjs`) by stepping the real model with commands such as "run to
x", "air-jump at the apex", "wait until the guard faces away" and, where a moving card
makes timing matter, trying a few timings on deterministic forks and keeping the first
that passes. Only the ordinary inputs are recorded; tests replay them from scratch.

| Level | Baseline | Mastery |
| --- | --- | --- |
| 1-1 | 11.6 s, ★1 | 15.9 s, 3/3 |
| 1-2 | 21.0 s, ★1, GREEN GET (spotted once: a stomp level) | 26.2 s, 3/3 |
| 1-3 | 20.1 s, ★1, unseen | 25.3 s, 3/3, unseen |
| 1-4 | 15.8 s, ★1, DASH GET (as green) | 15.2 s, 3/3 |
| 1-5 | 18.2 s, ★2, unseen | 20.5 s, 3/3, unseen |
| 1-6 | 35.1 s, escape 12.2 s, unseen | 36.8 s, 3/3, escape 13.9 s, 5 smashes |

All zero deaths. These are QA reachability times; first plays should be several times
longer (the brief targets 60–120 s, 120–150 s for 1-6).

## Known design limits

- Cards follow fixed timers, so a human's arrival time decides a patrol's facing; the
  "?" stage, riser cover and the spear-up tell exist for that reason.
- 1-1's QA route is short (~12 s): the level is as long as its idea needs.
- 1-5's perch-to-perch jump passes the enforcer without a stomp; ★2 there is an easy
  off-line reward, and 1-5's baseline collects it.
- White can double-jump 1-4's develop gaps; the level starts green, so the dash is the
  guided way; the orb twist forces it for everyone.
- The world map has no World 2 teaser; `bg2` stays in the archive.
- World 2 "Blue Mountains" is not built (brief §8).
