/** 1-2 "Stomping Ground": the head stomp -> the flat card is a springboard ->
 * the island chain -> GREEN GET. White only at the start; every card is awake
 * and, since the combat rebuild (RESEARCH_COMBAT.md), every card fights: a
 * walker telegraphs a windup and strikes, a sentinel holds its post, and any
 * of them costs a heart by body or spear. One stomp defeats a card; a `pad`
 * card is flattened instead and stays a springboard.
 *
 * Levels round (LEVEL_DESIGN_V1.md): the previous layout opened with a pit a
 * skilled player jumped over (so its card did nothing for him) and a 7-tile
 * wall whose only way over was the pit card, flattened 8 tiles back: a naive
 * player hopped at the wall for minutes, because nothing said the flat card
 * was a springboard. Now every gate card stands at the foot of the thing it
 * opens, and the failures before the first water are dry.
 *
 * introduce: a sentinel on its post on 16 tiles of flat ground, staring at
 *            the way Rubik comes. It cannot chase: it telegraphs (a 0.65 s
 *            windup, the strike strip on the floor), jabs 100 px ahead, and
 *            its head is the answer: a stomp (from the front, the side or
 *            behind) bounces Rubik up through sticker 1. Nothing is gated by
 *            it; walking past it costs a heart at worst, and the first hit
 *            shows the "stomp" bubble.
 * develop:   the wall duel. A dip two tiles below the flat ground ends at a
 *            7-tile wall that no double jump tops (175 + 12 < 224). A walker
 *            patrols the dip right up to the wall's foot. Pinned against the
 *            wall by a card that chases at 190 px/s, jumping over it is the
 *            instinct, and a landing on its head is the stomp: the bounce,
 *            then the air jump at the peak (he already owns it from 1-1),
 *            tops the wall. The card stays flat at the foot as a springboard,
 *            so a missed bounce is a hop away from the next one. Sticker 2 on
 *            an 8-tile ledge over the dip (the same trick, drifting left).
 * twist:     the first water: four sentinels on 1-tile islands staring ahead,
 *            bounce from back to back (the island chain: 4 stomps without
 *            touching ground is the Chain stamp). A miss costs a heart and a
 *            hop back, and a checkpoint stands on the wall's top.
 * conclude:  the old opening's overhang drop onto a green lookout facing
 *            away: every way off the run-up lands on its back; its green
 *            swirls in -> GREEN GET; the goal face fills green.
 */
import { defineLevel, px } from "./builder.mjs";

const lookout = (id, col, floorRow, dir = 1, extra = {}) => ({
  id,
  job: "gate", // every card here is a stomp the guided line needs
  pad: true, // ...and its bounce is the way over: stomped, it stays flat as a springboard
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
  idea: "Land on a card's head",
  cols: 134,
  kit: { forms: ["white"], start: "white", dash: false },
  unseen: false, // a stomp lesson, not a stealth level: no Unseen stamp here
  // The Chain stamp: the island run is four stomps without touching ground
  // (the baseline route does it), so 4 is "kept the whole chain alive".
  chainPar: 4,
  hints: ["behind"], // after the first hit: a card with an arrow onto its head
  beacon: 0.2,
  tint: null,
  build({ fill, ground, ledge, water }) {
    fill(0, 2, 0, 21);
    // --- Introduce (3-32): the first card, on flat ground --------------------
    ground(3, 12, 12); // start cliff
    ground(13, 16, 14); // 2-tile step down
    ground(17, 32, 16); // 16 flat tiles: the teach card patrols cols 21-28
    // --- Develop (33-62): a dip, a walker, a 7-tile wall ---------------------
    ground(33, 50, 18); // the dip, dry, 2 below the flat ground (a 2-tile step back up)
    ledge(40, 43, 10); // sticker 2: an 8-tile ledge over the dip
    ground(51, 62, 11); // 7 tiles over the dip: only a stomp + air jump tops it
    // --- Twist (63-92): the island chain --------------------------------------
    water(63, 92);
    for (const col of [68, 75, 82, 88]) ground(col, col, 16); // 1-tile islands, 5 below the wall top
    // Sticker 3's slab, 8 tiles over the last island: a held bounce off that
    // lookout plus an air jump (235 px feet) reaches it; a double jump from
    // the far bank (273 px feet) never does.
    ledge(90, 92, 8);
    ground(93, 106, 18); // far bank, 2 below the islands: under the last lookout's cone; a breather
    // --- Conclude (107-133): the overhang drop onto the green card ----------
    ground(107, 108, 16);
    ground(109, 117, 14); // run-up
    // A rock overhang over the last 4 tiles of the run-up and the drop: 2
    // tiles of headroom, so no jump can sail over the green card, and 6 tiles
    // tall, so even a double jump can't hop onto it (old Stage 1 opening).
    fill(114, 123, 6, 11);
    ground(118, 130, 18); // clearing, 4 tiles below the run-up
    fill(131, 133, 0, 21); // end wall
  },
  spawn: { x: 204, floor: px(12) },
  checkpoints: [
    { id: "start", x: 176, floor: px(12) },
    // On the flat ground before the dip: the duel replays from here, dry.
    { id: "dip", x: px(30) + 16, floor: px(16) },
    // On the wall's top: the duel is banked, the water comes next.
    { id: "wall", x: px(57), floor: px(11) },
    // On the far bank: the chain is banked.
    { id: "mid", x: px(97) + 16, floor: px(18) },
    // Saved by GREEN GET itself (a death can't take green away).
    { id: "green", x: px(124) + 16, floor: px(18), get: "green" },
  ],
  stickers: [
    { id: 1, x: px(25) + 16, y: 340, line: "main", note: "over the teach card: any bounce off its head passes through it" },
    { id: 2, x: px(42), y: 296, line: "off", note: "on the 8-tile ledge: stomp the dip card, air jump at the peak, drift left" },
    { id: 3, x: px(91) + 16, y: 228, line: "mastery", note: "the slab over the last island: held bounce + air jump" },
  ],
  guards: [
    // The teach card: a sentinel on its post, staring at the way Rubik comes.
    // It cannot chase, so the first strike is a read, not a race: "?", "!", a
    // 0.65 s windup with the strike strip drawn on the floor, a jab 100 px
    // ahead, and then its open recovery. The head is the answer: the stomp
    // (a jump from outside its reach lands on it) bounces through sticker 1.
    // Not a gate: nothing waits behind it, and walking past it is allowed.
    { id: "first", job: "teach", kind: "green", mode: "sentry", fixed: true, x: px(25) + 16, floor: px(16), dir: -1, min: px(25) + 16, max: px(25) + 16 },
    // The dip's walker: its far bound is the wall's foot (1 tile off: Rubik
    // pinned against the wall stands inside its reach), so the card he must
    // stomp is the card standing at the thing it opens, and it stays flat
    // there as a springboard.
    { id: "wall", job: "gate", pad: true, kind: "green", mode: "patrol", pace: 0.75, x: px(45) + 16, floor: px(18), dir: 1, min: px(42) + 16, max: px(49) + 16 },
    lookout("isle-a", 68, 16),
    lookout("isle-b", 75, 16),
    lookout("isle-c", 82, 16),
    lookout("isle-d", 88, 16),
    // The green card: it holds Rubik's green and faces away from the drop. Its
    // stomp head is 24 px wider each side (not 10): with the overhang, every
    // way off the run-up lands on its back.
    lookout("glow", 118, 18, 1, { absorb: true, catch: 24, x: px(118) + 44, min: px(118) + 44, max: px(118) + 44 }),
  ],
  goal: { x: px(127) + 16, floor: px(18) },
});
