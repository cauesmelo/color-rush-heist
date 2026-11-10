/** Real-Chrome movement checks for MOVEMENT_AUDIT.md (dev tool, not part of
 * `npm test`; needs Playwright, e.g. the workspace's common/node_modules).
 *
 *   node serve.mjs --port 4401 &            # this folder (or dist/itch)
 *   node tests/browser-movement.mjs http://127.0.0.1:4401/ [shots-dir]
 *
 * Real key events (Playwright's trusted CDP keyboard) drive the game; the QA
 * API only starts levels and reads state. Prints a JSON report and exits 1 if
 * any check fails. */
import { createRequire } from "node:module";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { ROUTES } from "./routes.mjs";

const url = process.argv[2] || "http://127.0.0.1:4401/",
  shots = process.argv[3] || null;
const require = createRequire(process.env.PLAYWRIGHT_FROM || new URL("../../common/package.json", import.meta.url).pathname);
const { chromium } = require("@playwright/test");
const report = {},
  failures = [];
const check = (name, ok, value) => {
  report[name] = { ok, value };
  if (!ok) failures.push(name);
};

const browser = await chromium.launch({ channel: "chrome" });
const page = await browser.newPage({ viewport: { width: 960, height: 640 } });
const errors = [];
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
page.on("pageerror", (e) => errors.push(String(e)));
page.on("requestfailed", (r) => errors.push(`failed: ${r.url()}`));
await page.goto(url);
await page.waitForFunction(() => window.__game?.getState().assetsReady);
const state = () => page.evaluate(() => window.__game.getState());
const start = (id) => page.evaluate((id) => window.__game.startLevel(id), id);

// Every route through the model in Chrome (QA stepping, the same fixtures).
const routeResults = {};
for (const [id, kinds] of Object.entries(ROUTES))
  for (const kind of ["baseline", "mastery"]) {
    const r = await page.evaluate(
      ([id, route]) => {
        const g = window.__game;
        g.startLevel(id);
        g.setManual(true);
        for (const [s, input] of route) g.step(s, input, { render: false });
        const s = g.getState();
        g.setManual(false);
        return { phase: s.phase, deaths: s.deaths, stickers: s.stickers };
      },
      [id, kinds[kind]],
    );
    routeResults[`${id} ${kind}`] = r;
    check(`route ${id} ${kind}`, r.phase === "won" && r.deaths === 0 && (kind === "baseline" || r.stickers === 3), r);
  }

// A1: a real key press shows on the next rendered frame.
await start("1-1");
await page.evaluate(() => {
  window.__probe = { frames: [], keys: [] };
  addEventListener("keydown", (e) => window.__probe.keys.push(e.timeStamp), true);
  const tick = (t) => {
    const p = window.__game.model.player;
    window.__probe.frames.push({ t, vy: p.vy, vx: p.vx });
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
});
await page.waitForTimeout(500);
for (let i = 0; i < 10; i++) {
  await page.waitForTimeout(37 + ((i * 53) % 61)); // presses at arbitrary phases of the frame
  await page.keyboard.down("Space");
  await page.waitForTimeout(60);
  await page.keyboard.up("Space");
  await page.waitForTimeout(950);
}
await page.keyboard.down("ArrowRight");
await page.waitForTimeout(200);
await page.keyboard.up("ArrowRight");
const probe = await page.evaluate(() => window.__probe);
// Frames are counted from the first rendered frame after the event: 0 = that
// frame already shows the jump (or the run), 1 = the one after.
const latency = probe.keys.map((k, i) => {
  const after = probe.frames.filter((f) => f.t >= k);
  return after.findIndex((f) => (i < probe.keys.length - 1 ? f.vy < 0 : f.vx > 0));
});
const gaps = probe.frames.slice(1).map((f, i) => f.t - probe.frames[i].t).sort((a, b) => a - b);
report.frameMs = { median: +gaps[gaps.length >> 1].toFixed(2), p95: +gaps[Math.floor(gaps.length * 0.95)].toFixed(2) };
check("A1 key -> frames until visible (Space, ArrowRight)", latency.every((n) => n >= 0 && n <= 1), latency);

// A2 in Chrome: with 40-90 ms main-thread hitches, each jump fires on the
// tick its keydown timestamp falls in.
await start("1-1");
await page.evaluate(() => {
  window.__hitch = true;
  const busy = (t) => {
    if (window.__hitch && Math.random() < 0.15) {
      const until = performance.now() + 40 + Math.random() * 50;
      while (performance.now() < until);
    }
    requestAnimationFrame(busy);
  };
  requestAnimationFrame(busy);
  window.__stamps = [];
  addEventListener("keydown", (e) => e.key === " " && !e.repeat && window.__stamps.push(e.timeStamp), true);
});
const offsets = [];
for (let i = 0; i < 8; i++) {
  await page.waitForTimeout(150 + ((i * 37) % 90));
  await page.keyboard.down("Space");
  await page.waitForTimeout(40);
  await page.keyboard.up("Space");
  await page.waitForTimeout(950);
  const s = await page.evaluate(() => {
    const g = window.__game.getState();
    return { stamp: window.__stamps.at(-1), simClock: g.simClock, time: g.time, jump: g.events.filter((e) => e.type === "jump").at(-1)?.time };
  });
  // The jump tick's end in performance.now() time; the stamp must fall in it.
  const tickEnd = s.simClock - (s.time - s.jump) * 1000;
  offsets.push(+(tickEnd - s.stamp).toFixed(2));
}
await page.evaluate(() => (window.__hitch = false));
check("A2 jump tick end - keydown stamp, under 40-90 ms hitches (ms, must be 0..8.33)", offsets.every((d) => d >= -0.01 && d <= 8.34), offsets);

// A3: a direction held through a pause applies on resume; Space on the
// focused Resume button resumes without a jump; a key held from the map moves
// Rubik once the level goes live.
await start("1-1");
await page.waitForTimeout(300);
await page.keyboard.down("ArrowRight");
await page.waitForTimeout(150);
await page.keyboard.press("Escape");
await page.waitForTimeout(250);
const xPaused = (await state()).player.x;
await page.keyboard.press("Escape");
await page.waitForTimeout(250);
const resumed = await state();
await page.keyboard.up("ArrowRight");
check("A3 held right through pause/resume moves at once", resumed.phase === "playing" && resumed.player.x > xPaused + 40, { xPaused, xResumed: resumed.player.x });
await page.waitForTimeout(400);
await page.keyboard.press("Escape");
await page.waitForTimeout(200);
await page.evaluate(() => document.getElementById("resume").focus());
await page.keyboard.press("Space");
await page.waitForTimeout(120);
const spaceResume = await state();
check("A3 Space on Resume: resumed, no jump", spaceResume.phase === "playing" && spaceResume.player.vy >= 0 && spaceResume.player.grounded, { phase: spaceResume.phase, vy: spaceResume.player.vy });
await page.evaluate(() => window.__game.openMap("1-1"));
await page.waitForTimeout(300);
await page.keyboard.down("ArrowRight"); // walks the map cursor (1-1 is the only open node or not)
await page.waitForTimeout(100);
await page.evaluate(() => window.__game.startLevel("1-1"));
await page.waitForTimeout(400);
const fromMap = await state();
await page.keyboard.up("ArrowRight");
check("A3 QA start is clean (nothing held carries into startLevel)", Math.abs(fromMap.player.x - 184) < 30, fromMap.player.x);

// A3 death: right held (a real key) through a fall into 1-1's first water,
// the death hop and the respawn moves Rubik again within the 0.2 s landing
// beat plus a few frames (it used to stay locked until released: the rescue
// round's "I can't pass the first level"). Only the start position is set
// through the model; the key is never released.
await start("1-1");
await page.evaluate(() => {
  const g = window.__game.model,
    water = g.level.map[20].indexOf("~");
  for (const c of g.guards) c.state = "away";
  // Over the first water, falling: the death is on its way.
  Object.assign(g.player, { x: water * 32 + 40, y: 16 * 32, vx: 0, vy: 300, grounded: false, grace: 0 });
});
await page.keyboard.down("ArrowRight");
const deathRun = await page.evaluate(
  () =>
    new Promise((resolve) => {
      const g = window.__game;
      let respawnAt = null,
        x0 = null,
        t0 = performance.now();
      const poll = () => {
        const s = g.getState(),
          now = performance.now();
        if (respawnAt === null && s.respawns > 0) (respawnAt = now), (x0 = s.player.x);
        if (respawnAt !== null && s.player.x > x0 + 8) return resolve({ movedAfterMs: Math.round(now - respawnAt), deaths: s.deaths, falls: s.falls });
        if (now - t0 > 4000) return resolve({ movedAfterMs: null, deaths: s.deaths, respawns: s.respawns, x: s.player.x, x0 });
        requestAnimationFrame(poll);
      };
      poll();
    }),
);
await page.keyboard.up("ArrowRight");
// A fall into water now costs a heart and hops back to safe ground (not a death), so count either.
check("A3 right held through a death moves again <= 0.3 s after the respawn", deathRun.deaths + (deathRun.falls ?? 0) === 1 && deathRun.movedAfterMs !== null && deathRun.movedAfterMs <= 300, deathRun);

// C1 on the canvas itself: Rubik drawn standing at two spots (the camera is
// clamped at the level start), the frames diffed: his drawn feet and body
// against the collider (feet support +-11 px, box 40 x 52).
// The frame diff needs a plain, grey backdrop behind Rubik: earlier checks cleared
// levels, and the forest regains colour with progress (a dither now, whose dark
// pixels can hide the left foot from a colour diff), so progress is reset first.
// Dust and squash are random world effects: the check measures the sprite, so it
// runs with reduced motion, which draws neither.
await page.emulateMedia({ reducedMotion: "reduce" });
const drawn = await page.evaluate(() => {
  const g = window.__game,
    canvas = document.getElementById("game"),
    ctx = canvas.getContext("2d"),
    out = {};
  g.resetSave();
  g.startLevel("1-1");
  g.setManual(true);
  const grab = (cx, dir) => {
    for (let i = 0; i < 2; i++) {
      Object.assign(g.model.player, { x: cx - 20, y: 12 * 32 - 52, vx: 0, vy: 0, grounded: true, direction: dir, grace: 0, landed: 0 });
      g.step(1 / 120, {}, { render: i === 1 });
    }
    return { img: ctx.getImageData(0, 0, canvas.width, canvas.height), cam: g.getState().camera };
  };
  for (const dir of [1, -1]) {
    const a = grab(300, dir),
      b = grab(200, dir),
      k = canvas.width / 960,
      rows = {};
    for (let y = 0; y < a.img.height; y++)
      for (let x = 0; x < canvas.width; x++) {
        const i = (y * canvas.width + x) * 4,
          d = Math.abs(a.img.data[i] - b.img.data[i]) + Math.abs(a.img.data[i + 1] - b.img.data[i + 1]) + Math.abs(a.img.data[i + 2] - b.img.data[i + 2]);
        const wx = x / k + a.cam.x;
        if (d > 30 && Math.abs(wx - 300) < 40) (rows[Math.round(y / k + a.cam.y)] ||= []).push(wx);
      }
    const ys = Object.keys(rows).map(Number).sort((p, q) => p - q),
      bottom = ys.at(-1),
      feet = [bottom, bottom - 1, bottom - 2, bottom - 3].flatMap((y) => rows[y] || []),
      all = ys.flatMap((y) => rows[y]);
    out[dir > 0 ? "right" : "left"] = { feetLine: bottom + 1, feet: [Math.min(...feet) - 300, Math.max(...feet) + 1 - 300], body: [Math.min(...all) - 300, Math.max(...all) + 1 - 300], head: ys[0] };
  }
  g.setManual(false);
  return out;
});
await page.emulateMedia({ reducedMotion: "no-preference" });
check(
  "C1 canvas: feet line on the floor, drawn feet within 2 px of the +-11 support, box inside the body",
  Object.values(drawn).every((d) => d.feetLine === 384 && Math.abs(d.feet[0] + 11) <= 2 && Math.abs(d.feet[1] - 11) <= 2 && d.body[0] <= -20 && d.body[1] >= 20 && d.head <= 384 - 52),
  drawn,
);

// E2: white's unspent air jump is drawn under Rubik; dash charge dims him.
const crop = async (name, cx, cy) => {
  if (!shots) return;
  mkdirSync(shots, { recursive: true });
  const canvas = await page.$("#game"),
    box = await canvas.boundingBox(),
    s = box.width / 960;
  await page.screenshot({ path: path.join(shots, `${name}.png`), clip: { x: box.x + (cx - 70) * s, y: box.y + (cy - 100) * s, width: 140 * s, height: 140 * s } });
};
const pose = (id, setup) =>
  page.evaluate(
    ([id, setup]) => {
      const g = window.__game;
      g.startLevel(id);
      g.setManual(true);
      for (const c of g.model.guards) c.state = "away";
      g.step(0.1, {});
      Object.assign(g.model.player, setup);
      g.step(1 / 120, {});
      const s = g.getState();
      return { cx: s.player.x + 20 - s.camera.x, feet: s.player.y + 52 - s.camera.y, airJumped: s.player.airJumped, charge: s.player.dashCharge };
    },
    [id, setup],
  );
let p = await pose("1-1", { x: 64 * 32 - 20, y: 14 * 32 - 52 - 70, vy: -100, grounded: false, airJumped: false, grace: 0 });
await crop("e2-white-air-jump-ready", p.cx, p.feet);
p = await pose("1-1", { x: 64 * 32 - 20, y: 14 * 32 - 52 - 70, vy: -100, grounded: false, airJumped: true, grace: 0 });
await crop("e2-white-air-jump-spent", p.cx, p.feet);
p = await pose("1-4", { x: 14 * 32 - 20, y: 16 * 32 - 52 - 70, vy: -100, grounded: false, dashCharge: 0, color: "green", grace: 0 });
await crop("e2-dash-spent", p.cx, p.feet);
// C1: standing at a lip edge (the feet's edge on it): the drawn feet stand on it.
p = await pose("1-1", { x: 13 * 32 + 10 - 20, y: 12 * 32 - 52, vx: 0, grounded: true, grace: 0, direction: 1 });
await crop("c1-feet-at-the-lip", p.cx, p.feet);
const lipState = await state();
check("C1 at the lip the feet still stand (support = drawn feet)", lipState.player.grounded, { cx: lipState.player.x + 20, edge: 416 });
await page.evaluate(() => window.__game.setManual(false));

// E3: lookahead at run speed, landscape and phone portrait.
const lookahead = async () => {
  await start("1-1");
  await page.waitForTimeout(200);
  await page.keyboard.down("ArrowRight");
  await page.waitForTimeout(1400);
  const r = await page.evaluate(() => {
    const s = window.__game.getState(),
      view = document.getElementById("view"),
      canvas = document.getElementById("game"),
      inset = canvas.clientWidth > view.clientWidth + 1 ? ((canvas.clientWidth - view.clientWidth) / 2) * (960 / canvas.clientWidth) : 0;
    return { ahead: s.camera.x + 960 - inset - (s.player.x + 40), vx: s.player.vx };
  });
  await page.keyboard.up("ArrowRight");
  return { px: Math.round(r.ahead), seconds: +(r.ahead / 330).toFixed(2) };
};
const landscape = await lookahead();
await page.setViewportSize({ width: 390, height: 844 });
await page.waitForTimeout(300);
const portrait = await lookahead();
await page.setViewportSize({ width: 960, height: 640 });
check("E3 lookahead at run speed >= 1.5 s (landscape, 390x844 portrait)", landscape.seconds >= 1.5 && portrait.seconds >= 1.5, { landscape, portrait });

check("no console errors or failed requests", errors.length === 0, errors);
await browser.close();
console.log(JSON.stringify({ url, failures, report }, null, 1));
process.exitCode = failures.length ? 1 : 0;
