/** Color Rush Heist: pure deterministic simulation (no DOM, no images).
 *
 * Units: world pixels and seconds, fixed 120 Hz steps (advance/update). Y points
 * down. One tile = 32 px = one original 16 px cell at 2x (see level.mjs).
 *
 * Story logic of the stage: Rubik starts colorless (white = double jump),
 * stomps a dozing card to absorb its green (disguise among green cards), takes
 * red from the vault by touching it, and runs the same forest in REVERSE
 * (red dash smashes sealed stones and knocks cards aside) back to his home cliff.
 * A card can't see its own color: green cards see white/red, red enforcers see
 * white/green. Being seen escalates "?" -> "!" -> charge -> spear lunge; body
 * contact only knocks Rubik back. Only spears and water kill.
 */
import {
  TILE,
  COLS,
  ROWS,
  WATER_ROW,
  MAP,
  STONES,
  GUARDS,
  STICKERS,
  ORBS,
  CHECKPOINTS,
  SPAWN,
  VAULT,
  HOME,
  HINT_ZONES,
} from "./level.mjs";

export const WORLD = Object.freeze({
  tile: TILE,
  width: COLS * TILE,
  height: ROWS * TILE,
  viewportWidth: 960,
  viewportHeight: 540,
  gravity: 1180, // px/s^2
  maxFall: 760, // px/s; 6.3 px per 120 Hz tick, far below a 32 px tile
  speed: 330, // px/s run speed
  acceleration: 2600,
  braking: 3300, // a full-speed stop in 0.1 s
  jump: 470, // px/s -> ~95 px apex with apex half-gravity (2 tiles safe, never 3)
  airJump: 0.94, // white's air jump: +83 px, so 4-tile ledges need it
  apexBand: 60, // |vy| below this while holding jump = half gravity (Celeste)
  cornerCorrection: 6, // px nudge around ceiling corners while rising
  dashSpeed: 850,
  dashDuration: 0.17, // 145 px burst, gravity-free
  groundDashDelay: 0.25, // ground re-dash; air dashes need the single charge
  coyote: 0.1,
  jumpBuffer: 0.12,
  dashBuffer: 0.1, // a dash pressed during hit-stop or a dash's last frames still fires
  colorCooldown: 0.15, // generous: swapping is a skill tool, never blocked long
  storm: 0.18, // transformation animation (rubik_storm.png)
  stompBounce: 520, // ~115 px rebound
  respawnDelay: 0.45,
  respawnGrace: 0.75,
  bumpGrace: 0.6,
  hitstop: { stomp: 0.06, smash: 0.09, knock: 0.09, theft: 0.25 },
  orbRespawn: 2.5,
});

export const PLAYER = Object.freeze({ w: 40, h: 52 });

/** Card body at 2x: the drawn card is ~24 px wide and 42 px from its top edge
 * to its feet in the 86x67 source frame. Timings from RESEARCH.md M2. */
export const GUARD = Object.freeze({
  w: 48,
  h: 84,
  patrolSpeed: 100, // the original 50 px/s at 2x
  chargeSpeed: 240, // slower than Rubik's 330: a chase you can escape
  suspectAfter: 0.25, // s continuously seen -> "?" (stops, cone orange)
  alertAfter: 0.6, // s seen -> "!" (charge)
  searchTime: 1, // s unseen before "?" calms down again
  lookBack: 0.4, // telegraph pause before every turn
  windup: 0.35, // attack frames 0-3
  lunge: 0.25, // attack frames 4-6: travels up to lungeDistance
  lungeDistance: 128, // 4 tiles
  recover: 0.7, // frames 7-9: stompable opening
  stun: 3,
  spearReach: 66, // px beyond the body edge (lunge frame spear tip at 2x)
  spearLow: 30, // spear band, px above the card's floor: jumpable
  spearHigh: 70,
  lungeRange: 150, // start a windup when Rubik is this close in front
  bumpReaction: 0.6, // s a bumped card stands, "!" up, before it may attack
  notice: 0.45, // s a card stands on "!" before charging: time to back off or go green
  bumpKnock: 300, // px/s knockback from an unaware card...
  awareKnock: 440, // ...and from an aware one: thrown back the way he came
  spearOnBump: 3, // the 3rd bump on an aware card is answered with the spear
  escapeSpeed: 1.6, // after the theft green cards patrol faster...
  escapeSuspect: 0.15, // ...and grow suspicious sooner (escape pressure, no timer)
});

/** Sight cone = cone_de_visao.png (176x47) drawn at 2x. Per source column, the
 * first and last row whose alpha is > 0 (-1 = empty column). tests/
 * model.test.mjs re-derives these from the PNG, so detection IS the drawing.
 * Column 175 (the narrow bright tip) sits nearest the card's eyes. */
const CONE_TOP = [
  -1, 8, 6, 4, 3, 2, 1, 0, 0, 0, 2, 2, 2, 1, 1, 1, 2, 2, 2, 2, 2, 1,
  1, 2, 2, 2, 2, 2, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3,
  3, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 5, 4, 5, 5, 5,
  5, 6, 6, 6, 5, 5, 6, 6, 6, 6, 6, 6, 5, 5, 6, 7, 7, 7, 7, 7, 8, 7,
  7, 7, 7, 8, 8, 8, 7, 7, 7, 8, 8, 9, 9, 9, 9, 8, 8, 9, 9, 9, 9, 9,
  10, 9, 9, 9, 9, 9, 10, 11, 11, 10, 10, 10, 10, 11, 11, 11, 11, 11, 10, 11, 11, 11,
  11, 11, 12, 13, 12, 12, 12, 12, 12, 12, 13, 13, 12, 12, 12, 12, 13, 13, 13, 13, 13, 13,
  14, 14, 14, 14, 14, 14, 13, 14, 14, 14, 14, 14, 15, 15, 14, 14, 15, 15, 15, 16, 16, 16,
];
const CONE_BOTTOM = [
  -1, 14, 20, 26, 37, 43, 43, 45, 45, 45, 46, 45, 45, 45, 45, 45, 44, 44, 44, 44, 44, 44,
  43, 43, 44, 44, 44, 43, 42, 42, 42, 42, 42, 42, 41, 40, 40, 40, 40, 40, 40, 41, 41, 40,
  40, 40, 39, 39, 39, 39, 39, 38, 37, 37, 37, 37, 37, 38, 37, 37, 37, 36, 36, 36, 36, 36,
  36, 36, 36, 35, 35, 34, 34, 35, 35, 35, 34, 33, 33, 33, 33, 33, 33, 33, 32, 32, 32, 32,
  32, 31, 32, 32, 32, 31, 30, 30, 30, 30, 30, 30, 30, 29, 28, 28, 28, 28, 29, 28, 28, 28,
  28, 28, 27, 27, 27, 27, 27, 27, 25, 25, 25, 25, 26, 26, 26, 25, 25, 24, 24, 24, 24, 24,
  24, 24, 24, 23, 22, 22, 23, 23, 23, 23, 23, 21, 21, 21, 21, 21, 21, 20, 20, 19, 19, 19,
  19, 20, 20, 20, 20, 20, 19, 19, 18, 18, 18, 18, 18, 17, 16, 16, 16, 17, 17, 16, 16, 16,
];
export const CONE_PROFILE = Object.freeze(
  CONE_TOP.map((top, c) => (top < 0 ? null : Object.freeze([top, CONE_BOTTOM[c]]))),
);
export const CONE = Object.freeze({
  offset: 40, // tip distance in front of the body centre
  length: 352, // 176 source px at 2x
  top: 90, // image top, px above the card's floor (eye line ~58 px up)
  scale: 2,
  step: 8, // wall-truncation probe step (px along the cone)
});

const STONE_CELLS = new Map();
STONES.forEach((stone, index) => {
  for (let dy = 0; dy < 2; dy++)
    for (let dx = 0; dx < 2; dx++)
      STONE_CELLS.set(`${stone.x + dx},${stone.y + dy}`, index);
});

/** "Quick getaway" par: the QA baseline escape (17.7 s, tests/routes.mjs) x 1.5. */
export const MEDAL_PAR_ESCAPE = 27;

const tileChar = (tx, ty) =>
  ty < 0 || ty >= ROWS ? "." : tx < 0 || tx >= COLS ? "#" : MAP[ty][tx];
export function stoneAt(g, tx, ty) {
  const index = STONE_CELLS.get(`${tx},${ty}`);
  return index === undefined ? null : g.stones[index];
}
/** Solid for movement and sight: ground tiles and unbroken stones. */
export function blocked(g, tx, ty) {
  if (tileChar(tx, ty) === "#") return true;
  const stone = stoneAt(g, tx, ty);
  return !!stone && !stone.broken;
}
export const overlaps = (a, b) =>
  a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
/** Countdown that snaps to zero: 1/120 s steps leave float residue (2e-17)
 * that would otherwise keep a "> 0" timer alive for a whole extra tick. */
const tick = (value, dt) => (value - dt > 1e-9 ? value - dt : 0);
const toward = (v, target, amount) =>
  v < target ? Math.min(target, v + amount) : Math.max(target, v - amount);

function makePlayer(x, floor, color, direction) {
  return {
    x,
    y: floor - PLAYER.h,
    w: PLAYER.w,
    h: PLAYER.h,
    vx: 0,
    vy: 0,
    color,
    direction,
    grounded: true,
    jumps: 0,
    airJumped: false,
    jumpHeld: false,
    rising: false,
    coyote: WORLD.coyote,
    jumpBuffer: 0,
    jumpCutQueued: false,
    dashTime: 0,
    dashCooldown: 0,
    dashCharge: 1,
    dashBuffer: 0,
    dashDirection: direction,
    knock: 0,
    bumpGrace: 0,
    grace: WORLD.respawnGrace,
    storm: 0,
    stormFrom: color,
    landed: 0,
  };
}

function makeGuard(spec) {
  return {
    ...spec,
    state: spec.escapeOnly ? "away" : spec.mode === "sleep" ? "asleep" : "calm",
    bumps: 0,
    timer: 0,
    sight: 0,
    lost: 0,
    turning: 0,
    turnClock: 0,
    reach: CONE.length,
    sees: false,
    lungeTarget: spec.x,
    anim: 0,
  };
}

export function createGame() {
  return {
    phase: "ready",
    time: 0,
    hitstop: 0,
    deaths: 0,
    deathsHere: 0,
    deathTimer: 0,
    deathReason: "",
    deathAt: null,
    spotted: 0,
    stomps: 0,
    smashes: 0,
    knockouts: 0,
    respawns: 0,
    stolen: false,
    theftTime: null,
    finishTime: null,
    escapeTime: null,
    unlocked: { white: true, green: false, red: false },
    pendingAbsorb: 0,
    colorCooldown: 0,
    checkpoint: "home",
    checkpointIndex: 0,
    snapshot: null,
    player: makePlayer(SPAWN.x, SPAWN.floor, "white", 1),
    guards: GUARDS.map(makeGuard),
    stones: STONES.map((stone) => ({ ...stone, broken: false })),
    orbs: ORBS.map((orb) => ({ ...orb, respawn: 0 })),
    stickers: STICKERS.map(({ id, x, y }) => ({ id, x, y, collected: false })),
    hints: { move: "pending", white: "pending", green: "pending", dash: "pending", back: "pending" },
    hint: null,
    hintAge: 0,
    hintData: { idle: 0, zoneTime: 0, zoneJumps: 0, gapFails: 0, reoffered: {} },
    medals: null,
    events: [],
    eventId: 0,
  };
}

function event(g, type, x, y, extra = {}) {
  g.events.push({ type, x, y, time: g.time, id: ++g.eventId, ...extra });
  if (g.events.length > 40) g.events.shift();
}

export function startGame(g) {
  if (g.phase === "ready") {
    g.phase = "playing";
    saveCheckpoint(g, 0);
  }
  return g;
}

/** Whole-segment checkpoint: the world (cards, stones, orbs, unlocks, theft,
 * counters) is snapshotted, so a death rewinds everything consistently and no
 * counter can be farmed by dying. Stickers are deliberately NOT included: they
 * are permanent, unique pickups (taking one twice is impossible). Time, deaths
 * and times-spotted stay cumulative, so dying never cleans a record. */
function saveCheckpoint(g, index) {
  const cp = CHECKPOINTS[index];
  g.checkpoint = cp.id;
  g.checkpointIndex = index;
  g.deathsHere = 0;
  g.snapshot = structuredClone({
    // Awareness never persists into a respawn: a card mid-charge at save time
    // is restored calm where it stood, so a respawn is never an instant alert.
    guards: g.guards.map((guard) =>
      ["asleep", "drained", "stunned", "calm", "away"].includes(guard.state)
        ? guard
        : { ...guard, state: "calm", sight: 0, lost: 0, timer: 0 },
    ),
    stones: g.stones,
    orbs: g.orbs.map((orb) => ({ ...orb, respawn: 0 })),
    unlocked: g.unlocked,
    stolen: g.stolen,
    theftTime: g.theftTime,
    stomps: g.stomps,
    smashes: g.smashes,
    knockouts: g.knockouts,
    color: g.player.color,
  });
  if (g.phase === "playing" && g.time > 0) event(g, "checkpoint", cp.x, cp.floor, { id2: cp.id });
}

export function respawn(g) {
  const s = structuredClone(g.snapshot),
    cp = CHECKPOINTS[g.checkpointIndex];
  for (const key of ["guards", "stones", "orbs", "unlocked", "stolen", "theftTime", "stomps", "smashes", "knockouts"])
    g[key] = s[key];
  g.player = makePlayer(cp.x - PLAYER.w / 2, cp.floor, s.color, g.stolen ? -1 : 1);
  g.phase = "playing";
  g.deathTimer = 0;
  g.hitstop = 0;
  g.pendingAbsorb = 0;
  g.colorCooldown = 0;
  g.respawns++;
  event(g, "respawn", g.player.x, g.player.y);
  return g;
}

export function die(g, reason) {
  const p = g.player;
  if (g.phase !== "playing") return false;
  if (reason !== "water" && p.grace > 0) return false;
  g.phase = "dead";
  g.deaths++;
  g.deathsHere++;
  g.deathTimer = WORLD.respawnDelay;
  g.deathReason = reason;
  g.deathAt = { x: p.x, y: p.y, color: p.color, direction: p.direction };
  if (reason === "water" && inDashZone(p)) g.hintData.gapFails++;
  event(g, "die", p.x, p.y, { reason });
  return true;
}

export function switchColor(g, color) {
  const p = g.player;
  if (g.phase !== "playing" || !(color in g.unlocked)) return false;
  if (!g.unlocked[color]) {
    event(g, "locked", p.x, p.y, { color });
    return false;
  }
  if (g.colorCooldown > 0 || p.color === color) return false;
  p.stormFrom = p.color;
  p.color = color;
  p.storm = WORLD.storm;
  g.colorCooldown = WORLD.colorCooldown;
  event(g, "swap", p.x, p.y, { color, air: !p.grounded });
  if (color === "green" && g.hints.green === "shown") g.hints.green = "done";
  if (g.hints.back === "shown" && g.unlocked.green) g.hints.back = "done";
  if (color === "white" && g.hints.white === "shown") g.hints.white = "done";
  return true;
}

/** One air dash per airtime (Celeste charge). The ground always restores it;
 * stomps, refill orbs, smashed stones and knocked cards refill it mid-air. */
export function dash(g, axis = 0) {
  const p = g.player;
  if (g.phase !== "playing" || p.dashTime > 0 || p.dashCooldown > 0 || p.knock > 0) return false;
  if (!p.grounded && p.dashCharge <= 0) return false;
  if (!p.grounded) p.dashCharge = 0;
  p.dashDirection = axis || p.direction;
  p.direction = p.dashDirection; // facing and travel stay locked for the burst
  p.dashTime = WORLD.dashDuration;
  p.dashCooldown = WORLD.groundDashDelay;
  p.vy = 0;
  p.rising = false;
  event(g, "dash", p.x + p.w / 2, p.y + p.h / 2, { direction: p.dashDirection, color: p.color });
  return true;
}

function refill(g, source) {
  const p = g.player;
  const wasEmpty = p.dashCharge <= 0;
  p.dashCharge = 1;
  p.dashCooldown = 0;
  if (wasEmpty || source === "orb") event(g, "refill", p.x + p.w / 2, p.y, { source });
}

function tryJump(g) {
  const p = g.player;
  if (p.jumpBuffer <= 0 || p.dashTime > 0 || p.knock > 0) return false;
  const ground = p.grounded || p.coyote > 0;
  if (!ground && (p.color !== "white" || p.airJumped)) return false;
  p.vy = -WORLD.jump * (ground ? 1 : WORLD.airJump);
  if (p.jumpCutQueued) p.vy *= 0.5;
  if (!ground) p.airJumped = true;
  p.jumps = ground ? 1 : 2;
  p.grounded = false;
  p.rising = true;
  p.coyote = 0;
  p.jumpBuffer = 0;
  p.jumpCutQueued = false;
  event(g, ground ? "jump" : "airjump", p.x + p.w / 2, p.y + p.h);
  return true;
}

function smash(g, stone) {
  stone.broken = true;
  g.smashes++;
  g.hitstop = Math.max(g.hitstop, WORLD.hitstop.smash);
  refill(g, "smash");
  event(g, "smash", (stone.x + 1) * TILE, (stone.y + 1) * TILE, { stone: stone.id });
}

/** Horizontal move with tile collision. A red dash breaks stones on contact and
 * keeps going (its refund makes a chain of stones a single committed line). */
function moveX(g, dx) {
  const p = g.player;
  if (!dx) return false;
  p.x += dx;
  const top = Math.floor(p.y / TILE),
    bottom = Math.floor((p.y + p.h - 0.001) / TILE),
    col = dx > 0 ? Math.floor((p.x + p.w - 0.001) / TILE) : Math.floor(p.x / TILE);
  for (let row = top; row <= bottom; row++) {
    const stone = stoneAt(g, col, row);
    if (stone && !stone.broken && p.color === "red" && p.dashTime > 0) smash(g, stone);
    if (blocked(g, col, row)) {
      p.x = dx > 0 ? col * TILE - p.w : (col + 1) * TILE;
      return true;
    }
  }
  return false;
}

function boxFree(g, x, y, w, h) {
  for (let row = Math.floor(y / TILE); row <= Math.floor((y + h - 0.001) / TILE); row++)
    for (let col = Math.floor(x / TILE); col <= Math.floor((x + w - 0.001) / TILE); col++)
      if (blocked(g, col, row)) return false;
  return true;
}

/** Vertical move. Falling lands on solids and on one-way ledges only if the feet
 * started above the ledge top (so ledge undersides never snag a jump). Rising
 * into a ceiling corner by <=6 px slides around it instead of bonking. */
function moveY(g, dy, prevBottom) {
  const p = g.player;
  if (!dy) return null;
  p.y += dy;
  const left = Math.floor(p.x / TILE),
    right = Math.floor((p.x + p.w - 0.001) / TILE);
  if (dy > 0) {
    const row = Math.floor((p.y + p.h - 0.001) / TILE);
    for (let col = left; col <= right; col++)
      if (blocked(g, col, row) || (tileChar(col, row) === "=" && prevBottom <= row * TILE + 0.5)) {
        p.y = row * TILE - p.h;
        return "floor";
      }
    return null;
  }
  const row = Math.floor(p.y / TILE),
    hits = [];
  for (let col = left; col <= right; col++) if (blocked(g, col, row)) hits.push(col);
  if (!hits.length) return null;
  if (hits.length === 1) {
    const col = hits[0],
      shift = col === left ? (col + 1) * TILE - p.x : -(p.x + p.w - col * TILE);
    if (Math.abs(shift) <= WORLD.cornerCorrection && boxFree(g, p.x + shift, p.y, p.w, p.h)) {
      p.x += shift;
      return null;
    }
  }
  p.y = (row + 1) * TILE;
  return "ceiling";
}

function onGround(g) {
  const p = g.player,
    feet = p.y + p.h,
    row = Math.round(feet / TILE);
  if (Math.abs(feet - row * TILE) > 0.5) return false;
  for (let col = Math.floor(p.x / TILE); col <= Math.floor((p.x + p.w - 0.001) / TILE); col++)
    if (blocked(g, col, row) || tileChar(col, row) === "=") return true;
  return false;
}

export const guardBox = (guard) => ({
  x: guard.x - GUARD.w / 2,
  y: guard.floor - GUARD.h,
  w: GUARD.w,
  h: GUARD.h,
});
export function spearBox(guard) {
  const front = guard.x + guard.dir * (GUARD.w / 2);
  return {
    x: guard.dir > 0 ? front : front - GUARD.spearReach,
    y: guard.floor - GUARD.spearHigh,
    w: GUARD.spearReach,
    h: GUARD.spearHigh - GUARD.spearLow,
  };
}
/** World x-range [x0, x0 + 2) of cone column c (2x source column). */
export function coneColumnX(guard, c) {
  const u = (175 - c) * CONE.scale; // distance of this column's near edge from the tip
  return guard.dir > 0 ? guard.x + CONE.offset + u : guard.x - CONE.offset - u - CONE.scale;
}
/** Sight is cut at the first solid tile on the cone's own centre line, and the
 * renderer clips the drawing at the same distance, so the visible cone is the
 * detection area even next to walls and stones. */
export function coneReach(g, guard) {
  for (let u = 0; u < CONE.length; u += CONE.step) {
    const c = 175 - Math.floor(u / CONE.scale),
      span = CONE_PROFILE[c];
    if (!span) continue;
    const x = guard.dir > 0 ? guard.x + CONE.offset + u + 1 : guard.x - CONE.offset - u - 1,
      y = guard.floor - CONE.top + (span[0] + span[1] + 1);
    if (blocked(g, Math.floor(x / TILE), Math.floor(y / TILE))) return u;
  }
  return CONE.length;
}
/** Exact intersection of a box with the drawn cone silhouette, column by column. */
export function boxInCone(guard, box, reach = CONE.length) {
  const coneTop = guard.floor - CONE.top;
  for (let c = 175; c >= 1; c--) {
    const u = (175 - c) * CONE.scale;
    if (u >= reach) break;
    const x0 = coneColumnX(guard, c);
    if (x0 + CONE.scale <= box.x || x0 >= box.x + box.w) continue;
    const [top, bottom] = CONE_PROFILE[c],
      y0 = coneTop + top * CONE.scale,
      y1 = coneTop + (bottom + 1) * CONE.scale;
    if (y0 < box.y + box.h && y1 > box.y) return true;
  }
  return false;
}
export const canSee = (guard, color) => guard.kind !== color;

function alertGuard(g, guard, counted = true) {
  const wasAware = ["alert", "windup", "lunge", "recover", "search"].includes(guard.state);
  guard.state = "alert";
  guard.lost = 0;
  guard.turning = 0;
  // "!" is a beat, not an attack: the card stands before it charges.
  guard.timer = wasAware ? 0 : GUARD.notice;
  if (counted && !wasAware) {
    g.spotted++;
    event(g, "spotted", guard.x, guard.floor - GUARD.h, { guard: guard.id });
  }
}

function updateGuard(g, guard, dt) {
  const p = g.player;
  guard.anim += dt;
  if (guard.state === "drained" || guard.state === "away") return;
  guard.reach = coneReach(g, guard);
  if (guard.state === "asleep") {
    guard.sees = false;
    return;
  }
  if (guard.state === "stunned") {
    guard.sees = false;
    guard.timer -= dt;
    if (guard.timer <= 0) {
      guard.state = "search";
      guard.timer = GUARD.searchTime;
    }
    return;
  }
  const playerBox = { x: p.x, y: p.y, w: p.w, h: p.h },
    sees = g.phase === "playing" && canSee(guard, p.color) && boxInCone(guard, playerBox, guard.reach),
    dx = p.x + p.w / 2 - guard.x;
  guard.sees = sees;
  // Presentation hint: a cone sweeping over a disguised Rubik makes the card
  // hum ("♪") instead of reacting, so the disguise is visibly working.
  guard.disguiseSeen = g.phase === "playing" && !canSee(guard, p.color) && boxInCone(guard, playerBox, guard.reach);
  const clampX = () => {
    guard.x = Math.max(guard.min, Math.min(guard.max, guard.x));
  };
  switch (guard.state) {
    case "calm": {
      if (sees) {
        guard.sight += dt;
        if (guard.sight >= (g.stolen ? GUARD.escapeSuspect : GUARD.suspectAfter)) {
          guard.state = "suspect";
          guard.lost = 0;
          event(g, "suspect", guard.x, guard.floor - GUARD.h, { guard: guard.id });
          if (guard.kind === "green" && p.color === "white" && g.unlocked.green && g.hints.green === "pending") showHint(g, "green");
          // Safety net: white reached a green card without green. Point back
          // at the dozing card (it stays stompable from the clearing floor).
          if (guard.kind === "green" && !g.unlocked.green && g.hints.back === "pending") showHint(g, "back");
        }
        break;
      }
      guard.sight = Math.max(0, guard.sight - dt);
      if (guard.turning > 0) {
        guard.turning -= dt;
        if (guard.turning <= 0) guard.dir *= -1;
      } else if (guard.mode === "sentry") {
        guard.turnClock += dt;
        if (guard.turnClock >= (guard.turnEvery || 3)) {
          guard.turnClock = 0;
          guard.turning = GUARD.lookBack;
        }
      } else {
        const speed = GUARD.patrolSpeed * (g.stolen && guard.kind === "green" ? GUARD.escapeSpeed : 1);
        guard.x += guard.dir * speed * dt;
        if (guard.x <= guard.min || guard.x >= guard.max) {
          clampX();
          guard.turning = GUARD.lookBack;
        }
      }
      break;
    }
    case "suspect":
    case "search": {
      if (sees) {
        guard.lost = 0;
        guard.sight += dt;
        // A searching card already knows Rubik is near: one glimpse re-alerts.
        if (guard.state === "search" || guard.sight >= GUARD.alertAfter) alertGuard(g, guard);
      } else {
        guard.lost += dt;
        guard.sight = Math.max(0, guard.sight - dt * 0.5);
        if (guard.lost >= GUARD.searchTime) {
          guard.state = "calm";
          guard.sight = 0;
          guard.turnClock = 0;
          guard.bumps = 0;
        }
      }
      break;
    }
    case "alert": {
      if (sees) {
        guard.lost = 0;
        if (Math.abs(dx) > 4) guard.dir = Math.sign(dx);
      } else {
        guard.lost += dt;
        if (guard.lost >= GUARD.searchTime) {
          guard.state = "search";
          guard.lost = 0;
          guard.sight = 0;
          break;
        }
      }
      if (guard.timer > 0) {
        guard.timer = tick(guard.timer, dt);
        break;
      }
      const sameFloor = Math.abs(p.y + p.h - guard.floor) < 48;
      if (sees && sameFloor && Math.abs(dx) <= GUARD.lungeRange && Math.sign(dx) === guard.dir) {
        guard.state = "windup";
        guard.timer = GUARD.windup;
        event(g, "windup", guard.x, guard.floor - GUARD.h, { guard: guard.id });
        break;
      }
      guard.x += guard.dir * GUARD.chargeSpeed * dt;
      clampX();
      break;
    }
    case "windup": {
      guard.timer -= dt;
      if (guard.timer <= 0) {
        guard.state = "lunge";
        guard.timer = GUARD.lunge;
        guard.lungeTarget = Math.max(guard.min, Math.min(guard.max, guard.x + guard.dir * GUARD.lungeDistance));
      }
      break;
    }
    case "lunge": {
      guard.timer -= dt;
      guard.x = toward(guard.x, guard.lungeTarget, (GUARD.lungeDistance / GUARD.lunge) * dt);
      if (guard.timer <= 0) {
        guard.state = "recover";
        guard.timer = GUARD.recover;
      }
      break;
    }
    case "recover": {
      guard.timer -= dt;
      if (guard.timer <= 0) {
        guard.state = sees ? "alert" : "search";
        guard.lost = 0;
        guard.timer = 0;
      }
      break;
    }
  }
}

function stomp(g, guard) {
  const p = g.player;
  p.vy = -WORLD.stompBounce;
  p.jumps = 1;
  p.airJumped = false; // a bounce refreshes white's air jump
  p.rising = false;
  p.grounded = false;
  g.hitstop = Math.max(g.hitstop, WORLD.hitstop.stomp);
  refill(g, "stomp");
  if (guard.state === "drained") {
    // The grey card stays dazed forever: a springboard home in the escape.
    event(g, "bounce", guard.x, guard.floor - GUARD.h, { guard: guard.id });
    return;
  }
  if (guard.absorb && !g.unlocked.green) {
    // M1: the first card holds Rubik's green. It ejects it as a swirl; Rubik
    // absorbs it at the bounce apex so the stomp keeps white's full height.
    guard.state = "drained";
    g.pendingAbsorb = 0.6;
    event(g, "drain", guard.x, guard.floor - GUARD.h / 2, { guard: guard.id });
    return;
  }
  guard.state = "stunned";
  guard.timer = GUARD.stun;
  guard.sight = 0;
  g.stomps++;
  event(g, "stomp", guard.x, guard.floor - GUARD.h, { guard: guard.id });
}

function absorbGreen(g) {
  const p = g.player;
  g.pendingAbsorb = 0;
  g.unlocked.green = true;
  if (g.hints.back === "shown") g.hints.back = "done";
  if (g.hint === "back") g.hint = null;
  p.stormFrom = p.color;
  p.color = "green";
  p.storm = WORLD.storm;
  event(g, "absorb", p.x + p.w / 2, p.y + p.h / 2, { color: "green" });
  // The absorb is a commitment point: save here so green can never be "lost"
  // to a death and the drained card can never be drained twice.
  const index = CHECKPOINTS.findIndex((cp) => cp.id === "clearing");
  if (index > g.checkpointIndex) saveCheckpoint(g, index);
}

/** Push Rubik out of a card's body to the side he is on (cards are solid to
 * a non-matching color: you can't simply walk through a guard). */
function separate(g, box) {
  const p = g.player,
    left = p.x + p.w / 2 < box.x + box.w / 2,
    x = left ? box.x - p.w : box.x + box.w;
  if (boxFree(g, x, p.y, p.w, p.h)) p.x = x;
  if ((left && p.vx > 0) || (!left && p.vx < 0)) p.vx = 0;
}
const AWARE = ["alert", "windup", "lunge", "recover", "search", "suspect"];
function guardContacts(g, prevBottom) {
  const p = g.player;
  for (const guard of g.guards) {
    if (guard.state === "away") continue;
    const box = guardBox(guard),
      top = guard.floor - GUARD.h,
      widen = guard.catch ?? 10;
    // Stomps use a head wider than the body (Mario-style forgiveness; the
    // dozing first card is wider still); the previous foot height keeps side
    // contact from counting as a stomp.
    const head = { x: box.x - widen, y: box.y, w: box.w + widen * 2, h: box.h };
    if (p.vy > 0 && prevBottom <= top + 10 && guard.state !== "stunned" && overlaps(p, head)) {
      stomp(g, guard);
      continue;
    }
    if (!overlaps(p, box)) continue;
    if (guard.state === "drained" || guard.state === "stunned") continue;
    if (p.color === guard.kind) continue; // disguised: they let you through
    if (p.color === "red" && p.dashTime > 0) {
      // Red dash knocks a card aside and refunds the dash (M5/M7 power).
      guard.state = "stunned";
      guard.timer = GUARD.stun;
      guard.sight = 0;
      guard.bumps = 0;
      guard.x = Math.max(guard.min, Math.min(guard.max, guard.x + p.dashDirection * 40));
      g.knockouts++;
      g.hitstop = Math.max(g.hitstop, WORLD.hitstop.knock);
      refill(g, "knock");
      event(g, "knock", guard.x, guard.floor - GUARD.h / 2, { guard: guard.id });
      continue;
    }
    if (guard.state === "asleep" || p.bumpGrace > 0 || p.grace > 0) {
      separate(g, box); // solid, but no new bump (dozing cards don't wake)
      continue;
    }
    // Body contact never kills by itself: Rubik is thrown back the way he came
    // and the card notices. Ramming an aware card escalates: 0.6 s, then
    // 0.3 s to react, and the 3rd bump is answered with the spear.
    const aware = AWARE.includes(guard.state),
      away = Math.sign(p.x + p.w / 2 - guard.x) || -guard.dir;
    guard.bumps = aware ? guard.bumps + 1 : 1;
    separate(g, box);
    p.vx = away * (aware ? GUARD.awareKnock : GUARD.bumpKnock);
    p.vy = aware ? -300 : -260;
    p.knock = aware ? 0.22 : 0.16;
    p.dashTime = 0;
    p.bumpGrace = WORLD.bumpGrace;
    p.grounded = false;
    event(g, "bump", p.x + p.w / 2, p.y + p.h / 2, { guard: guard.id, bumps: guard.bumps });
    guard.dir = away; // turn to face Rubik
    alertGuard(g, guard);
    if (guard.bumps >= GUARD.spearOnBump) {
      guard.state = "lunge";
      guard.timer = GUARD.lunge;
      guard.lungeTarget = Math.max(guard.min, Math.min(guard.max, guard.x + guard.dir * GUARD.lungeDistance));
      event(g, "windup", guard.x, guard.floor - GUARD.h, { guard: guard.id });
    } else guard.timer = guard.bumps === 2 ? GUARD.bumpReaction / 2 : GUARD.bumpReaction;
  }
  for (const guard of g.guards)
    if (guard.state === "lunge" && p.grace <= 0 && overlaps(p, spearBox(guard))) die(g, "spear");
}

function steal(g) {
  const p = g.player;
  g.stolen = true;
  g.theftTime = g.time;
  g.unlocked.red = true;
  p.stormFrom = p.color;
  p.color = "red";
  p.storm = WORLD.storm;
  p.direction = -1;
  p.dashCharge = 1;
  p.dashCooldown = 0;
  p.grace = 1;
  g.hitstop = WORLD.hitstop.theft;
  // REVERSE: every card turns to face the route home (toward the vault side),
  // the two dozing guards behind the vault wake and charge.
  for (const guard of g.guards) {
    if (guard.state === "drained") continue;
    guard.dir = 1;
    guard.bumps = 0;
    if (guard.escapeOnly) {
      guard.state = "calm";
      event(g, "arrive", guard.x, guard.floor - GUARD.h, { guard: guard.id });
    } else if (guard.wakeOnTheft) {
      guard.dir = -1;
      alertGuard(g, guard, false);
    } else if (!["asleep", "stunned"].includes(guard.state)) {
      guard.state = "calm";
      guard.sight = 0;
      guard.turning = 0;
    }
  }
  event(g, "theft", VAULT.cx, VAULT.floor - VAULT.h / 2);
  saveCheckpoint(g, CHECKPOINTS.findIndex((cp) => cp.id === "vault"));
}

function inDashZone(p) {
  return p.x + p.w / 2 > HINT_ZONES.dash.x0 && p.x + p.w / 2 < HINT_ZONES.dash.x1;
}

function showHint(g, id) {
  if (g.hint === id) return;
  g.hint = id;
  g.hintAge = 0;
  if (g.hints[id] === "pending") g.hints[id] = "shown";
  event(g, "hint", g.player.x, g.player.y, { hint: id });
}

/** At most four contextual bubbles, each retired by the success it asks for. */
function updateHints(g, dt, input, wasGrounded) {
  const p = g.player,
    h = g.hintData,
    cx = p.x + p.w / 2,
    feet = p.y + p.h;
  g.hintAge += dt;
  // move: idle 4 s at the start.
  if (g.hints.move !== "done") {
    if (Math.abs(cx - (SPAWN.x + PLAYER.w / 2)) > 48) {
      g.hints.move = "done";
    } else if (!input.left && !input.right) {
      h.idle += dt;
      if (h.idle >= 4 && g.hints.move === "pending") showHint(g, "move");
    }
  }
  // white: green Rubik keeps failing the 4-tile white-only ledge.
  const z = HINT_ZONES.white;
  if (g.hints.white !== "done") {
    if (cx > z.x0 + 192 && feet <= z.top + 1) g.hints.white = "done";
    else if (cx > z.x0 && cx < z.x1 && p.color === "green") {
      if (input.jump) h.zoneJumps++;
      if (h.zoneJumps > 0) h.zoneTime += dt;
      if (h.zoneTime >= 2 && h.zoneJumps >= 1 && g.hints.white === "pending") showHint(g, "white");
    }
  }
  // dash: two failures at the first big gap (water deaths or the slow rock).
  if (g.hints.dash !== "done") {
    if (cx > HINT_ZONES.dash.x1 && feet <= 16 * TILE + 1 && p.grounded) g.hints.dash = "done";
    else if (!wasGrounded && p.grounded && Math.abs(feet - 18 * TILE) < 1 && cx > 119 * TILE && cx < 123 * TILE) h.gapFails++;
    if (h.gapFails >= 2 && g.hints.dash === "pending") showHint(g, "dash");
  }
  if (g.hint && (g.hints[g.hint] === "done" || g.hintAge > 7)) g.hint = null;
}

function interactions(g, dt) {
  const p = g.player,
    cx = p.x + p.w / 2,
    cy = p.y + p.h / 2;
  for (const sticker of g.stickers) {
    if (sticker.collected) continue;
    const nx = Math.max(p.x, Math.min(sticker.x, p.x + p.w)),
      ny = Math.max(p.y, Math.min(sticker.y, p.y + p.h));
    if ((nx - sticker.x) ** 2 + (ny - sticker.y) ** 2 < 14 ** 2) {
      sticker.collected = true;
      event(g, "sticker", sticker.x, sticker.y, { sticker: sticker.id, count: g.stickers.filter((s) => s.collected).length });
    }
  }
  for (const orb of g.orbs) {
    if (orb.respawn > 0) {
      orb.respawn = tick(orb.respawn, dt);
      continue;
    }
    if (p.dashCharge > 0 && p.dashTime <= 0) continue; // keep it for when it's needed
    if ((cx - orb.x) ** 2 + (cy - orb.y) ** 2 < 36 ** 2) {
      orb.respawn = WORLD.orbRespawn;
      refill(g, "orb");
    }
  }
  CHECKPOINTS.forEach((cp, index) => {
    if (cp.auto) return;
    const newer = g.stolen ? index < g.checkpointIndex : index > g.checkpointIndex;
    // A tall trigger column: jumping or dashing over a marker still counts.
    const feet = p.y + p.h;
    if (newer && Math.abs(cx - cp.x) < 40 && feet <= cp.floor + 1 && feet > cp.floor - 220) saveCheckpoint(g, index);
  });
  if (!g.stolen && overlaps(p, { x: VAULT.cx - VAULT.w / 2, y: VAULT.floor - VAULT.h, w: VAULT.w, h: VAULT.h })) steal(g);
}

export function update(g, dt, input = {}) {
  if (!Number.isFinite(dt) || dt <= 0) return;
  dt = Math.min(dt, 1 / 30); // a resumed tab never integrates a giant step
  if (g.phase === "dead") {
    g.time += dt;
    g.deathTimer -= dt;
    if (g.deathTimer <= 0) respawn(g);
    return;
  }
  if (g.phase !== "playing") return;
  g.time += dt;
  const p = g.player;
  // Input edges are latched even during hit-stop so a press is never lost.
  if (input.jump) {
    p.jumpBuffer = WORLD.jumpBuffer;
    p.jumpCutQueued = false;
    p.jumpHeld = true;
  }
  if (input.jumpReleased) {
    p.jumpHeld = false;
    if (p.jumpBuffer > 0) p.jumpCutQueued = true;
    else if (p.vy < 0 && p.rising) p.vy *= 0.5;
  }
  if (input.dash) p.dashBuffer = WORLD.dashBuffer;
  if (g.hitstop > 0) {
    g.hitstop = tick(g.hitstop, dt);
    if (input.color) switchColor(g, input.color);
    return;
  }
  g.colorCooldown = tick(g.colorCooldown, dt);
  p.grace = tick(p.grace, dt);
  p.bumpGrace = tick(p.bumpGrace, dt);
  p.storm = tick(p.storm, dt);
  p.dashCooldown = tick(p.dashCooldown, dt);
  p.jumpBuffer = tick(p.jumpBuffer, dt);
  p.knock = tick(p.knock, dt);
  p.landed = tick(p.landed, dt);
  if (!p.grounded) p.coyote = tick(p.coyote, dt);
  if (input.color) switchColor(g, input.color);
  const axis = p.knock > 0 ? 0 : Number(!!input.right) - Number(!!input.left);
  if (axis && p.dashTime <= 0 && p.knock <= 0) p.direction = axis;
  if (p.dashBuffer > 0 && dash(g, axis)) p.dashBuffer = 0;
  p.dashBuffer = tick(p.dashBuffer, dt);
  tryJump(g);
  const prevBottom = p.y + p.h,
    wasGrounded = p.grounded;
  if (p.dashTime > 0) {
    p.dashTime = tick(p.dashTime, dt);
    p.vx = p.dashDirection * WORLD.dashSpeed;
    p.vy = 0;
    if (p.dashTime <= 0) p.vx = p.dashDirection * WORLD.speed; // exit at run speed
  } else {
    if (p.knock <= 0)
      p.vx = toward(p.vx, axis * WORLD.speed, (axis ? WORLD.acceleration : WORLD.braking) * dt);
    // Only a held jump (or bounce) floats at its apex; walking off a ledge never does.
    const apex = p.jumpHeld && p.jumps > 0 && Math.abs(p.vy) < WORLD.apexBand && !p.grounded;
    p.vy = Math.min(WORLD.maxFall, p.vy + WORLD.gravity * (apex ? 0.5 : 1) * dt);
  }
  if (p.vy >= 0) p.rising = false;
  if (moveX(g, p.vx * dt)) {
    p.vx = 0;
    if (p.dashTime > 0) p.dashTime = 0;
  }
  p.x = Math.max(0, Math.min(WORLD.width - p.w, p.x));
  const hit = moveY(g, p.vy * dt, prevBottom);
  // A ceiling bonk starts the fall at once (no apex float under a low roof).
  if (hit) p.vy = hit === "ceiling" ? WORLD.apexBand : 0;
  p.grounded = onGround(g);
  if (p.grounded) {
    p.coyote = WORLD.coyote;
    p.jumps = 0;
    p.airJumped = false;
    if (p.dashTime <= 0) p.dashCharge = 1;
    if (!wasGrounded) {
      p.landed = 0.1;
      event(g, "land", p.x + p.w / 2, p.y + p.h, { speed: p.vx });
    }
  }
  if (p.grounded && p.jumpBuffer > 0) tryJump(g);
  if (g.pendingAbsorb > 0) {
    g.pendingAbsorb -= dt;
    if (p.vy >= 0 || g.pendingAbsorb <= 0) absorbGreen(g);
  }
  for (const guard of g.guards) updateGuard(g, guard, dt);
  guardContacts(g, prevBottom);
  if (g.phase !== "playing") return;
  interactions(g, dt);
  updateHints(g, dt, input, wasGrounded);
  if (p.y + p.h > WATER_ROW * TILE + 16 || p.y > WORLD.height) die(g, "water");
  if (g.phase !== "playing") return;
  // Death hints: three deaths at one checkpoint re-offer its bubble once.
  const cp = CHECKPOINTS[g.checkpointIndex];
  if (g.deathsHere >= 3 && cp.hint && !g.hintData.reoffered[cp.id] && g.hints[cp.hint] !== "done") {
    g.hintData.reoffered[cp.id] = true;
    showHint(g, cp.hint);
  }
  if (g.stolen && p.grounded && Math.abs(p.y + p.h - HOME.floor) < 1 && p.x + p.w / 2 < HOME.x1 && p.x + p.w / 2 > HOME.x0) win(g);
}

function win(g) {
  g.phase = "won";
  g.finishTime = g.time;
  g.escapeTime = g.time - g.theftTime;
  const stickers = g.stickers.filter((s) => s.collected).length;
  g.medals = {
    fullFace: stickers === 9,
    neverSpotted: g.spotted === 0,
    quickGetaway: g.escapeTime <= MEDAL_PAR_ESCAPE,
  };
  event(g, "win", g.player.x, g.player.y);
}

export const stickerCount = (g) => g.stickers.filter((s) => s.collected).length;

/** Fixed 120 Hz stepping in whole ticks (every step is exactly 1/120 s, so a
 * route replays identically in Node and the browser). Pulses (jump, dash,
 * color, jumpReleased) apply on the first tick only; left/right are held. */
export const TICK = 1 / 120;
export function advance(g, seconds, input = {}) {
  const span = Math.max(0, Math.min(seconds, 120)),
    steps = span > 0 ? Math.max(1, Math.round(span * 120)) : 0;
  for (let i = 0; i < steps; i++)
    update(g, TICK, i === 0 ? input : { left: input.left, right: input.right });
  return g;
}
