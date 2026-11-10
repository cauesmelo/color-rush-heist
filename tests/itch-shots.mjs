/** Regenerate the itch.io page screenshots and cover candidates (ITCH_IO.md)
 * from the PACKAGED build, as real 960x540 frames with no debug overlay.
 *
 *   npm run build:itch
 *   node -e "import('./serve.mjs').then(({createDemoServer})=>createDemoServer('dist/itch').listen(4502,'127.0.0.1'))" &
 *   node tests/itch-shots.mjs http://127.0.0.1:4502/ artifacts/itch
 *
 * Needs Playwright (the workspace's common/node_modules). Frames are picked by
 * game events (a stomp, a position), not by wall-clock time, so a rerun lands
 * on the same moments. */
import { createRequire } from "node:module";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { ROUTES } from "./routes.mjs";

const [url = "http://127.0.0.1:4502/", out = "artifacts/itch"] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const require = createRequire(process.env.PLAYWRIGHT_FROM || new URL("../../common/package.json", import.meta.url).pathname);
const { chromium } = require("@playwright/test");
const browser = await chromium.launch({ channel: "chrome" });
const rec = (o = {}) => ({ clear: true, best: 48.2, stickers: [1, 2], unseen: true, takedown: false, takedownBest: 0, quick: false, chain: false, chainBest: 0, color: "green", ...o });
const save = (levels, last) =>
  JSON.stringify({ v: 2, last, comicSeen: true, migratedFrom: null, hints: {}, levels, settings: { sfx: false, music: false, timer: false, slowSpotting: false, reduceMotion: false } });

async function open(saveJson) {
  const ctx = await browser.newContext({ viewport: { width: 960, height: 540 } }),
    page = await ctx.newPage();
  await page.addInitScript((s) => localStorage.setItem("color-rush-heist:v2:save", s), saveJson);
  await page.addInitScript(() => {
    // Route playback one tick at a time (pulses on an entry's first tick only).
    window.__until = (route, stop) => {
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
  await page.goto(url);
  await page.waitForFunction(() => window.__game?.getState().assetsReady);
  return { ctx, page };
}
const shot = async (page, name, clip) => page.screenshot({ path: path.join(out, name), ...(clip ? { clip } : {}) });
const earlier = { "1-1": rec({ color: "white", unseen: false }), "1-2": rec({ stickers: [1, 2, 3] }), "1-3": rec(), "1-4": rec(), "1-5": rec() };

// 01 title
{
  const { ctx, page } = await open(save({}, "1-1"));
  await page.waitForTimeout(300);
  await shot(page, "01-title.png");
  await ctx.close();
}
// 02 the stomp lesson (and cover B): the frame a few ticks after the first stomp
{
  const { ctx, page } = await open(save({ "1-1": earlier["1-1"] }, "1-2"));
  await page.evaluate(
    ([route]) => {
      const g = window.__game;
      g.setManual(true);
      g.startLevel("1-2");
      window.__until(route, (s) => s.chain >= 1);
      for (let i = 0; i < 5; i++) g.step(1 / 120, { right: true }, { render: i === 4 });
    },
    [ROUTES["1-2"].baseline],
  );
  await page.waitForTimeout(80);
  await shot(page, "02-stomp-1-2.png");
  await shot(page, "cover-b-stomp-630x500.png", { x: 150, y: 20, width: 630, height: 500 });
  await ctx.close();
}
// 03 lookouts: green Rubik on a card's head in 1-5 (the takedown route's first stomp)
{
  const { ctx, page } = await open(save(earlier, "1-5"));
  await page.evaluate(
    ([route]) => {
      const g = window.__game;
      g.setManual(true);
      g.startLevel("1-5");
      window.__until(route, (s) => s.chain >= 1);
      for (let i = 0; i < 3; i++) g.step(1 / 120, { right: true }, { render: i === 2 });
    },
    [ROUTES["1-5"].takedown],
  );
  await page.waitForTimeout(80);
  await shot(page, "03-lookouts-1-5.png");
  await ctx.close();
}
// 04 the vault: Rubik walking up to it in 1-6
{
  const { ctx, page } = await open(save(earlier, "1-6"));
  await page.evaluate(
    ([route]) => {
      const g = window.__game;
      g.setManual(true);
      g.startLevel("1-6");
      window.__until(route, (s) => s.player.x >= 3560);
      g.step(0, {});
    },
    [ROUTES["1-6"].baseline],
  );
  await page.waitForTimeout(80);
  await shot(page, "04-vault-1-6.png");
  await ctx.close();
}
// 05 the 1-5 clear with the Ghost and Takedown stamps
{
  const { ctx, page } = await open(save({ ...earlier, "1-5": undefined }, "1-5"));
  await page.evaluate(
    ([route]) => {
      const g = window.__game;
      g.setManual(true);
      g.startLevel("1-5");
      for (const [s, input] of route) g.step(s, input, { render: false });
      g.step(0.05, {});
      g.setManual(false);
    },
    [ROUTES["1-5"].takedown],
  );
  await page.waitForFunction(() => window.__game.getState().screen === "results", null, { timeout: 15000 });
  await page.waitForTimeout(1800);
  await shot(page, "05-result-stamps.png");
  await ctx.close();
}
// 06 the world map, three levels in
{
  const { ctx, page } = await open(save({ "1-1": earlier["1-1"], "1-2": earlier["1-2"], "1-3": earlier["1-3"] }, "1-4"));
  await page.evaluate(() => window.__game.openMap("1-4"));
  await page.waitForTimeout(1300);
  await shot(page, "06-world-map.png");
  await ctx.close();
}
await browser.close();
console.log("wrote 01-06 and cover-b to " + out);
