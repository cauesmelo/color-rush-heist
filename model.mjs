/** Color Rush Heist: pure deterministic simulation (no DOM, no images).
 *
 * Units: world pixels and seconds, fixed 120 Hz steps (advance/update). Y points
 * down. One tile = 32 px = one original 16 px cell at 2x (levels/builder.mjs).
 *
 * One game = one level of World 1 (`createGame(level, options)`). A level is
 * plain frozen data (levels/*.mjs): its map, cards, stickers, checkpoints, a
 * fixed ability kit and how it ends (a goal face, or the vault + the run home).
 * The campaign (order, unlocks, save) lives in campaign.mjs; this file never
 * touches storage.
 *
 * Story logic of World 1: Rubik starts colorless (white = double jump), learns
 * to bounce on dozing cards, absorbs green from a glowing card (GREEN GET: a
 * disguise among green cards), catches a stray storm swirl (DASH GET), and in
 * the last level takes red from the vault by touching it (RED GET) and runs the
 * same forest in REVERSE (red dash smashes sealed stones and knocks cards aside)
 * back to the level's start. A card can't see its own color: green cards see
 * white/red, red enforcers see white/green. Being seen escalates "?" -> "!" ->
 * charge -> spear lunge; body contact only knocks Rubik back. Only spears and
 * water kill.
 */
import { TILE, ROWS, WATER_ROW } from "./levels/builder.mjs";
import { getLevel } from "./levels/index.mjs";

export const WORLD = Object.freeze({
  tile: TILE,
  height: ROWS * TILE, // every level is 22 rows; widths differ (level.width)
  viewportWidth: 960,
  viewportHeight: 540,
  // ---- Movement feel (crisp, readable, expressive; tests pin every number) --
  // MOVEMENT_AUDIT.md measures each against common/docs/MOVEMENT_CRITERIA.md.
  // Vertical: rise under 1180 px/s^2, fall 30% harder once past the apex band
  // (an asymmetric arc: the landing reads firm and quick), and a held jump
  // floats at its peak. Rise gravity sets every height (93 / 175 / 195 px);
  // the fall factor only shortens the descent, so no gating height moves.
  gravity: 1180, // px/s^2 while rising
  fallGravity: 1.3, // x gravity once vy > apexBand (rubric band 1.3-2.2)
  maxFall: 760, // px/s; 6.3 px per 120 Hz tick, far below a 32 px tile
  jump: 470, // px/s -> 93 px apex with the apex hang (2 tiles safe, never 3)
  airJump: 0.94, // white's air jump: +83 px (175 px in all), so 4-tile ledges need it
  apexBand: 60, // |vy| below this while jump is held: half gravity (the apex hang)
  jumpCut: 0.6, // releasing jump while rising keeps 60% of vy: a tap is a 34 px hop
  // (0.36 of the 93 px held jump: a hop clears one tile, a hold two)
  // Horizontal: snappy starts and stops, a near-instant turnaround on the
  // ground, strong air control (precision first) with a little drift on release.
  speed: 330, // px/s run speed
  acceleration: 3300, // 0 -> 330 in 0.10 s (12 ticks)
  braking: 3300, // no input on the ground: 330 -> 0 in 0.10 s
  turn: 8000, // input against motion on the ground: momentum gone in 0.042 s, so a
  // full 330 -> -330 turnaround takes 0.142 s (rubric: <= 0.15 s)
  airAcceleration: 2600, // 79% of the ground's: the arc is the player's to steer
  airTurn: 4200, // reversing mid-air: 0.21 s, never an instant flip
  airBraking: 3000, // letting go mid-air drifts ~18 px before stopping (precise stomps)
  // Forgiveness windows.
  coyote: 0.12, // s: a ground jump still works for 14 ticks (117 ms) after the FEET leave
  // a ledge. Support is the feet's span (PLAYER.foot), 9 px inside each box
  // edge, so this is the old 11-tick window counted from the box leaving
  // plus the 3 ticks a run takes to clear those 9 px: the same takeoff point.
  jumpBuffer: 0.12, // s a jump press waits for the ground (kept alive through an air dash)
  dashBuffer: 0.1, // a dash pressed during hit-stop or a dash's last frames still fires
  cornerCorrection: 6, // px: rising into a ceiling corner by <= 6 px slides around it
  ledgeAssist: 12, // px: hitting a lip with the feet <= 12 px below its top steps onto it.
  // 12 < 32 (one tile), so it never creates a climb: 93 + 12 < 128 and 175 + 12 < 192
  // keep every white-only and bounce-only height in the maps out of reach.
  // Lip rest: the box's edge is on a lip but the feet are over the air. Moving
  // toward the lip scrambles onto it (at least this fast); otherwise Rubik
  // slips off (at least this fast). Either way it lasts <= 9 px (4 ticks), so
  // he never stands on the air beside a ledge.
  scramble: 300, // px/s
  slip: 360, // px/s
  stompGrace: 0.05, // s after the stomp freeze in which a jump press still makes the high bounce
  // Dash: horizontal only (left/right/facing), so gap rules stay exact and readable.
  dashSpeed: 850,
  dashDuration: 0.17, // 145 px burst, gravity-free
  dashFreeze: 0.033, // a 4-tick freeze-frame as the dash fires (impact, not lag)
  groundDashDelay: 0.25, // ground re-dash; air dashes need the single charge
  // Dash-jump: jumping during a ground dash keeps 560 px/s of it, bleeding back
  // to run speed at 900 px/s^2: ~+30 px in the air, +2 tiles of gap with the
  // dash's run-up (green 11 -> 13 tiles). Player expression, never required.
  dashJumpSpeed: 560,
  carryDecay: 900,
  // Stomp: hold jump (or press it as you land) for the high bounce.
  stompBounce: 520, // held: 195 px over the card's floor at the peak (111 over its head)
  stompBounceLow: 400, // not held: a short hop off the head
  spikePop: 150, // px/s up when landing on a raised spear: a stumble, not a bounce
  colorCooldown: 0.15, // generous: swapping is a skill tool, never blocked long
  storm: 0.18, // transformation animation (rubik_storm.png)
  respawnDelay: 0.45,
  respawnGrace: 0.75,
  bumpGrace: 0.6,
  // After a respawn (and after the theft's cards) every card holds still: a
  // respawn is never an instant alert, and the REVERSE cards never cover a charge.
  respawnCalm: 0.75,
  theftCalm: 1.9, // REVERSE sweep (1.1 s) + 0.8 s to act, counted after the GET card
  // get: the ability GET card (Mega Man's "weapon get") freezes the world for
  // 1.2 s; it is part of the simulation so routes replay identically.
  hitstop: { stomp: 0.08, smash: 0.09, knock: 0.09, theft: 0.25, get: 1.2 },
  orbRespawn: 2.5,
  goalReach: 220, // px above a goal face's floor that still touches it
});

/** Rubik's collider. The box (40 x 52) handles walls, ceilings, cards, cones,
 * spears and pickups: it sits inside the drawn 56 px cube, so the hurtbox is
 * never larger than the body. Support (standing, landing, walking off) uses
 * only the feet: `foot` px either side of the centre. The drawn legs span
 * -9..+13 px (facing right) in the standing and landing frames, so +-11 px is
 * within 2 px of the drawn feet (rubric C1; tests read the sprite sheets). */
export const PLAYER = Object.freeze({ w: 40, h: 52, foot: 11 });

/** Card body: the drawn card is 64 px wide and ~86 px tall at 2x (the sheets
 * read in tests/movement-audit.test.mjs, C2); the 48 x 84 body sits 8 px
 * inside each drawn side - a generous shrink, since body contact only ever
 * knocks Rubik back. The stomp head is 10 px wider each side (68 px: 2 px past
 * the drawing). Timings from RESEARCH.md M2. */
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
  spearReach: 66, // px beyond the body edge: 8-12 px short of the drawn tip (generous)
  // Spear band, px above the card's floor = the drawn spear head in the lunge
  // frames (green sheet: 50-68 px, red sheet: 46-64 px). Rubik (52 px tall)
  // can never pass under it, so only the top edge decides a jump over it.
  spearBand: Object.freeze({ green: Object.freeze([50, 68]), red: Object.freeze([46, 64]) }),
  lungeRange: 150, // start a windup when Rubik is this close in front
  bumpReaction: 0.6, // s a bumped card stands, "!" up, before it may attack
  notice: 0.45, // s a card stands on "!" before charging: time to back off or go green
  bumpKnock: 300, // px/s knockback from an unaware card...
  awareKnock: 440, // ...and from an aware one: thrown back the way he came
  spearOnBump: 3, // the 3rd bump on an aware card is answered with the spear
  escapeSpeed: 1.6, // after the theft green cards patrol faster...
  escapeSuspect: 0.15, // ...and grow suspicious sooner (escape pressure, no timer)
});

/** The one assist (pause menu -> Options, off by default): "Slow spotting"
 * multiplies how long a card must keep Rubik in sight before "?" and before
 * "!" (0.25 -> 0.5 s, 0.6 -> 1.2 s, the escape's 0.15 -> 0.3 s; 1-3's catch
 * comes with the "!"). Cones, patrols, turns, the spear and every physics
 * number are untouched, so each level reads and routes the same; only the
 * margin for a misread cone grows. A searching card still re-alerts on a
 * glimpse (it already knows Rubik is near). A run that had the assist on at
 * any moment is `assisted`, and the campaign awards it no stamps. */
export const ASSIST = Object.freeze({ spotScale: 2 });
export function setSlowSpotting(g, on) {
  g.slowSpotting = !!on;
  if (g.slowSpotting) g.assisted = true;
  return g;
}

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

/** Sealed stones are 2x2 tiles; a per-level lookup from tile to stone index
 * (cached per frozen level object, so every game of a level shares it). */
const stoneCellCache = new WeakMap();
function stoneCells(level) {
  let cells = stoneCellCache.get(level);
  if (!cells) {
    cells = new Map();
    level.stones.forEach((stone, index) => {
      for (let dy = 0; dy < 2; dy++)
        for (let dx = 0; dx < 2; dx++) cells.set(`${stone.x + dx},${stone.y + dy}`, index);
    });
    stoneCellCache.set(level, cells);
  }
  return cells;
}

/** Tile character; outside the level's columns counts as wall, above it as air. */
export const tileChar = (g, tx, ty) =>
  ty < 0 || ty >= ROWS ? "." : tx < 0 || tx >= g.level.cols ? "#" : g.level.map[ty][tx];
export function stoneAt(g, tx, ty) {
  const index = stoneCells(g.level).get(`${tx},${ty}`);
  return index === undefined ? null : g.stones[index];
}
/** Solid for movement and sight: ground tiles and unbroken stones. */
export function blocked(g, tx, ty) {
  if (tileChar(g, tx, ty) === "#") return true;
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
    dashAir: false,
    carry: 0, // 1 while a dash-jump's extra speed is bleeding off
    corner: 0, // lip rest: side of the lip (-1 left, 1 right) the box sits on, feet over the air
    bounce: 0, // s left in which a jump press turns a short stomp hop into the high bounce
    // Keys held through a death are ignored after the respawn until they are
    // let go and pressed again (no run straight back into the water).
    heldLock: { left: false, right: false },
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
    // Every card is awake: patrols walk, sentries turn on timers (or hold one
    // facing: `fixed`). Escape-only cards are "away" (no body) until the theft.
    state: spec.escapeOnly ? "away" : "calm",
    bumps: 0,
    timer: 0,
    sight: 0,
    lost: 0,
    turning: 0,
    turnClock: 0,
    reach: CONE.length,
    sees: false,
    lungeTarget: spec.x,
    stuck: 0, // s spent at a patrol bound with Rubik out of the spear's reach
    // Locked on: once a card has shown "?" at Rubik, it keeps seeing him in
    // its cone whatever colour he swaps to (it watched him change), until he
    // leaves the cone. No more swapping to its colour right under its nose.
    locked: false,
    sideX: 0, // world side (-1 left, 1 right) Rubik was last on, clear of its head
    squash: 0, // presentation: s left of the stomp squash
    anim: 0,
  };
}

/** Every teaching bubble in World 1. A level lists the (at most two) it may
 * show; the campaign passes the saved states in, so nothing is taught twice. */
export const HINT_IDS = Object.freeze(["move", "airjump", "behind", "white", "green", "dash"]);

/** A new game of one level.
 * @param level  a level object (levels/*.mjs) or its id ("1-3"); default 1-1.
 * @param options.hints  saved hint states ({ move: "done", ... }): "done" and
 *   "shown" bubbles never trigger again (a "shown" one may still be re-offered
 *   once after three deaths at its checkpoint).
 * @param options.owned  sticker numbers already in the save: drawn as faint
 *   outlines; touching one again counts for this run's tally only.
 * @param options.slowSpotting  the Slow spotting assist (ASSIST), off by default.
 * The kit (forms, start form, dash) comes from the level and is the same on
 * every replay, so sticker gates and QA routes stay valid. */
export function createGame(level = "1-1", options = {}) {
  const lv = typeof level === "string" ? getLevel(level) : level;
  if (!lv) throw new Error(`Unknown level ${level}`);
  const kit = lv.kit,
    owned = new Set(options.owned || []),
    hints = Object.fromEntries(HINT_IDS.map((id) => [id, "pending"]));
  for (const id of HINT_IDS) if (["shown", "done"].includes(options.hints?.[id])) hints[id] = options.hints[id];
  const g = {
    levelId: lv.id,
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
    bounces: 0,
    smashes: 0,
    knockouts: 0,
    takedowns: [], // ids of the cards stomped or knocked in this run (the Takedown stamp)
    respawns: 0,
    dashes: 0,
    stolen: false,
    theftTime: null,
    finishTime: null,
    escapeTime: null,
    unlocked: { white: kit.forms.includes("white"), green: kit.forms.includes("green"), red: kit.forms.includes("red") },
    dashUnlocked: !!kit.dash,
    calm: 0, // s every card holds still (after a respawn, after the theft)
    deadJump: 0, // a jump pressed during the death hop, carried into the respawn
    gets: [], // abilities granted in this run, in order (GET moments)
    pendingAbsorb: 0,
    colorCooldown: 0,
    checkpoint: lv.checkpoints[0].id,
    checkpointIndex: 0,
    snapshot: null,
    player: makePlayer(lv.spawn.x, lv.spawn.floor, kit.start, lv.spawn.dir ?? 1),
    guards: lv.guards.map(makeGuard),
    // sealOnTheft stones are absent inbound and drop into place at the theft.
    stones: lv.stones.map((stone) => ({ ...stone, broken: !!stone.sealOnTheft })),
    orbs: lv.orbs.map((orb) => ({ ...orb, respawn: 0 })),
    pickups: lv.pickups.map((pickup) => ({ ...pickup, taken: false })),
    stickers: lv.stickers.map(({ id, x, y }) => ({ id, x, y, collected: false, owned: owned.has(id) })),
    hints,
    hint: null,
    hintAge: 0,
    hintData: { idle: 0, zoneTime: 0, zoneJumps: 0, gapFails: 0, reoffered: {} },
    medals: null,
    slowSpotting: !!options.slowSpotting,
    assisted: !!options.slowSpotting, // sticky for the run: no stamps (campaign)
    events: [],
    eventId: 0,
  };
  // The level is shared, frozen data: non-enumerable so structuredClone /
  // JSON snapshots of the game never copy (or compare) the whole map.
  Object.defineProperty(g, "level", { value: lv, enumerable: false });
  return g;
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
  const cp = g.level.checkpoints[index];
  g.checkpoint = cp.id;
  g.checkpointIndex = index;
  g.deathsHere = 0;
  g.snapshot = structuredClone({
    // Awareness never persists into a respawn: a card mid-charge at save time
    // is restored calm where it stood, so a respawn is never an instant alert.
    guards: g.guards.map((guard) =>
      ["drained", "stunned", "calm", "away"].includes(guard.state)
        ? { ...guard, locked: false }
        : { ...guard, state: "calm", sight: 0, lost: 0, timer: 0, locked: false },
    ),
    stones: g.stones,
    orbs: g.orbs.map((orb) => ({ ...orb, respawn: 0 })),
    pickups: g.pickups,
    unlocked: g.unlocked,
    dashUnlocked: g.dashUnlocked,
    stolen: g.stolen,
    theftTime: g.theftTime,
    stomps: g.stomps,
    bounces: g.bounces,
    smashes: g.smashes,
    knockouts: g.knockouts,
    takedowns: g.takedowns,
    color: g.player.color,
  });
  if (g.phase === "playing" && g.time > 0) event(g, "checkpoint", cp.x, cp.floor, { id2: cp.id });
}

/** Rewind to the last checkpoint snapshot. Rubik faces the way the level
 * continues (home, i.e. left, during the getaway). */
const RESTORED = ["guards", "stones", "orbs", "pickups", "unlocked", "dashUnlocked", "stolen", "theftTime", "stomps", "bounces", "smashes", "knockouts", "takedowns"];
export function respawn(g) {
  const s = structuredClone(g.snapshot),
    cp = g.level.checkpoints[g.checkpointIndex];
  for (const key of RESTORED) g[key] = s[key];
  g.player = makePlayer(cp.x - PLAYER.w / 2, cp.floor, s.color, g.stolen ? -1 : cp.dir ?? 1);
  // A direction held continuously since the death stays locked until it is
  // let go (no running straight back off the ledge); one released and pressed
  // again during the hop counts at once. No input is lost: a jump pressed in
  // the hop's last moments fires on arrival.
  g.player.heldLock = { ...(g.deathHeld || { left: true, right: true }) };
  if (g.deadJump > 0) g.player.jumpBuffer = g.deadJump;
  g.deadJump = 0;
  g.calm = g.stolen ? WORLD.respawnCalm + 0.5 : WORLD.respawnCalm;
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
  g.deathHeld = { left: true, right: true }; // cleared per key once released
  g.deaths++;
  g.deathsHere++;
  g.deathTimer = WORLD.respawnDelay;
  g.deathReason = reason;
  g.deathAt = { x: p.x, y: p.y, color: p.color, direction: p.direction };
  if (reason === "water" && inDashZone(g)) g.hintData.gapFails++;
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
  if (color === "white" && g.hints.white === "shown") g.hints.white = "done";
  return true;
}

/** One air dash per airtime (Celeste charge). The ground always restores it;
 * stomps, refill orbs, smashed stones and knocked cards refill it mid-air.
 * Before DASH GET (levels 1-1..1-3, and 1-4's first seconds) Shift does
 * nothing at all: no buzz, no glyph, nothing hints at a move not yet owned. */
export function dash(g, axis = 0) {
  const p = g.player;
  if (!g.dashUnlocked) return false;
  if (g.phase !== "playing" || p.dashTime > 0 || p.dashCooldown > 0 || p.knock > 0) return false;
  if (!p.grounded && p.dashCharge <= 0) return false;
  if (!p.grounded) p.dashCharge = 0;
  p.dashDirection = axis || p.direction;
  p.direction = p.dashDirection; // facing and travel stay locked for the burst
  p.dashTime = WORLD.dashDuration;
  p.dashCooldown = WORLD.groundDashDelay;
  p.dashAir = !p.grounded;
  p.vy = 0;
  p.rising = false;
  g.dashes++;
  g.hitstop = Math.max(g.hitstop, WORLD.dashFreeze);
  event(g, "dash", p.x + p.w / 2, p.y + p.h / 2, { direction: p.dashDirection, color: p.color, air: !p.grounded });
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
  if (p.jumpBuffer <= 0 || p.knock > 0) return false;
  const ground = p.grounded || p.coyote > 0;
  let dashJump = false;
  if (p.dashTime > 0) {
    // Air dashes finish first (the buffered press fires when they end); a
    // jump during a GROUND dash is a dash-jump that keeps part of its speed.
    if (!ground || p.dashAir) return false;
    dashJump = true;
    p.dashTime = 0;
    p.vx = p.dashDirection * WORLD.dashJumpSpeed;
    p.carry = 1;
  }
  if (!ground && (p.color !== "white" || p.airJumped)) return false;
  p.vy = -WORLD.jump * (ground ? 1 : WORLD.airJump);
  if (p.jumpCutQueued) p.vy *= WORLD.jumpCut;
  if (!ground) p.airJumped = true;
  p.jumps = ground ? 1 : 2;
  p.grounded = false;
  p.rising = true;
  p.coyote = 0;
  p.jumpBuffer = 0;
  p.jumpCutQueued = false;
  event(g, dashJump ? "dashjump" : ground ? "jump" : "airjump", p.x + p.w / 2, p.y + p.h);
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
      if (row === bottom && ledgeAssist(g, row)) return false;
      if (row === top && dashCorner(g, row)) return false;
      p.x = dx > 0 ? col * TILE - p.w : (col + 1) * TILE;
      return true;
    }
  }
  return false;
}
/** Dash corner correction (the horizontal twin of the ceiling one): a dash
 * whose head clips the underside of a lip by <= 6 px slides under it instead
 * of stopping dead. Dashes only: they are gravity-free and committed. */
function dashCorner(g, row) {
  const p = g.player,
    clip = (row + 1) * TILE - p.y;
  if (p.dashTime <= 0 || clip <= 0 || clip > WORLD.cornerCorrection) return false;
  if (!boxFree(g, p.x, p.y + clip, p.w, p.h)) return false;
  p.y += clip;
  return true;
}
/** Ledge assist: airborne (not rising fast) or dashing, Rubik meets a lip
 * with only his feet below its top - by at most 12 px - and room above it:
 * he steps up onto its corner instead of sliding down the face ("visually
 * made it"); the lip rest then scrambles his feet onto it (moving toward it). */
function ledgeAssist(g, row) {
  const p = g.player,
    lift = p.y + p.h - row * TILE;
  if (p.grounded || lift <= 0 || lift > WORLD.ledgeAssist || (p.vy < -WORLD.apexBand && p.dashTime <= 0)) return false;
  if (!boxFree(g, p.x, row * TILE - p.h, p.w, p.h)) return false;
  p.y = row * TILE - p.h;
  p.vy = Math.max(0, p.vy);
  event(g, "assist", p.x + p.w / 2, p.y + p.h);
  return true;
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
    const row = Math.floor((p.y + p.h - 0.001) / TILE),
      s = support(g, row, (col) => tileChar(g, col, row) === "=" && prevBottom <= row * TILE + 0.5);
    if (!s.feet && !s.left && !s.right) return null;
    p.y = row * TILE - p.h;
    if (s.feet || (s.left && s.right)) return "floor";
    // Only the box's edge met a solid lip; the feet are over the air. Rest
    // on it this tick (no sinking into the tile) and scramble or slip next.
    // Touching the lip ends the jump's arc (no apex float on the way down),
    // but it is not a landing: nothing is refreshed until the feet stand.
    p.corner = s.left ? -1 : 1;
    p.jumps = 0;
    return "corner";
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

/** What holds Rubik up in tile row `row`: `feet` = a solid (or `slab(col)`)
 * tile under the feet's span; `left` / `right` = a solid tile under only the
 * box's edge on that side. A box spanning a gap narrower than itself on both
 * sides (a 1-tile hole) stands, as it always did. */
function support(g, row, slab) {
  const p = g.player,
    cx = p.x + p.w / 2,
    f0 = Math.floor((cx - PLAYER.foot) / TILE),
    f1 = Math.floor((cx + PLAYER.foot - 0.001) / TILE),
    out = { feet: false, left: false, right: false };
  for (let col = Math.floor(p.x / TILE); col <= Math.floor((p.x + p.w - 0.001) / TILE); col++) {
    if (col >= f0 && col <= f1) out.feet ||= blocked(g, col, row) || slab(col);
    else if (blocked(g, col, row)) out[col < f0 ? "left" : "right"] = true;
  }
  return out;
}
function onGround(g) {
  const p = g.player,
    feet = p.y + p.h,
    row = Math.round(feet / TILE);
  if (Math.abs(feet - row * TILE) > 0.5) return false;
  // A one-way slab only supports a Rubik who isn't rising: jumping up
  // through one used to count as "grounded" for a tick whenever the feet
  // crossed its top exactly, silently refreshing the air jump and dash.
  const s = support(g, row, (col) => tileChar(g, col, row) === "=" && p.vy >= 0);
  return s.feet || (s.left && s.right);
}

export const guardBox = (guard) => ({
  x: guard.x - GUARD.w / 2,
  y: guard.floor - GUARD.h,
  w: GUARD.w,
  h: GUARD.h,
});
export function spearBox(guard) {
  const front = guard.x + guard.dir * (GUARD.w / 2),
    [low, high] = GUARD.spearBand[guard.kind] || GUARD.spearBand.green;
  return {
    x: guard.dir > 0 ? front : front - GUARD.spearReach,
    y: guard.floor - high,
    w: GUARD.spearReach,
    h: high - low,
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
    // Caught (level.caught, 1-3): before 1-5 teaches the spear, a card that
    // says "!" raises the alarm and Rubik is sent back to the last checkpoint
    // (Ocarina of Time's castle courtyard: seen = thrown out, no death). The
    // "?" before it (0.25 s seen) is the warning: 0.35 s to leave the cone.
    if (g.level.caught) die(g, "caught");
  }
}

function updateGuard(g, guard, dt) {
  const p = g.player;
  guard.anim += dt;
  if (guard.state === "drained" || guard.state === "away") return;
  guard.reach = coneReach(g, guard);
  if (guard.state === "stunned") {
    guard.sees = false;
    guard.locked = false;
    guard.timer -= dt;
    if (guard.timer <= 0) {
      guard.state = "search";
      guard.timer = GUARD.searchTime;
    }
    return;
  }
  guard.squash = tick(guard.squash, dt);
  if (g.calm > 0 && guard.state !== "stunned") {
    // The calm hold: nothing advances, nothing moves (respawns, the theft).
    guard.sees = false;
    guard.disguiseSeen = false;
    return;
  }
  const playerBox = { x: p.x, y: p.y, w: p.w, h: p.h },
    dx = p.x + p.w / 2 - guard.x,
    // The drawn cone starts 40 px in front of the eyes as a thin sliver, so
    // a Rubik standing within ~80 px of a card's centre is below it. A card
    // that has asked "?" follows him there too (right before its face, at
    // its height): otherwise a locked-on card lost him one step before he
    // walked into it, and its colour walked through.
    face = guard.locked && dx * guard.dir > 0 && Math.abs(dx) < CONE.offset + GUARD.w / 2 + p.w && p.y < guard.floor && p.y + p.h > guard.floor - GUARD.h,
    inCone = g.phase === "playing" && (boxInCone(guard, playerBox, guard.reach) || face);
  // Leaving the cone breaks a lock; inside it, a locked card sees any colour.
  if (!inCone || guard.state === "calm") guard.locked = false;
  const sees = inCone && (canSee(guard, p.color) || guard.locked);
  guard.sees = sees;
  // Presentation hint: a cone sweeping over a disguised Rubik makes the card
  // hum ("♪") instead of reacting, so the disguise is visibly working.
  guard.disguiseSeen = inCone && !sees;
  const clampX = () => {
    guard.x = Math.max(guard.min, Math.min(guard.max, guard.x));
  };
  switch (guard.state) {
    case "calm": {
      // "green card + X" (1-3, the trade-off level): white Rubik is in, or
      // one step from, a green card's cone. Taught BEFORE the "?", because
      // once a card has asked, a swap in its view no longer fools it.
      if (guard.kind === "green" && p.color === "white" && g.unlocked.green && levelHint(g, "green") && g.hints.green === "pending" && g.phase === "playing") {
        const near = { x: playerBox.x - 64, y: playerBox.y, w: playerBox.w + 128, h: playerBox.h };
        if (boxInCone(guard, near, guard.reach)) showHint(g, "green");
      }
      if (sees) {
        guard.sight += dt;
        if (guard.sight >= (g.stolen ? GUARD.escapeSuspect : GUARD.suspectAfter) * (g.slowSpotting ? ASSIST.spotScale : 1)) {
          guard.state = "suspect";
          guard.locked = true;
          guard.lost = 0;
          event(g, "suspect", guard.x, guard.floor - GUARD.h, { guard: guard.id });
        }
        break;
      }
      guard.sight = Math.max(0, guard.sight - dt);
      if (guard.turning > 0) {
        guard.turning -= dt;
        if (guard.turning <= 0) guard.dir *= -1;
      } else if (guard.mode === "sentry") {
        // A `fixed` sentry holds its facing (a lookout staring one way).
        // `turnEvery` may be [s facing left, s facing right]: a watch sentry
        // looks at the spot it guards longer than it looks away (1-3), so a
        // player who ignores its cone meets its face more often than its back,
        // while one who reads it waits at most one short look-away.
        if (!guard.fixed) guard.turnClock += dt;
        const every = Array.isArray(guard.turnEvery) ? guard.turnEvery[guard.dir < 0 ? 0 : 1] : guard.turnEvery || 3;
        if (guard.turnClock >= every) {
          guard.turnClock = 0;
          guard.turning = GUARD.lookBack;
        }
      } else {
        const speed = GUARD.patrolSpeed * (guard.pace ?? 1) * (g.stolen && guard.kind === "green" ? GUARD.escapeSpeed : 1);
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
        if (guard.state === "search" || guard.sight >= GUARD.alertAfter * (g.slowSpotting ? ASSIST.spotScale : 1)) alertGuard(g, guard);
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
      const sameFloor = Math.abs(p.y + p.h - guard.floor) < 48,
        atBound = guard.dir > 0 ? guard.x >= guard.max - 0.5 : guard.x <= guard.min + 0.5,
        room = Math.max(0, guard.dir > 0 ? guard.max - guard.x : guard.x - guard.min),
        // How far ahead the spear can land from here, given the patrol bound.
        spearReach = Math.min(GUARD.lungeDistance, room) + GUARD.w / 2 + GUARD.spearReach,
        inReach = Math.abs(dx) - p.w / 2 <= spearReach;
      // Before 1-5 teaches the full ladder, a card that spots Rubik only
      // charges and bumps him back (level.spears === false): no spear yet.
      if (g.level.spears !== false && sees && sameFloor && inReach && Math.abs(dx) <= GUARD.lungeRange && Math.sign(dx) === guard.dir) {
        guard.state = "windup";
        guard.timer = GUARD.windup;
        guard.stuck = 0;
        event(g, "windup", guard.x, guard.floor - GUARD.h, { guard: guard.id });
        break;
      }
      // Pinned at its patrol bound with Rubik out of reach: it gives up after
      // 0.8 s and turns back (no endless wind-ups 10 px short).
      if (atBound && !inReach) {
        guard.stuck += dt;
        if (guard.stuck >= 0.8) {
          guard.stuck = 0;
          guard.dir *= -1;
          guard.state = "search";
          guard.lost = 0;
          guard.sight = 0;
          break;
        }
      } else guard.stuck = 0;
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

/** The Takedown stamp counts each card once, however it was put down. */
function takedown(g, guard) {
  if (!g.takedowns.includes(guard.id)) g.takedowns.push(guard.id);
}
function stomp(g, guard) {
  const p = g.player;
  // Hold jump (or press it as you land: up to 0.12 s before, or during the
  // freeze and 0.05 s after) for the high bounce; otherwise a hop.
  const high = p.jumpHeld || p.jumpBuffer > 0;
  p.vy = -(high ? WORLD.stompBounce : WORLD.stompBounceLow);
  p.jumpHeld = high;
  p.jumpBuffer = 0;
  p.bounce = high ? 0 : WORLD.hitstop.stomp + WORLD.stompGrace;
  p.jumps = 1;
  p.airJumped = false; // a bounce refreshes white's air jump
  p.rising = false;
  p.grounded = false;
  g.hitstop = Math.max(g.hitstop, WORLD.hitstop.stomp);
  refill(g, "stomp");
  guard.squash = 0.16;
  if (guard.state === "drained") {
    // The drained card stays dazed forever: a springboard (a bounce, not a
    // stun, so nothing is farmed).
    g.bounces++;
    event(g, "bounce", guard.x, guard.floor - GUARD.h, { guard: guard.id });
    return;
  }
  if (guard.absorb && !g.unlocked.green) {
    // The glowing card holds Rubik's green. It ejects it as a swirl; Rubik
    // absorbs it at the bounce apex so the stomp keeps white's full height.
    guard.state = "drained";
    g.pendingAbsorb = 0.6;
    takedown(g, guard);
    event(g, "drain", guard.x, guard.floor - GUARD.h / 2, { guard: guard.id });
    return;
  }
  takedown(g, guard);
  guard.state = "stunned";
  guard.timer = GUARD.stun;
  guard.sight = 0;
  g.stomps++;
  if (g.hints.behind === "shown") g.hints.behind = "done";
  event(g, "stomp", guard.x, guard.floor - GUARD.h, { guard: guard.id });
}

/** A GET moment: the ability is unlocked, the world freezes for the GET card
 * (1.2 s of hit-stop, part of the simulation) and the checkpoint tied to it
 * (`get: ability`) is saved, so a death can never take the ability away. */
function grantAbility(g, ability) {
  const p = g.player;
  if (ability === "dash") {
    g.dashUnlocked = true;
    p.dashCharge = 1;
  } else g.unlocked[ability] = true;
  g.gets.push(ability);
  g.hitstop = Math.max(g.hitstop, WORLD.hitstop.get);
  event(g, "get", p.x + p.w / 2, p.y + p.h / 2, { ability });
  const index = g.level.checkpoints.findIndex((cp) => cp.get === ability);
  if (index > g.checkpointIndex || (g.stolen && index >= 0)) saveCheckpoint(g, index);
}

function absorbGreen(g) {
  const p = g.player;
  g.pendingAbsorb = 0;
  p.stormFrom = p.color;
  p.color = "green";
  p.storm = WORLD.storm;
  event(g, "absorb", p.x + p.w / 2, p.y + p.h / 2, { color: "green" });
  grantAbility(g, "green");
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
/** How far Rubik's centre is ahead of a card, along the way it faces (px). */
const aheadOf = (g, guard) => (g.player.x + g.player.w / 2 - guard.x) * guard.dir;
/** Head stomps work from above or behind. A card that faces Rubik raises its
 * spear (drawn), and an aware card ("!", wind-up, lunge) always has it up; its
 * 0.7 s recovery after a lunge is the stompable opening. */
export function stompable(g, guard) {
  if (guard.state === "drained" || guard.state === "recover") return true;
  // The card holding Rubik's green (1-2) carries it, not a spear: always.
  if (guard.absorb && !g.unlocked.green) return true;
  if (["alert", "windup", "lunge", "stunned"].includes(guard.state)) return false;
  // Came at its face (the last side Rubik was on while clear of its head is
  // the side it looks at): it saw him coming, even if the jump carries him
  // over onto its back half. Run-and-jump can't skip a lookout; drop from
  // above or come from behind.
  if (guard.sideX * guard.dir > 0) return false;
  return aheadOf(g, guard) <= 12; // up to half the head ahead of centre still counts as "above"
}
/** Landing on a raised spear: a failed stomp. Rubik is knocked aside off its
 * head (no damage) and the card turns on him. The pop is a hit reaction, not
 * a springboard: -150 px/s lifts him ~10 px (the old -360 lifted ~55 px and a
 * cone-blind player chained it with white's air jump over 1-2's wall and
 * 1-5's P2 card). The sideways push (440 px/s, 0.22 s of no control) clears
 * the 68 px head from any landing point, so there is no spike-spike loop. */
function spike(g, guard) {
  const p = g.player,
    away = Math.sign(p.x + p.w / 2 - guard.x) || guard.dir;
  p.vy = -WORLD.spikePop;
  p.vx = away * GUARD.awareKnock;
  p.knock = 0.22;
  p.jumps = 1;
  p.grounded = false;
  p.bumpGrace = WORLD.bumpGrace;
  event(g, "spike", guard.x, guard.floor - GUARD.h, { guard: guard.id });
  // 1-2's bubble: the first spear-up teaches "from behind" (drawn, no text).
  if (levelHint(g, "behind") && g.hints.behind === "pending") showHint(g, "behind");
  if (guard.state === "recover" || guard.state === "drained") return;
  guard.dir = away;
  alertGuard(g, guard, canSee(guard, p.color));
}
function guardContacts(g, prevBottom) {
  const p = g.player;
  for (const guard of g.guards) {
    if (guard.state === "away") continue;
    // Which world side Rubik approaches from (kept while he is over its head).
    const rel = p.x + p.w / 2 - guard.x;
    if (Math.abs(rel) > 40) guard.sideX = Math.sign(rel);
    const box = guardBox(guard),
      top = guard.floor - GUARD.h,
      widen = guard.catch ?? 10;
    // Stomps use a head wider than the body (Mario-style forgiveness; the
    // dozing first card is wider still); the previous foot height keeps side
    // contact from counting as a stomp.
    const head = { x: box.x - widen, y: box.y, w: box.w + widen * 2, h: box.h };
    if (p.vy > 0 && prevBottom <= top + 10 && guard.state !== "stunned" && overlaps(p, head)) {
      if (stompable(g, guard)) stomp(g, guard);
      else if (p.bumpGrace > 0) separate(g, box); // just spiked: slide off, no loop
      else spike(g, guard);
      continue;
    }
    if (!overlaps(p, box)) continue;
    if (guard.state === "drained" || guard.state === "stunned") continue;
    // Disguised: a card lets its own colour through, unless it is locked on
    // (it watched him swap, so it still sees him): then its body blocks him
    // like any other colour's. Before this a cone-blind player could take a
    // "?" as white, swap, and walk straight through the card that asked.
    if (p.color === guard.kind && !guard.sees) continue;
    if (p.color === "red" && p.dashTime > 0) {
      // Red dash knocks a card aside and refunds the dash (M5/M7 power).
      guard.state = "stunned";
      guard.timer = GUARD.stun;
      guard.sight = 0;
      guard.bumps = 0;
      guard.x = Math.max(guard.min, Math.min(guard.max, guard.x + p.dashDirection * 40));
      g.knockouts++;
      takedown(g, guard);
      g.hitstop = Math.max(g.hitstop, WORLD.hitstop.knock);
      refill(g, "knock");
      event(g, "knock", guard.x, guard.floor - GUARD.h / 2, { guard: guard.id });
      continue;
    }
    if (p.bumpGrace > 0 || p.grace > 0) {
      separate(g, box); // solid, but no new bump during grace
      continue;
    }
    if (guard.state === "calm" && aheadOf(g, guard) < -4) {
      // Brushing a calm card's back: it doesn't notice (sneak up, don't shove).
      separate(g, box);
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
    if (guard.bumps >= GUARD.spearOnBump && g.level.spears !== false) {
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
  const p = g.player,
    vault = g.level.vault;
  g.stolen = true;
  g.theftTime = g.time;
  p.stormFrom = p.color;
  p.color = "red";
  p.storm = WORLD.storm;
  p.direction = -1;
  p.dashCharge = 1;
  p.dashCooldown = 0;
  p.grace = 1;
  g.hitstop = WORLD.hitstop.theft;
  // Fairness: once the RED GET card closes, every card holds still while the
  // REVERSE card sweeps and for ~0.8 s after; Rubik is untouchable meanwhile.
  g.calm = WORLD.theftCalm;
  p.grace = WORLD.theftCalm + 0.4;
  // The chamber door slams: the first smash is forced, right here, and safe:
  // no card left in the sealed room can see red (tests/model.test.mjs), so a
  // hesitant player is never speared while working out the door.
  for (const stone of g.stones) if (stone.sealOnTheft) stone.broken = false;
  // REVERSE: every card turns to face the vault side, i.e. the incoming
  // Rubik on his run home; escape-only cards arrive at their posts.
  for (const guard of g.guards) {
    if (guard.state === "drained") continue;
    guard.dir = guard.theftDir ?? 1;
    guard.bumps = 0;
    if (guard.drainOnTheft) {
      // The vault's red goes into Rubik and its red guard greys out (1-2's
      // drained green card): flat for good, a springboard, no cone. So the
      // room never punishes a swap to green after the theft.
      guard.state = "drained";
      guard.sees = false;
      event(g, "drain", guard.x, guard.floor - GUARD.h / 2, { guard: guard.id });
    } else if (guard.escapeOnly) {
      guard.state = "calm";
      event(g, "arrive", guard.x, guard.floor - GUARD.h, { guard: guard.id });
    } else if (guard.state !== "stunned") {
      guard.state = "calm";
      guard.sight = 0;
      guard.turning = 0;
    }
  }
  event(g, "theft", vault.cx, vault.floor - vault.h / 2);
  grantAbility(g, "red"); // RED GET card, then the REVERSE card (front end)
}

const levelHint = (g, id) => g.level.hints.includes(id);
function inDashZone(g) {
  const z = g.level.hintZones.dash,
    cx = g.player.x + g.player.w / 2;
  return !!z && levelHint(g, "dash") && cx > z.x0 && cx < z.x1;
}

function showHint(g, id) {
  if (g.hint === id) return;
  g.hint = id;
  g.hintAge = 0;
  if (g.hints[id] === "pending") g.hints[id] = "shown";
  event(g, "hint", g.player.x, g.player.y, { hint: id });
}

/** At most two contextual bubbles per level (level.hints), each retired by the
 * success it asks for. Zones are level data (level.hintZones). */
function updateHints(g, dt, input, wasGrounded) {
  const p = g.player,
    h = g.hintData,
    zones = g.level.hintZones,
    cx = p.x + p.w / 2,
    feet = p.y + p.h;
  g.hintAge += dt;
  // move (1-1): idle 4 s at the start.
  if (levelHint(g, "move") && g.hints.move !== "done") {
    if (Math.abs(cx - (g.level.spawn.x + PLAYER.w / 2)) > 48) {
      g.hints.move = "done";
    } else if (!input.left && !input.right) {
      h.idle += dt;
      if (h.idle >= 4 && g.hints.move === "pending") showHint(g, "move");
    }
  }
  // airjump (1-1): at the first 4-tile wall, two single jumps that fall short
  // and 2 s of trying -> "jump, jump". Done once Rubik stands on top.
  const a = zones.airjump;
  if (a && levelHint(g, "airjump") && g.hints.airjump !== "done") {
    if (cx > a.past && feet <= a.top + 1 && p.grounded) g.hints.airjump = "done";
    else if (cx > a.x0 && cx < a.x1) {
      // A ground jump this tick (jumps = 1 and rising); air jumps set jumps = 2.
      if (input.jump && p.jumps === 1 && p.vy < 0) h.zoneJumps++;
      if (h.zoneJumps > 0) h.zoneTime += dt;
      if (h.zoneTime >= 2 && h.zoneJumps >= 2 && g.hints.airjump === "pending") showHint(g, "airjump");
    }
  }
  // white (1-3): green Rubik keeps failing a 4-tile white-only wall.
  const z = zones.white;
  if (z && levelHint(g, "white") && g.hints.white !== "done") {
    if (cx > z.past && feet <= z.top + 1) g.hints.white = "done";
    else if (cx > z.x0 && cx < z.x1 && p.color === "green") {
      if (input.jump) h.zoneJumps++;
      if (h.zoneJumps > 0) h.zoneTime += dt;
      if (h.zoneTime >= 2 && h.zoneJumps >= 1 && g.hints.white === "pending") showHint(g, "white");
    }
  }
  // dash (1-4): two failures at the first big gap (water deaths there, or
  // slow landings on its recovery rock).
  const d = zones.dash;
  if (d && levelHint(g, "dash") && g.hints.dash !== "done" && g.dashUnlocked) {
    if (cx > d.x1 && feet <= d.doneFloor + 1 && p.grounded) g.hints.dash = "done";
    else if (!wasGrounded && p.grounded && Math.abs(feet - d.rock.floor) < 1 && p.x + p.w > d.rock.x0 && p.x < d.rock.x1) h.gapFails++;
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
      // `owned` = already in the save from an earlier run: it still counts
      // for this run's tally, and the campaign keeps it either way.
      event(g, "sticker", sticker.x, sticker.y, { sticker: sticker.id, count: g.stickers.filter((s) => s.collected).length, owned: sticker.owned });
    }
  }
  for (const pickup of g.pickups) {
    // A GET pickup (1-4's stray storm swirl): touching it grants the ability.
    if (pickup.taken || (cx - pickup.x) ** 2 + (cy - pickup.y) ** 2 >= 34 ** 2) continue;
    pickup.taken = true;
    grantAbility(g, pickup.ability);
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
  const feet = p.y + p.h;
  g.level.checkpoints.forEach((cp, index) => {
    if (cp.get) return; // saved by its GET moment, never by touch
    const newer = g.stolen ? index < g.checkpointIndex : index > g.checkpointIndex;
    // A tall trigger column: jumping or dashing over a marker still counts.
    if (newer && Math.abs(cx - cp.x) < 40 && feet <= cp.floor + 1 && feet > cp.floor - 220) saveCheckpoint(g, index);
  });
  const vault = g.level.vault;
  if (vault && !g.stolen && overlaps(p, { x: vault.cx - vault.w / 2, y: vault.floor - vault.h, w: vault.w, h: vault.h })) steal(g);
  // The goal face: an 80 px wide, 220 px tall trigger column (a checkpoint's),
  // so a jump or dash from its floor (feet <= 175 px up) can't sail over it.
  // Each goal stands before its level's end wall: passing above it from a
  // high ledge only drops Rubik behind it, a 2-tile step from the face.
  const goal = g.level.goal;
  if (goal && Math.abs(cx - goal.x) < 40 && feet <= goal.floor + 1 && feet > goal.floor - WORLD.goalReach) win(g);
}

export function update(g, dt, input = {}) {
  if (!Number.isFinite(dt) || dt <= 0) return;
  dt = Math.min(dt, 1 / 30); // a resumed tab never integrates a giant step
  if (g.phase === "dead") {
    g.time += dt;
    g.deathTimer -= dt;
    if (input.jump) g.deadJump = WORLD.jumpBuffer;
    else g.deadJump = tick(g.deadJump, dt);
    for (const key of ["left", "right"]) if (!input[key]) g.deathHeld[key] = false;
    if (g.deathTimer <= 0) respawn(g);
    return;
  }
  if (g.phase !== "playing") return;
  g.time += dt;
  const p = g.player;
  // Input edges are latched even during hit-stop so a press is never lost.
  if (input.jump) {
    if (p.bounce > 0 && p.vy < 0) {
      // Pressed in the stomp freeze or just after it: that IS "pressing as
      // you land", so it makes the high bounce (and is used up), instead of
      // spending white's air jump on a lower arc.
      p.vy -= WORLD.stompBounce - WORLD.stompBounceLow;
      p.bounce = 0;
      p.jumpHeld = true;
    } else {
      p.jumpBuffer = WORLD.jumpBuffer;
      p.jumpCutQueued = false;
      p.jumpHeld = true;
    }
  }
  if (input.jumpReleased) {
    p.jumpHeld = false;
    if (p.jumpBuffer > 0) p.jumpCutQueued = true;
    else if (p.vy < 0 && p.rising) {
      p.vy *= WORLD.jumpCut;
      p.rising = false; // one cut per jump: a second release (two jump keys) can't cut again
    }
  }
  if (input.dash) p.dashBuffer = WORLD.dashBuffer;
  if (g.hitstop > 0) {
    g.hitstop = tick(g.hitstop, dt);
    // Buffers age in real time through a freeze: a press made in the last
    // 0.12 s (jump) / 0.1 s (dash) still fires when the world resumes, but
    // one made at the start of the 1.2 s GET card does not fire long after.
    p.jumpBuffer = tick(p.jumpBuffer, dt);
    p.dashBuffer = tick(p.dashBuffer, dt);
    p.bounce = tick(p.bounce, dt);
    if (input.color) switchColor(g, input.color);
    return;
  }
  g.colorCooldown = tick(g.colorCooldown, dt);
  p.grace = tick(p.grace, dt);
  p.bumpGrace = tick(p.bumpGrace, dt);
  p.storm = tick(p.storm, dt);
  p.dashCooldown = tick(p.dashCooldown, dt);
  if (!(p.dashTime > 0 && p.dashAir)) p.jumpBuffer = tick(p.jumpBuffer, dt);
  p.knock = tick(p.knock, dt);
  p.bounce = tick(p.bounce, dt);
  g.calm = tick(g.calm, dt);
  p.landed = tick(p.landed, dt);
  if (!p.grounded) p.coyote = tick(p.coyote, dt);
  if (input.color) switchColor(g, input.color);
  for (const key of ["left", "right"]) if (!input[key]) p.heldLock[key] = false;
  const right = !!input.right && !p.heldLock.right,
    left = !!input.left && !p.heldLock.left,
    axis = p.knock > 0 ? 0 : Number(right) - Number(left);
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
    if (p.knock <= 0) {
      const ground = p.grounded,
        against = axis !== 0 && p.vx !== 0 && Math.sign(p.vx) === -axis;
      let rate = !axis ? (ground ? WORLD.braking : WORLD.airBraking) : against ? (ground ? WORLD.turn : WORLD.airTurn) : ground ? WORLD.acceleration : WORLD.airAcceleration;
      // Dash-jump carry: above run speed the extra bleeds off slowly unless
      // the player pushes against it (then the normal turn rate applies).
      if (p.carry > 0 && Math.abs(p.vx) > WORLD.speed && !against) rate = WORLD.carryDecay;
      p.vx = toward(p.vx, axis * WORLD.speed, rate * dt);
      if (Math.abs(p.vx) <= WORLD.speed) p.carry = 0;
    }
    // Only a held jump (or bounce) floats at its apex; walking off a ledge never does.
    const apex = p.jumpHeld && p.jumps > 0 && Math.abs(p.vy) < WORLD.apexBand && !p.grounded;
    p.vy = Math.min(WORLD.maxFall, p.vy + WORLD.gravity * (apex ? 0.5 : p.vy > WORLD.apexBand ? WORLD.fallGravity : 1) * dt);
  }
  if (p.vy >= 0) p.rising = false;
  let dx = p.vx * dt;
  if (p.corner && p.dashTime <= 0) {
    // Lip rest (last tick's moveY): moving toward the lip scrambles onto it,
    // anything else slips off it; both clear the 9 px in <= 4 ticks.
    const toward = p.corner;
    dx = p.vx * toward > 0 ? toward * Math.max(Math.abs(p.vx), WORLD.scramble) * dt : -toward * Math.max(-p.vx * toward, WORLD.slip) * dt;
  }
  p.corner = 0;
  if (moveX(g, dx)) {
    p.vx = 0;
    if (p.dashTime > 0) p.dashTime = 0;
  }
  p.x = Math.max(0, Math.min(g.level.width - p.w, p.x));
  const hit = moveY(g, p.vy * dt, prevBottom);
  // A ceiling bonk starts the fall at once (no apex float under a low roof).
  if (hit) p.vy = hit === "ceiling" ? WORLD.apexBand : 0;
  p.grounded = onGround(g);
  if (p.grounded) {
    p.coyote = WORLD.coyote;
    p.jumps = 0;
    p.airJumped = false;
    if (p.dashTime <= 0) p.carry = 0;
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
  if (g.phase !== "playing") return;
  updateHints(g, dt, input, wasGrounded);
  if (p.y + p.h > WATER_ROW * TILE + 16 || p.y > WORLD.height) die(g, "water");
  if (g.phase !== "playing") return;
  // Death hints: three deaths at one checkpoint re-offer its bubble once (only
  // a bubble this level teaches, and only if it was never completed).
  const cp = g.level.checkpoints[g.checkpointIndex];
  if (g.deathsHere >= 3 && cp.hint && levelHint(g, cp.hint) && !g.hintData.reoffered[cp.id] && g.hints[cp.hint] !== "done") {
    g.hintData.reoffered[cp.id] = true;
    showHint(g, cp.hint);
  }
  const home = g.level.home;
  if (home && g.stolen && p.grounded && Math.abs(p.y + p.h - home.floor) < 1 && p.x + p.w / 2 < home.x1 && p.x + p.w / 2 > home.x0) win(g);
}

/** The level is over: a goal face was touched, or (1-6) red Rubik is home.
 * Level medals keep the old keys: fullFace = all of this level's stickers in
 * this run, neverSpotted = no "!" and no catch (the campaign's "Ghost" stamp,
 * once called "Unseen", counted only in levels with awake cards), takedown =
 * every card of the level stomped or knocked at least once in this run (the
 * "Takedown" stamp; `takedowns` / `cards` is the tally), quickGetaway = the
 * escape beat the par (1-6 only; null elsewhere). Ghost and Takedown compete:
 * one rewards slipping past every card, the other putting each one down. */
function win(g) {
  if (g.phase !== "playing") return;
  g.phase = "won";
  g.finishTime = g.time;
  g.escapeTime = g.stolen ? g.time - g.theftTime : null;
  const stickers = stickerCount(g);
  g.medals = {
    fullFace: stickers === g.stickers.length,
    neverSpotted: g.spotted === 0,
    takedown: g.guards.length > 0 && g.guards.every((c) => g.takedowns.includes(c.id)),
    takedowns: g.takedowns.length,
    cards: g.guards.length,
    quickGetaway: g.level.par === null ? null : g.escapeTime !== null && g.escapeTime <= g.level.par,
    assisted: g.assisted, // Slow spotting was on: the campaign awards no stamps
  };
  event(g, "win", g.player.x, g.player.y, { color: g.player.color });
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
