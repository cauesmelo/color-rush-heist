/** Human-proxy players for Color Rush Heist (dev tool, not a test; never shipped).
 *
 * The scripted routes prove a level is POSSIBLE. These proxies estimate what a
 * person does with it. Each proxy is a closed-loop player with human limits:
 *
 * - Timing noise. A press aims at the middle of the window of press times
 *   that work (found by stepping copies of the real model forward), then lands
 *   N(0, sigma) away from it. A window narrower than a person's spread is
 *   where people die: that is what we want to measure.
 * - Reaction time. Anything that changes (a card turns, Rubik falls short, a
 *   respawn) is seen `react` seconds late: card facings are read from a delayed
 *   history, and an unplanned correction in the air can't come sooner.
 * - Knowledge. A verb is used only once the game has shown it: the double jump
 *   once one happened (1-1's wall, or mashing), the dash after DASH GET, a
 *   colour once its GET card has been seen (World 1 order). Text bubbles are
 *   never read by the first-timer.
 * - Habits. The first-timer holds the travel direction the whole time,
 *   through deaths, and mashes jump at walls. The casual stops before a card
 *   that faces him and goes when he sees its back. The expert also reads
 *   turn timing ahead (it steps copies with the cards moving) and never waits
 *   longer than needed.
 *
 * Locomotion planning steps copies with every card FROZEN where it stands (as
 * a person who doesn't predict patrols sees them); only the expert's stealth
 * check lets cards move. The proxy reads the game object only: the same
 * decide() runs in Node (fast sweeps) and in Chrome (tests/human-proxy-chrome.mjs
 * turns its wishes into real key events).
 *
 *   node tests/human-proxy-run.mjs [level|all] [runs] [persona|all]
 */

export const PERSONAS = Object.freeze({
  first: Object.freeze({ id: "first", label: "first-timer", react: [0.25, 0.3], sigma: 0.09, holdsForward: true, mash: true, stealth: "none", readsGlyphs: false }),
  casual: Object.freeze({ id: "casual", label: "casual", react: [0.2, 0.25], sigma: 0.06, holdsForward: false, mash: false, stealth: "wait", readsGlyphs: true }),
  expert: Object.freeze({ id: "expert", label: "expert", react: [0.16, 0.2], sigma: 0.03, holdsForward: false, mash: false, stealth: "anticipate", readsGlyphs: true }),
});

/** What a player arriving at each level already knows (World 1 order): the
 * double jump from 1-1, green from 1-2's GET, the dash from 1-4's GET. */
const BEFORE = {
  "1-1": [],
  "1-2": ["air"],
  "1-3": ["air", "green", "white"],
  "1-4": ["air", "green", "white"],
  "1-5": ["air", "green", "white", "dash"],
  "1-6": ["air", "green", "white", "dash"],
};

const T = 32,
  TICK = 1 / 120;

/** Small seeded PRNG (mulberry32) and a normal sample (Box-Muller). */
export function rng(seed) {
  let a = seed >>> 0 || 1;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  next.normal = () => {
    const u = Math.max(1e-9, next()),
      v = next();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  };
  return next;
}

export function makeProxy(personaId, seed, levelId, { campaign = true } = {}) {
  const persona = PERSONAS[personaId];
  const r = rng(seed * 7919 + personaId.length * 104729 + 17);
  return {
    persona,
    r,
    // The expert plays platformers: he tries a double jump without being told.
    knows: new Set(campaign ? [...(BEFORE[levelId] || []), ...(personaId === "expert" ? ["air"] : [])] : ["air", "green", "white", "dash", "red"]),
    tick: 0,
    react: persona.react[0] + r() * (persona.react[1] - persona.react[0]),
    plan: [], // [{at, type, value}] absolute proxy ticks
    jumpHeld: false,
    lastPlanAt: -999,
    airPlanned: false, // the ground plan meant an air press (no reaction delay)
    airPlanAt: -999,
    takeoffAt: -999,
    wasGrounded: true,
    busyUntil: 0, // no new plan before this tick (reaction after a respawn)
    history: [], // card facings per tick (for delayed perception)
    best: -1e9,
    bestAt: 0,
    respawns: 0,
    phase: "playing",
    waitStart: null,
    stuckTries: 0,
    backUntil: 0,
    mashNext: 0,
    lastEvent: 0,
    log: { waits: 0, plans: 0, noPlan: 0 },
    deathsAt: {}, // deaths per 4-column bin (the first-timer escalates after one)
    triesAt: {}, // failed tries at a wall per bin (or after two of those)
  };
}

// ------------------------------------------------------------- world reads --
const dirOf = (g) => (g.stolen ? -1 : 1);
const cxOf = (g) => g.player.x + g.player.w / 2;
const feetOf = (g) => g.player.y + g.player.h;
const progOf = (g) => dirOf(g) * cxOf(g);
const active = (c) => !["away", "stunned", "drained", "defeated"].includes(c.state);
/** A flattened `pad` card is still a springboard (RESEARCH_COMBAT.md section 5):
 * a person who has bounced on a card knows its grey flat remains bounce again. */
const bouncy = (c) => active(c) || (c.pad && c.state === "drained");
/** Stomps plus pad bounces: every time Rubik left a card's head upward. */
const hops = (g) => g.stomps + (g.bounces ?? 0);
function solidAt(g, M, tx, ty) {
  return ty >= 0 && M.blocked(g, tx, ty);
}
/** Height in tiles of the solid column `tx` above the feet row (0 = none). */
function wallHeight(g, M, tx, feet) {
  const row = Math.floor((feet - 2) / T);
  let h = 0;
  while (h < 10 && solidAt(g, M, tx, row - h)) h++;
  return h;
}
/** First column at or after `from` (in `dir`) whose surface is ground, not water. */
function landingAfter(g, M, fromTx, dir) {
  for (let i = 0, tx = fromTx; i < 60; i++, tx += dir) {
    if (tx < 0 || tx >= g.level.cols) return tx;
    if (g.level.map[20][tx] !== "~") {
      for (let ty = 0; ty < 20; ty++) if (solidAt(g, M, tx, ty) || g.level.map[ty][tx] === "=") return tx;
    }
  }
  return fromTx + dir * 60;
}

/** A copy of the game that the planner can step. Cards frozen = the calm hold. */
function copy(g, frozen) {
  const c = structuredClone(g);
  Object.defineProperty(c, "level", { value: g.level, enumerable: false });
  if (frozen) c.calm = 1e9;
  return c;
}

/** The in-air habits a player who knows the verbs falls back on, used to
 * judge chains the planner can't enumerate (orb -> dash -> orb, stomp ->
 * held bounce -> stomp): hold jump onto a card's head (the high bounce), air
 * jump at the apex over water or against a wall, dash at the apex over water
 * whenever a charge is there. `knows` gates each verb. */
function autoAir(c, M, input, knows) {
  const p = c.player,
    dir = dirOf(c),
    cx = cxOf(c),
    feet = feetOf(c);
  if (p.grounded) return;
  const tx = Math.floor(cx / T),
    overWater = (() => {
      for (let ty = Math.max(0, Math.floor(feet / T)); ty < 22; ty++) {
        const ch = c.level.map[ty]?.[tx];
        if (ch === "~") return true;
        if (ch === "#" || ch === "=") return false;
      }
      return true;
    })();
  // Bounce: a card's head below within reach while falling -> hold jump.
  const card = c.guards.some((k) => bouncy(k) && Math.abs(k.x - cx) < 40 && feet <= k.floor - M.GUARD.h + 4 && k.floor - M.GUARD.h - feet < 50);
  c.autoState ??= { held: !!p.jumpHeld, stomps: hops(c) };
  const st = c.autoState;
  if (hops(c) > st.stomps) {
    st.stomps = hops(c);
    input.jump = true; // pressed as he lands: the high bounce
    st.held = true;
    return;
  }
  if (card && p.vy > 0 && !st.held) {
    input.jump = true;
    st.held = true;
    return;
  }
  // Aim at a card's head ahead and below while falling (Mario's habit).
  if (p.vy > 0) {
    const head = c.guards.find((k) => bouncy(k) && (k.x - cx) * dir > -40 && (k.x - cx) * dir < 160 && k.floor - M.GUARD.h > feet - 4 && k.floor - M.GUARD.h - feet < 200);
    if (head) {
      input.left = cx > head.x + 8;
      input.right = cx < head.x - 8;
    }
  }
  const wall = M.blocked(c, Math.floor((cx + dir * (p.w / 2 + 6)) / T), Math.floor((feet - 8) / T));
  if (knows.air && p.color === "white" && !p.airJumped && p.vy >= 0 && (overWater || wall)) {
    if (st.held) {
      input.jumpReleased = true;
      st.held = false;
    } else {
      input.jump = true;
      st.held = true;
    }
    return;
  }
  if (knows.dash && c.dashUnlocked && p.dashCharge > 0 && p.dashTime <= 0 && p.vy >= -20 && overWater) input.dash = true;
}

/** Step a copy with plan inputs until done(c, i) says stop. Plan entries are
 * relative ticks: {k: jump press, hold: ticks held, air: "apex"|ticks after
 * takeoff, dash: "apex"|ticks after takeoff|"now"}. */
function simulate(g, M, plan, { frozen = true, horizon = 300, dir = dirOf(g), done }) {
  const c = copy(g, frozen);
  const move = plan.stop ? {} : dir > 0 ? { right: true } : { left: true };
  let takeoff = -1,
    airDone = plan.air == null,
    dashDone = plan.dash == null,
    released = false;
  for (let i = 0; i < horizon; i++) {
    const input = { ...(plan.stopUntil && i < plan.stopUntil ? {} : move) };
    if (plan.back && i < plan.back) Object.assign(input, dir > 0 ? { left: true, right: false } : { right: true, left: false });
    if (i === plan.k) {
      input.jump = true;
      takeoff = i;
    }
    if (takeoff >= 0 && !released && i === takeoff + plan.hold) {
      input.jumpReleased = true;
      released = true;
    }
    const p = c.player,
      since = takeoff >= 0 ? i - takeoff : -1;
    if (!airDone && since > 2 && !p.grounded && (plan.air === "apex" ? p.vy >= -20 : since >= plan.air)) {
      if (!released) (input.jumpReleased = true), (released = true);
      else input.jump = true;
      if (input.jump) airDone = true;
    }
    if (!dashDone) {
      const fire = plan.dash === "now" ? i === (plan.k ?? 0) : since > 2 && !p.grounded && (plan.dash === "apex" ? p.vy >= -20 && (airDone || plan.air == null) : since >= plan.dash);
      if (fire) {
        input.dash = true;
        dashDone = true;
      }
    }
    if (plan.color && i === 0) input.color = plan.color;
    if (plan.auto && since > 2) autoAir(c, M, input, plan.auto);
    M.update(c, TICK, input);
    const verdict = done(c, i);
    if (verdict !== undefined) return { ok: verdict, c, i };
    if (c.phase === "dead" || c.phase === "won") return { ok: c.phase === "won", c, i };
  }
  return { ok: false, c, i: horizon };
}

/** Walk on (no presses) and report what happens first: safe, a death, or a stall. */
function probeWalk(g, M, horizon = 140) {
  const start = progOf(g);
  let stall = 0,
    lastProg = start,
    outcome = { kind: "safe" };
  simulate(g, M, {}, {
    horizon,
    done: (c, i) => {
      if (c.phase === "dead") {
        outcome = { kind: "death", at: i, x: c.deathAt?.x ?? cxOf(c), reason: c.deathReason };
        return false;
      }
      if (c.phase === "won") {
        outcome = { kind: "won" };
        return true;
      }
      const pr = progOf(c);
      if (c.hitstop <= 0 && c.player.knock <= 0) stall = pr - lastProg < 0.05 ? stall + 1 : 0;
      if (c.player.knock > 0) {
        outcome = { kind: "bump", at: i, x: cxOf(c) };
        return false;
      }
      lastProg = pr;
      if (stall > 12) {
        outcome = { kind: "stall", at: i - 12, x: cxOf(c) };
        return false;
      }
      return undefined;
    },
  });
  outcome.start = start;
  return outcome;
}

/** Success: alive, standing, and past `target` (progress), within the horizon. */
const reaches = (target, extra = () => true) => (c) => {
  if (c.phase === "dead") return false;
  if (c.phase === "won") return true;
  // A stomp past the start is progress too (a chain of backs over water).
  c.stompBase ??= hops(c);
  if (hops(c) > c.stompBase && c.hitstop <= 0 && progOf(c) >= target - 6 * T && extra(c)) return true;
  if (c.player.grounded && c.hitstop <= 0 && progOf(c) >= target && extra(c)) return true;
  return undefined;
};

/** The jump plans a person tries, simplest first, with only known verbs. */
function candidatePlans(g, bot) {
  const p = g.player,
    air = bot.knows.has("air") && p.color === "white",
    dash = g.dashUnlocked && bot.knows.has("dash") && p.dashCharge > 0;
  const families = [{ hold: 36 }];
  if (air) families.push({ hold: 30, air: "apex" });
  if (dash) families.push({ hold: 30, dash: "apex" });
  if (air && dash) families.push({ hold: 30, air: "apex", dash: "apex" });
  families.push({ hold: 4 }); // a short hop (under a low ceiling, onto a card)
  if (dash) families.push({ dash: "now", k: 0, hold: 0, noJump: true });
  // Chains: whatever habits he has, applied in the air (orbs, bounces).
  families.push({ hold: 40, auto: { air, dash: g.dashUnlocked && bot.knows.has("dash") } });
  return families;
}

/** Find the window of press ticks that works for a family; returns the window. */
function window(g, M, family, target, kMin, kMax, step, horizon) {
  const ok = [];
  for (let k = kMin; k <= kMax; k += step) {
    const plan = family.noJump ? { dash: "now", k } : { ...family, k };
    const res = simulate(g, M, plan, { horizon: k + horizon, done: reaches(target) });
    ok.push(res.ok ? k : null);
    // Best effort: how far the attempt got (a person still tries the jump
    // that looks closest to working).
    const far = res.c.phase === "dead" ? dirOf(res.c) * (res.c.deathAt?.x ?? 0) : progOf(res.c);
    if (!window.best || far > window.best.far) window.best = { far, k, family };
  }
  // Largest contiguous run of successes.
  let best = null,
    run = null;
  for (const k of ok) {
    if (k === null) {
      run = null;
      continue;
    }
    if (!run) run = { lo: k, hi: k };
    else run.hi = k;
    if (!best || run.hi - run.lo > best.hi - best.lo) best = { ...run };
  }
  return best;
}

function schedule(bot, at, type, value = true) {
  bot.plan.push({ at: Math.max(bot.tick, Math.round(at)), type, value });
  bot.plan.sort((a, b) => a.at - b.at);
}
const noise = (bot) => bot.r.normal() * bot.persona.sigma * 120;

/** Ground planning: walk on if that is safe; otherwise pick a jump family and
 * aim at the middle of its window of press times (+ the person's noise). */
function planGround(g, M, bot, outcome) {
  const dir = dirOf(g),
    cx = cxOf(g);
  let target, kMax;
  if (outcome.kind === "death") {
    const tx = landingAfter(g, M, Math.floor(outcome.x / T) + dir, dir);
    target = dir * (tx * T + T / 2) + 8;
    kMax = Math.max(6, outcome.at + 10);
  } else {
    target = dir * outcome.x + 40;
    kMax = Math.max(6, outcome.at + 6);
  }
  // People jump near the edge or wall they see, not 0.5 s before it.
  kMax = Math.min(kMax, 96);
  const kMin = Math.max(0, kMax - 60);
  window.best = null;
  // The first-timer's first try at a new spot is a plain jump (he doesn't
  // yet know the bank is too high): only a death there makes him plan more.
  const bin = Math.floor(cx / T / 4),
    naive = bot.persona.id === "first" && !(bot.deathsAt[bin] > 0) && !(bot.deathsAt[bin + dir] > 0) && !((bot.triesAt[bin] || 0) >= 2);
  if (outcome.kind !== "death") bot.triesAt[bin] = (bot.triesAt[bin] || 0) + 1;
  const families = candidatePlans(g, bot).filter((f) => !naive || (f.air == null && f.dash == null && !f.auto && !f.noJump));
  for (const family of families) {
    const w = window(g, M, family, target, kMin, kMax, 3, 260);
    if (!w) continue;
    bot.log.plans++;
    const center = (w.lo + w.hi) / 2,
      press = bot.tick + center + noise(bot);
    if (family.noJump) {
      schedule(bot, press, "dash");
      return true;
    }
    schedule(bot, press, "jump");
    schedule(bot, press + family.hold + noise(bot) * 0.5, "release");
    bot.airPlanned = family.air != null || family.dash != null;
    bot.intent = family;
    return true;
  }
  bot.log.noPlan++;
  // Nothing works: if walking on means death, try the attempt that got furthest.
  const best = window.best;
  if (outcome.kind === "death" && best && best.far > dir * outcome.x) {
    const press = bot.tick + best.k + noise(bot);
    if (best.family.noJump) schedule(bot, press, "dash");
    else {
      schedule(bot, press, "jump");
      schedule(bot, press + best.family.hold + noise(bot) * 0.5, "release");
    }
    bot.airPlanned = true;
    bot.intent = best.family;
    return true;
  }
  return false;
}

/** In the air: if the current arc already lands safely, do nothing. Else find
 * the window for an air jump or a dash and aim at its middle. An unplanned
 * correction can't come before the person notices (takeoff + reaction). */
function planAir(g, M, bot) {
  const p = g.player;
  const drift = simulate(g, M, {}, { horizon: 200, done: reaches(-1e9) });
  if (drift.ok) {
    // Lands somewhere alive; air jump only if the plan meant one (a wall to top).
    if (!bot.airPlanned) return;
  }
  // Steering: brake (let go of the direction) or aim at a card's head below.
  if (!drift.ok && !bot.steer && !bot.spring) {
    const dir = dirOf(g),
      cx = cxOf(g),
      card = g.guards
        .filter((k) => bouncy(k) && (k.x - cx) * dir > -60 && (k.x - cx) * dir < 260 && k.floor - M.GUARD.h > feetOf(g) - 10)
        .sort((a, b) => Math.abs(a.x - cx) - Math.abs(b.x - cx))[0];
    const tries = [{ mode: "brake" }];
    if (card) tries.unshift({ mode: "aim", x: card.x });
    for (const steer of tries) {
      const c = copy(g, true);
      let ok = false;
      for (let i = 0; i < 240; i++) {
        const input = steerInput(c, steer);
        if (i > 2) autoAir(c, M, input, { air: bot.knows.has("air"), dash: g.dashUnlocked && bot.knows.has("dash") });
        M.update(c, TICK, input);
        if (c.phase === "dead") break;
        if (c.phase === "won" || (c.player.grounded && c.hitstop <= 0 && i > 2)) {
          ok = c.phase === "won" || progOf(c) > progOf(g) - 8;
          break;
        }
      }
      if (ok) {
        bot.steer = { ...steer, from: bot.airPlanned ? bot.tick : Math.max(bot.tick, bot.takeoffAt + bot.react * 120) };
        return;
      }
    }
  }
  const options = [];
  if (bot.knows.has("air") && p.color === "white" && !p.airJumped) options.push("air");
  if (g.dashUnlocked && bot.knows.has("dash") && p.dashCharge > 0 && p.dashTime <= 0) options.push("dash");
  if (!options.length) return;
  if (drift.ok && !bot.airPlanned) return;
  const earliest = bot.airPlanned ? bot.tick : Math.max(bot.tick, bot.takeoffAt + bot.react * 120);
  for (const kind of options) {
    const ok = [];
    const knows = { air: bot.knows.has("air"), dash: g.dashUnlocked && bot.knows.has("dash") };
    for (let a = 0; a <= 72; a += 3) ok.push(simulateFromAir(g, M, kind, a, knows) ? a : null);
    let best = null,
      run = null;
    for (const a of ok) {
      if (a === null) {
        run = null;
        continue;
      }
      if (!run) run = { lo: a, hi: a };
      else run.hi = a;
      if (!best || run.hi - run.lo > best.hi - best.lo) best = { ...run };
    }
    if (!best) continue;
    const at = Math.max(earliest, bot.tick + (best.lo + best.hi) / 2 + noise(bot));
    if (kind === "air") {
      // This press replaces the ground jump's planned release (a release
      // landing after it would cut the air jump short).
      bot.plan = bot.plan.filter((x) => x.type !== "release");
      if (bot.jumpHeld) schedule(bot, at - 2, "release");
      schedule(bot, at, "jump");
      schedule(bot, at + 30 + noise(bot) * 0.5, "release");
    } else schedule(bot, at, "dash");
    bot.airPlanAt = bot.tick;
    return;
  }
}
/** Held keys for an in-air steer: brake = no direction; aim = toward x. */
function steerInput(c, steer) {
  if (steer.mode === "brake") return {};
  const cx = cxOf(c);
  return cx < steer.x - 6 ? { right: true } : cx > steer.x + 6 ? { left: true } : {};
}

/** An air jump or dash `a` ticks from now: does Rubik land alive and further on? */
function simulateFromAir(g, M, kind, a, knows) {
  const c = copy(g, true),
    dir = dirOf(g),
    move = dir > 0 ? { right: true } : { left: true },
    start = progOf(g);
  let hit = false;
  for (let i = 0; i < 260; i++) {
    const input = { ...move };
    if (i === a) {
      if (kind === "air") input.jump = true;
      else input.dash = true;
      hit = true;
    }
    if (hit && i > a + 2 && knows) autoAir(c, M, input, knows);
    M.update(c, TICK, input);
    if (c.phase === "dead") return false;
    if (c.phase === "won") return true;
    if (hit && c.player.grounded && c.hitstop <= 0 && i > a + 2) {
      if (progOf(c) <= start + 16) return false;
      // Calibration (levels round): a jump only counts if he can walk on from
      // where he lands. "16 px further" alone accepted an air jump pressed in
      // the middle of a bounce that landed at a 7-tile wall's FOOT, so the
      // earliest window in the list won and a bounce never topped a wall. A
      // person presses the air jump when he sees the arc will not top the edge.
      return probeWalk(c, M, 40).kind !== "stall";
    }
  }
  return false;
}

const bestRun = (ok) => {
  let best = null,
    run = null;
  for (const v of ok) {
    if (v === null) {
      run = null;
      continue;
    }
    if (!run) run = { lo: v, hi: v };
    else run.hi = v;
    if (!best || run.hi - run.lo > best.hi - best.lo) best = { ...run };
  }
  return best;
};
/** A wall too high for the verbs he owns, with a card nearby: a person goes to
 * the card (turning back if he must), jumps on its back, bounces and air-jumps
 * at the wall. One try of that plan with the card MOVING (he watches it),
 * jumping once within `d` px of it. */
export function trySpring(g, M, bot, id, d, target, wait = 0) {
  const c = copy(g, false),
    knowsAir = bot.knows.has("air");
  for (let i = 0; i < wait; i++) M.update(c, TICK, {});
  let phase = 0,
    st = hops(c),
    airAt = -1,
    off = false;
  for (let i = 0; i < 6 * 120; i++) {
    const card = c.guards.find((k) => k.id === id),
      cx = cxOf(c),
      dir = dirOf(c),
      p = c.player,
      input = {};
    if (phase === 0) {
      if (Math.abs(cx - card.x) <= d && p.grounded && bouncy(card)) {
        input.jump = true;
        phase = 1;
      } else if (cx < card.x) input.right = true;
      else input.left = true;
    } else if (phase === 1) {
      input.left = cx > card.x + 6;
      input.right = cx < card.x - 6;
      if (!p.grounded) off = true;
      if (hops(c) > st) phase = 2;
      else if (off && p.grounded) return false; // landed beside it
    } else {
      if (dir > 0) input.right = true;
      else input.left = true;
      if (knowsAir && p.color === "white" && !p.airJumped && airAt < 0 && p.vy >= -20) {
        input.jumpReleased = true;
        airAt = i + 1;
      } else if (i === airAt) input.jump = true;
    }
    M.update(c, TICK, input);
    if (c.phase === "dead") return false;
    if (c.phase === "won") return true;
    if (phase === 2 && p.grounded && c.hitstop <= 0) return progOf(c) >= target;
  }
  return false;
}
function planSpringboard(g, M, bot, target, onlyId = null, maxWait = 3.5 * 120) {
  const cx = cxOf(g),
    feet = feetOf(g);
  // Discovery (levels round): a first-timer thinks of a card as the way over a
  // wall only if it stands within 5 tiles of where he is stuck (real keys, 1-2:
  // he hopped at a 7-tile wall for a minute with a flat pad 8 tiles behind him);
  // the casual looks about 10 tiles, the expert 14.
  const reach = { first: 5, casual: 10, expert: 14 }[bot.persona.id] * T;
  const cards = g.guards.filter((c) => (!onlyId || c.id === onlyId) && bouncy(c) && Math.abs(c.floor - feet) < 40 && Math.abs(c.x - cx) < reach).sort((a, b) => Math.abs(a.x - cx) - Math.abs(b.x - cx));
  for (const card of cards.slice(0, 2)) {
    // He may first wait (standing still) for the card to turn its back.
    for (let wait = 0; wait <= maxWait; wait += 60) {
      const ok = [];
      for (let d = 20; d <= 200; d += 30) ok.push(trySpring(g, M, bot, card.id, d, target, wait) ? d : null);
      const w = bestRun(ok);
      if (!w) continue;
      bot.approach = { id: card.id, d: Math.max(12, (w.lo + w.hi) / 2 + noise(bot) * 1.4), from: bot.tick + wait + noise(bot), until: bot.tick + wait + 5 * 120 };
      bot.log.springs = (bot.log.springs || 0) + 1;
      return true;
    }
  }
  return false;
}

/** Colour rules (only colours the proxy knows): green by default once owned
 * (the disguise), white for 3+ tile walls and wide gaps, red after the theft
 * (green when a green card that sees red is close and no stone is ahead). */
function wantColor(g, M, bot) {
  const p = g.player,
    dir = dirOf(g),
    cx = cxOf(g),
    feet = feetOf(g),
    has = (c) => g.unlocked[c] && (bot.knows.has(c) || c === g.level.kit.start);
  let wallH = 0;
  for (let i = 1; i <= 4; i++) wallH = Math.max(wallH, wallHeight(g, M, Math.floor((cx + dir * i * T) / T), feet));
  let gap = 0;
  for (let i = 1, seen = false; i < 30; i++) {
    const ch = g.level.map[20][Math.floor(cx / T) + dir * i];
    if (ch === "~") (seen = true), gap++;
    else if (seen || i > 4) break;
  }
  if (g.stolen && has("red")) {
    const stone = g.stones.some((s) => !s.broken && (s.x * T + 16 - cx) * dir > 0 && (s.x * T + 16 - cx) * dir < 240 && Math.abs(s.y * T + 32 - (p.y + 26)) < 130);
    const greenCard = g.guards.some((c) => c.kind === "green" && active(c) && (c.x - cx) * dir > -10 && (c.x - cx) * dir < 240 && Math.abs(c.floor - feet) < 70);
    if (stone) return "red";
    if (greenCard && has("green")) return "green";
    return "red";
  }
  if (has("white") && p.grounded && (wallH >= 3 || gap > 10)) return "white";
  if (!p.grounded && p.color === "white" && !p.airJumped) return "white";
  if (has("green")) {
    const redNear = g.guards.some((c) => c.kind === "red" && active(c) && (c.x - cx) * dir > -40 && (c.x - cx) * dir < 420 && Math.abs(c.floor - feet) < 140);
    if (redNear && has("white") && bot.persona.stealth !== "none") return p.color;
    return "green";
  }
  return p.color;
}

/** Card the casual/expert must not walk into while it looks his way. Returns
 * the card (by the delayed view of its facing) or null. */
function blockingCard(g, M, bot) {
  const p = g.player,
    dir = dirOf(g),
    cx = cxOf(g),
    feet = feetOf(g),
    seen = bot.history[Math.max(0, bot.history.length - 1 - Math.round(bot.react * 120))] || {};
  for (const c of g.guards) {
    if (!active(c)) continue;
    const dx = (c.x - cx) * dir;
    if (dx < 40 || dx > M.CONE.length + M.CONE.offset + 140) continue;
    if (Math.abs(c.floor - feet) > 200) continue;
    if (!M.canSee(c, p.color) && !c.locked) continue;
    const facing = seen[c.id] ?? c.dir;
    if (facing === -dir) return c;
  }
  return null;
}

/** One tick of the proxy: returns the keys it wants held / pressed. */
export function decide(g, M, bot) {
  bot.tick++;
  const p = g.player,
    want = { left: false, right: false, jump: bot.jumpHeld, dash: false, color: null };
  // Delayed perception of card facings.
  const facing = {};
  for (const c of g.guards) facing[c.id] = c.dir;
  bot.history.push(facing);
  if (bot.history.length > 120) bot.history.shift();
  for (const ev of g.events) {
    if (ev.id <= bot.lastEvent) continue;
    bot.lastEvent = ev.id;
    if (ev.type === "get") bot.knows.add(ev.ability || ev.color || "dash");
    if (ev.type === "get" && ev.ability === "dash") bot.knows.add("dash");
    if (ev.type === "theft") bot.knows.add("red");
    // A hint bubble teaches the casual and the expert; the first-timer
    // doesn't read it.
    if (ev.type === "hint" && bot.persona.readsGlyphs) bot.knows.add({ airjump: "air", dash: "dash", white: "white", green: "green" }[ev.hint || ev.id2] || "?");
    // Landing on a card: the casual and the expert press jump for the high
    // bounce; the first-timer does when he happens to be holding jump (60%).
    // (A key still held from the takeoff already gives the high bounce:
    // releasing it now would cut the bounce, so he keeps holding.)
    if (ev.type === "stomp" || ev.type === "bounce") {
      bot.bounced = true;
      bot.hopAt = bot.tick;
      bot.mashRoll = undefined;
    }
    if ((ev.type === "stomp" || ev.type === "bounce") && (bot.persona.id !== "first" || bot.r() < 0.6)) {
      bot.plan = bot.plan.filter((x) => x.type !== "release");
      if (!bot.jumpHeld) schedule(bot, bot.tick, "jump");
      schedule(bot, bot.tick + 50, "release");
    }
    if (ev.type === "die") {
      const bin = Math.floor((g.deathAt?.x ?? ev.x) / T / 4);
      bot.deathsAt[bin] = (bot.deathsAt[bin] || 0) + 1;
    }
    if (ev.type === "respawn") {
      bot.plan = [];
      bot.busyUntil = bot.tick + bot.react * 120;
      bot.airPlanned = false;
    }
  }
  if (g.unlocked.green && g.gets?.includes("green")) bot.knows.add("green");
  if (g.gets?.includes("dash")) bot.knows.add("dash");
  if (g.gets?.includes("red")) bot.knows.add("red");
  if (p.jumps === 2) bot.knows.add("air"); // an air jump happened: now it's known
  const dir = dirOf(g),
    forward = dir > 0 ? { right: true } : { left: true };
  if (g.phase === "dead") {
    if (bot.persona.holdsForward) Object.assign(want, forward);
    want.jump = false;
    bot.jumpHeld = false;
    bot.plan = [];
    return want;
  }
  if (g.phase !== "playing") return want;
  const prog = progOf(g);
  // The theft flips the travel direction (1-6): progress toward the NEW end
  // starts from here, or the stuck logic would walk him back at the vault.
  if (bot.lastDir !== undefined && bot.lastDir !== dir) {
    bot.best = prog;
    bot.bestAt = bot.tick;
    bot.stuckTries = 0;
  }
  bot.lastDir = dir;
  if (prog > bot.best + 8) {
    bot.best = prog;
    bot.bestAt = bot.tick;
    bot.stuckTries = 0;
  }
  // Default: hold the travel direction.
  let moveDir = dir;
  // The casual / expert stop for a card looking their way.
  let waiting = false;
  if (bot.persona.stealth !== "none" && p.grounded) {
    const c = blockingCard(g, M, bot);
    // A card that has noticed him and walks at him is a fight, not a wait
    // (levels round: the casual used to stand still in front of a chasing
    // walker and take its spear three times). He picks a jump that lands on
    // its head, the way the first-timer's habit of jumping at things does by
    // accident; a card that holds its post is still waited out.
    if (c && !bot.approach && bot.tick >= (bot.fightNext ?? 0) && ["suspect", "alert"].includes(c.state) && c.type !== "sentinel" && Math.abs(c.floor - feetOf(g)) < 40 && Math.abs(c.x - cxOf(g)) < 260) {
      bot.fightNext = bot.tick + 45;
      if (planSpringboard(g, M, bot, dir * c.x + 60, c.id, 0)) bot.log.fights = (bot.log.fights ?? 0) + 1;
    }
    if (c && !bot.approach) {
      if (bot.persona.stealth === "anticipate" && bot.tick % 12 !== 0) waiting = bot.lastWaiting ?? true;
      else if (bot.persona.stealth === "anticipate") {
        // The expert steps a copy with the cards moving: go now if that run
        // reaches past the card without a "!" in the next 2.5 s.
        const target = dir * c.x + 80,
          spotted = g.spotted;
        const go = simulate(g, M, {}, { frozen: false, horizon: 300, done: reaches(target, (x) => x.spotted === spotted) });
        waiting = !go.ok && !simulateJumpGo(g, M, target, spotted);
      } else waiting = true;
    }
  }
  bot.lastWaiting = waiting;
  if (waiting) {
    if (bot.waitStart === null) (bot.waitStart = bot.tick), bot.log.waits++;
    moveDir = 0;
    // Nobody waits forever: after 6 s, go anyway.
    if (bot.tick - bot.waitStart > 6 * 120) moveDir = dir;
  } else bot.waitStart = null;
  // Stuck: back up for a run-up, try the other verbs.
  if (bot.tick - bot.bestAt > 6 * 120 && bot.backUntil < bot.tick && p.grounded && bot.stuckTries < 6) {
    bot.stuckTries++;
    bot.backUntil = bot.tick + 0.5 * 120;
    bot.plan = [];
  }
  if (bot.backUntil > bot.tick) moveDir = -dir;
  if (bot.approach) {
    const card = g.guards.find((k) => k.id === bot.approach.id);
    if (!card || !bouncy(card) || bot.tick > bot.approach.until) bot.approach = null;
    else if (bot.tick < bot.approach.from) moveDir = 0;
    else if (p.grounded && Math.abs(cxOf(g) - card.x) <= bot.approach.d) {
      schedule(bot, bot.tick, "jump");
      schedule(bot, bot.tick + 240, "release");
      bot.spring = { id: card.id, phase: 1, st: hops(g), at: bot.tick };
      bot.airPlanned = true;
      bot.approach = null;
    } else moveDir = cxOf(g) < card.x ? 1 : -1;
  }
  if (bot.spring && (!p.grounded || bot.tick - bot.spring.at < 3)) {
    const card = g.guards.find((k) => k.id === bot.spring.id);
    if (bot.spring.phase === 1 && hops(g) > bot.spring.st) bot.spring.phase = 2;
    if (bot.spring.phase === 1 && card) moveDir = cxOf(g) < card.x - 6 ? 1 : cxOf(g) > card.x + 6 ? -1 : 0;
    else moveDir = dir;
  }
  if (p.grounded && bot.spring && bot.tick - bot.spring.at > 20) bot.spring = null;
  if (p.grounded) bot.steer = null;
  if (bot.steer && !p.grounded && bot.tick >= bot.steer.from) {
    const s2 = steerInput(g, bot.steer);
    moveDir = s2.right ? 1 : s2.left ? -1 : 0;
  }
  if (moveDir > 0) want.right = true;
  if (moveDir < 0) want.left = true;
  // Colour.
  const color = wantColor(g, M, bot);
  if (color !== p.color && g.colorCooldown <= 0 && g.unlocked[color] && bot.tick % 4 === 0) want.color = color;
  // Ground planning (not while waiting or reacting).
  const grounded = p.grounded;
  if (grounded && !bot.wasGrounded) bot.airPlanned = false;
  if (!grounded && bot.wasGrounded) {
    bot.takeoffAt = bot.tick;
    bot.mashRoll = undefined;
  }
  bot.wasGrounded = grounded;
  const pendingJump = bot.plan.some((x) => x.type === "jump" || x.type === "dash");
  if (grounded && !pendingJump && !bot.approach && moveDir === dir && bot.tick >= bot.busyUntil && bot.tick - bot.lastPlanAt >= (bot.failedPlan ? 30 : 6)) {
    bot.lastPlanAt = bot.tick;
    const outcome = probeWalk(g, M);
    if (outcome.kind !== "safe" && outcome.kind !== "won") {
      let planned = planGround(g, M, bot, outcome);
      // Stuck at a wall: use a card as a springboard (the first-timer only
      // after two failed tries at the same wall).
      if (!planned && outcome.kind === "stall" && !bot.approach && bot.tick >= (bot.springNext || 0)) {
        const bin = Math.floor(cxOf(g) / T / 4);
        // The first-timer must also have bounced on a card at least once.
        if (bot.persona.id !== "first" || ((bot.triesAt[bin] || 0) >= 2 && bot.bounced)) {
          planned = planSpringboard(g, M, bot, dir * outcome.x + 40);
          bot.springNext = bot.tick + 90;
        }
      }
      bot.failedPlan = !planned;
      if (!planned && (outcome.kind === "stall" || outcome.kind === "bump") && outcome.at < 10 && bot.tick >= bot.mashNext) {
        // Nothing known works: the first-timer mashes jump at the wall; the
        // others try a full jump now and then (which is what 1-1's
        // "jump, jump" bubble waits for).
        schedule(bot, bot.tick, "jump");
        if (bot.persona.mash) {
          // A mash is a burst: press, and press again about a reaction time later.
          const again = bot.tick + bot.react * 120 + noise(bot) * 0.5;
          schedule(bot, Math.min(again - 4, bot.tick + 12), "release");
          schedule(bot, again, "jump");
          schedule(bot, again + 14, "release");
          bot.mashNext = again + 30;
        } else {
          schedule(bot, bot.tick + 36, "release");
          bot.mashNext = bot.tick + 70;
        }
      }
    }
  }
  // Air planning: every 50 ms while airborne and nothing queued.
  if (!grounded && !bot.plan.some((x) => x.type === "jump" || x.type === "dash") && bot.tick - bot.airPlanAt >= 6) {
    bot.airPlanAt = bot.tick;
    planAir(g, M, bot);
  }
  // The first-timer mashes in the air against a wall too, once he sees he
  // is stuck on it (reaction time after the takeoff) and nothing is planned.
  const planned = bot.airPlanned || bot.plan.some((x) => x.type === "jump");
  // Calibration (levels round): the mash press came a FIXED reaction time after
  // the takeoff, so a bounce at a wall always got its air jump at the same
  // early moment and never topped it. A person mashing presses at scattered
  // moments: each airtime draws its own delay (0.1-0.55 s after the takeoff or
  // the bounce), so the apex is hit now and then.
  if (!grounded && bot.persona.mash && bot.mashRoll === undefined) bot.mashRoll = 0.1 + bot.r() * 0.45;
  if (!grounded && bot.persona.mash && !planned && bot.tick >= bot.mashNext && bot.tick - Math.max(bot.takeoffAt, bot.hopAt ?? -1e9) > (bot.mashRoll ?? 0.3) * 120 && p.vx === 0 && !p.airJumped && p.color === "white") {
    const front = Math.floor((cxOf(g) + dir * (p.w / 2 + 4)) / T);
    if (wallHeight(g, M, front, feetOf(g)) > 0) {
      schedule(bot, bot.tick, "release");
      schedule(bot, bot.tick + 2, "jump");
      schedule(bot, bot.tick + 14, "release");
      bot.mashNext = bot.tick + 24;
    }
  }
  // Execute what is due.
  while (bot.plan.length && bot.plan[0].at <= bot.tick) {
    const a = bot.plan.shift();
    if (a.type === "jump") want.jump = true;
    if (a.type === "release") want.jump = false;
    if (a.type === "dash") want.dash = true;
  }
  bot.jumpHeld = want.jump;
  return want;
}
/** Expert: would a jump now carry past the card unseen? */
function simulateJumpGo(g, M, target, spotted) {
  for (const family of [{ hold: 36, k: 0 }, { hold: 30, air: "apex", k: 0 }]) {
    const res = simulate(g, M, family, { frozen: false, horizon: 300, done: reaches(target, (x) => x.spotted === spotted) });
    if (res.ok) return true;
  }
  return false;
}

/** Turn held-key wishes into model inputs (edges become pulses). */
export function toInput(want, prev) {
  const input = { left: !!want.left, right: !!want.right };
  if (want.jump && !prev.jump) input.jump = true;
  if (!want.jump && prev.jump) input.jumpReleased = true;
  if (want.dash) input.dash = true;
  if (want.color) input.color = want.color;
  return input;
}

/** One proxy run on the model. Returns deaths, time, where each death was. */
export function runModel(M, levelId, personaId, seed, { maxTime = 300, maxDeaths = 30, campaign = true } = {}) {
  const g = M.startGame(M.createGame(levelId));
  const bot = makeProxy(personaId, seed, levelId, { campaign });
  let prev = { jump: false },
    lastEvent = 0;
  const deaths = [];
  while (g.phase !== "won" && g.time < maxTime && g.deaths < maxDeaths && bot.tick - bot.bestAt < 60 * 120) {
    const want = decide(g, M, bot);
    M.update(g, TICK, toInput(want, prev));
    prev = { jump: want.jump };
    for (const ev of g.events) {
      if (ev.id <= lastEvent) continue;
      lastEvent = ev.id;
      if (ev.type === "die") deaths.push({ col: Math.floor((g.deathAt?.x ?? ev.x) / T + 0.6), reason: ev.reason, t: +g.time.toFixed(1), cp: g.checkpoint });
    }
  }
  return {
    level: levelId,
    persona: personaId,
    seed,
    won: g.phase === "won",
    time: +g.time.toFixed(1),
    deaths: g.deaths, // real deaths (a checkpoint restore); before hearts every fall counted here
    hits: g.hits ?? 0, // hearts lost to cards
    falls: g.falls ?? 0, // hearts lost to water
    chainBest: g.chainBest ?? 0,
    spotted: g.spotted,
    stickers: M.stickerCount(g),
    deathList: deaths,
    maxCol: Math.floor(bot.best / T),
    log: bot.log,
  };
}

/** Summary over runs: median/p90 deaths and time, clear rate, death heat map
 * (4-column bins), quit-risk spots (bins where one run died 3+ times). */
export function summarize(runs) {
  const sorted = (xs) => [...xs].sort((a, b) => a - b),
    q = (xs, f) => (xs.length ? sorted(xs)[Math.min(xs.length - 1, Math.floor(f * xs.length))] : null);
  const heat = {},
    quit = {};
  for (const run of runs) {
    const here = {};
    for (const d of run.deathList) {
      const bin = Math.floor(d.col / 4) * 4;
      heat[bin] = (heat[bin] || 0) + 1;
      here[bin] = (here[bin] || 0) + 1;
    }
    for (const [bin, n] of Object.entries(here)) if (n >= 3) quit[bin] = (quit[bin] || 0) + 1;
    if (!run.won) quit[`stuck@${Math.floor(run.maxCol / 4) * 4}`] = (quit[`stuck@${Math.floor(run.maxCol / 4) * 4}`] || 0) + 1;
  }
  return {
    runs: runs.length,
    cleared: runs.filter((r) => r.won).length,
    deathsMedian: q(runs.map((r) => r.deaths), 0.5),
    deathsP90: q(runs.map((r) => r.deaths), 0.9),
    // Hearts lost per run (cards + water), the damage the combat model adds.
    damageMedian: q(runs.map((r) => (r.hits ?? 0) + (r.falls ?? 0)), 0.5),
    damageP90: q(runs.map((r) => (r.hits ?? 0) + (r.falls ?? 0)), 0.9),
    hitsMedian: q(runs.map((r) => r.hits ?? 0), 0.5),
    chainMax: Math.max(0, ...runs.map((r) => r.chainBest ?? 0)),
    timeMedian: q(runs.filter((r) => r.won).map((r) => r.time), 0.5),
    timeP90: q(runs.filter((r) => r.won).map((r) => r.time), 0.9),
    heat: Object.fromEntries(Object.entries(heat).sort((a, b) => b[1] - a[1])),
    quitRisk: quit,
  };
}
