/** Cone-blind audit (dev tool, ~40 s; not part of npm test):
 *   node tests/cone-blind-audit.mjs
 * Replays each level's baseline route to every checkpoint (and, in 1-6, to
 * just after the theft), then hands control to the cone-blind bot
 * (tests/cone-blind-bot.mjs) at 31 arrival times (start delays 0..3 s). Per
 * card ahead: "passed" = the bot got 30 px beyond it; "free" = passed with no
 * stomp/knock and no "?"/"!"/bump/spear. The summary counts, per level, the
 * cards passed (or passed free) in at least half the arrival times, taking
 * each card from the first segment that meets it. Revision five results are
 * in MOVEMENT_AUDIT.md and LEVEL_DESIGN.md. */
import * as M from "../model.mjs";
import { ROUTES } from "./routes.mjs";
import { makeBot, decide } from "./cone-blind-bot.mjs";
const DT = 1 / 60, MODE = process.env.MODE || "smart";
function replayTo(id, route, stop) {
  const g = M.startGame(M.createGame(id));
  for (const [s, input] of route) {
    const n = Math.max(1, Math.round(s * 120));
    for (let i = 0; i < n; i++) {
      M.update(g, M.TICK, i === 0 ? input : { left: input.left, right: input.right });
      if (stop(g)) return g;
    }
  }
  return null;
}
function runFrom(id, stop, delay, label) {
  const g = replayTo(id, ROUTES[id].baseline, stop);
  if (!g) return null;
  const p0 = g.player, cx0 = p0.x + p0.w / 2, dir = g.stolen ? -1 : 1;
  const cards = {};
  for (const gd of g.guards) {
    const ahead = (gd.x - cx0) * dir > 0 && gd.state !== "drained" && (!gd.escapeOnly || g.stolen);
    if (ahead) cards[gd.id] = { id: gd.id, job: gd.job, passed: null, stomp: 0, bounce: 0, knock: 0, suspect: 0, spotted: 0, bump: 0, spike: 0, killed: 0, seen: 0, hum: 0 };
  }
  let lastEv = g.eventId, prevJump = false, t = 0, deaths = [];
  const bot = makeBot(MODE, {});
  const deaths0 = g.deaths;
  while (t < delay) { M.advance(g, DT, {}); t += DT; }
  while (t < 60 && g.phase !== "won" && !bot.stuck && g.deaths - deaths0 < 5) {
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
        for (const gd of g.guards) if (["lunge", "windup", "recover"].includes(gd.state) && Math.abs(gd.x - cx) < best) { best = Math.abs(gd.x - cx); near = gd.id; }
        if (near && cards[near] && ev.reason === "spear") cards[near].killed++;
        deaths.push(`${ev.reason}@${Math.floor(cx / 32)}${near && ev.reason === "spear" ? "(" + near + ")" : ""}`);
      }
    }
    for (const gd of g.guards) {
      const c = cards[gd.id];
      if (!c) continue;
      if (gd.sees) c.seen += DT;
      if (gd.disguiseSeen) c.hum += DT;
      if (c.passed == null && (cx - gd.x) * dir > 30) c.passed = +t.toFixed(2);
    }
  }
  const rows = Object.values(cards).map((c) => ({ ...c, free: c.passed != null && c.stomp + c.bounce + c.knock === 0 && c.suspect + c.spotted + c.bump + c.spike + c.killed === 0, engaged: c.stomp + c.bounce + c.knock > 0 }));
  return { label, delay, won: g.phase === "won", stuck: bot.stuck, endCol: Math.floor((g.player.x + 20) / 32), deaths, rows, smashes: g.smashes, knocks: g.knockouts };
}
const out = {};
for (const id of Object.keys(ROUTES)) {
  const lv = M.createGame(id).level;
  const starts = lv.checkpoints.map((cp, k) => ({ label: `cp:${cp.id}`, stop: (g) => g.checkpointIndex === k && g.phase === "playing" && g.player.grounded && !g.stolen && g.hitstop <= 0 }));
  if (id === "1-6") starts.push({ label: "after-theft", stop: (g) => g.stolen && g.hitstop <= 0 && g.phase === "playing" });
  for (const st of starts) {
    if (st.label.startsWith("cp:vault")) continue;
    const runs = [];
    for (let k = 0; k <= 30; k++) { const r = runFrom(id, st.stop, k * 0.1, st.label); if (r) runs.push(r); }
    if (!runs.length) { console.log(`${id} ${st.label}: route never reaches`); continue; }
    out[`${id} ${st.label}`] = runs;
    const ids = runs[0].rows.map((r) => r.id);
    const wins = runs.filter((r) => r.won).length;
    const deathSet = {};
    for (const r of runs) for (const d of r.deaths) deathSet[d] = (deathSet[d] || 0) + 1;
    console.log(`\n${id} ${st.label}: wins ${wins}/${runs.length}; endCol d0=${runs[0].endCol} stuck=${runs[0].stuck}; deaths(all runs)=${JSON.stringify(deathSet)}; smashes/knocks d0=${runs[0].smashes}/${runs[0].knocks}`);
    for (const cid of ids) {
      const rs = runs.map((r) => r.rows.find((x) => x.id === cid));
      const free = rs.filter((x) => x.free).length, passed = rs.filter((x) => x.passed != null).length, engaged = rs.filter((x) => x.engaged).length, noticed = rs.filter((x) => x.suspect + x.spotted + x.bump + x.spike > 0).length, killed = rs.reduce((a, x) => a + x.killed, 0);
      console.log(`  ${cid.padEnd(12)} ${String(rs[0].job).padEnd(8)} passed ${passed}/31  FREE ${free}/31  engaged ${engaged}  noticed ${noticed}  spear-kills ${killed}`);
    }
  }
}
// Summary: per level, cards passed / free in >= half the arrival times.
const parts = {};
for (const [key, runs] of Object.entries(out)) {
  const [lv, seg] = key.split(" "),
    part = lv === "1-6" ? (seg === "after-theft" ? "1-6 escape" : "1-6 inbound") : lv;
  parts[part] ??= {};
  for (const row of runs[0].rows) {
    if (parts[part][row.id]) continue;
    const rs = runs.map((r) => r.rows.find((x) => x.id === row.id));
    parts[part][row.id] = { passed: rs.filter((x) => x.passed != null).length * 2 > rs.length, free: rs.filter((x) => x.free).length * 2 > rs.length };
  }
}
console.log("\nSummary (cards the cone-blind bot gets past in >= half of 31 arrival times):");
for (const [part, cards] of Object.entries(parts)) {
  const list = Object.entries(cards);
  if (!list.length) continue;
  console.log(`  ${part.padEnd(12)} passed ${list.filter(([, c]) => c.passed).length}/${list.length}, free ${list.filter(([, c]) => c.free).length}: ${list.filter(([, c]) => c.passed).map(([id]) => id).join(", ") || "-"}`);
}
