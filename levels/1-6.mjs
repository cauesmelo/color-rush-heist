/** 1-6 "The Vault": recombination -> the theft -> REVERSE. White, green and
 * dash inbound; RED GET at the theft. Run both ways: the level is its own
 * remix, and reaching the start cliff with red ends World 1.
 *
 * introduce: the home cliff (the escape's finish) and its steps; the roof
 *            gates of sealed stones are already visible over the canopy.
 * develop:   greatest hits, compressed: a short canopy with one patrol (1-3),
 *            a white lookout ledge with the swap alcove (1-3/1-5), a dash +
 *            orb crossing via an island (1-4), then the vault steps.
 * twist:     the vault room is ONE readable lock: a red sentry (red sees
 *            green, so the disguise is useless) guards the vault; stair 3 is
 *            cover, its 0.4 s look-back telegraphs each turn, and its back is
 *            the stomp. Touching the vault: RED GET, REVERSE. The red goes into
 *            Rubik and its guard greys out; the door slams (two stones), and
 *            the alarm card comes out at the back of the room: one slow,
 *            visible threat while the first smash is worked out.
 * conclude:  right to left, each card one job: the alarm card (smash out
 *            before it reaches you, or knock it), the island card (land as
 *            green, or knock it), the ledge pair (a green lookout and a red
 *            sentry: no single colour passes) and the corridor patrol (green
 *            past it, or the roof gates: red smashes, sticker 3).
 *
 * Revision five (user playtest, 2026-11-10): "I get stuck here not knowing
 * what to do; this final room isn't fun, several guards on top of each
 * other". The old room stacked a landing patrol, the vault guard and two
 * chasers in 26 tiles; after the theft the chasers speared a hesitant Rubik
 * inside the sealed room and the landing card bumped him back in after the
 * smash, and every death respawned him in the same trap. The chasers and the
 * inbound landing patrol are gone (inbound they did no work: green Rubik
 * walked among them), the room keeps one card, and the escape's cards are
 * spaced one per beat. Every card declares its job (tests check each one).
 * Old Stage 1 geometry is reused with its column offsets noted.
 */
import { defineLevel, px } from "./builder.mjs";

export default defineLevel({
  id: "1-6",
  name: "The Vault",
  idea: "Every trick, then run home with red",
  cols: 136,
  kit: { forms: ["white", "green"], start: "white", dash: true },
  hints: [],
  beacon: 1,
  tint: "night",
  build({ fill, ground, ledge, water, back }) {
    // --- Introduce (0-20): home and its 2-tile steps -------------------------
    fill(0, 2, 0, 21);
    ground(3, 12, 12); // home cliff: spawn, and the finish line after the theft
    ground(13, 16, 14);
    ground(17, 20, 16);
    // --- Develop 1 (21-43): a short canopy, one patrol; the roof gates -------
    ground(21, 43, 16);
    fill(22, 41, 10, 12); // canopy: 3-tile corridor; its roof (row 10) is the escape shortcut
    back(23, 40, 13, 15);
    // --- Develop 2 (44-53): the white lookout ledge + swap alcove ----------
    ground(44, 53, 12); // 4 tiles over the corridor floor: white inbound
    ledge(47, 50, 7); // swap alcove 5 tiles above the lookout (sticker 1)
    // --- Develop 3 (54-83): the dash crossing --------------------------------
    water(54, 63); // 10 tiles to the island (2 down)
    ground(64, 67, 14); // the island (an escape-only card arrives here)
    water(68, 83); // 16 tiles with a refill orb in the middle
    // --- Develop 4 (84-132): the vault steps, landing and chamber ------------
    ground(84, 99, 14); // the bank and stair 1 (old cols 166-169)
    ground(100, 102, 12); // stair 2
    ground(103, 105, 10); // stair 3: below every chamber cone (theft respawn)
    ground(106, 132, 8); // landing and the chamber floor (old 176-202)
    fill(110, 132, 1, 2); // chamber ceiling: a 5-tile room
    back(110, 132, 3, 7);
    fill(133, 135, 0, 21); // tall end wall...
    fill(133, 134, 6, 7, "."); // ...with an alcove (sticker 2) behind a stone
    back(133, 134, 6, 7);
  },
  spawn: { x: 204, floor: px(12) },
  checkpoints: [
    { id: "start", x: 176, floor: px(12) },
    // On the steps: the step's riser cuts the corridor patrol's cone.
    { id: "steps", x: px(15) + 16, floor: px(14) },
    // 6 tiles of runway from the water on the way home (respawns face left).
    { id: "bank", x: px(90) + 16, floor: px(14) },
    // On stair 1, out of the landing and chamber cones.
    { id: "stairs", x: px(98), floor: px(14) },
    // Stair 3, below every chamber cone: the wait for the vault guard is banked.
    { id: "stair3", x: px(104) + 8, floor: px(10) },
    // Saved by RED GET at the theft. Respawn INSIDE the sealed room, facing
    // the door, so the forced first smash always happens; every card holds
    // still for 1.25 s after a respawn here (model.mjs respawnCalm + 0.5).
    { id: "vault", x: px(112) + 16, floor: px(8), get: "red" },
  ],
  stickers: [
    { id: 1, x: px(49) + 16, y: px(7) - 30, line: "main", note: "the swap alcove above the lookout (green jump, white air jump)" },
    { id: 2, x: px(133) + 32, y: 224, line: "off", note: "the chamber alcove behind a stone (escape smash)" },
    { id: 3, x: px(36) + 16, y: px(10) - 34, line: "mastery", note: "on the canopy roof between the stone gates (escape smash line)" },
  ],
  stones: [
    // Roof gates over the canopy: stacked 4 tiles tall at the right end, so
    // a white double jump from the ledge (feet ~209 px) never tops it (row 6
    // = 192 px). A red jump + dash from the ledge's edge breaks both.
    { id: "roof-low", x: 40, y: 8 },
    { id: "roof-high", x: 40, y: 6 },
    // The mid gate is stacked three high (rows 4-9): from the canopy roof's
    // left end a white double jump tops out at feet 145 px, short of row 4
    // (128 px), so sticker 3 stays sealed until red comes home (inbound, a
    // single 2-tile gate here was hopped from the roof). Standing on the roof,
    // Rubik's box spans rows 8-9: a red dash breaks the bottom stone and he
    // runs on under the other two.
    { id: "roof-mid", x: 31, y: 8 }, // sticker 3 is sealed between the gates
    { id: "roof-mid-b", x: 31, y: 6 },
    { id: "roof-mid-c", x: 31, y: 4 },
    // The chamber door: absent inbound, dropped into place by the theft. Two
    // high (rows 4-7 of a 5-row room): no gap to hop through, so the first
    // smash is the way out.
    { id: "seal-low", x: 110, y: 6, sealOnTheft: true },
    { id: "seal-high", x: 110, y: 4, sealOnTheft: true },
    { id: "alcove", x: 131, y: 6 },
  ],
  orbs: [{ id: "crossing", x: px(76), y: 334 }], // at the apex of a jump from the row-14 banks
  guards: [
    // Inbound: its cone covers the white climb onto the ledge at the corridor's
    // end, so the swap back to green is timed to its back. Escape: it faces
    // the incoming Rubik: green past it, or the roof gates above it.
    { id: "corridor", job: "watch", kind: "green", mode: "patrol", x: px(32) + 16, floor: px(16), dir: -1, min: px(28) + 16, max: px(38) + 16 },
    // Guards the swap alcove (sticker 1: green jump through it, white air
    // jump); in the escape it faces the island: green, or the stacked gate.
    { id: "lookout", job: "watch", pair: "ledge-red", kind: "green", mode: "patrol", x: px(47) + 16, floor: px(12), dir: 1, min: px(46) + 16, max: px(50) },
    // The ledge pair: no single colour passes. Inbound, green walks through
    // the lookout but this red sentry sees green: wait for its back (it turns
    // every 2.4 s, + 0.4 s look-back) and stomp it at the lip; the bounce
    // carries on toward the island. On the way home, red walks past it (a
    // card can't see its own colour) and the green lookout, which sees red,
    // takes a red dash knock.
    { id: "ledge-red", job: "gate", pair: "lookout", kind: "red", mode: "sentry", x: px(52) + 16, floor: px(12), dir: -1, min: px(52) + 16, max: px(52) + 16, turnEvery: 2.4 },
    // The vault's only guard. Turns every 2.6 s (+0.4 s look-back): wait on
    // stair 3 (below its cone), go when it looks at the vault, stomp its back.
    // Posted 4 tiles inside the door (not against it), so the doorway reads
    // clear after the theft: door, then the alarm card beyond it.
    // Taking red drains it (grey, flat for good): the room's threat after the
    // theft is the alarm card alone, and green in the room is safe from red.
    { id: "vault-guard", job: "gate", kind: "red", mode: "sentry", x: px(115) + 16, floor: px(8), dir: -1, min: px(114), max: px(116) + 16, turnEvery: 2.6, drainOnTheft: true },
    // Escape only: the vault room's climax. The alarm brings it out at the
    // back of the room facing the alcove; it turns at the alcove stone and
    // walks back toward the vault at 60% pace (96 px/s with the getaway's
    // 1.6x), a visible clock about 6 s from the door. One threat at a time:
    // smash the door and go (its patrol ends 2 tiles inside the door, so its
    // spear never reaches the landing), knock it with a red dash (the
    // mastery's way to the alcove sticker behind it), or go green (it can't
    // see green, and the drained vault guard can't see anything).
    { id: "alarm", job: "knock", kind: "green", mode: "patrol", pace: 0.6, x: px(126) + 16, floor: px(8), dir: 1, theftDir: 1, min: px(113) + 16, max: px(129) + 16, escapeOnly: true },
    // Escape only: it arrives on the island facing the incoming Rubik (spear
    // up, so no stomp). Safe line: swap to green after the last dash and land
    // through it. Red line: land clear of it and knock it with a ground dash
    // (the knock refunds the dash for the jump + dash to the ledge).
    { id: "ambush", job: "swap", kind: "green", mode: "patrol", x: px(65) + 16, floor: px(14), dir: 1, min: px(64) + 24, max: px(67) + 8, escapeOnly: true },
  ],

  /** cofre.png drawn at 4x on a carved dais, raised 24 px (old cx 6064 - 2240). */
  vault: { cx: 3824, floor: px(8) - 24, w: 92, h: 80 },
  /** Reaching the home cliff top while carrying red ends the level (and World 1). */
  home: { x0: px(3), x1: px(13), floor: px(12) },
  par: 18, // "Quick getaway" (s): the baseline QA escape (tests/routes.mjs) x 1.5
});
