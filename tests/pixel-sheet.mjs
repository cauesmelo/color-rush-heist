/** Before / after contact sheets from two pixel-audit runs (dev tool).
 *
 *   node tests/pixel-sheet.mjs --before <dir> --after <dir> --out <dir> [--dpr 1] [--rows 6] [--scale 0.5]
 *
 * Each audit run saves one full-window screenshot per state (dpr<N>-<state>.png).
 * This crops the game surface out of each, lays before and after side by side,
 * and renders sheets as PNGs (nearest-neighbour, so the pixels are what the
 * player sees). Also writes zoom-dpr2.png: 4x crops of chosen details from the
 * DPR 2 captures, where any blur or anti-aliasing would show. */
import { createRequire } from "node:module";
import { readdirSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

const args = process.argv.slice(2);
const opt = (n, d) => (args.includes(`--${n}`) ? args[args.indexOf(`--${n}`) + 1] : d);
const before = path.resolve(opt("before", "before-run")),
  after = path.resolve(opt("after", "after-run")),
  out = path.resolve(opt("out", "sheets")),
  dpr = Number(opt("dpr", 1)),
  rows = Number(opt("rows", 6)),
  scale = Number(opt("scale", 0.5));
mkdirSync(out, { recursive: true });
const require = createRequire(process.env.PLAYWRIGHT_FROM || new URL("../../common/package.json", import.meta.url).pathname);
const { chromium } = require("@playwright/test");

// The game surface in a 1280x720 window: 960x540 at (160, 90), times the dpr.
const crop = { x: 160 * dpr, y: 90 * dpr, w: 960 * dpr, h: 540 * dpr };
const ids = readdirSync(after)
  .filter((f) => f.startsWith(`dpr${dpr}-`) && f.endsWith(".png"))
  .map((f) => f.slice(`dpr${dpr}-`.length, -4))
  .sort();
const tile = (dir, id, label) => {
  const file = path.join(dir, `dpr${dpr}-${id}.png`);
  if (!existsSync(file)) return `<div class="tile missing">${label}: no capture</div>`;
  const w = Math.round(crop.w * (scale / dpr)),
    h = Math.round(crop.h * (scale / dpr));
  return `<div class="tile"><div class="img" style="width:${w}px;height:${h}px;background:url('${pathToFileURL(file).href}') -${crop.x * (scale / dpr)}px -${crop.y * (scale / dpr)}px / ${1280 * (scale)}px ${720 * scale}px no-repeat"></div><b>${label}</b></div>`;
};
const browser = await chromium.launch({ channel: "chrome" });
const page = await browser.newPage({ viewport: { width: 2000, height: 1200 } });
const per = rows;
const sheets = [];
for (let i = 0; i < ids.length; i += per) {
  const chunk = ids.slice(i, i + per);
  const html = `<style>body{margin:0;background:#222;color:#ddd;font:12px monospace}.row{display:flex;gap:6px;margin:6px;align-items:flex-start}.tile{position:relative;flex:none}.tile b{position:absolute;left:4px;top:4px;background:#000;padding:1px 4px}.img{image-rendering:pixelated}.cap{margin:6px;font-size:14px;color:#fff}.missing{width:480px;height:270px;display:grid;place-items:center;background:#400}</style>${chunk
    .map((id) => `<div class="cap">${id}</div><div class="row">${tile(before, id, "before")}${tile(after, id, "after")}</div>`)
    .join("")}`;
  const file = path.join(os.tmpdir(), `crh-sheet-${process.pid}-${i / per}.html`);
  writeFileSync(file, html);
  await page.goto(pathToFileURL(file).href);
  const height = await page.evaluate(() => document.body.scrollHeight);
  await page.setViewportSize({ width: Math.round(960 * scale * 2 + 40), height });
  const name = `sheet-${String(i / per + 1).padStart(2, "0")}-${chunk[0]}-to-${chunk[chunk.length - 1]}.png`;
  await page.screenshot({ path: path.join(out, name), fullPage: true });
  sheets.push(name);
}
// Zoom crops from the DPR 2 captures (device px; stage at (320, 180) of the 2560x1440 window).
const ZOOMS = [
  ["results-stamps", "stamps and sockets", 600, 100, 190, 250],
  ["pause", "pause buttons", 300, 280, 360, 150],
  ["play-1-4-hud", "HUD corner", 0, 0, 270, 200],
  ["map-progress", "map nodes", 220, 260, 420, 170],
];
const z = 2,
  zoomTile = (dir, [id, , x, y, w, h], label) => {
    const file = path.join(dir, `dpr2-${id}.png`);
    if (!existsSync(file)) return "";
    return `<div class="tile"><div class="img" style="width:${w * 2 * z}px;height:${h * 2 * z}px;background:url('${pathToFileURL(file).href}') -${(320 + 2 * x) * z}px -${(180 + 2 * y) * z}px / ${2560 * z}px ${1440 * z}px no-repeat"></div><b>${label}</b></div>`;
  };
const zoomHtml = `<style>body{margin:0;background:#222;color:#ddd;font:12px monospace}.row{display:flex;gap:6px;margin:6px;align-items:flex-start}.tile{position:relative;flex:none}.tile b{position:absolute;left:4px;top:4px;background:#000;padding:1px 4px}.img{image-rendering:pixelated}.cap{margin:6px;font-size:14px;color:#fff}</style>${ZOOMS.map((zm) => `<div class="cap">${zm[0]}: ${zm[1]} (DPR 2, ${z}x zoom of device pixels)</div><div class="row">${zoomTile(before, zm, "before")}${zoomTile(after, zm, "after")}</div>`).join("")}`;
const zoomFile = path.join(os.tmpdir(), `crh-sheet-${process.pid}-zoom.html`);
writeFileSync(zoomFile, zoomHtml);
await page.setViewportSize({ width: 1600, height: 900 });
await page.goto(pathToFileURL(zoomFile).href);
await page.setViewportSize({ width: 1600, height: await page.evaluate(() => document.body.scrollHeight) });
await page.screenshot({ path: path.join(out, "zoom-dpr2.png"), fullPage: true });
await browser.close();
console.log(sheets.join("\n") + "\nzoom-dpr2.png");
