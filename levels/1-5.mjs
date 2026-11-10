/** 1-5 "Lookouts": awareness and the spear -> a red card sees green. White,
 * green and dash. The first level where a spotted Rubik can be speared.
 *
 * introduce: an open arena, no ceiling and no water, one green patrol: the
 *            whole ladder in the open. "?" (0.25 s in sight) -> "!" (a 0.45 s
 *            beat) -> charge at 240 px/s (Rubik runs 330) -> wind-up -> a
 *            spear 30-70 px up (jumpable here) -> 0.7 s recovery to stomp.
 * develop:   4-tile steps (white) under a patrol and a turning sentry; 2-tile
 *            blocks cut their cones; the "..." look-back telegraphs each turn.
 * twist:     the old enforcer post: the red card's cone is bright on green
 *            Rubik, and it is the gate. Wait behind the step (its riser cuts
 *            the cone) for it to face away, then run off the step onto its
 *            back. Revision five removed the perch above it: perch to perch,
 *            every player skipped the twist. Sticker 2 sits on a perch 8
 *            tiles up behind it: only the held bounce off its back plus
 *            white's air jump reaches it (a double jump from the step tops
 *            out 17 px short).
 * conclude:  each colour is wrong for one card. A red sentry on the floor
 *            sees green: time it or stomp it from behind. Then the goal stands
 *            at the far end of a 4-tile block (a white climb) that a green card
 *            patrols: white lands in its view and can't walk past its body, so
 *            swap to green before landing (1-5's P2 lesson), or wait for its
 *            back, or stomp it from behind as it walks to the goal. A high line
 *            of slabs, reached by a white double jump from the checkpoint
 *            block, stays far above the floor cones (a cone reaches 90 px over
 *            its floor) and ends on the same block.
 *            (Revision five: the green card used to pace the red sentry's
 *            floor, overlapping it, and no route ever came near it.)
 */
import { defineLevel, px } from "./builder.mjs";

export default defineLevel({
  id: "1-5",
  name: "Lookouts",
  idea: "Read the cones; red sees green",
  cols: 124,
  kit: { forms: ["white", "green"], start: "white", dash: true },
  hints: [],
  beacon: 0.7,
  tint: "dusk",
  build({ fill, ground, ledge }) {
    fill(0, 2, 0, 21);
    // --- Introduce (3-34): the arena ---------------------------------------
    ground(3, 12, 14); // start ledge: its face cuts the arena card's cone
    ground(13, 34, 16); // the arena: open sky, dry ground
    // --- Develop (35-58): steps, a patrol, a sentry, cover -------------------
    ground(35, 52, 12); // 4-tile step (white) onto P1
    fill(37, 38, 10, 11); // 2-tile cover block on P1
    ground(53, 58, 8); // 4-tile step onto P2, the sentry's post
    fill(54, 54, 6, 7); // 2-tile cover at the top of the step
    // --- Twist (59-82): the enforcer post (old Stage 1, shifted) -------------
    ground(59, 82, 16);
    fill(64, 65, 14, 15); // step up to the perch: its riser shields the post face
    ledge(76, 79, 8); // sticker 2's perch: bounce off the enforcer + air jump only
    // --- Conclude (83-123): crossing cones -----------------------------------
    ground(83, 112, 16);
    fill(83, 86, 14, 15); // a 2-tile block: both risers cut the cones (CP 2 on top)
    ledge(88, 91, 10); // the never-seen line: 6 tiles over the floor, 4 over
    ledge(97, 100, 10); // the block (a white double jump), far above both cones
    ledge(106, 109, 10);
    ground(113, 120, 12); // the goal block: 4 tiles (white), patrolled by a green card
    fill(121, 123, 0, 21); // end wall
  },
  spawn: { x: 204, floor: px(14) },
  checkpoints: [
    { id: "start", x: 176, floor: px(14) },
    // CP 1: shielded by the step's riser, before the twist.
    { id: "post", x: px(62) + 10, floor: px(16) },
    { id: "cross", x: px(85), floor: px(14) },
  ],
  stickers: [
    { id: 1, x: px(27), y: 262, line: "main", note: "above the arena: a stomp bounce off the teaching card reaches it (a double jump falls short)" },
    { id: 2, x: px(78), y: px(8) - 30, line: "off", note: "the high perch behind the enforcer: held bounce off its back + white air jump" },
    // y = 250: a hop on slab 3 reaches it; standing (box top 268) or a bounce
    // off the red sentry 250 px away (box top >= 265 there) does not.
    { id: 3, x: px(109) + 12, y: 250, line: "mastery", note: "end of the never-seen line above both cones (hop at the slab's end)" },
  ],
  guards: [
    // The ladder in the open (it hums at green Rubik, so a green player can
    // skip the lesson); stomping it on its recovery is sticker 1's bounce.
    { id: "teacher", job: "teach", kind: "green", mode: "patrol", x: px(30) + 16, floor: px(16), dir: -1, min: px(22) + 16, max: px(30) + 16 },
    // Patrols P1 under the 4-tile step up to P2: the white climb is timed to
    // its back (or the swap back to green made in the air).
    { id: "p1", job: "watch", kind: "green", mode: "patrol", x: px(48) + 16, floor: px(12), dir: 1, min: px(42) + 16, max: px(50) + 16 },
    // On P2 behind its cover block: white lands next to it, so the swap back
    // to green has to happen before the hop down to the post.
    { id: "p2", job: "gate", kind: "green", mode: "sentry", x: px(57), floor: px(8), dir: -1, min: px(56) + 16, max: px(57) + 16, turnEvery: 2.5 },
    // The enforcer post: stationary red sentry turning every 3 s.
    { id: "enforcer", job: "gate", kind: "red", mode: "sentry", x: px(72) + 16, floor: px(16), dir: -1, min: px(68) + 16, max: px(76) + 16, turnEvery: 3 },
    // The floor's red sentry sees green: stomp it from behind when it faces
    // the goal block (its 3 s stun covers the walk and the climb).
    { id: "cross-red", job: "gate", kind: "red", mode: "sentry", x: px(101) + 16, floor: px(16), dir: -1, min: px(99) + 16, max: px(103) + 16, turnEvery: 2.5 },
    // Paces the goal block (113.5-117.5; the goal face stands past its far
    // bound): its body stops white, its cone sees white, green walks through.
    { id: "cross-green", job: "swap", kind: "green", mode: "patrol", x: px(115) + 16, floor: px(12), dir: -1, min: px(113) + 16, max: px(117) + 16 },
  ],
  goal: { x: px(119) + 16, floor: px(12) },
});
