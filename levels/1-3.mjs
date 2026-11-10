/** 1-3 "Hide in Green": disguise -> the white/green trade-off. Rubik spawns
 * green (owned since 1-2); white and green are both in the kit; no dash yet.
 *
 * Cards here only warn and push: `spears: false` keeps the spear for 1-5,
 * where the whole ladder is taught in the open. A spotted Rubik is charged and
 * bumped back, never killed; there is no water in this level.
 *
 * introduce: an open glade; a green patrol walks toward green Rubik, its cone
 *            sweeps him, it hums and walks on through him (cards let their
 *            own color pass).
 * develop:   the old disguise corridor (3-tile canopy): one patrol walks
 *            through green Rubik where he can't jump over or around it (in
 *            the glade he could), so the disguise is trusted, not just seen.
 *            Revision five removed its twin, which repeated it.
 * twist:     a 4-tile wall green can't climb ("white card + Z"), then a lookout
 *            above it: its first "?" at white Rubik gives room to back off or
 *            go green ("green card + X").
 * conclude:  green past a patrol, white up a 4-tile step, green past a
 *            lookout; the swap alcove above it (green jump, white air jump).
 * finale:    a timed-turn crossing - two pillars over a dry pit, each with a
 *            turning lookout, 12 tiles apart: only white's double jump makes a
 *            hop (green jumps 11), and a hop takes ~0.9 s, longer than the
 *            0.6 s a card needs to spot white Rubik. So hop while the next
 *            card looks away, wait as green, hop again. Landing in front of an
 *            alert card gets Rubik shoved off into the pit (climb back, ~8 s):
 *            the teeth, without a spear. "Unseen" is earned here.
 */
import { defineLevel, px } from "./builder.mjs";

const patrol = (id, job, minCol, maxCol, floorRow, dir, startCol = dir > 0 ? minCol : maxCol) => ({
  id,
  job,
  kind: "green",
  mode: "patrol",
  x: px(startCol) + 16,
  floor: px(floorRow),
  dir,
  min: px(minCol) + 16,
  max: px(maxCol) + 16,
});

/** A watch sentry: faces the climb it guards (left) 3 s, then away 1.6 s,
 * with the 0.4 s look-back before each turn. */
const sentry = (id, col, floorRow) => ({
  id,
  job: "watch",
  kind: "green",
  mode: "sentry",
  x: px(col) + 16,
  floor: px(floorRow),
  dir: -1,
  min: px(col) + 16,
  max: px(col) + 16,
  turnEvery: [3, 1.6],
});

export default defineLevel({
  id: "1-3",
  name: "Hide in Green",
  idea: "Green cards can't see green",
  cols: 176,
  kit: { forms: ["white", "green"], start: "green", dash: false },
  spears: false,
  caught: true,
  hints: ["white", "green"],
  beacon: 0.35,
  tint: null,
  build({ fill, ground, ledge, back }) {
    fill(0, 2, 0, 21);
    // --- Introduce (3-25): an open glade, no pits ---------------------------
    ground(3, 25, 16);
    ledge(21, 24, 12); // white-only step up to the canopy roof (sticker 2 route)
    // --- Develop (26-60): the disguise corridor ----------------------------
    ground(26, 64, 16);
    fill(26, 60, 10, 12); // low canopy: 3-tile clearance, no jumping over cards
    back(27, 59, 13, 15); // dark interior behind the corridor
    fill(39, 40, 15, 15); // a 1-tile step between the patrols (sticker 1)
    ledge(49, 52, 6); // above the canopy roof: white again after the roof lookout
    // --- Twist (61-80): a 4-tile wall, a lookout above it --------------------
    ground(65, 80, 12); // white-only: green's 93 px jump cannot reach 128 px
    // --- Conclude (81-113): green, white, green ------------------------------
    ground(81, 83, 14); // a 2-tile step down
    ground(84, 96, 16); // the dip before the step
    ground(97, 113, 12); // 4-tile step: white, under the alcove card's eyes
    ledge(103, 106, 7); // swap alcove 5 tiles above the step top
    // --- Finale (114-175): three watched climbs over a dry pit ---------------
    // Every gap is 12 tiles: green jumps 11, so the only ways onto a pillar
    // are white's 12-tile hop or a white climb from the pit floor (4 tiles).
    // Each card stands 4 tiles back from the face it watches, where the drawn
    // cone is ~60 px tall (at the tip it is a 4 px sliver a climb slips
    // through: the old pillars' cards stood beside their faces and saw a
    // climb for under 0.25 s).
    ground(114, 161, 16); // the pit floor (dry; 4 below the pillar tops)
    ground(126, 131, 12); // pillar A
    ground(144, 149, 12); // pillar B
    ground(162, 172, 12); // the goal platform: the climb lands in its card's view
    fill(173, 175, 0, 21); // end wall
  },
  spawn: { x: 204, floor: px(16) },
  checkpoints: [
    { id: "start", x: 176, floor: px(16) },
    // Midpoint at the corridor exit, before the twist (out of every cone).
    { id: "mid", x: px(63), floor: px(16), hint: "white" },
    // On the pit floor before the finale, below every cone: a catch there
    // costs one climb, not the whole conclude.
    { id: "pit", x: px(116) + 16, floor: px(16) },
    // And between pillar B and the goal platform (12 s rule).
    { id: "pit2", x: px(151) + 16, floor: px(16) },
  ],
  stickers: [
    { id: 1, x: px(40), y: px(15) - 30, line: "main", note: "on the 1-tile step between the corridor patrols" },
    { id: 2, x: px(50) + 16, y: px(6) - 30, line: "off", note: "canopy roof: white up, green past the roof lookout, white again" },
    { id: 3, x: px(104) + 16, y: px(7) - 30, line: "mastery", note: "swap alcove: green jump through the lookout, white air jump" },
  ],
  guards: [
    // Introduce: walks toward the spawn but turns 392+ px short of it, so its
    // cone never reaches the start face.
    patrol("glade", "teach", 18, 24, 16, -1),
    // The develop: in a corridor Rubik can't jump over it, so it walks
    // straight through him (the disguise is the only way past).
    patrol("corridor-b", "disguise", 43, 49, 16, -1),
    // On the canopy roof, guarding the white ledge (sticker 2's route: white
    // up, green past it, white again).
    { ...patrol("roof", "watch", 32, 44, 10, -1), offLine: true },
    // The twist's lookout on the wall top, 5 tiles back from the lip: it
    // looks at the lip 3 s, away 1.6 s (a "…" before each turn). Climb while
    // it looks away, or swap to green within 0.25 s of entering its cone; a
    // white climb into its face earns "?" and then, still in view, "!":
    // caught, back to the midpoint just below.
    sentry("lookout", 70, 12),
    // The conclude: the same watcher over the 4-tile step, with the swap
    // alcove (sticker 3) above it. Revision five's floor patrol is gone: green
    // walked through it and the climb left its cone before it could look.
    sentry("alcove", 102, 12),
    // The finale: one watcher per climb, each looking back at the face it
    // guards (a pillar's card faces the incoming climb, its back the next gap).
    sentry("pillar-a", 130, 12),
    sentry("pillar-b", 148, 12),
    sentry("platform", 167, 12),
  ],
  goal: { x: px(172), floor: px(12) },
  hintZones: {
    white: { x0: px(58), x1: px(65), top: px(12), past: px(66) },
  },
});
