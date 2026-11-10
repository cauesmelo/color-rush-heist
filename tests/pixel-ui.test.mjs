/** The pixel UI rules as tests (UI_STYLE.md). These are the pure parts of the
 * kit plus source-level guards that keep non-pixel drawing from creeping back
 * into the UI; the pixels themselves are judged in Chrome by
 * tests/pixel-audit.mjs. */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { readPng } from "./png.mjs";
import {
  PAL, FORM, A, BAYER4, discSpans, ellipseSpans, ringPixels, ditherOn, stepped, irisFactor, IRIS_LADDER, textWidth, wrapText,
  nearestColour, GLYPH_ROWS, ICON_ROWS, BUTTON_LOOKS,
} from "../pixel-ui.mjs";

const root = new URL("..", import.meta.url).pathname;
/** Split on a separator at parenthesis depth 0 (so calc() and var() stay whole). */
function splitTop(text, sep) {
  const out = [];
  let depth = 0,
    cur = "";
  for (const ch of text) {
    if (ch === "(") depth++;
    if (ch === ")") depth--;
    if (ch === sep && depth === 0) (out.push(cur), (cur = ""));
    else cur += ch;
  }
  out.push(cur);
  return out;
}
const read = (f) => readFileSync(path.join(root, f), "utf8");
const hex = (s) => parseInt(s.slice(1), 16);

// --------------------------------------------------------------- palette ----
test("palette: every UI colour already exists in the art files (no UI-only shade)", () => {
  const art = new Set();
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name !== "player") walk(p);
      } else if (entry.name.endsWith(".png")) {
        const { rgba, width, height } = readPng(p);
        for (let i = 0; i < width * height; i++) if (rgba[i * 4 + 3] === 255) art.add((rgba[i * 4] << 16) | (rgba[i * 4 + 1] << 8) | rgba[i * 4 + 2]);
      }
    }
  };
  walk(path.join(root, "assets"));
  const missing = Object.entries(PAL).filter(([, c]) => !art.has(hex(c)));
  assert.deepEqual(missing, [], `colours not found in the art: ${JSON.stringify(missing)}`);
});
test("palette: 22 distinct opaque #rrggbb colours, and the three forms are in it", () => {
  const values = Object.values(PAL);
  assert.equal(values.length, 22);
  assert.equal(new Set(values).size, 22);
  for (const c of values) assert.match(c, /^#[0-9a-f]{6}$/);
  for (const c of Object.values(FORM)) assert.ok(values.includes(c));
  for (const look of Object.values(BUTTON_LOOKS)) for (const c of Object.values(look)) assert.ok(values.includes(c));
});
test("palette: nearestColour always lands on the palette", () => {
  for (const legacy of ["#1b1420", "#fbf9f2", "#ffd84a", "#ff8a7a", "#9be36a", "#000", "nonsense"]) assert.ok(Object.values(PAL).includes(nearestColour(legacy)), legacy);
  assert.equal(nearestColour(PAL.red), PAL.red);
});
test("style.css and embed.css: the colours are the palette, nothing else", () => {
  const allowed = new Set([...Object.values(PAL), "#168546"]); // the itch page behind the game
  for (const file of ["style.css", "embed.css"]) {
    const found = read(file).match(/#[0-9a-fA-F]{3,8}\b/g) ?? [];
    for (const c of found) assert.ok(allowed.has(c.toLowerCase()), `${file}: ${c} is not a palette colour`);
  }
  // The CSS custom properties spell the same palette as pixel-ui.mjs (kebab-case names).
  const css = read("style.css");
  for (const [name, value] of Object.entries(PAL)) {
    const prop = "--" + name.replace(/[A-Z]/g, (m) => "-" + m.toLowerCase());
    assert.match(css, new RegExp(`${prop}:\\s*${value};`), `${prop} must be ${value}`);
  }
});

// ----------------------------------------------------- the CSS rule list ----
test("CSS: no rounded corners, blur, gradients, translucency, rotation or eased motion", () => {
  for (const file of ["style.css", "embed.css"]) {
    const css = read(file).replace(/\/\*[\s\S]*?\*\//g, "");
    assert.doesNotMatch(css, /border-radius/, `${file}: border-radius`);
    assert.doesNotMatch(css, /gradient\(/, `${file}: gradient`);
    assert.doesNotMatch(css, /\bblur\(|backdrop-filter|filter:/, `${file}: blur or filter`);
    assert.doesNotMatch(css, /rgba?\(|hsla?\(/, `${file}: translucent or non-palette colour functions`);
    assert.doesNotMatch(css, /[^-]opacity\s*:/, `${file}: opacity`);
    assert.doesNotMatch(css, /rotate\(|skew\(|scale\(|rotate:|scale:/, `${file}: rotation or scaling`);
    assert.doesNotMatch(css, /\btransition\s*:\s*(?!none\b)\S/, `${file}: eased transition`);
    assert.doesNotMatch(css, /\banimation\s*:\s*(?!none\b)\S/, `${file}: animation (use steps())`);
    // A shadow is a hard offset: every box-shadow / text-shadow layer has blur 0.
    for (const [, value] of css.matchAll(/(?:box|text)-shadow\s*:\s*([^;]+);/g))
      for (const layer of splitTop(value, ",")) {
        const tokens = splitTop(layer.trim(), " ").filter(Boolean);
        // offset-x offset-y [blur [spread]] colour: the third length, when there is one, is 0.
        if (tokens[2] && /^(-?[\d.]|calc\()/.test(tokens[2])) assert.match(tokens[2], /^0(px)?$/, `${file}: shadow blur in "${layer.trim()}"`);
      }
  }
});
test("CSS: lengths are whole art pixels (var(--ap)); no stray px sizes except 0, 1 and the hidden text", () => {
  const css = read("style.css")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    // The portrait touch deck is the one place that keeps device-px sizes (phones are out of scope).
    .replace(/@media \(orientation: portrait\)[\s\S]*?\n\}\n(?=@media|$)/, "");
  const strays = [...css.matchAll(/(?<![\w.-])(-?\d*\.?\d+)px\b/g)].map((m) => m[0]).filter((v) => !["0px", "1px", "2px", "960px"].includes(v));
  // 2px appears once as the --ap default; everything else must be an --ap multiple.
  assert.deepEqual(strays, [], `unexpected px lengths: ${strays.join(", ")}`);
});
test("index.html: no inline styles, no glyphs from a fallback font on buttons", () => {
  const html = read("index.html");
  assert.doesNotMatch(html, /\sstyle="/);
  assert.doesNotMatch(html, /&#(9835|10074|9656|9664|9654|8635);/, "icons are pixel sprites, not text glyphs");
});

// ------------------------------------------------------------- geometry ----
test("discSpans: symmetric, flat top and bottom, monotone, odd widths", () => {
  for (let r = 1; r <= 24; r++) {
    const s = discSpans(r);
    assert.equal(s.length, 2 * r + 1);
    for (let i = 0; i < s.length; i++) assert.equal(s[i], s[s.length - 1 - i], `r=${r} symmetric`);
    assert.ok(s[0] >= 1, `r=${r}: the top row is a run, never a single pointed pixel`);
    for (let i = 1; i <= r; i++) assert.ok(s[i] >= s[i - 1], `r=${r} monotone to the middle`);
    assert.ok(s[r] >= r, `r=${r}: the middle row spans the radius`);
  }
});
test("ellipseSpans / ringPixels: a ring is the shell of its disc, angles in [0, 1)", () => {
  const e = ellipseSpans(12, 5);
  assert.equal(e.length, 11);
  assert.ok(e[5] >= 12);
  const ring = ringPixels(9, 2),
    disc = discSpans(9).reduce((n, hw) => n + hw * 2 + 1, 0),
    inner = discSpans(7).reduce((n, hw) => n + hw * 2 + 1, 0);
  assert.equal(ring.length, disc - inner);
  for (const p of ring) assert.ok(p.turn >= 0 && p.turn < 1);
  // 12 o'clock is turn 0 and 3 o'clock is a quarter turn.
  assert.ok(Math.abs(ring.find((p) => p.dx === 0 && p.dy === -9).turn - 0) < 1e-9);
  assert.ok(Math.abs(ring.find((p) => p.dx === 9 && p.dy === 0).turn - 0.25) < 1e-9);
});
test("dither: level L lights exactly L of every 16 pixels; levels nest", () => {
  for (let level = 0; level <= 16; level++) {
    let on = 0;
    for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) if (ditherOn(x, y, level)) on++;
    assert.equal(on, level, `level ${level}`);
  }
  // Raising the level only adds pixels, so a fade never flickers.
  for (let level = 0; level < 16; level++)
    for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) if (ditherOn(x, y, level)) assert.ok(ditherOn(x, y, level + 1));
  assert.equal(BAYER4.flat().sort((a, b) => a - b).join(), [...Array(16).keys()].join());
  // Level 8 is a true checkerboard.
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) assert.equal(ditherOn(x, y, 8), (x + y) % 2 === 0);
});
test("stepped: n+1 discrete values, monotone, clamped", () => {
  const seen = new Set();
  let last = -1;
  for (let i = 0; i <= 200; i++) {
    const v = stepped(i / 200, 4);
    assert.ok(v >= last);
    last = v;
    seen.add(v);
  }
  assert.deepEqual([...seen], [0, 0.25, 0.5, 0.75, 1]);
  assert.equal(stepped(-3, 4), 0);
  assert.equal(stepped(9, 4), 1);
});
test("iris: the cut-out only ever takes integer or 1/integer magnifications, and grows as t falls", () => {
  const ladder = new Set(IRIS_LADDER);
  let last = 0;
  for (let t = 1; t >= 0; t -= 0.01) {
    const f = irisFactor(t);
    assert.ok(ladder.has(f), `t=${t}`);
    assert.ok(f >= last, "monotone: the hole only opens");
    last = f;
  }
  for (const f of IRIS_LADDER) assert.ok(f >= 1 ? Number.isInteger(f) : Number.isInteger(Math.round(1 / f * 1e6) / 1e6) && Math.abs(1 / f - Math.round(1 / f)) < 1e-9, `${f}`);
  assert.equal(irisFactor(1), IRIS_LADDER[0]);
});
test("text: the pixel font is monospace on a 6 px pitch; wrapText breaks on width", () => {
  assert.equal(textWidth("Hello", 1), 30);
  assert.equal(textWidth("Hello", 2), 60);
  assert.equal(A, 2);
  const lines = wrapText("one two three four five six", 6 * 9);
  for (const l of lines) assert.ok(l.length <= 9, l);
  assert.equal(lines.join(" "), "one two three four five six");
});
test("sprite row tables are rectangular and the form glyphs are three distinct shapes", () => {
  for (const size of [5, 7]) {
    const shapes = new Set();
    for (const [name, rows] of Object.entries(GLYPH_ROWS[size])) {
      for (const row of rows) assert.equal(row.length, size, `${name}@${size}`);
      assert.equal(rows.length, size);
      shapes.add(rows.join("|"));
    }
    assert.equal(shapes.size, 3, `square, triangle and diamond differ at ${size}`);
  }
  for (const [name, rows] of Object.entries(ICON_ROWS)) for (const row of rows) assert.equal(row.length, rows[0].length, `icon ${name}`);
});

// ------------------------------------------------- source-level guards ----
const FORBIDDEN = ["globalAlpha", "createLinearGradient", "createRadialGradient", "rgba(", ".arc(", "ctx.ellipse(", "rotate(", "roundRect", "quadraticCurveTo", "setLineDash", ".stroke(", "strokeRect", "shadowBlur", "globalCompositeOperation", ".scale("];
test("pixel-ui.mjs and ui-draw.mjs: no arcs, gradients, rotation, alpha, strokes or system text", () => {
  for (const file of ["pixel-ui.mjs", "ui-draw.mjs"]) {
    const src = read(file).replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
    for (const token of FORBIDDEN) {
      // The kit may composite its own masks (destination-in/out) and flip a sprite
      // with scale(-1, 1): both stay on whole pixels.
      if (token === "globalCompositeOperation" || token === ".scale(") continue;
      assert.ok(!src.includes(token), `${file} uses ${token}`);
    }
    // fillText is allowed in exactly one place: the glyph bake in pixel-ui.mjs.
    const texts = (src.match(/fillText\(/g) ?? []).length;
    assert.equal(texts, file === "pixel-ui.mjs" ? 1 : 0, `${file} fillText calls`);
    // Colours come from PAL: no hex literal outside its definition (a mask's "#000" is invisible).
    const without = file === "pixel-ui.mjs" ? src.replace(/export const PAL = Object\.freeze\(\{[\s\S]*?\}\);/, "") : src;
    assert.deepEqual(without.match(/#[0-9a-fA-F]{6}\b/g) ?? [], [], `${file} has a hex colour outside PAL`);
  }
});
test("game.mjs: the only non-pixel drawing left is the world's own art and sprite transforms", () => {
  const src = read("game.mjs");
  const funcs = [...src.matchAll(/^(?:async )?function (\w+)/gm)].map((m) => ({ name: m[1], at: m.index }));
  funcs.push({ name: "EOF", at: src.length });
  const found = {};
  for (let i = 0; i < funcs.length - 1; i++) {
    const body = src.slice(funcs[i].at, funcs[i + 1].at).replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
    const hits = FORBIDDEN.filter((t) => body.includes(t));
    if (hits.length) found[funcs[i].name] = hits;
  }
  // World art: derived textures (colour composites), the backdrop's time-of-day multiply, the original
  // cone art, and the sprite transforms (squash, spin, blink) of Rubik and the cards. None of it is UI.
  const WORLD = new Set(["buildDerived", "drawBackground", "drawCone", "drawDefeat", "drawGuard", "drawRubik"]);
  const stray = Object.keys(found).filter((n) => !WORLD.has(n));
  assert.deepEqual(stray, [], `UI-style drawing outside the world functions: ${JSON.stringify(Object.fromEntries(stray.map((n) => [n, found[n]])))}`);
  // And no UI function draws text with the system font any more.
  assert.ok(!/fillText\(/.test(src), "game.mjs must not call fillText: text is the bitmap font (pixel-ui.mjs)");
  assert.ok(!/ctx\.font\s*=/.test(src), "game.mjs must not set ctx.font");
});
test("the model and campaign never import the UI modules", () => {
  for (const file of ["model.mjs", "campaign.mjs", "loop.mjs", ...readdirSync(path.join(root, "levels")).map((f) => "levels/" + f)]) {
    assert.doesNotMatch(read(file), /pixel-ui|ui-draw/, file);
  }
});
