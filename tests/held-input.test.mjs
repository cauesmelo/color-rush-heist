/** A held key is honoured after every event that pauses input.
 *
 * The rescue round's first finding (2026-11-10): a player who held right
 * through a death respawned at 1-1's midpoint and Rubik never moved again,
 * because a direction held since the death stayed locked until released. A
 * human keeps holding right through a death, so the game looked frozen. The
 * rule now: a held direction waits WORLD.respawnHold (0.2 s) after the respawn
 * and then moves Rubik; every other event that ignores input (hit-stop
 * freezes, the GET card, knockback, the dash's locked direction, a retry, the
 * theft) hands control back to the held key on its own.
 *
 * Most checks run on a small lab level (flat floor, water, one card, one
 * stone, one swirl) so they keep testing the rule when World 1's maps change;
 * the last one sweeps every real checkpoint for runway. */
import test from "node:test";
import assert from "node:assert/strict";
import * as M from "../model.mjs";
import { defineLevel, px } from "../levels/builder.mjs";
import { LEVELS } from "../levels/index.mjs";
import { ROUTES } from "./routes.mjs";

const T = 32,
  W = M.WORLD;
const LAB = defineLevel({
  id: "lab",
  name: "Input lab",
  idea: "held keys",
  cols: 90,
  kit: { forms: ["white", "green", "red"], start: "white", dash: true },
  build({ fill, ground, water }) {
    fill(0, 2, 0, 21);
    ground(3, 40, 16);
    water(41, 46);
    ground(47, 86, 16);
    fill(87, 89, 0, 21);
  },
  spawn: { x: px(8), floor: px(16) },
  checkpoints: [
    { id: "start", x: px(8), floor: px(16) },
    { id: "mid", x: px(50), floor: px(16) },
  ],
  stickers: [],
  stones: [{ id: "lab-stone", x: 70, y: 14 }],
  pickups: [{ id: "lab-swirl", ability: "dash", x: px(30) + 16, y: px(16) - 34 }],
  guards: [{ id: "lab-card", job: "gate", kind: "green", mode: "sentry", fixed: true, x: px(20) + 16, floor: px(16), dir: -1, min: px(20) + 16, max: px(20) + 16 }],
  goal: null,
});
const lab = ({ cards = false, dash = true } = {}) => {
  const g = M.startGame(M.createGame(LAB));
  if (!cards) for (const c of g.guards) c.state = "away";
  g.dashUnlocked = dash;
  return g;
};
function place(g, cx, feet, extra = {}) {
  Object.assign(g.player, { x: cx - M.PLAYER.w / 2, y: feet - M.PLAYER.h, vx: 0, vy: 0, grace: 0, ...extra });
  g.player.grounded = !("grounded" in extra) || extra.grounded;
  return g;
}
function ticks(g, n, input = {}) {
  for (let i = 0; i < n; i++) M.update(g, M.TICK, i ? { left: input.left, right: input.right } : input);
  return g;
}
const cx = (g) => g.player.x + g.player.w / 2;
/** Ticks of `input` until Rubik's centre has moved `px` to the right (or left). */
function ticksToMove(g, input, dist = 8, max = 240) {
  const x0 = cx(g),
    sign = input.left ? -1 : 1;
  for (let n = 1; n <= max; n++) {
    ticks(g, 1, input);
    if ((cx(g) - x0) * sign >= dist) return n;
  }
  return Infinity;
}
const ms = (n) => +((n * 1000) / 120).toFixed(1);

test("death: right held through the death and the hop moves Rubik 0.2 s after the respawn", (t) => {
  const g = lab();
  place(g, px(44), px(19), { grounded: false, vy: 300 });
  let n = 0;
  while (g.phase === "playing" && n++ < 120) ticks(g, 1, { right: true });
  assert.equal(g.phase, "dead");
  while (g.phase === "dead") ticks(g, 1, { right: true });
  // The first ticks after the respawn: Rubik stands (the landing beat).
  const x0 = cx(g);
  ticks(g, Math.round(W.respawnHold * 120) - 2, { right: true });
  assert.ok(Math.abs(cx(g) - x0) < 1, "he stands for the landing beat");
  const moved = ticksToMove(g, { right: true });
  t.diagnostic(`moving 8 px within ${ms(moved)} ms after the beat`);
  assert.ok(moved <= 12, "then the held key moves him");
  assert.ok(W.respawnHold <= 0.25, "the beat is at most 0.25 s");
  // Holding for the lead's 20 s: he keeps running (into the end wall).
  const far = lab();
  place(far, px(44), px(19), { grounded: false, vy: 300 });
  while (far.phase === "playing") ticks(far, 1, { right: true });
  for (let i = 0; i < 20 * 120 && far.phase !== "playing"; i++) ticks(far, 1, { right: true });
  const start = cx(far);
  ticks(far, 120, { right: true });
  assert.ok(cx(far) - start > 200, `20 s of holding right is never ignored (moved ${Math.round(cx(far) - start)} px in 1 s)`);
});

test("death: released and pressed again during the hop moves at once; left held through it too", () => {
  const g = lab();
  place(g, px(44), px(19), { grounded: false, vy: 300 });
  while (g.phase === "playing") ticks(g, 1, { right: true });
  ticks(g, 6, {}); // let go during the hop
  while (g.phase === "dead") ticks(g, 1, { right: true }); // and press again
  assert.ok(ticksToMove(g, { right: true }, 4) <= 6, "a fresh press counts at once");
  const l = lab();
  place(l, px(44), px(19), { grounded: false, vy: 300 });
  while (l.phase === "playing") ticks(l, 1, { left: true });
  while (l.phase === "dead") ticks(l, 1, { left: true });
  assert.ok(ticksToMove(l, { left: true }) <= Math.round(W.respawnHold * 120) + 12, "left held through the death moves too");
});

test("retry (R) while holding right: no lock at all", () => {
  const g = lab();
  // An old death left its record behind; a retry while alive must not reuse it.
  place(g, px(44), px(19), { grounded: false, vy: 300 });
  while (g.phase === "playing") ticks(g, 1, { right: true });
  while (g.phase === "dead") ticks(g, 1, { right: true }); // held through that death
  ticks(g, 30, { right: true });
  M.respawn(g); // what game.mjs's retryCheckpoint calls, right still held
  assert.ok(ticksToMove(g, { right: true }, 4) <= 6);
});

test("hit-stop freezes (stomp, smash, knock) hand control back to the held key on the next tick", () => {
  // Stomp: drop on the card's back holding right.
  const s = lab({ cards: true });
  const card = s.guards[0];
  place(s, card.x + 6, card.floor - M.GUARD.h - 30, { grounded: false, vy: 250, direction: 1 });
  let n = 0;
  while (s.stomps === 0 && n++ < 60) ticks(s, 1, { right: true });
  assert.equal(s.stomps, 1, "stomped");
  const freeze = Math.ceil(s.hitstop * 120);
  ticks(s, freeze, { right: true });
  const vx0 = s.player.vx;
  ticks(s, 3, { right: true });
  assert.ok(s.player.vx > vx0 && s.player.vx > 0, "right accelerates right after the stomp freeze");
  // Smash: a red dash into the stone, right held.
  const r = lab();
  place(r, px(66), px(16), { color: "red", direction: 1 });
  ticks(r, 1, { right: true, dash: true });
  n = 0;
  while (r.smashes === 0 && n++ < 60) ticks(r, 1, { right: true });
  assert.equal(r.smashes, 1, "smashed");
  ticks(r, Math.ceil(r.hitstop * 120) + Math.ceil(W.dashDuration * 120) + 2, { right: true });
  assert.ok(r.player.vx > 0 && ticksToMove(r, { right: true }) <= 12, "right keeps running after the smash");
  // Knock: a red air dash into the card's face, then left held.
  const k = lab({ cards: true });
  const c = k.guards[0];
  place(k, c.x + 100, c.floor, { color: "red", direction: -1 });
  ticks(k, 1, { left: true, jump: true });
  ticks(k, 6, { left: true });
  ticks(k, 1, { left: true, dash: true });
  n = 0;
  while (k.knockouts === 0 && n++ < 60) ticks(k, 1, { left: true });
  assert.equal(k.knockouts, 1, "knocked");
  ticks(k, Math.ceil(k.hitstop * 120) + Math.ceil(W.dashDuration * 120) + 2, { left: true });
  assert.ok(ticksToMove(k, { left: true }) <= 12, "left keeps moving after the knock");
});

test("knockback (a card's bump) ends and the held key moves Rubik again", () => {
  const g = lab({ cards: true });
  const c = g.guards[0];
  // Walk into a calm card's face (it faces left, Rubik comes from the left)
  // holding right: bumped back, then right pulls him toward it again.
  place(g, c.x - 90, c.floor, { direction: 1 });
  let n = 0;
  while (g.player.knock <= 0 && n++ < 120) ticks(g, 1, { right: true });
  assert.ok(g.player.knock > 0, "bumped");
  assert.ok(g.player.vx < 0, "thrown back the way he came");
  ticks(g, Math.ceil(g.player.knock * 120), { right: true });
  const vx0 = g.player.vx;
  ticks(g, 4, { right: true });
  assert.ok(g.player.vx > vx0, "right pulls him back toward the card after the knock");
});

test("dash: the burst locks its direction, then the held key steers again", () => {
  const g = lab();
  place(g, px(10), px(16), { direction: 1 });
  ticks(g, 1, { right: true, dash: true });
  ticks(g, Math.ceil((W.dashDuration + W.dashFreeze) * 120) + 1, { left: true });
  const vx0 = g.player.vx;
  ticks(g, 4, { left: true });
  assert.ok(g.player.vx < vx0, "left turns him once the dash ends");
  assert.ok(ticksToMove(g, { left: true }) <= 30);
});

test("GET card (1.2 s freeze): right held through it runs on as the world resumes", () => {
  const g = lab({ dash: false });
  place(g, px(28), px(16), { direction: 1 });
  let n = 0;
  while (!g.dashUnlocked && n++ < 240) ticks(g, 1, { right: true });
  assert.ok(g.dashUnlocked && g.hitstop > 1, "DASH GET froze the world");
  ticks(g, Math.ceil(g.hitstop * 120), { right: true });
  assert.ok(ticksToMove(g, { right: true }) <= 12);
});

test("level start: a direction held from the first tick moves Rubik on that tick", () => {
  for (const level of LEVELS) {
    const g = M.startGame(M.createGame(level.id));
    const dir = level.spawn.dir ?? 1;
    assert.equal(ticksToMove(g, dir > 0 ? { right: true } : { left: true }, 0.2), 1, level.id);
  }
});

/** Runway: after a respawn at any checkpoint, holding the way the level goes
 * (and the way back) without touching jump must give a reacting player time:
 * the 0.2 s beat + 0.6 s (a first-timer reacts in 250-300 ms) before Rubik
 * could die. The respawn's 0.75 s calm keeps every card still meanwhile. */
test("every checkpoint has runway: holding either way after a respawn can't kill Rubik for 0.8 s", (t) => {
  const short = [];
  for (const level of LEVELS) {
    const route = ROUTES[level.id].baseline;
    for (let index = 0; index < level.checkpoints.length; index++)
      for (const dir of [1, -1]) {
        // Reach checkpoint `index` the way a player does (the baseline route),
        // then die there holding a direction and keep holding it.
        const g = M.startGame(M.createGame(level.id));
        let reached = index === 0;
        outer: for (const [s, input] of route) {
          for (let i = 0, n = Math.max(1, Math.round(s * 120)); i < n; i++) {
            if (reached) break outer;
            M.update(g, M.TICK, i === 0 ? input : { left: input.left, right: input.right });
            reached = g.checkpointIndex === index && g.phase === "playing";
          }
        }
        if (!reached) {
          short.push(`${level.id} ${level.checkpoints[index].id}: not on the baseline`);
          continue;
        }
        const hold = dir > 0 ? { right: true } : { left: true };
        M.die(g, "water");
        while (g.phase === "dead") ticks(g, 1, hold);
        let n = 0;
        for (; n < 96 && g.phase === "playing"; n++) ticks(g, 1, hold);
        if (g.phase === "dead") short.push(`${level.id} ${level.checkpoints[index].id} ${dir > 0 ? "right" : "left"}: dead after ${ms(n)} ms`);
      }
  }
  t.diagnostic(`short runways: ${short.join("; ") || "none"}`);
  assert.deepEqual(short, []);
});
