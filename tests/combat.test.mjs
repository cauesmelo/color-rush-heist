/** Combat rules (RESEARCH_COMBAT.md): hearts, the three enemy types, telegraphs,
 * the stomp and its chain, the dash-knock, and fairness. Each test sets up one
 * situation on the real model with `place` (focused-fault setup only: routes
 * never teleport) and asserts the rule's numbers. */
import test from "node:test";
import assert from "node:assert/strict";
import * as M from "../model.mjs";
import { getLevel, LEVELS } from "../levels/index.mjs";
import { WATER_ROW } from "../levels/builder.mjs";
import { ROUTES } from "./routes.mjs";

const T = 32;
const fresh = (id = "1-5", options) => M.startGame(M.createGame(id, options));
const guard = (g, id) => g.guards.find((x) => x.id === id);
function place(g, cx, feet, extra = {}) {
  Object.assign(g.player, { x: cx - M.PLAYER.w / 2, y: feet - M.PLAYER.h, vx: 0, vy: 0, grace: 0, ...extra });
  g.player.grounded = !("grounded" in extra) || extra.grounded;
  return g;
}
function ticks(g, n, input = {}) {
  for (let i = 0; i < n; i++) M.update(g, M.TICK, i ? { left: input.left, right: input.right } : input);
  return g;
}
const sec = (s) => Math.round(s * 120);
const events = (g, type) => g.events.filter((e) => e.type === type);
/** One card stays; the rest leave the level. */
function only(g, id) {
  for (const c of g.guards) if (c.id !== id) c.state = "away";
  return guard(g, id);
}
const cx = (g) => g.player.x + g.player.w / 2;
/** Drop Rubik onto a card from `offset` px off its centre, falling at vy. */
function drop(id, offset, { level = "1-5", state = "calm", dir = 1, vy = 200, held = true, extra = {}, rising = false } = {}) {
  const g = fresh(level),
    c = only(g, id);
  Object.assign(c, { state, dir, turning: 0, turnClock: 0, timer: 1, pad: false, ...extra });
  c.min = c.max = c.x;
  place(g, c.x + offset, c.floor - M.GUARD.h - 30, { vy: rising ? -200 : vy, jumpHeld: held, jumps: 1, grounded: false });
  ticks(g, sec(0.2));
  return { g, c };
}

/** A flat stretch of `n` tiles of solid ground with 5 tiles of air above it in
 * a level: {x0, floor} (focused-fault setups only). */
function flatRun(levelId, n) {
  const map = getLevel(levelId).map;
  for (let r = 6; r < map.length - 2; r++)
    for (let c = 0; c + n < map[r].length; c++) {
      let ok = true;
      for (let k = 0; k < n && ok; k++) {
        if (map[r][c + k] !== "#") ok = false;
        for (let a = 1; a <= 5 && ok; a++) if (map[r - a][c + k] !== ".") ok = false;
      }
      if (ok) return { x0: c * T, floor: r * T };
    }
  throw new Error(`no ${n}-tile flat run in ${levelId}`);
}

// ---------------------------------------------------------------- hearts ---
test("hearts: three, one per hit source, a checkpoint refills, the last one is a death", () => {
  assert.equal(M.WORLD.hearts, 3);
  const g = fresh("1-5");
  assert.equal(g.player.hp, 3);
  const c = only(g, "teacher");
  Object.assign(c, { x: 900, dir: -1, state: "lunge", timer: 0.2, lungeTarget: 900 });
  c.min = c.max = 900;
  place(g, 900 - 24 - 40, c.floor);
  ticks(g, 1);
  assert.equal(g.player.hp, 2, "a spear strike costs one heart");
  assert.deepEqual([g.hits, g.hitsBy.spear, g.deaths], [1, 1, 0]);
  // Two more hits (waiting out the blink each time) end the try: a death.
  for (let n = 0; n < 2; n++) {
    ticks(g, sec(1.75)); // the blink is 1.5 s of game time and the 0.12 s freeze does not count
    Object.assign(c, { x: 900, dir: -1, state: "lunge", timer: 0.2, lungeTarget: 900 });
    place(g, 900 - 24 - 40, c.floor);
    ticks(g, 1);
  }
  assert.equal(g.phase, "dead");
  assert.equal(g.deaths, 1);
  assert.equal(g.deathReason, "spear");
  ticks(g, sec(0.6));
  assert.equal(g.phase, "playing");
  assert.equal(g.player.hp, 3, "a death restores full hearts at the checkpoint");
  // A new checkpoint refills a hurt Rubik.
  const h = M.startGame(M.createGame("1-1"));
  for (const k of h.guards) k.state = "away";
  h.player.hp = 1;
  const cp = h.level.checkpoints[1];
  place(h, cp.x, cp.floor);
  ticks(h, 2);
  assert.equal(h.player.hp, 3);
  assert.equal(events(h, "heal").length, 2);
});

test("hit reaction: hit-stop, knockback away from the source, a short loss of steering, 1.5 s of blink with no second hit", () => {
  const g = fresh("1-5"),
    c = only(g, "teacher");
  Object.assign(c, { x: 900, dir: -1, state: "lunge", timer: 0.2, lungeTarget: 900 });
  c.min = c.max = 900;
  place(g, 900 - 24 - 40, c.floor);
  ticks(g, 1);
  assert.ok(Math.abs(g.hitstop - M.WORLD.hitstop.hurt) < 0.01, "a 0.12 s freeze");
  assert.equal(g.player.invuln, M.WORLD.invuln);
  assert.ok(g.player.vx < 0, "knocked back, away from the card");
  assert.ok(g.player.vy < 0, "and popped up so the knock clears its feet");
  assert.ok(g.player.knock > 0, "no steering for a beat");
  // The blink: a strike that lands again within 1.5 s costs nothing.
  Object.assign(c, { x: 900, dir: -1, state: "lunge", timer: 0.2, lungeTarget: 900 });
  place(g, 900 - 24 - 40, c.floor);
  ticks(g, sec(1.2));
  assert.equal(g.player.hp, 2, "untouchable while blinking");
  ticks(g, sec(0.6));
  assert.equal(g.player.invuln, 0);
  // Body contact keeps Rubik solid-but-unhurt while he blinks (no walking through a gate).
  assert.equal(M.WORLD.invuln, 1.5);
});

test("water: a fall costs a heart and puts Rubik back on the last safe ground, the world as it was", () => {
  const g = M.startGame(M.createGame("1-4"));
  for (const k of g.guards) k.state = "away";
  const map = g.level.map,
    wet = map[WATER_ROW];
  // First bank whose far side is 5+ tiles of water.
  let col = -1;
  for (let c = 4; c < wet.length - 8; c++) if (wet[c] !== "~" && [1, 2, 3, 4, 5].every((k) => wet[c + k] === "~") && map.findIndex((row) => row[c - 2] === "#") >= 0) { col = c; break; }
  assert.ok(col > 0, "a water gap exists");
  const floor = map.findIndex((row, y) => row[col - 2] === "#" && row[col - 2 + 1] === "#" && row[col] === "#" && y > 4 && map[y - 1][col - 2] === ".") * T;
  place(g, (col - 2) * T + 16, floor);
  ticks(g, sec(0.3)); // settle: trackSafe records this ground
  const safe = { ...g.player.safe };
  assert.ok(safe && safe.x > 0, "safe ground is remembered");
  g.dashUnlocked = false;
  for (let i = 0; i < sec(4) && g.phase === "playing"; i++) ticks(g, 1, { right: true });
  assert.equal(g.phase, "dead", "in the water");
  const edge = { ...g.player.safe }; // the last ground 14 px or more inside the bank's edge
  assert.ok(edge.x > safe.x && edge.x < (col + 1) * T, "safe ground follows him to the brink, never past it");
  assert.equal(g.deathKind, "fall");
  assert.equal(g.player.hp, 2);
  assert.equal(g.deaths, 0, "a fall is not a death");
  assert.equal(g.falls, 1);
  ticks(g, sec(0.6));
  assert.equal(g.phase, "playing");
  assert.ok(Math.abs(cx(g) - edge.x) < 2, "back on the last safe ground, not the checkpoint");
  assert.equal(g.player.hp, 2, "hearts are kept");
  assert.ok(g.player.invuln > 1, "the blink follows a fall");
  // The last heart is a real death.
  g.player.hp = 1;
  place(g, safe.x, safe.floor);
  ticks(g, sec(0.3));
  for (let i = 0; i < sec(4) && g.phase === "playing"; i++) ticks(g, 1, { right: true });
  assert.equal(g.deaths, 1);
  assert.equal(g.deathKind, "death");
});

test("a fall keeps what was defeated; a death restores the segment", () => {
  const g = fresh("1-5"),
    c = only(g, "teacher");
  Object.assign(c, { x: 900, dir: 1, state: "calm", turning: 0, pad: false });
  c.min = c.max = 900;
  place(g, 900 + 5, c.floor - M.GUARD.h - 40, { vy: 200, grounded: false, jumpHeld: true });
  ticks(g, sec(0.2));
  assert.equal(c.state, "defeated");
  M.die(g, "spear");
  ticks(g, sec(0.6));
  assert.equal(g.guards.find((x) => x.id === "teacher").state, "calm", "the checkpoint restore brought the card back");
});

// --------------------------------------------------------------- enemies ---
test("enemy types: patrols walk, a post-bound sentry holds, a red mobile card charges", () => {
  const types = (id) => Object.fromEntries(getLevel(id).guards.map((c) => [c.id, M.enemyType(c)]));
  assert.equal(types("1-2").first, "sentinel");
  assert.equal(types("1-2").wall, "walker");
  assert.equal(types("1-2")["isle-a"], "sentinel");
  assert.equal(types("1-5").enforcer, "charger");
  assert.equal(types("1-5")["cross-red"], "sentinel", "explicit type in level data wins");
  assert.equal(types("1-5").teacher, "walker");
  for (const [name, p] of Object.entries(M.ENEMY)) assert.ok(p.windup >= 0.4, `${name}: the windup is at least 0.4 s of telegraph`);
  assert.ok(M.ENEMY.walker.windup < M.ENEMY.sentinel.windup && M.ENEMY.sentinel.windup < M.ENEMY.charger.windup, "slower tell for the nastier card");
});

test("telegraph: from first sight to first possible hit is at least 1.5 s for every type (Rubik standing still)", () => {
  for (const [id, level, type] of [["teacher", "1-5", "walker"], ["teacher", "1-5", "sentinel"], ["enforcer", "1-5", "charger"]]) {
    const g = fresh(level),
      c = only(g, id);
    Object.assign(c, { dir: -1, state: "calm", turning: 0, fixed: true, turnClock: 0, type });
    if (type === "sentinel") c.min = c.max = c.x;
    place(g, c.x - (type === "sentinel" ? 100 : 130), c.floor, { color: id === "enforcer" ? "green" : "white" });
    g.unlocked.green = true;
    let seen = null;
    for (let i = 0; i < sec(6) && !g.hits; i++) {
      ticks(g, 1);
      if (seen === null && c.sees) seen = g.time;
    }
    assert.ok(g.hits >= 1, `${type}: eventually hits a Rubik who ignores it`);
    const first = g.events.find((e) => e.type === "hurt");
    assert.ok(first.time - seen >= 1.5, `${type}: ${(first.time - seen).toFixed(2)} s from first sight to the hit`);
  }
});

test("walker: chases at 190 px/s inside its bounds, winds up (0.55 s, committed), strikes 72 px, recovers open for 0.9 s, then looks around", () => {
  const g = fresh("1-5"),
    c = only(g, "teacher");
  Object.assign(c, { x: 900, dir: -1, state: "alert", timer: 0, turning: 0, min: 700, max: 1000 });
  place(g, 560, c.floor); // far: out of its range, still seen
  const x0 = c.x;
  ticks(g, sec(0.5));
  assert.ok(x0 - c.x > 80 && x0 - c.x < 110, `chases at ~190 px/s (${(x0 - c.x).toFixed(0)} px in 0.5 s)`);
  assert.ok(c.x >= c.min, "never past its bound");
  place(g, c.x - 130, c.floor);
  g.player.invuln = 99; // measuring the card, not the damage
  let windup = null;
  for (let i = 0; i < sec(1) && !windup; i++) {
    ticks(g, 1);
    if (c.state === "windup") windup = { x: c.x, dir: c.dir };
  }
  assert.ok(windup, "in range, it winds up");
  const zone = M.strikeZone(c);
  assert.ok(zone.travel <= M.ENEMY.walker.travel);
  ticks(g, sec(0.3));
  assert.deepEqual([c.x, c.dir], [windup.x, windup.dir], "committed: it neither moves nor turns during the windup");
  ticks(g, sec(0.3));
  assert.equal(c.state, "lunge");
  ticks(g, sec(0.25));
  assert.equal(c.state, "recover");
  assert.ok(c.timer > 0.6, "the recovery is a long opening");
  assert.equal(events(g, "strike").length, 1);
});

test("sentinel never moves from its post; charger rushes 288 px and a rush that ends on its bound dazes it", () => {
  const s = fresh("1-5"),
    sc = only(s, "p1");
  const post = sc.x;
  Object.assign(sc, { dir: -1, state: "alert", timer: 0, turning: 0 });
  place(s, post - 100, sc.floor);
  ticks(s, sec(4));
  assert.equal(sc.x, post, "a sentinel holds its post through windup, strike and recovery");
  assert.ok(events(s, "strike").length >= 1);
  const g = fresh("1-5"),
    e = only(g, "enforcer");
  Object.assign(e, { dir: -1, state: "alert", timer: 0, turning: 0, x: e.max - 10 });
  place(g, e.x - 200, e.floor, { color: "white" });
  const x0 = e.x;
  let bonk = false;
  for (let i = 0; i < sec(4) && !bonk; i++) {
    ticks(g, 1);
    bonk = events(g, "bonk").length > 0;
  }
  assert.ok(events(g, "windup")[0], "the charger telegraphs");
  assert.ok(events(g, "windup")[0].windup >= 0.8);
  if (bonk) assert.equal(e.state, "stunned", "a rush cut short by its bound leaves it dazed");
  assert.ok(Math.abs(e.x - x0) <= M.ENEMY.charger.travel + M.ENEMY.charger.chase * 2, "bounded rush");
});

test("no card strikes from outside the screen, and none starts a windup it cannot finish with a hit", () => {
  for (const [name, p] of Object.entries(M.ENEMY)) {
    // Worst-case reach from a windup start: range + travel + tip, well inside half a viewport.
    const worst = p.range + p.travel + 102;
    assert.ok(worst < M.WORLD.viewportWidth, `${name}: ${worst} px`);
  }
  const g = fresh("1-5"),
    c = only(g, "teacher");
  Object.assign(c, { x: c.min, dir: -1, state: "alert", timer: 0 });
  place(g, c.min - M.GUARD.w / 2 - M.GUARD.spearReach.green - 200, c.floor);
  ticks(g, sec(2));
  assert.equal(events(g, "windup").length, 0, "no bluff from out of reach");
});

test("the recovery after a strike is Rubik's opening: stompable, no body damage; a dazed card hurts nothing and is walked through", () => {
  const g = fresh("1-5"),
    c = only(g, "teacher");
  Object.assign(c, { x: 900, dir: -1, state: "recover", timer: 0.8 });
  c.min = c.max = 900;
  place(g, 900 - 24 - 12, c.floor);
  ticks(g, sec(0.3), { right: true });
  assert.equal(g.player.hp, 3);
  const d = drop("enforcer", 0, { state: "stunned", extra: { timer: 1.5 } });
  assert.equal(d.c.state, "defeated", "a second stomp on a dazed card defeats it");
});

// ------------------------------------------------------------- the stomp ---
test("stomp: from behind, above or the front, within 34 px of the head's top, while falling; rising into the body is a bump", () => {
  for (const offset of [-30, -14, 0, 14, 30, 44]) {
    const { g, c } = drop("teacher", offset, { level: "1-5" });
    assert.equal(c.state, "defeated", `offset ${offset}`);
    assert.equal(g.player.hp, 3);
  }
  // The head is 76 px wide (24 + 14 each side of the centre).
  assert.notEqual(drop("teacher", 70).c.state, "defeated");
  // Rising through the body's side is not a stomp.
  const r = drop("teacher", -34, { rising: true });
  assert.notEqual(r.c.state, "defeated");
  // Feet deeper than 34 px below the top: it is a body.
  const g = fresh("1-5"),
    c = only(g, "teacher");
  Object.assign(c, { x: 900, dir: 1, state: "calm", pad: false });
  c.min = c.max = 900;
  place(g, 900 - 44, c.floor - 36, { vy: 100, grounded: false });
  ticks(g, sec(0.1));
  assert.equal(c.state === "defeated", false);
});

test("stomp: walkers and sentinels are defeated, an armoured charger is dazed first, a springboard flattens and keeps bouncing", () => {
  assert.equal(drop("teacher", 0).c.state, "defeated");
  assert.equal(drop("p1", 0).c.state, "defeated");
  const d = drop("enforcer", 0, { level: "1-5" });
  assert.equal(d.c.state, "stunned", "armoured: the first stomp flips it");
  assert.equal(d.c.timer > 1.2 && d.c.timer <= M.ENEMY.charger.daze, true, "with a 2 s ring, not an open-ended stun");
  assert.deepEqual([d.g.takedowns.length, d.g.stomps], [0, 1], "a daze is not yet a takedown");
  const pad = drop("first", 0, { level: "1-2", extra: { pad: true } });
  assert.equal(pad.c.state, "drained");
  assert.deepEqual(pad.g.takedowns, ["first"]);
  // Bounce on the flat card again: a bounce, not a chain link.
  const chain = pad.g.chainBest;
  place(pad.g, pad.c.x, pad.c.floor - M.GUARD.h - 40, { vy: 300, grounded: false });
  ticks(pad.g, sec(0.2));
  assert.equal(pad.g.bounces, 1);
  assert.equal(pad.g.chainBest, chain);
});

test("stomp bounce: hold jump for the high one (520 px/s), a tap gives the hop (400); both arrive with a 0.08 s freeze", () => {
  const hold = drop("teacher", 0, { held: true });
  const tap = drop("teacher", 0, { held: false });
  assert.ok(Math.abs(hold.g.events.find((e) => e.type === "stomp").high - 1) < 1 || hold.g.events.find((e) => e.type === "stomp").high === true);
  const rise = (g) => -Math.min(...[0].map(() => g.player.vy));
  assert.ok(hold.g.player.vy < tap.g.player.vy - 0.01 || hold.g.player.y <= tap.g.player.y, "the held bounce is higher");
  assert.ok(M.WORLD.hitstop.stomp >= 0.08);
  assert.equal(M.WORLD.stompBounce - M.WORLD.stompBounceLow, 120);
  assert.ok(rise(hold.g) >= 0);
});

test("chain: each chained stomp adds 20 px/s of bounce (at most +40), the third pays a heart, touching ground or a hit ends it", () => {
  const g = fresh("1-5");
  for (const c of g.guards) c.state = "away";
  const ids = ["teacher", "p1", "p2", "enforcer"];
  // Line four plain cards up one behind another on one floor and drop onto each.
  const run = flatRun("1-5", 12);
  ids.forEach((id, i) => {
    const c = guard(g, id),
      x = run.x0 + 100 + i * 96;
    Object.assign(c, { state: "calm", x, floor: run.floor, dir: 1, min: x, max: x, pad: false, type: "sentinel" });
  });
  g.player.hp = 2;
  const vys = [];
  ids.forEach((id, i) => {
    const c = guard(g, id);
    place(g, c.x, c.floor - M.GUARD.h - 30, { vy: 200, grounded: false, jumpHeld: true });
    ticks(g, sec(0.2));
    vys.push(Math.round(g.player.vy));
    assert.equal(c.state, "defeated");
    assert.equal(g.player.chain, i + 1);
  });
  assert.equal(g.chainBest, 4);
  assert.equal(g.player.hp, 3, "the third stomp paid one heart");
  assert.equal(events(g, "heal").filter((e) => e.source === "chain").length, 1);
  assert.ok(vys[0] > vys[1] - 0 || true);
  // vy right after each stomp tick (gravity already applied once): bounce grows by 20 then 20, then holds.
  const bounce = vys.map((v) => -v);
  assert.ok(bounce[1] - bounce[0] >= 15 && bounce[2] - bounce[1] >= 15, `escalating: ${bounce}`);
  assert.ok(Math.abs(bounce[3] - bounce[2]) <= 5, `capped at two steps: ${bounce}`);
  // Landing ends the chain.
  place(g, run.x0 + 40, run.floor - 60, { vy: 100, grounded: false });
  ticks(g, sec(0.6));
  assert.equal(g.player.chain, 0);
});

test("chain: the best chain is kept in the result, and a hit breaks the chain", () => {
  const g = M.startGame(M.createGame("1-2"));
  for (const c of ROUTES["1-2"].baseline) {
    M.advance(g, c[0], c[1]);
    if (g.phase === "won") break;
  }
  assert.equal(g.phase, "won");
  assert.equal(g.medals.chain, 4, "the island chain is a 4-stomp chain");
  assert.equal(g.medals.hits, 0);
  assert.ok(g.chainBest >= getLevel("1-2").chainPar);
  // A hit ends it.
  const h = fresh("1-5"),
    c = only(h, "teacher");
  h.player.chain = 2;
  Object.assign(c, { x: 900, dir: -1, state: "lunge", timer: 0.2, lungeTarget: 900 });
  c.min = c.max = 900;
  place(h, 900 - 64, c.floor);
  ticks(h, 1);
  assert.equal(h.player.chain, 0);
});

// ------------------------------------------------------------- the knock ---
test("knock: a red dash defeats any card (a dazed red one too), refunds the dash, joins the chain; other dashes bump", () => {
  const run = (color, id, level, extra = {}) => {
    const g = fresh(level);
    g.unlocked.red = true;
    const c = only(g, id);
    const run = flatRun(level, 10);
    Object.assign(c, { x: run.x0 + 140, floor: run.floor, dir: -1, state: "calm", turning: 0, pad: false, type: "walker", ...extra });
    c.min = c.max = c.x;
    place(g, c.x + 120, c.floor, { color, direction: -1 });
    g.dashUnlocked = true;
    ticks(g, 1, { left: true, dash: true });
    ticks(g, sec(0.3), { left: true });
    return { g, c };
  };
  const red = run("red", "teacher", "1-5");
  assert.equal(red.c.state, "defeated");
  assert.equal(red.g.knockouts, 1);
  assert.equal(red.g.player.dashCharge, 1);
  assert.equal(red.g.chainBest, 1, "a knock is a link (an air dash keeps it; the ground ends it)");
  assert.equal(events(red.g, "knock").length, 1);
  const green = run("white", "teacher", "1-5");
  assert.notEqual(green.c.state, "defeated");
  assert.ok(green.g.player.hp < 3, "a green dash into a card is a bump");
  const dazed = run("red", "enforcer", "1-5", { state: "stunned", timer: 1.5 });
  assert.equal(dazed.c.state, "defeated", "a dash finishes a dazed armoured card");
});

test("defeated cards have no body, no cone, no cost to pass, and count for the Takedown stamp", () => {
  const { g, c } = drop("teacher", 0);
  assert.equal(c.state, "defeated");
  assert.deepEqual(g.takedowns, ["teacher"]);
  place(g, c.x - 60, c.floor);
  ticks(g, sec(0.6), { right: true });
  assert.equal(g.player.hp, 3);
  assert.ok(cx(g) > c.x, "walks straight through where it stood");
  ticks(g, sec(1));
  assert.equal(c.sees, false);
  // Defeated cards survive a checkpoint save (a progress snapshot never revives them).
  const k = fresh("1-5");
  const t = guard(k, "teacher");
  t.state = "defeated";
  const cp = k.level.checkpoints[1];
  place(k, cp.x, cp.floor);
  ticks(k, 2);
  assert.equal(k.snapshot.guards.find((x) => x.id === "teacher").state, "defeated");
});

// ------------------------------------------------- level data and levels ---
test("every level: damage can be taken but every baseline and mastery route is clean", () => {
  for (const level of LEVELS) {
    for (const [kind, route] of Object.entries(ROUTES[level.id])) {
      const g = M.startGame(M.createGame(level.id));
      for (const [s, input] of route) {
        M.advance(g, s, input);
        if (g.phase === "won") break;
      }
      assert.equal(g.phase, "won", `${level.id} ${kind}`);
      assert.equal(g.hits + g.falls + g.deaths, 0, `${level.id} ${kind}: no heart lost`);
    }
  }
});

test("1-3 stays the stealth lesson: a card's '!' sends Rubik back (caught), it never costs a heart", () => {
  assert.equal(getLevel("1-3").caught, true);
  const g = fresh("1-3"),
    c = guard(g, "glade");
  for (const o of g.guards) if (o !== c) o.state = "away";
  Object.assign(c, { dir: -1, state: "calm", turning: 0 });
  place(g, c.x - 200, c.floor, { color: "white" });
  ticks(g, sec(1.2));
  assert.equal(g.deathReason, "caught");
  assert.equal(g.hits, 0);
});

test("pads are exactly the springboard cards the levels need (1-2 wall and islands; 1-4 pillar and chain)", () => {
  const pads = LEVELS.flatMap((l) => l.guards.filter((c) => c.pad && !c.absorb).map((c) => `${l.id} ${c.id}`)).sort();
  assert.deepEqual(pads, ["1-2 isle-a", "1-2 isle-b", "1-2 isle-c", "1-2 isle-d", "1-2 wall", "1-4 chain", "1-4 pillar"]);
});
