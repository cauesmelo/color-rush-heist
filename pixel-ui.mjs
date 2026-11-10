/** Color Rush Heist pixel UI kit. The rules are in UI_STYLE.md; this is the code
 * that makes them hard to break.
 *
 * THE GRID. The game surface is 960x540 canvas px, the art is drawn at 2x, so one
 * ART PIXEL = A = 2 canvas px. Everything in this module takes art-pixel
 * coordinates (the screen is 480x270 art px) and paints whole art pixels with
 * fillRect/drawImage on an integer scale and with smoothing off. Nothing here
 * draws an arc, a gradient, a rotated rectangle, a blurred shadow or an
 * alpha blend: rounds are pixel-circle spans, soft things are Bayer-dithered
 * palette pixels, tilts are pre-rotated sprites, text is a baked bitmap font.
 *
 * LAYERS. The palette, the geometry helpers (circle spans, dither, stepping)
 * and the sprite row tables are pure data and functions (tested in Node:
 * tests/pixel-ui.test.mjs). Drawing needs a canvas context, and canvases are
 * created lazily, so importing this file in Node is safe. The game model never
 * imports it. */

/** Canvas px per art px. */
export const A = 2;

/** The UI palette. Every colour is one that already exists in the art files
 * (Rubik, the cards, the Tileset, the vault, the title): ink is the art's own
 * pure-black outline, the greys are Rubik's four, red and green are the cards',
 * the plums are the Tileset's, the golds the vault's, the blue the storm's. No
 * UI-only shade was added. Semi-transparent colours do not exist here. */
export const PAL = Object.freeze({
  ink: "#000000", // outlines, text outlines (the art's outline colour)
  void: "#25131a", // deepest plum: hard shadows, wells, quiet faces
  plum: "#3d253b", // panel field (the Tileset's body colour)
  mauve: "#523b40", // raised face of a button
  slate: "#323234", // Rubik's shadow grey: empty hearts, pressed faces
  stone: "#737375", // mid grey: disabled text, locked outlines
  fog: "#999ca4", // light grey: secondary text
  mist: "#c9d2d4", // lightest grey: the white form, bevel light
  white: "#ffffff",
  cream: "#f7fbe3", // the title's cream: card rims, bubbles
  gold: "#cbb540", // the vault's gold
  lemon: "#f0f679", // the vault's highlight: focus, stickers, "on" accents
  red: "#dc3232",
  redDark: "#a43131",
  wine: "#82425d",
  rose: "#ee7984",
  green: "#6abe30",
  forest: "#2e7d37",
  lime: "#b4e34f",
  blue: "#639bff",
  indigo: "#5850ab",
  navy: "#143464",
});
/** The three form colours as the UI paints them (white is Rubik's lightest grey). */
export const FORM = Object.freeze({ white: PAL.mist, green: PAL.green, red: PAL.red });

// ----------------------------------------------------------- pure geometry --
/** Half-widths of a filled pixel disc of radius r, for dy = -r..r (index dy+r).
 * Uses radius r + 0.5 so the top and bottom rows are flat (a run of pixels),
 * never a single pointed pixel. */
export function discSpans(r) {
  const spans = [];
  for (let dy = -r; dy <= r; dy++) spans.push(Math.floor(Math.sqrt((r + 0.5) ** 2 - dy * dy)));
  return spans;
}
/** The same for an ellipse of radii rx, ry. */
export function ellipseSpans(rx, ry) {
  const spans = [];
  for (let dy = -ry; dy <= ry; dy++) spans.push(Math.floor((rx + 0.5) * Math.sqrt(Math.max(0, 1 - (dy / (ry + 0.5)) ** 2))));
  return spans;
}
/** Pixels of a ring (disc r minus disc r - t), each with its angle from 12
 * o'clock clockwise in turns (0..1), for dashed rings and arcs that drain. */
export function ringPixels(r, t = 1) {
  const outer = discSpans(r),
    inner = t >= r ? null : discSpans(r - t),
    out = [];
  for (let dy = -r; dy <= r; dy++)
    for (let dx = -outer[dy + r]; dx <= outer[dy + r]; dx++) {
      if (inner) {
        const iy = dy + (r - t);
        if (iy >= 0 && iy < inner.length && Math.abs(dx) <= inner[iy]) continue;
      }
      out.push({ dx, dy, turn: ((Math.atan2(dx, -dy) / (Math.PI * 2)) + 1) % 1 });
    }
  return out;
}
/** 4x4 Bayer thresholds: a pixel is "on" at dither level L (0..16) when
 * threshold < L, so L = 8 is a checkerboard-ish half and 16 is solid. */
export const BAYER4 = Object.freeze([
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
]);
export const ditherOn = (x, y, level) => BAYER4[y & 3][x & 3] < level;
/** Quantise 0..1 to n steps (n + 1 values, 0 and 1 included): a stepped ease. */
export const stepped = (t, n) => Math.round(Math.max(0, Math.min(1, t)) * n) / n;
/** The integer (or 1/integer) factors an iris may take: a pixel-stepped zoom
 * where every art pixel of the Rubik-face cut-out stays a whole block (>= 1) or
 * a whole decimation (< 1). */
export const IRIS_LADDER = Object.freeze([0.2, 0.25, 1 / 3, 0.5, 1, 2, 3, 4, 6, 8, 12, 16, 24, 32, 48, 64, 96, 128, 192]);
/** The original iris curve (2^(10t-10)*5, t = 1 closed .. 0 open) as the
 * cut-out's magnification, snapped down to the ladder. */
export function irisFactor(t) {
  const f = 1 / (Math.pow(2, 10 * t - 10) * 5);
  let pick = IRIS_LADDER[0];
  for (const rung of IRIS_LADDER) if (rung <= f) pick = rung;
  return pick;
}
/** The palette colour nearest to any #rrggbb (so a legacy hex from an event or
 * a table always lands on the UI palette, never as a new shade). */
const nearestCache = new Map();
export function nearestColour(hex) {
  const key = String(hex).toLowerCase();
  if (nearestCache.has(key)) return nearestCache.get(key);
  const v = key.startsWith("#") && key.length >= 7 ? [parseInt(key.slice(1, 3), 16), parseInt(key.slice(3, 5), 16), parseInt(key.slice(5, 7), 16)] : [255, 255, 255];
  let best = PAL.white,
    bestD = Infinity;
  for (const c of Object.values(PAL)) {
    const d = (parseInt(c.slice(1, 3), 16) - v[0]) ** 2 + (parseInt(c.slice(3, 5), 16) - v[1]) ** 2 + (parseInt(c.slice(5, 7), 16) - v[2]) ** 2;
    if (d < bestD) (bestD = d), (best = c);
  }
  nearestCache.set(key, best);
  return best;
}
/** Even-snap a canvas coordinate to the art grid (a world-anchored UI element
 * lands on the 2 px grid whatever the camera's 1 px rounding did). */
export const toArt = (canvasPx) => Math.round(canvasPx / A);

// --------------------------------------------------------- canvas plumbing --
let canvasFactory = (w, h) => {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
};
export function setCanvasFactory(fn) {
  canvasFactory = fn;
}
const noSmooth = (ctx) => ((ctx.imageSmoothingEnabled = false), ctx);

/** A painter in art pixels over any 2D context: `s` canvas px per art px (2 on
 * the screen, 1 when baking a sprite), offset (ox, oy) in canvas px. Only whole
 * art pixels ever reach the context. */
export class Grid {
  constructor(ctx, s = A, ox = 0, oy = 0) {
    this.ctx = ctx;
    this.s = s;
    this.ox = ox;
    this.oy = oy;
  }
  rect(x, y, w, h, color) {
    if (w <= 0 || h <= 0) return this;
    const { ctx, s } = this;
    ctx.fillStyle = color;
    ctx.fillRect(this.ox + Math.round(x) * s, this.oy + Math.round(y) * s, Math.round(w) * s, Math.round(h) * s);
    return this;
  }
  px(x, y, color) {
    return this.rect(x, y, 1, 1, color);
  }
  /** A rectangle with its four corner pixels cut: the kit's one rounded look. */
  notched(x, y, w, h, color) {
    this.rect(x + 1, y, w - 2, h, color);
    this.rect(x, y + 1, 1, h - 2, color);
    return this.rect(x + w - 1, y + 1, 1, h - 2, color);
  }
  frame(x, y, w, h, t, color) {
    this.rect(x, y, w, t, color);
    this.rect(x, y + h - t, w, t, color);
    this.rect(x, y + t, t, h - 2 * t, color);
    return this.rect(x + w - t, y + t, t, h - 2 * t, color);
  }
  disc(cx, cy, r, color) {
    const spans = discSpans(r);
    spans.forEach((hw, i) => this.rect(cx - hw, cy - r + i, hw * 2 + 1, 1, color));
    return this;
  }
  ellipse(cx, cy, rx, ry, color) {
    ellipseSpans(rx, ry).forEach((hw, i) => this.rect(cx - hw, cy - ry + i, hw * 2 + 1, 1, color));
    return this;
  }
  /** An elliptical ring `t` px thick (outer radii rx, ry). */
  ellipseRing(cx, cy, rx, ry, t, color) {
    const outer = ellipseSpans(rx, ry),
      inner = rx - t >= 0 && ry - t >= 0 ? ellipseSpans(rx - t, ry - t) : null;
    outer.forEach((hw, i) => {
      const dy = i - ry,
        ii = dy + (ry - t),
        ih = inner && ii >= 0 && ii < inner.length ? inner[ii] : -1;
      if (ih < 0) this.rect(cx - hw, cy + dy, hw * 2 + 1, 1, color);
      else {
        this.rect(cx - hw, cy + dy, hw - ih, 1, color);
        this.rect(cx + ih + 1, cy + dy, hw - ih, 1, color);
      }
    });
    return this;
  }
  /** A straight line of 1 art px squares (Bresenham). */
  line(x0, y0, x1, y1, color) {
    x0 = Math.round(x0);
    y0 = Math.round(y0);
    x1 = Math.round(x1);
    y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0),
      dy = -Math.abs(y1 - y0),
      sx = x0 < x1 ? 1 : -1,
      sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (;;) {
      this.px(x0, y0, color);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) (err += dy), (x0 += sx);
      if (e2 <= dx) (err += dx), (y0 += sy);
    }
    return this;
  }
  /** Draw a row table: `rows` strings, `map` letter -> colour ('.' is empty). */
  rows(x, y, rows, map) {
    rows.forEach((row, j) => {
      let i = 0;
      while (i < row.length) {
        const ch = row[i];
        let n = 1;
        while (i + n < row.length && row[i + n] === ch) n++;
        if (ch !== "." && ch !== " " && map[ch]) this.rect(x + i, y + j, n, 1, map[ch]);
        i += n;
      }
    });
    return this;
  }
}

/** Bake art-pixel drawing into a canvas of w x h pixels (1 canvas px per art px). */
export function bake(w, h, paint) {
  const c = canvasFactory(w, h),
    ctx = noSmooth(c.getContext("2d"));
  paint(new Grid(ctx, 1), w, h);
  return c;
}
/** Draw a baked sprite at art coordinates, scaled by whole art pixels. */
export function blit(ctx, sprite, x, y, flip = false) {
  noSmooth(ctx);
  const w = sprite.width * A,
    h = sprite.height * A;
  if (!flip) ctx.drawImage(sprite, Math.round(x) * A, Math.round(y) * A, w, h);
  else {
    ctx.save();
    ctx.translate(Math.round(x) * A + w, Math.round(y) * A);
    ctx.scale(-1, 1);
    ctx.drawImage(sprite, 0, 0, w, h);
    ctx.restore();
  }
}
const cache = new Map();
/** Memoise a baked sprite by key (sprites are small and few). */
export function sprite(key, w, h, paint) {
  let c = cache.get(key);
  if (!c) {
    c = bake(w, h, paint);
    cache.set(key, c);
  }
  return c;
}

/** Rotate a baked sprite by nearest-neighbour sampling into a bigger canvas:
 * a tilted sprite is still whole art pixels of palette colours (never blended),
 * which is how the kit draws a tilted sticker. */
export function rotated(source, angle) {
  const w = source.width,
    h = source.height,
    cos = Math.cos(angle),
    sin = Math.sin(angle),
    nw = Math.ceil(Math.abs(w * cos) + Math.abs(h * sin)) + 1,
    nh = Math.ceil(Math.abs(w * sin) + Math.abs(h * cos)) + 1,
    src = noSmooth(source.getContext("2d")).getImageData(0, 0, w, h),
    out = canvasFactory(nw, nh),
    octx = out.getContext("2d"),
    dst = octx.createImageData(nw, nh);
  for (let y = 0; y < nh; y++)
    for (let x = 0; x < nw; x++) {
      const dx = x + 0.5 - nw / 2,
        dy = y + 0.5 - nh / 2,
        sx = Math.floor(dx * cos + dy * sin + w / 2),
        sy = Math.floor(-dx * sin + dy * cos + h / 2);
      if (sx < 0 || sy < 0 || sx >= w || sy >= h) continue;
      const si = (sy * w + sx) * 4;
      if (src.data[si + 3] < 128) continue;
      const di = (y * nw + x) * 4;
      dst.data.set([src.data[si], src.data[si + 1], src.data[si + 2], 255], di);
    }
  octx.putImageData(dst, 0, 0);
  return out;
}

// --------------------------------------------------------------- dithering --
const scrimPatterns = new Map();
/** A repeating Bayer pattern of one palette colour, 4x4 art px (8x8 canvas px),
 * built at canvas resolution so the browser never resamples it. */
function scrimPattern(ctx, level, color) {
  const key = `${level}|${color}`;
  let pattern = scrimPatterns.get(key);
  if (!pattern) {
    const c = canvasFactory(4 * A, 4 * A),
      g = new Grid(c.getContext("2d"));
    for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) if (ditherOn(x, y, level)) g.px(x, y, color);
    pattern = ctx.createPattern(c, "repeat");
    scrimPatterns.set(key, pattern);
  }
  return pattern;
}
/** Dim or tint a rectangle of the screen with `level`/16 of its pixels set to
 * one palette colour: the replacement for every translucent overlay. Canvas
 * px rectangle (the whole screen by default); the pattern origin is the canvas
 * origin, so it stays on the grid. */
export function scrim(ctx, level, color = PAL.void, x = 0, y = 0, w = 960, h = 540) {
  if (level <= 0) return;
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = level >= 16 ? color : scrimPattern(ctx, level, color);
  ctx.fillRect(Math.round(x / A) * A, Math.round(y / A) * A, Math.round(w / A) * A, Math.round(h / A) * A);
  ctx.restore();
}

// -------------------------------------------------------------- bitmap text --
const GLYPH_W = 6; // monogram: 5 px wide glyphs on a 6 px pitch (monospace)
const glyphs = new Map();
let glyphCtx = null;
const GLYPH_BASE = 40; // canvas baseline of the 32 px bake
/** Bake one character: the monogram font drawn at 32 px (each font pixel is 2x2
 * px there, and exactly on an even boundary), thresholded so only "on" and
 * "off" survive, then sampled once per font pixel. The font has a faint ~14%
 * alpha fringe around every pixel at the sizes the browser draws it; the
 * threshold is what removes it. Returns [[x, y], ...] with y relative to the
 * baseline (negative above it). */
function bakeGlyph(ch) {
  if (!glyphCtx) {
    const c = canvasFactory(48, 64);
    glyphCtx = c.getContext("2d", { willReadFrequently: true });
  }
  const g = glyphCtx;
  g.clearRect(0, 0, 48, 64);
  g.font = "32px monogram, ui-monospace, monospace";
  g.textBaseline = "alphabetic";
  g.textAlign = "left";
  g.fillStyle = "#fff";
  g.fillText(ch, 4, GLYPH_BASE);
  const data = g.getImageData(0, 0, 48, 64).data,
    px = [];
  for (let by = 0; by < 32; by++)
    for (let bx = 0; bx < 24; bx++) {
      let sum = 0;
      for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) sum += data[((by * 2 + dy) * 48 + bx * 2 + dx) * 4 + 3];
      if (sum >= 440) px.push([bx - 2, by - GLYPH_BASE / 2]);
    }
  return px;
}
export function glyph(ch) {
  let rec = glyphs.get(ch);
  if (!rec) {
    rec = bakeGlyph(ch);
    glyphs.set(ch, rec);
  }
  return rec;
}
/** Text width in art px at font-pixel size `s` (1 or 2 art px per font pixel). */
export const textWidth = (str, s = 1) => [...str].length * GLYPH_W * s;
const textSprites = new Map();
const hexRgb = (hex) => [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
/** A text sprite at one pixel per FONT pixel, with a 1 font-pixel outline and an
 * optional (+1,+1) drop shadow, all palette colours. */
function textSprite(str, color, outline, shadow) {
  const key = `${str}\u0001${color}\u0001${outline}\u0001${shadow}`;
  let rec = textSprites.get(key);
  if (rec) return rec;
  const chars = [...str],
    pad = outline || shadow ? 1 : 0,
    top = 10 + pad,
    w = chars.length * GLYPH_W + pad * 2 + (shadow ? 1 : 0),
    h = top + 4 + pad + (shadow ? 1 : 0),
    on = new Uint8Array(w * h);
  chars.forEach((ch, i) => {
    for (const [x, y] of glyph(ch)) {
      const gx = i * GLYPH_W + x + pad,
        gy = top + y;
      if (gx >= 0 && gx < w && gy >= 0 && gy < h) on[gy * w + gx] = 1;
    }
  });
  const c = canvasFactory(Math.max(1, w), Math.max(1, h)),
    ctx = c.getContext("2d"),
    img = ctx.createImageData(c.width, c.height),
    put = (i, hex) => img.data.set([...hexRgb(hex), 255], i * 4);
  // Order: shadow, then outline, then the glyph itself.
  if (shadow || outline) {
    const ring = new Uint8Array(w * h);
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        for (let dy = -1; dy <= 1 && !ring[y * w + x]; dy++)
          for (let dx = -1; dx <= 1; dx++) {
            const nx = x + dx,
              ny = y + dy;
            if (nx >= 0 && ny >= 0 && nx < w && ny < h && on[ny * w + nx]) {
              ring[y * w + x] = 1;
              break;
            }
          }
      }
    if (shadow)
      for (let y = 1; y < h; y++) for (let x = 1; x < w; x++) if (ring[(y - 1) * w + x - 1] || on[(y - 1) * w + x - 1]) put(y * w + x, shadow);
    if (outline) for (let i = 0; i < w * h; i++) if (ring[i]) put(i, outline);
  }
  for (let i = 0; i < w * h; i++) if (on[i]) put(i, color);
  ctx.putImageData(img, 0, 0);
  rec = { canvas: c, pad, top };
  if (textSprites.size > 600) textSprites.delete(textSprites.keys().next().value);
  textSprites.set(key, rec);
  return rec;
}
/** Draw text on the art grid. (x, y) is in art px and y is the BASELINE row
 * (the first row under the capitals), as with the old canvas text. `s` is art
 * px per font pixel: 1 for body text, 2 for headings. `outline` defaults to
 * ink; pass null for none. `shadow` is a palette colour or null. */
export function drawText(ctx, str, x, y, { s = 1, color = PAL.white, align = "left", outline = PAL.ink, shadow = null } = {}) {
  if (!str) return 0;
  const rec = textSprite(String(str), color, outline, shadow),
    width = textWidth(String(str), 1);
  const left = align === "center" ? x - Math.floor((width * s) / 2) : align === "right" ? x - width * s : x;
  noSmooth(ctx);
  ctx.drawImage(rec.canvas, Math.round(left - rec.pad * s) * A, Math.round(y - rec.top * s) * A, rec.canvas.width * s * A, rec.canvas.height * s * A);
  return width * s;
}
/** Wrap text to a width in art px (monospace, so by character count). */
export function wrapText(str, maxWidth, s = 1) {
  const per = Math.max(1, Math.floor(maxWidth / (GLYPH_W * s))),
    lines = [];
  let line = "";
  for (const word of String(str).split(/\s+/)) {
    if ((line + " " + word).trim().length > per) {
      if (line) lines.push(line);
      line = word;
    } else line = (line + " " + word).trim();
  }
  if (line) lines.push(line);
  return lines;
}

// ------------------------------------------------------------- sprite tables --
/** The three form glyphs (white square, green triangle, red diamond) at the two
 * sizes the UI uses, as row tables. Shape, not hue, tells the forms apart. */
export const GLYPH_ROWS = Object.freeze({
  5: {
    white: ["#####", "#...#", "#...#", "#...#", "#####"],
    green: ["..#..", ".###.", ".###.", "#####", "#####"],
    red: ["..#..", ".###.", "#####", ".###.", "..#.."],
  },
  7: {
    white: ["#######", "#######", "##...##", "##...##", "##...##", "#######", "#######"],
    green: ["...#...", "..###..", "..###..", ".#####.", ".#####.", "#######", "#######"],
    red: ["...#...", "..###..", ".#####.", "#######", ".#####.", "..###..", "...#..."],
  },
});
/** A form glyph sprite: coloured shapes get a 1 px ink outline so they hold their
 * edge on a pale field when hue collapses (the colour-blind rule); the white
 * square is its own ink outline. */
export function glyphSprite(color, size = 7, fill = null, ink = PAL.ink) {
  const rows = GLYPH_ROWS[size][color],
    paint = fill ?? (color === "white" ? PAL.ink : FORM[color]),
    outlined = color !== "white",
    pad = outlined ? 1 : 0;
  return sprite(`glyph|${color}|${size}|${paint}|${ink}`, size + pad * 2, size + pad * 2, (g) => {
    if (outlined) {
      const set = (dx, dy) => g.rows(pad + dx, pad + dy, rows, { "#": ink });
      for (const [dx, dy] of [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]]) set(dx, dy);
    }
    g.rows(pad, pad, rows, { "#": paint });
  });
}
/** The colour badge: an ink-rimmed cream disc wearing the form's glyph. */
export function badgeSprite(color) {
  return sprite(`badge|${color}`, 11, 11, (g) => {
    g.disc(5, 5, 5, PAL.ink);
    g.disc(5, 5, 4, PAL.cream);
    const glyphCanvas = glyphSprite(color, 5, color === "white" ? PAL.ink : FORM[color]);
    g.ctx.drawImage(glyphCanvas, 5 - Math.floor(glyphCanvas.width / 2) + 0, 5 - Math.floor(glyphCanvas.height / 2));
  });
}

const HEART_ROWS = [
  ".III...III.",
  "IHHRI.IRRRI",
  "IHRRRIRRRRI",
  "IRRRRRRRRDI",
  "IRRRRRRRRDI",
  ".IRRRRRRDI.",
  "..IRRRRDI..",
  "...IRRDI...",
  "....IDI....",
  ".....I.....",
];
/** A 11x10 art-px heart. Full = red with highlight; empty = a dark, cracked
 * heart whose crack is ink: fill AND shape differ (colour-blind safe). */
export function heartSprite(state) {
  return sprite(`heart|${state}`, 11, 10, (g) => {
    if (state === "full") g.rows(0, 0, HEART_ROWS, { I: PAL.ink, R: PAL.red, D: PAL.redDark, H: PAL.rose });
    else {
      g.rows(0, 0, HEART_ROWS, { I: PAL.ink, R: PAL.slate, D: PAL.void, H: PAL.stone });
      // The crack: a zigzag knocked through the middle in ink.
      for (const [x, y] of [[5, 1], [4, 2], [5, 3], [4, 4], [5, 5], [4, 6]]) g.px(x, y, PAL.ink);
    }
  });
}

const MINI_HEART_ROWS = [".III.III.", "IRRRIRRRI", "IRRRRRRRI", "IRRRRRRDI", ".IRRRRDI.", "..IRRDI..", "...IDI...", "....I...."];
/** A 9x8 heart for dense places (the chain meter). */
export function miniHeartSprite(state) {
  return sprite(`miniheart|${state}`, 9, 8, (g) => g.rows(0, 0, MINI_HEART_ROWS, state === "full" ? { I: PAL.ink, R: PAL.red, D: PAL.redDark } : { I: PAL.ink, R: PAL.slate, D: PAL.void }));
}
/** A sticker, n x n art px, authored upright (ink rim, white border, gold field,
 * a cream peeled corner so the shape differs from round pickups), then
 * pre-rotated 7 degrees counter-clockwise as a sprite. */
export function stickerSprite(n = 10, tilt = -0.12) {
  return sprite(`sticker|${n}|${tilt}`, n + 4, n + 4, (g, w, h) => {
    const base = bake(n, n, (b) => {
      b.rect(0, 0, n, n, PAL.ink);
      b.rect(1, 1, n - 2, n - 2, PAL.white);
      b.rect(2, 2, n - 4, n - 4, PAL.lemon);
      b.rect(2, n - 4, n - 4, 2, PAL.gold);
      const peel = Math.max(2, Math.round(n / 4));
      for (let i = 0; i < peel; i++) b.rect(n - 2 - i, n - 2 - peel + 1 + i, i + 1, 1, PAL.cream);
    });
    const tilted = tilt ? rotated(base, tilt) : base;
    g.ctx.drawImage(tilted, Math.floor((w - tilted.width) / 2), Math.floor((h - tilted.height) / 2));
  });
}

// ---------------------------------------------------------------- painters --
/** The kit's panel family. Every one is: an ink outline with notched corners,
 * a hard (+1,+1) void shadow, and flat fills. `card` is the Uno-style one with
 * a cream rim and a plum field (menus, results, the level card). */
export function paintCard(g, x, y, w, h, { field = PAL.plum, rim = PAL.cream, shadow = true } = {}) {
  if (shadow) g.notched(x + 1, y + 1, w, h, PAL.void);
  g.notched(x, y, w, h, PAL.ink);
  g.notched(x + 1, y + 1, w - 2, h - 2, rim);
  g.rect(x + 3, y + 3, w - 6, h - 6, PAL.ink);
  g.rect(x + 4, y + 4, w - 8, h - 8, field);
}
/** A small HUD plate: ink outline, plum field, a one-pixel lighter top edge. */
export function paintPlate(g, x, y, w, h, { field = PAL.plum, edge = PAL.mauve, shadow = true } = {}) {
  if (shadow) g.notched(x + 1, y + 1, w, h, PAL.void);
  g.notched(x, y, w, h, PAL.ink);
  g.rect(x + 1, y + 1, w - 2, h - 2, field);
  g.rect(x + 1, y + 1, w - 2, 1, edge);
}
/** A speech bubble with a three-step tail pointing down at (x + w/2, y + h + 3). */
export function paintBubble(g, x, y, w, h, fill = PAL.cream) {
  g.notched(x, y, w, h, PAL.ink);
  g.rect(x + 1, y + 1, w - 2, h - 2, fill);
  const cx = x + Math.floor(w / 2);
  g.rect(cx - 2, y + h, 5, 1, PAL.ink);
  g.rect(cx - 1, y + h + 1, 3, 1, PAL.ink);
  g.px(cx, y + h + 2, PAL.ink);
  g.rect(cx - 1, y + h - 1, 3, 1, fill);
  g.px(cx, y + h, fill);
}
/** A keycap: ink outline, cream face, a mist shade row under the label. */
export function paintKey(g, x, y, w, h) {
  g.notched(x, y, w, h, PAL.ink);
  g.rect(x + 1, y + 1, w - 2, h - 2, PAL.cream);
  g.rect(x + 1, y + h - 2, w - 2, 1, PAL.mist);
}
/** A button face (9-slice source: 9x9, slice 3): notched ink outline, a light
 * top row, a dark bottom row. `look` picks the state's colours. */
export const BUTTON_LOOKS = Object.freeze({
  normal: { face: PAL.mauve, light: PAL.stone, shade: PAL.void },
  hover: { face: PAL.stone, light: PAL.fog, shade: PAL.slate },
  down: { face: PAL.void, light: PAL.void, shade: PAL.plum },
  primary: { face: PAL.red, light: PAL.rose, shade: PAL.redDark },
  primaryHover: { face: PAL.rose, light: PAL.white, shade: PAL.red },
  quiet: { face: PAL.void, light: PAL.plum, shade: PAL.ink },
  on: { face: PAL.forest, light: PAL.green, shade: PAL.void },
  off: { face: PAL.void, light: PAL.plum, shade: PAL.ink },
});
export function paintButton(g, x, y, w, h, look) {
  const c = BUTTON_LOOKS[look];
  g.notched(x, y, w, h, PAL.ink);
  g.rect(x + 1, y + 1, w - 2, h - 2, c.face);
  g.rect(x + 1, y + 1, w - 2, 1, c.light);
  g.rect(x + 1, y + h - 2, w - 2, 1, c.shade);
}
/** A sticker socket, n x n: a sunken well (dark top-left lip, light bottom-right). */
export function paintSocket(g, x, y, n) {
  g.notched(x, y, n, n, PAL.ink);
  g.rect(x + 1, y + 1, n - 2, n - 2, PAL.void);
  g.rect(x + 1, y + n - 2, n - 2, 1, PAL.mauve);
  g.rect(x + n - 2, y + 1, 1, n - 2, PAL.mauve);
}
/** A form card (Uno-style): ink outline, cream rim, coloured field, a cream
 * oval and the form's glyph. */
export function paintFormCard(g, x, y, w, h, color) {
  g.notched(x, y, w, h, PAL.ink);
  g.notched(x + 1, y + 1, w - 2, h - 2, PAL.cream);
  g.rect(x + 2, y + 2, w - 4, h - 4, FORM[color]);
  const rx = Math.floor((w - 4) / 2) - 2,
    ry = Math.floor((h - 4) / 2) - 3;
  g.ellipse(x + Math.floor(w / 2), y + Math.floor(h / 2), rx, ry, PAL.cream);
  const size = w >= 19 ? 7 : 5,
    gs = glyphSprite(color, size, color === "white" ? PAL.slate : null);
  g.ctx.drawImage(gs, g.ox + (x + Math.floor((w - gs.width) / 2)) * g.s, g.oy + (y + Math.floor((h - gs.height) / 2)) * g.s, gs.width * g.s, gs.height * g.s);
}
/** The pixel arrows and icons (row tables; # = ink-or-given colour). */
export const ICON_ROWS = Object.freeze({
  arrowRight: ["#....", "##...", "###..", "####.", "###..", "##...", "#...."],
  arrowLeft: ["....#", "...##", "..###", ".####", "..###", "...##", "....#"],
  arrowUp: ["...#...", "..###..", ".#####.", "#######"],
  arrowDown: ["#######", ".#####.", "..###..", "...#..."],
  note: ["....####.", "....#..##", "....#..#.", "....#....", "..###....", ".####....", ".####....", "..##.....", "........."],
  pause: ["###.###", "###.###", "###.###", "###.###", "###.###", "###.###", "###.###", "###.###", "###.###"],
  expand: ["####...####", "##.......##", "#.........#", "#.........#", "...........", "...........", "...........", "#.........#", "#.........#", "##.......##", "####...####"],
  ghost: [
    "...#####...",
    "..#######..",
    ".#########.",
    ".#########.",
    ".##..#..##.",
    ".##..#..##.",
    ".#########.",
    ".#########.",
    ".#########.",
    ".#########.",
    ".##.###.##.",
    ".#...#...#.",
  ],
  stomp: ["....###....", "....###....", "....###....", ".#########.", "..#######..", "...#####...", "....###....", ".....#.....", "###########", "###########"],
});
export function paintIcon(g, name, x, y, color, rows = ICON_ROWS[name]) {
  g.rows(x, y, rows, { "#": color });
}
/** An icon with a 1 px ink outline all round (for icons that sit on the world). */
export function paintOutlinedIcon(g, x, y, rows, color) {
  for (const [dx, dy] of [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]]) g.rows(x + dx, y + dy, rows, { "#": PAL.ink });
  g.rows(x, y, rows, { "#": color });
}
/** A dashed pixel ring of one colour (dashes every 1/24 turn). */
export function paintDashedRing(g, cx, cy, r, color, offset = 0) {
  for (const p of ringPixels(r, 1)) if ((Math.floor(p.turn * 24 + offset) & 1) === 0) g.px(cx + p.dx, cy + p.dy, color);
}
/** A stamp seal: earned = a filled red disc with a cream dashed ring; not earned
 * = a hollow dark well with a grey dashed ring (fill and shape differ). r = 13
 * gives a 29 px seal. */
export function paintSeal(g, cx, cy, r, earned) {
  g.disc(cx + 1, cy + 1, r + 1, PAL.void);
  g.disc(cx, cy, r + 1, PAL.ink);
  g.disc(cx, cy, r, earned ? PAL.red : PAL.void);
  if (earned) {
    // A darker lower-right crescent for body, then the ring.
    for (const p of ringPixels(r, 3)) if (p.turn > 0.25 && p.turn < 0.5) g.px(cx + p.dx, cy + p.dy, PAL.redDark);
  }
  paintDashedRing(g, cx, cy, r - 2, earned ? PAL.cream : PAL.stone);
}
/** A chalk 3x3 cube face: nine cells of `cell` art px, a 1 px outline each
 * (`line`), filled with `fill(i)` (a colour or null for an empty cell). */
export function paintChalkFace(g, x, y, cell, line, fill) {
  for (let i = 0; i < 9; i++) {
    const cx = x + (i % 3) * cell,
      cy = y + Math.floor(i / 3) * cell,
      f = typeof fill === "function" ? fill(i) : fill;
    g.frame(cx, cy, cell, cell, 1, line);
    if (f) g.rect(cx + 1, cy + 1, cell - 2, cell - 2, f);
  }
}

// ------------------------------------------------------- iris, flash, edges --
let irisCanvas = null;
let irisMask = null;
/** The Rubik-face iris as a pixel-stepped zoom (t: 1 closed .. 0 open). The
 * cut-out is drawn at a ladder factor so its art pixels stay whole blocks. */
export function paintIris(ctx, t, cutout, cx = 480, cy = 270, W = 960, H = 540) {
  if (t <= 0) return;
  if (t >= 1) {
    ctx.fillStyle = PAL.ink;
    ctx.fillRect(0, 0, W, H);
    return;
  }
  const aw = W / A,
    ah = H / A;
  if (!irisCanvas) {
    irisCanvas = canvasFactory(aw, ah);
    irisMask = irisCanvas.getContext("2d", { willReadFrequently: false });
    noSmooth(irisMask);
  }
  const f = irisFactor(t),
    m = irisMask,
    ax = Math.round(cx / A),
    ay = Math.round(cy / A);
  m.globalCompositeOperation = "source-over";
  m.fillStyle = PAL.ink;
  m.fillRect(0, 0, aw, ah);
  m.globalCompositeOperation = "destination-out";
  const dw = Math.round(cutout.width * f),
    dh = Math.round(cutout.height * f);
  m.drawImage(cutout, ax - Math.floor(dw / 2), ay - Math.floor(dh / 2), dw, dh);
  noSmooth(ctx);
  ctx.drawImage(irisCanvas, 0, 0, aw * A, ah * A);
}

/** A dithered frame along the screen edges (the hit flash): three bands, each
 * its own density, of one palette colour. `k` 0..1 scales the whole thing in
 * steps of a quarter. */
export function paintEdgeFlash(ctx, k, color = PAL.red, W = 960, H = 540) {
  const steps = Math.ceil(Math.max(0, Math.min(1, k)) * 4);
  if (!steps) return;
  const bands = [
    [5, 9],
    [5, 6],
    [4, 3],
    [4, 1],
  ].map(([w, lvl]) => [w * A, Math.min(16, Math.round((lvl * steps) / 4))]);
  let inset = 0;
  for (const [w, level] of bands) {
    scrim(ctx, level, color, inset, inset, W - inset * 2, w);
    scrim(ctx, level, color, inset, H - inset - w, W - inset * 2, w);
    scrim(ctx, level, color, inset, inset + w, w, H - (inset + w) * 2);
    scrim(ctx, level, color, W - inset - w, inset + w, w, H - (inset + w) * 2);
    inset += w;
  }
}

// ---------------------------------------------------------------- CSS side --
/** The sprites the DOM uses, as data URLs in CSS custom properties on `root`
 * (they are baked here, by the same painters, so a menu button and a canvas
 * button are the same pixels). 9-slice sources are drawn at 1 canvas px per
 * art px; CSS scales them by whole art pixels with image-rendering: pixelated.
 * Returns the variable map (tests read it). */
export function cssSprites() {
  const url = (c) => `url(${c.toDataURL("image/png")})`,
    out = {};
  // Card panel with its (+1,+1) shadow in the image: 4 | 4 | 4 + 1.
  out["--spr-card"] = url(bake(13, 13, (g) => paintCard(g, 0, 0, 12, 12)));
  // Plate: 3 | 1 | 3 + 1 of shadow.
  out["--spr-plate"] = url(bake(8, 8, (g) => paintPlate(g, 0, 0, 7, 7)));
  for (const [name, look] of [["btn", "normal"], ["btn-hover", "hover"], ["btn-down", "down"], ["btn-primary", "primary"], ["btn-primary-hover", "primaryHover"], ["btn-quiet", "quiet"], ["btn-on", "on"], ["btn-off", "off"]])
    out[`--spr-${name}`] = url(bake(9, 9, (g) => paintButton(g, 0, 0, 9, 9, look)));
  out["--spr-key"] = url(bake(7, 7, (g) => paintKey(g, 0, 0, 7, 7)));
  const icon = (name, color, w, h) => url(bake(w, h, (g) => paintIcon(g, name, 0, 0, color)));
  out["--spr-note"] = icon("note", PAL.cream, 9, 9);
  // Music off: the note greyed with a diagonal slash (shape as well as tone).
  out["--spr-note-off"] = url(
    bake(9, 9, (g) => {
      paintIcon(g, "note", 0, 0, PAL.stone);
      for (let i = 0; i < 9; i++) g.px(i, 8 - i, PAL.rose);
    }),
  );
  out["--spr-pause"] = icon("pause", PAL.cream, 7, 9);
  out["--spr-expand"] = icon("expand", PAL.cream, 11, 11);
  out["--spr-arrow-right"] = icon("arrowRight", PAL.cream, 5, 7);
  out["--spr-arrow-left"] = icon("arrowLeft", PAL.cream, 5, 7);
  for (const color of ["white", "green", "red"]) out[`--spr-form-${color}`] = url(bake(20, 28, (g) => paintFormCard(g, 0, 0, 20, 28, color)));
  return out;
}
/** Install the sprites as CSS custom properties. (The palette is static in
 * style.css, and tests/pixel-ui.test.mjs keeps the two identical.) */
export function installCss(root = document.documentElement) {
  for (const [name, value] of Object.entries(cssSprites())) root.style.setProperty(name, value);
}
