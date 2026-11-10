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
  // A direction held through a death waits this long after the respawn, then
  // counts as if pressed: Rubik lands and the camera settles before he runs,
  // but a player who simply keeps holding right is never ignored. (It used to
  // wait for a release: a first-time player holding right through the death
  // saw a frozen Rubik and thought the game was broken.) Released and pressed
  // again it counts at once. Every checkpoint has runway for it (tested).
  respawnHold: 0.2,
  // After a respawn (and after the theft's cards) every card holds still: a
  // respawn is never an instant alert, and the REVERSE cards never cover a charge.
  respawnCalm: 0.75,
  theftCalm: 1.9, // REVERSE sweep (1.1 s) + 0.8 s to act, counted after the GET card
  // get: the ability GET card (Mega Man's "weapon get") freezes the world for
  // 1.2 s; it is part of the simulation so routes replay identically.
  hitstop: { stomp: 0.08, smash: 0.09, knock: 0.12, theft: 0.25, get: 1.2, hurt: 0.12 },
  // ---- Health (RESEARCH_COMBAT.md section 3) ------------------------------
  // Three hearts; every enemy hit, body bump and water fall costs exactly one,
  // so "what hurt me" is always a single readable thing. Zero hearts is a real
  // death (the checkpoint restore the game always had). A new checkpoint
  // refills them, and so does a death; a stomp chain of `chainHeal` pays one.
  hearts: 3,
  invuln: 1.5, // s untouchable after a hit (blinking), long enough to leave the fight
  hurtKnock: 300, // px/s sideways from a bump...
  hurtKnockSpear: 380, // ...and from a spear
  hurtPop: 280, // px/s up: a hop, so the knock clears the card's feet
  hurtStun: 0.2, // s without steering after a hit (shorter than the 0.22 s it was)
  hurtReact: 0.35, // s of the hit pose (presentation)
  // ---- The stomp (RESEARCH_COMBAT.md section 5) ---------------------------
  stompDepth: 34, // px: feet this far below the head's top still stomp while falling
  stompWiden: 14, // px each side of the 48 px body: the stomp head is 76 px wide
  chainBounceStep: 20, // px/s more bounce per chained stomp after the first...
  chainBounceMax: 2, // ...for at most two steps: +40 px/s is about +14 px of apex
  chainHeal: 3, // a chain this long (stomps and knocks before touching ground) pays a heart
  chainHitstop: 0.015, // s of extra freeze per chain step (capped at +0.04)
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
  suspectAfter: 0.25, // s continuously seen -> "?" (stops, turns to face Rubik, cone orange)
  alertAfter: 0.6, // s seen -> "!"
  searchTime: 1.2, // s unseen: the card looks around ("?") before it gives up and patrols again
  lookBack: 0.4, // telegraph pause before every turn
  notice: 0.45, // s a card stands on "!" before it moves: time to back off or go green
  // The spear is exactly the drawn spear, measured from the lunge frames 4-6
  // (tests: C2): tip 102 px (green) / 98 px (red) from the body centre, 2 px
  // inside the art. Spear band, px above the card's floor = the drawn spear
  // head (green 50-68, red 46-64). Rubik (52 px tall) can't pass under it, so
  // only its top edge decides a jump over.
  spearReach: Object.freeze({ green: 76, red: 72 }), // px beyond the 24 px half body
  spearBand: Object.freeze({ green: Object.freeze([50, 68]), red: Object.freeze([46, 64]) }),
  bumpReaction: 0.3, // s a card bumped by Rubik stands on "!" before it acts
  escapeSpeed: 1.6, // after the theft green cards patrol faster...
  escapeSuspect: 0.15, // ...and grow suspicious sooner (escape pressure, no timer)
  defeatTime: 0.5, // s the defeat poof is on screen (the card has no body from the first tick)
});

/** Enemy types (RESEARCH_COMBAT.md section 4): one state machine - calm ->
 * suspect "?" -> alert "!" -> windup -> strike -> recover -> search -> calm -
 * and a table of numbers, so a type is a different spatial problem, not a
 * different rulebook. Every windup is >= 0.4 s of telegraph (tested). The
 * windup is committed (no turning), the strike is the only moment the spear
 * hurts, and the recovery is Rubik's opening (no body damage, stompable).
 *   chase:    px/s it walks toward Rubik while aware (0 = holds its post);
 *   range:    start a windup when Rubik is this far ahead (centre to centre);
 *   travel:   px it moves during the strike (clamped to its patrol bounds);
 *   stomp:    "defeat" (a poof) or "daze" (armoured: flipped and ringed for
 *             `daze` s, a second stomp or a dash-knock defeats it);
 *   wallDaze: s it stays dazed when a strike ends against its bound or a wall. */
export const ENEMY = Object.freeze({
  walker: Object.freeze({ chase: 190, range: 150, windup: 0.55, strike: 0.2, travel: 72, recover: 0.9, stomp: "defeat" }),
  sentinel: Object.freeze({ chase: 0, range: 130, windup: 0.65, strike: 0.16, travel: 0, recover: 1.0, stomp: "defeat" }),
  charger: Object.freeze({ chase: 120, range: 260, windup: 0.8, strike: 0.6, travel: 288, recover: 1.1, stomp: "daze", daze: 2.0, wallDaze: 1.6 }),
});
/** A card's type: explicit (`type` in its level data) or derived from how the
 * level already describes it. Patrols walk (a red patrol charges); a sentry
 * with 4+ tiles of room is mobile too (a red one charges), and a sentry that
 * is nailed to its post holds it and jabs. */
export function enemyType(spec) {
  if (spec.type) return spec.type;
  const mobile = spec.mode === "patrol" || spec.max - spec.min >= 128;
  return mobile ? (spec.kind === "red" ? "charger" : "walker") : "sentinel";
}

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
    // Keys held through a death wait WORLD.respawnHold after the respawn
    // (holdLock counts it down), or until let go and pressed again.
    heldLock: { left: false, right: false },
    holdLock: 0,
    knock: 0,
    hp: WORLD.hearts,
    invuln: 0, // s untouchable (blinking) after a hit
    hurt: 0, // s of the hit pose (presentation)
    chain: 0, // stomps and knocks since Rubik last touched the ground or was hit
    stomped: 0, // s after a stomp in which card bodies cannot hurt him
    safe: null, // last good ground {x, floor}: where a fall into water puts him back
    grace: WORLD.respawnGrace,
    storm: 0,
    stormFrom: color,
    landed: 0,
  };
}

function makeGuard(spec) {
  return {
    ...spec,
    type: enemyType(spec), // walker | sentinel | charger (ENEMY): one rulebook, three spatial problems
    defeatT: 0, // s since the defeat poof started
    lungeFrom: spec.x,
    bonk: false, // the strike in progress ends on its bound (a charger daze)
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
    takedowns: [], // ids of the cards defeated in this run (the Takedown stamp)
    hits: 0, // hearts lost to cards in this run (damage taken, for the tally and the proxies)
    hitsBy: {}, // ... by source: spear, bump
    falls: 0, // hearts lost to water (a survivable fall puts Rubik back on safe ground)
    chainBest: 0, // the longest stomp/knock chain of this run (the Chain stamp)
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
      ["drained", "stunned", "calm", "away", "defeated"].includes(guard.state)
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
  if (g.phase === "playing" && g.time > 0) {
    event(g, "checkpoint", cp.x, cp.floor, { id2: cp.id });
    // A checkpoint refills every heart (the chalk face is a rest).
    while (g.player.hp < WORLD.hearts) heal(g, "checkpoint");
  }
}

/** Rewind to the last checkpoint snapshot. Rubik faces the way the level
 * continues (home, i.e. left, during the getaway). */
const RESTORED = ["guards", "stones", "orbs", "pickups", "unlocked", "dashUnlocked", "stolen", "theftTime", "stomps", "bounces", "smashes", "knockouts", "takedowns"];
export function respawn(g) {
  // A fall into water that left hearts (g.deathKind "fall") puts Rubik back on
  // the last safe ground with the world as it is (what he defeated stays
  // defeated); zero hearts, a spear or a catch restores the checkpoint segment.
  const partial = g.deathKind === "fall",
    cp = g.level.checkpoints[g.checkpointIndex],
    before = g.player;
  let at = { x: cp.x, floor: cp.floor },
    color,
    dir;
  if (partial) {
    at = before.safe || at;
    color = before.color;
    dir = before.direction;
  } else {
    const s = structuredClone(g.snapshot);
    for (const key of RESTORED) g[key] = s[key];
    color = s.color;
    dir = g.stolen ? -1 : cp.dir ?? 1;
  }
  g.player = makePlayer(at.x - PLAYER.w / 2, at.floor, color, dir);
  g.player.safe = { ...at };
  if (partial) {
    g.player.hp = before.hp;
    g.player.invuln = WORLD.invuln; // the blink: a fall is never followed by a hit
    g.player.dashCharge = 1;
  }
  g.deathKind = null;
  // A direction held continuously since the death waits WORLD.respawnHold
  // (0.2 s), then moves Rubik as if pressed; one released and pressed again
  // during the hop counts at once. A retry (R) while alive locks nothing: the
  // player chose it. No input is lost: a jump pressed in the hop's last
  // moments fires on arrival.
  if (g.deathHeld) {
    g.player.heldLock = { ...g.deathHeld };
    g.player.holdLock = WORLD.respawnHold;
  }
  g.deathHeld = null;
  if (g.deadJump > 0) g.player.jumpBuffer = g.deadJump;
  g.deadJump = 0;
  g.calm = g.stolen ? WORLD.respawnCalm + 0.5 : WORLD.respawnCalm;
  g.phase = "playing";
  g.deathTimer = 0;
  g.hitstop = 0;
  g.pendingAbsorb = 0;
  g.colorCooldown = 0;
  g.respawns++;
  event(g, "respawn", g.player.x, g.player.y, { partial });
  return g;
}

export function die(g, reason) {
  const p = g.player;
  if (g.phase !== "playing") return false;
  if (reason !== "water" && p.grace > 0) return false;
  g.phase = "dead";
  g.deathKind = "death";
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

/** Water costs a heart whatever the blink says (a pit has no i-frames). With
 * hearts left Rubik hops back onto the last safe ground in 0.45 s and the cards
 * hold still for 0.75 s: a failed jump over water costs seconds, not a
 * checkpoint's worth of walking. The last heart is a real death. */
function fall(g) {
  const p = g.player;
  if (g.phase !== "playing") return;
  p.hp -= 1;
  g.falls++;
  p.chain = 0;
  if (inDashZone(g)) g.hintData.gapFails++;
  if (p.hp <= 0) {
    die(g, "water");
    return;
  }
  g.phase = "dead";
  g.deathKind = "fall";
  g.deathHeld = { left: true, right: true };
  g.deathTimer = WORLD.respawnDelay;
  g.deathReason = "water";
  g.deathAt = { x: p.x, y: p.y, color: p.color, direction: p.direction };
  event(g, "fall", p.x + p.w / 2, p.y, { hp: p.hp });
}

/** Remember ground worth coming back to: Rubik is standing at least 14 px
 * inside both edges of it, no card that can hurt is within 130 px on his
 * floor, and he is not being knocked about. */
function trackSafe(g) {
  const p = g.player,
    cx = p.x + p.w / 2,
    row = Math.round((p.y + p.h) / TILE);
  if (p.knock > 0 || p.dashTime > 0 || p.invuln > 0) return;
  for (const off of [-14, 14]) {
    const tx = Math.floor((cx + off) / TILE);
    if (!blocked(g, tx, row)) return;
  }
  for (const c of g.guards) {
    if (["away", "defeated", "drained", "stunned"].includes(c.state)) continue;
    if (Math.abs(c.x - cx) < 130 && Math.abs(c.floor - (p.y + p.h)) < 60) return;
  }
  p.safe = { x: cx, floor: p.y + p.h };
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
    reach = GUARD.spearReach[guard.kind] ?? GUARD.spearReach.green,
    [low, high] = GUARD.spearBand[guard.kind] || GUARD.spearBand.green;
  return {
    x: guard.dir > 0 ? front : front - reach,
    y: guard.floor - high,
    w: reach,
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
  // "!" is a beat, not an attack: the card stands before it moves.
  guard.timer = wasAware ? 0 : GUARD.notice;
  if (counted && !wasAware) {
    g.spotted++;
    event(g, "spotted", guard.x, guard.floor - GUARD.h, { guard: guard.id });
    // Caught (level.caught, 1-3): the stealth lesson. A card that says "!"
    // raises the alarm and Rubik is sent back to the last checkpoint (Ocarina
    // of Time's castle courtyard: seen = thrown out, no heart lost). The "?"
    // before it (0.25 s seen) is the warning: 0.35 s to leave the cone.
    if (g.level.caught) die(g, "caught");
  }
}

/** The ground a strike will sweep: from the card's front edge to the tip of
 * its spear at the end of the travel (clamped to its patrol bounds), at the
 * spear's height. The renderer draws it during the windup (the telegraph is
 * the hit shape), and the tests compare it with the drawn spear. */
export function strikeZone(guard) {
  const prof = ENEMY[guard.type] || ENEMY.walker,
    room = Math.max(0, guard.dir > 0 ? guard.max - guard.x : guard.x - guard.min),
    travel = Math.min(prof.travel, room),
    reach = GUARD.spearReach[guard.kind] ?? GUARD.spearReach.green,
    [low, high] = GUARD.spearBand[guard.kind] || GUARD.spearBand.green,
    front = guard.x + guard.dir * (GUARD.w / 2),
    end = front + guard.dir * (travel + reach);
  return { x: Math.min(front, end), w: Math.abs(end - front), y: guard.floor - high, h: high - low, travel };
}

function updateGuard(g, guard, dt) {
  const p = g.player;
  guard.anim += dt;
  if (guard.state === "defeated") {
    guard.defeatT += dt;
    return;
  }
  if (guard.state === "drained" || guard.state === "away") return;
  guard.reach = coneReach(g, guard);
  const prof = ENEMY[guard.type] || ENEMY.walker;
  if (guard.state === "stunned") {
    // Dazed (an armoured card stomped once, or a charge that ended on its
    // bound): flipped, ringed, harmless. Not a timer to wait out: a second
    // stomp or a dash-knock defeats it, and when the ring runs out it is up
    // again and angry (search -> it sees Rubik at once if he is in its cone).
    guard.sees = false;
    guard.locked = false;
    guard.timer -= dt;
    if (guard.timer <= 0) {
      guard.state = "search";
      guard.timer = 0;
      guard.lost = 0;
      event(g, "recovered", guard.x, guard.floor - GUARD.h, { guard: guard.id });
    }
    return;
  }
  guard.squash = tick(guard.squash, dt);
  if (g.calm > 0) {
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
        // "?" is a card that stopped and turned to look: facing him is how
        // the player reads what it noticed (a patrol no longer walks on).
        if (Math.abs(dx) > 4 && guard.state === "suspect") guard.dir = Math.sign(dx);
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
          event(g, "gaveup", guard.x, guard.floor - GUARD.h, { guard: guard.id });
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
      const attacks = g.level.spears !== false,
        sameFloor = Math.abs(p.y + p.h - guard.floor) < 48,
        atBound = guard.dir > 0 ? guard.x >= guard.max - 0.5 : guard.x <= guard.min + 0.5,
        facing = Math.sign(dx) === guard.dir,
        zone = strikeZone(guard),
        // Could the strike from here connect with Rubik's body? A card never
        // starts a windup it could not finish with a hit (no bluffing from
        // out of reach), and the 24 px of slack is the telegraph's grace.
        inReach = Math.abs(dx) - p.w / 2 <= GUARD.w / 2 + zone.travel + (GUARD.spearReach[guard.kind] ?? GUARD.spearReach.green) + 24;
      if (attacks && sees && sameFloor && inReach && facing && Math.abs(dx) <= prof.range) {
        guard.state = "windup";
        guard.timer = prof.windup;
        guard.stuck = 0;
        event(g, "windup", guard.x, guard.floor - GUARD.h, { guard: guard.id, etype: guard.type, windup: prof.windup });
        break;
      }
      // Give up: a card that cannot reach Rubik - pinned at its bound, nailed
      // to its post, or he is on another floor - stands on "!" for a second
      // and then looks around instead of staring at him forever.
      const stalled = !sameFloor || prof.chase === 0 || (atBound && facing);
      if (stalled) {
        guard.stuck += dt;
        if (guard.stuck >= 1) {
          guard.stuck = 0;
          guard.state = "search";
          guard.lost = 0;
          guard.sight = 0;
          event(g, "gaveup", guard.x, guard.floor - GUARD.h, { guard: guard.id });
          break;
        }
      } else {
        guard.stuck = 0;
        guard.x += guard.dir * prof.chase * dt;
        clampX();
      }
      break;
    }
    case "windup": {
      // Committed: it cannot turn or move, so a dodge is a read of a fixed line.
      guard.timer -= dt;
      if (guard.timer <= 0) {
        guard.state = "lunge";
        guard.timer = prof.strike;
        guard.lungeFrom = guard.x;
        guard.lungeTarget = Math.max(guard.min, Math.min(guard.max, guard.x + guard.dir * prof.travel));
        // A strike cut short by its bound or a wall (>= 24 px) is a bonk for a charger.
        guard.bonk = Math.abs(guard.x + guard.dir * prof.travel - guard.lungeTarget) >= 24;
        event(g, "strike", guard.x, guard.floor - GUARD.h, { guard: guard.id, etype: guard.type });
      }
      break;
    }
    case "lunge": {
      guard.timer -= dt;
      if (prof.travel > 0) guard.x = toward(guard.x, guard.lungeTarget, (prof.travel / prof.strike) * dt);
      if (guard.timer <= 0) {
        if (guard.bonk && prof.wallDaze) {
          guard.state = "stunned";
          guard.timer = prof.wallDaze;
          event(g, "bonk", guard.x + guard.dir * (GUARD.w / 2), guard.floor - GUARD.h / 2, { guard: guard.id });
        } else {
          guard.state = "recover";
          guard.timer = prof.recover;
        }
      }
      break;
    }
    case "recover": {
      guard.timer -= dt;
      if (guard.timer <= 0) {
        guard.state = sees ? "alert" : "search";
        guard.lost = 0;
        guard.timer = sees ? 0.3 : 0; // a short beat: never an instant second attack
      }
      break;
    }
  }
}

/** The Takedown stamp counts each card once, however it was put down. */
function takedown(g, guard) {
  if (!g.takedowns.includes(guard.id)) g.takedowns.push(guard.id);
}
/** A card is defeated: a poof, no body, no cone, gone for the rest of the
 * segment (a death restores it with the rest of the world), unless it is a
 * `pad`. `how` is "stomp" or "knock"; the renderer reads `defeatHow` and
 * `defeatDir`. */
function defeat(g, guard, how, dir = 0) {
  guard.sees = false;
  guard.locked = false;
  guard.sight = 0;
  takedown(g, guard);
  if (guard.pad) {
    // A springboard card (level data `pad`): the level needs its bounce, so a
    // failed attempt must never strand Rubik below a wall with the card gone.
    // It is flattened for good - grey, harmless, bounce on it as often as you
    // like (no chain: nothing is farmed) - the glow card's rule.
    guard.state = "drained";
    event(g, "defeat", guard.x, guard.floor - GUARD.h / 2, { guard: guard.id, how, etype: guard.type, pad: true });
    return;
  }
  guard.state = "defeated";
  guard.defeatT = 0;
  guard.defeatHow = how;
  guard.defeatDir = dir || guard.dir;
  event(g, "defeat", guard.x, guard.floor - GUARD.h / 2, { guard: guard.id, how, etype: guard.type, pad: false });
}
/** One more stomp or knock in the chain Rubik has not interrupted by touching
 * the ground or being hit. The third pays a heart (Super Mario World's 1-Up
 * on the long chain, at a size this game's short levels can reach). */
function chainUp(g, x, y) {
  const p = g.player;
  p.chain++;
  g.chainBest = Math.max(g.chainBest, p.chain);
  event(g, "chain", x, y, { n: p.chain });
  if (p.chain === WORLD.chainHeal) heal(g, "chain");
  return p.chain;
}
function heal(g, source) {
  const p = g.player;
  if (p.hp >= WORLD.hearts) return false;
  p.hp++;
  event(g, "heal", p.x + p.w / 2, p.y, { source, hp: p.hp });
  return true;
}
function stomp(g, guard) {
  const p = g.player;
  // Hold jump (or press it as you land: up to 0.12 s before, or during the
  // freeze and 0.05 s after) for the high bounce; otherwise a hop. Each stomp
  // chained before touching ground adds a little bounce (never more than
  // +40 px/s, about +14 px of apex), so the chain keeps its height.
  const drained = guard.state === "drained",
    high = p.jumpHeld || p.jumpBuffer > 0,
    chain = drained ? 0 : chainUp(g, guard.x, guard.floor - GUARD.h),
    step = Math.min(WORLD.chainBounceMax, Math.max(0, chain - 1)) * WORLD.chainBounceStep;
  p.vy = -((high ? WORLD.stompBounce : WORLD.stompBounceLow) + step);
  p.jumpHeld = high;
  p.jumpBuffer = 0;
  p.bounce = high ? 0 : WORLD.hitstop.stomp + WORLD.stompGrace;
  p.jumps = 1;
  p.airJumped = false; // a bounce refreshes white's air jump
  p.rising = false;
  p.grounded = false;
  p.stomped = 0.2; // no contact damage while he rises out of the card he landed on
  g.hitstop = Math.max(g.hitstop, WORLD.hitstop.stomp + Math.min(0.04, Math.max(0, chain - 1) * WORLD.chainHitstop));
  refill(g, "stomp");
  guard.squash = 0.16;
  if (drained) {
    // The drained card stays dazed forever: a springboard (a bounce, not a
    // defeat, so nothing is farmed).
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
  g.stomps++;
  if (g.hints.behind === "shown") g.hints.behind = "done";
  event(g, "stomp", guard.x, guard.floor - GUARD.h, { guard: guard.id, chain, etype: guard.type, high });
  const prof = ENEMY[guard.type] || ENEMY.walker;
  if (prof.stomp === "daze" && guard.state !== "stunned") {
    // Armoured: the first stomp flips it and starts a visible ring. The second
    // stomp (or a dash-knock) defeats it; neither, and it gets up angry.
    guard.state = "stunned";
    guard.timer = prof.daze;
    guard.sight = 0;
    guard.bumps = 0;
    event(g, "daze", guard.x, guard.floor - GUARD.h, { guard: guard.id, chain });
    return;
  }
  defeat(g, guard, "stomp", Math.sign(guard.x - (p.x + p.w / 2)));
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
/** Every card can be stomped from above, whatever it faces or is doing: the
 * old rule (a card facing Rubik raised its spear and a landing "popped" him)
 * was the unreadable half of the stomp. The danger is the strike in front of
 * a card and its body, never its head. */
export function stompable(g, guard) {
  return !["away", "defeated"].includes(guard.state);
}

/** The one way a card, a bump or a fall takes a heart. Returns false when
 * Rubik is untouchable (respawn / theft grace, or the blink after a hit).
 * The hit: hit-stop, knockback away from the source, a short loss of steering,
 * `invuln` seconds of blinking, the chain broken. Zero hearts is a death. */
function hurt(g, source, fromX, guard = null) {
  const p = g.player;
  if (g.phase !== "playing" || p.grace > 0 || p.invuln > 0) return false;
  const away = Math.sign(p.x + p.w / 2 - fromX) || -(guard?.dir || 1),
    was = { vy: Math.round(p.vy), grounded: p.grounded, feet: Math.round(p.y + p.h) };
  p.hp -= 1;
  p.invuln = WORLD.invuln;
  p.hurt = WORLD.hurtReact;
  p.chain = 0;
  p.vx = away * (source === "spear" ? WORLD.hurtKnockSpear : WORLD.hurtKnock);
  p.vy = -WORLD.hurtPop;
  p.knock = WORLD.hurtStun;
  p.dashTime = 0;
  p.grounded = false;
  p.carry = 0;
  g.hits++;
  g.hitsBy[source] = (g.hitsBy[source] || 0) + 1;
  g.hitstop = Math.max(g.hitstop, WORLD.hitstop.hurt);
  event(g, "hurt", p.x + p.w / 2, p.y + p.h / 2, { source, hp: p.hp, guard: guard?.id, dir: away, was });
  // 1-2's bubble: the first hit teaches the stomp (a card, an arrow onto its head).
  if (levelHint(g, "behind") && g.hints.behind === "pending") showHint(g, "behind");
  if (p.hp <= 0) die(g, source);
  return true;
}

function guardContacts(g, prevBottom) {
  const p = g.player;
  for (const guard of g.guards) {
    if (guard.state === "away" || guard.state === "defeated") continue;
    // Which world side Rubik approaches from (kept while he is over its head).
    const rel = p.x + p.w / 2 - guard.x;
    if (Math.abs(rel) > 40) guard.sideX = Math.sign(rel);
    const box = guardBox(guard),
      top = guard.floor - GUARD.h,
      widen = guard.catch ?? WORLD.stompWiden;
    // The stomp: Rubik is falling and his feet were no more than `stompDepth`
    // below the card's top on the previous tick, over a head wider than the
    // body (Mario-style forgiveness). Landing from the side or from behind on
    // the card's upper third is a stomp too, never a hit.
    const head = { x: box.x - widen, y: box.y, w: box.w + widen * 2, h: box.h };
    if (p.vy > 0 && prevBottom <= top + WORLD.stompDepth && overlaps(p, head)) {
      stomp(g, guard);
      continue;
    }
    if (!overlaps(p, box)) continue;
    // Disguised: a card lets its own colour through, unless it is locked on
    // (it watched him swap, so it still sees him): then its body blocks him
    // like any other colour's.
    if (p.color === guard.kind && !guard.sees && guard.state !== "stunned") continue;
    if (guard.state === "drained") continue;
    if (p.color === "red" && p.dashTime > 0) {
      // Red dash knocks a card out (the second way to defeat one, and the
      // only way to finish a dazed armoured card without a second stomp) and
      // refunds the dash (M5/M7 power). It joins the stomp chain.
      const dir = p.dashDirection;
      g.knockouts++;
      g.hitstop = Math.max(g.hitstop, WORLD.hitstop.knock);
      refill(g, "knock");
      chainUp(g, guard.x, guard.floor - GUARD.h / 2);
      defeat(g, guard, "knock", dir);
      event(g, "knock", guard.x, guard.floor - GUARD.h / 2, { guard: guard.id, dir });
      continue;
    }
    if (guard.state === "stunned") continue; // dazed: walk through, or stomp it
    // Solid but unhurt: respawn grace, the blink after a hit, the rise out of
    // a stomp, and an open card (its recovery is the player's opening).
    if (p.grace > 0 || p.invuln > 0 || p.stomped > 0 || guard.state === "recover") {
      separate(g, box);
      continue;
    }
    // Body contact hurts (one heart, a small bump), from the front, the side
    // or behind; only a head-first landing is free. A calm card that is
    // walked into from behind does not notice (it is a bump, not an alarm).
    const behindCalm = guard.state === "calm" && aheadOf(g, guard) < -4,
      away = Math.sign(p.x + p.w / 2 - guard.x) || -guard.dir;
    separate(g, box);
    if (!hurt(g, "bump", guard.x, guard)) continue;
    event(g, "bump", p.x + p.w / 2, p.y + p.h / 2, { guard: guard.id });
    if (!behindCalm && g.phase === "playing") {
      guard.dir = away; // turn to face the one it bumped
      alertGuard(g, guard);
      guard.timer = GUARD.bumpReaction;
    }
  }
  for (const guard of g.guards)
    if (guard.state === "lunge" && overlaps(p, spearBox(guard))) hurt(g, "spear", guard.x, guard);
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
  p.invuln = tick(p.invuln, dt);
  p.hurt = tick(p.hurt, dt);
  p.stomped = tick(p.stomped, dt);
  p.storm = tick(p.storm, dt);
  p.dashCooldown = tick(p.dashCooldown, dt);
  if (!(p.dashTime > 0 && p.dashAir)) p.jumpBuffer = tick(p.jumpBuffer, dt);
  p.knock = tick(p.knock, dt);
  p.bounce = tick(p.bounce, dt);
  g.calm = tick(g.calm, dt);
  p.landed = tick(p.landed, dt);
  if (!p.grounded) p.coyote = tick(p.coyote, dt);
  if (input.color) switchColor(g, input.color);
  p.holdLock = tick(p.holdLock, dt);
  for (const key of ["left", "right"]) if (!input[key] || p.holdLock <= 0) p.heldLock[key] = false;
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
    p.chain = 0; // touching ground ends a chain (the third stomp already paid)
    trackSafe(g);
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
  if (p.y + p.h > WATER_ROW * TILE + 16 || p.y > WORLD.height) fall(g);
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
    chain: g.chainBest, // the longest stomp/knock chain (the Chain stamp when >= level.chainPar)
    hits: g.hits + g.falls, // hearts lost in this run
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
