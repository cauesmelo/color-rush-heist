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
    ["Home Cliff", "Stomping Ground", "Hide in Green", "Storm Dash", "Lookouts", "The Vault"],
  );
  for (const level of LEVELS) {
    assert.equal(level.map.length, B.ROWS, level.id);
    for (const row of level.map) assert.equal(row.length, level.cols, level.id);
    assert.ok(level.cols >= 100 && level.cols <= 170, `${level.id}: ${level.cols} columns`);
    assert.deepEqual(level.stickers.map((s) => s.id), [1, 2, 3], level.id);
    assert.ok(level.checkpoints.length >= 2, `${level.id}: a start face and a midpoint`);
    assert.ok(Math.abs(level.checkpoints[0].x - level.spawn.x) < 60, `${level.id}: start face at the spawn`);
    assert.ok(Object.isFrozen(level) && Object.isFrozen(level.map), "levels are frozen data");
    if (level.id === "1-6") assert.ok(level.vault && level.home && !level.goal);
    else assert.ok(level.goal && !level.vault && !level.home, level.id);
  }
});
test("no sleeping cards anywhere: every card is awake, and no card is ever asleep in any route", () => {
  for (const level of LEVELS)
    for (const card of level.guards) {
      assert.ok(["patrol", "sentry"].includes(card.mode), `${level.id} ${card.id}: ${card.mode}`);
      assert.ok(!card.trampoline && !card.wakeOnTheft, `${level.id} ${card.id}`);
    }
  for (const id of LEVEL_IDS)
    for (const kind of ["baseline", "mastery"]) {
      const states = new Set();
      replayTo(id, ROUTES[id][kind], (g) => {
        for (const c of g.guards) states.add(c.state);
        return false;
      });
      assert.ok(!states.has("asleep"), `${id} ${kind}`);
    }
  assert.ok(LEVELS[0].guards.length === 0, "1-1 is only about the body: no cards");
});
test("kits: each level always starts with the abilities it was designed for; later ones are absent", () => {
  const expect = {
    "1-1": { forms: ["white"], start: "white", dash: false },
    "1-2": { forms: ["white"], start: "white", dash: false },
    "1-3": { forms: ["white", "green"], start: "green", dash: false },
    "1-4": { forms: ["white", "green"], start: "green", dash: false },
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
    if (getLevel(id).unseen !== false && id !== "1-1") assert.equal(base.spotted, 0, `${id} baseline is never spotted`);
    // Same inputs, same result: a second replay is identical.
    const again = replay(id, ROUTES[id].mastery);
    assert.equal(again.time, mastery.time);
    assert.deepEqual(again.stickers, mastery.stickers);
    // QA routes are short; first plays are several times longer.
    assert.ok(base.time < 40, `${id} baseline ${base.time.toFixed(1)} s`);
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
test("checkpoints: at most 12 s of baseline route time apart wherever Rubik can die; respawn takes 0.45 s", () => {
  for (const id of LEVEL_IDS) {
    // 1-3 has no water and no spears: nothing to retry, so its checkpoints
    // are only the start and the midpoint (the brief's "fewer checkpoints").
    const level = getLevel(id),
      deadly = level.map[B.WATER_ROW].includes("~") || level.spears !== false;
    if (!deadly) {
      assert.equal(level.checkpoints.length, 2, `${id}: start + midpoint`);
      continue;
    }
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
test("1-2: stomp from above or behind stuns a card; a card facing Rubik raises its spear (no stomp)", () => {
  const drop = (dir, offset) => {
    const g = fresh("1-2"),
      c = only(g, "wall");
    Object.assign(c, { x: 76 * T, dir, state: "calm", turning: 0, turnClock: 0 });
    place(g, c.x + offset, c.floor - M.GUARD.h - 30, { vy: 200, jumpHeld: true, jumps: 1 });
    g.player.grounded = false;
    ticks(g, seconds(0.2));
    return { g, c };
  };
  const behind = drop(1, -14); // card faces right, Rubik lands on its back
  assert.equal(behind.c.state, "stunned");
  assert.equal(behind.g.stomps, 1);
  const above = drop(1, 6); // right over its head (within half the head)
  assert.equal(above.c.state, "stunned");
  const front = drop(-1, -30); // card faces Rubik: spear up
  assert.notEqual(front.c.state, "stunned");
  assert.equal(events(front.g, "spike").length, 1);
  assert.equal(front.g.deaths, 0, "a spike pops Rubik away, never kills");
  assert.ok(front.g.player.x + M.PLAYER.w / 2 < front.c.x, "popped back the way he came");
  // An aware card always has its spear up, from any side.
  const g = fresh("1-2"),
    c = only(g, "wall");
  Object.assign(c, { x: 76 * T, dir: 1, state: "alert", timer: 1 });
  place(g, c.x - 14, c.floor - M.GUARD.h - 30, { vy: 200 });
  g.player.grounded = false;
  ticks(g, seconds(0.2));
  assert.equal(events(g, "spike").length, 1);
});
test("1-2: hold jump for the high bounce; a tap (or a walk-off) gives the short hop", () => {
  const bounce = (held) => {
    const g = fresh("1-2"),
      c = only(g, "wall");
    Object.assign(c, { x: 76 * T, dir: 1, state: "calm", turning: 0, turnClock: 0, pace: 0 });
    c.min = c.max = c.x;
    Object.assign(g.player, { x: c.x - 34, y: c.floor - M.GUARD.h - 112, vy: 100, grounded: false, jumpHeld: held, jumps: held ? 1 : 0, grace: 0 });
    let top = Infinity;
    for (let i = 0; i < 160; i++) {
      ticks(g, 1);
      if (g.stomps) top = Math.min(top, feet(g));
    }
    return c.floor - top;
  };
  const high = bounce(true),
    low = bounce(false);
  assert.ok(high > 190 && high < 7 * T, `held bounce ${high.toFixed(1)} px`);
  assert.ok(low < high - 40 && low > M.GUARD.h + 40, `tap bounce ${low.toFixed(1)} px`);
});
test("1-2: nothing 7+ tiles up is reachable without a stomp; stomp + air jump reaches 8 tiles", () => {
  // The twist wall (7 tiles over the patrol's floor) and the 8-tile ledge.
  for (const target of [
    { start: { x: 72 * T, feet: 18 * T }, top: 11 * T, past: 82 * T + 8 },
    { start: { x: 71 * T, feet: 18 * T }, top: 10 * T, past: 73 * T },
  ])
    assert.equal(anyReaches("1-2", target, jumpFamily({ maxTakeoff: 140, air: true })), false, `a double jump never gets to ${target.top}`);
  // Sticker 3's slab (row 8): the highest double jump from the block or the
  // far bank stays under it.
  for (const [x, floor] of [
    [68 * T + 20, 16 * T],
    [64 * T + 16, 18 * T],
  ]) {
    const g = noCards(fresh("1-2"));
    place(g, x, floor);
    let best = Infinity;
    ticks(g, 1, { jump: true });
    for (let i = 0; i < 200; i++) {
      ticks(g, 1, !g.player.airJumped && g.player.vy >= 0 ? { jump: true } : {});
      best = Math.min(best, feet(g));
    }
    assert.ok(best > 8 * T, `double jump from ${x} tops out at ${best.toFixed(1)}`);
  }
  // The measured envelope: a held stomp + air jump clears the 8-tile ledge.
  const g = fresh("1-2"),
    c = only(g, "wall");
  Object.assign(c, { x: 76 * T, dir: 1, state: "calm", turning: 0, pace: 0 });
  c.min = c.max = c.x;
  Object.assign(g.player, { x: c.x - 34, y: c.floor - M.GUARD.h - 112, vy: 100, grounded: false, jumpHeld: true, jumps: 1, grace: 0 });
  let top = Infinity,
    did = false;
  for (let i = 0; i < 240; i++) {
    ticks(g, 1, !did && g.stomps && g.player.vy >= 0 ? ((did = true), { jump: true }) : {});
    if (g.stomps) top = Math.min(top, feet(g));
  }
  assert.ok(c.floor - top > 8 * T + 16, `stomp + air jump ${(c.floor - top).toFixed(1)} px`);
});
test("1-2: the green card can't be skipped: every walk, run, jump and double jump off the run-up lands on its back", () => {
  const edge = 118 * T; // the run-up's end
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
  assert.ok(tries > 40);
  assert.equal(guard(fresh("1-2"), "glow").state, "calm", "the green card is awake (eyes open, a lookout)");
});
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

test("1-3 finale: green can't make a pillar hop (12 tiles), white can; a hop is long enough to be spotted", () => {
  const hop = { start: { x: 111 * T, feet: 12 * T }, top: 12 * T, past: 126 * T };
  assert.equal(anyReaches("1-3", { ...hop, form: "green" }, jumpFamily({ maxTakeoff: 60 })), false);
  assert.equal(anyReaches("1-3", { ...hop, form: "white" }, jumpFamily({ maxTakeoff: 60, air: true })), true);
  // White in a facing lookout's cone through a whole hop: it spots him.
  const g = fresh("1-3"),
    c = only(g, "pillar-a");
  Object.assign(c, { dir: -1, state: "calm", turning: 0, turnClock: 0, fixed: true });
  place(g, 126 * T + 20, 12 * T, { color: "white" }); // pillar A's left half, in front of its card
  ticks(g, seconds(0.9));
  assert.equal(g.spotted, 1, "0.9 s in sight > 0.6 s");
});

// ---------------------------------------------------- 1-4: storm dash -----
test("1-4: gap widths force the dash - green can't jump the 12/14-tile gaps, white can't double-jump the 20s", () => {
  const gaps = [
    { name: "Gap A", start: { x: 16 * T, feet: 16 * T }, top: 16 * T, past: 32 * T },
    { name: "develop 12", start: { x: 34 * T, feet: 16 * T }, top: 16 * T, past: 50 * T },
    { name: "develop 14", start: { x: 52 * T, feet: 16 * T }, top: 16 * T, past: 70 * T },
  ];
  for (const gap of gaps) {
    assert.equal(anyReaches("1-4", { ...gap, form: "green" }, jumpFamily({ maxTakeoff: 60 })), false, `${gap.name}: green jump`);
    assert.equal(anyReaches("1-4", { ...gap, form: "green", dash: true }, jumpFamily({ maxTakeoff: 60, dashDelays: [30, 40, 50, 54, 60] })), true, `${gap.name}: green jump + dash`);
  }
  // The orb twist gap (20 tiles): white's double jump - with its air jump at
  // any moment, even saved for the fall - never makes it without the dash.
  // (The pillar gap's lookout is a refill: stomping its back also refreshes
  // white's air jump, an intended alternative.)
  const twist = { start: { x: 72 * T, feet: 16 * T }, top: 16 * T, past: 96 * T };
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
  // A stomp on the pillar lookout's back refills it too.
  const s = noCards(fresh("1-4"));
  s.dashUnlocked = true;
  const c = guard(s, "pillar");
  c.state = "calm";
  place(s, c.x - 12, c.floor - M.GUARD.h - 20, { vy: 200, dashCharge: 0 });
  s.player.grounded = false;
  ticks(s, seconds(0.15));
  assert.equal(s.stomps, 1);
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
test("1-5: hold right and one jump no longer skips the red guard: facing Rubik, it can't be stomped", () => {
  for (const id of ["enforcer", "cross-red", "p1"]) {
    const g = fresh("1-5"),
      c = only(g, id);
    Object.assign(c, { dir: -1, state: "calm", turning: 0, turnClock: 0, fixed: true });
    place(g, c.x - 150, c.floor, { color: "green" });
    g.unlocked.green = true;
    ticks(g, 1, { right: true, jump: true });
    for (let i = 0; i < seconds(1.2); i++) ticks(g, 1, { right: true });
    assert.notEqual(c.state, "stunned", `${id}: no stomp from the front`);
    // Getting past means a hop through its cone: it has noticed (at least "?").
    if (M.canSee(c, "green")) assert.ok(c.state !== "calm" || events(g, "suspect").length > 0 || events(g, "spike").length > 0, `${id}: it noticed`);
  }
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
test("1-6: the theft - RED GET, REVERSE, the room's cards turn, the door seals and only red breaks it", () => {
  const g = replayTo("1-6", ROUTES["1-6"].baseline, (x) => x.stolen);
  assert.equal(g.unlocked.red, true);
  assert.equal(g.player.color, "red");
  assert.equal(g.checkpoint, "vault");
  assert.deepEqual(g.gets, ["red"]);
  for (const id of ["corridor", "lookout", "landing", "ambush"]) assert.equal(guard(g, id).dir, 1, `${id} faces the incoming Rubik`);
  for (const id of ["landing", "ambush"]) {
    assert.equal(fresh("1-6").guards.find((c) => c.id === id).state, "away", `${id} is absent inbound`);
    assert.equal(guard(g, id).state, "calm", `${id} arrived with the alarm`);
  }
  // Nothing in the sealed room can see red: the forced smash is safe.
  const seal = getLevel("1-6").stones.find((s) => s.id === "seal-low");
  assert.deepEqual(g.guards.filter((c) => c.state !== "away" && c.x > (seal.x + 2) * T && M.canSee(c, "red")).map((c) => c.id), []);
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
    M.advance(t, 1.3 + M.WORLD.theftCalm, {});
    t.player.color = color;
    for (let i = 0; i < 6; i++) {
      ticks(t, 1, input);
      ticks(t, seconds(0.5), { left: true });
    }
    assert.ok(cx(t) > 112 * T, `${color} stays inside`);
  }
});
test("1-6 fairness: after RED GET every card holds still through REVERSE (+0.8 s), and Rubik can't be hit", () => {
  const g = replayTo("1-6", ROUTES["1-6"].baseline, (x) => x.stolen);
  const at = () => g.guards.map((c) => [c.id, c.x, c.state]);
  M.advance(g, M.WORLD.hitstop.get + 0.01, {}); // the GET card (frozen)
  const held = JSON.stringify(at());
  M.advance(g, M.WORLD.theftCalm - 0.05, {}); // standing still, cards charging-to-be
  assert.equal(JSON.stringify(at()), held, "nothing moved or advanced during the hold");
  assert.equal(g.phase, "playing");
  assert.ok(g.player.grace > 0, "and Rubik is still untouchable at its end");
  M.advance(g, 0.3, {});
  assert.notEqual(JSON.stringify(at()), held, "then they come");
});
test("1-6: a death after the theft respawns inside the sealed room, held still, the door right there", () => {
  const g = replayTo("1-6", ROUTES["1-6"].baseline, (x) => x.stolen);
  M.advance(g, M.WORLD.hitstop.get + 0.05, {});
  M.die(g, "water");
  ticks(g, seconds(M.WORLD.respawnDelay + 0.02));
  assert.equal(g.phase, "playing");
  assert.equal(g.checkpoint, "vault");
  const seal = getLevel("1-6").stones.find((s) => s.id === "seal-low");
  assert.equal(g.stones.find((s) => s.id === "seal-low").broken, false, "the door is shut again");
  assert.ok(cx(g) > (seal.x + 2) * T && cx(g) - (seal.x + 2) * T < 2 * T, "inside, within 2 tiles of the door");
  assert.ok(g.calm >= 1, `every card holds for ${g.calm.toFixed(2)} s`);
  // No card in the room sees red (the alarm card outside is behind the door).
  assert.equal(g.guards.filter((c) => M.canSee(c, "red") && c.state !== "away" && c.x > (seal.x + 2) * T).length, 0);
  // The forced smash: a red dash at the door opens it, and the same dash
  // carries on into the alarm card staring at the door (the first knock).
  ticks(g, 1, { left: true, dash: true });
  ticks(g, seconds(0.3), { left: true });
  assert.equal(g.stones.find((s) => s.id === "seal-low").broken, true);
  assert.equal(guard(g, "landing").state, "stunned");
  assert.equal(g.deaths, 1, "and nothing kills him on the way out");
});
test("1-6 vault room: no state strands Rubik - dawdling is safe, the door always opens, the way out is cued", () => {
  const theft = () => {
    const g = replayTo("1-6", ROUTES["1-6"].baseline, (x) => x.stolen);
    M.advance(g, M.WORLD.hitstop.get + M.WORLD.theftCalm + 0.1, {});
    return g;
  };
  const seal = getLevel("1-6").stones.find((s) => s.id === "seal-low"),
    door = (seal.x + 2) * T;
  // Whatever a lost player does inside the sealed room for 20 s (stand,
  // push the door, pace, jump, swap forms, dash the other way), nothing that
  // sees him is in there: no death, and the door is still one dash away.
  const dawdles = {
    stand: () => ({}),
    push: () => ({ left: true }),
    pace: (i) => (Math.floor(i / 180) % 2 ? { right: true } : { left: true }),
    hop: (i) => ({ left: true, jump: i % 50 === 0 }),
    "dash right": (i) => ({ right: true, dash: i % 90 === 0 }),
    "swap red/white": (i) => ({ right: i % 240 < 120, color: i % 120 === 0 ? (i % 240 ? "white" : "red") : undefined }),
  };
  for (const [name, input] of Object.entries(dawdles)) {
    const g = theft();
    for (let i = 0; i < seconds(20); i++) M.update(g, M.TICK, input(i));
    assert.equal(g.deaths, 0, `${name}: 20 s in the room never kills`);
    assert.ok(cx(g) > door, `${name}: still inside`);
    // From wherever he ended up: red, walk to the door, one dash.
    M.switchColor(g, "red");
    ticks(g, seconds(0.2));
    for (let i = 0; i < seconds(6) && cx(g) > door + 30; i++) ticks(g, 1, { left: true });
    ticks(g, 1, { left: true, dash: true });
    ticks(g, seconds(0.4), { left: true });
    // On the ground the dash breaks the low stone; mid-hop, the stone in his
    // rows (the upper one) - either opens a doorway he flies through.
    assert.ok(g.stones.some((s) => s.sealOnTheft && s.broken), `${name}: the door opens`);
    assert.ok(cx(g) < door, `${name}: and he is out`);
    assert.equal(g.deaths, 0, `${name}: alive`);
  }
  // A dash fired from deeper in the room stops in the doorway: the alarm
  // card sees red, and the refunded dash (or green) answers it before its
  // "!" beat ends (0.15 s "?", 0.6 s "!", 0.45 s notice).
  const deep = theft();
  for (let i = 0; i < seconds(3) && cx(deep) > door + 130; i++) ticks(deep, 1, { left: true });
  ticks(deep, seconds(0.15)); // stop: the dash starts ~4 tiles inside the room
  ticks(deep, 1, { left: true, dash: true });
  ticks(deep, seconds(0.25), {});
  assert.equal(deep.stones.find((s) => s.id === "seal-low").broken, true);
  assert.notEqual(guard(deep, "landing").state, "stunned", "too far: the dash stopped in the doorway");
  assert.equal(deep.player.dashCharge, 1, "the smash refunded the dash");
  ticks(deep, 1, { left: true, dash: true });
  ticks(deep, seconds(0.3), { left: true });
  assert.equal(guard(deep, "landing").state, "stunned", "the second dash knocks it");
  assert.equal(deep.deaths, 0);
  // Only the first broken seal stone matters: the doorway is open once the
  // stone in Rubik's rows breaks (the upper one stays as a lintel), and the
  // renderer's door cue (game.mjs drawDoorCue) ends with that same stone.
  const src = readFileSync(path.join(demo, "game.mjs"), "utf8");
  assert.match(src, /function doorSealed\(\)[\s\S]*?!seal\.some\(\(s\) => s\.broken\)[\s\S]*?function drawDoorCue\(\) \{\n  if \(!doorSealed\(\)\) return;/);
  assert.match(src, /drawStones\(\);\n  drawDoorCue\(\);/);
});
test("1-6: sticker 3 stays sealed between the roof gates until red comes home", () => {
  // Inbound, white can reach the canopy roof from the home cliff (a double
  // jump up 2 tiles); the mid gate is stacked three high so the roof's left
  // end can't hop it (a single 2-tile gate let 63% of white jumps through).
  const level = getLevel("1-6"),
    mid = level.stones.filter((s) => s.x === 31).map((s) => s.y).sort((a, b) => a - b);
  assert.deepEqual(mid, [4, 6, 8]);
  const start = { x: 25 * T + 16, feet: 10 * T };
  assert.equal(anyReaches("1-6", { start, form: "white", top: 10 * T, past: 33 * T }, jumpFamily({ maxTakeoff: 60, air: true })), false);
  // Red on the roof breaks the bottom stone and runs under the other two.
  const g = noCards(fresh("1-6"));
  g.unlocked.red = true;
  place(g, 28 * T, 10 * T, { color: "red", direction: 1 });
  ticks(g, 1, { right: true, dash: true });
  ticks(g, seconds(0.8), { right: true });
  assert.ok(g.stickers[2].collected, "red takes sticker 3");
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

// ------------------------------------- every card has a job (revision 5) ---
/** What a route does with each card, tick by tick: stomps/bounces/drains and
 * knocks (events), the time Rubik spends inside its drawn cone in a colour it
 * sees ("seen"), inside its cone turned the other way in a colour it sees
 * ("mirror": its facing is what let him pass), inside its cone disguised
 * ("hum"), the swap-to-disguise lead before he first enters its cone, and the
 * closest approach of the two centres (px). */
function cardWork(id, kind) {
  const g = fresh(id),
    work = Object.fromEntries(g.guards.map((c) => [c.id, { gate: 0, knock: 0, seen: 0, mirror: 0, hum: 0, swapLead: Infinity, near: Infinity, inside: false }]));
  let lastEvent = 0,
    lastSwap = -Infinity,
    color = g.player.color;
  for (const [s, input] of ROUTES[id][kind]) {
    const n = Math.max(1, Math.round(s * 120));
    for (let i = 0; i < n; i++) {
      M.update(g, M.TICK, i === 0 ? input : { left: input.left, right: input.right });
      const p = g.player,
        box = { x: p.x, y: p.y, w: p.w, h: p.h };
      if (p.color !== color) [color, lastSwap] = [p.color, g.time];
      for (const c of g.guards) {
        const w = work[c.id];
        if (c.state === "away") continue;
        w.near = Math.min(w.near, Math.hypot(p.x + p.w / 2 - c.x, p.y + p.h - c.floor));
        if (["stunned", "drained"].includes(c.state)) continue;
        const sees = M.canSee(c, p.color),
          inCone = M.boxInCone(c, box, M.coneReach(g, c)),
          turned = { ...c, dir: -c.dir },
          inTurned = M.boxInCone(turned, box, M.coneReach(g, turned));
        if (inCone && sees) w.seen += M.TICK;
        if (inTurned && sees && !inCone) w.mirror += M.TICK;
        if (inCone && !sees) {
          w.hum += M.TICK;
          if (!w.inside) w.swapLead = Math.min(w.swapLead, g.time - lastSwap);
        }
        w.inside = inCone && !sees;
      }
      for (const e of g.events) {
        if (e.id <= lastEvent) continue;
        lastEvent = e.id;
        if (!work[e.guard]) continue;
        if (["stomp", "bounce", "drain"].includes(e.type)) work[e.guard].gate++;
        if (e.type === "knock") work[e.guard].knock++;
      }
    }
  }
  return { g, work };
}
/** The job vocabulary (LEVEL_DESIGN.md "Every card has a job"). Each job is
 * proved on the routes, never just asserted: a card that only stands in the
 * way of a disguised Rubik has no job outside the two disguise levels. */
const JOBS = {
  gate: (b) => b.gate > 0, // the guided line has to stomp it (or bounce off it)
  refill: (b) => b.gate > 0, // stomped mid-gap by the guided line to refill the dash
  knock: (b, m) => b.knock + m.knock > 0, // a red dash knocks it aside
  watch: (b, m) => b.seen + b.mirror + m.seen + m.mirror >= 0.1, // a live sightline a line must time
  swap: (b) => b.hum > 0 && b.swapLead <= 2, // the guided line swaps to its colour < 2 s before its cone
  teach: (b) => b.hum + b.seen > 0, // the idea's first card, met in the open on the guided line
  disguise: (b) => b.near < 24, // walks through disguised Rubik where he can't go around it
};
test("every card has a job, proved on the routes; cards that did no work are gone", () => {
  const out = {};
  for (const level of LEVELS) {
    if (!level.guards.length) continue;
    const base = cardWork(level.id, "baseline").work,
      mastery = cardWork(level.id, "mastery").work;
    out[level.id] = {};
    for (const card of level.guards) {
      assert.ok(card.job in JOBS, `${level.id} ${card.id}: declares a job (${card.job})`);
      const b = base[card.id],
        m = mastery[card.id];
      assert.ok(JOBS[card.job](b, m), `${level.id} ${card.id}: no evidence for "${card.job}" ${JSON.stringify({ b, m })}`);
      out[level.id][card.id] = card.job;
    }
    // Walking through a card in disguise is the lesson only where the level's
    // idea is the disguise (1-3) or its conclusion lands on it (1-4); one
    // introduction card per level at most.
    if (!["1-3", "1-4"].includes(level.id)) assert.ok(!level.guards.some((c) => c.job === "disguise"), `${level.id}: disguise-only cards`);
    assert.ok(level.guards.filter((c) => c.job === "teach").length <= 1, `${level.id}: one teaching card`);
  }
  // The cards revision five removed (no route ever engaged them, or they only
  // crowded the vault room) stay gone.
  const ids = (id) => getLevel(id).guards.map((c) => c.id);
  for (const [id, gone] of [["1-2", ["chain-a", "chain-b"]], ["1-3", ["corridor-a"]], ["1-6", ["burst-a", "burst-b"]]])
    for (const card of gone) assert.ok(!ids(id).includes(card), `${id} ${card}`);
  assert.equal(Object.values(out).reduce((n, level) => n + Object.keys(level).length, 0), 30);
});
test("no stacked cards: two cards on one floor keep 2+ tiles between their bodies, unless a declared pair", () => {
  for (const level of LEVELS)
    level.guards.forEach((a, i) =>
      level.guards.slice(i + 1).forEach((b) => {
        if (a.floor !== b.floor) return;
        // Closest the two bodies can get (patrol bounds; a charge stays inside them).
        const gap = Math.max(a.min, b.min) - Math.min(a.max, b.max) - M.GUARD.w;
        if (a.pair === b.id) {
          assert.equal(b.pair, a.id, `${level.id}: ${a.id}/${b.id} pair both ways`);
          assert.ok(gap >= 0, `${level.id} ${a.id}/${b.id}: a pair stands side by side, never overlapping (${gap} px)`);
          return;
        }
        assert.ok(gap >= 2 * T, `${level.id} ${a.id}/${b.id}: ${gap} px apart`);
      }),
    );
  // The vault room is one card inbound, and the escape meets one card per beat.
  const vault = getLevel("1-6"),
    room = vault.guards.filter((c) => c.min >= 98 * T);
  assert.deepEqual(room.filter((c) => !c.escapeOnly).map((c) => c.id), ["vault-guard"]);
  assert.deepEqual(room.filter((c) => c.escapeOnly).map((c) => c.id), ["landing"]);
});
test("1-5: the goal block needs white, and the green patrol's cone covers that climb when it faces it", () => {
  const level = getLevel("1-5"),
    c = level.guards.find((x) => x.id === "cross-green");
  const climb = { x: 117 * T - M.PLAYER.w / 2, y: 16 * T - M.PLAYER.h, w: M.PLAYER.w, h: M.PLAYER.h };
  const g = fresh("1-5");
  for (let x = c.min; x <= c.max; x += 8) {
    const probe = { ...c, x, dir: 1 };
    assert.ok(M.boxInCone(probe, climb, M.coneReach(g, probe)), `facing the goal from ${x}: the climb is in view`);
    assert.equal(M.boxInCone({ ...probe, dir: -1 }, climb, M.coneReach(g, { ...probe, dir: -1 })), false, "its back is the window");
  }
  const goalStep = { start: { x: 112 * T, feet: 16 * T }, top: 12 * T, past: 118 * T + 8 };
  assert.equal(anyReaches("1-5", { ...goalStep, form: "green" }, jumpFamily({ maxTakeoff: 60 })), false, "green can't climb it");
  assert.equal(anyReaches("1-5", { ...goalStep, form: "white" }, jumpFamily({ maxTakeoff: 60, air: true })), true, "white can");
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
      // The theft's checkpoint is inside the sealed room by design (the forced
      // smash); it is covered by its own respawn test (calm hold, distance).
      if (cp.get === "red") continue;
      const box = { x: cp.x - M.PLAYER.w / 2, y: cp.floor - M.PLAYER.h, w: M.PLAYER.w, h: M.PLAYER.h };
      for (const card of g.guards.filter((c) => !c.absorb))
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
  e.dir = 1; // facing away from where Rubik came from: a stomp from behind
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
test("body contact only knocks Rubik back the way he came; a calm card's back can be brushed; cards are solid", () => {
  const g = fresh("1-5"),
    c = only(g, "teacher");
  Object.assign(c, { x: 900, dir: -1, state: "suspect", turning: 0, pace: 0 });
  c.min = c.max = 900;
  place(g, 960, c.floor); // behind a suspicious (aware) card, walk into it
  ticks(g, seconds(0.4), { left: true });
  assert.equal(g.deaths, 0);
  assert.equal(events(g, "bump").length, 1);
  assert.ok(cx(g) > c.x, "pushed back the way he came");
  ticks(g, seconds(0.7), { right: true });
  assert.equal(g.phase, "playing", "running away after a bump is always possible");
  // A calm card facing away doesn't notice Rubik brushing its back.
  const b = fresh("1-5"),
    d = only(b, "teacher");
  Object.assign(d, { x: 900, dir: -1, state: "calm", turning: 0, pace: 0 });
  d.min = d.max = 900;
  place(b, 960, d.floor);
  ticks(b, seconds(0.4), { left: true });
  assert.equal(events(b, "bump").length, 0);
  assert.equal(d.state, "calm");
  assert.ok(cx(b) > d.x, "but it's still solid");
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
test("a card pinned at its patrol bound with Rubik out of reach gives up instead of spearing the air", () => {
  const g = fresh("1-5"),
    c = only(g, "teacher");
  Object.assign(c, { x: c.min, dir: -1, state: "alert", timer: 0, turning: 0 });
  place(g, c.min - M.GUARD.w / 2 - M.GUARD.spearReach - 60, c.floor); // just beyond the spear from the bound
  ticks(g, seconds(1.5));
  assert.equal(events(g, "windup").length, 0, "no endless wind-ups 10 px short");
  assert.ok(["search", "calm"].includes(c.state) && c.dir === 1, `it turned back (${c.state})`);
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
  ticks(r, seconds(0.6), { right: true });
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
  assert.ok(tap.player.vy < 0 && tap.player.vy > -(M.WORLD.jump * M.WORLD.jumpCut + 1));
});

// ------------------------------------------------------ movement feel ----
/** A flat, card-free strip for movement measurements (level 1-1 col 60-70). */
const flat = () => {
  const g = noCards(fresh("1-1"));
  place(g, 64 * T, 14 * T);
  return g;
};
test("movement: snappy start/stop/turn on the ground; full air control with a short drift", () => {
  const timeTo = (g, input, pred) => {
    let n = 0;
    while (!pred(g) && n++ < 240) ticks(g, 1, input);
    return n / 120;
  };
  const a = flat();
  assert.ok(timeTo(a, { right: true }, (g) => g.player.vx >= M.WORLD.speed) <= 0.135, "0 -> run in ~0.13 s");
  assert.ok(timeTo(a, {}, (g) => g.player.vx === 0) <= 0.105, "run -> stop in 0.1 s");
  ticks(a, seconds(0.3), { right: true });
  assert.ok(timeTo(a, { left: true }, (g) => g.player.vx <= 0) <= 0.06, "momentum cancelled in 0.055 s");
  assert.ok(timeTo(a, { left: true }, (g) => g.player.vx <= -M.WORLD.speed) <= 0.135, "then full speed the other way");
  // In the air: letting go drifts ~18 px, then stops.
  const d = flat();
  ticks(d, seconds(0.3), { right: true });
  ticks(d, 1, { right: true, jump: true });
  const x0 = d.player.x;
  ticks(d, seconds(0.2));
  assert.ok(d.player.x - x0 < 26 && d.player.vx === 0, `air drift ${(d.player.x - x0).toFixed(1)} px`);
});
test("movement: variable jump - a tap hops ~1 tile, a hold reaches 93 px; the apex hangs only while held", () => {
  const peak = (release) => {
    const g = flat();
    ticks(g, 1, { jump: true });
    if (release !== null) ticks(g, release, {}), ticks(g, 1, { jumpReleased: true });
    let top = Infinity;
    for (let i = 0; i < 120; i++) {
      ticks(g, 1);
      top = Math.min(top, feet(g));
    }
    return 14 * T - top;
  };
  const tap = peak(2),
    held = peak(null);
  assert.ok(held > 2 * T + 20 && held < 3 * T, `held ${held.toFixed(1)} px`);
  assert.ok(tap > 20 && tap < T + 16, `tap ${tap.toFixed(1)} px`);
  // Apex hang: the same jump spends longer near its peak when jump is held.
  const nearPeak = (hold) => {
    const g = flat();
    ticks(g, 1, { jump: true });
    if (!hold) g.player.jumpHeld = false; // released after the takeoff (no cut: vy already low later)
    let n = 0;
    for (let i = 0; i < 120; i++) {
      ticks(g, 1);
      if (Math.abs(g.player.vy) < M.WORLD.apexBand && !g.player.grounded) n++;
    }
    return n;
  };
  assert.ok(nearPeak(true) > nearPeak(false) * 1.6, `hang ${nearPeak(true)} vs ${nearPeak(false)} ticks`);
});
test("movement: falls are firmer than rises (x1.15 gravity past the apex), capped at 760 px/s", () => {
  const g = flat();
  ticks(g, 1, { jump: true });
  let rise = 0,
    fall = 0,
    peaked = false;
  for (let i = 0; i < 200 && !(peaked && g.player.grounded); i++) {
    ticks(g, 1);
    if (g.player.vy < 0) rise++;
    else if (g.player.vy > M.WORLD.apexBand) (peaked = true), fall++;
  }
  assert.ok(fall < rise, `fall ${fall} ticks < rise ${rise} ticks`);
  const drop = noCards(fresh("1-1"));
  place(drop, 98 * T, 0, { vx: 0 }); // from the top of the sky, over the first water's pit
  drop.player.grounded = false;
  let fastest = 0;
  for (let i = 0; i < 120 && drop.phase === "playing"; i++) {
    ticks(drop, 1);
    fastest = Math.max(fastest, drop.player.vy);
  }
  assert.equal(fastest, M.WORLD.maxFall);
});
test("movement: coyote time is 0.12 s (from the feet leaving) and the jump buffer 0.12 s, to the tick", () => {
  const coyote = (late) => {
    const g = noCards(fresh("1-1"));
    place(g, 12 * T - 30, 12 * T, { vx: 330 }); // running off the home cliff's edge
    for (let i = 0; i < 120 && g.player.grounded; i++) ticks(g, 1, { right: true });
    g.player.airJumped = true; // only the ground (coyote) jump is under test
    ticks(g, late, { right: true });
    ticks(g, 1, { right: true, jump: true });
    return g.player.vy < -400;
  };
  assert.equal(coyote(13), true, "a jump on the 14th airborne tick (0.117 s after the feet leave) still works");
  assert.equal(coyote(14), false, "the 15th (0.125 s) is too late");
  const buffer = (early) => {
    const g = flat();
    g.player.y -= 120;
    g.player.grounded = false;
    g.player.airJumped = true;
    g.player.coyote = 0; // a fall, not a walk-off: only the buffer is under test
    g.player.vy = 300;
    // Press `early` seconds before touching down.
    let ticksToLand = 0;
    const probe = structuredClone(g);
    Object.defineProperty(probe, "level", { value: g.level, enumerable: false });
    while (!probe.player.grounded && ticksToLand < 200) ticks(probe, 1), ticksToLand++;
    ticks(g, ticksToLand - Math.round(early * 120));
    ticks(g, 1, { jump: true });
    ticks(g, Math.round(early * 120) + 2);
    return g.player.vy < 0 && g.player.jumps === 1;
  };
  assert.equal(buffer(0.1), true, "pressed 0.1 s before landing: jumps on landing");
  assert.equal(buffer(0.15), false, "0.15 s early is outside the buffer");
});
test("movement: corner correction slides around a ceiling edge clipped by <= 6 px", () => {
  // The 1-3 corridor canopy's left corner: its underside is y = 416 and it
  // starts at x = 832. Rubik rises into it overlapping by `overlap` px.
  const rise = (overlap) => {
    const g = noCards(fresh("1-3"));
    Object.assign(g.player, { x: 26 * T + overlap - M.PLAYER.w, y: 13 * T + 1, vx: 0, vy: -300, grounded: false, rising: true, jumps: 1, grace: 0 });
    ticks(g, 2);
    return g.player;
  };
  const slide = rise(4);
  assert.ok(slide.vy < -200 && slide.y < 13 * T, "4 px: nudged past the corner, still rising");
  assert.ok(slide.x + slide.w <= 26 * T + 0.01);
  const bonk = rise(10);
  assert.ok(bonk.vy >= 0 && bonk.y >= 13 * T - 0.01, "10 px: a real bonk");
});
test("movement: ledge assist - a lip met with the feet <= 12 px below its top is climbed onto", () => {
  const meet = (below) => {
    const g = noCards(fresh("1-1"));
    // The 4-tile wall's face at col 71 (top row 10, y = 320); Rubik falling
    // toward it with his feet `below` px under its top.
    Object.assign(g.player, { x: 71 * T - M.PLAYER.w - 2, y: 10 * T + below - M.PLAYER.h, vx: 330, vy: 40, grounded: false, jumps: 1, grace: 0 });
    ticks(g, 12, { right: true });
    return g.player.grounded && Math.abs(feet(g) - 10 * T) < 1;
  };
  assert.equal(meet(10), true, "10 px short: lands on top");
  assert.equal(meet(18), false, "18 px short: slides down the face");
  assert.ok(M.WORLD.ledgeAssist < T && 93 + M.WORLD.ledgeAssist < 4 * T && 175 + M.WORLD.ledgeAssist < 6 * T, "never creates a climb");
});
test("movement: a ground dash-jump keeps 560 px/s and bleeds back to run speed; it goes further", () => {
  const run = (dashJump) => {
    const g = noCards(fresh("1-3")); // the glade: 700 px of flat, open ground
    place(g, 5 * T, 16 * T);
    g.dashUnlocked = true;
    ticks(g, seconds(0.2), { right: true });
    if (dashJump) {
      ticks(g, 1, { right: true, dash: true });
      ticks(g, seconds(0.08), { right: true });
    }
    ticks(g, 1, { right: true, jump: true });
    const x0 = g.player.x,
      v0 = g.player.vx;
    for (let i = 0; i < 240 && !(g.player.grounded && i > 5); i++) ticks(g, 1, { right: true });
    return { dist: g.player.x - x0, v0, vEnd: g.player.vx };
  };
  const plain = run(false),
    dj = run(true);
  assert.ok(dj.v0 > M.WORLD.dashJumpSpeed - 10, `kept ${dj.v0} px/s`);
  assert.ok(dj.dist > plain.dist + 20, `dash-jump ${dj.dist.toFixed(0)} px vs ${plain.dist.toFixed(0)} px in the air`);
  assert.ok(dj.vEnd <= M.WORLD.speed + 1, "back to run speed by landing");
  // An air dash finishes; a jump pressed during it fires when it ends (white).
  const a = flat();
  a.dashUnlocked = true;
  ticks(a, 1, { jump: true });
  ticks(a, seconds(0.2));
  ticks(a, 1, { dash: true, right: true });
  ticks(a, seconds(0.05), { right: true });
  ticks(a, 1, { jump: true, right: true }); // during the air dash
  ticks(a, seconds(0.2), { right: true });
  assert.equal(events(a, "airjump").length, 1, "the buffered air jump was not lost");
});
test("movement: every dash fires with a 4-tick freeze-frame; stomps freeze 0.08 s", () => {
  const g = flat();
  g.dashUnlocked = true;
  ticks(g, 1, { dash: true, right: true });
  assert.ok(g.hitstop > 0 && g.hitstop <= M.WORLD.dashFreeze);
  const x = g.player.x;
  ticks(g, 3, { right: true });
  assert.equal(g.player.x, x, "frozen");
  ticks(g, 3, { right: true });
  assert.ok(g.player.x > x + 10, "then the burst");
  assert.equal(M.WORLD.hitstop.stomp, 0.08);
});
test("no double-jump refresh exploits: slabs, swaps and the coyote window never grant a third jump", () => {
  // Swap away and back mid-air: still one air jump (tested above); coyote
  // jump then air jump: two jumps total; jumping through a slab: no refresh.
  const g = noCards(fresh("1-1"));
  place(g, 12 * T - 21, 12 * T);
  for (let i = 0; i < 30 && g.player.grounded; i++) ticks(g, 1, { right: true });
  ticks(g, 4, { right: true });
  ticks(g, 1, { right: true, jump: true }); // coyote jump
  ticks(g, seconds(0.2), { right: true });
  ticks(g, 1, { jump: true }); // air jump
  ticks(g, seconds(0.1));
  const before = g.player.vy;
  ticks(g, 1, { jump: true }); // a third press does nothing
  assert.ok(g.player.vy >= before);
  assert.equal(events(g, "airjump").length, 1);
});
test("collision matches the drawn sprites: hitboxes sit inside the opaque art, feet on the ground line", () => {
  const box = (file, cx, cy, w, h) => {
    const png = readPng(path.join(demo, "assets", file));
    let x0 = Infinity, x1 = -1, y0 = Infinity, y1 = -1;
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++)
        if (png.alpha(cx + x, cy + y) > 0) (x0 = Math.min(x0, x)), (x1 = Math.max(x1, x)), (y0 = Math.min(y0, y)), (y1 = Math.max(y1, y));
    return { x0, x1, y0, y1 };
  };
  // Rubik: 32 px frames drawn at 2x from (centre - 33, feet - 64). Hitbox 40 x 52.
  const r = box("rubik_white.png", 0, 0, 32, 32),
    left = -33 + 2 * r.x0,
    right = -33 + 2 * (r.x1 + 1),
    top = -64 + 2 * r.y0,
    bottom = -64 + 2 * (r.y1 + 1);
  assert.equal(bottom, 0, "feet on the sprite's bottom row");
  assert.ok(left <= -M.PLAYER.w / 2 && right >= M.PLAYER.w / 2, `hitbox inside the art horizontally (${left}..${right})`);
  assert.ok(top <= -M.PLAYER.h && -M.PLAYER.h - top <= 10, `head within 10 px of the art's top (${top})`);
  assert.ok(M.PLAYER.w >= (right - left) * 0.7, "the hitbox covers >= 70% of the art's width (no phantom misses)");
  // Green card: 86 x 67 frames drawn at 2x, feet at source row 64. Body 48 x 84.
  const c = box("inimigo_verde.png", 0, 134, 86, 67);
  assert.ok(Math.abs(-128 + 2 * (c.y1 + 1)) <= 6, "card feet on the ground line");
  assert.ok(-128 + 2 * c.y0 <= -M.GUARD.h, "the card's art reaches above its body (spear tip)");
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
