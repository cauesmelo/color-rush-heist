/** 1-1 "Home Cliff": jump -> double jump. White only, no dash, no cards awake.
 *
 * Introduce -> develop -> twist -> conclude (RESEARCH_PROGRESSION.md section 6):
 * the old Stage 1 home and first steps (safe ditches, no water), a rhythm of
 * 2-tile steps and a one-way slab, then a 4-tile wall on dry ground that only a
 * double jump climbs (the "jump, jump" bubble), and finally the first water
 * with a 4-tile bank beyond it. The goal face stands on that bank. No cards
 * at all: 1-1 is only about the body. No dash glyph, no form cards but white.
 */
import { defineLevel, px } from "./builder.mjs";

export default defineLevel({
  id: "1-1",
  name: "Home Cliff",
  idea: "Jump, then jump twice",
  cols: 120,
  kit: { forms: ["white"], start: "white", dash: false },
  hints: ["move", "airjump"],
  beacon: 0.08, // the stolen red is a speck on the horizon
  tint: null,
  build({ fill, ground, ledge, water }) {
    // --- Introduce (0-33): home cliff and first steps, no water anywhere ---
    fill(0, 2, 0, 21); // the original tall start wall
    ground(3, 12, 12); // home cliff: spawn
    ground(13, 17, 14); // 2-tile drop
    ground(18, 23, 15); // 1-tile drop
    ground(24, 29, 14); // 1-tile step up: the first jump (6 wide: a running jump lands on it)
    ground(30, 32, 16); // 4-tile ditch, floor only 2 tiles down: safe failure
    ground(33, 33, 15); // walk-out step inside the ditch
    // --- Develop (34-60): a rhythm of 2-tile steps and dry ditches ---------
    ground(34, 38, 14);
    ground(39, 41, 16); // dry 3-tile ditch (2 deep: hop out anywhere)
    ground(42, 45, 14);
    ground(46, 49, 12); // 2-tile step up
    ground(50, 56, 14); // 2-tile step down...
    ledge(51, 54, 12); // ...under a one-way slab at the step's height (sticker 2 above it)
    ground(57, 59, 16); // dry 3-tile ditch
    // --- Twist (60-95): a 4-tile wall on dry, flat ground ------------------
    ground(60, 70, 14); // flat run-up; the midpoint face stands here
    ground(71, 76, 10); // 4-tile wall: a single jump (93 px) can't, a double jump (175 px) can
    ground(77, 82, 6); // ...and a second 4-tile step: the stair
    ground(83, 85, 8); // back down in 2-tile steps (never 3: see the climb scan test)
    ground(86, 88, 10);
    ground(89, 91, 12);
    ground(92, 95, 14);
    // --- Conclude (96-119): the first water, a 4-tile bank beyond it -------
    water(96, 99); // 4 tiles of water
    ground(100, 115, 10); // bank 4 tiles up: double jump with something at stake
    ledge(103, 107, 6); // sticker 3: two stacked 4-tile one-way ledges,
    ledge(106, 109, 2); // overlapping so two straight-up double jumps climb them
    ground(116, 118, 12); // past the goal: a 2-tile dip before the end wall
    fill(119, 119, 0, 21); // end wall
  },
  spawn: { x: 204, floor: px(12) },
  checkpoints: [
    { id: "start", x: 176, floor: px(12), hint: "move" },
    // Midpoint just before the twist: a retry never replays the introduction.
    { id: "mid", x: px(62), floor: px(14), hint: "airjump" },
  ],
  stickers: [
    { id: 1, x: 1066, y: 344, line: "main", note: "the natural arc over the first ditch" },
    { id: 2, x: px(52) + 16, y: 262, line: "off", note: "above the slab: only a held jump from the slab reaches it" },
    { id: 3, x: px(108) + 16, y: 20, line: "mastery", note: "top of two stacked ledges: two double jumps" },
  ],
  goal: { x: px(113) + 16, floor: px(10) },
  hintZones: {
    // At the wall's foot: jumps from the floor that fall short.
    airjump: { x0: px(62), x1: px(71), top: px(10), past: px(72) },
  },
});
