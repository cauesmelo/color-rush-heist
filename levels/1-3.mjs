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

export default defineLevel({
  id: "1-3",
  name: "Hide in Green",
  idea: "Green cards can't see green",
  cols: 168,
  kit: { forms: ["white", "green"], start: "green", dash: false },
  spears: false,
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
    // --- Conclude (81-123): green, white, green ------------------------------
    ground(81, 83, 14); // a 2-tile step down: its riser cuts patrol C's cone (late face)
    ground(84, 96, 16); // patrol C's floor
    ground(97, 113, 12); // 4-tile step: white
    ledge(103, 106, 7); // swap alcove 5 tiles above lookout D's patrol
    // --- Finale (114-167): pillars over a dry pit, timed turns ------------
    ground(114, 157, 16); // the pit floor (dry; 4 below the pillar tops)
    ground(126, 129, 12); // pillar A (12 tiles from the step's edge)
    ground(142, 145, 12); // pillar B (12 from A)
    ground(158, 164, 12); // the goal platform (12 from B)
    fill(165, 167, 0, 21); // end wall
  },
  spawn: { x: 204, floor: px(16) },
  checkpoints: [
    { id: "start", x: 176, floor: px(16) },
    // Midpoint at the corridor exit, before the twist (out of every cone).
    { id: "mid", x: px(63), floor: px(16), hint: "white" },
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
    patrol("roof", "watch", 32, 44, 10, -1),
    // On the wall top: faces away from the arrival point first; its "?" at
    // white Rubik after the climb is the "green card + X" moment.
    patrol("lookout", "watch", 70, 78, 12, 1),
    // Its cone covers the white climb up the 4-tile step at 97 when it walks
    // right: time the climb to its back, or swap to green mid-air.
    patrol("floor", "watch", 86, 94, 16, -1),
    // Lookout D on the step top: white lands in its view, so green before
    // landing; it also guards the swap alcove (sticker 3).
    patrol("alcove", "watch", 101, 108, 12, 1),
    // The finale's lookouts turn every 2.2 s (+0.4 s look-back), out of step:
    // each white hop is timed to the next card's back.
    { id: "pillar-a", job: "watch", kind: "green", mode: "sentry", x: px(128) + 16, floor: px(12), dir: -1, min: px(128) + 16, max: px(128) + 16, turnEvery: 2.2 },
    { id: "pillar-b", job: "watch", kind: "green", mode: "sentry", x: px(144) + 16, floor: px(12), dir: 1, min: px(144) + 16, max: px(144) + 16, turnEvery: 2.2 },
    { id: "platform", job: "watch", kind: "green", mode: "sentry", x: px(160) + 16, floor: px(12), dir: -1, min: px(160) + 16, max: px(160) + 16, turnEvery: 2.2 },
  ],
  goal: { x: px(163), floor: px(12) },
  hintZones: {
    white: { x0: px(58), x1: px(65), top: px(12), past: px(66) },
  },
});
