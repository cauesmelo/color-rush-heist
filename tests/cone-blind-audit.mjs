/** Cone-blind audit: does each card stop a player who ignores its cone?
 *   node tests/cone-blind-audit.mjs            # full sweep, 31 arrival times (~40 s)
 *   LEVELS=1-3,1-4 node tests/cone-blind-audit.mjs
 * tests/cone-blind.test.mjs runs the same sweep on a coarser grid as part of
 * npm test and enforces the rule below.
 *
 * Each level's baseline is replayed to every checkpoint (and, in 1-6, to just
 * after the theft); then the cone-blind bot (tests/cone-blind-bot.mjs) takes
 * over after a start delay (31 arrival times, 0..3 s). Per card ahead:
 *   passed  the bot's centre got 30 px beyond it (the critic's original count);
 *   free    passed with no stomp/knock and no "?"/"!"/bump/spear;
 *   clean   STANDING 3 tiles beyond its patrol bound (flying over it into the
 *           water, or reaching the foot of the wall it guards, is not passing),
 *           without stomping or knocking it, and with no death or catch since
 *           the bot first came within 400 px of it: the card did nothing to a
 *           player who walked at it on that life.
 * A card is "passed" / "clean" for a level when that holds in at least half
 * the arrival times, taking each card from the first segment that meets it.
 *
 * The rule (enforced by the test): every gate or watch card on the main line
 * is clean in fewer than half the arrival times. Exempt, by job: teach (an
 * idea's first card, met in the open on purpose), disguise (1-3/1-4: walking
 * through it is the lesson), swap (the line swaps to its colour: passing it
 * disguised is the point), refill (a springboard over water: the gap is the
 * obstacle, the card is the way across) and knock (escape cards a red dash
 * clears). Exempt by place: `offLine` cards that guard an optional sticker
 * route the bot never takes (1-3 roof). */
import { pathToFileURL } from "node:url";
import * as M from "../model.mjs";
import { ROUTES } from "./routes.mjs";
import { makeBot, decide } from "./cone-blind-bot.mjs";

const DT = 1 / 60;
export const ENFORCED_JOBS = ["gate", "watch"];
export const isEnforced = (card) => ENFORCED_JOBS.includes(card.job) && !card.offLine;

function replayTo(id, route, stop) {
  const g = M.startGame(M.createGame(id));
  let tick = 0;
  for (const [s, input] of route) {
    const n = Math.max(1, Math.round(s * 120));
    for (let i = 0; i < n; i++) {
      M.update(g, M.TICK, i === 0 ? input : { left: input.left, right: input.right });
      if (stop(g, ++tick)) return g;
    }
  }
  return null;
}

/** A copy of a game in progress (the frozen level is shared, not cloned). */
function cloneGame(g) {
  const copy = structuredClone(g);
  Object.defineProperty(copy, "level", { value: g.level, enumerable: false });
  return copy;
}
const startCache = new Map();
/** One bot run from the checkpoint reached by `stop`, after `delay` s idle.
 * `focus`: a card id whose outcome is all that matters; the run ends as soon
 * as it is decided (passed, or a death after the bot came near it). */
export function runFrom(id, stop, delay, label, mode = "smart", focus = null) {
  const key = `${id}|${label}`;
  if (!startCache.has(key)) startCache.set(key, replayTo(id, ROUTES[id].baseline, stop));
  const start = startCache.get(key);
  if (!start) return null;
  const g = cloneGame(start);
  const p0 = g.player, cx0 = p0.x + p0.w / 2, dir = g.stolen ? -1 : 1;
  const cards = {};
  for (const gd of g.guards) {
    const ahead = (gd.x - cx0) * dir > 0 && gd.state !== "drained" && (!gd.escapeOnly || g.stolen);
    if (ahead) cards[gd.id] = { id: gd.id, job: gd.job, offLine: !!gd.offLine, passed: null, clean: false, zoneDeaths: null, stomp: 0, bounce: 0, drain: 0, knock: 0, suspect: 0, spotted: 0, bump: 0, spike: 0, killed: 0, caught: 0 };
  }
  let lastEv = g.eventId, prevJump = false, t = 0;
  const deaths = [], bot = makeBot(mode, {}), deaths0 = g.deaths;
  while (t < delay) { M.advance(g, DT, {}); t += DT; }
  while (t < 60 && g.phase !== "won" && !bot.stuck && g.deaths - deaths0 < 5) {
    if (focus && cards[focus] && (cards[focus].done || (cards[focus].zoneDeaths !== null && g.deaths > cards[focus].zoneDeaths))) break;
    const w = decide(g, M, bot, DT);
    M.advance(g, DT, { left: w.left, right: w.right, jump: w.jump && !prevJump, jumpReleased: !w.jump && prevJump, dash: w.dash, color: w.color || undefined });
    prevJump = w.jump;
    t += DT;
    const p = g.player, cx = p.x + p.w / 2;
    for (const ev of g.events) {
      if (ev.id <= lastEv) continue;
      lastEv = ev.id;
      const c = ev.guard && cards[ev.guard];
      if (c && c[ev.type] !== undefined) c[ev.type]++;
      if (ev.type === "die") {
        let near = null, best = 1e9;
        for (const gd of g.guards) if (["lunge", "windup", "recover", "alert"].includes(gd.state) && Math.abs(gd.x - cx) < best) { best = Math.abs(gd.x - cx); near = gd.id; }
        if (near && cards[near] && ev.reason === "spear") cards[near].killed++;
        if (near && cards[near] && ev.reason === "caught") cards[near].caught++;
        deaths.push(`${ev.reason}@${Math.floor(cx / 32)}${near && ev.reason !== "water" ? "(" + near + ")" : ""}`);
      }
    }
    if (g.phase !== "playing") continue;
    for (const gd of g.guards) {
      const c = cards[gd.id];
      if (!c) continue;
      const ahead = (cx - gd.x) * dir;
      if (c.zoneDeaths === null && ahead > -400) c.zoneDeaths = g.deaths;
      if (c.passed == null && ahead > 30) c.passed = +t.toFixed(2);
      // Clean means past the whole patrol plus 3 tiles, standing: between a
      // card and the wall it guards is not past it (1-2's wall card).
      const beyond = (cx - (dir > 0 ? gd.max : gd.min)) * dir;
      if (!c.done && beyond > 96 && p.grounded) {
        c.done = true;
        c.clean = c.stomp + c.bounce + c.drain + c.knock === 0 && g.deaths === c.zoneDeaths;
      }
    }
  }
  // Reaching the goal (or home) passes every card still ahead.
  if (g.phase === "won") for (const c of Object.values(cards)) if (!c.done) c.clean = c.stomp + c.bounce + c.drain + c.knock === 0 && g.deaths === (c.zoneDeaths ?? g.deaths);
  const rows = Object.values(cards).map((c) => ({ ...c, free: c.passed != null && c.stomp + c.bounce + c.drain + c.knock === 0 && c.suspect + c.spotted + c.bump + c.spike + c.killed + c.caught === 0, engaged: c.stomp + c.bounce + c.drain + c.knock > 0 }));
  return { label, delay, won: g.phase === "won", stuck: bot.stuck, endCol: Math.floor((g.player.x + 20) / 32), deaths, rows, smashes: g.smashes, knocks: g.knockouts };
}

/** The bot from every checkpoint of one level at `delays` arrival times. */
export function auditLevel(id, delays) {
  const lv = M.createGame(id).level;
  const starts = lv.checkpoints.map((cp, k) => ({ label: `cp:${cp.id}`, stop: (g) => g.checkpointIndex === k && g.phase === "playing" && g.player.grounded && !g.stolen && g.hitstop <= 0 }));
  if (id === "1-6") starts.push({ label: "after-theft", stop: (g) => g.stolen && g.hitstop <= 0 && g.phase === "playing" });
  const segments = [];
  for (const st of starts) {
    if (st.label.startsWith("cp:vault")) continue;
    const runs = delays.map((d) => runFrom(id, st.stop, d, st.label)).filter(Boolean);
    if (runs.length) segments.push({ label: st.label, runs });
  }
  // Per part (1-6 splits inbound / escape), each card from the first segment that meets it.
  const parts = {};
  for (const seg of segments) {
    const part = id === "1-6" ? (seg.label === "after-theft" ? "1-6 escape" : "1-6 inbound") : id;
    parts[part] ??= {};
    for (const row of seg.runs[0].rows) {
      if (parts[part][row.id]) continue;
      const rs = seg.runs.map((r) => r.rows.find((x) => x.id === row.id)), n = rs.length;
      const count = (f) => rs.filter(f).length;
      parts[part][row.id] = { id: row.id, job: row.job, offLine: row.offLine, n, segment: seg.label, passed: count((x) => x.passed != null), free: count((x) => x.free), clean: count((x) => x.clean) };
    }
  }
  return { id, segments, parts };
}

export const DELAYS_FULL = Array.from({ length: 31 }, (_, k) => +(k * 0.1).toFixed(1));
/** Probe arrival times: 31 over 6 s, a whole turn/patrol cycle of every
 * enforced card (the 0..3 s grid above can sample only its kind half). */
export const DELAYS_PROBE = Array.from({ length: 31 }, (_, k) => +(k * 0.2).toFixed(1));

/** Per-card probe (the rule's measurement): replay the baseline until Rubik
 * stands 420 px before the card (inbound; after the theft, 420 px past it on
 * the way home), then the bot at each arrival time. Earlier cards can't stop
 * the bot first, so each card answers for its own teeth. */
export function probeCard(id, cardId, delays = DELAYS_PROBE) {
  const spec = M.createGame(id).level.guards.find((c) => c.id === cardId),
    home = !!spec.escapeOnly || !!spec.probeEscape;
  // Where the baseline last stands before the card (within 420 px if it
  // stands there at all, else its last footing before it: 1-2's island
  // chain is crossed without touching the ground).
  const before = (g) => {
    if (g.phase !== "playing" || !g.player.grounded || g.hitstop > 0 || g.calm > 0 || g.stolen !== home) return 0;
    const cx = g.player.x + g.player.w / 2, gap = home ? cx - spec.x : spec.x - cx;
    return gap <= 30 ? 0 : gap <= 420 ? 2 : 1;
  };
  let near = 0, far = 0;
  replayTo(id, ROUTES[id].baseline, (g, tick) => {
    const b = before(g);
    if (b === 2 && !near) near = tick;
    if (b === 1 && !near) far = tick;
    return !!near;
  });
  const at = near || far, stop = (g, tick) => tick === at;
  const rs = delays.map((d) => runFrom(id, stop, d, `probe:${cardId}`, "smart", cardId)).filter(Boolean).map((r) => r.rows.find((x) => x.id === cardId)).filter(Boolean);
  const count = (f) => rs.filter(f).length;
  return { id: cardId, job: spec.job, offLine: !!spec.offLine, n: rs.length, clean: count((x) => x.clean), passed: count((x) => x.passed != null), caught: rs.reduce((a, x) => a + x.caught, 0), killed: rs.reduce((a, x) => a + x.killed, 0) };
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const only = process.env.LEVELS ? process.env.LEVELS.split(",") : Object.keys(ROUTES);
  const summary = [];
  for (const id of only) {
    const { segments, parts } = auditLevel(id, DELAYS_FULL);
    for (const { label, runs } of segments) {
      const wins = runs.filter((r) => r.won).length, deathSet = {};
      for (const r of runs) for (const d of r.deaths) deathSet[d] = (deathSet[d] || 0) + 1;
      console.log(`\n${id} ${label}: wins ${wins}/${runs.length}; endCol d0=${runs[0].endCol} stuck=${runs[0].stuck}; deaths(all runs)=${JSON.stringify(deathSet)}`);
      for (const row of runs[0].rows) {
        const rs = runs.map((r) => r.rows.find((x) => x.id === row.id)), c = (f) => rs.filter(f).length;
        console.log(`  ${row.id.padEnd(12)} ${String(row.job).padEnd(8)} passed ${c((x) => x.passed != null)}/${rs.length}  FREE ${c((x) => x.free)}  clean ${c((x) => x.clean)}  engaged ${c((x) => x.engaged)}  noticed ${c((x) => x.suspect + x.spotted + x.bump + x.spike > 0)}  spear-kills ${rs.reduce((a, x) => a + x.killed, 0)}  catches ${rs.reduce((a, x) => a + x.caught, 0)}`);
      }
    }
    summary.push(...Object.entries(parts));
  }
  console.log("\nSummary (per level; a card counts when it holds in >= half of 31 arrival times):");
  for (const [part, cards] of summary) {
    const list = Object.values(cards);
    if (!list.length) continue;
    const half = (k) => list.filter((c) => c[k] * 2 > c.n);
    const bad = list.filter((c) => isEnforced(c) && c.clean * 2 >= c.n);
    console.log(`  ${part.padEnd(12)} passed ${half("passed").length}/${list.length}, free ${half("free").length}, clean ${half("clean").length}: ${list.map((c) => `${c.id} ${c.clean}/${c.n}${isEnforced(c) ? "" : "*"}`).join(", ")}${bad.length ? `  RULE BROKEN: ${bad.map((c) => c.id).join(", ")}` : ""}`);
  }
  console.log("  (* = exempt from the rule: teach/disguise/swap/refill/knock jobs, or off the main line)");
  console.log("\nRule (per-card probes, 31 arrival times over 6 s; clean passes must be < half):");
  for (const id of only)
    for (const card of M.createGame(id).level.guards.filter(isEnforced)) {
      const r = probeCard(id, card.id);
      console.log(`  ${id} ${card.id.padEnd(12)} ${card.job.padEnd(6)} clean ${String(r.clean).padStart(2)}/${r.n}  ${r.clean * 2 < r.n && r.n ? "ok" : "BROKEN"}`);
    }
}
