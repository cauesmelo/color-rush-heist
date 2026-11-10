/** 1-2 "Sleeping Cards": stomp/bounce -> the bounce refreshes the air jump ->
 * GREEN GET. White only at the start; no card is ever awake in this level.
 *
 * Every card here is a `trampoline`: it dozes forever, never sees, and only
 * bounces Rubik (~111 px over its head; a white air jump at the bounce apex
 * adds ~83 px: feet ~277 px over the card's floor). Rubik can't stand on a
 * card, so a 1-tile island holding one is a springboard, not a floor.
 *
 * introduce: a card in a 1-tile notch blocks the path (solid); jump on it.
 * develop:   island cards over water carry Rubik across, 7-8 tiles apart
 *            (a full-speed bounce flies ~300 px: let go of right a little).
 * twist:     7-tile walls and 8-tile ledges that the double jump (175 px)
 *            can never reach: bounce, then jump in the air.
 * conclude:  the old opening's overhang drop onto the glowing card: every way
 *            off the run-up lands on it; green swirls in -> GREEN GET; the goal
 *            face is a few steps further on and fills green.
 */
import { defineLevel, px } from "./builder.mjs";

const card = (id, col, floorRow, extra = {}) => ({
  id,
  kind: "green",
  mode: "sleep",
  trampoline: true,
  x: px(col) + 16,
  floor: px(floorRow),
  dir: -1,
  min: px(col) + 16,
  max: px(col) + 16,
  ...extra,
});

export default defineLevel({
  id: "1-2",
  name: "Sleeping Cards",
  idea: "Bounce on dozing cards",
  cols: 135,
  kit: { forms: ["white"], start: "white", dash: false },
  hints: [], // the geometry teaches it: a bounce loop until Rubik jumps in the air
  beacon: 0.2,
  tint: null,
  build({ fill, ground, ledge, water, back }) {
    fill(0, 2, 0, 21);
    // --- Introduce (3-28): a dozing card in a notch across the path --------
    ground(3, 13, 14);
    ground(14, 15, 15); // 1-tile notch: the card's head is 52 px above the path
    ground(16, 28, 14); // 13 tiles: a full bounce (~300 px) lands on dry ground
    // --- Develop (29-63): island cards over water ---------------------------
    water(29, 63);
    for (const col of [34, 41, 48, 56]) ground(col, col, 18); // 1-tile islands, 2 over the water
    // --- Twist (64-107): bounce + air jump ----------------------------------
    ground(64, 81, 18); // far bank; the midpoint face stands here
    ledge(70, 74, 10); // sticker 2: an 8-tile ledge (256 px), bounce + air jump only
    ground(82, 93, 11); // 7-tile wall: the main line's bounce + air jump
    ground(94, 106, 18); // second low floor
    ground(100, 101, 16); // 2-tile pedestal for the second card of the chain
    ledge(103, 105, 8); // the high nook (sticker 3): two-card bounce chain + air jump
    fill(106, 106, 6, 13); // the nook's hanging back wall (walk under it, rows 14-17)
    back(103, 105, 8, 13);
    // --- Conclude (107-134): the overhang drop onto the glowing card --------
    ground(107, 108, 16); // 2-tile steps back up to the run-up
    ground(109, 117, 14); // run-up
    // A rock overhang over the last 4 tiles of the run-up and the drop: 2
    // tiles of headroom, so no jump can sail over the glowing card, and 6
    // tiles tall, so even a double jump can't hop onto it (old Stage 1 opening).
    fill(114, 123, 6, 11);
    ground(118, 131, 18); // clearing, 4 tiles below the run-up
    fill(132, 134, 0, 21); // end wall
  },
  spawn: { x: 204, floor: px(14) },
  checkpoints: [
    { id: "start", x: 176, floor: px(14) },
    { id: "mid", x: px(66) + 16, floor: px(18) },
    // Saved by GREEN GET itself (a death can't take green away).
    { id: "green", x: px(122) + 16, floor: px(18), get: "green" },
  ],
  stickers: [
    { id: 1, x: 560, y: 300, line: "main", note: "the first bounce's apex" },
    { id: 2, x: px(72), y: 296, line: "off", note: "on the 8-tile ledge: bounce, air jump, drift left" },
    { id: 3, x: px(104) + 16, y: 228, line: "mastery", note: "the high nook: bounce, land on the pedestal card, bounce again, air jump" },
  ],
  guards: [
    card("notch", 14, 15, { x: px(15), min: px(15), max: px(15), catch: 24 }),
    card("isle-a", 34, 18),
    card("isle-b", 41, 18),
    card("isle-c", 48, 18),
    card("isle-d", 56, 18),
    card("wall", 79, 18),
    card("chain-a", 97, 18),
    card("chain-b", 100, 16, { x: px(101), min: px(101), max: px(101) }),
    // The glowing card: it holds green. Its stomp head is 24 px wider each
    // side (not 10): with the overhang, every way off the run-up lands on it.
    { id: "glow", kind: "green", mode: "sleep", absorb: true, catch: 24, x: px(118) + 44, floor: px(18), dir: 1, min: px(118) + 44, max: px(118) + 44 },
  ],
  goal: { x: px(128) + 16, floor: px(18) },
});
