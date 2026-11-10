/** 1-2 "Stomping Ground": the head stomp -> stomp from behind -> GREEN GET.
 * White only at the start; every card is awake. Cards here only push
 * (`spears: false`): the spear arrives in 1-5.
 *
 * The stomp rules this level teaches (model.mjs `stompable`): land on a card's
 * head from above or behind and it is stunned for 3 s while Rubik bounces -
 * high if jump is held (195 px over the card's floor), a short hop if not. A
 * card that FACES Rubik raises its spear (drawn): landing on it pops him away.
 *
 * introduce: a slow card patrols a dry pit 6 tiles below the start cliff; its
 *            cone is in the pit, so Rubik watches from above and drops on its
 *            back. A rock lip over the cliff's end means walking off is the
 *            only way on (no jump across), and the far rim is 6 tiles up: only
 *            the stomp's held bounce (or bounce + air jump) gets out.
 * develop:   a chain of lookouts on 1-tile islands over water, all staring
 *            ahead (fixed, facing the way Rubik travels): bounce from back to
 *            back. A checkpoint stands right before the chain.
 * twist:     a patrol paces in front of a 7-tile wall: only a stomp from
 *            behind while it walks toward the wall, then an air jump at the
 *            bounce's peak, gets up (a double jump tops out at 175 px). A
 *            short dip after the wall is a breather before the finale (it
 *            held a patrol and a pedestal lookout until revision five: the
 *            guided line double-jumped over both, so they did no work and
 *            were removed; the island chain already teaches back-to-back
 *            bounces).
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
  idea: "Stomp a card from behind",
  cols: 134,
  kit: { forms: ["white"], start: "white", dash: false },
  spears: false,
  unseen: false, // a stomp lesson, not a stealth level: no Unseen stamp here
  // The Chain stamp: the island run is four stomps without touching ground
  // (the baseline route does it), so 4 is "kept the whole chain alive".
  chainPar: 4,
  hints: ["behind"], // after the first spear-up: a card with an arrow onto its back
  beacon: 0.2,
  tint: null,
  build({ fill, ground, ledge, water, back }) {
    fill(0, 2, 0, 21);
    // --- Introduce (3-32): a slow card in a dry pit (13-20) -----------------
    ground(3, 12, 12); // start cliff, 6 tiles over the pit floor
    // A rock lip over the cliff's end and the pit's near edge, 2 tiles above
    // the cliff top: no jump (coyote included) gets out from under it, and it
    // is 6 rows thick, so no double jump goes over it. The only way on is
    // walking off the edge: the drop onto the card's back. Revision five's
    // open pit was double-jumped edge to edge (the critic's bot: 31/31).
    fill(9, 14, 4, 9);
    ground(13, 20, 18); // the pit (dry), 6 tiles deep: no double jump climbs out
    ground(21, 32, 12); // far rim: only the stomp's held bounce (or bounce + air jump) reaches it
    // --- Develop (33-70): lookouts on islands over water --------------------
    water(33, 62);
    for (const col of [38, 45, 52, 58]) ground(col, col, 16); // 1-tile islands, 4 below the rim
    // Sticker 3's slab, 8 tiles over the last island: a held bounce off that
    // lookout plus an air jump (235 px feet) reaches it; a double jump from
    // the far bank (273 px feet) never does.
    ledge(60, 62, 8);
    ground(63, 67, 18); // far bank, 2 below the islands: under the last lookout's cone
    ground(68, 69, 16); // a 2-tile block: its riser cuts the wall patrol's cone (mid face)
    // --- Twist (71-108): stomp from behind, bounce + air jump ---------------
    ground(70, 81, 18); // the patrol's floor
    ledge(73, 76, 10); // sticker 2: an 8-tile ledge over the floor
    ground(82, 93, 11); // 7-tile wall
    ground(94, 106, 18); // a short dip: a breather before the finale
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
    // Before the island chain (out of every cone: the chain stares right).
    { id: "chain", x: px(29), floor: px(12) },
    { id: "mid", x: px(65) + 16, floor: px(18) },
    { id: "wall", x: px(88), floor: px(11) }, // on the 7-tile wall: the twist is banked
    // Saved by GREEN GET itself (a death can't take green away).
    { id: "green", x: px(124) + 16, floor: px(18), get: "green" },
  ],
  stickers: [
    { id: 1, x: px(19) + 28, y: 350, line: "main", note: "over the pit: the first bounce's peak (hold jump; a tap tops out 24 px below it)" },
    { id: 2, x: px(75), y: 296, line: "off", note: "on the 8-tile ledge: stomp from behind, air jump, drift left" },
    { id: 3, x: px(61) + 16, y: 228, line: "mastery", note: "the slab over the last island: held bounce + air jump" },
  ],
  guards: [
    // A slow patrol: it walks at 60% pace and turns with a readable look-back.
    { id: "pit", job: "gate", pad: true, kind: "green", mode: "patrol", pace: 0.6, x: px(16) + 16, floor: px(18), dir: 1, min: px(14) + 16, max: px(18) + 16 },
    lookout("isle-a", 38, 16),
    lookout("isle-b", 45, 16),
    lookout("isle-c", 52, 16),
    lookout("isle-d", 58, 16),
    { id: "wall", job: "gate", pad: true, kind: "green", mode: "patrol", pace: 0.7, x: px(75) + 16, floor: px(18), dir: 1, min: px(73) + 16, max: px(79) + 16 },
    // The green card: it holds Rubik's green and faces away from the drop. Its
    // stomp head is 24 px wider each side (not 10): with the overhang, every
    // way off the run-up lands on its back.
    lookout("glow", 118, 18, 1, { absorb: true, catch: 24, x: px(118) + 44, min: px(118) + 44, max: px(118) + 44 }),
  ],
  goal: { x: px(127) + 16, floor: px(18) },
});
