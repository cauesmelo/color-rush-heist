/** Chrome driver for the human proxies (dev tool, not part of `npm test`).
 *
 * tests/human-proxy.mjs plays the MODEL (fast sweeps). This file plays the real
 * GAME in real Chrome: the same decide() brain runs inside the page on every
 * animation frame, and its wishes become REAL key events (Playwright's trusted
 * CDP keyboard: keydown/keyup through Input.dispatchKeyEvent). Nothing is
 * dispatched in-page and `__game.step` is never used: the game's own input
 * code (game.mjs KEY table, loop.mjs 1/120 s tick stamping, pause, respawn
 * hold) sits between the brain and the model, which is the point: bugs such as
 * "a direction held through a death freezes Rubik after the respawn" only show
 * with a physical key held down.
 *
 *   # the caller serves the repo (this tool starts nothing):
 *   python3 -m http.server 4481 --bind 127.0.0.1 &      # from the repo root
 *   node tests/human-proxy-chrome.mjs <levels|all> [persona|all]
 *        [--seed N] [--runs K] [--cap S] [--out DIR] [--port 4481] [--url URL]
 *        [--stuck S] [--max-deaths N] [--max-shots N]
 *        [--no-sanity] [--no-model] [--qa-start] [--headed] [--fresh] [--require-clear]
 *        [--no-hold] [--no-autorepeat] [--trace [--trace-every FRAMES]]
 *
 *   levels   "1-1,1-3" or "all" (every id in levels/index.mjs)
 *   persona  first | casual | expert | all (default first)
 *   --seed   proxy seed (default 1); --runs K runs seeds N..N+K-1
 *   --cap    game seconds per level (default 180)
 *   --stuck  end a run after this many game seconds without progress (default 60;
 *            progress is tracked here per travel direction, so 1-6's return trip counts)
 *   --out    default common/artifacts/revision-5/crh-levels/chrome next to this repo
 *   --qa-start  start 1-1 through __game.startLevel too (default: 1-1 goes through the
 *            real title -> story -> level card path with real keys)
 *   --no-sanity skip the pause / retry session; --no-model skip the model-only comparison
 *   --fresh  discard an existing results.json instead of merging by (level, persona, seed)
 *   --no-autorepeat  do not emulate the OS key repeat of a held key (see "Key repeat")
 *   --no-hold  keep real time while the brain thinks (see "Thinking time" below)
 *   --trace  also write <level>-<persona>-trace.json: Rubik's state, the wish and the
 *            events every few frames (debugging a stuck run)
 *
 * What a run does (one fresh browser context, headless Chrome, 960x540 at DPR 1):
 *  1. Opens index.html, waits for the art, starts the level (1-1: real keys through
 *     the menus; other levels: __game.startLevel, the state QA uses).
 *  2. Starts the brain in the page. Each frame it counts the 1/120 s ticks that ran
 *     (from g.time, which also advances through hit-stop and the dead phase), calls
 *     decide(g, M, bot) once per tick, and sends the wished held keys to Node.
 *     Jump keeps its press/release EDGES within a frame (a release then a press two
 *     ticks later is a mash, not a hold); dash/colour are one key press each.
 *  3. Node diffs wishes against what is physically down and issues
 *     keyboard.down/up/press (arrows, Space, K = dash, Z/X/C = colours).
 *  4. Ends on the win, the game-time cap, `deaths >= --max-deaths` or no progress.
 *     After a win it records the results card and clicks Continue.
 *  5. Screenshots (PNG, 960x540) at key moments, <= --max-shots per run, named
 *     <level>-<persona>-<moment>.png: start, suspect, spotted, windup, strike, hurt,
 *     stomp, get, theft, death, water, respawn (1 s after: Rubik must have moved),
 *     hopback, stuck1..3 (every 10 s without progress), clear, results.
 *  6. Checks every respawn: with a direction wished for >= 70% of the first 0.6 s,
 *     Rubik must have moved > 8 px (a frozen held key shows here, see respawnStuck).
 *
 * A separate short "sanity" session (first requested level, first-timer, ~25 s of
 * game time) presses Escape/Escape, Escape/Resume click and R with a direction key
 * held, and checks the clock froze, the game resumed and the held key still moves
 * Rubik. It is kept out of the measured runs so a retry never perturbs one.
 *
 * Output: results.json (merged by run id), summary.txt (one line per run), PNGs.
 * Exit code 1 on a console/page error, failed request, driver fault, respawn
 * freeze, failed sanity check or (with --require-clear) an uncleared level; a
 * level that is merely not cleared is a result, not a failure.
 *
 * Key repeat. A physically held key makes the OS send keydown with repeat=true every
 * ~33 ms after 500 ms, for the most recently pressed key only. Playwright's keyboard
 * does not do that by itself, so the driver does (Playwright marks a keydown of an
 * already-down key as repeat): the game must ignore repeats for jump/dash/colour
 * pulses and the level card, and keep a held direction held. Counted in keys.repeats.
 *
 * Thinking time. decide() steps copies of the model (springboard / jump planning) and
 * the page has one thread, so a heavy plan freezes the game for up to ~1.4 s on this
 * machine. The game then catches up 250 ms of ticks in one frame with the keys held and
 * no new decision: a blind run no person has (the Node proxies think for free in game
 * time). So when a frame's brain time exceeds 12 ms the driver toggles
 * __game.setManual(true/false), which only re-bases the game clock (it never touches
 * input): the thinking time is not game time. The held-away time is reported as
 * report.heldMs / holds; --no-hold disables it.
 *
 * Timing notes. Measured per run: wish -> keydown event time and handler time
 * (transport: rAF -> Playwright binding -> CDP -> renderer), wish -> visible
 * effect (jump press/release latch, move start), frame interval and brain time
 * per frame. The brain runs on the page's main thread, so a heavy plan (it steps
 * copies of the model) is also extra reaction time and shows up as brain ms.
 */
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync, readFileSync, readdirSync, unlinkSync, existsSync } from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import * as M from "../model.mjs";
import { LEVEL_IDS } from "../levels/index.mjs";
import { PERSONAS, runModel } from "./human-proxy.mjs";

// ------------------------------------------------------------------ args ----
const FLAGS_WITH_VALUE = new Set(["seed", "runs", "cap", "out", "port", "url", "stuck", "max-deaths", "max-shots", "trace-every"]);
const positional = [],
  flag = {};
{
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith("--")) positional.push(a);
    else if (FLAGS_WITH_VALUE.has(a.slice(2))) flag[a.slice(2)] = argv[++i];
    else flag[a.slice(2)] = true;
  }
}
const HERE = path.dirname(fileURLToPath(import.meta.url));
const OPT = {
  levels: !positional[0] || positional[0] === "all" ? [...LEVEL_IDS] : positional[0].split(","),
  personas: !positional[1] ? ["first"] : positional[1] === "all" ? Object.keys(PERSONAS) : positional[1].split(","),
  seed: Number(flag.seed ?? 1),
  runs: Number(flag.runs ?? 1),
  cap: Number(flag.cap ?? 180),
  stuck: Number(flag.stuck ?? 60),
  maxDeaths: Number(flag["max-deaths"] ?? 30),
  maxShots: Number(flag["max-shots"] ?? 14),
  out: path.resolve(flag.out ?? path.join(HERE, "../../common/artifacts/revision-5/crh-levels/chrome")),
  url: flag.url ?? `http://127.0.0.1:${flag.port ?? 4481}/index.html`,
  sanity: !flag["no-sanity"],
  model: !flag["no-model"],
  qaStart: !!flag["qa-start"],
  headed: !!flag.headed,
  fresh: !!flag.fresh,
  requireClear: !!flag["require-clear"],
  hold: !flag["no-hold"],
  autorepeat: !flag["no-autorepeat"],
  trace: !!flag.trace,
  traceEvery: Number(flag["trace-every"] ?? 6),
};
for (const p of OPT.personas) if (!PERSONAS[p]) throw new Error(`Unknown persona ${p} (${Object.keys(PERSONAS).join(", ")})`);
for (const id of OPT.levels) if (!LEVEL_IDS.includes(id)) throw new Error(`Unknown level ${id} (${LEVEL_IDS.join(", ")})`);
mkdirSync(OPT.out, { recursive: true });

const require = createRequire(process.env.PLAYWRIGHT_FROM || new URL("../../common/package.json", import.meta.url).pathname);
const { chromium } = (() => {
  try {
    return require("playwright");
  } catch {
    return require("@playwright/test");
  }
})();

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const round = (v, d = 1) => (v == null ? v : +v.toFixed(d));

// -------------------------------------------------------- the brain (page) ---
/** Runs INSIDE the page (Playwright serialises this function: it may not use
 * anything from the surrounding module). Returns after the loop is armed;
 * progress goes to Node through window.__crhMsg (exposed by the driver) and
 * window.__proxy (status/report/stop for the driver). */
async function brainInPage(o) {
  const H = await import("/tests/human-proxy.mjs");
  const M = await import("/model.mjs"); // same URL as game.mjs imports: the same instance
  const TICK = 1 / 120,
    T = 32;
  const api = window.__game;
  const now = () => performance.now();
  const epoch = () => performance.timeOrigin + performance.now();
  const post = (m) => window.__crhMsg(JSON.stringify(m)).catch(() => {});
  let g = api.model;
  let bot = H.makeProxy(o.persona, o.seed, o.level);
  let lastTime = g.time,
    lastEv = 0,
    lastFrame = null,
    raf = 0;
  const sent = { left: false, right: false, jump: false };
  const P = (window.__proxy = {
    stopped: false,
    ended: null,
    wish: { left: false, right: false, jump: false },
    seq: 0,
    frames: 0,
    ticks: 0,
    swaps: 0,
    frameMs: [],
    brainMs: [],
    lat: { wishToEvent: [], wishToHandler: [], jumpDown: [], jumpUp: [], moveStart: [] },
    missed: { jumpDown: 0, jumpUp: 0, moveStart: 0 },
    deathCols: [],
    respawnChecks: [],
    mergedTaps: 0,
    unexpectedPause: 0,
    trace: [],
    evlog: [],
    bot: null,
    holds: 0,
    heldMs: 0,
  });
  P.bot = bot;
  const push = (arr, v) => arr.length < 6000 && arr.push(v);
  const cxOf = () => g.player.x + g.player.w / 2;

  // Progress per travel direction (the proxy's own `best` is not reset when the
  // vault theft flips the direction, so the driver keeps its own).
  const trk = { dir: 1, best: -1e9, bestT: 0, maxX: -1e9, minX: 1e9, stuckShots: 0 };
  const seen = new Set();
  const due = [];
  const shot = (name) => post({ k: "shot", name, gt: g.time, x: Math.round(g.player.x), hp: g.player.hp, epoch: epoch() });
  const first = (name, after = 0) => {
    if (seen.has(name)) return;
    seen.add(name);
    if (after > 0) due.push({ name, at: g.time + after });
    else shot(name);
  };
  first("start", 2);

  // Latency: a wish stamps the keys it expects; the capture listeners match
  // them, in order, with the key events the page really receives.
  const LOGICAL = { ArrowLeft: "left", ArrowRight: "right", " ": "jump", k: "dash", z: "white", x: "green", c: "red" };
  const expect = {};
  const expectKey = (name, down, t) => (expect[name + (down ? ":d" : ":u")] ??= []).push(t);
  const onKey = (e) => {
    const name = LOGICAL[e.key];
    const t = name && expect[name + (e.type === "keydown" ? ":d" : ":u")]?.shift();
    if (t === undefined) return;
    push(P.lat.wishToEvent, e.timeStamp - t);
    push(P.lat.wishToHandler, now() - t);
  };
  addEventListener("keydown", onKey, true);
  addEventListener("keyup", onKey, true);
  const watch = [];

  const trackers = []; // respawn checks (0.6 s of game time after each respawn)
  let pausedSince = null;

  const end = (reason) => {
    if (P.stopped) return;
    P.stopped = true;
    P.ended = reason;
    cancelAnimationFrame(raf);
    removeEventListener("keydown", onKey, true);
    removeEventListener("keyup", onKey, true);
    post({ k: "end", reason, gt: g.time, epoch: epoch() });
  };
  P.stop = end;
  P.status = () => ({
    phase: g.phase,
    time: g.time,
    x: g.player.x,
    y: g.player.y,
    grounded: g.player.grounded,
    deaths: g.deaths,
    respawns: g.respawns,
    hp: g.player.hp,
    hits: g.hits,
    falls: g.falls,
    wish: { ...P.wish },
    level: g.levelId,
  });
  const pct = (a, q) => {
    if (!a.length) return null;
    const s = [...a].sort((x, y) => x - y);
    return +s[Math.min(s.length - 1, Math.floor(q * s.length))].toFixed(2);
  };
  const stats = (a) => ({ n: a.length, p50: pct(a, 0.5), p95: pct(a, 0.95), max: pct(a, 1) });
  P.report = () => ({
    frames: P.frames,
    ticks: P.ticks,
    swaps: P.swaps,
    frameMs: { ...stats(P.frameMs), over50: P.frameMs.filter((v) => v > 50).length, over100: P.frameMs.filter((v) => v > 100).length },
    brainMs: { ...stats(P.brainMs), over20: P.brainMs.filter((v) => v > 20).length, over50: P.brainMs.filter((v) => v > 50).length },
    latencyMs: Object.fromEntries(Object.entries(P.lat).map(([k, v]) => [k, stats(v)])),
    missedWatchers: P.missed,
    mergedTaps: P.mergedTaps,
    holds: P.holds,
    heldMs: Math.round(P.heldMs),
    unexpectedPause: P.unexpectedPause,
    deathCols: P.deathCols,
    respawnChecks: P.respawnChecks,
    maxCol: Math.floor(trk.maxX / T),
    returnCol: trk.minX < 1e9 ? Math.floor(trk.minX / T) : null,
    botLog: bot.log,
    botBest: bot.best,
  });

  function onEvent(ev) {
    if (o.trace) push(P.evlog, [round1(ev.time), ev.type, Math.round(ev.x), ev.reason || ev.source || ev.etype || ev.ability || ""]);
    switch (ev.type) {
      case "suspect":
        first("suspect");
        break;
      case "spotted":
        first("spotted");
        break;
      case "windup":
        first("windup");
        break;
      case "strike":
        first("strike");
        break;
      case "hurt":
        first("hurt", 0.08); // the hearts' animation, a beat after the hit
        break;
      case "stomp":
        first("stomp");
        break;
      case "get":
        first("get", 0.5);
        break;
      case "theft":
        first("theft", 0.3);
        break;
      case "die":
        P.deathCols.push({ col: Math.floor((g.deathAt?.x ?? ev.x) / T + 0.6), reason: ev.reason, t: round1(g.time) });
        first("death", 0.05);
        break;
      case "fall":
        first("water", 0.05);
        break;
      case "respawn":
        trackers.push({ id: ev.id, t0: g.time, x0: g.player.x, partial: !!ev.partial, ticks: 0, wishTicks: 0 });
        if (ev.partial) first("hopback", 0.25);
        else first("respawn", 1.0);
        break;
    }
  }
  const round1 = (v) => Math.round(v * 10) / 10;

  function frame(t) {
    if (P.stopped) return;
    raf = requestAnimationFrame(frame);
    P.frames++;
    if (lastFrame !== null) push(P.frameMs, t - lastFrame);
    lastFrame = t;
    const g0 = api.model;
    if (g0 !== g) {
      // A new game object (restart): start the proxy over, as a new attempt.
      g = g0;
      lastTime = g.time;
      lastEv = 0;
      bot = H.makeProxy(o.persona, o.seed, o.level);
      P.swaps++;
    }
    const n = Math.max(0, Math.min(60, Math.round((g.time - lastTime) / TICK)));
    lastTime = g.time;
    P.ticks += n;

    if (g.phase === "paused") {
      pausedSince ??= now();
      if (!P.holdPause && now() - pausedSince > 2000) {
        P.unexpectedPause++;
        pausedSince = now();
        post({ k: "unexpectedPause" });
      }
    } else pausedSince = null;

    // ---- think: one decide() per elapsed tick, wishes merged for the frame.
    if (n > 0) {
      const b0 = now();
      let want = null,
        dash = false,
        color = null,
        prev = sent.jump;
      const seq = [];
      for (let i = 0; i < n; i++) {
        want = H.decide(g, M, bot);
        if (!!want.jump !== prev) {
          seq.push(!!want.jump);
          prev = !!want.jump;
        }
        dash ||= !!want.dash;
        if (want.color) color = want.color;
      }
      const spent = now() - b0;
      push(P.brainMs, spent);
      if (o.hold && spent > 12) {
        api.setManual(true); // hold + release = re-base the game clock to now
        api.setManual(false);
        P.holds++;
        P.heldMs += spent;
      }
      const left = !!want.left,
        right = !!want.right;
      if (seq.length > 1 && seq.length % 2 === 0) P.mergedTaps++; // press+release inside one frame
      if (left !== sent.left || right !== sent.right || seq.length || dash || color) {
        const tw = now(),
          p = g.player;
        if (left !== sent.left) expectKey("left", left, tw);
        if (right !== sent.right) expectKey("right", right, tw);
        let jp = sent.jump;
        for (const v of seq) {
          expectKey("jump", v, tw);
          if (g.phase === "playing" && p.jumpHeld === !v && jp === !v) watch.push({ kind: v ? "jumpDown" : "jumpUp", t: tw });
          jp = v;
        }
        if (dash) expectKey("dash", true, tw);
        if (color) expectKey(color, true, tw);
        if ((left || right) && !sent.left && !sent.right && g.phase === "playing" && p.grounded && Math.abs(p.vx) < 1 && g.hitstop <= 0 && p.knock <= 0 && p.holdLock <= 0 && p.dashTime <= 0) watch.push({ kind: "moveStart", t: tw, dir: right ? 1 : -1 });
        post({ k: "wish", seq: ++P.seq, t: tw, left, right, jumpSeq: seq, dash, color, gt: g.time });
        sent.left = left;
        sent.right = right;
        sent.jump = prev;
        P.wish = { left, right, jump: prev };
      }
    }

    if (o.trace && P.frames % o.traceEvery === 0) {
      const p = g.player;
      push(P.trace, [Math.round(g.time * 100) / 100, Math.round(p.x), Math.round(p.y), Math.round(p.vx), Math.round(p.vy), p.grounded ? 1 : 0, p.hp, +P.wish.left, +P.wish.right, +P.wish.jump, bot.plan.length, bot.approach ? 1 : 0, g.phase[0], n]);
    }

    // ---- effect latency watchers
    for (let i = watch.length - 1; i >= 0; i--) {
      const w = watch[i],
        p = g.player,
        el = now() - w.t;
      const done = w.kind === "jumpDown" ? p.jumpHeld === true : w.kind === "jumpUp" ? p.jumpHeld === false : p.vx * w.dir > 1;
      if (done) {
        push(P.lat[w.kind], el);
        watch.splice(i, 1);
      } else if (el > 600) {
        P.missed[w.kind]++;
        watch.splice(i, 1);
      }
    }

    // ---- events, delayed shots, respawn checks, progress
    for (const ev of g.events) {
      if (ev.id <= lastEv) continue;
      lastEv = ev.id;
      onEvent(ev);
    }
    for (let i = due.length - 1; i >= 0; i--)
      if (g.time >= due[i].at && g.phase !== "paused") {
        shot(due[i].name);
        due.splice(i, 1);
      }
    for (let i = trackers.length - 1; i >= 0; i--) {
      const tr = trackers[i];
      if (g.phase === "dead" && n > 0) {
        P.respawnChecks.push({ t: round1(tr.t0), partial: tr.partial, aborted: true });
        trackers.splice(i, 1);
        continue;
      }
      if (g.phase !== "playing") continue;
      tr.ticks += n;
      if (P.wish.left || P.wish.right) tr.wishTicks += n;
      if (tr.ticks >= 72) {
        const dx = g.player.x - tr.x0,
          wishFrac = tr.wishTicks / tr.ticks;
        // A held key against a solid tile (a hop-back that lands at a wall's foot,
        // a respawn facing the sealed door) moves nothing by design: not a freeze.
        const q = g.player,
          row = Math.floor((q.y + q.h / 2) / 32),
          col = P.wish.left ? Math.floor((q.x - 3) / 32) : Math.floor((q.x + q.w + 3) / 32),
          walled = (P.wish.left || P.wish.right) && (g.level.map[row]?.[col] === "#" || col < 0 || col >= g.level.cols);
        P.respawnChecks.push({ t: round1(tr.t0), partial: tr.partial, dx: Math.round(dx), wishFrac: +wishFrac.toFixed(2), moved: Math.abs(dx) > 8, walled, stuck: wishFrac >= 0.7 && Math.abs(dx) <= 8 && !walled });
        trackers.splice(i, 1);
      }
    }
    const dir = g.stolen ? -1 : 1,
      x = cxOf();
    if (dir !== trk.dir) {
      trk.dir = dir;
      trk.best = dir * x;
      trk.bestT = g.time;
    }
    if (dir * x > trk.best + 8) {
      trk.best = dir * x;
      trk.bestT = g.time;
    }
    if (dir > 0) trk.maxX = Math.max(trk.maxX, x);
    else trk.minX = Math.min(trk.minX, x);
    const still = g.time - trk.bestT;
    if (still >= 10 * (trk.stuckShots + 1) && trk.stuckShots < 3 && g.phase === "playing") shot("stuck" + ++trk.stuckShots);

    // ---- end conditions
    if (g.phase === "won") return end("won");
    if (g.time >= o.cap) return end("cap");
    if (g.deaths >= o.maxDeaths) return end("deaths");
    if (still >= o.stuckSec) return end("stuck");
  }
  raf = requestAnimationFrame(frame);
  return { ok: true, levelId: g.levelId, phase: g.phase };
}

// ------------------------------------------------------------ driver (Node) --
const KEY_CODE = { left: "ArrowLeft", right: "ArrowRight", jump: "Space" };
const PULSE_CODE = { dash: "KeyK", white: "KeyZ", green: "KeyX", red: "KeyC" };
const RESERVED_SHOTS = new Set(["clear", "results", "respawn", "stuck1", "stuck2", "stuck3"]);

async function waitUntil(fn, timeout = 5000, step = 25) {
  const t0 = Date.now();
  for (;;) {
    const v = await fn();
    if (v) return v;
    if (Date.now() - t0 > timeout) return false;
    await sleep(step);
  }
}

/** The real path into 1-1: title -> any key -> comic -> any key -> level card ->
 * play goes live ~0.4 s later, with no key needed. Returns what it observed. */
async function menuPath(page, log) {
  const scr = () => page.evaluate(() => window.__game.getState().screen);
  const out = { steps: [] };
  const step = (name, ok, extra = {}) => out.steps.push({ name, ok, ...extra });
  step("title", (await scr()) === "title");
  await page.keyboard.press("Enter");
  step("title -> story (Enter)", !!(await waitUntil(async () => (await scr()) === "story", 4000)));
  await page.keyboard.press("Enter");
  const t0 = Date.now();
  step("story -> level card (Enter)", !!(await waitUntil(async () => (await scr()) === "play", 4000)), { introCard: await page.evaluate(() => window.__game.getState().intro) });
  const live = await waitUntil(() => page.evaluate(() => window.__game.model.time > 0.02), 5000, 10);
  out.cardToLiveMs = Date.now() - t0;
  step("level card -> live play with no key", !!live, { ms: out.cardToLiveMs });
  out.ok = out.steps.every((s) => s.ok);
  log(`    menu path: ${out.steps.map((s) => `${s.name}=${s.ok ? "ok" : "FAIL"}`).join(", ")}, live after ${out.cardToLiveMs} ms`);
  return out;
}

/** One Chrome session: start a level, run the brain, drive the keys, collect. */
async function runSession(browser, spec, log) {
  const { level, persona, seed } = spec;
  const tag = spec.sanity ? `${level}-sanity` : `${level}-${persona}`;
  // A rerun replaces this run's pictures: never leave the old run's moments behind.
  for (const f of readdirSync(OPT.out)) if (f.startsWith(`${tag}-`) && /\.(png|json)$/.test(f)) unlinkSync(path.join(OPT.out, f));
  const ctx = await browser.newContext({ viewport: { width: 960, height: 540 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  const errors = [],
    faults = [];
  const isFavicon = (u) => /favicon/i.test(u || "");
  page.on("console", (m) => {
    if (m.type() === "error" && !isFavicon(m.location().url)) errors.push(`console: ${m.text()} @${m.location().url}`);
    if (m.type() === "warning" && /error|fail|undefined/i.test(m.text())) faults.push(`warn: ${m.text()}`);
  });
  page.on("pageerror", (e) => errors.push(`pageerror: ${e}`));
  page.on("requestfailed", (r) => !isFavicon(r.url()) && errors.push(`requestfailed: ${r.url()}`));
  page.on("response", (r) => r.status() >= 400 && !isFavicon(r.url()) && errors.push(`http ${r.status()}: ${r.url()}`));
  let endInfo = null,
    endResolve;
  const ended = new Promise((res) => (endResolve = res));
  page.on("crash", () => {
    errors.push("page crashed");
    endResolve({ reason: "crash" });
  });

  // ---- real keys: one serial queue, the physical key state lives here
  const down = new Set();
  const stat = { keyDown: 0, keyUp: 0, press: 0, repeats: 0, queueMax: 0 };
  let lastPressed = null; // { name, at }: the OS repeats only the last key pressed
  let kq = Promise.resolve(),
    kdepth = 0;
  const enqueueKey = (fn) => {
    stat.queueMax = Math.max(stat.queueMax, ++kdepth);
    const p = kq.then(fn).catch((e) => faults.push(`key: ${e.message}`));
    kq = p.finally(() => kdepth--);
    return p;
  };
  const setKey = async (name, want) => {
    if (want && !down.has(name)) {
      down.add(name);
      stat.keyDown++;
      lastPressed = { name, at: Date.now() };
      await page.keyboard.down(KEY_CODE[name]);
    } else if (!want && down.has(name)) {
      down.delete(name);
      stat.keyUp++;
      if (lastPressed?.name === name) lastPressed = null; // its repeat stops with it
      await page.keyboard.up(KEY_CODE[name]);
    }
  };
  const repeater = !OPT.autorepeat
    ? null
    : setInterval(() => {
        if (!lastPressed || !down.has(lastPressed.name) || Date.now() - lastPressed.at < 500 || kdepth > 2) return;
        const name = lastPressed.name;
        stat.repeats++;
        enqueueKey(async () => down.has(name) && (await page.keyboard.down(KEY_CODE[name]))); // already down: Playwright sends repeat=true
      }, 33);
  const pressCode = async (code) => {
    stat.press++;
    await page.keyboard.press(code);
  };
  const applyWish = async (m) => {
    // Releases first, so a turn never has both arrows down.
    for (const name of ["left", "right"]) if (!m[name]) await setKey(name, false);
    for (const name of ["left", "right"]) if (m[name]) await setKey(name, true);
    for (let i = 0; i < m.jumpSeq.length; i++) {
      await setKey("jump", m.jumpSeq[i]);
      // Two edges in one frame must land on different 1/120 s ticks.
      if (i < m.jumpSeq.length - 1) await sleep(10);
    }
    if (m.dash) await pressCode(PULSE_CODE.dash);
    if (m.color) await pressCode(PULSE_CODE[m.color]);
  };
  const releaseAll = () => enqueueKey(async () => { for (const name of [...down]) await setKey(name, false); });

  // ---- screenshots (serial; page.screenshot of the 960x540 page)
  const shots = [];
  const shotNames = new Set();
  let shotq = Promise.resolve(),
    shotCount = 0;
  const takeShot = (m) => {
    if (shotNames.has(m.name)) return shotq;
    if (shotCount >= OPT.maxShots - (RESERVED_SHOTS.has(m.name) ? 0 : 4)) return shotq;
    shotNames.add(m.name);
    shotCount++;
    const file = `${tag}-${m.name}.png`;
    shotq = shotq
      .then(async () => {
        const t0 = Date.now();
        await page.screenshot({ path: path.join(OPT.out, file) });
        shots.push({ name: m.name, file, gameTime: round(m.gt, 2), x: m.x, hp: m.hp, ms: Date.now() - t0, afterEventMs: m.epoch ? Math.round(Date.now() - m.epoch) : null });
      })
      .catch((e) => faults.push(`shot ${m.name}: ${e.message}`));
    return shotq;
  };
  const shotNow = (name, extra = {}) => page.evaluate(() => window.__proxy.status()).then((s) => takeShot({ name, gt: s.time, x: Math.round(s.x), hp: s.hp, ...extra }));

  // ---- messages from the page
  await page.exposeFunction("__crhMsg", (raw) => {
    const m = JSON.parse(raw);
    if (m.k === "wish") enqueueKey(() => applyWish(m));
    else if (m.k === "shot") takeShot(m);
    else if (m.k === "end") {
      endInfo = m;
      enqueueKey(async () => { for (const name of [...down]) await setKey(name, false); }).then(() => endResolve(m));
    } else if (m.k === "unexpectedPause") enqueueKey(() => pressCode("Escape"));
  });

  const loadT0 = Date.now();
  await page.goto(OPT.url);
  await page.waitForFunction(() => window.__game?.getState().assetsReady, null, { timeout: 90000 });
  const loadMs = Date.now() - loadT0;

  // ---- start the level
  let menu = null;
  if (level === "1-1" && !OPT.qaStart) menu = await menuPath(page, log);
  else await page.evaluate((id) => window.__game.startLevel(id), level);
  const modelShape = await page.evaluate(() => {
    const g = window.__game.model;
    return { level: g.levelId, phase: g.phase, time: g.time, hasPlayer: !!g.player, hearts: g.player.hp };
  });

  // ---- arm the brain
  const wall0 = Date.now();
  await page.evaluate(brainInPage, { persona, seed, level, cap: spec.cap ?? OPT.cap, maxDeaths: OPT.maxDeaths, stuckSec: OPT.stuck, hold: OPT.hold, trace: OPT.trace, traceEvery: OPT.traceEvery });
  const status = () => page.evaluate(() => window.__proxy.status());

  // ---- the sanity script (pause, retry) runs beside the brain
  let sanity = null;
  const script = !spec.sanity
    ? null
    : (async () => {
        const res = {};
        const live = await waitUntil(async () => { const s = await status(); return s.phase === "playing" && s.time >= 4 && s.grounded; }, 60000, 50);
        if (!live) return (res.error = "never reached 4 s of live play"), res;
        await page.evaluate(() => (window.__proxy.holdPause = true));
        const pauseCheck = async (how) => {
          const r = { how };
          // Pause while Rubik is actually running: at a wall or a standstill a
          // held key moves nothing, which would read as a frozen key (it did, at
          // 1-1's 4-tile wall: dx 0 with the clock running).
          await waitUntil(async () => {
            const a = await status();
            await sleep(120);
            const b = await status();
            return b.phase === "playing" && b.grounded && Math.abs(b.x - a.x) > 12;
          }, 20000, 0);
          const before = await status();
          await enqueueKey(() => pressCode("Escape"));
          r.paused = !!(await waitUntil(async () => (await status()).phase === "paused", 3000, 20));
          const s1 = await status();
          await sleep(600);
          const s2 = await status();
          r.clockFrozen = s2.time === s1.time;
          r.keysHeldDuringPause = [...down];
          await shotNow(`pause-${how}`);
          if (how === "escape") await enqueueKey(() => pressCode("Escape"));
          else await page.locator("#resume").click({ timeout: 3000 });
          r.resumed = !!(await waitUntil(async () => (await status()).phase === "playing", 3000, 20));
          const r0 = await status();
          await sleep(800);
          const r1 = await status();
          r.timeAdvanced = round(r1.time - r0.time, 2);
          r.dx = Math.round(r1.x - r0.x);
          r.wished = r0.wish.left || r0.wish.right || r1.wish.left || r1.wish.right;
          r.keysHeldAfter = [...down];
          r.heldKeyMoves = r.wished ? Math.abs(r.dx) > 20 : null; // null = brain wished no direction (inconclusive)
          r.ok = r.paused && r.clockFrozen && r.resumed && r.timeAdvanced > 0.5 && r.heldKeyMoves !== false;
          r.before = { x: round(before.x, 0), t: round(before.time, 2) };
          return r;
        };
        res.pauseEscape = await pauseCheck("escape");
        await waitUntil(async () => (await status()).time > 0, 100);
        await sleep(2500);
        res.pauseResume = await pauseCheck("resume");
        await sleep(2000);
        await page.evaluate(() => (window.__proxy.holdPause = false));
        // Retry (R): a respawn at the checkpoint that is not counted as a death.
        await waitUntil(async () => { const s = await status(); return s.phase === "playing" && s.grounded; }, 20000, 50);
        const s0 = await status();
        await enqueueKey(() => pressCode("KeyR"));
        const got = await waitUntil(async () => (await status()).respawns > s0.respawns, 3000, 20);
        const a0 = await status();
        await sleep(800);
        const a1 = await status();
        res.retry = {
          respawned: !!got,
          deathsUnchanged: a1.deaths === s0.deaths,
          dx: Math.round(a1.x - a0.x),
          wished: a0.wish.left || a0.wish.right || a1.wish.left || a1.wish.right,
          keysHeldAfter: [...down],
        };
        res.retry.heldKeyMoves = res.retry.wished ? Math.abs(res.retry.dx) > 20 : null;
        res.retry.ok = res.retry.respawned && res.retry.deathsUnchanged && res.retry.heldKeyMoves !== false;
        await sleep(500);
        await shotNow("after-retry");
        await page.evaluate(() => window.__proxy.stop("sanity-done"));
        return res;
      })().then((r) => (sanity = r), (e) => (sanity = { error: String(e) }));

  // ---- wait for the end of the run (or a wall-clock guard)
  const wallLimit = ((spec.cap ?? OPT.cap) * 3 + 120) * 1000;
  const result = await Promise.race([ended, sleep(wallLimit).then(() => ({ reason: "wall-timeout" }))]);
  if (result.reason === "wall-timeout") await page.evaluate(() => window.__proxy?.stop("wall-timeout")).catch(() => {});
  if (script) await script;
  await releaseAll();
  await kq;
  const wallSec = (Date.now() - wall0) / 1000;
  const report = await page.evaluate(() => window.__proxy.report()).catch((e) => ({ error: String(e) }));
  if (OPT.trace) {
    // columns: t x y vx vy grounded hp wishL wishR wishJump planLen approach phase ticksThisFrame
    const t = await page.evaluate(() => ({ cols: "t x y vx vy grounded hp L R J plan approach phase n", rows: window.__proxy.trace, events: window.__proxy.evlog })).catch(() => null);
    if (t) writeFileSync(path.join(OPT.out, `${tag}-trace.json`), JSON.stringify(t));
  }
  const final = await page.evaluate(() => {
    const g = window.__game.model;
    return { phase: g.phase, time: g.time, deaths: g.deaths, hits: g.hits, falls: g.falls, hp: g.player.hp, chainBest: g.chainBest, stomps: g.stomps, respawns: g.respawns, spotted: g.spotted, stickers: g.stickers.filter((s) => s.collected).length };
  });

  // ---- the clear: shot, results card, Continue
  let results = null;
  if (result.reason === "won") {
    await sleep(500);
    await shotNow("clear");
    const screen = await waitUntil(async () => { const s = await page.evaluate(() => window.__game.getState().screen); return s === "results" || s === "world" ? s : false; }, 9000, 100);
    if (screen) {
      await sleep(300);
      await shotNow("results");
      const info = await page.evaluate(() => { const s = window.__game.getState(); return { screen: s.screen, result: s.result }; });
      results = { screen: info.screen, result: info.result };
      try {
        await page.locator("#continue").click({ timeout: 4000 });
        await sleep(600);
        results.afterContinue = await page.evaluate(() => window.__game.getState().screen);
      } catch (e) {
        results.continueError = e.message.split("\n")[0];
      }
    } else results = { screen: null, error: "no results card within 9 s of the win" };
  }
  await shotq;
  await sleep(100);
  if (final.phase !== "won" && result.reason !== "won") await shotNow("end").then(() => shotq);
  clearInterval(repeater);
  await ctx.close();

  return {
    level,
    persona,
    seed,
    cleared: result.reason === "won",
    endReason: result.reason,
    gameTime: round(final.time, 1),
    wallSec: round(wallSec, 1),
    loadMs,
    deaths: final.deaths,
    hits: final.hits,
    falls: final.falls,
    heartsLost: final.hits + final.falls,
    chainBest: final.chainBest,
    stomps: final.stomps,
    spotted: final.spotted,
    stickers: final.stickers,
    hpEnd: final.hp,
    maxCol: report.maxCol,
    returnCol: report.returnCol,
    deathCols: report.deathCols,
    errors,
    faults,
    menu,
    results,
    modelShape,
    keys: stat,
    report,
    shots,
    sanity,
  };
}

// --------------------------------------------------------- results output ----
const resultsFile = path.join(OPT.out, "results.json");
let store = { meta: {}, sanity: null, runs: [] };
if (!OPT.fresh && existsSync(resultsFile)) {
  try {
    store = JSON.parse(readFileSync(resultsFile, "utf8"));
  } catch {}
}
const runId = (r) => `${r.level}|${r.persona}|${r.seed}`;
function summaryLine(r) {
  const lat = r.report?.latencyMs,
    f = (v) => (v == null ? "-" : v);
  const rs = r.report?.respawnChecks ?? [];
  const bad = rs.filter((c) => c.stuck).length;
  const m = r.model;
  return [
    `${r.level}${r.levelSha ? `@${r.levelSha}` : ""} ${r.persona.padEnd(6)} seed ${r.seed}`,
    r.cleared ? "CLEARED" : `NOT CLEARED (${r.endReason})`,
    `game ${r.gameTime}s wall ${r.wallSec}s`,
    `deaths ${r.deaths} hearts lost ${r.heartsLost} (hits ${r.hits} falls ${r.falls}) chain ${r.chainBest}`,
    `maxCol ${r.maxCol}${r.returnCol != null ? ` return ${r.returnCol}` : ""} deathCols [${(r.deathCols || []).map((d) => d.col).join(" ")}]`,
    `respawns checked ${rs.length}${bad ? ` FROZEN ${bad}` : ""}`,
    `errors ${r.errors.length} faults ${r.faults.length}`,
    `lat wish->event p50 ${f(lat?.wishToEvent.p50)} p95 ${f(lat?.wishToEvent.p95)} ms, jump->latch p50 ${f(lat?.jumpDown.p50)} ms`,
    `brain p95 ${f(r.report?.brainMs?.p95)} max ${f(r.report?.brainMs?.max)} ms (held ${f(r.report?.heldMs)} ms in ${f(r.report?.holds)} holds)`,
    m ? `| model: ${m.won ? "CLEARED" : "not cleared"} ${m.time}s deaths ${m.deaths} hearts lost ${m.hits + m.falls} maxCol ${m.maxCol}` : "",
  ]
    .filter(Boolean)
    .join("  ");
}
function persist() {
  store.meta = { ...store.meta, updated: new Date().toISOString(), url: OPT.url, viewport: "960x540@1x", cap: OPT.cap, stuck: OPT.stuck, node: process.version };
  writeFileSync(resultsFile, JSON.stringify(store, null, 1));
  writeFileSync(path.join(OPT.out, "summary.txt"), store.runs.map(summaryLine).join("\n") + "\n");
}

// ------------------------------------------------------------------- main ----
const log = (s) => console.log(s);
const browser = await chromium.launch({
  channel: "chrome",
  headless: !OPT.headed,
  // The machine is shared and busy: never throttle a page that is "hidden".
  args: ["--disable-renderer-backgrounding", "--disable-background-timer-throttling", "--disable-backgrounding-occluded-windows"],
});
store.meta.chrome = browser.version();
let exitCode = 0;
try {
  if (OPT.sanity) {
    const level = OPT.levels[0];
    log(`sanity session on ${level} (first-timer, pause/resume/retry with keys held)`);
    const r = await runSession(browser, { level, persona: "first", seed: 1, cap: 25, sanity: true }, log);
    store.sanity = { level, menu: r.menu, ...r.sanity, errors: r.errors, faults: r.faults, report: r.report, keys: r.keys, shots: r.shots, endReason: r.endReason };
    const checks = [store.sanity.pauseEscape, store.sanity.pauseResume, store.sanity.retry];
    const ok = checks.every((c) => c?.ok) && !r.errors.length && (r.menu ? r.menu.ok : true);
    store.sanity.ok = ok;
    log(`  pause(Esc/Esc) ${JSON.stringify(checks[0])}\n  pause(Esc/Resume) ${JSON.stringify(checks[1])}\n  retry(R) ${JSON.stringify(checks[2])}\n  sanity ${ok ? "PASS" : "FAIL"}  errors ${r.errors.length}`);
    if (!ok) exitCode = 1;
    persist();
  }
  for (const level of OPT.levels)
    for (const persona of OPT.personas)
      for (let k = 0; k < OPT.runs; k++) {
        const seed = OPT.seed + k;
        const model = OPT.model ? runModel(M, level, persona, seed, { maxTime: OPT.cap }) : null;
        const r = await runSession(browser, { level, persona, seed }, log);
        // Which version of the level this run played (the level file is edited while runs accumulate).
        r.at = new Date().toISOString();
        r.levelSha = createHash("sha1").update(readFileSync(path.join(HERE, "../levels", `${level}.mjs`))).digest("hex").slice(0, 8);
        if (model) r.model = { won: model.won, time: model.time, deaths: model.deaths, hits: model.hits, falls: model.falls, maxCol: model.maxCol, deathCols: model.deathList.map((d) => d.col) };
        store.runs = store.runs.filter((x) => runId(x) !== runId(r));
        store.runs.push(r);
        persist();
        log(summaryLine(r));
        if (r.errors.length) (exitCode = 1), log(`  ERRORS: ${r.errors.slice(0, 5).join(" | ")}`);
        if (r.faults.length) (exitCode = 1), log(`  FAULTS: ${r.faults.slice(0, 5).join(" | ")}`);
        if ((r.report?.respawnChecks ?? []).some((c) => c.stuck)) (exitCode = 1), log("  RESPAWN FREEZE: a held direction did not move Rubik after a respawn");
        if (OPT.requireClear && !r.cleared) exitCode = 1;
      }
} finally {
  await browser.close();
}
log(`results: ${resultsFile}`);
process.exit(exitCode);
