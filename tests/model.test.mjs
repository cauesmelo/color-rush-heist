import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as M from "../model.mjs";
import * as L from "../level.mjs";
import { BASELINE_ROUTE, MASTERY_ROUTE } from "./routes.mjs";
import { readPng } from "./png.mjs";

const here = path.dirname(fileURLToPath(import.meta.url)),
  demo = path.resolve(here, ".."),
  T = L.TILE;
const fresh = () => M.startGame(M.createGame());
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
function replay(route, stop = () => false) {
  const g = fresh();
  for (const [s, input] of route) {
    M.advance(g, s, input);
    if (stop(g)) break;
  }
  return g;
}
const events = (g, type) => g.events.filter((e) => e.type === type);
/** Isolate one card: everything else asleep far away, so nothing interferes. */
function only(g, id) {
  for (const other of g.guards) if (other.id !== id) other.state = "drained";
  return guard(g, id);
}

// ------------------------------------------------------------ opening -------
test("opening: walking right from home reaches the dozing card and absorbs green within 6 s", () => {
  const g = replay(BASELINE_ROUTE, (g) => g.unlocked.green);
  assert.equal(g.unlocked.green, true);
  assert.equal(g.player.color, "green");
  assert.ok(g.time < 6, `absorbed at ${g.time.toFixed(2)} s`);
  assert.equal(g.checkpoint, "clearing", "absorbing saves the clearing checkpoint");
  assert.equal(guard(g, "sleeper").state, "drained");
  // The two teaching stickers sit on the natural arcs: ditch jump, bounce apex.
  assert.deepEqual(
    g.stickers.filter((s) => s.collected).map((s) => s.id),
    [1, 2],
    "ditch arc and bounce apex",
  );
  assert.equal(g.deaths, 0);
  assert.equal(g.spotted, 0);
});
test("the colorless start: only white is unlocked and locked forms refuse with a cue", () => {
  const g = fresh();
  assert.deepEqual(g.unlocked, { white: true, green: false, red: false });
  assert.equal(M.switchColor(g, "green"), false);
  assert.equal(M.switchColor(g, "red"), false);
  assert.equal(events(g, "locked").length, 2);
  assert.equal(g.player.color, "white");
});
test("a dozing card never detects, even with white Rubik right in its cone", () => {
  const g = fresh(),
    s = only(g, "sleeper");
  s.state = "asleep";
  place(g, s.x + 160, s.floor);
  ticks(g, seconds(3));
  assert.equal(s.state, "asleep");
  assert.equal(g.spotted, 0);
});

test("the stomp can't be skipped: every walk, run, jump and double jump off the run-up lands on the dozing card", () => {
  const outcomes = [];
  for (let jumpAt = 1150; jumpAt <= 1390; jumpAt += 10)
    for (const air of [false, true]) {
      const g = fresh();
      place(g, 1120, 14 * T, { vx: 330 });
      let jumped = false,
        airJumped = false;
      for (let i = 0; i < 500 && !g.unlocked.green; i++) {
        let jump = false;
        if (!jumped && g.player.x + g.player.w / 2 >= jumpAt && g.player.grounded) jump = jumped = true;
        else if (air && jumped && !airJumped && g.player.vy > 0) jump = airJumped = true;
        ticks(g, 1, { right: true, jump });
      }
      outcomes.push(g.unlocked.green);
    }
  assert.equal(outcomes.filter(Boolean).length, outcomes.length, "no jump sails over it");
  // Slow nudges off the edge, and standing jumps at the edge.
  for (const hold of [4, 8, 12, 30]) {
    const g = fresh();
    place(g, 1362, 14 * T); // 2 px of foot still on the ledge
    for (let i = 0; i < 240 && !g.unlocked.green; i++) ticks(g, 1, { right: i < hold });
    assert.equal(g.unlocked.green, true, `nudge ${hold}`);
  }
});
test('safety net: a green card that sees white Rubik before green is unlocked points back at the dozing card', () => {
  const g = fresh(),
    c = only(g, "corridor-a");
  Object.assign(c, { x: 2100, dir: -1, state: "calm", turning: 0 });
  place(g, 1900, c.floor);
  ticks(g, seconds(0.4));
  assert.equal(g.hint, "back");
  // Going back is easy: the dozing card can be stomped straight from the floor.
  const s = guard(g, "sleeper");
  s.state = "asleep";
  place(g, 1366, s.floor); // between the wall and the card
  ticks(g, 1, { jump: true });
  ticks(g, seconds(0.38));
  ticks(g, seconds(0.6), { right: true });
  assert.equal(g.unlocked.green, true);
  assert.equal(g.hints.back, "done");
});

// ---------------------------------------------------------------- absorb ---
test("absorb green on the first stomp only; later stomps stun; the grey card is a springboard", () => {
  const g = fresh(),
    s = guard(g, "sleeper");
  // Walk off the ledge above the sleeper at any speed and land on its head.
  place(g, 1343, 14 * T);
  ticks(g, seconds(1.2), { right: true });
  assert.equal(s.state, "drained");
  assert.equal(g.unlocked.green, true);
  assert.equal(events(g, "drain").length, 1);
  assert.equal(events(g, "absorb").length, 1);
  assert.equal(g.stomps, 0, "draining is not a stun");
  // The drained card bounces Rubik but never stuns, drains or alerts again.
  ticks(g, seconds(1));
  place(g, s.x, s.floor - M.GUARD.h - 24, { vy: 150 });
  g.player.grounded = false;
  ticks(g, seconds(0.3));
  assert.equal(events(g, "bounce").length, 1);
  assert.equal(events(g, "absorb").length, 1);
  assert.equal(s.state, "drained");
  // Any other card: a stomp stuns it for 3 s and counts.
  const c = guard(g, "ledge");
  place(g, c.x, c.floor - M.GUARD.h - 30, { vy: 200 });
  g.player.grounded = false;
  ticks(g, seconds(0.2));
  assert.equal(c.state, "stunned");
  assert.equal(g.stomps, 1);
  assert.equal(events(g, "absorb").length, 1);
});

// ---------------------------------------------------------------- cone ------
test("cone detection is exactly the drawn cone_de_visao.png silhouette", () => {
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
  const g = fresh();
  for (const dir of [-1, 1]) {
    const card = { x: 1000, floor: 600, dir };
    let agree = 0,
      total = 0;
    for (let c = 0; c < 176; c++)
      for (let r = 0; r < 47; r++) {
        // The renderer draws image column c at 2x so that it covers exactly
        // coneColumnX(c) .. +2 (flipped for right-facing cards).
        const drawX = dir > 0 ? card.x + M.CONE.offset + M.CONE.length - (c + 1) * 2 : card.x - M.CONE.offset - M.CONE.length + c * 2;
        assert.equal(M.coneColumnX(card, c), drawX);
        const point = { x: drawX + 0.5, y: card.floor - M.CONE.top + r * 2 + 0.5, w: 1, h: 1 },
          span = M.CONE_PROFILE[c],
          drawn = !!span && r >= span[0] && r <= span[1];
        total++;
        if (M.boxInCone(card, point) === drawn) agree++;
      }
    assert.equal(agree, total, `facing ${dir}`);
  }
  // Walls cut the cone and the drawing at the same distance.
  const e = guard(g, "enforcer");
  e.dir = -1;
  const reach = M.coneReach(g, e);
  assert.ok(reach < M.CONE.length, "the step shields the post checkpoint");
  const behind = { x: e.x - M.CONE.offset - reach - 30, y: e.floor - 52, w: 20, h: 52 };
  assert.equal(M.boxInCone(e, behind, reach), false);
  assert.equal(M.boxInCone(e, behind), true, "would be inside without the wall");
});

// ------------------------------------------------------------- awareness ---
test('awareness: "?" after 0.25 s in sight, "!" at 0.6 s, calm again 1 s after losing sight', () => {
  const g = fresh();
  g.unlocked.green = true;
  const c = only(g, "corridor-b");
  Object.assign(c, { x: 2500, dir: 1, state: "calm", turning: 0 });
  place(g, 2700, c.floor);
  ticks(g, seconds(0.2));
  assert.equal(c.state, "calm");
  assert.ok(c.sees);
  ticks(g, seconds(0.07));
  assert.equal(c.state, "suspect");
  assert.equal(events(g, "suspect").length, 1);
  assert.equal(g.spotted, 0, '"?" is a warning, not a detection');
  ticks(g, seconds(0.36));
  assert.equal(c.state, "alert");
  assert.equal(g.spotted, 1);
  // A disguise breaks sight: the card searches, then calms down.
  M.switchColor(g, "green");
  ticks(g, seconds(1.05));
  assert.equal(c.state, "search");
  ticks(g, seconds(1.05));
  assert.equal(c.state, "calm");
  assert.equal(g.spotted, 1);
});
test("a suspicious card that loses sight before 0.6 s calms down without spotting", () => {
  const g = fresh();
  const c = only(g, "corridor-b");
  Object.assign(c, { x: 2500, dir: 1, state: "calm", turning: 0 });
  place(g, 2700, c.floor);
  ticks(g, seconds(0.3));
  assert.equal(c.state, "suspect");
  place(g, 2300, c.floor); // step behind it: room to retreat
  ticks(g, seconds(1.1));
  assert.equal(c.state, "calm");
  assert.equal(g.spotted, 0);
});

// ------------------------------------------------- contact and the spear ----
test("body contact only knocks Rubik back; the spear lunge kills; jumping over the spear is safe", () => {
  const g = fresh(),
    c = only(g, "corridor-a");
  Object.assign(c, { x: 2100, dir: -1, state: "calm", turning: 0 });
  place(g, 2150, c.floor); // behind it: outside the cone, then walk into it
  ticks(g, seconds(0.4), { left: true });
  assert.equal(g.phase, "playing");
  assert.equal(g.deaths, 0);
  assert.equal(events(g, "bump").length, 1);
  assert.ok(g.player.x + g.player.w / 2 > c.x, "pushed back the way he came");
  assert.equal(c.state, "alert", "the card noticed, but needs 0.6 s to react");
  ticks(g, seconds(0.7), { right: true });
  assert.equal(g.phase, "playing", "running away after a bump is always possible");
  // Spear: a lunging card's spear band kills on contact.
  const d = fresh(),
    s = only(d, "corridor-a");
  Object.assign(s, { x: 2100, dir: 1, state: "lunge", timer: M.GUARD.lunge, lungeTarget: 2100 });
  place(d, 2100 + 24 + 40, s.floor);
  ticks(d, 1);
  assert.equal(d.phase, "dead");
  assert.equal(d.deathReason, "spear");
  ticks(d, seconds(M.WORLD.respawnDelay + 0.02));
  assert.equal(d.phase, "playing", "respawns after 0.45 s");
  // Under open sky the same spear passes beneath a jumping Rubik (its band is
  // 30-70 px up). Inside the 3-tile corridor there is no room: be green there.
  const j = fresh(),
    u = only(j, "ledge");
  Object.assign(u, { x: 3150, dir: 1, state: "lunge", timer: M.GUARD.lunge, lungeTarget: 3150 });
  place(j, 3150 + 24 + 40, u.floor - 75, { vy: -100 });
  j.player.grounded = false;
  ticks(j, 1);
  assert.equal(j.phase, "playing");
});
/** From the clearing, run the corridor with a fixed reaction policy. */
function corridorRun(policy, seconds = 14) {
  const g = fresh();
  g.unlocked.green = true;
  guard(g, "sleeper").state = "drained";
  place(g, 1700, 18 * T, { color: policy === "green" ? "green" : "white", grace: 0 });
  let seenAt = null;
  const exit = 2860; // corridor exit (tiles 89-90), at the foot of the white ledge
  for (let i = 0; i < seconds * 120 && g.phase === "playing" && g.player.x + g.player.w / 2 < exit; i++) {
    if (seenAt === null && events(g, "spotted").length) seenAt = g.time;
    const reacting = seenAt !== null;
    const input =
      policy === "freeze" && reacting ? {} : policy === "back" && reacting ? { left: true } : { right: true };
    ticks(g, 1, input);
  }
  return { g, seenAt, passed: g.player.x + g.player.w / 2 >= exit, bumps: events(g, "bump").length };
}
test("stealth is the answer in the corridor: ramming fails, green passes, freezing gets a readable beat, backing off survives", () => {
  const ram = corridorRun("ram");
  assert.equal(ram.passed, false, "white can't shove through the corridor cards");
  assert.equal(ram.g.phase === "dead" || ram.g.deaths > 0, true, "the 3rd bump is answered with the spear");
  const green = corridorRun("green", 6);
  assert.equal(green.passed, true);
  assert.equal(green.bumps, 0);
  assert.equal(green.g.spotted, 0);
  const freeze = corridorRun("freeze");
  assert.ok(freeze.seenAt !== null);
  if (freeze.g.deaths) {
    const death = events(freeze.g, "die")[0];
    assert.ok(death.time - freeze.seenAt >= 0.8, `"!" to spear: ${(death.time - freeze.seenAt).toFixed(2)} s`);
  }
  const back = corridorRun("back", 6);
  assert.equal(back.g.deaths, 0, "backing off at the first \"!\" survives");
});
test("an aware card's bump throws Rubik back the way he came; cards are solid to other colors", () => {
  const g = fresh(),
    c = only(g, "corridor-b");
  Object.assign(c, { x: 2500, dir: -1, state: "alert", timer: 1, turning: 0 });
  place(g, 2440, c.floor, { vx: 330 });
  ticks(g, seconds(0.3), { right: true });
  assert.equal(events(g, "bump").length, 1);
  assert.ok(g.player.x + g.player.w / 2 < 2440 - 30, "thrown back toward the entrance");
  // During bump grace he still can't pass through it.
  ticks(g, seconds(0.5), { right: true });
  assert.ok(g.player.x + g.player.w <= c.x - M.GUARD.w / 2 + 1);
});
test("a card can't see its own color: enforcers see green but not red; green cards see white and red", () => {
  const g = fresh();
  g.unlocked.green = g.unlocked.red = true;
  const e = only(g, "enforcer");
  Object.assign(e, { dir: -1, state: "calm", turnClock: 0 });
  const box = (color) => ({ x: e.x - 200 - 20, y: e.floor - 52, w: 40, h: 52, color });
  assert.equal(M.canSee(e, "green") && M.boxInCone(e, box()), true);
  assert.equal(M.canSee(e, "white"), true);
  assert.equal(M.canSee(e, "red"), false);
  const c = guard(g, "corridor-a");
  assert.deepEqual(["white", "green", "red"].map((color) => M.canSee(c, color)), [true, false, true]);
  // In play: green Rubik standing in the enforcer's cone becomes suspicious.
  place(g, e.x - 200, e.floor);
  g.player.color = "green";
  ticks(g, seconds(0.3));
  assert.equal(e.state, "suspect");
  // Red Rubik is invisible to it and even passes through its body.
  const r = fresh();
  r.unlocked.red = true;
  const er = only(r, "enforcer");
  Object.assign(er, { dir: -1, state: "calm", turnClock: 0 });
  place(r, er.x - 200, er.floor);
  r.player.color = "red";
  ticks(r, seconds(1.5), { right: true });
  assert.equal(er.state, "calm");
  assert.ok(r.player.x > er.x, "walked straight through");
  assert.equal(events(r, "bump").length, 0);
});

// ------------------------------------------------------------- mid-air swap --
test("mid-air swap: a green jump keeps white's unspent air jump; a spent one never refreshes", () => {
  const g = fresh();
  g.unlocked.green = true;
  place(g, 3000, 14 * T);
  M.switchColor(g, "green");
  ticks(g, seconds(0.2));
  ticks(g, 1, { jump: true });
  ticks(g, seconds(0.2));
  ticks(g, 1, { jump: true });
  assert.equal(g.player.jumps, 1, "green has no air jump");
  assert.equal(M.switchColor(g, "white"), true, "swapping in the air is allowed");
  ticks(g, 1, { jump: true });
  assert.equal(g.player.jumps, 2);
  assert.equal(events(g, "airjump").length, 1);
  // Swap away and back (after the short 0.15 s cooldown): no third jump.
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

// ---------------------------------------------------------------- dash ------
test("dash charge: one air dash; ground, stomp, orb, smash and knockouts refill it", () => {
  const g = fresh();
  for (const x of g.guards) x.state = "drained";
  place(g, 3000, 14 * T);
  ticks(g, 1, { jump: true });
  ticks(g, seconds(0.1));
  assert.equal(M.dash(g, 1), true);
  assert.equal(g.player.dashCharge, 0);
  ticks(g, seconds(0.4));
  assert.equal(g.player.grounded, false);
  assert.equal(M.dash(g, 1), false, "no second air dash");
  ticks(g, seconds(1));
  assert.equal(g.player.grounded, true);
  assert.equal(g.player.dashCharge, 1, "landing restores it");
  // Ground dashes need no charge but wait 0.25 s between bursts.
  assert.equal(M.dash(g, -1), true);
  ticks(g, seconds(0.2));
  assert.equal(M.dash(g, -1), false);
  ticks(g, seconds(0.06));
  assert.equal(M.dash(g, -1), true);
  // Orb: refills an empty charge mid-air, then respawns after 2.5 s.
  const o = fresh(),
    orb = o.orbs[0];
  place(o, orb.x - 60, orb.y + 26, { dashCharge: 0, vy: -200, vx: 330 });
  o.player.grounded = false;
  assert.equal(M.dash(o, 1), false, "no charge, no air dash");
  ticks(o, seconds(0.25), { right: true });
  assert.ok(orb.respawn > 0, "orb consumed");
  assert.equal(o.player.dashCharge, 1);
  assert.equal(events(o, "refill").length, 1);
  place(o, 4650, 16 * T); // wait on safe ground
  ticks(o, seconds(2.6));
  assert.equal(o.orbs[0].respawn, 0, "orbs respawn after 2.5 s");
  // A full charge leaves the orb for later.
  const keep = fresh(),
    orb2 = keep.orbs[0];
  place(keep, orb2.x, orb2.y + 26, { dashCharge: 1 });
  keep.player.grounded = false;
  ticks(keep, 1);
  assert.equal(orb2.respawn, 0);
  // Stomp refill: falling onto a card with an empty charge.
  const s = fresh(),
    c = only(s, "ledge");
  place(s, c.x, c.floor - M.GUARD.h - 20, { vy: 200, dashCharge: 0 });
  s.player.grounded = false;
  ticks(s, seconds(0.15));
  assert.equal(c.state, "stunned");
  assert.equal(s.player.dashCharge, 1);
});

test("a red dash knocks a card aside (stun, refund); walking into it as red only bumps", () => {
  const g = fresh();
  g.unlocked.red = true;
  const c = only(g, "ledge");
  Object.assign(c, { x: 3150, dir: -1, state: "calm", turning: 0 });
  place(g, 3260, 14 * T, { color: "red", direction: -1 });
  ticks(g, 1, { jump: true });
  ticks(g, seconds(0.05));
  ticks(g, 1, { dash: true, left: true });
  assert.equal(g.player.dashCharge, 0);
  ticks(g, seconds(0.15), { left: true });
  assert.equal(c.state, "stunned");
  assert.equal(g.knockouts, 1);
  assert.equal(g.player.dashCharge, 1, "the knock refunds the air dash");
  assert.equal(events(g, "bump").length, 0);
});

// --------------------------------------------------------- sealed stones ----
test("sealed stones break only to a red dash, which refunds the dash", () => {
  const setup = (color) => {
    const g = fresh();
    g.unlocked.green = g.unlocked.red = true;
    for (const x of g.guards) x.state = "drained";
    place(g, 6400, 8 * T, { color, direction: 1 });
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
    assert.ok(g.player.x + g.player.w <= 201 * T + 0.01, "it stays solid");
  }
  const r = setup("red");
  ticks(r, 1, { dash: true, right: true });
  ticks(r, seconds(0.3), { right: true });
  assert.equal(stone(r).broken, true);
  assert.equal(r.smashes, 1);
  assert.equal(r.player.dashCharge, 1);
  assert.ok(r.player.x > 201 * T, "the dash carried on through");
  assert.ok(r.stickers.find((s) => s.id === 7).collected, "the alcove sticker is behind it");
});
test("stones are visible but inert inbound: white cannot hop the roof gate", () => {
  // Highest point of a white double jump from flat ground (both jumps held).
  const g = fresh();
  place(g, 3000, 14 * T);
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
  const rise = 14 * T - (top + M.PLAYER.h);
  assert.ok(rise > 4 * T, `white reaches a 4-tile ledge (${rise.toFixed(1)} px)`);
  const gate = L.STONES.find((s) => s.id === "roof-high");
  assert.ok(14 * T - gate.y * T > rise + 8, "the stacked roof gate is out of reach from the white ledge");
});

// ---------------------------------------------------------- theft/escape ----
test("touching the vault steals red: REVERSE turns the cards, wakes the burst, saves the vault", () => {
  const g = replay(BASELINE_ROUTE, (g) => g.stolen);
  assert.equal(g.stolen, true);
  assert.equal(g.unlocked.red, true);
  assert.equal(g.player.color, "red");
  assert.equal(g.checkpoint, "vault");
  assert.equal(events(g, "theft").length, 1);
  for (const id of ["burst-a", "burst-b"]) assert.ok(["alert", "windup", "lunge"].includes(guard(g, id).state));
  for (const id of ["corridor-a", "corridor-b", "enforcer"]) assert.equal(guard(g, id).dir, 1, `${id} faces the route home`);
});
test("an escape-only card is absent inbound and arrives on the island at the theft", () => {
  const inbound = replay(BASELINE_ROUTE, (g) => g.player.x > 4600);
  assert.equal(guard(inbound, "ambush").state, "away");
  assert.equal(events(inbound, "bump").length, 0);
  const g = replay(BASELINE_ROUTE, (g) => g.stolen);
  assert.equal(guard(g, "ambush").state, "calm");
  assert.equal(events(g, "arrive").length, 1);
  // Green cards hunt on the way home: faster patrols, quicker suspicion.
  assert.ok(M.GUARD.escapeSpeed > 1 && M.GUARD.escapeSuspect < M.GUARD.suspectAfter);
});
test("the escape has no fail timer: red Rubik can wait two minutes", () => {
  const g = replay(BASELINE_ROUTE, (g) => g.stolen);
  // Walk down to the stairs checkpoint (outside every card's range) and wait.
  for (let i = 0; i < 800 && g.player.x > 5240; i++) ticks(g, 1, { left: true });
  ticks(g, seconds(120));
  assert.equal(g.phase, "playing");
  assert.equal(g.escapeTime, null);
  assert.equal(g.stolen, true);
});
test("home only ends the stage after the theft", () => {
  const g = fresh();
  ticks(g, seconds(1));
  assert.equal(g.phase, "playing");
  assert.equal(g.medals, null);
});

// ------------------------------------------------------ stickers/checkpoints -
test("stickers are permanent: a death keeps them and they can't be taken twice", () => {
  const g = replay(BASELINE_ROUTE, (g) => g.stickers.find((s) => s.id === 1).collected);
  assert.ok(g.stickers.find((s) => s.id === 1).collected);
  assert.ok(g.time < 4);
  M.die(g, "water");
  ticks(g, seconds(0.5));
  assert.equal(g.phase, "playing");
  assert.equal(M.stickerCount(g), 1);
  const s = g.stickers.find((x) => x.id === 1);
  place(g, s.x, s.y + 26);
  ticks(g, 2);
  assert.equal(events(g, "sticker").length, 1);
});
test("checkpoints restore the whole segment; nothing is farmable; deaths and spotting stay cumulative", () => {
  const g = replay(BASELINE_ROUTE, (g) => g.checkpoint === "post");
  const stompsAtSave = g.stomps,
    e = guard(g, "enforcer");
  // Stomp the enforcer, get spotted by bumping it, then fall in the water.
  place(g, e.x, e.floor - M.GUARD.h - 20, { vy: 200 });
  g.player.grounded = false;
  ticks(g, seconds(0.1));
  assert.equal(e.state, "stunned");
  assert.equal(g.stomps, stompsAtSave + 1);
  const spotted = g.spotted;
  place(g, 4400, 600, { vy: 300 });
  g.player.grounded = false;
  ticks(g, seconds(1));
  assert.equal(g.deaths, 1);
  assert.equal(g.checkpoint, "post");
  const back = guard(g, "enforcer");
  assert.notEqual(back.state, "stunned", "the stomped card is restored");
  assert.equal(g.stomps, stompsAtSave, "the stomp can't be banked by dying");
  assert.equal(g.spotted, spotted);
  assert.ok(Math.abs(g.player.x + g.player.w / 2 - 4650) < 1, "respawn at the marker");
  // Walking back over an older marker never moves the respawn backwards.
  place(g, 3440, 16 * T);
  ticks(g, 2);
  assert.equal(g.checkpoint, "post");
  // Stones and the alcove sticker after the theft: stone restored, sticker kept.
  const m = replay(MASTERY_ROUTE, (g) => g.stickers.find((s) => s.id === 7).collected);
  assert.equal(m.stones.find((s) => s.id === "alcove").broken, true);
  M.die(m, "water");
  ticks(m, seconds(0.5));
  assert.equal(m.checkpoint, "vault");
  assert.equal(m.stones.find((s) => s.id === "alcove").broken, false, "world rewinds");
  assert.equal(m.stickers.find((s) => s.id === 7).collected, true, "the sticker is his for good");
});
test("no respawn point can ever be inside a sight cone (any card, any patrol position, both facings)", () => {
  const g = fresh();
  for (const cp of L.CHECKPOINTS) {
    const box = { x: cp.x - M.PLAYER.w / 2, y: cp.floor - M.PLAYER.h, w: M.PLAYER.w, h: M.PLAYER.h };
    // (The dozing first card only ever sleeps and then stays drained.)
    for (const card of g.guards.filter((c) => !c.absorb))
      for (let x = card.min; x <= card.max; x += 4)
        for (const dir of [-1, 1]) {
          const probe = { ...card, x, dir };
          assert.equal(M.boxInCone(probe, box, M.coneReach(g, probe)), false, `${cp.id} seen by ${card.id} at ${x} facing ${dir}`);
        }
  }
});
test("checkpoints are at most 35 s of baseline play apart and the respawn delay is 0.45 s", () => {
  const g = fresh(),
    saves = [0];
  let last = "home";
  for (const [s, input] of BASELINE_ROUTE) {
    M.advance(g, s, input);
    if (g.checkpoint !== last) {
      saves.push(g.time);
      last = g.checkpoint;
    }
  }
  saves.push(g.finishTime);
  for (let i = 1; i < saves.length; i++) assert.ok(saves[i] - saves[i - 1] <= 35, `gap ${i}: ${(saves[i] - saves[i - 1]).toFixed(1)} s`);
  assert.equal(M.WORLD.respawnDelay, 0.45);
});

// ---------------------------------------------------------------- hints -----
test("hints: four teaching bubbles plus one safety net, each triggered by its moment", () => {
  // "back" only exists for a player who reaches a green card without green.
  assert.deepEqual(Object.keys(fresh().hints), ["move", "white", "green", "dash", "back"]);
  // move: idle 4 s at the start.
  const idle = fresh();
  ticks(idle, seconds(4.1));
  assert.equal(idle.hint, "move");
  ticks(idle, seconds(0.5), { right: true });
  assert.equal(idle.hints.move, "done");
  // white: green Rubik jumping at the 4-tile ledge for 2 s.
  const w = replay(BASELINE_ROUTE, (g) => g.player.x + g.player.w / 2 > 2870);
  for (let i = 0; i < 4; i++) {
    ticks(w, 1, { jump: true, right: true });
    ticks(w, seconds(0.7), { right: true });
  }
  assert.equal(w.hint, "white");
  M.switchColor(w, "white");
  assert.equal(w.hints.white, "done");
  // dash: two slow landings on the recovery rock in the first big gap.
  const d = fresh();
  d.unlocked.green = true;
  for (const x of d.guards) x.state = "drained";
  for (let k = 0; k < 2; k++) {
    place(d, 3590, 16 * T, { color: "green" });
    ticks(d, 1, { jump: true, right: true });
    ticks(d, seconds(1.2), { right: true });
  }
  assert.equal(d.hint, "dash");
});

// ------------------------------------------------------------- physics ------
test("geometry matches the jump: 2-tile ledges for everyone, 3 tiles never, 4 needs white", () => {
  const g = fresh();
  place(g, 3000, 14 * T);
  ticks(g, 1, { jump: true });
  let top = g.player.y;
  for (let i = 0; i < 120; i++) {
    ticks(g, 1);
    top = Math.min(top, g.player.y);
  }
  const apex = 14 * T - (top + M.PLAYER.h);
  assert.ok(apex > 2 * T + 20, `single jump clears 2 tiles (${apex.toFixed(1)} px)`);
  assert.ok(apex < 3 * T, "a 3-tile ledge is not reachable (so the map never uses one)");
  // Authored gates: the white ledge is 4 tiles over the corridor exit, the
  // corridor is 3 tiles tall (a card fits, a jump over it doesn't).
  assert.equal(L.MAP[13][91], ".");
  assert.equal(L.MAP[14][91], "#");
  assert.equal(L.MAP[18][90], "#");
  assert.ok(M.GUARD.h < 3 * T && M.GUARD.h + M.PLAYER.h > 3 * T);
  for (let x = 57; x < 88; x++) assert.equal(L.MAP[14][x] + L.MAP[15][x] + L.MAP[16][x] + L.MAP[17][x], "#...", `corridor column ${x}`);
});
test("the map never asks for a 3-tile climb (95 px apex vs 96 px: the broken-feeling height)", () => {
  const solid = (x, y) => y >= 0 && y < L.ROWS && x >= 0 && x < L.COLS && L.MAP[y][x] === "#";
  const climbs = new Map();
  for (let x = 1; x < L.COLS - 1; x++)
    for (let y = 1; y < L.ROWS; y++) {
      const standable = (L.MAP[y][x] === "#" || L.MAP[y][x] === "=") && !solid(x, y - 1) && !solid(x, y - 2);
      if (!standable) continue;
      for (const nx of [x - 1, x + 1]) {
        if (!solid(nx, y)) continue; // a drop, not a climb
        let top = y;
        while (top > 0 && solid(nx, top - 1)) top--;
        const rise = y - top;
        climbs.set(rise, (climbs.get(rise) || 0) + 1);
        assert.notEqual(rise, 3, `3-tile wall next to column ${x}, row ${y}`);
      }
    }
  assert.ok(climbs.get(2) >= 8 && climbs.get(4) === 2, "2-tile steps everywhere; exactly two 4-tile walls (white ledge, clearing)");
});
test("pause freezes everything; a resumed tab can't integrate a giant frame", () => {
  const g = fresh();
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
  // Coyote: jump just after walking off the step.
  const c = fresh();
  place(c, 560, 14 * T, { vx: 330 });
  for (let i = 0; i < 60 && c.player.grounded; i++) ticks(c, 1, { right: true });
  assert.equal(c.player.grounded, false);
  ticks(c, 6, { right: true });
  assert.ok(c.player.coyote > 0);
  ticks(c, 1, { right: true, jump: true });
  assert.ok(c.player.vy < -400 && c.player.jumps === 1);
  // Buffer: pressed 0.08 s before landing still fires.
  const b = fresh();
  place(b, 3000, 14 * T - 20, { vy: 250 });
  b.player.grounded = false;
  b.player.color = "white";
  b.player.airJumped = true;
  ticks(b, 1, { jump: true });
  ticks(b, seconds(0.12));
  assert.equal(b.player.jumps, 1);
  assert.ok(b.player.vy < 0);
  // Variable height: releasing early makes a much lower arc.
  const full = fresh(),
    short = fresh();
  for (const g of [full, short]) place(g, 3000, 14 * T);
  ticks(full, 1, { jump: true });
  ticks(short, 1, { jump: true });
  ticks(full, seconds(0.08));
  ticks(short, seconds(0.08));
  ticks(short, 1, { jumpReleased: true });
  ticks(full, seconds(0.3));
  ticks(short, seconds(0.3));
  assert.ok(short.player.y > full.player.y + 25);
  // Same tick press + release: a short hop, not a lost jump.
  const tap = fresh();
  place(tap, 3000, 14 * T);
  ticks(tap, 1, { jump: true, jumpReleased: true });
  assert.ok(tap.player.vy < 0 && tap.player.vy > -WORLD_HALF_JUMP());
});
function WORLD_HALF_JUMP() {
  return M.WORLD.jump * 0.5 + 1;
}

// ---------------------------------------------------------------- routes ----
test("baseline route wins: zero deaths, never spotted, red home, 3 stickers", () => {
  const g = replay(BASELINE_ROUTE);
  assert.equal(g.phase, "won");
  assert.equal(g.stolen, true);
  assert.equal(g.deaths, 0);
  assert.equal(g.spotted, 0);
  assert.equal(M.stickerCount(g), 3);
  assert.equal(g.medals.neverSpotted, true);
  assert.equal(g.medals.quickGetaway, true);
  assert.ok(g.escapeTime * 1.5 <= M.MEDAL_PAR_ESCAPE + 0.5, "par = QA escape x 1.5");
});
test("mastery route wins with all 9 stickers (full face) and zero deaths", () => {
  const g = replay(MASTERY_ROUTE);
  assert.equal(g.phase, "won");
  assert.equal(g.deaths, 0);
  assert.equal(M.stickerCount(g), 9);
  assert.equal(g.medals.fullFace, true);
  assert.ok(g.smashes >= 4, "both roof gates and the alcove stone");
  assert.ok(g.knockouts >= 3);
});
test("routes are plain JSON [seconds, input] arrays of ordinary actions", () => {
  const allowed = new Set(["left", "right", "jump", "jumpReleased", "dash", "color"]);
  for (const route of [BASELINE_ROUTE, MASTERY_ROUTE]) {
    assert.deepEqual(JSON.parse(JSON.stringify(route)), route);
    for (const [s, input] of route) {
      assert.ok(s > 0 && s < 10);
      for (const key of Object.keys(input)) assert.ok(allowed.has(key), key);
      if (input.color) assert.ok(["white", "green", "red"].includes(input.color));
    }
  }
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
    // Each copy must match the hash recorded from the original Godot project,
    // so the check also works when this repository is cloned on its own.
    assert.equal(sha(path.join(demo, "assets", entry.file)), entry.sha256, entry.file);
    // In the full workspace, also byte-compare with the untouched original.
    const original = path.join(demo, "..", "refs", "color-theft-story", "assets", entry.file);
    if (existsSync(original)) assert.equal(entry.sha256, sha(original), entry.file);
  }
  // The on-screen tile record is computed from the actual map, not hand-kept.
  const onTiles = new Set(L.tilesOnScreen());
  for (let n = 1; n <= 60; n++) {
    const entry = manifest.find((e) => e.file === `tiles/Tile_${String(n).padStart(2, "0")}.png`);
    assert.equal(entry.use, onTiles.has(n) ? "screen" : "archive", entry.file);
  }
  for (const entry of manifest) if (entry.file.startsWith("player/")) assert.equal(entry.use, "archive", "unverified third-party pack");
});
