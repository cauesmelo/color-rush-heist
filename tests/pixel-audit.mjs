/** Pixel-purity audit for every non-world pixel of Color Rush Heist (dev tool,
 * not part of `npm test`: it needs Chrome through Playwright, e.g. the
 * workspace's common/node_modules). See UI_STYLE.md for the rules it checks.
 *
 *   npm run dev &                      # or node serve.mjs --port 4501
 *   npm run audit:pixels -- http://127.0.0.1:4174/ --out <dir> [--label new] [--only title,results] [--dpr 1,2]
 *
 * To judge another build with the same rectangles (the pre-pixel UI, say), pass
 * its URL and `--world <url of a build with __game.worldColours()>`.
 *
 * It drives the real game in Chrome through every screen and state (boot, title,
 * story, map and its menu, HUD, hints, bubbles, pause, level card, GET card,
 * REVERSE, hit flash, results, world clear, ending, keyboard focus), takes a screenshot of each at device-pixel ratio 1 and 2 and
 * measures the UI regions of that screenshot. Per region:
 *
 *   offPalette    pixels whose colour is neither a UI palette colour (pixel-ui.mjs
 *                 PAL) nor a colour that exists in the original art files. Anti-
 *                 aliasing, alpha blends and soft shadows all land here.
 *   intermediate  the off-palette pixels whose colour also lies between two of
 *                 their neighbours' colours: the signature of anti-aliasing,
 *                 alpha blends and soft shadows (as opposed to a flat wrong
 *                 colour). Checked on the canvas pixel lattice (DOM: device
 *                 pixels).
 *   grid          2x2 art-pixel blocks (aligned to the stage) that are not one
 *                 colour. UI drawn on the pixel grid has none; rotation, arcs,
 *                 half-size text and fractional scaling do. Only regions marked
 *                 `opaque` (a UI plate with no world under it) are held to it.
 *
 * Whole-stage checks: the stage is an integer number of device pixels per
 * canvas pixel (`scale`), and no k x k block of the canvas is blurred (`blur`,
 * which would reveal browser smoothing of a non-integer scale).
 *
 * Region definitions are shared by every build, so the same rectangles judge
 * the old and the new UI; DOM regions are measured from the live elements.
 * The exclusions (the original art itself) are listed in the report. Exit code
 * 1 when any region fails. */
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { readPng } from "./png.mjs";
import { ROUTES } from "./routes.mjs";
import { PAL } from "../pixel-ui.mjs";

const args = process.argv.slice(2);
const baseUrl = args.find((a) => a.startsWith("http")) || "http://127.0.0.1:4174/";
const opt = (name, fallback) => (args.includes(`--${name}`) ? args[args.indexOf(`--${name}`) + 1] : fallback);
const outDir = path.resolve(opt("out", "pixel-audit-out"));
const label = opt("label", "run");
const only = (opt("only", "") || "").split(",").filter(Boolean);
const dprs = (opt("dpr", "1,2") || "1,2").split(",").map(Number);
// --viewport 2000x1200 audits a window big enough for a 2x or 3x surface (whole-number scaling).
const [vw, vh] = (opt("viewport", "1280x720") || "1280x720").split("x").map(Number);
mkdirSync(outDir, { recursive: true });

const require = createRequire(process.env.PLAYWRIGHT_FROM || new URL("../../common/package.json", import.meta.url).pathname);
const { chromium } = require("@playwright/test");

const W = 960,
  H = 540;
const rgb = (r, g, b) => (r << 16) | (g << 8) | b;
const hex = (s) => parseInt(s.slice(1), 16);

// ------------------------------------------------------------ allowed colours --
/** The UI palette plus every opaque colour that exists in the shipped art, so a
 * UI plate drawn over the world (or the art itself under a dithered scrim)
 * never counts against the UI. The art-derived world tints (colorized forest,
 * cone gradients) are not here: regions are chosen where the plain art shows. */
function artColours(dir) {
  const set = new Set();
  const walk = (d) => {
    for (const entry of readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, entry.name);
      if (entry.isDirectory()) {
        if (entry.name !== "player") walk(p); // the withheld third-party pack is not shipped
      } else if (entry.name.endsWith(".png")) {
        try {
          const { rgba, width, height } = readPng(p);
          for (let i = 0; i < width * height; i++) if (rgba[i * 4 + 3] === 255) set.add(rgb(rgba[i * 4], rgba[i * 4 + 1], rgba[i * 4 + 2]));
        } catch {
          /* an unsupported layout simply contributes nothing */
        }
      }
    }
  };
  walk(dir);
  return set;
}
const ART = artColours(new URL("../assets", import.meta.url).pathname);
const PALETTE = new Set(Object.values(PAL).map(hex));
const ALLOWED = new Set([...ART, ...PALETTE]);
/** The backdrop's per-level time-of-day tints (game.mjs TINTS) are multiplied over
 * the world only; the world colours may appear in each of them. */
const TINTS = [0xa9b6cf, 0xf3c39b, 0x8d88b8];
function addTinted(colours) {
  for (const c of colours)
    for (const t of TINTS)
      for (let mask = 0; mask < 8; mask++) {
        let out = 0;
        for (let ch = 0; ch < 3; ch++) {
          const shift = 16 - ch * 8,
            v = ((c >> shift) & 255) * ((t >> shift) & 255) / 255;
          out |= (mask & (1 << ch) ? Math.floor(v) : Math.round(v)) << shift;
        }
        ALLOWED.add(out);
      }
}

// ------------------------------------------------------------------- analysis --
/** Colours of a lattice over `rect` (device px), `step` apart, from the origin. */
function sample(png, ox, oy, step, rect) {
  const [x0, y0, x1, y1] = rect;
  const cols = Math.floor((x1 - x0) / step),
    rows = Math.floor((y1 - y0) / step),
    grid = new Int32Array(cols * rows);
  for (let j = 0; j < rows; j++)
    for (let i = 0; i < cols; i++) {
      const x = Math.min(png.width - 1, x0 + i * step),
        y = Math.min(png.height - 1, y0 + j * step),
        p = (y * png.width + x) * 4;
      grid[j * cols + i] = rgb(png.rgba[p], png.rgba[p + 1], png.rgba[p + 2]);
    }
  return { grid, cols, rows };
}
const dist = (a, b) => Math.hypot((a >> 16) - (b >> 16), ((a >> 8) & 255) - ((b >> 8) & 255), (a & 255) - (b & 255));
function between(c, a, b) {
  // c lies on the segment a-b (within 3 levels), strictly inside it.
  const ca = [(c >> 16) - (a >> 16), ((c >> 8) & 255) - ((a >> 8) & 255), (c & 255) - (a & 255)],
    ba = [(b >> 16) - (a >> 16), ((b >> 8) & 255) - ((a >> 8) & 255), (b & 255) - (a & 255)],
    len = ba[0] ** 2 + ba[1] ** 2 + ba[2] ** 2;
  if (len < 60) return false;
  const t = (ca[0] * ba[0] + ca[1] * ba[1] + ca[2] * ba[2]) / len;
  if (t < 0.08 || t > 0.92) return false;
  return Math.hypot(ca[0] - t * ba[0], ca[1] - t * ba[1], ca[2] - t * ba[2]) < 3.5;
}
/** Analyse one rectangle. `rect` is [x0,y0,x1,y1] in device px; `origin` is the
 * stage's device-px origin; `k` device px per canvas px (the canvas lattice);
 * `step` the lattice for the intermediate test. */
function analyse(png, origin, k, rect, { step, block, opaque }) {
  const x0 = Math.max(0, rect[0]),
    y0 = Math.max(0, rect[1]),
    x1 = Math.min(png.width, rect[2]),
    y1 = Math.min(png.height, rect[3]);
  // Align the lattice to the stage origin so canvas pixels are sampled whole.
  const sx = x0 + ((((origin[0] - x0) % step) + step) % step),
    sy = y0 + ((((origin[1] - y0) % step) + step) % step);
  const { grid, cols, rows } = sample(png, origin[0], origin[1], step, [sx, sy, x1, y1]);
  const off = new Map();
  let offPixels = 0,
    intermediate = 0;
  for (let i = 0; i < grid.length; i++)
    if (!ALLOWED.has(grid[i])) {
      offPixels++;
      off.set(grid[i], (off.get(grid[i]) || 0) + 1);
    }
  for (let j = 1; j < rows - 1; j++)
    for (let i = 1; i < cols - 1; i++) {
      const c = grid[j * cols + i];
      // Only colours the palette does not own can be blends: a grey that sits
      // between black and white is a legitimate pixel-art colour, not AA.
      if (ALLOWED.has(c)) continue;
      const n = [grid[j * cols + i - 1], grid[j * cols + i + 1], grid[(j - 1) * cols + i], grid[(j + 1) * cols + i]].filter((v) => v !== c);
      let hit = false;
      for (let a = 0; a < n.length && !hit; a++) for (let b = a + 1; b < n.length && !hit; b++) if (n[a] !== n[b] && between(c, n[a], n[b])) hit = true;
      if (hit) intermediate++;
    }
  // Art-pixel blocks: `block` lattice cells per side, aligned to the stage origin.
  let blocks = 0,
    bad = 0;
  const badAt = [];
  if (opaque) {
    const bx0 = Math.ceil((sx - origin[0]) / (step * block)) * step * block + origin[0],
      by0 = Math.ceil((sy - origin[1]) / (step * block)) * step * block + origin[1];
    const lat = sample(png, origin[0], origin[1], step, [bx0, by0, x1, y1]);
    for (let j = 0; j + block <= lat.rows; j += block)
      for (let i = 0; i + block <= lat.cols; i += block) {
        const c = lat.grid[j * lat.cols + i];
        let same = true;
        for (let dj = 0; dj < block && same; dj++) for (let di = 0; di < block; di++) if (lat.grid[(j + dj) * lat.cols + i + di] !== c) same = false;
        blocks++;
        if (!same) {
          bad++;
          if (badAt.length < 6) badAt.push([Math.round((bx0 + i * step - origin[0]) / step), Math.round((by0 + j * step - origin[1]) / step)]);
        }
      }
  }
  const worst = [...off.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4).map(([c, n]) => `#${c.toString(16).padStart(6, "0")}x${n}`);
  return { pixels: grid.length, offPalette: offPixels, offColours: off.size, worstOff: worst, intermediate, blocks, gridBad: bad, badAt };
}

/** Whole-canvas blur check: every k x k device-pixel block of the canvas must be
 * one colour when k > 1 (an integer scale of a pixel image). Anti-aliased DOM text,
 * a fractional scale or a smoothed image breaks it. Returns {blocks, bad}. */
function blurBlocks(png, origin, k, w, h) {
  let blocks = 0,
    bad = 0;
  for (let by = 0; by < h; by++)
    for (let bx = 0; bx < w; bx++) {
      const x0 = origin[0] + bx * k,
        y0 = origin[1] + by * k;
      if (x0 + k > png.width || y0 + k > png.height || x0 < 0 || y0 < 0) continue;
      const first = (y0 * png.width + x0) * 4;
      let same = true;
      for (let dy = 0; dy < k && same; dy++)
        for (let dx = 0; dx < k; dx++) {
          const i = ((y0 + dy) * png.width + x0 + dx) * 4;
          if (png.rgba[i] !== png.rgba[first] || png.rgba[i + 1] !== png.rgba[first + 1] || png.rgba[i + 2] !== png.rgba[first + 2]) {
            same = false;
            break;
          }
        }
      blocks++;
      if (!same) bad++;
    }
  return { blocks, bad };
}

// -------------------------------------------------------------- state driving --
const save = (levels = {}, extra = {}) =>
  JSON.stringify({
    v: 2,
    last: extra.last || "1-1",
    comicSeen: extra.comicSeen ?? true,
    migratedFrom: null,
    hints: {},
    levels,
    // Music off: no 75 MB decode on a loaded machine; motion on (full effects).
    settings: { sfx: false, music: false, timer: false, slowSpotting: false, reduceMotion: false, ...(extra.settings || {}) },
  });
const rec = (o = {}) => ({ clear: true, best: 61.4, stickers: [1, 2], unseen: false, takedown: false, takedownBest: 0, quick: false, chain: false, chainBest: 0, color: "white", ...o });
const MID = save(
  { "1-1": rec({ stickers: [1, 2, 3], color: "white" }), "1-2": rec({ stickers: [1], color: "green", chain: true, chainBest: 4 }), "1-3": rec({ stickers: [1, 2], unseen: true, color: "green" }) },
  { last: "1-4" },
);
const DONE = save(
  Object.fromEntries(["1-1", "1-2", "1-3", "1-4", "1-5", "1-6"].map((id) => [id, rec({ stickers: [1, 2, 3], unseen: true, takedown: id >= "1-5", takedownBest: 6, quick: id === "1-6", chain: id === "1-2", chainBest: 5, color: id === "1-6" ? "red" : "green" })])),
  { last: "1-6" },
);

class Driver {
  constructor(browser, dpr) {
    this.browser = browser;
    this.dpr = dpr;
  }
  async open({ saveJson = null, viewport = { width: vw, height: vh }, mobile = false, query = "", delayArt = 0 } = {}) {
    if (this.context) await this.context.close();
    this.context = await this.browser.newContext({ viewport, deviceScaleFactor: mobile ? 3 : this.dpr, isMobile: mobile, hasTouch: mobile });
    // Deterministic time: the page's clock (rAF, timers, performance.now) only
    // moves when wait() runs it, so "0.48 s into the level card" is exact. It is
    // installed before the page exists so the game's own frame loop is born on it
    // (installing afterwards races a real rAF already in flight). The boot state
    // is the one exception: it needs real time for its delayed art request.
    this.frozen = !delayArt;
    if (this.frozen) {
      await this.context.clock.install({ time: new Date() });
      await this.context.clock.pauseAt(new Date(Date.now() + 1000));
    }
    this.page = await this.context.newPage();
    this.errors = [];
    this.page.on("pageerror", (e) => this.errors.push(String(e)));
    this.page.on("console", (m) => m.type() === "error" && this.errors.push(m.text()));
    // Route playback one tick at a time: an entry's pulses (jump, dash, colour)
    // fire on its first tick only; directions are held for the whole entry.
    await this.page.addInitScript(() => {
      window.__tickRoute = (route, stop) => {
        const g = window.__game;
        for (const [s, input] of route) {
          const n = Math.max(1, Math.round(s * 120));
          for (let i = 0; i < n; i++) {
            g.step(1 / 120, i === 0 ? input : { left: input.left, right: input.right }, { render: false });
            if (stop(g.getState())) return true;
          }
        }
        return false;
      };
    });
    if (saveJson) await this.page.addInitScript((s) => localStorage.setItem("color-rush-heist:v2:save", s), saveJson);
    if (delayArt) await this.page.route("**/assets/title_screen.png", async (route) => (await new Promise((r) => setTimeout(r, delayArt)), route.continue()));
    // The held title art also holds the load event, so the boot state only waits for the response.
    await this.page.goto(baseUrl + query, { waitUntil: delayArt ? "commit" : "load" });
    if (delayArt) await this.page.waitForFunction(() => window.__game);
    if (this.frozen) {
      for (let i = 0; i < 600; i++) {
        if (await this.page.evaluate(() => !!window.__game?.getState().assetsReady)) break;
        await this.page.clock.runFor(50);
        await new Promise((r) => setTimeout(r, 25));
      }
      await this.page.clock.runFor(100);
    }
    return this.page;
  }
  ev(fn, arg) {
    return this.page.evaluate(fn, arg);
  }
  wait(ms) {
    return this.frozen ? this.page.clock.runFor(ms) : this.page.waitForTimeout(ms);
  }
  screen() {
    return this.ev(() => window.__game.getState().screen);
  }
  /** Play a route to its end in QA stepping; leaves the game on its win. */
  async winLevel(id, kind = "baseline") {
    await this.ev(
      ([id, route]) => {
        const g = window.__game;
        g.setManual(true);
        g.startLevel(id);
        for (const [s, input] of route) g.step(s, input, { render: false });
        g.step(0.05, {});
        g.setManual(false);
      },
      [id, ROUTES[id][kind]],
    );
  }
  async waitScreen(name, ms = 8000) {
    for (let t = 0; t < ms; t += 100) {
      if ((await this.screen()) === name) return;
      await this.wait(100);
    }
    throw new Error(`never reached the ${name} screen (on ${await this.screen()})`);
  }
}

/** Rectangles are canvas px [x, y, w, h]; `opaque` regions are UI plates with no
 * world under them. `dom` regions come from live elements (CSS selector). */
const R = (name, x, y, w, h, opaque = false) => ({ name, rect: [x, y, w, h], opaque });
const D = (name, selector, opaque = true, skip = null) => ({ name, dom: selector, opaque, skip });
const FULL = [0, 0, W, H];

const STATES = [
  {
    id: "boot",
    async run(d) {
      await d.open({ delayArt: 7000, query: "" });
      await d.wait(300);
      if ((await d.screen()) !== "boot") throw new Error("the boot screen was not on screen");
      return { regions: [R("spinning cube", 400, 220, 160, 100)] };
    },
  },
  {
    id: "title",
    async run(d) {
      await d.open({ saveJson: save({}, { comicSeen: false }) });
      return { regions: [D("version tag", "#version", true), D("credits button", "#credits-btn", true), D("music button", "#music"), D("fullscreen button", ".itch-fullscreen")] };
    },
  },
  {
    id: "story",
    async run(d) {
      await d.open({ saveJson: save({}, { comicSeen: false }) });
      await d.page.keyboard.press("Space");
      await d.wait(6200); // panels 1 and 2 are up, the skip arrow is drawn
      return { regions: [R("skip arrow", 850, 490, 110, 50)] };
    },
  },
  {
    id: "story-iris",
    async run(d) {
      await d.open({ saveJson: save({}, { comicSeen: false }) });
      await d.page.keyboard.press("Space");
      await d.wait(8450); // the closing Rubik-face iris, mid-wipe
      return { regions: [R("iris wipe over the comic page (whole stage)", ...FULL, true)] };
    },
  },
  {
    id: "map-fresh",
    async run(d) {
      await d.open({ saveJson: save({}, { last: "1-1" }) });
      await d.page.keyboard.press("Space"); // title -> map
      await d.wait(1200); // the opening iris is done
      await d.page.keyboard.press("ArrowRight"); // 1-2 is locked: the prompt shows
      await d.wait(120);
      return {
        regions: [
          R("map title", 300, 14, 360, 96),
          R("form cards", 0, 0, 120, 84),
          R("sticker total plate", W - 150, 48, 140, 50, true),
          R("bottom panel", 150, 466, 660, 72, true),
          R("node row", 60, 290, 840, 190),
        ],
      };
    },
  },
  {
    id: "map-progress",
    async run(d) {
      await d.open({ saveJson: MID });
      await d.page.keyboard.press("Space");
      await d.wait(1200);
      return {
        regions: [
          R("form cards", 0, 0, 160, 84),
          R("sticker total plate", W - 150, 48, 140, 50, true),
          R("bottom panel", 150, 466, 660, 72, true),
          R("nodes 1-3", 60, 290, 440, 190),
        ],
      };
    },
  },
  {
    id: "map-done",
    async run(d) {
      await d.open({ saveJson: DONE });
      await d.page.keyboard.press("Space");
      await d.wait(1200);
      return { regions: [R("bottom panel", 150, 466, 660, 72, true), R("nodes (3/3 rims, seals)", 60, 290, 840, 190)] };
    },
  },
  ...["menu", "options", "controls", "art", "credits", "reset"].map((panel) => ({
    id: "map-menu-" + panel,
    async run(d) {
      await d.open({ saveJson: MID });
      await d.page.keyboard.press("Space");
      await d.wait(1200);
      await d.page.keyboard.press("Escape");
      await d.wait(300);
      if (panel !== "menu") {
        await d.ev((n) => document.querySelector(`[data-show="${n}"]`).click(), panel);
        await d.wait(200);
      }
      return { regions: [D("pause card", "#pause-card", false), D("panel buttons", "#pause-card button", true)] };
    },
  })),
  {
    id: "play-1-1",
    async run(d) {
      await d.open({ saveJson: save({}) });
      await d.ev(() => {
        const g = window.__game;
        g.startLevel("1-1");
        g.model.hint = "airjump";
        g.model.hintAge = 5;
        g.step(0.2, {});
      });
      await d.wait(150);
      return { regions: [R("form card", 12, 10, 50, 66), R("sticker strip plate", 854, 62, 90, 32, true), R("hearts", 12, 98, 110, 34)] };
    },
  },
  {
    id: "hint-keys",
    async run(d) {
      await d.open({ saveJson: save({}) });
      await d.ev(() => {
        const g = window.__game;
        g.startLevel("1-1");
        g.model.hint = "airjump";
        g.model.hintAge = 5;
        g.step(0.2, {});
      });
      await d.wait(100);
      const box = await d.ev(() => {
        const g = window.__game.getState();
        const cam = g.camera;
        return { x: g.player.x - cam.x, y: g.player.y - cam.y };
      });
      return { regions: [R("hint bubble", Math.max(0, box.x + 20 - 110), Math.max(0, box.y - 84), 220, 64)] };
    },
  },
  {
    id: "play-1-4-hud",
    async run(d) {
      await d.open({ saveJson: save({ "1-1": rec(), "1-2": rec({ color: "green" }), "1-3": rec() }, { last: "1-4" }) });
      await d.ev(() => {
        const g = window.__game;
        g.setManual(true);
        g.startLevel("1-4");
        g.model.dashUnlocked = true;
        g.model.unlocked.red = true;
        g.model.stickers.forEach((s, i) => (s.collected = i === 0));
        g.model.stickers[1].owned = true;
        g.step(0.1, {});
        // One heart lost and a live stomp chain of 3 (set last: a chain decays).
        Object.assign(g.model.player, { hp: 2, chain: 3 });
        g.model.chainTimer = 5;
        g.step(0, {});
      });
      await d.wait(100);
      return { regions: [R("form cards and dash pad", 12, 10, 190, 62), R("hearts", 12, 98, 110, 34), R("chain meter plate", 18, 136, 114, 42, true), R("sticker strip plate", 854, 62, 90, 32, true)] };
    },
  },
  {
    id: "play-1-5-bubbles",
    async run(d) {
      await d.open({ saveJson: save({ "1-1": rec(), "1-2": rec({ color: "green" }), "1-3": rec(), "1-4": rec() }, { last: "1-5" }) });
      const boxes = await d.ev(() => {
        const g = window.__game;
        g.setManual(true);
        g.startLevel("1-5");
        const m = g.model;
        // Bring Rubik to the first cards, then force the awareness cues on three of them.
        const cards = m.guards.slice(0, 4);
        Object.assign(m.player, { x: cards[0].x - 330, vx: 0 });
        g.step(0.4, {});
        const set = ["suspect", "windup", "alert", "recover"];
        cards.forEach((c, i) => {
          Object.assign(c, { state: set[i], timer: 0.3, x: m.player.x + 160 + i * 120 });
        });
        g.step(0, {});
        const s = g.getState();
        return cards.map((c) => ({ x: s.guards.find((q) => q.id === c.id).x - s.camera.x, y: s.guards.find((q) => q.id === c.id).floor - s.camera.y }));
      });
      // One region per card: its bubble or marker, above the head. The cone and
      // the strike strip are world effects (alpha textures), left out.
      return { regions: boxes.map((b, i) => R(`${["? bubble", "!! bubble", "! bubble", "stomp marker"][i]}`, Math.max(0, b.x - 36), Math.max(0, b.y - 160), 72, i === 3 ? 100 : 74)) };
    },
  },
  {
    id: "pause",
    async run(d) {
      await d.open({ saveJson: save({}) });
      await d.ev(() => {
        window.__game.startLevel("1-1");
        window.__game.togglePause(true);
      });
      await d.wait(250);
      return { regions: [D("pause card", "#pause-card", false), D("pause buttons", "#pause-card button", true), D("pause icon", "#pause", true)] };
    },
  },
  {
    id: "level-card",
    async run(d) {
      await d.open({ saveJson: save({ "1-1": rec({ stickers: [1, 3] }) }, { last: "1-1" }) });
      await d.page.keyboard.press("Space"); // title -> map
      await d.wait(1200);
      await d.page.keyboard.press("Enter"); // enter 1-1: the level card
      await d.wait(480);
      return { regions: [R("level card", 332, 146, 298, 190, true), R("scrim over the sky", 300, 16, 420, 100)] };
    },
  },
  {
    id: "get-card",
    async run(d) {
      await d.open({ saveJson: save({ "1-1": rec(), "1-2": rec({ color: "green" }), "1-3": rec() }, { last: "1-4" }) });
      await d.ev(
        ([route]) => {
          const g = window.__game;
          g.setManual(true);
          g.startLevel("1-4");
          // The baseline route picks up the storm swirl in its first seconds.
          // One tick at a time so the 1.2 s card is caught while it is up.
          window.__tickRoute(route, (st) => !!st.getCard);
          g.step(0.05, {});
        },
        [ROUTES["1-4"].baseline],
      );
      await d.wait(220);
      return { regions: [R("GET card", 262, 114, 438, 270, true), R("scrim over the sky", 300, 16, 420, 84)], note: await d.ev(() => window.__game.getState().getCard) };
    },
  },
  {
    id: "reverse",
    async run(d) {
      await d.open({ saveJson: save({ "1-1": rec(), "1-2": rec({ color: "green" }), "1-3": rec(), "1-4": rec(), "1-5": rec() }, { last: "1-6" }) });
      await d.ev(
        ([route]) => {
          const g = window.__game;
          g.setManual(true);
          g.startLevel("1-6");
          window.__tickRoute(route, (st) => st.stolen);
          // The RED GET card (1.3 s) comes first, then REVERSE sweeps in.
          g.step(2.3, {});
          g.step(0.45, {});
        },
        [ROUTES["1-6"].baseline],
      );
      await d.wait(150);
      return { regions: [R("REVERSE card and goal text (lower half)", 0, 300, 960, 240)] };
    },
  },
  {
    id: "getaway-hud",
    async run(d) {
      await d.open({ saveJson: save({ "1-1": rec(), "1-2": rec({ color: "green" }), "1-3": rec(), "1-4": rec(), "1-5": rec() }, { last: "1-6" }), });
      await d.ev(
        ([route]) => {
          const g = window.__game;
          g.setManual(true);
          g.startLevel("1-6");
          window.__tickRoute(route, (st) => st.stolen);
          g.step(4, {});
          g.step(4, {}); // GET and REVERSE are gone: HUD seal, home arrow
        },
        [ROUTES["1-6"].baseline],
      );
      await d.wait(100);
      return { regions: [R("form cards, keys and hearts", 12, 10, 190, 120), R("Quick seal", 850, 112, 110, 44), R("home arrow plate", 12, 244, 66, 50, true)] };
    },
  },
  {
    id: "hit-flash",
    async run(d) {
      await d.open({ saveJson: save({ "1-1": rec(), "1-2": rec({ color: "green" }), "1-3": rec(), "1-4": rec() }, { last: "1-5" }) });
      await d.ev(() => {
        const g = window.__game,
          m = () => g.model,
          card = () => m().guards.find((c) => c.id === "teacher");
        g.setManual(true);
        g.startLevel("1-5");
        for (let i = 0; i < 2400 && card().state !== "windup"; i++) g.step(1 / 120, { right: m().player.x < 700 }, { render: false });
        for (let i = 0; i < 600 && m().player.hp === 3; i++) g.step(1 / 120, {}, { render: false });
        g.step(0.06, {});
      });
      await d.wait(60);
      return { regions: [R("screen-edge flash (top edge)", 0, 0, W, 60), R("hearts", 0, 76, 130, 48), R("screen-edge flash (left)", 0, 120, 60, 300)] };
    },
  },
  {
    id: "results-stamps",
    async run(d) {
      await d.open({ saveJson: save({ "1-1": rec(), "1-2": rec({ color: "green" }), "1-3": rec(), "1-4": rec() }, { last: "1-5" }) });
      await d.winLevel("1-5", "takedown");
      await d.waitScreen("results");
      await d.wait(1700); // stickers have landed
      return { regions: [R("results card", 160, 40, 640, 410, false), D("results buttons", "#results-actions button", true)] };
    },
  },
  {
    id: "results-plain",
    async run(d) {
      await d.open({ saveJson: save({ "1-1": rec(), "1-2": rec({ color: "green" }) }, { last: "1-3" }) });
      await d.winLevel("1-3", "baseline");
      await d.waitScreen("results");
      await d.wait(1700);
      return { regions: [R("results card", 160, 40, 640, 410, false), D("results buttons", "#results-actions button", true)] };
    },
  },
  {
    id: "results-assisted",
    async run(d) {
      await d.open({ saveJson: save({ "1-1": rec(), "1-2": rec({ color: "green" }), "1-3": rec(), "1-4": rec() }, { last: "1-5", settings: { slowSpotting: true } }) });
      await d.winLevel("1-5", "takedown");
      await d.waitScreen("results");
      await d.wait(1700);
      return { regions: [R("results card (stamps unearned, assist note)", 160, 40, 640, 410, false)] };
    },
  },
  {
    id: "world-clear",
    async run(d) {
      await d.open({ saveJson: save(Object.fromEntries(["1-1", "1-2", "1-3", "1-4", "1-5"].map((id) => [id, rec({ stickers: [1, 2, 3], unseen: true })])), { last: "1-6" }) });
      await d.winLevel("1-6", "mastery");
      await d.waitScreen("world");
      await d.wait(2600);
      return { regions: [R("world-clear card", 100, 10, 760, 430, false), D("buttons", "#results-actions button", true)] };
    },
  },
  // The ending after the vault level: three closing pages (3.6 s, 4.6 s, 5.2 s), then the
  // six credit cards. Captions are flat comic boxes (opaque); the wave, the title art and
  // the Rubiks are the world (palette check only).
  ...[
    ["ending-home", 1.6, [R("top caption", 24, 20, 280, 62, true), R("short caption", 792, 300, 144, 40, true), R("hint and the dull forest (whole frame)", ...FULL)]],
    ["ending-colors", 3.6 + 2.0, [R("top caption", 24, 20, 280, 84, true), R("short caption", 756, 300, 180, 40, true), R("colour wave: forest, logo, Rubik (whole frame)", ...FULL)]],
    ["ending-end", 3.6 + 4.6 + 2.2, [R("top caption", 24, 20, 280, 84, true), R("original closing line in its frame", 192, 332, 576, 76, true), R("THE END and the three Rubiks", 300, 400, 360, 140), R("whole frame", ...FULL)]],
  ].map(([id, at, regions]) => ({
    id,
    async run(d) {
      await d.open({ saveJson: save(Object.fromEntries(["1-1", "1-2", "1-3", "1-4", "1-5"].map((k) => [k, rec({ stickers: [1, 2, 3] })])), { last: "1-6" }) });
      await d.winLevel("1-6", "mastery");
      await d.waitScreen("world");
      await d.wait(300);
      await d.ev(() => document.querySelector("#continue").click());
      await d.wait(Math.round(at * 1000));
      return { regions, note: await d.ev(() => window.__game.getState().reel?.id) };
    },
  })),
  // The credits from the title's button: the plate over the logo, then (below) the words
  // part way through a fade.
  ...[
    ["credits-card", 1.2, "game"],
    ["credits-names", 4.4 + 1.2, "original"],
  ].map(([id, at]) => ({
    id,
    async run(d) {
      await d.open({ saveJson: save({}) });
      await d.ev(() => window.__game.showCredits("title"));
      // The iris opens over the first 0.8 s, so 1.2 s is the first card at rest.
      await d.wait(Math.round(at * 1000));
      return { regions: [R("credit plate and its words", 200, 56, 560, 260, true), R("whole frame (art, Rubiks, hint, iris)", ...FULL)], note: await d.ev(() => window.__game.getState().reel?.id) };
    },
  })),
  {
    id: "credits-mid-card-fade",
    async run(d) {
      await d.open({ saveJson: save({}) });
      await d.ev(() => window.__game.showCredits("title"));
      await d.wait(4400 + 140); // a quarter into the second card: its words are at step 2
      return { regions: [R("credit plate and its words (step 2)", 200, 56, 560, 260, true)], note: await d.ev(() => window.__game.getState().reel?.id) };
    },
  },
  {
    id: "focus-credits",
    async run(d) {
      await d.open({ saveJson: save({}) });
      for (let i = 0; i < 4; i++) {
        await d.page.keyboard.press("Tab");
        if ((await d.ev(() => document.activeElement?.id)) === "credits-btn") break;
      }
      await d.wait(100);
      return { regions: [D("title buttons", "#credits-btn, #version", true), D("focused Credits button", "#credits-btn:focus-visible", true)] };
    },
  },
  {
    id: "focus-pause",
    async run(d) {
      await d.open({ saveJson: save({}) });
      await d.ev(() => {
        window.__game.startLevel("1-1");
        window.__game.togglePause(true);
      });
      await d.wait(200);
      await d.page.keyboard.press("ArrowDown");
      await d.page.keyboard.press("ArrowDown");
      await d.wait(100);
      return { regions: [D("pause card", "#pause-card", false), D("focused button", "#pause-card button:focus-visible", true)] };
    },
  },
  {
    id: "focus-results",
    async run(d) {
      await d.open({ saveJson: save({ "1-1": rec() }, { last: "1-2" }) });
      await d.winLevel("1-2", "baseline");
      await d.waitScreen("results");
      await d.wait(900);
      await d.page.keyboard.press("ArrowRight");
      await d.wait(100);
      return { regions: [D("results buttons", "#results-actions", true)] };
    },
  },
];

// Phones and touch layouts are out of scope (owner decision 2026-11-10): the
// touch pads keep working but are not audited, and nothing here emulates a phone.

// ------------------------------------------------------------------ main --
/** Original exhibits shown in the UI with their own colours (the credits' JPEG): painted
 * ink before anything is measured, so they are neither judged nor counted as blur. */
const EXHIBITS = [".relic"];
async function measure(d, shotPath, result) {
  let png = readPng(shotPath);
  const dprNow = await d.ev(() => devicePixelRatio);
  const holes = await d.ev((sels) => sels.flatMap((sel) => [...document.querySelectorAll(sel)].map((e) => {
    const r = e.getBoundingClientRect();
    return [r.x, r.y, r.x + r.width, r.y + r.height];
  })), EXHIBITS);
  if (holes.length) {
    png = { ...png, rgba: Uint8Array.from(png.rgba) };
    for (const [x0, y0, x1, y1] of holes)
      for (let y = Math.max(0, Math.floor(y0 * dprNow)); y < Math.min(png.height, Math.ceil(y1 * dprNow)); y++)
        for (let x = Math.max(0, Math.floor(x0 * dprNow)); x < Math.min(png.width, Math.ceil(x1 * dprNow)); x++) png.rgba.set([0, 0, 0, 255], (y * png.width + x) * 4);
  }
  const info = await d.ev(() => {
    const box = document.querySelector("#game").getBoundingClientRect();
    const stage = document.querySelector("#stage").getBoundingClientRect();
    const rects = {};
    return { canvas: { x: box.x, y: box.y, w: box.width, h: box.height }, stage: { x: stage.x, y: stage.y, w: stage.width, h: stage.height }, dpr: devicePixelRatio, rects };
  });
  const dpr = info.dpr;
  // The play view in portrait phones is cropped: the canvas can be wider than the stage.
  const origin = [Math.round(info.canvas.x * dpr), Math.round(info.canvas.y * dpr)],
    k = (info.canvas.w * dpr) / W;
  const scale = { cssWidth: +info.canvas.w.toFixed(2), deviceWidth: +(info.canvas.w * dpr).toFixed(2), k: +k.toFixed(4), integer: Math.abs(k - Math.round(k)) < 0.001 || (k < 1 && false) };
  result.scale = scale;
  if (scale.integer && k >= 2) result.blur = blurBlocks(png, origin, Math.round(k), W, H);
  const out = [];
  for (const region of result.regions) {
    let rects = [];
    if (region.dom) {
      rects = await d.ev((sel) => [...document.querySelectorAll(sel)].filter((e) => e.offsetParent !== null || getComputedStyle(e).position === "fixed").map((e) => {
        const r = e.getBoundingClientRect();
        return { x: r.x, y: r.y, w: r.width, h: r.height };
      }), region.dom);
      rects = rects.filter((r) => r.w > 0 && r.h > 0).map((r) => ({ css: true, ...r }));
    } else {
      const [x, y, w, h] = region.rect;
      rects = [{ css: false, x, y, w, h }];
    }
    if (!rects.length) {
      out.push({ name: region.name, missing: true });
      continue;
    }
    const shot = png;
    const agg = { name: region.name, dom: !!region.dom, opaque: region.opaque, pixels: 0, offPalette: 0, offColours: 0, intermediate: 0, blocks: 0, gridBad: 0, worstOff: [] };
    for (const r of rects) {
      const rect = r.css
        ? [Math.round(r.x * dpr), Math.round(r.y * dpr), Math.round((r.x + r.w) * dpr), Math.round((r.y + r.h) * dpr)]
        : [Math.round(origin[0] + r.x * k), Math.round(origin[1] + r.y * k), Math.round(origin[0] + (r.x + r.w) * k), Math.round(origin[1] + (r.y + r.h) * k)];
      // DOM: judged per device pixel (the font and borders are drawn by the browser).
      // Canvas: per canvas pixel (k device px), where the art grid is 2 canvas px.
      const step = r.css ? 1 : Math.max(1, Math.round(k)),
        block = r.css ? Math.max(1, Math.round(k)) * 2 : 2;
      const a = analyse(shot, origin, k, rect, { step, block, opaque: region.opaque });
      for (const key of ["pixels", "offPalette", "intermediate", "blocks", "gridBad"]) agg[key] += a[key];
      agg.offColours = Math.max(agg.offColours, a.offColours);
      agg.worstOff = agg.worstOff.length ? agg.worstOff : a.worstOff;
      agg.badAt = agg.badAt?.length ? agg.badAt : a.badAt;
    }
    agg.pass = agg.offPalette === 0 && agg.gridBad === 0;
    out.push(agg);
  }
  result.regions = out;
}

const browser = await chromium.launch({ channel: "chrome" });
// The runtime-derived world colours come from the build that exposes them
// (--world <url>, default the audited one): the derivation code is unchanged
// between the old and the new UI, so the same set judges both.
{
  const worldUrl = opt("world", baseUrl),
    ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } }),
    page = await ctx.newPage();
  await page.goto(worldUrl);
  await page.waitForFunction(() => window.__game?.getState().assetsReady, null, { timeout: 30000 });
  const colours = await page.evaluate(() => window.__game.worldColours?.());
  if (!colours) throw new Error(`${worldUrl} has no __game.worldColours(); pass --world <url of a build that does>`);
  for (const c of colours) ALLOWED.add(c);
  addTinted([...ALLOWED]);
  await ctx.close();
}
const report = { label, baseUrl, when: new Date().toISOString(), allowedColours: ALLOWED.size, worldFrom: opt("world", baseUrl), paletteColours: PALETTE.size, runs: [] };
let failures = 0;
for (const dpr of dprs) {
  const d = new Driver(browser, dpr);
  const list = STATES.filter((s) => !only.length || only.some((o) => s.id.includes(o)));
  for (const state of list) {
    const tag = `dpr${dpr}-${state.id}`;
    const run = { id: state.id, dpr };
    try {
      const result = await state.run(d);
      run.regions = result.regions;
      run.note = result.note ?? null;
      const file = path.join(outDir, `${tag}.png`);
      await d.page.screenshot({ path: file });
      await measure(d, file, run);
      run.errors = d.errors.slice();
      run.pass = run.regions.every((r) => r.missing || r.pass) && run.scale.integer && !(run.blur?.bad > 0) && !run.errors.length;
    } catch (e) {
      run.pass = false;
      run.error = String(e.stack || e).split("\n").slice(0, 3).join(" | ");
    }
    if (!run.pass) failures++;
    report.runs.push(run);
    const fails = (run.regions || []).filter((r) => !r.missing && !r.pass);
    console.log(`${run.pass ? "PASS" : "FAIL"} ${tag}  ${run.blur?.bad ? `[blur ${run.blur.bad}/${run.blur.blocks}] ` : ""}${run.error || fails.map((r) => `${r.name}[off ${r.offPalette}/${r.pixels} mid ${r.intermediate} grid ${r.gridBad}/${r.blocks}${process.env.VERBOSE ? ` worst ${r.worstOff} at ${JSON.stringify(r.badAt)}` : ""}]`).join("; ")}`);
  }
  if (d.context) await d.context.close();
  d.context = null;
}
await browser.close();
const totals = report.runs.reduce(
  (t, r) => {
    for (const g of r.regions || []) if (!g.missing) {
      t.regions++;
      t.regionFails += g.pass ? 0 : 1;
      t.off += g.offPalette;
      t.mid += g.intermediate;
      t.gridBad += g.gridBad;
      t.blocks += g.blocks;
      t.pixels += g.pixels;
    }
    return t;
  },
  { regions: 0, regionFails: 0, off: 0, mid: 0, gridBad: 0, blocks: 0, pixels: 0 },
);
const blur = report.runs.reduce((t, r) => ({ blocks: t.blocks + (r.blur?.blocks ?? 0), bad: t.bad + (r.blur?.bad ?? 0) }), { blocks: 0, bad: 0 });
report.summary = { runs: report.runs.length, runFailures: failures, ...totals, blur };
writeFileSync(path.join(outDir, "report.json"), JSON.stringify(report, null, 1));
console.log(`\n${label}: ${report.runs.length - failures}/${report.runs.length} runs pass; ${totals.regions - totals.regionFails}/${totals.regions} regions pass; off-palette px ${totals.off}/${totals.pixels}, intermediate px ${totals.mid}, bad art blocks ${totals.gridBad}/${totals.blocks}; scaled-canvas blur blocks ${blur.bad}/${blur.blocks}`);
process.exit(failures ? 1 : 0);
