# Movement audit: Color Rush Heist (World 1)

Yardstick: `common/docs/MOVEMENT_CRITERIA.md` (the shared rubric). Every item below
was measured on the real model with ordinary inputs, and the browser-facing items were
confirmed in real Chrome with trusted key events. Dates: 2026-11-09/10.

- **Model measurements:** `tests/movement-audit.test.mjs` (22 tests, part of `npm test`).
  Each test prints its numbers as `node --test` diagnostics and asserts the rubric band,
  so the measurements stay as regression tests. Fault setups (placing Rubik, sending
  cards away) only isolate one mechanic on real level geometry.
- **Browser checks:** `tests/browser-movement.mjs` (dev tool, not in `npm test`; needs
  Playwright, here from `../common/node_modules`): `node serve.mjs --port 4401` then
  `node tests/browser-movement.mjs http://127.0.0.1:4401/`. Run against this folder and
  against the built `dist/itch` folder; both passed every check (results below).
- **"Before" numbers** come from the same audit file run against the pre-audit commit
  (`40e8f0e`), plus the legacy browser loop emulated in Node for A2.

## Scorecard

29 rubric items apply (A1-A4, B1-B14, C1-C4, D1-D3, E1-E3, F-CRH).

| | PASS | WARN | FAIL |
| --- | --- | --- | --- |
| Before | 19 | 4 (B3, B6, B7, D2) | 6 (A2, A3, B12, C1, C2, E2) |
| After | 27 | 2 (C1, D2) | 0 |

D2 is the item the user should look at first: by its raw number it sits below even the
WARN band, and it counts as WARN only as a reasoned exception (see below).

## Results

| # | Criterion | Before | After | Target | Status | Evidence |
| --- | --- | --- | --- | --- | --- | --- |
| A1 | Input → state change | 0 ticks (model) | 0 ticks for move, jump, jump-cut, dash, swap. Chrome, 11 real presses: visible on the first rendered frame after the key in 6, on the second in 5 (the press's own tick ended after that frame) | ≤ 1 step; ≤ 1 frame | PASS → PASS | A1; browser "A1" |
| A2 | Frame-rate independence | Legacy loop: 175 px trace divergence across 30/60/120/240 Hz; 48 of 60 route runs won (lost at 30 Hz and with hitches) | 0 px at 30/60/120/240 Hz and with random 0-100 ms hitches; all 12 routes win at 30 Hz, 144 Hz and hitched 60 Hz (36 runs). Chrome with 40-90 ms main-thread hitches: every jump fired on the tick its keydown stamp fell in (8/8, offset 1.2-7.8 ms inside an 8.33 ms tick) | ±1 px, same outcome | FAIL → PASS | A2; browser "A2" |
| A3 | No lost or phantom inputs | A dash pressed at the start of the 1.2 s GET card fired after it (phantom); a jump pressed in the stomp freeze spent white's air jump on a 164 px arc instead of the 197 px high bounce; a direction held through pause/resume was dropped until the OS key repeat; two jump keys could cut a jump twice | All four fixed; respawn held-lock and the late-jump carry verified; Chrome: right held through Esc/Esc keeps moving, Space on the focused Resume resumes without a jump | honoured or ignored by a documented rule | FAIL → PASS | A3; browser "A3" |
| A4 | Determinism | identical | 12 routes × 2 runs: identical SHA-256 of every tick | bit-identical | PASS → PASS | A4 |
| B1 | Time to full run speed | 133 ms | 100 ms | 50-150 ms | PASS → PASS | B1-B3 |
| B2 | Stop time | 100 ms | 100 ms | ≤ 100 ms | PASS → PASS | B1-B3 |
| B3 | Turnaround | 183 ms | 142 ms | ≤ 150 ms | WARN → PASS | B1-B3 |
| B4 | Air control | 100% of ground accel; reversal 208 ms | 79%; reversal 208 ms | 60-100%, no instant flip | PASS → PASS | B4 |
| B5 | Time to apex (held) | 442 ms | 442 ms | 300-450 ms | PASS → PASS | B5-B8 |
| B6 | Tap / hold height | 22 / 93 px = 0.24; cut on the release tick | 32.5 / 93 px = 0.35; cut on the release tick | 0.30-0.55 | WARN → PASS | B5-B8 |
| B7 | Fall vs rise gravity | 1.15×; cap 760 px/s | 1.30×; cap 760 px/s | 1.3-2.2×, capped | WARN → PASS | B5-B8 |
| B8 | Apex hang | +117 ms while held | +117 ms | present, ≤ 120 ms | PASS → PASS | B5-B8 |
| B9 | Coyote | 92 ms (from the box leaving) | 117 ms from the feet leaving (14 ticks) = the same takeoff point; constant in real time (A2) | 80-120 ms | PASS → PASS | B9-B10 |
| B10 | Jump buffer | 117 ms | 117 ms | 100-150 ms | PASS → PASS | B9-B10 |
| B11 | Corner correction | 6 px rising; a dash clipping a lip's underside stopped dead | 6 px rising; 6 px for dashes | 4-8 px | PASS → PASS | B11 |
| B12 | Ledge assist / lip contact | 1755-approach sweep (wall faces at 51 heights × 3 speeds × 5 vy; edges from both sides × 55 offsets × 3 holds × 3 speeds; walk-offs): 0 "looked landed but fell", **301 landings with the drawn feet > 2 px short**, 15 ticks standing with the feet past the edge | 0 / **0** / 0; a lip rest lasts ≤ 4 ticks | zero false falls, never lands clearly short | FAIL → PASS | B12 |
| B13 | Air resources | no exploit | Fuzz (6 levels × 3 seeds × 20 s of random input) + all 12 routes: 337 airtimes, never 2 air jumps or 2 air dashes without a documented refill | refresh only by rule | PASS → PASS | B13 |
| B14 | Dash | 144.4 px, spread 0, 0.17 s + 4-tick (33 ms) freeze; Dim/Flash on Rubik | same | fixed, short freeze, state on Rubik | PASS → PASS | B14 |
| C1 | Collider vs sprite | Support = the 40 px box: 9-13 px off the drawn feet in every frame | Support = the feet (±11 px): ≤ 2 px in all standing, landing, falling and storm frames (canvas diff in Chrome: drawn feet −9..+13, feet line exactly on the floor); exceptions listed below | ±2 px every frame; hurtbox ≤ body | FAIL → WARN | C1; browser "C1 canvas" |
| C2 | Hazard colliders | Spear band 30-70 px for both sheets: the red card's killed 6 px above its drawn spear | Band = the drawn spear head per sheet (green 50-68, red 46-64 px, measured from the PNGs); documented generous shrinks: spear tip 8-12 px short of the drawing, card body 8 px inside each drawn side (bumps only), water kills 10 px under its drawn surface; cone = PNG (existing test) | match, shrinks documented | FAIL → PASS | C2 |
| C3 | No tunnelling | none found | 114,759 ticks (every route + 3000 fuzzed starts at dash 850 / fall 760 / bounce 520 / knock 440 px/s): the box never inside a solid | swept/sub-stepped safe | PASS → PASS | C3 |
| C4 | Contact rules | spear + water only | `die()` sources are exactly spear (lunge frames) and water; the spear-up tell is drawn from `M.stompable` | consistent, visible | PASS → PASS | C4 |
| D1 | Optional techniques | dash-jump, held stomp, saved air jump | dash-jump +26 px of flight; held stomp 198 vs 150 px; air jump saved for the fall +80 px; (new) a freeze press keeps the air jump | ≥ 2 that change outcomes | PASS → PASS | D1 |
| D2 | Skill gradient | expert vs baseline: 1-4 9.1%, 1-6 escape 8.1% | 1-4 2.3%, 1-5 4.8%, 1-6 escape 8.4% (the 1-4 baseline itself got 1.1 s faster) | ≥ 15%, not required | WARN (exception) → WARN (exception) | D2 |
| D3 | Recovery | — | air-jump rescue window over 1-1's first water: 425 ms of timings; landing on a raised spear pops (0 deaths); body contact knocks back | readable recovery | PASS → PASS | D3 |
| E1 | Action feedback | sound + visual for 13 movement events | same, checked in source | same frame | PASS → PASS | E1-E2 |
| E2 | Resource state on Rubik | form (sheet), dash (Dim/Flash); **white's air jump not shown anywhere** | + two puffs under the feet while the air jump is unspent | readable without the HUD | FAIL → PASS | E1-E2; screenshots |
| E3 | Telegraphs / lookahead | camera unchanged | 519 px ahead at run speed = 1.57 s (960×640 and 390×844 viewports) | ≥ 1.5 s | PASS → PASS | browser "E3" |
| F | CRH: stomps, respawn, gap rules | — | Stomp window from behind 66 px of centre offset (≥ the 64 px drawn card); none at a calm card's face (spear up, drawn); shortest respawn runway to water 80 px (1-4 late, a 4-tile bank) with the held-lock; gap lab (bank to bank, same height): green jump 10, green jump + dash 15, white double 17, white double + dash 20 tiles, **identical before and after**; every level gate in `model.test.mjs` re-passes | generous stomps; safe respawn; gap rules hold | PASS → PASS | F (2 tests); model.test.mjs 1-1…1-6 gate tests |

## Fixes made

1. **Stamped input (A2, B9/B10 in real time).** `loop.mjs` (pure, tested in Node) gives
   every key/touch change its `event.timeStamp` and applies it before the tick that time
   falls in; the clock never runs ahead of the frame, so the mapping is exact. Physical
   key state is tracked on every screen: a direction held through a pause or into a level
   applies at once; the level card is skipped only by a fresh key, not the auto-repeat.
2. **Feet-true support (C1, B12).** `PLAYER.foot = 11`: standing, landing and walking off
   use the drawn feet's span, not the 40 px box. When only the box's edge meets a solid
   lip, Rubik rests on it for ≤ 4 ticks and scrambles on (moving toward it, ≥ 300 px/s) or
   slips off (≥ 360 px/s); the rest ends the jump's apex float but refreshes nothing.
   Coyote is counted from the feet (14 ticks), which keeps the old takeoff point: the gap
   envelope is unchanged. A box spanning a 1-tile hole still stands.
3. **Arc and run tuning (B3, B6, B7).** Acceleration 2600 → 3300, turn 6000 → 8000, air
   acceleration kept at 2600 (now 79%); jump cut 0.5 → 0.6; fall gravity 1.15 → 1.3×.
   Rise gravity, so every gating height (93 / 175 / 195 px), is unchanged.
4. **Fair freezes (A3).** Jump and dash buffers age in real time during hit-stop; a jump
   pressed in the stomp freeze or 50 ms after it makes the high bounce (and is used up);
   a jump can be cut only once.
5. **Dash corner correction (B11):** a dash clipping a lip's underside by ≤ 6 px slides under.
6. **Spear band = drawing (C2):** per sheet, measured from the lunge frames.
7. **White's air jump on Rubik (E2):** two outlined 4 px puffs under his feet while unspent.
8. **Routes** regenerated; three planner scripts adapted where the old box support had
   carried a landing (1-3's roof drop now catches the wall top, 1-5's walk off the perch,
   1-6's island landing timed to its patrol). All 12 routes win with 0 deaths, mastery 3/3.

## Remaining WARNs, with reasons

- **D2 (skill gradient): 2.3-8.4% vs ≥ 15%.** Expert lines (`EXPERT` in
  `tests/route-scripts.mjs`) use the dash-jump on every 1-4 lip, skip 1-5's lookout waits
  (perch to perch, the high line) and take 1-6's roof gates home. The baselines they are
  compared with are frame-perfect bots on the guided line, and World 1's gaps are gated by
  airtime on purpose (the F rule that dash-required gaps need the dash), so raw speed has
  little headroom; expression here is mostly line choice (roof gates, stomp chains,
  disguise vs. stomp) and the stamps. Against the game's own human pace reference (the
  Quick par, 18 s = 1.5× the bot escape) the expert escape is 40% faster. Measured option
  if the user wants more: a stronger dash-jump carry (640 px/s bleeding at 600 px/s²) takes
  the 1-4 expert line to 13.35 s (9%); ~15% needs a carry strong enough to let green skip
  1-4's orb, which is a level-design call, not a feel fix.
- **C1 exceptions.** Within ±2 px in every frame that stands, lands, falls or perches.
  Outside it: `run1` (both feet 4 px up, a 10 px stride), `run3` (a narrow passing stance,
  4 px), `air0` (takeoff, rising fast, 4 px), the dash frames (gravity-free, never land or
  perch, 6-8 px). These are the original artist's frames (byte-identical assets). The box
  (40 px) also sits inside the drawn 56 px cube, so pressing against a wall the cube's edge
  overlaps the wall art by 7-9 px; widening the box would change every wall contact, cone
  exposure and level fit, and the rubric's hurtbox rule (never larger than the body) holds.

## Not verified

Physical phones and touch timing on real hardware (touch pads go through the same stamped
path, but were not exercised), Safari/Firefox, displays above 144 Hz in a real browser
(emulated in Node only), and whether players feel the new arc and lip behaviour as better:
that needs the user's playtest. B12's "looked landed" judgement uses the drawn feet of the
frame the renderer picks; the rounded top corners of the tiles' art (2 source px) are not
part of it.
