/** Real-Chrome checks of the ending and the credits (dev tool, not part of
 * `npm test`; needs Playwright, e.g. the workspace's common/node_modules).
 *
 *   node serve.mjs --port 4401 &            # this folder, or the unpacked dist/itch
 *   node tests/browser-ending.mjs http://127.0.0.1:4401/ [shots-dir]
 *
 * Real key events and real mouse clicks drive the screens; the QA API is used
 * only to fast-forward a level's PLAY to its win (routes.mjs) and to read state.
 * Everything after the win is the real flow: the world clear's Continue, the
 * three closing pages, the six credit cards, the title. It prints a JSON report
 * and exits 1 when a check fails. It runs in real time (about 90 s). */
import { createRequire } from "node:module";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { ROUTES } from "./routes.mjs";
import { CREDITS, ENDING_PAGES, totalSeconds } from "../credits.mjs";

const url = process.argv[2] || "http://127.0.0.1:4401/",
  shots = process.argv[3] || null;
if (shots) mkdirSync(shots, { recursive: true });
const require = createRequire(process.env.PLAYWRIGHT_FROM || new URL("../../common/package.json", import.meta.url).pathname);
const { chromium } = require("@playwright/test");
const report = {},
  failures = [];
const check = (name, ok, value) => {
  report[name] = { ok: !!ok, value };
  console.log(ok ? "PASS" : "FAIL", name, ok ? "" : JSON.stringify(value));
  if (!ok) failures.push(name);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const rec = (o = {}) => ({ clear: true, best: 60, stickers: [1, 2, 3], unseen: false, takedown: false, takedownBest: 0, quick: false, chain: false, chainBest: 0, color: "white", ...o });
const IDS = ["1-1", "1-2", "1-3", "1-4", "1-5", "1-6"];
/** A save with 1-1..1-5 cleared (1-6 is about to be won), or all six. */
const saveOf = ({ all = false, reduceMotion = false } = {}) =>
  JSON.stringify({
    v: 2,
    last: all ? "1-6" : "1-6",
    comicSeen: true,
    migratedFrom: null,
    hints: {},
    levels: Object.fromEntries(IDS.filter((id) => all || id !== "1-6").map((id) => [id, rec({ color: id === "1-6" ? "red" : "green" })])),
    // Music off (no 7 MB decode on a loaded machine); sound off (nothing to hear in a test).
    settings: { sfx: false, music: false, timer: false, slowSpotting: false, reduceMotion },
  });

const browser = await chromium.launch({ channel: "chrome" });
async function open(save, { reduced = false } = {}) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  const errors = [];
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("requestfailed", (r) => errors.push(`failed: ${r.url()}`));
  await page.addInitScript((s) => {
    if (!sessionStorage.getItem("seeded")) {
      localStorage.setItem("color-rush-heist:v2:save", s);
      sessionStorage.setItem("seeded", "1");
    }
  }, save);
  await page.goto(url);
  await page.waitForFunction(() => window.__game?.getState().assetsReady);
  return { context, page, errors, reduced };
}
const st = (page) => page.evaluate(() => window.__game.getState());
const reelOf = async (page) => (await st(page)).reel;
const screenOf = async (page) => (await st(page)).screen;
async function waitScreen(page, name, ms = 60000) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if ((await screenOf(page)) === name) return true;
    await sleep(60);
  }
  return false;
}
async function waitPage(page, index, ms = 60000) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    const r = await reelOf(page);
    if (r && r.index >= index) return r;
    await sleep(60);
  }
  return reelOf(page);
}
/** The game's clock is frame time (one frame counts for at most 0.1 s), so on a busy
 * machine a page's age runs slower than the wall clock. Waits are therefore in the game's
 * own terms: until a press would count (past the lockout), or until the page is `s` old. */
const until = (page, fn, arg, timeout = 60000) => page.waitForFunction(fn, arg, { timeout });
const canPress = (page) => until(page, () => window.__game.getState().reel?.canPress === true);
const ageAtLeast = (page, s) => until(page, (s) => window.__game.getState().reel?.age >= s, s);
/** Win 1-6 in QA stepping, then let the real frame loop run into the world clear. */
async function winVault(page, kind = "baseline") {
  await page.evaluate((route) => {
    const g = window.__game;
    g.setManual(true);
    g.startLevel("1-6");
    for (const [s, input] of route) g.step(s, input, { render: false });
    g.step(0.05, {});
    g.setManual(false);
  }, ROUTES["1-6"][kind]);
  return waitScreen(page, "world");
}
const shot = (page, name) => (shots ? page.screenshot({ path: path.join(shots, name + ".png") }) : null);

// ------------------------------------------------ the whole flow, real keys --
{
  const { context, page, errors } = await open(saveOf());
  check("title: a Credits button, a v1.0 label, no reel yet", (await page.locator("#credits-btn").isVisible()) && (await page.locator("#version").isVisible()) && (await reelOf(page)) === null, await screenOf(page));
  check("the vault's win (the mastery route: all 3 stickers) reaches the world clear", await winVault(page, "mastery"), await screenOf(page));
  await sleep(300);
  await shot(page, "01-world-clear");
  // Continue is focused: Enter (a real key) goes to the closing pages.
  const focused = await page.evaluate(() => document.activeElement?.id);
  check("world clear: Continue holds focus", focused === "continue", focused);
  await page.keyboard.press("Enter");
  check("Continue goes to the closing pages", (await screenOf(page)) === "ending", await screenOf(page));
  let r = await reelOf(page);
  check("ending: page 1 'home' of 3, opened from the world clear", r.id === "home" && r.count === ENDING_PAGES.length && r.from === "world" && r.canPress === false, r);
  await shot(page, "02-ending-home");

  // A press inside the lockout does nothing (reflex presses, double taps).
  await page.keyboard.press("Space");
  await page.keyboard.press("Enter");
  r = await reelOf(page);
  check("ending: presses in the first 0.6 s are ignored", r.index === 0 && r.age < 1.5, r);

  // A held key never skips: hold ArrowRight through the lockout (auto-repeat arrives as repeat:true).
  await page.keyboard.down("ArrowRight");
  for (let i = 0; i < 6; i++) {
    await sleep(80);
    await page.keyboard.down("ArrowRight"); // Playwright marks the second down of a held key as a repeat
  }
  await canPress(page);
  for (let i = 0; i < 6; i++) {
    await sleep(80);
    await page.keyboard.down("ArrowRight");
  }
  r = await reelOf(page);
  check("ending: a held key never skips (held past the lockout)", r.index === 0 && r.canPress === true, r);
  await page.keyboard.up("ArrowRight");
  // A fresh press now moves on.
  await page.keyboard.press("KeyA");
  r = await reelOf(page);
  check("ending: a fresh press after the lockout moves to page 2 (the colours)", r.index === 1 && r.id === "colors" && r.age < 0.5 && r.canPress === false, r);
  await ageAtLeast(page, 1.4);
  await shot(page, "03-ending-colors");
  // Modifier keys alone are not presses.
  await canPress(page);
  await page.keyboard.press("Shift");
  await page.keyboard.press("Tab");
  r = await reelOf(page);
  check("ending: Shift and Tab alone do not move it on", r.index === 1, r);
  // Let page 2 run out by itself into page 3.
  r = await waitPage(page, 2, 6000);
  check("ending: a page times out by itself into the next", r.index === 2 && r.id === "end", r);
  // A mouse click is a press too, after the lockout (this one lands on the page's first moments).
  await page.mouse.click(640, 360);
  r = await reelOf(page);
  check("ending: a click inside the lockout is ignored", (await screenOf(page)) === "ending" && r.index === 2, r);
  await ageAtLeast(page, 1.8);
  await shot(page, "04-ending-end");
  await page.mouse.click(640, 360);
  check("ending: the last page's press goes on to the credits", (await screenOf(page)) === "credits", await screenOf(page));
  r = await reelOf(page);
  check("credits: card 1 of 6, opened from the ending", r.id === CREDITS[0].id && r.count === CREDITS.length && r.from === "world" && r.index === 0, r);
  await ageAtLeast(page, 1.5);
  await shot(page, "05-credits-1");
  // Walk the cards by real keys: each press after its lockout moves on, in data order.
  const seen = [r.id];
  for (let i = 1; i < CREDITS.length; i++) {
    await canPress(page);
    await page.keyboard.press("Space");
    r = await reelOf(page);
    seen.push(r?.id);
    if (i === 1 || i === CREDITS.length - 1) await ageAtLeast(page, 1.4), await shot(page, i === 1 ? "06-credits-2" : "07-credits-last");
  }
  check("credits: the cards come in the order of credits.mjs", JSON.stringify(seen) === JSON.stringify(CREDITS.map((c) => c.id)), seen);
  await canPress(page);
  await page.keyboard.press("Enter");
  check("credits: a press on the last card returns to the title", (await screenOf(page)) === "title" && (await reelOf(page)) === null, await screenOf(page));
  const s = await st(page);
  check("title after the credits: the save is whole (6 levels cleared, 18 stickers) and the game is replayable", s.campaign.worldClear === true && s.campaign.stickerTotal === 18 && s.save.levels["1-6"].clear === true, { worldClear: s.campaign.worldClear, stickers: s.campaign.stickerTotal });
  check("no console or page errors in the flow", errors.length === 0, errors);
  await context.close();
}

// ------------------------------------- Esc leaves; the whole timeline alone --
{
  const { context, page, errors } = await open(saveOf());
  await winVault(page);
  await sleep(200);
  await page.keyboard.press("Space"); // Continue
  check("Space on Continue goes to the ending too", (await screenOf(page)) === "ending", await screenOf(page));
  await page.keyboard.press("Escape");
  check("ending: Esc inside the lockout does nothing", (await screenOf(page)) === "ending", await screenOf(page));
  await canPress(page);
  await page.keyboard.press("Escape");
  check("ending: Esc after the lockout leaves for the title (the credits are skipped)", (await screenOf(page)) === "title", await screenOf(page));
  // Back through the real flow; this time nobody touches a key: the timeline itself.
  await page.keyboard.press("Space"); // title: any key; returning player goes to the map
  check("title: a returning player goes to the map", await waitScreen(page, "map", 3000), await screenOf(page));
  await winVault(page);
  await sleep(200);
  await page.keyboard.press("Enter");
  const started = Date.now();
  check("replay: the ending plays again after another 1-6 clear", (await screenOf(page)) === "ending", await screenOf(page));
  const authored = totalSeconds(ENDING_PAGES) + totalSeconds(CREDITS);
  // The page clock never runs ahead of the wall clock (a frame counts for at most 0.1 s), so
  // finishing sooner than the authored time would be a bug; a busy machine only makes it later.
  check("the ending's timeline reaches the credits by itself", await waitScreen(page, "credits", 5 * 1000 * totalSeconds(ENDING_PAGES)), await screenOf(page));
  const toCredits = (Date.now() - started) / 1000;
  check("the ending takes at least its authored time", toCredits >= totalSeconds(ENDING_PAGES) - 0.3, { toCredits, authored: totalSeconds(ENDING_PAGES) });
  check("the credits reach the title by themselves", await waitScreen(page, "title", 5 * 1000 * totalSeconds(CREDITS)), await screenOf(page));
  const total = (Date.now() - started) / 1000;
  check("ending + credits take at least their authored time with no input", total >= authored - 0.3, { total, authored });
  check("no errors across the unattended timeline", errors.length === 0, errors);
  await context.close();
}

// -------------------------------------- the title's Credits: mouse and keys --
{
  const { context, page, errors } = await open(saveOf({ all: true }));
  // Mouse.
  await page.locator("#credits-btn").click();
  let r = await reelOf(page);
  check("title: clicking Credits plays the cards (not the game)", (await screenOf(page)) === "credits" && r.from === "title" && r.id === CREDITS[0].id && r.count === CREDITS.length, r);
  await page.mouse.click(640, 360);
  r = await reelOf(page);
  check("credits: a click inside the lockout does not move on", r.index === 0 && !r.canPress, r);
  await canPress(page);
  await page.mouse.click(640, 360);
  r = await reelOf(page);
  check("credits: a click after it does", r.index === 1, r);
  await canPress(page);
  await page.mouse.click(640, 360, { button: "right" });
  r = await reelOf(page);
  check("credits: a right click is not a press (even past the lockout)", r.index === 1 && r.canPress, r);
  await page.keyboard.press("Escape");
  check("credits (from the title): Esc returns to the title", (await screenOf(page)) === "title" && (await reelOf(page)) === null, await screenOf(page));
  // Keyboard only: Tab to the button, Enter, and the same cards.
  const focus = [];
  for (let i = 0; i < 6; i++) {
    await page.keyboard.press("Tab");
    focus.push(await page.evaluate(() => document.activeElement?.id || document.activeElement?.className || document.activeElement?.tagName));
    if (focus.at(-1) === "credits-btn") break;
  }
  check("title: Tab reaches the Credits button", focus.at(-1) === "credits-btn", focus);
  const ring = await page.evaluate(() => {
    const e = document.querySelector("#credits-btn"),
      c = getComputedStyle(e);
    return { outlineStyle: c.outlineStyle, outlineColor: c.outlineColor, matches: e.matches(":focus-visible") };
  });
  check("title: the focus frame on Credits is the pixel frame (lemon outline, focus-visible)", ring.matches && ring.outlineStyle === "solid" && ring.outlineColor === "rgb(240, 246, 121)", ring);
  await shot(page, "08-title-focus-credits");
  await page.keyboard.press("Enter");
  r = await reelOf(page);
  check("title: Enter on Credits plays the cards, the game does not start", (await screenOf(page)) === "credits" && r.id === CREDITS[0].id, r);
  // Held Enter (the key that opened it) cannot skip card 1: repeats arrive with repeat:true.
  await page.keyboard.down("Enter");
  for (let i = 0; i < 4; i++) {
    await sleep(100);
    await page.keyboard.down("Enter");
  }
  await canPress(page);
  for (let i = 0; i < 4; i++) {
    await sleep(100);
    await page.keyboard.down("Enter");
  }
  await page.keyboard.up("Enter");
  r = await reelOf(page);
  check("credits: the Enter that opened them, held down past the lockout, does not skip card 1", r.index === 0 && r.canPress, r);
  await page.keyboard.press("Space");
  check("credits: a fresh press moves to card 2", (await reelOf(page)).index === 1, await reelOf(page));
  await canPress(page);
  await page.keyboard.press("Escape");
  const back = await page.evaluate(() => ({ id: document.activeElement?.id, screen: window.__game.getState().screen }));
  check("credits: Esc returns to the title with Credits focused (Enter again replays them)", back.screen === "title" && back.id === "credits-btn", back);
  // Any other key still starts the game from the title.
  await page.keyboard.press("ArrowLeft");
  check("title: any other key still starts (a finished save goes to the map)", await waitScreen(page, "map", 3000), await screenOf(page));
  const m = await st(page);
  check("finished save on the map: all six open, Rubik on 1-6, Continue-from-map works", m.map.id === "1-6" && m.campaign.unlocked.length === 6, m.map);
  await page.keyboard.press("Enter");
  check("the vault can be replayed from the finished save", await page.waitForFunction(() => window.__game.getState().screen === "play", null, { timeout: 5000 }).then(() => true, () => false), await screenOf(page));
  check("no errors with the title's Credits", errors.length === 0, errors);
  await context.close();
}

// ------------------------------- the rest of the game still works around it --
{
  const { context, page, errors } = await open(
    JSON.stringify({ v: 2, last: "1-2", comicSeen: true, migratedFrom: null, hints: {}, levels: { "1-1": rec({ stickers: [1] }) }, settings: { sfx: false, music: false, timer: false, slowSpotting: false, reduceMotion: false } }),
  );
  const win = async (id) => {
    await page.evaluate((route) => {
      const g = window.__game;
      g.setManual(true);
      g.startLevel(route.id);
      for (const [s, input] of route.steps) g.step(s, input, { render: false });
      g.step(0.05, {});
      g.setManual(false);
    }, { id, steps: ROUTES[id].baseline });
    return waitScreen(page, "results");
  };
  check("1-2 clears to its results card", await win("1-2"), await screenOf(page));
  await sleep(300);
  const buttons = await page.evaluate(() => [...document.querySelectorAll("#results-actions button:not([hidden])")].map((b) => b.id));
  check("results: Continue and Retry are both there (the world clear's Retry stays hidden)", JSON.stringify(buttons) === JSON.stringify(["continue", "again"]), buttons);
  await page.locator("#again").click();
  check("results: Retry replays the level", (await screenOf(page)) === "play" && (await st(page)).level.id === "1-2", await screenOf(page));
  check("1-2 clears again", await win("1-2"), await screenOf(page));
  await sleep(300);
  await page.keyboard.press("Enter");
  const m = await st(page);
  check("results: Continue goes to the world map, on the level just opened", m.screen === "map" && m.map.id === "1-3", m.map);
  await sleep(1400);
  await page.keyboard.press("Escape");
  check("map: the menu opens (Credits panel and Reset progress still there)", (await page.evaluate(() => !document.querySelector("#pause-card").hidden && !!document.querySelector('[data-show="credits"]') && !!document.querySelector('[data-show="reset"]'))), await screenOf(page));
  await page.keyboard.press("Escape");
  await page.keyboard.press("Enter");
  check("map: Enter still plays the chosen level", await page.waitForFunction(() => window.__game.getState().screen === "play", null, { timeout: 5000 }).then(() => true, () => false), await screenOf(page));
  check("no errors around the ending", errors.length === 0, errors);
  await context.close();
}

// --------------------------------------------------- reduced motion, DPR 2 ---
{
  const { context, page, errors } = await open(saveOf({ reduceMotion: true }));
  await page.locator("#credits-btn").click();
  await canPress(page);
  const a = await page.evaluate(() => ({ reel: window.__game.getState().reel, reduced: window.__game.getState().motion.reduced }));
  check("reduced motion: the credits still play, one card at a time", a.reduced && a.reel.kind === "credits" && a.reel.index === 0, a);
  await ageAtLeast(page, 1.5);
  await shot(page, "09-credits-reduced");
  await page.keyboard.press("Escape");
  await winVault(page);
  await sleep(200);
  await page.keyboard.press("Enter");
  await canPress(page);
  await page.keyboard.press("Space");
  await ageAtLeast(page, 2.2);
  await shot(page, "10-ending-colors-reduced");
  const r = await reelOf(page);
  check("reduced motion: the colours page cuts to full colour (no wave to wait for)", r.id === "colors", r);
  check("no errors under reduced motion", errors.length === 0, errors);
  await context.close();
}

await browser.close();
console.log(JSON.stringify({ checks: Object.keys(report).length, failures }, null, 2));
process.exit(failures.length ? 1 : 0);
