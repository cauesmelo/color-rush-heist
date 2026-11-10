import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as M from "../model.mjs";
import * as B from "../levels/builder.mjs";
import { LEVELS, LEVEL_IDS, getLevel } from "../levels/index.mjs";
import { ROUTES, BASELINE_ROUTE, MASTERY_ROUTE } from "./routes.mjs";
import { readPng } from "./png.mjs";

const here = path.dirname(fileURLToPath(import.meta.url)),
  demo = path.resolve(here, ".."),
  T = B.TILE;
const fresh = (id = "1-1", options) => M.startGame(M.createGame(id, options));
const guard = (g, id) => g.guards.find((x) => x.id === id);
/** Focused-fault setup only (routes never do this): put Rubik's feet at y. */
function place(g, cx, feet, extra = {}) {
  Object.assign(g.player, { x: cx - M.PLAYER.w / 2, y: feet - M.PLAYER.h, vx: 0, vy: 0, grace: 0, ...extra });
  g.player.grounded = true;
  return g;
}
function ticks(g, n, input = {}) {
  for (let i = 0; i < n; i++) M.update(g, M.TICK, i ? { left: input.left, right: input.right } : input);
  return g;
}
const seconds = (s) => Math.round(s * 120);
function replay(id, route, stop = () => false, options) {
  const g = fresh(id, options);
  for (const [s, input] of route) {
    M.advance(g, s, input);
    if (stop(g)) break;
  }
  return g;
}
/** Like replay, but stops on the exact tick where stop(g) first holds. */
function replayTo(id, route, stop, options) {
  const g = fresh(id, options);
  for (const [s, input] of route) {
    const n = Math.max(1, Math.round(s * 120));
    for (let i = 0; i < n; i++) {
      M.update(g, M.TICK, i === 0 ? input : { left: input.left, right: input.right });
      if (stop(g)) return g;
    }
  }
  return g;
}
const events = (g, type) => g.events.filter((e) => e.type === type);
/** Isolate one card: every other card leaves the level (no body, no cone). */
function only(g, id) {
  for (const other of g.guards) if (other.id !== id) other.state = "away";
  return guard(g, id);
}
const noCards = (g) => {
  for (const c of g.guards) c.state = "away";
  return g;
};
const cx = (g) => g.player.x + g.player.w / 2;
const feet = (g) => g.player.y + g.player.h;

/** Does any of a family of ordinary attempts get Rubik standing on a surface
 * at `top` beyond x = `past`? Each attempt runs from a fresh, card-free game
 * placed at `start` holding right; `attempt(g, i)` returns the input for
 * tick i. Used to prove that a gap or wall needs a given ability. */
function anyReaches(id, { start, form = "white", top, past, dash = false }, attempts) {
  for (const attempt of attempts) {
    const g = noCards(fresh(id));
    g.player.color = form;
    g.dashUnlocked = dash;
    place(g, start.x, start.feet, { vx: start.vx ?? 330, color: form });
    let ok = false;
    for (let i = 0; i < 480 && g.phase === "playing"; i++) {
      ticks(g, 1, { right: true, ...attempt(g, i) });
      if (g.player.grounded && cx(g) > past && Math.abs(feet(g) - top) < 1) {
        ok = true;
        break;
      }
    }
    if (ok) return true;
  }
  return false;
}
/** Jump at every takeoff tick 0..maxTakeoff; white also tries every air-jump
 * delay; `dashAfter` adds a dash that many ticks after the jump. */
function jumpFamily({ maxTakeoff = 40, air = false, dashDelays = [null] } = {}) {
  const out = [];
  for (let t0 = 0; t0 <= maxTakeoff; t0 += 2)
    for (const a of air ? [null, ...Array.from({ length: 40 }, (_, k) => 3 + k * 3)] : [null])
      for (const d of dashDelays)
        out.push((g, i) => ({ jump: i === t0 || (a !== null && i === t0 + a), dash: d !== null && i === t0 + d }));
  return out;
}

// ------------------------------------------------------------ the world ----
test("World 1 is six levels in order, each with 3 stickers, a start face and an ending", () => {
  assert.deepEqual(LEVEL_IDS, ["1-1", "1-2", "1-3", "1-4", "1-5", "1-6"]);
  assert.deepEqual(
    LEVELS.map((l) => l.name),
    ["Home Cliff", "Sleeping Cards", "Hide in Green", "Storm Dash", "Lookouts", "The Vault"],
  );
  for (const level of LEVELS) {
    assert.equal(level.map.length, B.ROWS, level.id);
    for (const row of level.map) assert.equal(row.length, level.cols, level.id);
    assert.ok(level.cols >= 100 && level.cols <= 160, `${level.id}: ${level.cols} columns`);
    assert.deepEqual(level.stickers.map((s) => s.id), [1, 2, 3], level.id);
    assert.ok(level.checkpoints.length >= 2, `${level.id}: a start face and a midpoint`);
    assert.ok(Math.abs(level.checkpoints[0].x - level.spawn.x) < 60, `${level.id}: start face at the spawn`);
    assert.ok(Object.isFrozen(level) && Object.isFrozen(level.map), "levels are frozen data");
    if (level.id === "1-6") assert.ok(level.vault && level.home && !level.goal);
    else assert.ok(level.goal && !level.vault && !level.home, level.id);
  }
});
test("kits: each level always starts with the abilities it was designed for; later ones are absent", () => {
  const expect = {
    "1-1": { forms: ["white"], start: "white", dash: false },
    "1-2": { forms: ["white"], start: "white", dash: false },
    "1-3": { forms: ["white", "green"], start: "green", dash: false },
    "1-4": { forms: ["white", "green"], start: "white", dash: false },
    "1-5": { forms: ["white", "green"], start: "white", dash: true },
    "1-6": { forms: ["white", "green"], start: "white", dash: true },
  };
  for (const id of LEVEL_IDS) {
    const g = fresh(id);
    assert.deepEqual({ ...getLevel(id).kit }, expect[id], id);
    assert.equal(g.player.color, expect[id].start, id);
    assert.deepEqual(g.unlocked, { white: true, green: expect[id].forms.includes("green"), red: false }, id);
    assert.equal(g.dashUnlocked, expect[id].dash, id);
    // Locked forms refuse with a cue; a locked dash does nothing at all.
    if (!g.unlocked.green) {
      assert.equal(M.switchColor(g, "green"), false);
      assert.equal(events(g, "locked").length, 1);
    }
    assert.equal(M.switchColor(g, "red"), false, `${id}: red only at the theft`);
    if (!g.dashUnlocked) {
      assert.equal(M.dash(g, 1), false, `${id}: no dash before DASH GET`);
      assert.equal(events(g, "dash").length, 0);
    }
    // Replays use the same kit even with a full save.
    const replayGame = fresh(id, { owned: [1, 2, 3], hints: { move: "done", dash: "done" } });
    assert.deepEqual(replayGame.unlocked, g.unlocked);
    assert.equal(replayGame.dashUnlocked, g.dashUnlocked);
  }
});
test("GET moments: GREEN at the end of 1-2, DASH at the start of 1-4, RED at the 1-6 theft", () => {
  const expected = { "1-2": "green", "1-4": "dash", "1-6": "red" };
  for (const id of LEVEL_IDS) {
    const g = replay(id, ROUTES[id].baseline);
    assert.deepEqual(g.gets, expected[id] ? [expected[id]] : [], id);
    const get = events(g, "get")[0];
    if (!expected[id]) continue;
    assert.equal(get.ability, expected[id]);
    // Each GET freezes the world for the 1.2 s card and saves its checkpoint.
    const stopAt = replayTo(id, ROUTES[id].baseline, (x) => x.gets.length > 0);
    assert.ok(stopAt.hitstop > 1, `${id}: the GET card freezes the world`);
    assert.equal(getLevel(id).checkpoints[stopAt.checkpointIndex].get, expected[id], `${id}: GET checkpoint saved`);
    // A death right after the GET can't take the ability away.
    M.advance(stopAt, 1.3, {});
    M.die(stopAt, "water");
    ticks(stopAt, seconds(0.5));
    assert.equal(stopAt.phase, "playing");
    if (expected[id] === "dash") assert.equal(stopAt.dashUnlocked, true);
    else assert.equal(stopAt.unlocked[expected[id]], true);
  }
  // 1-4: the swirl's GET happens within the first seconds, on flat ground.
  const d = replayTo("1-4", ROUTES["1-4"].baseline, (x) => x.dashUnlocked);
  assert.ok(d.time < 4, `DASH GET at ${d.time.toFixed(2)} s`);
});

// ---------------------------------------------------------- the routes -----
for (const id of LEVEL_IDS)
  test(`${id}: baseline and mastery routes win deterministically with ordinary inputs`, () => {
    const base = replay(id, ROUTES[id].baseline),
      mastery = replay(id, ROUTES[id].mastery);
    for (const [name, g] of [
      ["baseline", base],
      ["mastery", mastery],
    ]) {
      assert.equal(g.phase, "won", `${id} ${name}`);
      assert.equal(g.deaths, 0, `${id} ${name}`);
      assert.equal(g.levelId, id);
    }
    assert.equal(M.stickerCount(mastery), 3, `${id} mastery takes all three stickers`);
    assert.equal(mastery.medals.fullFace, true);
    assert.equal(base.spotted, 0, `${id} baseline is never spotted`);
    // Same inputs, same result: a second replay is identical.
    const again = replay(id, ROUTES[id].mastery);
    assert.equal(again.time, mastery.time);
    assert.deepEqual(again.stickers, mastery.stickers);
    // QA routes are short; first plays are several times longer.
    assert.ok(base.time < 35, `${id} baseline ${base.time.toFixed(1)} s`);
  });
test("routes are plain JSON [seconds, input] arrays of ordinary actions; legacy names point at 1-6", () => {
  const allowed = new Set(["left", "right", "jump", "jumpReleased", "dash", "color"]);
  for (const id of LEVEL_IDS)
    for (const route of [ROUTES[id].baseline, ROUTES[id].mastery]) {
      assert.deepEqual(JSON.parse(JSON.stringify(route)), route);
      for (const [s, input] of route) {
        assert.ok(s > 0 && s < 10);
        for (const key of Object.keys(input)) assert.ok(allowed.has(key), key);
        if (input.color) assert.ok(["white", "green", "red"].includes(input.color));
      }
    }
  assert.equal(BASELINE_ROUTE, ROUTES["1-6"].baseline);
  assert.equal(MASTERY_ROUTE, ROUTES["1-6"].mastery);
});
test("checkpoints: at most 12 s of baseline route time apart in every level; respawn takes 0.45 s", () => {
  for (const id of LEVEL_IDS) {
    const g = fresh(id),
      saves = [0];
    let last = g.checkpoint;
    for (const [s, input] of ROUTES[id].baseline) {
      M.advance(g, s, input);
      if (g.checkpoint !== last) {
        saves.push(g.time);
        last = g.checkpoint;
      }
    }
    saves.push(g.finishTime);
    for (let i = 1; i < saves.length; i++) assert.ok(saves[i] - saves[i - 1] <= 12, `${id} gap ${i}: ${(saves[i] - saves[i - 1]).toFixed(1)} s`);
  }
  assert.equal(M.WORLD.respawnDelay, 0.45);
});
test("1-6: the Quick par is the baseline escape x 1.5; the baseline earns it", () => {
  const g = replay("1-6", ROUTES["1-6"].baseline);
  assert.ok(Math.abs(g.escapeTime * 1.5 - getLevel("1-6").par) < 1, `escape ${g.escapeTime.toFixed(2)} s, par ${getLevel("1-6").par}`);
  assert.equal(g.medals.quickGetaway, true);
  assert.equal(replay("1-1", ROUTES["1-1"].baseline).medals.quickGetaway, null, "no par outside 1-6");
});

// ------------------------------------------------- 1-1: jump, jump twice ----
test("1-1: the 4-tile wall needs the double jump; the first water bank too; no water before the midpoint", () => {
  const level = getLevel("1-1"),
    wall = { start: { x: 62 * T, feet: 14 * T }, top: 10 * T, past: 71 * T + 8 };
  assert.equal(anyReaches("1-1", wall, jumpFamily({ maxTakeoff: 120 })), false, "a single jump never climbs it");
  assert.equal(anyReaches("1-1", wall, jumpFamily({ maxTakeoff: 120, air: true })), true, "a double jump does");
  const mid = level.checkpoints.find((cp) => cp.id === "mid");
  for (let x = 0; x < Math.floor(mid.x / T); x++) assert.notEqual(level.map[B.WATER_ROW][x], "~", `water at column ${x}`);
});
test("1-1: hints - move after 4 s idle at the start; jump-jump after two short jumps at the wall", () => {
  const idle = fresh("1-1");
  ticks(idle, seconds(4.1));
  assert.equal(idle.hint, "move");
  ticks(idle, seconds(0.5), { right: true });
  assert.equal(idle.hints.move, "done");
  const g = noCards(fresh("1-1"));
  place(g, 66 * T, 14 * T);
  for (let k = 0; k < 3; k++) {
    ticks(g, 1, { jump: true, right: true });
    ticks(g, seconds(0.9), { right: true });
  }
  assert.equal(g.hint, "airjump");
  // Saved hints never come back: a "done" or "shown" bubble is not offered again.
  const again = fresh("1-1", { hints: { move: "done", airjump: "shown" } });
  ticks(again, seconds(4.5));
  assert.equal(again.hint, null);
});

// ------------------------------------------------- 1-2: bounce -> green -----
test("1-2: dozing cards are trampolines that never wake, see, stun or count as stomps", () => {
  const g = fresh("1-2"),
    c = only(g, "isle-a");
  place(g, c.x + 200, c.floor); // standing right beside a dozing card, white
  ticks(g, seconds(3));
  assert.equal(c.state, "asleep");
  assert.equal(g.spotted, 0);
  place(g, c.x, c.floor - M.GUARD.h - 30, { vy: 200 });
  g.player.grounded = false;
  ticks(g, seconds(0.3));
  assert.equal(g.bounces, 1);
  assert.equal(g.stomps, 0);
  assert.equal(c.state, "asleep");
  assert.ok(getLevel("1-2").guards.every((x) => x.mode === "sleep"), "no card is ever awake in 1-2");
});
test("1-2: nothing 7+ tiles up is reachable without a bounce; bounce + air jump reaches 8 tiles", () => {
  // The twist wall (7 tiles over the far bank) and the 8-tile ledge.
  for (const target of [
    { start: { x: 72 * T, feet: 18 * T }, top: 11 * T, past: 82 * T + 8 },
    { start: { x: 64 * T, feet: 18 * T }, top: 10 * T, past: 70 * T },
  ])
    assert.equal(anyReaches("1-2", target, jumpFamily({ maxTakeoff: 140, air: true })), false, "a double jump never gets there");
  // The measured envelope the geometry relies on.
  const bounce = (air) => {
    const g = fresh("1-2"),
      c = only(g, "wall");
    Object.assign(g.player, { x: c.x - 20, y: c.floor - M.GUARD.h - 112, vy: 100, grounded: false, jumpHeld: true, jumps: 1, grace: 0 });
    let top = Infinity,
      did = false;
    for (let i = 0; i < 240; i++) {
      ticks(g, 1, air && !did && g.bounces && g.player.vy >= 0 ? ((did = true), { jump: true }) : {});
      if (g.bounces) top = Math.min(top, feet(g));
    }
    return c.floor - top;
  };
  assert.ok(bounce(false) > 190 && bounce(false) < 7 * T, `bounce ${bounce(false).toFixed(1)} px`);
  assert.ok(bounce(true) > 8 * T + 16, `bounce + air jump ${bounce(true).toFixed(1)} px`);
});
test("1-2: the glowing card can't be skipped: every walk, run, jump and double jump off the run-up lands on it", () => {
  const glow = getLevel("1-2").guards.find((x) => x.absorb),
    edge = 118 * T; // the run-up's end
  let tries = 0;
  for (let jumpAt = edge - 220; jumpAt <= edge + 10; jumpAt += 10)
    for (const air of [false, true]) {
      const g = fresh("1-2");
      place(g, edge - 260, 14 * T, { vx: 330 });
      let jumped = false,
        airJumped = false;
      for (let i = 0; i < 600 && !g.unlocked.green; i++) {
        let jump = false;
        if (!jumped && cx(g) >= jumpAt && g.player.grounded) jump = jumped = true;
        else if (air && jumped && !airJumped && g.player.vy > 0) jump = airJumped = true;
        ticks(g, 1, { right: true, jump });
      }
      tries++;
      assert.equal(g.unlocked.green, true, `jump at ${jumpAt}${air ? " + air" : ""}`);
      assert.equal(guard(g, "glow").state, "drained");
    }
  for (const hold of [4, 8, 12, 30]) {
    const g = fresh("1-2");
    place(g, edge + 18, 14 * T); // 2 px of foot still on the run-up
    for (let i = 0; i < 300 && !g.unlocked.green; i++) ticks(g, 1, { right: i < hold });
    assert.equal(g.unlocked.green, true, `nudge ${hold}`);
  }
  assert.ok(tries > 40 && glow.catch === 24);
});

// ------------------------------------------------ 1-3: hide in green ------
test("1-3: green can't climb the 4-tile wall (white can); cards only warn and push here", () => {
  const wall = { start: { x: 61 * T, feet: 16 * T }, top: 12 * T, past: 65 * T + 8 };
  assert.equal(anyReaches("1-3", { ...wall, form: "green" }, jumpFamily({ maxTakeoff: 100 })), false);
  assert.equal(anyReaches("1-3", { ...wall, form: "white" }, jumpFamily({ maxTakeoff: 100, air: true })), true);
  // spears: false - a white Rubik who rams a corridor card is bumped back, never killed.
  const g = fresh("1-3");
  g.player.color = "white";
  const c = only(g, "corridor-b");
  Object.assign(c, { x: c.min, dir: -1, state: "calm", turning: 0 });
  place(g, c.x - 52, c.floor, { color: "white" }); // just right of the 1-tile step
  ticks(g, seconds(8), { right: true });
  assert.ok(events(g, "bump").length >= 3, "rammed three times");
  assert.equal(g.deaths, 0, "no spear before 1-5");
  assert.equal(events(g, "windup").length, 0);
});
test("1-3: the glade card hums at green Rubik and walks through him; white gets the green-card hint", () => {
  const g = fresh("1-3"),
    c = only(g, "glade");
  place(g, 500, c.floor, { color: "green" });
  let hummed = false;
  for (let i = 0; i < seconds(4); i++) {
    ticks(g, 1);
    hummed ||= c.disguiseSeen;
  }
  assert.ok(hummed, "the cone swept him: a hum, not a reaction");
  assert.equal(g.spotted, 0);
  assert.equal(events(g, "bump").length, 0, "cards let their own color pass");
  const w = fresh("1-3"),
    d = only(w, "glade");
  Object.assign(d, { x: 700, dir: -1, state: "calm", turning: 0 });
  place(w, 520, d.floor);
  w.player.color = "white";
  ticks(w, seconds(0.3));
  assert.equal(d.state, "suspect");
  assert.equal(w.hint, "green");
});

// ---------------------------------------------------- 1-4: storm dash -----
test("1-4: gap widths force the dash - green can't jump the 12/14-tile gaps, white can't double-jump the 20s", () => {
  const gaps = [
    { name: "Gap A", start: { x: 16 * T, feet: 16 * T }, top: 16 * T, past: 32 * T },
    { name: "develop 12", start: { x: 34 * T, feet: 16 * T }, top: 14 * T, past: 50 * T },
    { name: "develop 14", start: { x: 52 * T, feet: 14 * T }, top: 16 * T, past: 70 * T },
  ];
  for (const gap of gaps) {
    assert.equal(anyReaches("1-4", { ...gap, form: "green" }, jumpFamily({ maxTakeoff: 60 })), false, `${gap.name}: green jump`);
    assert.equal(anyReaches("1-4", { ...gap, form: "green", dash: true }, jumpFamily({ maxTakeoff: 60, dashDelays: [30, 40, 50, 54, 60] })), true, `${gap.name}: green jump + dash`);
  }
  // Both twist gaps (20 tiles; an orb / a pillar card mid-gap): white's
  // double jump - with its air jump at any moment, even saved for the fall -
  // never makes it without the dash.
  for (const twist of [
    { start: { x: 72 * T, feet: 16 * T }, top: 16 * T, past: 96 * T },
    { start: { x: 98 * T, feet: 16 * T }, top: 16 * T, past: 122 * T },
  ])
    assert.equal(anyReaches("1-4", { ...twist, form: "white" }, jumpFamily({ maxTakeoff: 80, air: true })), false, "white double jump");
  assert.equal(getLevel("1-4").map[B.WATER_ROW].slice(76, 96), "~".repeat(20));
  assert.equal(getLevel("1-4").map[B.WATER_ROW].slice(102, 122).replace("#", "~"), "~".repeat(20));
});
test("1-4: before the swirl Shift does nothing; DASH GET; refills chain dashes in the air", () => {
  const g = fresh("1-4");
  ticks(g, 1, { dash: true, right: true });
  assert.equal(events(g, "dash").length, 0);
  const got = replayTo("1-4", ROUTES["1-4"].baseline, (x) => x.dashUnlocked);
  M.advance(got, 1.3, {});
  assert.equal(M.dash(got, 1), true, "dash works after the GET");
  // One air dash per airtime; an orb refills an empty charge.
  const o = noCards(fresh("1-4"));
  o.dashUnlocked = true;
  const orb = o.orbs.find((x) => x.id === "twist");
  place(o, orb.x - 60, orb.y + 26, { dashCharge: 0, vy: -200, vx: 330 });
  o.player.grounded = false;
  assert.equal(M.dash(o, 1), false, "no charge, no air dash");
  ticks(o, seconds(0.25), { right: true });
  assert.ok(orb.respawn > 0, "orb taken");
  assert.equal(o.player.dashCharge, 1);
  // A stomp on the pillar card refills it too.
  const s = noCards(fresh("1-4"));
  s.dashUnlocked = true;
  const c = guard(s, "pillar");
  c.state = "asleep";
  place(s, c.x, c.floor - M.GUARD.h - 20, { vy: 200, dashCharge: 0 });
  s.player.grounded = false;
  ticks(s, seconds(0.15));
  assert.equal(s.bounces, 1);
  assert.equal(s.player.dashCharge, 1);
});
test("1-4: two slow landings on Gap A's recovery rock offer the dash bubble", () => {
  const d = noCards(fresh("1-4"));
  d.dashUnlocked = true;
  for (let k = 0; k < 2; k++) {
    place(d, 18 * T, 16 * T, { color: "green" });
    ticks(d, 1, { jump: true, right: true });
    ticks(d, seconds(1.2), { right: true });
  }
  assert.equal(d.hint, "dash");
});

// ------------------------------------------------------- 1-5: lookouts ----
test("1-5: the full ladder in the open - ?, !, charge, wind-up, a jumpable spear, recovery", () => {
  const g = fresh("1-5"),
    c = only(g, "teacher");
  Object.assign(c, { x: 900, dir: -1, state: "calm", turning: 0 });
  place(g, 640, c.floor);
  ticks(g, seconds(0.27));
  assert.equal(c.state, "suspect");
  ticks(g, seconds(0.4));
  assert.equal(c.state, "alert");
  assert.equal(g.spotted, 1);
  const x0 = c.x;
  ticks(g, seconds(0.7));
  assert.ok(c.x < x0, "it charges after the 0.45 s beat");
  ticks(g, seconds(1));
  assert.ok(events(g, "windup").length >= 1, "in range: the wind-up");
  // Jumping clears the spear band (30-70 px up) in the open.
  const j = fresh("1-5"),
    u = only(j, "teacher");
  Object.assign(u, { x: 900, dir: -1, state: "lunge", timer: M.GUARD.lunge, lungeTarget: 900 });
  place(j, 900 - 24 - 40, u.floor - 75, { vy: -100 });
  j.player.grounded = false;
  ticks(j, 1);
  assert.equal(j.phase, "playing");
  const d = fresh("1-5"),
    s = only(d, "teacher");
  Object.assign(s, { x: 900, dir: -1, state: "lunge", timer: M.GUARD.lunge, lungeTarget: 900 });
  place(d, 900 - 24 - 40, s.floor);
  ticks(d, 1);
  assert.equal(d.deathReason, "spear");
});
test("1-5: a red card sees green (and white) but not red; green cards see white and red", () => {
  const g = fresh("1-5"),
    e = only(g, "enforcer");
  assert.deepEqual(["white", "green", "red"].map((color) => M.canSee(e, color)), [true, true, false]);
  assert.deepEqual(["white", "green", "red"].map((color) => M.canSee(guard(g, "teacher"), color)), [true, false, true]);
  Object.assign(e, { dir: -1, state: "calm", turnClock: 0 });
  place(g, e.x - 200, e.floor, { color: "green" });
  g.unlocked.green = true;
  ticks(g, seconds(0.3));
  assert.equal(e.state, "suspect");
});

// ------------------------------------------------------- 1-6: the vault ---
test("1-6: the theft - RED GET, REVERSE, the burst wakes, the chamber door seals and only red breaks it", () => {
  const g = replayTo("1-6", ROUTES["1-6"].baseline, (x) => x.stolen);
  assert.equal(g.unlocked.red, true);
  assert.equal(g.player.color, "red");
  assert.equal(g.checkpoint, "vault");
  assert.deepEqual(g.gets, ["red"]);
  for (const id of ["burst-a", "burst-b"]) assert.ok(["alert", "windup", "lunge"].includes(guard(g, id).state));
  for (const id of ["corridor", "lookout", "landing"]) assert.equal(guard(g, id).dir, 1, `${id} faces the route home`);
  assert.equal(guard(g, "ambush").state, "calm", "the escape-only card arrived");
  for (const id of ["seal-low", "seal-high"]) assert.equal(g.stones.find((s) => s.id === id).broken, false, `${id} dropped`);
  // Inbound the door was open; nothing but a red dash gets out now.
  assert.equal(fresh("1-6").stones.find((s) => s.id === "seal-low").broken, true);
  for (const [color, input] of [
    ["white", { left: true, jump: true }],
    ["green", { left: true, dash: true }],
    ["red", { left: true }],
  ]) {
    const t = replayTo("1-6", ROUTES["1-6"].baseline, (x) => x.stolen);
    for (const c of t.guards) c.state = "away";
    M.advance(t, 1.3, {});
    t.player.color = color;
    for (let i = 0; i < 6; i++) {
      ticks(t, 1, input);
      ticks(t, seconds(0.5), { left: true });
    }
    assert.ok(cx(t) > 112 * T, `${color} stays inside`);
  }
});
test("1-6: home only ends the level after the theft; the escape has no fail timer", () => {
  const g = fresh("1-6");
  ticks(g, seconds(1));
  assert.equal(g.phase, "playing");
  const s = replay("1-6", ROUTES["1-6"].baseline, (x) => x.stolen);
  for (let i = 0; i < 800 && cx(s) > 105 * T; i++) ticks(s, 1, { left: true });
  ticks(s, seconds(60));
  assert.ok(["playing", "dead"].includes(s.phase));
  assert.equal(s.escapeTime, null);
});
test("1-6: the stacked roof gate is out of a white double jump's reach from the lookout ledge", () => {
  const g = noCards(fresh("1-6"));
  place(g, 45 * T, 12 * T);
  ticks(g, 1, { jump: true });
  let top = g.player.y,
    airJumped = false;
  for (let i = 0; i < 240; i++) {
    if (!airJumped && g.player.vy >= 0) {
      ticks(g, 1, { jump: true });
      airJumped = true;
    } else ticks(g, 1);
    top = Math.min(top, g.player.y);
  }
  const rise = 12 * T - (top + M.PLAYER.h),
    gate = getLevel("1-6").stones.find((s) => s.id === "roof-high");
  assert.ok(rise > 4 * T, `white reaches 4-tile ledges (${rise.toFixed(1)} px)`);
  assert.ok(12 * T - gate.y * T > rise + 8, "the stacked roof gate stays out of reach inbound");
});

// --------------------------------------------- rules over every level -----
test("no level asks for a 3-tile climb (93 px apex vs 96 px: the broken-feeling height)", () => {
  for (const level of LEVELS) {
    const solid = (x, y) => y >= 0 && y < B.ROWS && x >= 0 && x < level.cols && level.map[y][x] === "#";
    for (let x = 1; x < level.cols - 1; x++)
      for (let y = 1; y < B.ROWS; y++) {
        const standable = (level.map[y][x] === "#" || level.map[y][x] === "=") && !solid(x, y - 1) && !solid(x, y - 2);
        if (!standable) continue;
        for (const nx of [x - 1, x + 1]) {
          if (!solid(nx, y)) continue;
          let top = y;
          while (top > 0 && solid(nx, top - 1)) top--;
          assert.notEqual(y - top, 3, `${level.id}: 3-tile wall next to column ${x}, row ${y}`);
        }
      }
  }
});
test("no respawn point in any level can be inside a sight cone (any card, any patrol position, both facings)", () => {
  for (const level of LEVELS) {
    const g = fresh(level.id);
    for (const cp of level.checkpoints) {
      const box = { x: cp.x - M.PLAYER.w / 2, y: cp.floor - M.PLAYER.h, w: M.PLAYER.w, h: M.PLAYER.h };
      for (const card of g.guards.filter((c) => !c.absorb && !c.trampoline && !c.decor))
        for (let x = card.min; x <= card.max; x += 4)
          for (const dir of [-1, 1]) {
            const probe = { ...card, x, dir };
            assert.equal(M.boxInCone(probe, box, M.coneReach(g, probe)), false, `${level.id} ${cp.id} seen by ${card.id} at ${x} facing ${dir}`);
          }
    }
  }
});
test("hint budget: at most two bubbles per level and nothing is taught in two levels", () => {
  const seen = new Set();
  for (const level of LEVELS) {
    assert.ok(level.hints.length <= 2, level.id);
    for (const id of level.hints) {
      assert.ok(M.HINT_IDS.includes(id), id);
      assert.ok(!seen.has(id), `${id} is taught twice`);
      seen.add(id);
    }
  }
  assert.deepEqual([...seen].sort(), [...M.HINT_IDS].sort(), "every bubble has a home level");
});
test("stickers are permanent in a run: a death keeps them and they can't be taken twice; owned ones still count", () => {
  const g = replay("1-1", ROUTES["1-1"].baseline, (x) => x.stickers[0].collected);
  M.die(g, "water");
  ticks(g, seconds(0.5));
  assert.equal(g.phase, "playing");
  assert.equal(M.stickerCount(g), 1);
  const s = g.stickers[0];
  place(g, s.x, s.y + 26);
  ticks(g, 2);
  assert.equal(events(g, "sticker").length, 1);
  const owned = replay("1-1", ROUTES["1-1"].mastery, () => false, { owned: [1, 2, 3] });
  assert.ok(owned.stickers.every((x) => x.owned && x.collected));
  assert.ok(events(owned, "sticker").every((e) => e.owned));
});
test("checkpoints restore the whole segment; nothing is farmable; deaths and spotting stay cumulative", () => {
  const g = replay("1-5", ROUTES["1-5"].baseline, (x) => x.checkpoint === "post");
  const e = guard(g, "enforcer"),
    stomps = g.stomps;
  place(g, e.x, e.floor - M.GUARD.h - 20, { vy: 200 });
  g.player.grounded = false;
  ticks(g, seconds(0.1));
  assert.equal(e.state, "stunned");
  assert.equal(g.stomps, stomps + 1);
  M.die(g, "water");
  ticks(g, seconds(0.5));
  assert.equal(g.deaths, 1);
  assert.notEqual(guard(g, "enforcer").state, "stunned", "the stomped card is restored");
  assert.equal(g.stomps, stomps, "the stomp can't be banked by dying");
  // Walking back over an older marker never moves the respawn backwards.
  place(g, getLevel("1-5").checkpoints[0].x, getLevel("1-5").checkpoints[0].floor);
  ticks(g, 2);
  assert.equal(g.checkpoint, "post");
  // After the theft: a smashed stone rewinds, its sticker is kept.
  const m = replay("1-6", ROUTES["1-6"].mastery, (x) => x.stickers[1].collected);
  assert.equal(m.stones.find((s) => s.id === "alcove").broken, true);
  M.die(m, "water");
  ticks(m, seconds(0.5));
  assert.equal(m.checkpoint, "vault");
  assert.equal(m.stones.find((s) => s.id === "alcove").broken, false, "world rewinds");
  assert.equal(m.stickers[1].collected, true, "the sticker is his for good");
});

// ---------------------------------------------------- shared mechanics ----
test("cone detection is exactly the drawn cone_de_visao.png silhouette; walls cut both", () => {
  const png = readPng(path.join(demo, "assets/cone_de_visao.png"));
  assert.equal(png.width, 176);
  assert.equal(png.height, 47);
  for (let c = 0; c < 176; c++) {
    let top = -1,
      bottom = -1;
    for (let r = 0; r < 47; r++)
      if (png.alpha(c, r) > 0) {
        if (top < 0) top = r;
        bottom = r;
      }
    assert.deepEqual(M.CONE_PROFILE[c], top < 0 ? null : [top, bottom], `column ${c}`);
  }
  for (const dir of [-1, 1]) {
    const card = { x: 1000, floor: 600, dir };
    for (let c = 0; c < 176; c++)
      for (let r = 0; r < 47; r++) {
        const drawX = dir > 0 ? card.x + M.CONE.offset + M.CONE.length - (c + 1) * 2 : card.x - M.CONE.offset - M.CONE.length + c * 2;
        assert.equal(M.coneColumnX(card, c), drawX);
        const point = { x: drawX + 0.5, y: card.floor - M.CONE.top + r * 2 + 0.5, w: 1, h: 1 },
          span = M.CONE_PROFILE[c];
        assert.equal(M.boxInCone(card, point), !!span && r >= span[0] && r <= span[1]);
      }
  }
  const g = fresh("1-5"),
    e = guard(g, "enforcer");
  e.dir = -1;
  const reach = M.coneReach(g, e);
  assert.ok(reach < M.CONE.length, "the step shields the post checkpoint");
  const behind = { x: e.x - M.CONE.offset - reach - 30, y: e.floor - 52, w: 20, h: 52 };
  assert.equal(M.boxInCone(e, behind, reach), false);
  assert.equal(M.boxInCone(e, behind), true, "would be inside without the wall");
});
test('awareness: "?" after 0.25 s, "!" at 0.6 s, calm again after losing sight', () => {
  const g = fresh("1-5"),
    c = only(g, "teacher");
  Object.assign(c, { x: 900, dir: -1, state: "calm", turning: 0 });
  place(g, 700, c.floor);
  ticks(g, seconds(0.2));
  assert.equal(c.state, "calm");
  ticks(g, seconds(0.07));
  assert.equal(c.state, "suspect");
  assert.equal(g.spotted, 0, '"?" is a warning, not a detection');
  ticks(g, seconds(0.36));
  assert.equal(c.state, "alert");
  assert.equal(g.spotted, 1);
  M.switchColor(g, "green");
  ticks(g, seconds(1.05));
  assert.equal(c.state, "search");
  ticks(g, seconds(1.05));
  assert.equal(c.state, "calm");
  // A "?" that loses sight before 0.6 s calms down without spotting.
  const q = fresh("1-5"),
    d = only(q, "teacher");
  Object.assign(d, { x: 900, dir: -1, state: "calm", turning: 0 });
  place(q, 700, d.floor);
  ticks(q, seconds(0.3));
  assert.equal(d.state, "suspect");
  place(q, 1000, d.floor); // step behind it
  ticks(q, seconds(1.1));
  assert.equal(d.state, "calm");
  assert.equal(q.spotted, 0);
});
test("body contact only knocks Rubik back the way he came; cards are solid to other colors", () => {
  const g = fresh("1-5"),
    c = only(g, "teacher");
  Object.assign(c, { x: 900, dir: -1, state: "calm", turning: 0 });
  place(g, 960, c.floor); // behind it, then walk into it
  ticks(g, seconds(0.4), { left: true });
  assert.equal(g.deaths, 0);
  assert.equal(events(g, "bump").length, 1);
  assert.ok(cx(g) > c.x, "pushed back the way he came");
  assert.equal(c.state, "alert");
  ticks(g, seconds(0.7), { right: true });
  assert.equal(g.phase, "playing", "running away after a bump is always possible");
  // Red Rubik walks straight through a red card.
  const r = fresh("1-5");
  r.unlocked.red = true;
  const er = only(r, "enforcer");
  Object.assign(er, { dir: -1, state: "calm", turnClock: 0 });
  place(r, er.x - 200, er.floor, { color: "red" });
  ticks(r, seconds(1.5), { right: true });
  assert.ok(cx(r) > er.x);
  assert.equal(events(r, "bump").length, 0);
});
test("mid-air swap: a green jump keeps white's unspent air jump; a spent one never refreshes", () => {
  const g = noCards(fresh("1-3"));
  place(g, 70 * T, 12 * T, { color: "green" });
  ticks(g, 1, { jump: true });
  ticks(g, seconds(0.2));
  ticks(g, 1, { jump: true });
  assert.equal(g.player.jumps, 1, "green has no air jump");
  assert.equal(M.switchColor(g, "white"), true);
  ticks(g, 1, { jump: true });
  assert.equal(g.player.jumps, 2);
  ticks(g, seconds(0.16));
  M.switchColor(g, "green");
  assert.equal(M.switchColor(g, "white"), false, "0.15 s swap cooldown");
  ticks(g, seconds(0.16));
  M.switchColor(g, "white");
  const before = g.player.vy;
  ticks(g, 1, { jump: true });
  assert.ok(g.player.vy >= before, "no extra lift");
  assert.equal(events(g, "airjump").length, 1);
});
test("rising through a one-way slab never counts as standing on it (no free air-jump refresh)", () => {
  const g = noCards(fresh("1-1"));
  place(g, 105 * T, 10 * T);
  ticks(g, 1, { jump: true });
  let groundedWhileRising = false;
  for (let i = 0; i < 90; i++) {
    ticks(g, 1, i === 40 ? { jump: true } : {});
    if (g.player.grounded && g.player.vy < 0) groundedWhileRising = true;
  }
  assert.equal(groundedWhileRising, false);
});
test("red smash: stones break only to a red dash, which refunds it; a red dash knocks cards aside", () => {
  const setup = (color) => {
    const g = noCards(fresh("1-6"));
    g.unlocked.red = true;
    place(g, 128 * T, 8 * T, { color, direction: 1 });
    return g;
  };
  const stone = (g) => g.stones.find((s) => s.id === "alcove");
  for (const [color, dashing] of [
    ["white", true],
    ["green", true],
    ["red", false],
  ]) {
    const g = setup(color);
    ticks(g, 1, dashing ? { dash: true, right: true } : { right: true });
    ticks(g, seconds(0.6), { right: true });
    assert.equal(stone(g).broken, false, `${color}${dashing ? " dash" : " walk"} must not break it`);
  }
  const r = setup("red");
  ticks(r, 1, { dash: true, right: true });
  ticks(r, seconds(0.3), { right: true });
  assert.equal(stone(r).broken, true);
  assert.equal(r.smashes, 1);
  assert.equal(r.player.dashCharge, 1);
  assert.ok(r.stickers.find((s) => s.id === 2).collected, "the alcove sticker is behind it");
  // Knock: a red air dash into a green card stuns it and refunds the dash.
  const k = fresh("1-6");
  k.unlocked.red = true;
  const c = only(k, "lookout");
  Object.assign(c, { x: 50 * T, dir: -1, state: "calm", turning: 0 });
  place(k, 53 * T, 12 * T, { color: "red", direction: -1 });
  ticks(k, 1, { jump: true });
  ticks(k, seconds(0.05));
  ticks(k, 1, { dash: true, left: true });
  ticks(k, seconds(0.15), { left: true });
  assert.equal(c.state, "stunned");
  assert.equal(k.knockouts, 1);
  assert.equal(k.player.dashCharge, 1);
});
test("geometry matches the jump: a held jump clears 2 tiles but never 3; white reaches 4", () => {
  const g = noCards(fresh("1-1"));
  place(g, 64 * T, 14 * T);
  ticks(g, 1, { jump: true });
  let top = g.player.y;
  for (let i = 0; i < 120; i++) {
    ticks(g, 1);
    top = Math.min(top, g.player.y);
  }
  const apex = 14 * T - (top + M.PLAYER.h);
  assert.ok(apex > 2 * T + 20 && apex < 3 * T, `single jump ${apex.toFixed(1)} px`);
  assert.ok(M.GUARD.h < 3 * T && M.GUARD.h + M.PLAYER.h > 3 * T, "a card fits a 3-tile corridor, a jump over it doesn't");
});
test("pause freezes everything; a resumed tab can't integrate a giant frame", () => {
  const g = fresh("1-1");
  ticks(g, seconds(0.3), { right: true });
  g.phase = "paused";
  const before = JSON.stringify(g);
  ticks(g, seconds(1), { right: true, jump: true, dash: true });
  assert.equal(JSON.stringify(g), before);
  g.phase = "playing";
  const x = g.player.x;
  M.update(g, 10, { right: true });
  assert.ok(g.player.x - x < 12, "dt is capped at 1/30 s");
});
test("forgiving input: coyote time, buffered landing jump, variable height, same-tick tap", () => {
  const c = noCards(fresh("1-1"));
  place(c, 12 * T - 4, 12 * T, { vx: 330 });
  for (let i = 0; i < 60 && c.player.grounded; i++) ticks(c, 1, { right: true });
  assert.equal(c.player.grounded, false);
  ticks(c, 6, { right: true });
  assert.ok(c.player.coyote > 0);
  ticks(c, 1, { right: true, jump: true });
  assert.ok(c.player.vy < -400 && c.player.jumps === 1);
  const b = noCards(fresh("1-1"));
  place(b, 64 * T, 14 * T - 20, { vy: 250, airJumped: true });
  b.player.grounded = false;
  ticks(b, 1, { jump: true });
  ticks(b, seconds(0.12));
  assert.equal(b.player.jumps, 1);
  assert.ok(b.player.vy < 0);
  const full = noCards(fresh("1-1")),
    short = noCards(fresh("1-1"));
  for (const g of [full, short]) place(g, 64 * T, 14 * T);
  ticks(full, 1, { jump: true });
  ticks(short, 1, { jump: true });
  ticks(full, seconds(0.08));
  ticks(short, seconds(0.08));
  ticks(short, 1, { jumpReleased: true });
  ticks(full, seconds(0.3));
  ticks(short, seconds(0.3));
  assert.ok(short.player.y > full.player.y + 25);
  const tap = noCards(fresh("1-1"));
  place(tap, 64 * T, 14 * T);
  ticks(tap, 1, { jump: true, jumpReleased: true });
  assert.ok(tap.player.vy < 0 && tap.player.vy > -(M.WORLD.jump * 0.5 + 1));
});

// ------------------------------------------------------------------- art ----
test("all 103 original images are byte-identical and recorded as on-screen or archive", () => {
  const manifest = JSON.parse(readFileSync(path.join(demo, "art-manifest.json"), "utf8"));
  assert.equal(manifest.length, 103);
  const sha = (file) => createHash("sha256").update(readFileSync(file)).digest("hex");
  const listed = new Set(manifest.map((entry) => entry.file));
  const walk = (dir, prefix = "") =>
    readdirSync(dir).flatMap((name) => (statSync(path.join(dir, name)).isDirectory() ? walk(path.join(dir, name), prefix + name + "/") : [prefix + name]));
  const images = walk(path.join(demo, "assets")).filter((f) => /\.(png|jpe?g)$/i.test(f));
  assert.deepEqual([...images].sort(), [...listed].sort(), "every image in assets/ is in the manifest");
  for (const entry of manifest) {
    assert.ok(["screen", "archive"].includes(entry.use), entry.file);
    assert.equal(sha(path.join(demo, "assets", entry.file)), entry.sha256, entry.file);
    const original = path.join(demo, "..", "refs", "color-theft-story", "assets", entry.file);
    if (existsSync(original)) assert.equal(entry.sha256, sha(original), entry.file);
  }
  // The on-screen tile record is computed from all six maps, the world map's
  // path and the vault pillars - not hand-kept.
  const onTiles = new Set(B.tilesOnScreen(LEVELS));
  for (let n = 1; n <= 60; n++) {
    const entry = manifest.find((e) => e.file === `tiles/Tile_${String(n).padStart(2, "0")}.png`);
    assert.equal(entry.use, onTiles.has(n) ? "screen" : "archive", entry.file);
  }
  for (const entry of manifest) if (entry.file.startsWith("player/")) assert.equal(entry.use, "archive", "unverified third-party pack");
});
