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
 * develop:   the old disguise corridor (3-tile canopy) with two patrols.
 * twist:     a 4-tile wall green can't climb ("white card + Z"), then a lookout
 *            above it: its first "?" at white Rubik gives room to back off or
 *            go green ("green card + X").
 * conclude:  green past a patrol, white up a 4-tile step, green past a
 *            lookout; the swap alcove above it (green jump, white air jump).
 */
import { defineLevel, px } from "./builder.mjs";

const patrol = (id, minCol, maxCol, floorRow, dir, startCol = dir > 0 ? minCol : maxCol) => ({
  id,
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
  cols: 124,
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
    ground(114, 120, 14);
    fill(121, 123, 0, 21); // end wall
  },
  spawn: { x: 204, floor: px(16) },
  checkpoints: [
    { id: "start", x: 176, floor: px(16) },
    // Midpoint at the corridor exit, before the twist (out of every cone).
    { id: "mid", x: px(63), floor: px(16), hint: "white" },
    { id: "late", x: px(82), floor: px(14), hint: "green" },
  ],
  stickers: [
    { id: 1, x: px(40), y: px(15) - 30, line: "main", note: "on the 1-tile step between the corridor patrols" },
    { id: 2, x: px(50) + 16, y: px(6) - 30, line: "off", note: "canopy roof: white up, green past the roof lookout, white again" },
    { id: 3, x: px(104) + 16, y: px(7) - 30, line: "mastery", note: "swap alcove: green jump through the lookout, white air jump" },
  ],
  guards: [
    // Introduce: walks toward the spawn but turns 392+ px short of it, so its
    // cone never reaches the start face.
    patrol("glade", 18, 24, 16, -1),
    patrol("corridor-a", 28, 35, 16, 1),
    patrol("corridor-b", 43, 49, 16, -1),
    // On the canopy roof, guarding the white ledge.
    patrol("roof", 32, 44, 10, -1),
    // On the wall top: faces away from the arrival point first.
    patrol("lookout", 70, 78, 12, 1),
    patrol("floor", 86, 94, 16, -1),
    patrol("alcove", 101, 108, 12, 1),
  ],
  goal: { x: px(118) + 16, floor: px(14) },
  hintZones: {
    white: { x0: px(58), x1: px(65), top: px(12), past: px(66) },
  },
});
