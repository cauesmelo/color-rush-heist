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
import { Planner, replay } from "./route-planner.mjs";
import { EXPERT } from "./route-scripts.mjs";
import { readPng } from "./png.mjs";
import { FixedStep, TICK_MS } from "../loop.mjs";

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

test("A3: presses at the edges - landing, respawn, freezes, stomps - are honoured or ignored by rule, never doubled", (t) => {
  // Respawn: a direction held since the death waits 0.2 s, then moves;
  // a jump pressed in the hop's last 0.12 s fires on arrival, an earlier one doesn't.
  const death = (pressAt) => {
    const g = noCards(fresh("1-1"));
    place(g, 110 * T + 16, 16 * T, { grounded: false, vy: 400 }); // over the pool's first half
    let n = 0;
    while (g.phase === "playing" && n++ < 120) ticks(g, 1, { right: true });
    assert.equal(g.phase, "dead");
    const hop = Math.round(W.respawnDelay * 120);
    for (let i = 0; i < hop + 2 && g.phase === "dead"; i++) ticks(g, 1, { right: true, jump: i === hop - pressAt });
    ticks(g, 1, { right: true }); // the first tick after the respawn
    return g;
  };
  const late = death(8),
    early = death(30);
  assert.equal(late.phase, "playing");
  assert.ok(late.player.vy < 0, "a jump pressed 8 ticks before the respawn fires on arrival");
  assert.ok(early.player.vy >= 0, "one pressed 30 ticks (0.25 s) before it does not");
  // Right held through the death waits the 0.2 s landing beat, then runs
  // (it used to stay locked until released: a player who kept holding right
  // saw Rubik frozen at the checkpoint, tests/held-input.test.mjs).
  const x0 = late.player.x;
  ticks(late, Math.round(W.respawnHold * 120) - 2, { right: true });
  assert.ok(Math.abs(late.player.x - x0) < 4, "right, held through the death, waits the landing beat");
  ticks(late, 30, { right: true });
  assert.ok(late.player.x > x0 + 40, "then the held key moves him");
  // The 1.2 s GET card (1-4's DASH GET, caught in the air): a dash pressed at
  // its start is not replayed 1.2 s later; one pressed in its last 0.08 s
  // fires as the world resumes.
  const get = (pressBeforeEnd) => {
    const g = noCards(fresh("1-4"));
    place(g, 8 * T - 6, 16 * T, { color: "green" }); // 22 px short of the swirl: the jump takes it while rising
    let n = 0;
    while (!g.dashUnlocked && n++ < 240) ticks(g, 1, n === 1 ? { right: true, jump: true } : { right: true });
    assert.ok(g.dashUnlocked && g.hitstop > 1, "DASH GET freezes the world");
    const freeze = Math.round(g.hitstop * 120);
    for (let i = 0; i < freeze + 24; i++) ticks(g, 1, { right: true, dash: i === freeze - pressBeforeEnd });
    return events(g, "dash").length;
  };
  const stale = get(Math.round(1.2 * 120) - 1),
    lastMoment = get(10);
  report(t, "A3 GET card: dashes after a press at its start / in its last 0.08 s", [stale, lastMoment]);
  assert.equal(stale, 0, "a press at the GET card's start is not replayed 1.2 s later");
  assert.equal(lastMoment, 1, "a press in its last moments fires as the world resumes");
  // The stomp freeze: pressing jump during it (or just after) is "pressing as
  // you land" - the high bounce - and it never spends white's air jump.
  const stomp = (pressAfter) => {
    const g = fresh("1-2"),
      c = g.guards.find((x) => x.id === "first");
    for (const other of g.guards) if (other !== c) other.state = "away";
    Object.assign(c, { dir: 1, turning: 0, state: "calm", x: 17 * T, fixed: true, mode: "sentry" });
    place(g, c.x - 4, c.floor - M.GUARD.h - 40, { grounded: false, vy: 200 });
    let n = 0;
    while (g.stomps === 0 && n++ < 60) ticks(g, 1);
    assert.equal(g.stomps, 1);
    if (pressAfter >= 0) ticks(g, pressAfter), ticks(g, 1, { jump: true });
    return peak(g, c.floor) ;
  };
  const hop = stomp(-1),
    inFreeze = stomp(3),
    afterGrace = stomp(Math.round((W.hitstop.stomp + W.stompGrace) * 120) + 2);
  report(t, "A3 stomp bounce over the card's floor (px): no press / press in the freeze / press after the window (air jump)", [hop, inFreeze, afterGrace].map((v) => +v.toFixed(1)));
  assert.ok(inFreeze > hop + 40, "a press in the stomp freeze makes the high bounce");
  // No double cut: two releases (two jump keys, or a touch pad's
  // pointerup + lostpointercapture) cut a jump once.
  const one = runup(),
    two = runup();
  for (const g of [one, two]) ticks(g, 1, { jump: true }), ticks(g, 5);
  ticks(one, 1, { jumpReleased: true });
  ticks(two, 1, { jumpReleased: true }), ticks(two, 1, { jumpReleased: true });
  ticks(one, 1);
  assert.equal(two.player.vy, one.player.vy, "a second release changes nothing");
  // Pause: nothing advances and nothing is latched while paused (the browser
  // keeps tracking held keys and applies them on resume: browser check).
  const p = runup();
  p.phase = "paused";
  const before = JSON.stringify(p);
  ticks(p, 30, { right: true, jump: true, dash: true, color: "green" });
  assert.equal(JSON.stringify(p), before);
  report(t, "A3", "respawn lock + late-jump carry, GET-card press expiry, stomp-freeze press = high bounce, single cut, pause inert");
});

// ======================================================= B. ground/air control
test("B1-B3: run start, stop and turnaround times", (t) => {
  const a = glade();
  const start = countUntil(a, { right: true }, (g) => g.player.vx >= W.speed),
    stop = countUntil(a, {}, (g) => g.player.vx === 0);
  const b = glade();
  countUntil(b, { right: true }, (g) => g.player.vx >= W.speed);
  const turn = countUntil(b, { left: true }, (g) => g.player.vx <= -W.speed);
  report(t, "B1 0 -> full speed (ms)", msOf(start));
  report(t, "B2 full speed -> stop (ms)", msOf(stop));
  report(t, "B3 full speed -> full speed the other way (ms)", msOf(turn));
  assert.ok(msOf(start) >= 50 && msOf(start) <= 150);
  assert.ok(msOf(stop) <= 100);
  assert.ok(msOf(turn) <= 150);
});
test("B4: air control is 60-100% of the ground's and never an instant reversal", (t) => {
  const air = place(noCards(fresh("1-1")), 64 * T, 6 * T, { grounded: false }),
    ground = glade();
  ticks(air, 1, { right: true });
  ticks(ground, 1, { right: true });
  const ratio = air.player.vx / ground.player.vx;
  const r = place(noCards(fresh("1-1")), 64 * T, 4 * T, { grounded: false, vx: W.speed });
  const reverse = countUntil(r, { left: true }, (g) => g.player.vx <= -W.speed);
  report(t, "B4 air/ground acceleration", +ratio.toFixed(2));
  report(t, "B4 mid-air full reversal (ms)", msOf(reverse));
  assert.ok(ratio >= 0.6 && ratio <= 1);
  assert.ok(msOf(reverse) >= 100, "not an instant flip");
});
test("B5-B8: jump arc - time to apex, tap/hold ratio, fall/rise gravity, apex hang", (t) => {
  const g = runup();
  ticks(g, 1, { jump: true });
  let best = feet(g),
    at = 1;
  for (let i = 2; i < 200 && !g.player.grounded; i++) {
    ticks(g, 1);
    if (feet(g) < best - 1e-9) (best = feet(g)), (at = i);
  }
  const held = 14 * T - best;
  const tapHeight = (releaseTick) => {
    const h = runup();
    if (releaseTick === 0) ticks(h, 1, { jump: true, jumpReleased: true });
    else ticks(h, 1, { jump: true }), ticks(h, releaseTick - 1), ticks(h, 1, { jumpReleased: true });
    return peak(h, 14 * T);
  };
  const tap = tapHeight(0);
  // The cut lands on the release tick itself.
  const c = runup(),
    d = runup();
  ticks(c, 1, { jump: true }), ticks(d, 1, { jump: true });
  ticks(c, 9), ticks(d, 9);
  const vBefore = c.player.vy;
  ticks(c, 1, { jumpReleased: true }), ticks(d, 1);
  const cutOnTick = Math.abs(c.player.vy - (vBefore * W.jumpCut + W.gravity * M.TICK * W.jumpCut)) < 12 && c.player.vy > d.player.vy;
  // Gravity: dv per tick while rising (outside the hang band) and falling.
  const e = runup();
  ticks(e, 1, { jump: true }), ticks(e, 5);
  const v0 = e.player.vy;
  ticks(e, 1);
  const rise = e.player.vy - v0;
  while (e.player.vy < 200) ticks(e, 1);
  const v1 = e.player.vy;
  ticks(e, 1);
  const fall = e.player.vy - v1;
  const drop = place(noCards(fresh("1-1")), 98 * T, 0, { grounded: false });
  let fastest = 0;
  for (let i = 0; i < 120 && drop.phase === "playing"; i++) ticks(drop, 1), (fastest = Math.max(fastest, drop.player.vy));
  // Apex hang: ticks in the |vy| < band window, held vs let go at the band.
  const band = (hold) => {
    const h = runup();
    ticks(h, 1, { jump: true });
    let n = 0,
      released = false;
    for (let i = 0; i < 200 && !h.player.grounded; i++) {
      const release = !hold && !released && h.player.vy > -W.apexBand;
      if (release) released = true;
      ticks(h, 1, release ? { jumpReleased: true } : {});
      if (Math.abs(h.player.vy) < W.apexBand && !h.player.grounded) n++;
    }
    return n;
  };
  const hang = msOf(band(true) - band(false));
  report(t, "B5 time to apex, held (ms)", msOf(at));
  report(t, "B6 tap / held height (px) and ratio", { tap: +tap.toFixed(1), held: +held.toFixed(1), ratio: +(tap / held).toFixed(2), cutOnReleaseTick: cutOnTick });
  report(t, "B7 fall / rise gravity, max fall (px/s)", { ratio: +(fall / rise).toFixed(2), maxFall: fastest });
  report(t, "B8 extra hang while held (ms)", hang);
  assert.ok(msOf(at) >= 300 && msOf(at) <= 450);
  assert.ok(tap / held >= 0.3 && tap / held <= 0.55 && cutOnTick);
  assert.ok(fall / rise >= 1.3 - 1e-9 && fall / rise <= 2.2 && fastest === W.maxFall);
  assert.ok(hang > 0 && hang <= 120);
});
test("B9-B10: coyote time and jump buffer, to the tick, in real time", (t) => {
  const coyote = (late) => {
    const g = noCards(fresh("1-1"));
    place(g, 12 * T - 30, 12 * T, { vx: W.speed });
    while (g.player.grounded) ticks(g, 1, { right: true });
    g.player.airJumped = true; // only the ground (coyote) jump is under test
    ticks(g, late, { right: true });
    ticks(g, 1, { right: true, jump: true });
    return g.player.vy < -400;
  };
  let lastCoyote = 0;
  while (coyote(lastCoyote + 1)) lastCoyote++;
  const buffer = (early) => {
    const g = runup();
    Object.assign(g.player, { grounded: false, airJumped: true, coyote: 0, vy: 300 });
    g.player.y -= 120;
    const probe = structuredClone(g);
    Object.defineProperty(probe, "level", { value: g.level });
    let land = 0;
    while (!probe.player.grounded) ticks(probe, 1), land++;
    ticks(g, land - early), ticks(g, 1, { jump: true }), ticks(g, early + 2);
    return g.player.vy < 0 && g.player.jumps === 1;
  };
  let earliest = 0;
  while (buffer(earliest + 1)) earliest++;
  report(t, "B9 coyote: last airborne tick a ground jump still works, from the feet leaving (ms)", msOf(lastCoyote + 1));
  report(t, "B10 buffer: earliest press before landing that still jumps (ms)", msOf(earliest));
  assert.ok(msOf(lastCoyote + 1) >= 80 && msOf(lastCoyote + 1) <= 120);
  assert.ok(msOf(earliest) >= 100 && msOf(earliest) <= 150);
  // Real time: the stepped browser loop gives the same window at 30 and 144 Hz
  // (A2 proves the tick mapping; here the windows themselves).
  for (const hz of [30, 144]) {
    const keys = [[0.5, { key: "right", down: true }]];
    const { g } = browserRun("1-1", keys, { hz, until: 400 });
    assert.equal(g.phase, "playing", `${hz} Hz runs`);
  }
});
test("B11: corner correction - rising into a ceiling edge, and a dash into a lip's underside", (t) => {
  const rise = (overlap) => {
    const g = noCards(fresh("1-3"));
    Object.assign(g.player, { x: 26 * T + overlap - M.PLAYER.w, y: 13 * T + 1, vx: 0, vy: -300, grounded: false, rising: true, jumps: 1, grace: 0 });
    ticks(g, 2);
    return g.player.vy < -200;
  };
  let ceiling = 0;
  while (rise(ceiling + 1)) ceiling++;
  // 1-3's canopy underside (rows 10-12, bottom y = 416, from x = 832): an air
  // dash from the open glade whose head clips its face by `clip` px.
  const dash = (clip) => {
    const g = noCards(fresh("1-3"));
    g.dashUnlocked = true;
    Object.assign(g.player, { x: 26 * T - M.PLAYER.w - 30, y: 13 * T - clip, vx: 0, vy: 0, grounded: false, grace: 0, dashCharge: 1 });
    ticks(g, 1, { right: true, dash: true });
    ticks(g, 24, { right: true });
    return g.player.x > 26 * T + 40;
  };
  let under = 0;
  while (dash(under + 1)) under++;
  report(t, "B11 ceiling corner nudge / dash corner nudge (px)", { ceiling, dash: under });
  assert.ok(ceiling >= 4 && ceiling <= 8);
  assert.ok(under >= 4 && under <= 8);
});

/** The drawn feet of the frame the renderer shows for this state (game.mjs
 * playerFrame), read from rubik_white.png: { bottom, left, right } in px
 * relative to the collider's feet line and centre. */
const sheet = readPng(path.join(demo, "assets", "rubik_white.png"));
const frameFeet = new Map();
function drawnFeet(sx, sy, direction) {
  const key = `${sx},${sy}`;
  if (!frameFeet.has(key)) {
    let y1 = -1;
    for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) if (sheet.alpha(sx + x, sy + y) > 0) y1 = Math.max(y1, y);
    let x0 = 99,
      x1 = -1;
    for (let y = y1 - 1; y <= y1; y++) for (let x = 0; x < 32; x++) if (sheet.alpha(sx + x, sy + y) > 0) (x0 = Math.min(x0, x)), (x1 = Math.max(x1, x));
    // Frames are drawn 2x from (centre - 33, feet - 64); mirrored when facing left.
    frameFeet.set(key, { bottom: -64 + 2 * (y1 + 1), left: -33 + 2 * x0, right: -33 + 2 * (x1 + 1) });
  }
  const f = frameFeet.get(key);
  return direction < 0 ? { bottom: f.bottom, left: -f.right, right: -f.left } : f;
}
/** The frame game.mjs's playerFrame() picks (clock-driven cycles: frame 0). */
function frameOf(p) {
  if (p.dashTime > 0) return [0, 32];
  if (p.knock > 0) return [160, 96];
  if (!p.grounded) return [(p.vy < -280 ? 0 : p.vy < -80 ? 1 : p.vy < 60 ? 2 : p.vy < 300 ? 4 : 5) * 32, 96];
  if (p.landed > 0) return [Math.min(3, Math.floor((1 - p.landed / 0.1) * 4)) * 32, 128];
  return Math.abs(p.vx) > 20 ? [0, 64] : [0, 0];
}
function feetOnScreen(g) {
  const p = g.player,
    [sx, sy] = frameOf(p),
    f = drawnFeet(sx, sy, p.direction),
    c = cx(g);
  return { bottom: feet(g) + f.bottom, left: c + f.left, right: c + f.right };
}

test("B12: ledge assist and lip contact - zero 'looked landed but fell', never lands when clearly short", (t) => {
  let runs = 0,
    lookedButFell = 0,
    shortLandings = 0,
    assisted = 0,
    restTicks = 0;
  const judge = (g, lipX, lipTop, ledgeSide, steps, input) => {
    // ledgeSide: +1 = the ledge is to the right of lipX, -1 = to the left.
    let looked = false,
      stood = false,
      landedAt = null,
      rest = 0;
    for (let i = 0; i < steps && g.phase === "playing"; i++) {
      const before = g.player.grounded;
      ticks(g, 1, input(g, i));
      const f = feetOnScreen(g),
        overlap = ledgeSide > 0 ? f.right - lipX : lipX - f.left,
        onTop = Math.abs(feet(g) - lipTop) < 0.5;
      if (g.player.corner) rest++;
      else if (rest) (restTicks = Math.max(restTicks, rest)), (rest = 0);
      if (g.player.vy >= 0 && Math.abs(f.bottom - lipTop) <= 2 && overlap >= 2) looked = true;
      // Stood on it at or after the drawn feet touched it (walking back off
      // afterwards, when holding away, is the player's choice).
      if (looked && g.player.grounded && onTop && (ledgeSide > 0 ? cx(g) > lipX - 30 : cx(g) < lipX + 30)) stood = true;
      if (!before && g.player.grounded && onTop && landedAt === null) landedAt = overlap;
      if (events(g, "assist").length) assisted++;
    }
    runs++;
    if (looked && !stood) lookedButFell++;
    if (landedAt !== null && landedAt < -2) shortLandings++;
  };
  // (1) Face lips: 1-1's 4-tile wall (col 71, top y = 320) met from the left
  // at every height from 20 px above to 30 px below the lip, three speeds,
  // five vertical speeds.
  for (let d = -20; d <= 30; d += 1)
    for (const vx of [120, 240, 330])
      for (const vy of [-120, -40, 0, 150, 400]) {
        const g = noCards(fresh("1-1"));
        place(g, 71 * T - 24, 10 * T + d, { grounded: false, vx, vy, jumps: 1, airJumped: true, coyote: 0, direction: 1 });
        judge(g, 71 * T, 10 * T, 1, 50, () => ({ right: true }));
      }
  // (2) Edge lips from above, both sides, top y = 384 with open floor 2 tiles
  // below: 1-1's step left edge (x = 1472, ledge to the right) and the home
  // cliff's right edge (x = 416, ledge to the left). Every offset, holding
  // toward the ledge, letting go, or holding away.
  for (const side of [1, -1])
    for (let off = -24; off <= 30; off += 1)
      for (const hold of ["toward", "none", "away"])
        for (const vx of [0, 150, 330]) {
          const lipX = side > 0 ? 46 * T : 13 * T,
            g = noCards(fresh("1-1")),
            dir = side; // moving toward the ledge
          place(g, lipX - side * off, 12 * T - 40, { grounded: false, vx: dir * vx, vy: 60, jumps: 1, airJumped: true, coyote: 0, direction: dir });
          const input = hold === "toward" ? { [side > 0 ? "right" : "left"]: true } : hold === "away" ? { [side > 0 ? "left" : "right"]: true } : {};
          judge(g, lipX, 12 * T, side, 90, () => input);
        }
  // (3) Walking off the home cliff's edge (x = 416) at every speed: never
  // standing with the drawn feet past the edge.
  let airStand = 0;
  for (const speed of [20, 60, 120, 330]) {
    const g = noCards(fresh("1-1"));
    place(g, 13 * T - 30, 12 * T, { vx: speed, direction: 1 });
    let rest = 0;
    for (let i = 0; i < 90; i++) {
      ticks(g, 1, speed < 330 ? {} : { right: true });
      g.player.vx = Math.max(g.player.vx, speed); // creep at a fixed speed
      const f = feetOnScreen(g);
      if (g.player.grounded && Math.abs(feet(g) - 12 * T) < 0.5 && f.left > 13 * T + 2) airStand++;
      rest = g.player.corner ? rest + 1 : 0;
      restTicks = Math.max(restTicks, rest);
    }
  }
  report(t, "B12 sweep", { runs, lookedLandedButFell: lookedButFell, landedWhileClearlyShort: shortLandings, standingOnAirTicks: airStand, maxLipRestTicks: restTicks, assistTicks: assisted });
  assert.equal(lookedButFell, 0);
  assert.equal(shortLandings, 0);
  assert.equal(airStand, 0);
  assert.ok(restTicks <= 4, "a lip rest lasts <= 4 ticks");
  assert.ok(W.ledgeAssist < T && 93 + W.ledgeAssist < 4 * T && 175 + W.ledgeAssist < 6 * T, "the assist never creates a climb");
});

test("B13: air resources refresh only by the documented rules (fuzzed inputs and every route)", (t) => {
  // Rules: landing restores the air jump and the dash; a stomp/bounce
  // restores both; refill orbs, smashes, knocks and DASH GET restore the dash
  // only; nothing else does (slabs, swaps, lip rests, coyote).
  let segments = 0;
  const check = (g, label) => {
    let air = 0,
      dash = 0,
      airJumps = 0,
      dashes = 0;
    return () => {
      const p = g.player;
      for (const e of g.events.filter((e) => e.id > (check.last ?? 0))) {
        if (e.type === "airjump") airJumps++;
        if (e.type === "dash" && e.air) dashes++;
        if (["stomp", "bounce"].includes(e.type)) (air = airJumps), (dash = dashes);
        if (e.type === "land") {
          // (a landing and a buffered jump can share one tick)
          if (airJumps || dashes) segments++;
          (air = airJumps = 0), (dash = dashes = 0);
        }
        if (e.type === "refill" || e.type === "get") dash = dashes; // DASH GET grants its first charge
      }
      check.last = g.eventId;
      assert.ok(airJumps - air <= 1, `${label}: two air jumps in one airtime`);
      assert.ok(dashes - dash <= 1, `${label}: two air dashes without a refill`);
      if (p.grounded) (air = airJumps = 0), (dash = dashes = 0);
    };
  };
  for (const id of LEVEL_IDS)
    for (let seed = 1; seed <= 3; seed++) {
      const g = noCards(fresh(id));
      g.dashUnlocked = true;
      g.unlocked.white = g.unlocked.green = true;
      check.last = g.eventId;
      const step = check(g, `${id} seed ${seed}`);
      let rnd = seed * 7919;
      const random = () => (rnd = (rnd * 16807) % 2147483647) / 2147483647;
      let held = {};
      for (let i = 0; i < 120 * 20 && g.phase === "playing"; i++) {
        if (random() < 0.05) held = random() < 0.5 ? { right: true } : random() < 0.3 ? { left: true } : {};
        const input = { ...held, jump: random() < 0.06, jumpReleased: random() < 0.04, dash: random() < 0.03, color: random() < 0.02 ? (random() < 0.5 ? "white" : "green") : undefined };
        M.update(g, M.TICK, input);
        step();
      }
    }
  for (const id of LEVEL_IDS)
    for (const kind of ["baseline", "mastery"]) {
      const g = fresh(id);
      check.last = g.eventId;
      const step = check(g, `${id} ${kind}`);
      for (const [s, input] of ROUTES[id][kind])
        for (let i = 0, n = Math.max(1, Math.round(s * 120)); i < n; i++) M.update(g, M.TICK, i ? { left: input.left, right: input.right } : input), step();
    }
  report(t, "B13 airtimes with air actions checked (fuzz + routes)", segments);
  assert.ok(segments > 200);
});

test("B14: the dash - fixed distance and duration, short freeze, refills by rule, state on Rubik", (t) => {
  const run = (setup) => {
    const g = glade(6 * T + setup.offset);
    g.dashUnlocked = true;
    if (setup.air) Object.assign(g.player, { grounded: false, y: g.player.y - 60, vy: 0 });
    Object.assign(g.player, { vx: setup.vx });
    const x0 = g.player.x;
    ticks(g, 1, { dash: true, right: true });
    let n = 1,
      frozen = 0;
    while (g.player.dashTime > 0 && n < 60) {
      if (g.hitstop > 0) frozen++;
      ticks(g, 1, { right: true }), n++;
    }
    return { dist: g.player.x - x0, ticks: n, frozen };
  };
  const all = [];
  for (const offset of [0, 0.3, 7.7, 15.1])
    for (const vx of [0, 150, 330]) for (const air of [false, true]) all.push(run({ offset, vx, air }));
  const dists = all.map((r) => r.dist);
  const spread = Math.max(...dists) - Math.min(...dists);
  report(t, "B14 dash distance (px), spread over start subpixel/speed/ground-air, burst ticks, freeze ticks", { dist: +dists[0].toFixed(1), spread: +spread.toFixed(3), ticks: all[0].ticks, freeze: Math.round(W.dashFreeze * 120) });
  assert.ok(spread < 0.01, "every dash covers the same distance");
  assert.ok(Math.round(W.dashFreeze * 120) <= 4, "freeze <= 4 ticks (33 ms)");
  // The spent charge is drawn on Rubik (game.mjs: the Dim sheet in the air,
  // the Flash sheet on a refill), not only in the HUD.
  const src = readFileSync(path.join(demo, "game.mjs"), "utf8");
  assert.match(src, /p\.dashCharge <= 0 && !p\.grounded && p\.dashTime <= 0\) key = p\.color \+ "Dim"/);
  assert.match(src, /fx\.refill > 0\) key = p\.color \+ "Flash"/);
});

// ====================================================== C. collision fidelity
test("C1: the feet support matches the drawn feet within 2 px in every standing, landing and falling frame", (t) => {
  const frames = { idle: [0, [0, 1]], run: [64, [0, 1, 2, 3]], air: [96, [0, 1, 2, 3, 4, 5]], land: [128, [0, 1, 2, 3]], dash: [32, [0, 1, 2, 3, 4, 5]], storm: [160, [2]], stormTo: [192, [0]] };
  const rows = [];
  for (const [name, [sy, list]] of Object.entries(frames))
    for (const f of list) {
      const d = drawnFeet(f * 32, sy, 1);
      rows.push({ frame: `${name}${f}`, bottom: d.bottom, feet: `${d.left}..${d.right}`, dev: Math.max(Math.abs(d.left + M.PLAYER.foot), Math.abs(d.right - M.PLAYER.foot)) });
    }
  report(t, "C1 per frame: feet line offset, drawn feet span, max deviation from the +-11 px support", rows.map((r) => `${r.frame} ${r.bottom} [${r.feet}] ${r.dev}`).join("; "));
  // Contact frames: standing, landing and every falling/apex frame. The
  // exceptions are drawn strides (run1: both feet 4 px up; run3: a narrow
  // passing stance), the takeoff frame air0 (rising fast, never touches a
  // lip) and the dash frames (gravity-free, never land or perch).
  const contact = rows.filter((r) => !["run1", "run3", "air0"].includes(r.frame) && !r.frame.startsWith("dash"));
  for (const r of contact) {
    assert.ok(Math.abs(r.bottom) <= 2, `${r.frame} feet line ${r.bottom}`);
    assert.ok(r.dev <= 2, `${r.frame} feet span off by ${r.dev}`);
  }
  // The hurtbox (40 x 52) sits inside the drawn body in every frame.
  for (const [name, [sy, list]] of Object.entries(frames))
    for (const f of list) {
      let x0 = 99, x1 = -1, y0 = 99;
      for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) if (sheet.alpha(f * 32 + x, sy + y) > 0) (x0 = Math.min(x0, x)), (x1 = Math.max(x1, x)), (y0 = Math.min(y0, y));
      assert.ok(-33 + 2 * x0 <= -M.PLAYER.w / 2 && -33 + 2 * (x1 + 1) >= M.PLAYER.w / 2, `${name}${f}: box inside the art`);
      assert.ok(-64 + 2 * y0 <= -M.PLAYER.h, `${name}${f}: head inside the art`);
    }
});

test("C2: hazard colliders match the drawn hazards; every generous shrink is measured", (t) => {
  const sheets = { green: ["inimigo_verde.png", 86, 67, 51, 64], red: ["inimigo3-Sheet.png", 110, 86, 53, 68] },
    out = {};
  for (const [kind, [file, cw, ch, ox, oy]] of Object.entries(sheets)) {
    const png = readPng(path.join(demo, "assets", file));
    // Lunge frames 4-6 (the only frames in which the spear kills): the spear
    // is what reaches far in front of the card (x < -60 facing left; the
    // card's arms and ears stay within 20 px of its body).
    let tip = 0,
      top = 0,
      bottom = -999;
    for (const col of [4, 5, 6])
      for (let y = 0; y < ch; y++)
        for (let x = 0; x < cw; x++) {
          if (png.alpha(col * cw + x, y) <= 0) continue;
          const wx = -ox * 2 + 2 * x,
            wy = -oy * 2 + 2 * y;
          if (wx + 2 <= -60) (tip = Math.min(tip, wx)), (top = Math.min(top, wy)), (bottom = Math.max(bottom, wy + 2));
        }
    // Card body in the idle frame (row 2): the card rectangle's columns.
    let bx0 = 999, bx1 = -999;
    for (let y = 0; y < ch; y++) {
      let run = 0;
      for (let x = 0; x < cw; x++) {
        run = png.alpha(x, 2 * ch + y) > 0 ? run + 1 : 0;
        if (run >= 24) (bx0 = Math.min(bx0, -ox * 2 + 2 * (x - run + 1))), (bx1 = Math.max(bx1, -ox * 2 + 2 * (x + 1)));
      }
    }
    const [low, high] = M.GUARD.spearBand[kind],
      reach = M.GUARD.w / 2 + M.GUARD.spearReach[kind];
    out[kind] = { spearDrawn: `${-bottom}..${-top} px up, tip ${-tip} px`, spearBox: `${low}..${high} px up, tip ${reach} px`, bodyDrawn: `${bx0}..${bx1}`, bodyBox: `${-M.GUARD.w / 2}..${M.GUARD.w / 2}` };
    assert.ok(Math.abs(-top - high) <= 2, `${kind}: spear top ${-top} vs ${high}`);
    assert.ok(Math.abs(-bottom - low) <= 2, `${kind}: spear bottom ${-bottom} vs ${low}`);
    assert.ok(reach <= -tip, `${kind}: the spear box never reaches past the drawn tip`);
    assert.ok(-tip - reach <= 2, `${kind}: the hit shape is the drawn spear within 2 px (tip ${-tip}, box ${reach})`);
    assert.ok(M.GUARD.w / 2 <= -bx0 && M.GUARD.w / 2 <= bx1, `${kind}: the body box sits inside the drawn card`);
  }
  // Water kills 16 px under its row top; the drawn surface line is at +4..6.
  out.water = "drawn surface y = row top + 4..6 px; death when the feet pass row top + 16 (10 px generous)";
  report(t, "C2", out);
});

test("C3: no tunnelling - the box never overlaps a solid tile, at every max speed, on every route and in a fuzz", (t) => {
  const inside = (g) => {
    const p = g.player,
      e = 0.01;
    for (let row = Math.floor((p.y + e) / T); row <= Math.floor((p.y + p.h - e) / T); row++)
      for (let col = Math.floor((p.x + e) / T); col <= Math.floor((p.x + p.w - e) / T); col++) if (M.blocked(g, col, row)) return `${col},${row}`;
    return null;
  };
  let checked = 0;
  for (const id of LEVEL_IDS)
    for (const kind of ["baseline", "mastery"]) {
      const g = fresh(id);
      for (const [s, input] of ROUTES[id][kind])
        for (let i = 0, n = Math.max(1, Math.round(s * 120)); i < n; i++) {
          M.update(g, M.TICK, i ? { left: input.left, right: input.right } : input);
          if (g.phase === "playing") assert.equal(inside(g), null, `${id} ${kind} t=${g.time.toFixed(2)}`), checked++;
        }
    }
  // Fuzz: random free spots, the largest speeds in the game (dash 850,
  // fall cap 760, held bounce 520, aware knock 440), random inputs.
  let rnd = 12345;
  const random = () => (rnd = (rnd * 16807) % 2147483647) / 2147483647;
  for (let n = 0; n < 3000; n++) {
    const id = LEVEL_IDS[n % LEVEL_IDS.length],
      g = noCards(fresh(id));
    g.dashUnlocked = true;
    const x = random() * (g.level.width - 80) + 20,
      y = random() * (B.WATER_ROW * T - 120) + 20;
    Object.assign(g.player, { x, y, vx: (random() * 2 - 1) * 850, vy: random() * 1280 - 520, grounded: false, grace: 0, dashCharge: 1 });
    if (inside(g)) continue;
    for (let i = 0; i < 40 && g.phase === "playing"; i++) {
      M.update(g, M.TICK, { right: random() < 0.5, left: random() < 0.3, jump: random() < 0.1, dash: random() < 0.1 });
      assert.equal(inside(g), null, `${id} fuzz ${n}`);
      checked++;
    }
  }
  report(t, "C3 ticks checked with the box never inside a solid", checked);
  assert.ok(W.dashSpeed / 120 < M.PLAYER.w && W.maxFall / 120 < T, "per-tick moves are far below a tile");
});

test("C4: contact rules - hearts: only a strike, a body and water cost one; only water, the last heart and a catch end the try", (t) => {
  const src = readFileSync(path.join(demo, "model.mjs"), "utf8");
  const kills = [...src.matchAll(/die\(g, "(\w+)"\)/g)].map((m) => m[1]);
  // "caught" is not a hazard: in a level with `caught` (only 1-3), a card's
  // "!" sends Rubik back to the checkpoint. No contact or hitbox decides it.
  assert.deepEqual([...new Set(kills)].sort(), ["caught", "water"]);
  assert.match(src, /if \(g\.level\.caught\) die\(g, "caught"\);/);
  assert.deepEqual(LEVELS.filter((l) => l.caught).map((l) => l.id), ["1-3"]);
  // Every heart lost goes through one function with three sources.
  const sources = [...src.matchAll(/hurt\(g, "(\w+)"/g)].map((m) => m[1]);
  assert.deepEqual([...new Set(sources)].sort(), ["bump", "spear"]);
  assert.match(src, /function fall\(g\)/);
  report(t, "C4 heart sources", "spear (strike frames only), body bump, water; the last heart is a death; 1-3 sends a spotted Rubik back (caught)");
});

// ================================================ D. expression and ceiling
/** A card from 1-2 isolated on its own floor: `face` = which way it looks. */
function cardDrop(dx, { face = 1, held = false, vy = 160, from = -1 } = {}) {
  const g = fresh("1-2"),
    c = g.guards.find((x) => x.id === "wall");
  for (const other of g.guards) if (other !== c) other.state = "away";
  Object.assign(c, { x: 44 * T, dir: face, state: "calm", turning: 0, turnClock: 0, pace: 0, sideX: from });
  c.min = c.max = c.x;
  place(g, c.x + dx, c.floor - M.GUARD.h - 60, { grounded: false, vy, jumpHeld: held, jumps: held ? 1 : 0 });
  let top = Infinity;
  for (let i = 0; i < 160 && g.phase === "playing"; i++) {
    ticks(g, 1);
    if (g.stomps + g.bounces) top = Math.min(top, feet(g));
  }
  return { g, c, bounce: c.floor - top };
}
test("D1: optional techniques measurably change outcomes", (t) => {
  // (1) Dash-jump carry: jump during a ground dash.
  const flight = (dashJump) => {
    const g = glade(5 * T);
    g.dashUnlocked = true;
    ticks(g, 24, { right: true });
    if (dashJump) ticks(g, 1, { right: true, dash: true }), ticks(g, 10, { right: true });
    ticks(g, 1, { right: true, jump: true });
    const x0 = g.player.x;
    for (let i = 0; i < 240 && !(g.player.grounded && i > 5); i++) ticks(g, 1, { right: true });
    return g.player.x - x0;
  };
  const plain = flight(false),
    carried = flight(true);
  // (2) Hold-for-higher stomp.
  const high = cardDrop(-6, { held: true }).bounce,
    hop = cardDrop(-6).bounce;
  // (3) White's air jump saved for the fall: the falling speed resets, so
  // it reaches further than an air jump at the apex (1-4's 20-tile rule).
  const reach = (delayAfterApex) => {
    const g = glade(5 * T);
    g.player.color = "white";
    ticks(g, 24, { right: true });
    ticks(g, 1, { right: true, jump: true });
    while (g.player.vy < 0) ticks(g, 1, { right: true });
    ticks(g, delayAfterApex, { right: true });
    ticks(g, 1, { right: true, jump: true });
    const x0 = 5 * T;
    for (let i = 0; i < 240 && !g.player.grounded; i++) ticks(g, 1, { right: true });
    return g.player.x - x0;
  };
  const atApex = reach(0),
    saved = Math.max(...[10, 20, 30, 40].map(reach));
  report(t, "D1 dash-jump: airborne distance plain / carried (px)", [+plain.toFixed(0), +carried.toFixed(0)]);
  report(t, "D1 stomp bounce over the card's floor: tap / held (px)", [+hop.toFixed(0), +high.toFixed(0)]);
  report(t, "D1 white air jump at the apex / saved for the fall: distance (px)", [+atApex.toFixed(0), +saved.toFixed(0)]);
  assert.ok(carried > plain + 20, "the dash-jump carries further");
  assert.ok(high > hop + 40, "holding jump bounces higher");
  assert.ok(saved > atApex + 20, "a saved air jump goes further");
});
test("D2: skill gradient - expert lines vs the guided baselines (not required to finish)", (t) => {
  const out = {};
  for (const id of Object.keys(EXPERT)) {
    const pl = new Planner(id);
    EXPERT[id](pl);
    const route = pl.route(),
      g = replay(id, route),
      base = replay(id, ROUTES[id].baseline);
    assert.equal(g.phase, "won", `${id} expert line wins`);
    assert.equal(g.deaths, 0);
    const [a, b] = g.stolen ? [g.escapeTime, base.escapeTime] : [g.finishTime, base.finishTime];
    out[id] = { measure: g.stolen ? "escape" : "level", expert: +a.toFixed(2), baseline: +b.toFixed(2), better: `${(((b - a) / b) * 100).toFixed(1)}%` };
    assert.ok(a < b, `${id}: the expert line is faster`);
  }
  report(t, "D2 expert vs baseline (s)", out);
});
test("D3: small mistakes have readable recoveries", (t) => {
  // A running jump at 1-1's pool (from its edge, over the stump) that falls
  // short of the 4-tile bank: the air jump rescues it across a wide window.
  let rescues = 0;
  for (let delay = 0; delay < 60; delay++) {
    const g = noCards(fresh("1-1"));
    place(g, 109 * T + 8, 14 * T, { vx: W.speed });
    ticks(g, 1, { right: true, jump: true });
    ticks(g, delay, { right: true });
    ticks(g, 1, { right: true, jump: true });
    for (let i = 0; i < 200 && g.phase === "playing" && !(g.player.grounded && feet(g) <= 10 * T + 1); i++) ticks(g, 1, { right: true });
    if (g.phase === "playing" && feet(g) <= 10 * T + 1) rescues++;
  }
  // Landing at a card's face is a stomp (it used to be a "pop" off a raised
  // spear); being seen never kills.
  const front = cardDrop(30, { face: 1, from: 1 });
  report(t, "D3 air-jump rescue window over 1-1's first water (ms of air-jump timing that still lands on the bank)", msOf(rescues));
  report(t, "D3 landing at a card's face", `${front.g.stomps} stomp, ${front.g.hits} hits, ${front.g.deaths} deaths`);
  assert.ok(msOf(rescues) >= 120, "at least 120 ms of rescue timings");
  assert.equal(front.g.stomps, 1);
  assert.equal(front.g.hits + front.g.deaths, 0);
});

// ================================================= E. feedback, readability
test("E1-E2: every movement action has a sound and a visual; resources are drawn on Rubik", (t) => {
  const src = readFileSync(path.join(demo, "game.mjs"), "utf8"),
    sounds = src.slice(src.indexOf("const SOUNDS = {"), src.indexOf("function play(name)")),
    handlers = src.slice(src.indexOf("function handleEvents()"), src.indexOf("function updateFx("));
  // Movement and combat events (the combat redesign retired "spike"; hurt,
  // heal, fall, the enemy telegraph/strike and the stomp's outcomes joined).
  const actions = ["jump", "airjump", "dashjump", "land", "dash", "stomp", "bounce", "bump", "swap", "refill", "knock", "smash", "hurt", "heal", "fall", "defeat", "daze", "chain", "windup", "strike", "bonk"];
  for (const type of actions) {
    assert.match(sounds, new RegExp(`\\n  ${type}: \\[\\[`), `${type}: a sound`);
    assert.match(handlers, new RegExp(`case "${type}":`), `${type}: a visual`);
  }
  // Resources on the character: form = the sheet, dash charge = the Dim /
  // Flash sheets, white's unspent air jump = two pips under the feet.
  assert.match(src, /key = p\.color \+ "Dim"/);
  assert.match(src, /p\.color === "white" && !p\.grounded && !p\.airJumped/);
  report(t, "E1/E2", `${actions.length} movement and combat events with a sound and a visual; form, dash and air jump drawn on Rubik`);
});

// ======================================================= F. CRH specifics
test("F: stomp windows, respawn runway and the gap rules after tuning", (t) => {
  // Stomp window: dropping on a calm card from behind (it faces away) vs at
  // its face. Offsets are Rubik's centre relative to the card's.
  // (A card facing right: behind = its left. Facing left, Rubik coming
  // from its left = its face, as far as 12 px past its centre.)
  const behind = [],
    front = [];
  for (let dx = -70; dx <= 70; dx += 2) {
    const b = cardDrop(dx, { face: 1, from: -1 });
    if (b.g.stomps) behind.push(dx);
    if (dx > 12) continue;
    const f = cardDrop(dx, { face: -1, from: -1 });
    if (f.g.stomps) front.push(dx);
  }
  // Respawn runway: how far Rubik can walk from every checkpoint, the way
  // the level continues, before the first water column (the only floor
  // hazard; cards are held still and no marker is inside a cone).
  const runway = {};
  for (const level of LEVELS)
    for (const cp of level.checkpoints) {
      const dir = cp.dir ?? 1;
      let n = 0;
      while (n < 640 && level.map[B.WATER_ROW][Math.floor((cp.x + dir * n) / T)] !== "~") n += 2;
      runway[`${level.id}:${cp.id}`] = n;
    }
  const minRunway = Math.min(...Object.values(runway));
  report(t, "F stomp window from behind: centre offsets that stomp (px)", `${behind[0]}..${behind[behind.length - 1]} (${behind.length * 2} px wide)`);
  report(t, "F stomp window at a calm card's face (came from its front)", front.length ? `${front[0]}..${front[front.length - 1]}` : "none");
  report(t, "F shortest respawn runway (px of floor ahead)", minRunway);
  report(t, "F runways", runway);
  assert.ok(behind.length * 2 >= 64, "the stomp window from behind is at least the drawn card's width");
  assert.ok(front.length * 2 >= 64, "from the front the window is just as wide (no spear-up rule)");
  // 1-4 late (80 px) is a 4-tile bank between two gaps: the held-lock means
  // nothing moves until a fresh press, and 80 px is 0.24 s of running.
  assert.ok(minRunway >= 64, "every respawn has >= 2 tiles before water");
});
test("F: gap envelope after tuning - dash-required gaps still need the dash, white-only ones the double jump", (t) => {
  // A lab level: flat bank, n water tiles, flat bank at the same height.
  // Every takeoff tick around the lip (coyote included), every air-jump and
  // dash delay (3-tick steps); the widest n crossed is the envelope.
  const lab = (n) =>
    B.defineLevel({
      id: "lab", name: "lab", idea: "", cols: 120, kit: { forms: ["white", "green"], start: "green", dash: true }, stickers: [],
      build: ({ ground, water }) => (ground(0, 39, 16), water(40, 39 + n), ground(40 + n, 119, 16)),
      spawn: { x: 64, floor: 16 * T }, checkpoints: [{ id: "s", x: 64, floor: 16 * T }],
    });
  const crosses = (n, form, air, dash) => {
    const level = lab(n);
    for (let t0 = -6; t0 <= 36; t0 += 2)
      for (const a of air ? Array.from({ length: 22 }, (_, k) => 6 + k * 3) : [null])
        for (const d of dash ? Array.from({ length: 20 }, (_, k) => k * 3) : [null]) {
          const g = M.startGame(M.createGame(level));
          g.dashUnlocked = true;
          Object.assign(g.player, { x: 40 * T - 300, vx: W.speed, color: form, grace: 0 });
          let jumped = -1;
          for (let i = 0; i < 400 && g.phase === "playing"; i++) {
            const input = { right: true };
            if (jumped < 0 && 40 * T - cx(g) <= t0 * 2.75) (input.jump = true), (jumped = i);
            if (jumped >= 0 && a !== null && i === jumped + a) input.jump = true;
            if (jumped >= 0 && d !== null && i === jumped + d) input.dash = true;
            M.update(g, M.TICK, input);
            if (g.player.grounded && cx(g) > (40 + n) * T && Math.abs(feet(g) - 16 * T) < 1) return true;
          }
        }
    return false;
  };
  const widest = (form, air, dash) => {
    let n = 6;
    while (n < 30 && crosses(n + 1, form, air, dash)) n++;
    return n;
  };
  const env = { greenJump: widest("green", false, false), greenJumpDash: widest("green", false, true), whiteDouble: widest("white", true, false), whiteDoubleDash: widest("white", true, true) };
  // Before this tuning (box support, 1.15x fall) the same sweep gave the same
  // 10 / 15 / 17 / 20: the feet support and the coyote window measured from the
  // feet keep the takeoff point, and the faster fall costs less than a tile.
  report(t, "F gap envelope, water tiles bank to bank: green jump / green jump+dash / white double / white double+dash", env);
  assert.ok(env.greenJump < 12, "1-4's 12/14-tile gaps need the dash as green");
  assert.ok(env.greenJumpDash >= 14, "...and the dash crosses them");
  assert.ok(env.whiteDouble < 20, "the 20-tile twist gaps need the dash as white too");
});
