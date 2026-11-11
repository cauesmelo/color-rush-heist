/** The ending pages and the credit cards, drawn with the pixel kit
 * (pixel-ui.mjs, rules in UI_STYLE.md). What is shown and for how long is DATA
 * in credits.mjs; this module only paints it. Like ui-draw.mjs it takes an `env`
 * of live state and the few helpers ui-draw.mjs already owns (the dither
 * cross-fade, the scrim, the iris), and returns draw functions.
 *
 * All coordinates are ART PIXELS (the screen is 480 x 270; one art pixel is 2
 * canvas px). Colour comes back as an ordered DITHER (pixels switch between two
 * textures, never blend), a card arrives in four discrete steps, and nothing is
 * rotated or scaled by a fraction. */
import { A, PAL, BAYER4, drawText, textWidth, wrapText, paintCard } from "./pixel-ui.mjs";
import * as R from "./credits.mjs";

const AW = 480,
  AH = 270,
  HOME = R.HOME;
/** The baked "PRESS ANY KEY TO START" strip of title_screen.png (art px, y1 and x1
 * exclusive) and how far below it the pixels that replace it are taken. */
const TITLE_LINE = { x0: 100, x1: 380, y0: 181, y1: 204, shift: 18 };

export function createEndingDraw(env, { g, T, ditherDraw, iris }) {
  const { ctx, C, img, derived } = env;
  const live = () => !env.reducedMotion;

  // ------------------------------------------------------------ backdrops --
  /** How much colour the forest had before the vault level was won: the map's
   * 12% per cleared level 1-1..1-5. The world clear and the first closing page
   * start from it, so the colour the ending brings back is a real change. */
  function forestBefore() {
    const cleared = C.WORLD1.slice(0, -1).filter((id) => C.isCleared(env.save, id)).length;
    return Math.min(1, cleared * C.COLOR_PER_CLEAR);
  }
  /** The forest at dither `level`/16: bg1's grey, with the colourized copy on the Bayer pattern. */
  function forest(level) {
    ctx.drawImage(img.forest, 0, 0, AW * A, AH * A);
    ditherDraw(derived.forestColor, level, 0, 0, AW, AH, 0, 0, AW * A, AH * A);
  }
  let layer = null,
    maskCanvas = null,
    maskRadius = -1;
  /** The title screen's own art: the forest in all its colours, and the logo.
   * The comic's first beat drains it to bg1's grey; the ending gives it back.
   * Its baked "PRESS ANY KEY TO START" line is wrong here, so it is lifted out
   * once: every pixel of that strip whose colour does not occur in the plain
   * forest rows above and below it is replaced by the pixel 18 rows lower (the
   * same column, so the trunks stay joined). The file is untouched. */
  let clean = null;
  function cleanTitle() {
    if (clean) return clean;
    clean = document.createElement("canvas");
    clean.width = AW;
    clean.height = AH;
    const x = clean.getContext("2d", { willReadFrequently: true });
    x.imageSmoothingEnabled = false;
    x.drawImage(img.title, 0, 0);
    const { x0, x1, y0, y1, shift } = TITLE_LINE,
      data = x.getImageData(0, 0, AW, AH),
      px = new Uint32Array(data.data.buffer),
      forestColours = new Set();
    for (let y = y0 - 8; y < y1 + shift + 8; y++) if (y < y0 || y >= y1) for (let i = x0; i < x1; i++) forestColours.add(px[y * AW + i]);
    const out = px.slice();
    for (let y = y0; y < y1; y++)
      for (let i = x0; i < x1; i++) if (!forestColours.has(px[y * AW + i])) out[y * AW + i] = px[(y + shift) * AW + i];
    data.data.set(new Uint8ClampedArray(out.buffer));
    x.putImageData(data, 0, 0);
    return clean;
  }
  const titleArt = () => ctx.drawImage(cleanTitle(), 0, 0, AW * A, AH * A);
  /** The wave's mask: opaque where the colour is back. Inside the radius it is
   * solid; over the last WAVE_BAND art px the Bayer pattern thins it out, so
   * the front is a dithered ring. Rebuilt only when the radius steps. */
  function waveMask(radius) {
    if (!maskCanvas) {
      maskCanvas = document.createElement("canvas");
      maskCanvas.width = AW;
      maskCanvas.height = AH;
    }
    if (radius === maskRadius) return maskCanvas;
    maskRadius = radius;
    const data = new Uint32Array(AW * AH);
    for (let y = 0; y < AH; y++)
      for (let x = 0; x < AW; x++) {
        const d = Math.hypot(x - HOME.x, y - HOME.wave),
          level = Math.max(0, Math.min(16, Math.round((16 * (radius - d)) / R.WAVE_BAND)));
        if (BAYER4[y & 3][x & 3] < level) data[y * AW + x] = 0xff000000;
      }
    maskCanvas.getContext("2d").putImageData(new ImageData(new Uint8ClampedArray(data.buffer), AW, AH), 0, 0);
    return maskCanvas;
  }
  function wave(radius) {
    if (radius <= 0) return;
    if (!layer) {
      layer = document.createElement("canvas");
      layer.width = AW * A;
      layer.height = AH * A;
    }
    const x = layer.getContext("2d");
    x.imageSmoothingEnabled = false;
    x.globalCompositeOperation = "source-over";
    x.clearRect(0, 0, layer.width, layer.height);
    x.drawImage(cleanTitle(), 0, 0, AW * A, AH * A);
    x.globalCompositeOperation = "destination-in";
    x.drawImage(waveMask(radius), 0, 0, AW * A, AH * A);
    ctx.drawImage(layer, 0, 0);
  }

  // ---------------------------------------------------------------- pieces --
  /** A comic caption: a flat cream box in an ink outline, ink text, the way the
   * original panels carry theirs. (x, y) is the top left; `w` the outer width. */
  function caption(text, x, y, w) {
    const lines = wrapText(text, w - 10),
      h = 20 + (lines.length - 1) * 11;
    g.rect(x, y, w, h, PAL.ink);
    g.rect(x + 1, y + 1, w - 2, h - 2, PAL.cream);
    lines.forEach((line, i) => T(line, x + 5, y + 13 + i * 11, { color: PAL.ink, outline: null }));
    return h;
  }
  /** Rubik on the forest floor with a hard shadow under him. */
  function rubik(form, cx, hop = 0, { feet = HOME.feet, phase = 0 } = {}) {
    g.ellipse(cx, feet, 9, 2, PAL.void);
    const frame = Math.floor(env.clock * 4 + phase) % 2;
    env.drawRubik(form, live() ? frame * 32 : 0, 0, cx * A, (feet - hop) * A, 1);
  }
  /** A small cue in the top right corner: what a press does (shown once it can). */
  function hint(show) {
    if (show) T("any key: next   Esc: skip", AW - 8, 14, { color: PAL.cream, align: "right" });
  }
  /** The iris of the comic: opens on the first page, closes on the last one. */
  function irises(frame) {
    if (!live()) return;
    if (frame.index === 0 && frame.age < 0.8) iris(1 - frame.age / 0.8);
    else if (frame.index === frame.count - 1 && frame.left < 0.8) iris(1 - frame.left / 0.8);
  }

  // ----------------------------------------------------------- the ending ---
  function drawEnding() {
    const reel = env.reel;
    if (!reel) return;
    const f = R.frameOf(reel, env.screenTime),
      id = f.page.id,
      before = Math.round(forestBefore() * 16);
    if (id === "end") titleArt();
    else {
      forest(before);
      if (id === "colors") wave(R.waveRadius(f.age, { reduced: env.reducedMotion }));
    }
    if (id === "end") {
      // The original game's own closing line ("Thanks for playing!", its black page
      // and all) under the logo; below it THE END, and the three forms Rubik wears,
      // hopping one after the other (their highest hop stays under the text).
      const bw = 280,
        bh = 30,
        bx = AW / 2 - bw / 2,
        by = 170;
      paintCard(g, bx - 4, by - 4, bw + 8, bh + 8, { field: PAL.ink });
      ctx.drawImage(img.ending, 100, 120, bw, bh, bx * A, by * A, bw * A, bh * A);
      T("THE END", AW / 2, 226, { s: 2, color: PAL.white, align: "center", shadow: PAL.void });
      if (R.ENDING.teaser) T(R.ENDING.teaser, AW / 2, 242, { color: PAL.white, align: "center", shadow: PAL.void });
      [["white", -44], ["green", 0], ["red", 44]].forEach(([form, dx], i) => {
        const beat = live() ? ((f.age * 3 - i) % 4 + 4) % 4 : 9,
          hop = beat < 1 ? [0, 4, 6, 4][Math.min(3, Math.floor(beat * 4))] : 0;
        rubik(form, HOME.x + dx, hop, { feet: 266, phase: i * 0.5 });
      });
    } else rubik("red", HOME.x); // the only red thing in the forest, then the first
    // Captions: the long one first, the short one a moment later.
    if (f.age >= 0.3 || !live()) caption(f.page.top, 12, 10, 140);
    if (f.page.note && (f.age >= 1.6 || !live())) {
      const w = textWidth(f.page.note) + 12;
      caption(f.page.note, AW - 12 - w, 150, w);
    }
    hint(f.canPress && f.age > 1.2);
    irises(f);
  }

  // ----------------------------------------------------------- the credits --
  /** Rubik in each form, walking home along the bottom of the credits. */
  function parade(t) {
    const x = R.paradeX(t, { reduced: env.reducedMotion });
    [["red", 0], ["green", -38], ["white", -76]].forEach(([form, dx], i) => {
      const at = x + dx + 16;
      if (at < -20 || at > AW + 20) return;
      g.ellipse(at, 252, 9, 2, PAL.void);
      const frame = live() ? Math.floor(env.clock * 6 + i) % 4 : 0;
      env.drawRubik(form, frame * 32, live() ? 64 : 0, at * A, 252 * A, 1);
    });
  }
  /** The credits' one plate. It stands where the title's logo is and covers all of
   * it, so the cards sit on the finished forest like a new title; only the words
   * change, and they change by stepping through four greys-to-white levels
   * (credits.mjs fadeLevel), never by alpha. */
  const PLATE = { x: 100, y: 28, w: 280, h: 130 };
  const RAMP = {
    head: [PAL.void, PAL.stone, PAL.fog, PAL.white],
    name: [PAL.void, PAL.stone, PAL.mist, PAL.cream],
    dim: [PAL.void, PAL.slate, PAL.stone, PAL.mist],
  };
  function card(entry, level, index, count) {
    paintCard(g, PLATE.x, PLATE.y, PLATE.w, PLATE.h);
    // Progress pips along the bottom of the plate: this card in lemon.
    const pipsW = count * 6 - 2,
      px = AW / 2 - Math.floor(pipsW / 2),
      py = PLATE.y + PLATE.h - 13;
    for (let i = 0; i < count; i++) g.rect(px + i * 6, py, 4, 4, i === index ? PAL.lemon : PAL.stone);
    if (level <= 0) return;
    // The words, as one block centred between the plate's top and its pips.
    const rows = [
      ...(entry.note ? [{ text: entry.note, ramp: "dim", advance: 14, outline: null }] : []),
      ...entry.lines.map((text) => ({ text, ramp: "name", advance: 14, outline: PAL.ink })),
      ...(entry.foot ? [{ text: entry.foot, ramp: "dim", advance: 16, outline: null }] : []),
    ];
    const body = rows.length ? 17 + (rows.length - 1) * 14 + (entry.foot && rows.length > 1 ? 2 : 0) : 0,
      block = 14 + body,
      top = Math.round(PLATE.y + 8 + (PLATE.h - 22 - block) / 2);
    let base = top + 14;
    T(entry.head, AW / 2, base, { s: 2, color: RAMP.head[level], align: "center", shadow: level === 3 ? PAL.void : null });
    base += 3;
    rows.forEach((row, i) => {
      base += i === 0 ? 14 : row.advance;
      T(row.text, AW / 2, base, { color: RAMP[row.ramp][level], align: "center", outline: level === 3 ? row.outline : null });
    });
  }
  function drawCredits() {
    const reel = env.reel;
    if (!reel) return;
    const f = R.frameOf(reel, env.screenTime);
    titleArt();
    parade(env.screenTime);
    card(f.page, R.fadeLevel(f.age, f.left, { reduced: env.reducedMotion }), f.index, f.count);
    hint(f.canPress && f.age > 1.2);
    irises(f);
  }

  return { drawEnding, drawCredits, forestBefore, forest };
}
