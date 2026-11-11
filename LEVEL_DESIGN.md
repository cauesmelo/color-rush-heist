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
- **Every card has a job** (revision five; see "Every card has a job" below): a
  declared `job` that the routes prove, never a card the guided line just walks
  through. Two cards on one floor keep 2+ tiles between their bodies unless they are a
  declared `pair` (1-6's ledge).
- **Teeth for a player who ignores cones** (critic round two): every gate or watch card
  stops a cone-blind bot in at least half of 31 arrival times (`tests/cone-blind.test.mjs`,
  see "Cone-blind audit"). A watcher stands 4-6 tiles back from the 4-tile climb it
  guards, where the drawn cone is 60+ px tall (at its tip it is a sliver a climb slips
  through), and faces the climb longer than it looks away (`turnEvery: [s at it, s
  away]`). A card that has asked "?" is locked on: it sees Rubik in any colour in its
  cone or right before its face, and its body blocks him even in its own colour.

## 1-1 Home Cliff — jump → double jump (132 columns)

Kit: white. No dash, no awake cards, no water before the midpoint.

| Columns | Beat | Content | Stickers / CP |
| --- | --- | --- | --- |
| 0–33 | Introduce | The old home cliff (row 12) and first steps: 2-tile drop, 1-tile drop, a 1-tile step up, a 4-tile ditch only 2 deep with a walk-out step | CP start; ★1 on the ditch's arc |
| 34–59 | Develop | 2-tile steps and dry 3-tile ditches; a one-way slab (51–54) level with the step beside it | ★2 above the slab: a held jump from it |
| 60–95 | Twist | Flat dry run-up, then a 4-tile wall (71) and a second 4-tile step (77): a single jump (93 px) can't, a double jump can; "jump, jump" bubble after two short jumps and 2 s; 2-tile steps back down | CP mid (62) |
| 92–131 | Conclude | v1.0 (rescue round): the first water is a 2-tile puddle between level banks (102–103), then 2 tiles of water (110–111) and a 4-tile stump at the foot of the 4-tile bank (116): a plain jump lands on the stump or slides down the bank's face onto it, and the double jump tops the bank from the stump or straight from the edge. The goal face (125); two stacked 4-tile slabs above the bank | CP pool (93, 9 tiles before the puddle); ★3 on the top slab (two straight-up double jumps) |

Hints: ◀▶ after 4 s idle; "jump, jump". No cards at all: 1-1 is only about the body.

Why the conclude changed (v1.0): the old 4-tile water with a 4-tile bank came right
after the double jump was learned, 34 columns from the checkpoint. A first-timer's first
try at a new obstacle is a plain jump, so the first-timer proxy (`tests/human-proxy.mjs`)
died there: median 1, p90 4 deaths, 5 of 24 runs with 3+ deaths on the spot. With the
puddle, the stump and the "pool" checkpoint: 0 deaths (median and p90), 17.5 s.
The goal stands before the end wall: passing above it from the slabs only drops Rubik
behind it, a 2-tile step from the face.

## 1-2 Stomping Ground — the head stomp → the flat card is a springboard → the island chain → GREEN GET (134 columns)

Rebuilt in the levels round (`LEVEL_DESIGN_V1.md`): the old pit (a skilled player jumped over
it) and the pad card left 8 tiles behind a 7-tile wall (a naive player hopped at the wall for
minutes with nothing saying the grey card was a springboard) are gone. Kit: white. Every card is
awake and fights (walker, sentinel); every gate card is a `pad` and stands at the foot of what it
opens. No Ghost or Takedown stamp; the Chain stamp (4 stomps off the island chain) stays.

| Columns | Beat | Content | Stickers / CP |
| --- | --- | --- | --- |
| 0–32 | Introduce | The start cliff, a 2-tile step down, 16 flat tiles (17–32). The teach card is a **sentinel on its post** (col 25), staring at the way Rubik comes: it cannot chase, so the first strike is a read (a 0.65 s windup with the strike strip on the floor, a jab 100 px ahead). Its head is the answer: a stomp bounces Rubik up through sticker 1. Not a gate | CP start; ★1 over the post (any bounce off its head passes it); CP "dip" (30, behind the post: it only faces left) |
| 33–62 | Develop | **The wall duel.** A dip 2 below the flat ground (33–50) ends at a 7-tile wall (51–62; a double jump tops out 37 px short). A walker patrols 42–49, up to the wall's foot. Pinned against the wall by a card that chases at 190 px/s, jumping over it is the instinct; the landing is the stomp; the air jump at the bounce's peak (owned since 1-1) tops the wall; the flat pad stays at the foot, so a hop beside it bounces again | ★2 on an 8-tile ledge over the dip (the same trick, drift left); CP "wall" on the wall top |
| 63–106 | Twist | The first water: four sentinels on 1-tile islands, all staring ahead (the chain; 4 stomps without touching ground = Chain stamp). A miss costs a heart and a hop back (checkpoint on the wall top). Far bank 2 below the islands, under the last cone | ★3 on a slab 8 tiles over the last island (held bounce + air jump); CP "mid" on the far bank |
| 107–133 | Conclude | 2-tile steps up to the old Stage 1 run-up under its rock overhang: every walk, run, jump or double jump off the edge lands on the back of the **green card**, a lookout facing away that always takes the stomp. Green swirls in → **GREEN GET** → the goal face fills green | auto CP "green" |

Hint: the first hit shows a card with an arrow onto its head ("behind", retired by the first
stomp). Tests prove no double jump reaches the 7-tile wall top, the 8-tile ledge or the slab.
Proxies, 12 seeds: see `LEVEL_DESIGN_V1.md`.

## 1-3 Hide in Green — disguise → white/green trade-off (124 columns)

Kit: white, green; spawns green; no dash. `spears: false` (the spear is taught in 1-5)
and `caught: true`: a card's "!" raises the alarm and Rubik is sent back to the last
checkpoint ("caught!" over the hop). This is Ocarina of Time's castle courtyard: seen =
thrown out, no death. The "?" 0.35 s before it is the warning: leave the cone and the
lock breaks. No water. Checkpoints: start, the midpoint, and two on the finale's pit
floor (below every cone).

| Columns | Beat | Content | Stickers / CP |
| --- | --- | --- | --- |
| 0–25 | Introduce | An open glade; a patrol walks toward green Rubik, its cone sweeps him, it hums (♪) and walks through him. It turns 392+ px short of the start face | CP start |
| 26–60 | Develop | The old disguise corridor: under a 3-tile canopy one patrol walks straight through green Rubik, where he can't jump over or around it (in the glade he could); a 1-tile step. Its twin was removed in revision five | ★1 on the step |
| 61–80 | Twist | A 4-tile wall green can't climb ("white card + Z" after 2 s of green jumps). The lookout, a sentry 5 tiles back from the lip, looks at it 3 s and away 1.6 s. Wait below its cone for its back and climb, or swap to green within 0.25 s of entering its cone ("green card + X"). A white climb into its face gets "?", then "!": caught, back to the midpoint just below | CP mid (63, the corridor exit) |
| 21–60 (above) | Off line | White up a slab (21–24) onto the canopy roof, green past the roof lookout, white up to a high slab | ★2 on the high slab |
| 81–113 | Conclude | A 2-tile step down, a dip, and the 4-tile step watched the same way by the alcove card (a sentry at 102, 3 s / 1.6 s). Revision five's floor patrol is gone: green walked through it | ★3 in the swap alcove 5 tiles above the step (green jump through the card, white air jump) |
| 114–175 | Finale | Pillars A (126–131) and B (144–149) and the goal platform (162–172) over a dry pit, 12-tile gaps (green jumps 11, so every pillar takes a white climb from the pit floor or white's 12-tile hop). Each top has a watcher 4–5 tiles back from its left face, facing the climb 3 s and away 1.6 s. Wait on the pit floor (below every cone), climb on its back, walk through it in green, drop off the far edge | CP pit (116), CP pit2 (151) |

Hints: "white card + Z", "green card + X". The Ghost stamp is earned here. The expert's
line needs no waiting: green 0.15 s after each air jump keeps every card under its 0.25 s
"?" (measured with real keys too; a swap later than ~0.25 s gets caught).

## 1-4 Storm Dash — dash → refills chain dashes (154 columns)

Kit: white, green, **starting green** (no double jump, so the dash is the guided way
over); dash **off** until the swirl. Storm tint. `spears: false`. No Ghost or Takedown stamp.

| Columns | Beat | Content | Stickers / CP |
| --- | --- | --- | --- |
| 0–19 | Introduce | A stray storm swirl **on the path** at standing height (8): walking into it is the **DASH GET** (card, checkpoint). It used to rest on a 1-tile stump a runner could hop clean over (the proxies did, then met a 20-tile gap with no dash). Flat ground to try it | CP start; auto CP "dash" |
| 20–31 | Introduce | Gap A: 8 tiles of water + a recovery rock 2 down = 12 tiles bank to bank. Green needs the dash (white may double-jump it); the Shift/DASH bubble after two slow rock landings or falls | ★1 on the jump + dash line |
| 32–69 | Develop | A 12-tile gap, then a 14-tile gap, bank to bank at the same height (a short hop + dash lands; the ledge assist catches a lip): one air dash per airtime, landing restores it. Levels round: a 4-tile recovery rock 2 down at the far side of each (Gap A's idea), so a late dash lands on dry rock and a hop gets back up (the first-timer proxy fell 28 times here) | CP "gap2" on the bank between them |
| 70–121 | Twist | **20 tiles** of water with a refill orb at the apex (white needs the dash too). Levels round: a second orb where the second dash ends (a third dash: the guided line had about 20 px to spare after its second one, which no person lands) and a 3-tile rock 2 down at the bank's foot whose near edge one jump + dash still cannot reach (swept), so the orb stays needed. Then 20 tiles with a lookout on a pillar mid-gap, facing the way Rubik flies: stomp its back to refill the dash | CP mid (72); ★2 on a low dash right off that stomp's refill, then an air jump to the bank |
| 122–161 | Conclude | 27 tiles of water (126–152) with one card on a pillar 13 tiles out (139). The gap is wider than white's double jump + dash (~25 tiles bank to bank; a sweep of every takeoff tick, air-jump and dash timing never lands), and green's plain jump (~10) can't reach the card. The card turns: 2.2 s facing the bank with its spear up (landing on it pops Rubik into the water), 1.8 s away. Wait on the bank, jump + dash onto its back, then bounce + dash to the island (153–158). The orbs and the island patrol (a free disguise pass) are gone | CP late (123); ★3: white, bounce off the chain card + air jump + dash (green's bounce peaks 85 px lower) |

Hint: Shift/DASH. Storm wisps (the swirl's streaks) drift across the lip of every
gap the main line dashes. The HUD gets a dash glyph at the GET and a Shift keycap for
the first three dashes. Tests sweep every takeoff tick and air-jump timing: green
never jumps the 12/14-tile gaps and white never double-jumps the 20-tile orb gap
without dashing (the pillar gap's lookout is a refill: stomping it also refreshes
white's air jump, an intended alternative). The expert line (D2) circles behind the chain
card when it faces the bank: over it, back onto its back from the island side, then the
bounce, the refreshed air jump and the refilled dash.

Differs from the brief: the brief's 16–19-tile "white needs the dash" gaps assumed a
15-tile double jump; the measured double jump crosses 19, so the twist gaps are 20.

## 1-5 Lookouts — the awareness ladder and the spear → a red card sees green (124 columns)

Kit: white, green, dash. Dusk tint. Spears on.

| Columns | Beat | Content | Stickers / CP |
| --- | --- | --- | --- |
| 0–34 | Introduce | An open arena under the start ledge (its face cuts the cone): one patrol shows the whole ladder in the open — "?" → "!" (0.45 s beat) → charge 240 px/s (Rubik runs 330) → wind-up → a jumpable spear → 0.7 s recovery to stomp | CP start; ★1 high above the arena: a stomp bounce off the teaching card (a double jump falls short) |
| 35–58 | Develop | Two watched 4-tile climbs, 1-3's watcher recombined with the spear: P1 (a sentry 5 tiles back from the arena lip, 3 s / 1.2 s) and P2 (on its 8-wide post, 6 tiles back from the lip, 2.6 s / 1.4 s; stomp its back after the climb and the bounce carries to the post). A 2-tile block on P1 (45–46, a green hop) keeps P1's cone off the P2 climb. The old cover blocks are gone: they hid both climbs. The "…" look-back telegraphs each turn | — |
| 59–82 | Twist | The old enforcer post: a red sentry (turns every 3 s) sees green; wait it out, stomp it from the perch while it faces away, or hop. Facing Rubik, its spear is up: a run-and-jump at it can't stomp it | CP post (62, shielded by the step); ★2 on the perch behind it |
| 83–123 | Conclude | Each colour is wrong for one card: a red sentry on the floor sees green, so stomp it from behind when it faces the goal (its 3 s stun covers the climb); then the goal stands at the far end of a **4-tile** block (113–120, a white climb) that a green card patrols. White lands in its view and can't walk past its body (bumped back, spotted), so swap to green before landing (P2's lesson), wait for its back, or stomp it from behind as it walks to the goal. Revision five: this card used to pace the red sentry's floor, overlapping it, and no route came within 192 px of it | CP cross (85, on a block whose risers cut both cones); ★3 at the end of a high line of slabs (row 10) far above the floor cones, which ends on the same block (green before landing) |

No hint bubbles. Risk (brief §11): two ideas in one level; watch first plays here.

## 1-6 The Vault — recombination → theft → REVERSE (136 columns)

Kit: white, green, dash; red at the theft. Night tint. (The red beacon behind the forest was removed at the owner's request; the `beacon` keys left in levels/*.mjs are unused.)
Old Stage 1 geometry (vault steps, chamber, the room's two cards, alcove, roof gates,
escape-only card) is reused at an offset of −70 columns.

| Columns | Beat | Content | Stickers / CP |
| --- | --- | --- | --- |
| 0–20 | Introduce | The home cliff (the finish line) and its 2-tile steps; the roof gates are already visible | CP start; CP steps (15, the riser shields it) |
| 21–56 | Develop | A short canopy with one patrol (1-3); a 4-tile white ledge with a lookout and the swap alcove (1-3/1-5). Levels round: the ledge runs 3 tiles further (cols 54-56), so the first water below is 7 tiles, not 10 | ★1 in the swap alcove |
| 57–83 | Develop | A jump down to an island over 7 tiles of water (a plain jump crosses it; the stomp-and-dash line still does), then 16 tiles with a refill orb (1-4). Levels round: a 3-tile stepping rock 2 down under the orb (75–77), reached by a plain jump from either bank and climbed by a plain jump; the guided routes fly clear above it, so the dash line is the fast one, not the only one | CP bank (90, 6 tiles of runway from the water) |
| 84–109 | Develop | Vault steps: stair 3 is below every chamber cone (the wait is banked); the landing is empty inbound | CP stairs (98); CP stair 3 (104) |
| 110–132 | Twist: the approach | The vault room is **one readable lock**: a red sentry posted 4 tiles inside the door (red sees green, so the disguise is useless), turning every 2.6 s with a 0.4 s look-back. Wait on stair 3, go when it looks at the vault, stomp its back | — |
| 110–132 | Twist: the theft | Touch the vault: hit-stop, **RED GET**, REVERSE. Two stones drop into the chamber door (a 5-row room: no gap left), so the first smash is forced, and **safe: nothing left in the room can see red** (the red guard hums at red Rubik). While the door is sealed it pulses, storm streaks run into it and the upper stone carries the dash key (`drawDoorCue`) | auto CP "vault" **inside the room by the door**; ★2 in the alcove behind a stone (smash it) |
| 109 → 0 | Conclude: the escape | Right to left, one card per beat: the **alarm card** (escape-only) stares at the door from the landing, inside the reach of a dash fired from the doorway, so the forced smash knocks it too (from deeper in the room the dash stops in the doorway: it sees red, and the refunded dash or green answers it); down the stairs; the crossing back (orb), the **island card** (escape-only, spear up: green after the last dash and land through it, or land clear and knock it); green past the lookout and the corridor patrol, or the roof shortcut: from the ledge's edge, jump + red dash through the stacked gate, run the roof, dash the mid gate (stacked three high, so white can't hop it inbound) | ★3 between the roof gates |

Levels round (model, one condition): **a card Rubik put down stays down through the theft.** The REVERSE used to set every card that was not `drained` back to calm, so a ledge sentry stomped on the way in (a defeat since the combat rebuild) was alive again and hit him on the way home. Now the REVERSE turns the living cards and leaves the defeated ones down.

Every climb home is ≤ 2 tiles (red jumps once). No fail timer; the "Quick" par (18 s
= the baseline escape 12.2 s × 1.5) is shown as the seal it awards, struck through at
zero. A death after the theft respawns inside the sealed room (every card held
1.25 s), so the forced smash always happens; since nothing in the room can see red,
that respawn is never a trap (tested: 20 s of standing, pushing, pacing, hopping,
swapping or dashing the wrong way never kills, and one dash from anywhere then opens
the door). Carrying the stolen red to the home cliff top ends the level and World 1.

**Revision five (user playtest, 2026-11-10):** the old room stacked a landing patrol,
the vault guard and two chasers in 26 tiles. After the theft the chasers speared a
hesitant Rubik inside the sealed room, the landing card bumped him back in after the
smash, and each death respawned him in the same trap (probes: standing still, speared
twice in 8 s). The chasers and the inbound landing patrol are gone.

## Routes (`tests/routes.mjs`)

Generated by `tests/generate-routes.mjs` (planner `tests/route-planner.mjs`, scripts
`tests/route-scripts.mjs`) by stepping the real model with commands such as "run to
x", "air-jump at the apex", "wait until the guard faces away" and, where a moving card
makes timing matter, trying a few timings on deterministic forks and keeping the first
that passes. Only the ordinary inputs are recorded; tests replay them from scratch.

| Level | Baseline | Mastery |
| --- | --- | --- |
| 1-1 | 12.6 s, ★1 | 18.0 s, 3/3 |
| 1-2 | 21.3 s, ★1, GREEN GET (unseen, though 1-2 awards no stamp) | 30.9 s, 3/3 |
| 1-3 | 32.0 s, ★1, Ghost (waits for each watcher's back) | 24.3 s, 3/3, Ghost (quick swaps, no waits) |
| 1-4 | 16.5 s, ★1, DASH GET (as green) | 17.0 s, 3/3 |
| 1-5 | 19.5 s, Ghost | 20.8 s, 3/3, Ghost; Takedown route 36.6 s, 6/6 cards, Ghost too |
| 1-6 | 35.1 s, escape 12.2 s, Ghost | 36.3 s, 3/3, escape 13.4 s; Takedown route 37.2 s (escape 14.3 s), 6/6 cards, Ghost too |

All zero deaths. The `takedown` routes (1-5, 1-6) put every card down: they prove the
Takedown stamp, as the baselines prove Ghost. These are QA reachability times; first plays should be several times
longer (the brief targets 60–120 s, 120–150 s for 1-6).

## Every card has a job (revision five)

Each card in `levels/*.mjs` declares a `job`. `tests/model.test.mjs` ("every card has a
job") replays both routes and proves it:

- `gate`: the guided line stomps it.
- `refill`: stomped mid-gap for the dash.
- `knock`: a red dash knocks it.
- `watch`: a route spends time in its cone, or in its cone turned around, in a colour it
  sees, so its facing is what the line times.
- `swap`: the guided line swaps to its colour < 2 s before entering its cone.
- `teach`: the idea's first card, at most one per level.
- `disguise`: it walks through Rubik where he can't go around it; only 1-3 and 1-4.

Safe line = the guided route; expert line = what rewards skill.

| Card | Job | Safe line | Expert line / reward |
| --- | --- | --- | --- |
| 1-2 pit | gate | drop on its back as it walks away; the held bounce clears the rim | ★1 at the bounce's peak |
| 1-2 isle-a..d | gate | bounce back to back over 30 tiles of water | held bounce + air jump off isle-d to ★3's slab |
| 1-2 wall | gate | stomp it from behind at the wall, air jump at the peak | drift left to ★2 on the 8-tile ledge, stomp it again |
| 1-2 glow | gate | every way off the run-up lands on its back: GREEN GET | — |
| 1-3 glade | teach | it walks at green Rubik and hums through him | — |
| 1-3 corridor-b | disguise | it walks through him under a canopy he can't jump | — |
| 1-3 roof | watch | (off the line) | white up, green past it, white again: ★2 |
| 1-3 lookout | watch | wait below the wall for its back, climb, green before landing | green within 0.25 s of the air jump, no wait |
| 1-3 alcove | watch | the same over the 4-tile step | quick swap; green jump through it, white air jump: ★3 |
| 1-3 pillar-a/b, platform | watch | wait on the pit floor for each back, climb, walk through it green | quick swaps |
| 1-4 pillar | refill | stomp its back mid-gap, dash on | low dash off its refill + air jump: ★2 |
| 1-4 chain | refill | wait for its back, jump + dash onto it, bounce + dash to the island | circle behind it when it faces the bank; white bounce + air jump + dash: ★3 |
| 1-5 teacher | teach | the ladder in the open (green skips it) | stomp it on its recovery, ride the bounce: ★1 |
| 1-5 p1 | watch | wait in the arena for its back, climb, through it green | quick swap |
| 1-5 p2 | gate | wait below its post for its back, climb, stomp its back (bounce to the post) | quick swap, through it green |
| 1-5 enforcer | gate | wait at the post (the step's riser cuts its cone) for its back, run off the step onto it | a timed white double jump over it; ★2 on the perch 8 tiles up, only off its back (bounce + air jump) |
| 1-5 cross-red | gate | stomp it from behind when it faces the goal block | a held bounce off it reaches the high line |
| 1-5 cross-green | swap | white up the goal block, green before landing, walk through it | stomp its back as it walks to the goal; the high line (★3) ends on its block |
| 1-6 corridor | swap | escape: green before the corridor (inbound it is 1-3's disguise, green walks through) | knock it with a red dash (Takedown); the roof gates above it: ★3 |
| 1-6 lookout | watch (pair) | inbound green through it; home: knock it with a red dash | swap alcove inbound: ★1; the stacked gate on the escape |
| 1-6 ledge-red | gate (pair) | wait in the corridor for its back, stomp it at the lip, dash at the bounce's apex to the island; home: red walks past it | wait in the swap alcove (above its cone) for its back |
| 1-6 vault-guard | gate | wait on stair 3, go when it looks at the vault, stomp its back; taking red drains it | — |
| 1-6 alarm | knock | (escape) out at the back, it turns and walks at the vault at 60% pace: smash the door and go | knock it aside to reach ★2 in the alcove behind it |
| 1-6 ambush | swap | green after the last dash, land through it | land clear as red and knock it with a ground dash |

Removed because no route needed them: 1-2 `chain-a`/`chain-b`, 1-3 `corridor-a`, 1-6
`burst-a`/`burst-b`, and the inbound landing patrol. Added in the critic round: 1-6 `ledge-red` (a red sentry paired with the green lookout) and the escape-only `alarm` card, which replaced the alarm card outside the door. Removed in critic round two (no teeth possible): 1-3 `floor` and 1-4 `island`. 29 cards remain (was 35).

## Cone-blind audit and rule (revision five, critic rounds one and two)

The user (translated): "the enemies exist just to exist; it's very easy to slip between
them." The critic's cone-blind bot (`tests/cone-blind-bot.mjs`) knows the terrain and the
colour rules (green by default, white for 3+ tile climbs and wide gaps, dash over water,
red into stones) but never waits for a cone or aims a stomp. A card that stops it does real
work.

**The rule** (`tests/cone-blind.test.mjs`, part of `npm test`, ~15 s): every gate or
watch card stops the bot in at least half of 31 arrival times. Each card is probed on its
own: the baseline is replayed to just before it (420 px), then the bot takes over at 31
arrival times spread over 6 s, a whole turn cycle. A **clean pass** means the bot stands 3
tiles past the card's patrol without stomping or knocking it and with no death or catch
since it came within 400 px. Flying over a card into the water, or reaching the foot of
the wall it guards, is not a pass. A card must be passed clean in fewer than half of the 31.

**Exempt** (listed in the test, with reasons): `teach` cards (1-3 glade, 1-5 teacher: an
idea's first card, met in the open on purpose), `disguise` (1-3 corridor-b: walking through
it is the lesson), `swap` (1-5 cross-green, 1-6 ambush and corridor: passing disguised is
the point), `refill` (1-4 pillar, chain: springboards over water, where the gap is the
obstacle and the card the way across; the chain card also turns), `knock` (1-6 alarm) and
`offLine` cards (1-3 roof: it guards sticker 2's roof route, which the bot never takes).

`node tests/cone-blind-audit.mjs` (~40 s) prints the full report: the critic's original
per-checkpoint counts and the per-card probes. Before and after, measured with the same
script on `6a94a2a` and on this tree. "Passed" is the critic's count: cards the bot got 30 px
past in at least 16 of 31 arrival times, 0–3 s, from the first checkpoint that meets them.

| Part | Passed, before → after | Rule breaks (probes), before → after | Bot wins from the start, before → after |
| --- | --- | --- | --- |
| 1-2 | 3/7 → 1/7 | pit 31/31 clean → 0/31 | 0/31 → 0/31 |
| 1-3 | 9/9 → 3/8 (all three exempt) | 7 cards at 31/31 → lookout, alcove, pillar-a, pillar-b, platform 9/31 each | 31/31 → 0/31 |
| 1-4 | 1/3 → 1/2 (the chain card is flown over into the water: 0/31 clean) | none enforced | 0/31 → 0/31 |
| 1-5 | 3/6 → 2/6 | p1 31/31 → 11/31; p2 13/31 → 8/31 | 0/31 → 0/31 |
| 1-6 inbound | 2/4 → 2/4 (corridor is now `swap`) | corridor 31/31 → exempt; lookout, ledge-red, vault-guard 0/31 | 0/31 → 0/31 |
| 1-6 escape | 1/4 → 1/4 (ambush, a swap card) | — | 5/31 → 0/31 |

What changed: the lock blocks the body (a "?" card is no longer walked through in its
colour after a swap); the lock follows Rubik right before a card's face; asymmetric
watchers stand back from their climbs; 1-3's catch rule; 1-2's lip and deeper pit; 1-4's
single turning chain card over a 27-tile gap; 1-5's covers removed. The previous round's
spear-pop + air-jump leak at 1-2's wall stays closed: from the "mid" checkpoint the bot
never climbs the wall without a stomp (0/31; the critic saw 4/31 before the pop nerf).

## Ghost and Takedown stamps

Two per-level stamps compete for the player's attention: slip past every card, or put
every one down.
- **Ghost**: never spotted (no "!", no catch). It is the old Unseen stamp renamed (still
  saved as `unseen`). Awarded on 1-3, 1-5 and 1-6; every baseline earns it.
- **Takedown**: every card of the level stomped or knocked at least once in the run (the
  model's `g.takedowns`, restored with each checkpoint, so nothing is farmed). Awarded only
  where putting a card down is a choice: 1-5 and 1-6. Every 1-2/1-4 card is already a gate
  or springboard, and 1-3's corridor card can't be reached from above. The result card shows
  this run's tally and the best saved (`takedownBest`). The `takedown` routes earn it (and
  happen to stay unseen, the expert's double); the baselines do not.

## Combat (revision five, combat squad: `RESEARCH_COMBAT.md`)

Cards are walkers, sentinels or chargers (`M.enemyType`: level data may set `type`), Rubik has 3
hearts, and a stomp defeats a card from any side. What changed for the levels, and what the level lead
needs to keep true when re-tuning:

| Level | Cards by type | Combat notes |
| --- | --- | --- |
| 1-1 | none | Water is the only cost: a heart and a hop back to safe ground (the puddle and stump stay cheap). A new checkpoint refills hearts. |
| 1-2 | pit and wall: walkers (pads); isle-a..d, glow: sentinels (pads) | The first fight: the pit walker chases and strikes now (`spears: false` removed). Every gate card is a `pad`: stomped, it stays flat as a springboard, so one missed bounce never strands Rubik under the 7-tile wall. The island chain is a 4-stomp chain (`chainPar: 4`, the Chain stamp; the baseline route earns it). |
| 1-3 | walkers and sentinels | Unchanged rule: "!" is "caught!" (no heart). Bodies cost a heart. |
| 1-4 | sentinels (pads) | `spears: false` kept: the dash level's cards are springboards, their bodies cost a heart. |
| 1-5 | teacher: walker; p1: sentinel; p2: sentinel; enforcer: charger (armoured); cross-red: `type: "sentinel"`; cross-green: walker | The ladder in the open. The enforcer needs two stomps (or a red dash on a dazed card); cross-red is a one-stomp sentinel because the main line must kill it with the bounce it uses. |
| 1-6 | corridor, lookout, alarm, ambush: walkers; ledge-red, vault-guard: sentinels | The ambush card's job is `knock` (a landing on its head is a stomp, so the green swap-through is gone). |

Rules to keep when editing a level:
- **A gate card needs `pad: true` if its bounce is the only way over** (a wall, a gap); otherwise a failed
  attempt strands the player. The test "pads are exactly the springboard cards the levels need" lists them.
- **A chasing card needs room:** its bounds are its leash (walker chase 190 px/s, charger rush 288 px).
  A card that cannot reach Rubik gives up after 1 s, so a tight bound is safe, not a bug.
- **Bodies hurt:** a route that brushes a card costs a heart. The planner rejects any option that does, so
  keep takeoffs 130+ px from a card you stomp (a falling jump meets the head, a rising one meets the side).
- **Telegraphs:** first sight to first hit is at least 1.5 s per type (a test); no card strikes from off-screen.
- Every baseline and mastery route takes 0 hearts (`tests/combat.test.mjs`).

## Known design limits

- Cards follow fixed timers, so a human's arrival time decides a patrol's facing; the
  "?" stage (the card stops and turns), riser cover and the strike strip exist for that reason.
- 1-2's island chain: a perfect white double jump from the rim can land on isle-c's back,
  skipping isle-a and isle-b (a sweep of jump timings finds it). It is still a stomp, and
  the bot never finds it (it falls into the water: 0/31 clean); a cave ceiling would close it
  but would also cost the sticker-3 slab. Only the full 4-link chain earns the Chain stamp.
- 1-3's watchers can be beaten without waiting by a swap to green within ~0.25 s of the
  air jump. That is the expert's line by design (a later swap is caught); a first-time
  player is guided to wait for the back.
- 1-3 is 176 columns (the cap was 170): three 12-tile gaps with 6-tile pillars.
- Disguise still passes green cards for free where green is all the next beat needs;
  the job test allows that only as 1-3/1-4's lesson. Whether the new jobs are *fun* is
  not measured: it needs the user's playtest.
- 1-1's QA route is short (~12 s): the level is as long as its idea needs.
- White can double-jump 1-4's develop gaps; the level starts green, so the dash is the
  guided way; the orb twist forces it for everyone.
- The world map has no World 2 teaser; `bg2` stays in the archive.
- World 2 "Blue Mountains" is not built (brief §8).
