/** 1-2 "Stomping Ground": the head stomp -> stomp from behind -> GREEN GET.
 * White only at the start; every card is awake. Cards here only push
 * (`spears: false`): the spear arrives in 1-5.
 *
 * The stomp rules this level teaches (model.mjs `stompable`): land on a card's
 * head from above or behind and it is stunned for 3 s while Rubik bounces -
 * high if jump is held (196 px over the card's floor), a short hop if not
 * (148 px); an air jump at the bounce's peak adds ~80 px more. A card that
 * FACES Rubik raises its spear (drawn): landing on it pops him away.
 *
 * v1.0 rebuild (rescue round, LEVEL_DESIGN_V1.md). The old 1-2 opened with a
 * 6-deep dry pit whose rim only the HELD bounce reached: a player who didn't
 * know to hold jump was stuck in the pit with nothing to tell him why, and
 * the develop was 30 tiles of water over four 1-tile islands, every miss a
 * death. No human proxy (first-timer, casual or expert) cleared it in 9 runs.
 * Every failure before the conclusion is now dry and cheap:
 *
 * introduce: on flat ground, a slow card walks away from Rubik. Walk into its
 *            back (bumped) and jump, or jump on it: the bounce takes sticker
 *            1 at the tap bounce's peak. It is in the way, not a gate: going
 *            over it is fine (the teach card).
 * develop:   a dip with a patrol in front of a 7-tile wall: only a bounce plus
 *            an air jump gets up (a double jump tops out at 175 + 12 < 224).
 *            A miss lands back in the dip, beside the card: try again.
 *            Sticker 2 on an 8-tile ledge above the dip (drift left).
 * twist:     a yard with a sentry that TURNS (2.2 s looking at Rubik, 1.6 s
 *            away) in front of the next 7-tile wall: wait for its back (or
 *            get popped off its raised spear and pushed, which costs nothing);
 *            the "from behind" bubble comes after the first pop.
 * conclude:  the first water of 1-2, with a checkpoint on the wall top right
 *            before it: one lookout on an island mid-water, staring ahead:
 *            land on its back, bounce, air jump to the far bank (the
 *            develop's move, now with something at stake; sticker 3 on a
 *            slab high over the island). Then the old opening's
 *            overhang drop onto the green card: GREEN GET.
 */
import { defineLevel, px } from "./builder.mjs";

const lookout = (id, col, floorRow, dir = 1, extra = {}) => ({
  id,
  job: "gate", // every card here is a stomp the guided line needs
  kind: "green",
  mode: "sentry",
  fixed: true, // stares one way; the chain reads at a glance
  x: px(col) + 16,
  floor: px(floorRow),
  dir,
  min: px(col) + 16,
  max: px(col) + 16,
  ...extra,
});

export default defineLevel({
  id: "1-2",
  name: "Stomping Ground",
  idea: "Stomp a card from behind",
  cols: 146,
  kit: { forms: ["white"], start: "white", dash: false },
  spears: false,
  unseen: false, // a stomp lesson, not a stealth level: no Unseen stamp here
  hints: ["behind"], // after the first spear-up: a card with an arrow onto its back
  beacon: 0.2,
  tint: null,
  build({ fill, ground, ledge, water }) {
    fill(0, 2, 0, 21);
    // --- Introduce (3-32): the first back, on flat ground -------------------
    ground(3, 12, 12); // start cliff
    ground(13, 16, 14); // 2-tile step down
    ground(17, 32, 16); // flat: the teach card walks away from Rubik here
    // --- Develop (33-62): a dip, a patrol, a 7-tile wall --------------------
    ground(33, 50, 18); // the dip, 2 below the intro floor (a 2-tile step back up)
    ledge(40, 43, 10); // sticker 2: an 8-tile ledge over the dip
    ground(51, 62, 11); // 7 tiles over the dip: bounce + air jump only
    // --- Twist (63-96): the yard and the turning sentry ---------------------
    ground(63, 84, 18); // the yard, dry
    ground(85, 96, 11); // 7 tiles over the yard
    // --- Conclude (97-145): the islands, then the green card ----------------
    // 23 tiles of water and ONE island card in the middle: no double jump
    // from the wall top reaches the bank (a 4-tile drop still leaves it ~2
    // tiles short), and the bounce alone falls short of the bank too: the
    // develop's bounce + air jump, now over water. (Two islands 8 apart let a
    // double jump skip the first card: the cone-blind bot did, 31 of 31.)
    water(97, 119);
    ground(106, 106, 18); // the island (its card stands on it), 9 tiles out: a plain jump reaches it
    ledge(105, 107, 10); // sticker 3's slab, 8 tiles over the island...
    // ...in a slot under a rock. The rock (rows 2-5, 13 tiles) is also a low
    // sky over the water: a double jump off the wall top hits it and drops
    // short of the bank, while a plain jump to the island (head >= 207 px)
    // and the bounce + air jump to the bank (head >= 247 px) pass under it.
    fill(102, 114, 2, 5);
    // The far bank is level with the wall top (row 11): a walk off the wall
    // top with a late air jump can't climb back to it 23 tiles on (at row 14
    // it could, 14 of 2,900 swept timings). The bounce alone tops out 16 px
    // short of it, so the island's bounce + air jump is the way over.
    ground(120, 123, 11);
    ground(124, 124, 13); // a 2-tile and a 1-tile drop down (never a 3-tile climb back),
    ground(125, 129, 14); // the run-up: on its floor before the overhang's 2-tile headroom
    // A rock overhang over the last 4 tiles of the run-up and the drop: 2
    // tiles of headroom, so no jump can sail over the green card, and 6 tiles
    // tall, so even a double jump can't hop onto it (old Stage 1 opening).
    fill(126, 135, 6, 11);
    ground(130, 142, 18); // clearing, 4 tiles below the run-up
    fill(143, 145, 0, 21); // end wall
  },
  spawn: { x: 204, floor: px(12) },
  checkpoints: [
    { id: "start", x: 176, floor: px(12) },
    // On the develop's wall top: the dip is banked (and it never kills).
    { id: "wall", x: px(56), floor: px(11) },
    // On the yard's wall top, 7 tiles of runway before the first water.
    { id: "isles", x: px(89) + 16, floor: px(11) },
    // Saved by GREEN GET itself (a death can't take green away).
    { id: "green", x: px(136) + 16, floor: px(18), get: "green" },
  ],
  stickers: [
    { id: 1, x: px(24) + 16, y: 330, line: "main", note: "over the teach card: the first bounce's peak (a tap reaches it)" },
    { id: 2, x: px(43), y: 296, line: "off", note: "on the 8-tile ledge over the dip: bounce, air jump, drift left" },
    { id: 3, x: px(106) + 16, y: 290, line: "mastery", note: "the slab 8 tiles over the island, under the rock: held bounce + air jump, then drop back onto the card for a second bounce" },
  ],
  guards: [
    // The first card: slow (60%), walking away from Rubik on flat ground,
    // so the first contact is its back. Bumping into it costs nothing.
    { id: "first", job: "teach", kind: "green", mode: "patrol", pace: 0.6, x: px(22) + 16, floor: px(16), dir: 1, min: px(21) + 16, max: px(28) + 16 },
    // The dip's patrol: the wall needs its bounce.
    { id: "dip", job: "gate", kind: "green", mode: "patrol", pace: 0.75, x: px(42) + 16, floor: px(18), dir: 1, min: px(38) + 16, max: px(47) + 16 },
    // The yard's sentry turns: 2.2 s facing the way Rubik comes (spear up, a
    // pop), 1.6 s facing the wall (its back: the stomp). 4 tiles from the wall.
    { id: "turner", job: "gate", kind: "green", mode: "sentry", x: px(80) + 16, floor: px(18), dir: -1, min: px(80) + 16, max: px(80) + 16, turnEvery: [2.2, 1.6] },
    lookout("isle", 106, 18),
    // The green card: it holds Rubik's green and faces away from the drop. Its
    // stomp head is 24 px wider each side (not 10): with the overhang, every
    // way off the run-up lands on its back.
    lookout("glow", 130, 18, 1, { absorb: true, catch: 24, x: px(130) + 44, min: px(130) + 44, max: px(130) + 44 }),
  ],
  goal: { x: px(139) + 16, floor: px(18) },
});
