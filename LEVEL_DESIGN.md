# Stage 1 "Green Forest" — level design (as built)

The map is authored in `level.mjs` as a commented builder (fill/ground/ledge/water
calls per beat) on one grid: **1 tile = 32 px = one original 16 px cell at 2×**, so
the 960×540 view shows the same 30 × 16.9 cells as the Godot game's 480×270 window.
The world is 208 × 22 tiles (6,656 × 704 px). Base ground is row 18, water surfaces
at row 20; rows are counted from the top.

## Bootstrapped from the original

`../scenes/level_green.tscn` was decoded (`PackedInt32Array` triplets: position
`(y<<16)|x`, `source|(atlasX<<16)`, `atlasY`; 2,552 collision cells over x −20…259).
Kept: the tall home wall on the left, flats and pits, floating ledges, a staircase,
and the vault against a tall end wall; the auto-tiler uses the atlas the way that
scene did (the 6×6 mossy block as a nine-slice with varied interiors, the thin slab
for floating ledges). Trimmed from 281 to 200 columns and re-authored per beat.

## Jump numbers the geometry is built on

| Move | Reach | Used for |
| --- | --- | --- |
| Full jump (any form) | ~95 px up (half gravity near the apex), ~263 px flat | 2-tile steps (64 px) everywhere |
| — | 3 tiles (96 px) is 1 px out of reach | **never used** (a test scans the map) |
| White air jump | +83 px (≈176 total) | 4-tile ledges (128 px): white ledge, clearing wall |
| Green jump + white air jump at apex | ≈178 px | 5-tile swap alcove (mastery) |
| Stomp bounce | ~115 px over a card's head | sleeper sticker, enforcer perch, springboard home |
| Dash | 145 px, gravity-free | 10-tile gap, 16-tile water (with an orb) |
| Card body | 48 × 84 px | a 3-tile corridor fits a card but not a jump over it |

## Beats (tile columns)

| Tiles | Section | What happens | Teaches | Stickers / CP |
| --- | --- | --- | --- | --- |
| 0–12 | Home cliff | Colorless Rubik spawns by a chalk cube face. The red the cards stole pulses far right over the trees (parallax glow): the goal, no arrow. | Why and where | CP home; #9 high in the sky (white double jump + dash) |
| 13–33 | First steps | 2-tile drop, 1-tile drop, a 6-wide 1-tile step that a running jump lands on, then a 4-tile ditch whose floor is only 2 tiles down with a walk-out step. | Move, jump, safe failure | #1 on the natural arc over the ditch |
| 34–55 | The sleeping card | The run-up ends 4 tiles above a clearing under a 6-tile rock overhang (2 tiles of headroom over the last 4 run-up tiles and the drop). A green card dozes below facing away (z, no cone). Walking, running, jumping or double-jumping off the edge always lands on its head (its stomp catch is ±24 px). Its green swirls into Rubik as the bounce bonks the overhang; it stays grey and dazed. | Stomp; cards hold colors | #2 in the bounce under the overhang; CP clearing (auto) |
| 56–90 | Disguise corridor | A low canopy (3 tiles) over two green patrols. Their cones sweep green Rubik (faintly: they can't see green); they hum (♪) and let him through. White here is seen; the cards are solid, a bump throws him back toward the entrance, the 3rd bump on an aware card is a spear, and the spear can't be jumped under this ceiling. | Green hides among green | #3 and #8 visible on the roof above (escape only) |
| 89–112 | White again | The corridor exits at a 4-tile wall: green can't climb. After 2 s of green jumps a thought bubble shows white + Z. On top, a green lookout patrols away from the arrival point: when it turns, its "?" gives room to drop back or go green. A one-way alcove 5 tiles above its patrol rewards green-jump-through-the-card + white air jump. | White/green trade-off; first "?"; mid-air swap | #4 in the swap alcove; CP descent |
| 113–126 | Gap A | 10 tiles over water with a recovery rock 2 tiles down near the far side: a plain jump lands on the rock (slow, safe), jump + dash crosses cleanly. Two rock landings or falls offer the dash bubble. | Dash | — |
| 127–142 | Water stretch | 16 tiles of water, a refill orb in the middle at apex height. Green: jump, dash, orb, dash. White can also double-jump + dash. | Refills chain dashes | #5 on the second dash line |
| 143–165 | Enforcer post | A red sentry (sees white *and* green) turns every 3 s with a 0.4 s look-back. A 2-tile step shields the checkpoint (its cone stops at the step); a perch above the cone lets any form drop on its head; white can also hop it. | Timing, stomping from above | CP post; #6 on the perch behind it |
| 166–175 | Vault steps | Three 2-tile stairs; standing on stair 3 is below the vault guard's cone. The guard turns every 2.0 s (1.6 s + 0.4 s look-back), so the wait is short and watchable. | Wait for the turn | CP on stair 1; theft respawn on stair 3 |
| 176–207 | Landing and vault chamber | A green patrol outside; a 22-tile, 5-tile-tall room: a red sentry near the door (room to stomp it from behind), the vault (`cofre.png` at 4× on a slab dais between two pillar strips, red glow) in the middle, two dozing cards spread out behind it, and a cracked stone sealing an alcove in the end wall. | Crossing cones: go green, then deal with red | — |

## The getaway (right to left, same forest, remixed)

Touching the vault: hit-stop, red, REVERSE card, every card turns to face the route
home, the two dozing cards charge. Red cards now ignore Rubik; green cards see him.

1. **Burst:** knock the charging cards aside with red dashes (refunds chain), or run.
   Behind them, a red dash opens the alcove stone: #7.
2. **Landing patrol:** it faces the chamber now; dash through it.
3. **Enforcer post:** the red sentry ignores red Rubik (walk straight through it);
   hop the step.
4. **Water and Gap A (remixed):** the orb has respawned; jump, dash, orb, dash. An
   **escape-only green card** now patrols the island between the water and Gap A:
   knock it with the second dash (mastery), or go green before landing (baseline).
   Then jump + dash.
5. **White ledge:** the lookout faces the incoming escape; dash through it.
6. **Choice:** drop into the corridor and go green past the patrols, *or* take the
   **roof route**: from the ledge's left edge, jump and red-dash into the two-stone
   gate (it is 6 tiles above the ledge, so white could never hop it inbound), run the
   roof for #8, dash the mid gate, take #3, drop into the clearing.
7. **Home:** the grey card from the opening is a springboard up the 4-tile wall (or
   go white). Reaching the cliff top with red ends the stage.

Every climb on the way back is 2 tiles or has a springboard, so red's single jump
always suffices; white is optional.

## Stickers (9)

| # | Where | Line |
| --- | --- | --- |
| 1 | Ditch arc | Main line |
| 2 | Sleeping-card bounce apex | Main line |
| 3 | Corridor roof, seen from below | Escape (roof route) |
| 4 | Swap alcove above the lookout | White / swap |
| 5 | Second dash over the water | Main line |
| 6 | Perch behind the enforcer | White / bounce |
| 7 | Vault alcove behind a stone | Escape smash |
| 8 | Between the roof gates | Escape smash |
| 9 | Home sky | Mastery (white double jump + dash) |

## Checkpoint timing and fairness

Measured on the routes (`tests/routes.mjs`): baseline finishes at 42.0 s (longest
checkpoint gap 8.1 s); mastery finishes at 48.8 s (longest gap 9.4 s). Markers only advance in the
direction of travel. A test sweeps every card over its whole patrol range in both
facings and proves no marker can be inside a cone (the post marker is shielded by the
step, the stairs marker by stair 1's riser; the theft respawns Rubik on stair 3,
below the chamber's cones). A respawn restores cards calm, so it is never an instant
alert.

## Routes

`BASELINE_ROUTE` (main line): stomp the sleeper, green through the corridor, wait
below the lookout until it walks away, white up, green again, jump+dash Gap A,
jump/dash/orb/dash the water, step → perch → stomp the enforcer, stairs, wait on stair
3 for the vault guard to face away, stomp it from behind, touch the vault, knock the
landing patrol and the lookout, green through the corridor, springboard, home.
**0 deaths, 0 times spotted, 3 stickers, 42.0 s, escape 17.5 s** (two ground dashes
right after the theft knock the landing patrol before it can spot him; green past the
island card and through the corridor).

`MASTERY_ROUTE`: #9 first, the same opening (#1, #2), the swap alcove (#4), water
(#5), bounce onto the perch behind the enforcer (#6), the vault, knock both burst
cards and smash the alcove stone (#7), then the roof route (#8, #3).
**0 deaths, 9/9 stickers, 48.8 s.**

The routes were produced by stepping the real model with a small planner
("walk until x ≥ …", "dash at the apex", "wait until the guard faces away") and are
stored as plain `[seconds, input]` arrays; tests replay them from scratch.

## Known design limits

- The guards follow fixed timers, so a human's arrival time decides which way a
  patrol is facing; the "?" stage and the step/stair cover exist for that reason.
- White can double-jump Gap A without dashing; the dash is required (and hinted)
  only for green, and for everyone over the water without the orb.
- The canopy smash-refund chain over the big gap proposed in the brief was not built:
  stones there either blocked the inbound dash line or sat out of red's single-jump
  reach. The smash chains live on the roof route and at the vault instead.
- Stage 2 "Blue Mountains" is not built (its art stays in the archive).
