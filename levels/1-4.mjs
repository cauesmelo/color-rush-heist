/** 1-4 "Storm Dash": dash -> refills chain dashes. White and green; DASH GET
 * from a stray storm swirl in the first seconds. A fast traversal level
 * between the two stealth levels (the Portal pacing note).
 *
 * Gap widths come from the measured envelope (tests/model.test.mjs re-checks
 * them by sweeping every takeoff tick and air-jump/dash timing on the real
 * model): green jump crosses <= 11 water tiles, jump + dash <= 17; white's
 * double jump <= 19 - more than the brief's estimate of 15, because an air
 * jump saved for the fall resets the falling speed. So the 12-14-tile gaps
 * need the dash as green (white may still double-jump them), and the twist
 * gaps are 20 tiles so white needs the dash too.
 *
 * introduce: the swirl on a stump -> DASH GET; flat ground to try it; Gap A
 *            (12 tiles) with a recovery rock 2 tiles down near its far side.
 * develop:   a 12-tile gap to a higher bank, then a 14-tile gap.
 * twist:     20 tiles with a refill orb at the apex; 20 tiles with a dozing
 *            card on a pillar mid-gap as a stomp refill.
 * conclude:  an orb -> card -> orb chain onto an island with a green patrol
 *            (go green before landing); the goal face beyond it.
 */
import { defineLevel, px } from "./builder.mjs";

export default defineLevel({
  id: "1-4",
  name: "Storm Dash",
  idea: "Dash, and refill it in the air",
  cols: 154,
  // Starts GREEN: no double jump, so the dash is the only way over the 12-14
  // tile gaps of the main line (white can still double-jump them: an
  // expert's choice, never the guided one).
  kit: { forms: ["white", "green"], start: "green", dash: false },
  spears: false,
  unseen: false, // a traversal level: no Unseen stamp (it would be free here)
  hints: ["dash"],
  beacon: 0.5,
  tint: "storm",
  build({ fill, ground, water }) {
    fill(0, 2, 0, 21);
    // --- Introduce (3-31): the swirl, flat ground, Gap A ---------------------
    ground(3, 19, 16);
    fill(8, 8, 15, 15); // the stump the swirl rests on
    water(20, 27); // Gap A: 8 tiles of water...
    ground(28, 31, 18); // ...and a recovery rock 2 tiles down (12 tiles bank to bank)
    // --- Develop (32-73) -------------------------------------------------------
    ground(32, 37, 16);
    water(38, 49); // 12 tiles, bank to bank at the same height
    ground(50, 55, 16); // (a checkpoint here: a failed 14 never replays the 12)
    water(56, 69); // 14 tiles
    // --- Twist (70-122) --------------------------------------------------------
    ground(70, 75, 16); // the midpoint face stands here
    water(76, 95); // 20 tiles: white needs the dash too (refill orb at the apex)
    ground(96, 101, 16);
    water(102, 121); // 20 tiles, a dozing card on a pillar in the middle
    ground(112, 112, 18); // the pillar
    // --- Conclude (122-153) ----------------------------------------------------
    ground(122, 125, 16);
    water(126, 144); // orb -> card -> orb
    ground(135, 135, 18); // pillar for the chain's card
    ground(145, 150, 16); // the landing island, a green patrol on it
    fill(151, 153, 0, 21); // end wall
  },
  spawn: { x: 136, floor: px(16) },
  checkpoints: [
    { id: "start", x: 112, floor: px(16) },
    // Saved by DASH GET itself (dash can never be lost to a death).
    { id: "dash", x: px(10), floor: px(16), get: "dash", hint: "dash" },
    { id: "gap2", x: px(52) + 16, floor: px(16), hint: "dash" },
    { id: "mid", x: px(72), floor: px(16) },
    { id: "late", x: px(123) + 16, floor: px(16) },
  ],
  pickups: [{ id: "swirl", ability: "dash", x: px(8) + 16, y: px(15) - 34 }],
  stickers: [
    { id: 1, x: px(24), y: 396, line: "main", note: "Gap A: on the jump + dash line" },
    { id: 2, x: 3728, y: 440, line: "off", note: "low dash right off the pillar card's bounce (its stomp refill), then an air jump to the bank" },
    { id: 3, x: 4558, y: 310, line: "mastery", note: "high over the chain: double jump + dash + high orb + dash, straight to the island" },
  ],
  orbs: [
    { id: "twist", x: px(86), y: 410 },
    { id: "chain-a", x: px(130), y: 410 },
    { id: "chain-b", x: px(141), y: 410 },
    { id: "high", x: 4428, y: 312 },
  ],
  guards: [
    // Lookouts on pillars, staring ahead (the way Rubik flies): stomp their
    // backs to refill the dash mid-gap.
    { id: "pillar", kind: "green", mode: "sentry", fixed: true, x: px(112) + 16, floor: px(18), dir: 1, min: px(112) + 16, max: px(112) + 16 },
    { id: "chain", kind: "green", mode: "sentry", fixed: true, x: px(135) + 16, floor: px(18), dir: 1, min: px(135) + 16, max: px(135) + 16 },
    { id: "island", kind: "green", mode: "patrol", x: px(148), floor: px(16), dir: 1, min: px(146) + 16, max: px(149) },
  ],
  goal: { x: px(149) + 24, floor: px(16) },
  /** Storm wisps at the takeoff lip of every gap the main line dashes: the
   * swirl's own streaks, pointing across (drawn, no text). */
  dashMarks: [
    { x: px(19) + 16, floor: px(16) },
    { x: px(37) + 16, floor: px(16) },
    { x: px(55) + 16, floor: px(16) },
    { x: px(75) + 16, floor: px(16) },
    { x: px(101) + 16, floor: px(16) },
    { x: px(125) + 16, floor: px(16) },
  ],
  hintZones: {
    // Two slow landings on the rock (or two falls) -> the Shift/DASH bubble.
    dash: { x0: px(17), x1: px(32), rock: { x0: px(28), x1: px(32), floor: px(18) }, doneFloor: px(16) },
  },
});
