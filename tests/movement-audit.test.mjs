/** Movement audit (common/docs/MOVEMENT_CRITERIA.md): every applicable rubric
 * item measured on the real model with ordinary inputs, kept as regression
 * tests. Each test prints its measurement (`node --test` diagnostics) and
 * asserts the rubric's band; MOVEMENT_AUDIT.md quotes these numbers.
 *
 * Fault setups (placing Rubik, removing cards) only isolate one mechanic on a
 * real level's geometry; nothing here edits the model's rules. */
import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as M from "../model.mjs";
import * as B from "../levels/builder.mjs";
import { LEVELS, LEVEL_IDS } from "../levels/index.mjs";
import { ROUTES } from "./routes.mjs";
import { Planner } from "./route-planner.mjs";
import { readPng } from "./png.mjs";

const here = path.dirname(fileURLToPath(import.meta.url)),
  demo = path.resolve(here, ".."),
  T = B.TILE,
  W = M.WORLD;
const msOf = (ticks) => +((ticks * 1000) / 120).toFixed(1);
const fresh = (id = "1-1") => M.startGame(M.createGame(id));
const noCards = (g) => {
  for (const c of g.guards) c.state = "away";
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
const feet = (g) => g.player.y + g.player.h;
const events = (g, type) => g.events.filter((e) => e.type === type);
/** 1-3's glade: 35 tiles of flat floor (row 16) with open sky below col 25. */
const glade = (x = 6 * T) => place(noCards(fresh("1-3")), x, 16 * T);
/** 1-1's run-up before the 4-tile wall: flat floor (row 14), open sky. */
const runup = (x = 64 * T) => place(noCards(fresh("1-1")), x, 14 * T);
function countUntil(g, input, pred, max = 600) {
  let n = 0;
  while (!pred(g) && n < max) ticks(g, 1, input), n++;
  return n;
}
/** Highest feet height (px above `floor`) of the arc that starts now. */
function peak(g, floor, perTick = () => ({}), max = 240) {
  let top = feet(g);
  for (let i = 0; i < max; i++) {
    ticks(g, 1, perTick(i));
    top = Math.min(top, feet(g));
    if (g.player.grounded && i > 2) break;
  }
  return floor - top;
}
const report = (t, label, value) => t.diagnostic(`${label}: ${typeof value === "string" ? value : JSON.stringify(value)}`);

// ======================================================== A. responsiveness
test("A1: every input changes the state on the tick it is pressed", (t) => {
  const run = glade();
  ticks(run, 1, { right: true });
  assert.ok(run.player.vx > 0 && cx(run) > 6 * T, "right: moving on the press tick");
  const jump = runup();
  ticks(jump, 1, { jump: true });
  assert.ok(jump.player.vy < -400 && feet(jump) < 14 * T, "jump: rising on the press tick");
  const cut = runup(),
    held = runup();
  ticks(cut, 1, { jump: true }), ticks(held, 1, { jump: true });
  ticks(cut, 6), ticks(held, 6);
  ticks(cut, 1, { jumpReleased: true }), ticks(held, 1);
  assert.ok(Math.abs(cut.player.vy - held.player.vy * W.jumpCut) < 15, "release: the cut lands on the release tick");
  const dash = glade();
  dash.dashUnlocked = true;
  ticks(dash, 1, { dash: true, right: true });
  assert.ok(dash.player.dashTime > 0 && dash.player.vx === W.dashSpeed, "dash: bursting on the press tick");
  const swap = place(noCards(fresh("1-3")), 6 * T, 16 * T);
  ticks(swap, 1, { color: "white" });
  assert.equal(swap.player.color, "white", "swap: on the press tick");
  report(t, "A1 model latency", "0 ticks for move, jump, jump-cut, dash and swap");
});

/** The browser loop (loop.mjs), emulated at a display rate with optional
 * hitches: input changes carry real-time stamps and the fixed 120 Hz steps
 * consume each one on the tick its stamp falls in. `apply` is the browser's
 * key handling: held keys, and pulses on a fresh press or a release. */
import { FixedStep, TICK_MS } from "../loop.mjs";
function browserRun(id, changes, { hz, hitch = 0, seed = 1, until = 8000 }) {
  const g = M.startGame(M.createGame(id)),
    loop = new FixedStep(),
    held = new Set(),
    pulses = {};
  let rnd = seed;
  const random = () => (rnd = (rnd * 16807) % 2147483647) / 2147483647;
  const trace = [];
  let now = 0,
    next = 0;
  loop.hold(0);
  const apply = (c) => {
    if (c.pulse) pulses[c.pulse] = c.value ?? true;
    else if (c.down) {
      if (!held.has(c.key) && c.key === "jump") pulses.jump = true;
      held.add(c.key);
    } else {
      held.delete(c.key);
      if (c.key === "jump") pulses.jumpReleased = true;
    }
  };
  while (now < until && g.phase !== "won") {
    now += 1000 / hz + (hitch && random() < 0.1 ? random() * hitch : 0);
    // The browser dispatches every event that happened before this frame
    // (the loop's own 1e-6 ms rounding slack included).
    while (next < changes.length && changes[next][0] <= now + 1e-6) loop.push(changes[next][0], changes[next++][1]);
    loop.run(now, apply, () => {
      M.update(g, M.TICK, { left: held.has("left"), right: held.has("right"), ...pulses });
      for (const k of Object.keys(pulses)) delete pulses[k];
      trace.push([g.player.x, g.player.y]);
    });
  }
  return { g, trace };
}
/** A route as stamped changes: an entry starting on tick k has its held keys
 * and pulses stamped somewhere inside tick k's window ((k, k+1] ticks) - not
 * on a frame boundary - as a player's key events would be. */
function changesFromRoute(route, seed = 7) {
  const out = [];
  let k = 0,
    held = new Set(),
    rnd = seed;
  const random = () => (rnd = (rnd * 16807) % 2147483647) / 2147483647;
  for (const [seconds, input] of route) {
    const at = (k + 0.05 + 0.9 * random()) * TICK_MS,
      want = new Set(["left", "right"].filter((key) => input[key]));
    for (const key of held) if (!want.has(key)) out.push([at, { key, down: false }]);
    for (const key of want) if (!held.has(key)) out.push([at, { key, down: true }]);
    held = want;
    for (const pulse of ["jump", "jumpReleased", "dash", "color"]) if (input[pulse]) out.push([at, { pulse, value: input[pulse] }]);
    k += Math.max(1, Math.round(seconds * 120));
  }
  return out;
}
test("A2: frame-rate independence - identical traces at 30/60/120/240 Hz and with 0-100 ms hitches", (t) => {
  // Physical key events at arbitrary (non-frame-aligned) times on 1-1.
  const keys = [];
  let at = 37;
  for (let i = 0; i < 24; i++) {
    keys.push([at, { key: "right", down: true }]);
    keys.push([at + 13.7 * (i % 5), { key: "jump", down: true }], [at + 13.7 * (i % 5) + 40 + 23 * (i % 3), { key: "jump", down: false }]);
    at += 211.3;
    if (i % 6 === 5) keys.push([at - 50, { key: "right", down: false }]);
  }
  keys.sort((a, b) => a[0] - b[0]);
  const runs = [30, 60, 120, 240].map((hz) => browserRun("1-1", keys, { hz, until: 5500 })),
    hitched = [1, 2, 3].map((seed) => browserRun("1-1", keys, { hz: 60, hitch: 100, seed, until: 5500 }));
  const ref = runs[2].trace;
  let worst = 0;
  for (const run of [...runs, ...hitched]) {
    const n = Math.min(ref.length, run.trace.length);
    assert.ok(n > 600, "long enough");
    for (let i = 0; i < n; i++) worst = Math.max(worst, Math.abs(run.trace[i][0] - ref[i][0]), Math.abs(run.trace[i][1] - ref[i][1]));
  }
  report(t, "A2 worst position difference across 30/60/120/240 Hz and hitched 60 Hz (px)", worst);
  assert.ok(worst <= 1, `traces differ by ${worst} px`);
  // Route outcomes: every level's baseline and mastery as stamped events.
  for (const id of LEVEL_IDS)
    for (const kind of ["baseline", "mastery"])
      for (const [hz, hitch] of [[30, 0], [144, 0], [60, 100]]) {
        const { g } = browserRun(id, changesFromRoute(ROUTES[id][kind]), { hz, hitch, until: 90000 });
        assert.equal(g.phase, "won", `${id} ${kind} at ${hz} Hz${hitch ? " with hitches" : ""}`);
        assert.equal(g.deaths, 0, `${id} ${kind} at ${hz} Hz: no deaths`);
      }
});

test("A4: determinism - two runs of every route give a bit-identical trace", (t) => {
  const hash = (id, route) => {
    const g = fresh(id),
      h = createHash("sha256");
    for (const [s, input] of route)
      for (let i = 0, n = Math.max(1, Math.round(s * 120)); i < n; i++) {
        M.update(g, M.TICK, i === 0 ? input : { left: input.left, right: input.right });
        h.update(`${g.player.x},${g.player.y},${g.player.vx},${g.player.vy};`);
      }
    return h.digest("hex");
  };
  for (const id of LEVEL_IDS)
    for (const kind of ["baseline", "mastery"]) assert.equal(hash(id, ROUTES[id][kind]), hash(id, ROUTES[id][kind]), `${id} ${kind}`);
  report(t, "A4", "12 routes x 2 runs: identical SHA-256 of every tick's position and velocity");
});
