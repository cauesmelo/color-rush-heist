/** Color Rush Heist: every screen and HUD element that is not the game world,
 * drawn with the pixel kit (pixel-ui.mjs, rules in UI_STYLE.md).
 *
 * game.mjs owns state, input, audio and the world; this module only draws. It is
 * handed an `env` of that state (live getters for the `let` variables) and
 * returns the draw functions, so none of the UI drawing lives in the model and
 * the model never imports it. All coordinates here are ART PIXELS (the screen is
 * 480 x 270; one art pixel is 2 canvas px) unless a name ends in Px. Anything
 * anchored to the world (a bubble over a card, a popup) is converted from the
 * world's canvas px with toArt(). Motion here moves by whole art pixels or in
 * discrete frames; fades are dithers or blinks; nothing is rotated or scaled
 * by a fraction. */
import {
  A, PAL, FORM, Grid, drawText, textWidth, blit, sprite, bake, scrim, nearestColour, toArt, stepped, discSpans,
  ringPixels, ditherOn, ellipseSpans, glyphSprite, badgeSprite, heartSprite, miniHeartSprite, stickerSprite, paintCard, paintPlate,
  paintBubble, paintKey, paintSocket, paintFormCard, paintSeal, paintChalkFace, paintIcon, paintOutlinedIcon, ICON_ROWS,
  paintIris, paintEdgeFlash,
} from "./pixel-ui.mjs";

export const AW = 480,
  AH = 270;

export function createUiDraw(env) {
  const { ctx, M, C, img, derived } = env;
  const g = new Grid(ctx);
  const T = (str, x, y, o = {}) => drawText(ctx, str, x, y, o);
  const tw = (str, s = 1) => textWidth(str, s);
  const col = (hex) => nearestColour(hex);
  /** A form's colour as the UI paints it. */
  const formColour = (c) => FORM[c] ?? PAL.mist;
  const live = () => !env.reducedMotion;

  // ------------------------------------------------------------- primitives --
  /** An ink-outlined icon on the world (the skip arrows, the key arrows). */
  function arrowSprite(dir, color) {
    const rows = ICON_ROWS[{ right: "arrowRight", left: "arrowLeft", up: "arrowUp", down: "arrowDown" }[dir]];
    return sprite(`arrow|${dir}|${color}`, rows[0].length + 2, rows.length + 2, (b) => paintOutlinedIcon(b, 1, 1, rows, color));
  }
  /** A keycap sized to its label; arrows are drawn, not typed. Returns its width. */
  function keycap(label, x, y, { big = false } = {}) {
    const arrow = label === "<" || label === ">",
      w = arrow ? 13 : Math.max(11, tw(label) + 5),
      h = big ? 13 : 11;
    g.notched(x, y, w, h, PAL.ink);
    paintKey(g, x, y, w, h);
    if (arrow) blitArrow(label === "<" ? "left" : "right", x + Math.floor((w - 5) / 2), y + Math.floor((h - 7) / 2) - (big ? 0 : 0), PAL.ink);
    else T(label, x + Math.floor(w / 2), y + Math.floor(h / 2) + 4, { color: PAL.ink, align: "center", outline: null });
    return w;
  }
  function blitArrow(dir, x, y, color) {
    const rows = ICON_ROWS[{ right: "arrowRight", left: "arrowLeft" }[dir]];
    g.rows(x, y, rows, { "#": color });
  }
  /** A keycap centred on a canvas-px point of the world (the door sign). */
  function keycapCentered(label, xPx, yPx) {
    const w = Math.max(11, tw(label) + 5);
    keycap(label, toArt(xPx) - Math.floor(w / 2), toArt(yPx) - 9);
  }
  /** A sticker already in the save: a hollow gold outline with a dithered fill. */
  function stickerOutline(x, y, n = 10) {
    const x0 = x - Math.floor(n / 2),
      y0 = y - Math.floor(n / 2);
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) if (ditherOn(i, j, 4)) g.px(x0 + i, y0 + j, PAL.lemon);
    g.frame(x0, y0, n, n, 1, PAL.gold);
  }
  /** The touch DASH pill: a keycap for the on-screen button. */
  function dashPill(x, y) {
    const w = tw("DASH") + 7;
    g.notched(x, y, w, 13, PAL.ink);
    g.rect(x + 1, y + 1, w - 2, 11, PAL.mauve);
    g.rect(x + 1, y + 1, w - 2, 1, PAL.stone);
    T("DASH", x + Math.floor(w / 2), y + 10, { color: PAL.cream, align: "center", outline: null });
    return w;
  }
  /** A form card at art coordinates, with an optional key under it. */
  function formCard(color, x, y, w, h, keyLabel) {
    paintFormCard(g, x, y, w, h, color);
    if (keyLabel) keycap(keyLabel, x + Math.floor(w / 2) - Math.floor((Math.max(11, tw(keyLabel) + 5)) / 2), y + h + 2);
  }
  /** Cream disc badge with the form glyph, centred on art (x, y). */
  function badge(color, x, y) {
    const s = badgeSprite(color);
    blit(ctx, s, x - 5, y - 5);
  }
  function star(x, y) {
    g.rect(x, y - 2, 1, 5, PAL.lemon);
    g.rect(x - 2, y, 5, 1, PAL.lemon);
  }
  /** One art-pixel plus sign in ink under a lemon one: a spark. */
  function spark(x, y) {
    g.rect(x - 1, y - 3, 3, 7, PAL.ink);
    g.rect(x - 3, y - 1, 7, 3, PAL.ink);
    g.rect(x, y - 2, 1, 5, PAL.lemon);
    g.rect(x - 2, y, 5, 1, PAL.lemon);
  }
  function sticker(x, y, n = 10, glint = -1) {
    const s = stickerSprite(n);
    blit(ctx, s, x - Math.floor(s.width / 2), y - Math.floor(s.height / 2));
    if (glint >= 0 && glint < 1) {
      // A stepped sweep: one pale column crossing the face.
      const gx = x - Math.floor(n / 2) + 2 + Math.floor(glint * (n - 4));
      g.rect(gx, y - Math.floor(n / 2) + 2, 1, n - 4, PAL.white);
    }
  }
  /** A scrim at `level`/16 (the replacement for every translucent overlay). */
  const dim = (level, color = PAL.void) => scrim(ctx, level, color);

  // -------------------------------------------------- world-anchored widgets --
  /** A speech bubble over a point of the world (canvas px), `label` in its middle. */
  function bubble(xPx, yPx, label, { w = 17, h = 17, fill = PAL.cream } = {}) {
    const x = toArt(xPx) - Math.floor(w / 2),
      y = toArt(yPx) - h;
    paintBubble(g, x, y, w, h, fill);
    if (label) T(label, x + Math.floor(w / 2) + (label.length === 1 ? 0 : 0), y + Math.floor(h / 2) + 4, { color: PAL.ink, align: "center", outline: null });
    return { x, y, w, h };
  }
  function note(x, y) {
    // The humming card's drawn music note (the font has no note glyph).
    g.rows(x, y, ICON_ROWS.note, { "#": PAL.ink });
  }
  /** The windup telegraph: the exact ground the strike sweeps, hatched and
   * outlined, dissolving in over the windup (k 0..1) instead of fading. */
  function strikeZone(guard, k) {
    const z = M.strikeZone(guard);
    if (z.w <= 0) return;
    const x0 = toArt(env.wx(z.x)),
      y0 = toArt(env.wy(z.y)),
      w = Math.max(2, toArt(z.w)),
      h = Math.max(2, toArt(z.h)),
      level = live() ? Math.round(5 + 11 * Math.min(1, k * 1.4)) : 15,
      crawl = live() ? Math.floor(env.clock * 24) % 7 : 0,
      dir = guard.dir;
    g.rect(x0 - 1, y0 - 1, w + 2, h + 2, PAL.ink);
    for (let j = 0; j < h; j++)
      for (let i = 0; i < w; i++) {
        if (!ditherOn(x0 + i, y0 + j, level)) continue;
        const u = (((i - dir * j + crawl) % 7) + 7) % 7;
        g.px(x0 + i, y0 + j, u < 2 ? PAL.red : PAL.cream);
      }
    // An ink arrowhead at the far end, in the direction of the sweep.
    const tipX = dir > 0 ? x0 + w + 1 : x0 - 2,
      cy = y0 + Math.floor(h / 2);
    for (let i = 0; i < 6; i++) g.rect(dir > 0 ? tipX + i : tipX - i, cy - (5 - i) - Math.floor(h / 2) + Math.floor(h / 2), 1, (5 - i) * 2 + 1 + (h > 4 ? 2 : 0), PAL.ink);
    // A dashed ink line under the strip: where not to stand.
    const floor = toArt(env.wy(guard.floor));
    for (let i = 0; i < w; i += 6) g.rect(x0 + i, floor - 2, Math.min(3, w - i), 1, PAL.ink);
  }
  /** The recovery's stomp invitation: a ring round the head and a bobbing arrow. */
  function openMarker(xPx, topPx) {
    const x = toArt(xPx),
      top = toArt(topPx),
      b = live() ? Math.round(Math.abs(Math.sin(env.clock * 7)) * 3) : 0,
      y = top - 15 - b;
    g.ellipseRing(x, top + 1, 13, 4, 2, PAL.ink);
    g.ellipseRing(x, top + 1, 12, 3, 1, PAL.lemon);
    // A down arrow: ink outline, lemon body.
    const rows = ["...#####...", "...#####...", "...#####...", "###########", ".#########.", "..#######..", "...#####...", "....###....", ".....#....."];
    paintOutlinedIcon(g, x - 5, y - 4, rows, PAL.lemon);
  }
  /** Dazed: a ring that empties as the daze runs out, stars circling in it. */
  function dazeRing(guard, xPx, yPx) {
    const max = env.dazeMax.get(guard.id) ?? M.ENEMY.charger.daze,
      left = Math.max(0, Math.min(1, guard.timer / max)),
      cx = toArt(xPx),
      cy = toArt(yPx),
      r = 11;
    for (const p of ringPixels(r + 1, 4)) g.px(cx + p.dx, cy + p.dy, PAL.ink);
    for (const p of ringPixels(r, 2)) g.px(cx + p.dx, cy + p.dy, p.turn <= left ? PAL.lemon : PAL.stone);
    for (let i = 0; i < 3; i++) {
      const a = (live() ? env.clock * 4 : 0) + (i * Math.PI * 2) / 3;
      star(cx + Math.round(Math.cos(a) * 5), cy + Math.round(Math.sin(a) * 2));
    }
  }
  /** Floating words ("x3", "+1", "KO!"): outlined bitmap text rising in whole pixels. */
  function drawPopups() {
    for (const q of env.fx.popups) {
      const k = q.age / q.life,
        rise = live() ? Math.round(17 * Math.min(1, k * 1.6)) : 0,
        s = q.size >= 48 ? 2 : 1,
        x = toArt(env.wx(q.x)) - (q.heart ? 6 : 0),
        y = toArt(env.wy(q.y)) - rise;
      // The last third blinks out (a fade is a blend; a blink is whole frames).
      if (k > 0.7 && Math.floor(env.clock * 24) % 2) continue;
      T(q.label, x, y, { s, color: col(q.color), align: "center" });
      if (q.heart) blit(ctx, miniHeartSprite("full"), x + 13, y - 9);
    }
  }
  // Hint bubbles ---------------------------------------------------------------
  const HINTS = {
    move: { keys: ["<", ">"], touch: ["<", ">"] },
    airjump: { keys: ["Space", "Space"], touch: ["JUMP", "JUMP"] },
    behind: { keys: [], touch: [], art: "behind" },
    white: { keys: ["Z"], touch: [], chip: "white", thought: true },
    green: { keys: ["X"], touch: [], chip: "green" },
    dash: { keys: ["Shift"], touch: ["DASH"], dash: true },
  };
  const keyWidth = (label) => (label === "<" || label === ">" ? 13 : Math.max(13, tw(label) + 7));
  function drawHint() {
    const game = env.game,
      id = game.hint;
    if (!id || env.screen !== "play" || game.phase !== "playing") return;
    const hint = HINTS[id],
      p = game.player,
      labels = env.inputMode === "touch" ? hint.touch : hint.keys;
    let w = 8;
    for (const label of labels) w += keyWidth(label) + 3;
    if (hint.chip) w += 17;
    if (hint.dash) w += 17;
    if (hint.art) w += 32;
    w = Math.max(w, 21);
    const h = 22,
      cx = toArt(env.wx(p.x + p.w / 2)),
      by = toArt(env.wy(p.y)) - h - 10,
      x = cx - Math.floor(w / 2);
    // The bubble arrives in a 0.25 s dither-free pop: hidden, then there.
    if (game.hintAge < 0.06) return;
    if (hint.thought) {
      // Two small thought dots: ink discs, never arcs.
      g.disc(cx - 5, by + h + 6, 2, PAL.ink);
      g.disc(cx - 5, by + h + 6, 1, PAL.cream);
    }
    paintBubble(g, x, by, w, h);
    let kx = x + 5;
    const ky = by + 4;
    if (hint.chip) {
      paintFormCard(g, kx, by + 2, 13, 18, hint.chip);
      kx += 17;
    }
    for (const label of labels) kx += keycap(label, kx, ky, { big: true }) + 3;
    if (hint.dash) for (let i = 0; i < 3; i++) g.rect(kx + i * 2, ky + 1 + i * 4, 13 - i * 3, 2, PAL.ink);
    if (hint.art === "behind") {
      // A card facing right (its spear at the front) and an arrow dropping onto its back.
      g.rect(kx + 12, ky + 6, 9, 13, PAL.ink);
      g.rect(kx + 13, ky + 7, 7, 11, PAL.green);
      g.rect(kx + 22, ky + 4, 1, 15, PAL.ink);
      g.rect(kx + 21, ky + 3, 3, 1, PAL.ink);
      g.rows(kx + 11, ky - 1, ICON_ROWS.arrowDown, { "#": PAL.ink });
    }
  }

  // ------------------------------------------------------------ hearts & HUD --
  const HUD_HEARTS = { x: 8, y: 52, step: 13 };
  function heart(x, y, state) {
    blit(ctx, heartSprite(state), x, y);
  }
  function drawHearts(p) {
    const fx = env.fx,
      { x, y, step } = HUD_HEARTS,
      shake = fx.hudShake > 0 && live() ? Math.round(Math.sin(fx.hudShake * 70) * 2 * (fx.hudShake / 0.35)) : 0;
    for (let i = 0; i < M.WORLD.hearts; i++) {
      const hx = x + i * step + shake,
        full = i < p.hp,
        anim = fx.hearts.find((h) => h.i === i && h.age >= 0);
      if (anim?.kind === "gain" && full && live()) {
        // Drops in from above in three steps, with sparks (never a scaled sprite).
        const k = Math.min(1, anim.age / 0.25),
          drop = [-9, -6, -3, 0][Math.min(3, Math.floor(k * 4))];
        heart(hx, y + drop, "full");
        if (anim.age < 0.45) for (let j = 0; j < 4; j++) spark(hx + 5 + Math.round(Math.cos(j * 1.57 + anim.age * 6) * (6 + anim.age * 15)), y + 5 + Math.round(Math.sin(j * 1.57 + anim.age * 6) * (6 + anim.age * 15)));
        continue;
      }
      const beat = full && p.hp === 1 && live() && Math.floor(env.clock * 3.5) % 2 ? -1 : 0;
      heart(hx, y + beat, full ? "full" : "empty");
      if (anim?.kind === "loss" && live()) {
        // The lost heart shatters: two halves slide apart and fall, blinking out.
        const k = Math.min(1, anim.age / 0.6);
        if (!(k > 0.5 && Math.floor(env.clock * 24) % 2)) {
          const half = heartSprite("full");
          for (const side of [-1, 1]) {
            const ox = hx + side * Math.round(2 + k * 8),
              oy = y + Math.round(k * k * 20);
            ctx.save();
            ctx.beginPath();
            ctx.rect((side < 0 ? ox : ox + 5) * A, (oy - 2) * A, 6 * A, 16 * A);
            ctx.clip();
            blit(ctx, half, ox, oy);
            ctx.restore();
          }
        }
      }
    }
    // CHAIN meter while a chain is alive (2+): the count and one pip per link
    // up to the heart it pays, then gold.
    if (p.chain >= 2) {
      const mx = 8,
        my = y + 15,
        paid = p.chain >= M.WORLD.chainHeal;
      paintPlate(g, mx, my, 58, 22, { field: paid ? PAL.wine : PAL.plum });
      T("CHAIN", mx + 4, my + 9, { color: PAL.fog, outline: null });
      T(`x${p.chain}`, mx + 54, my + 9, { color: paid ? PAL.lemon : PAL.white, align: "right", outline: null });
      for (let i = 0; i < M.WORLD.chainHeal; i++) {
        const px = mx + 4 + i * 8,
          py = my + 13;
        if (i === M.WORLD.chainHeal - 1) blit(ctx, miniHeartSprite(i < p.chain ? "full" : "empty"), px, py - 1);
        else {
          g.rect(px, py, 7, 6, PAL.ink);
          g.rect(px + 1, py + 1, 5, 4, i < p.chain ? PAL.cream : PAL.slate);
        }
      }
    }
  }
  const keyFor = (color) => (env.inputMode === "touch" || !env.game.unlocked.green ? null : { white: "Z", green: "X", red: "C" }[color]);
  function drawHud() {
    const { game, fx, settings, LV } = env,
      p = game.player,
      forms = ["white", "green", "red"].filter((c) => game.unlocked[c]),
      inset = Math.round(env.hudInset / A);
    ctx.save();
    ctx.translate(inset * A, 0);
    // Form cards: the current form in front, the unlocked others stacked behind.
    const others = forms.filter((c) => c !== p.color),
      shake = fx.locked > 0 && live() ? Math.round(Math.sin(fx.locked * 60) * 1.5) : 0;
    others.forEach((color, i) => {
      const deal = fx.chipDeal[color] || 0;
      formCard(color, 24 + i * 14 + shake + Math.round(deal * 30), 9 - Math.round(deal * 20), 17, 24, deal > 0.5 ? null : keyFor(color));
    });
    const deal = fx.chipDeal[p.color] || 0;
    formCard(p.color, 8 + shake, 7 - Math.round(deal * 15), 20, 28, deal > 0.5 ? null : keyFor(p.color));
    // After DASH GET: a storm streak pad by the form cards, and a Shift (or
    // DASH) keycap for the first 3 dashes of 1-4.
    if (game.dashUnlocked) {
      const d = fx.chipDeal.dash || 0,
        dx = 9 + forms.length * 14 + 24 + Math.round(d * 25),
        dy = 12 - Math.round(d * 15);
      paintPlate(g, dx, dy, 19, 19, { field: PAL.cream, edge: PAL.white });
      const ink = p.dashCharge > 0 || p.grounded ? PAL.ink : PAL.fog;
      for (let i = 0; i < 3; i++) g.rect(dx + 3 + i * 2, dy + 4 + i * 4, 11 - i * 3, 2, ink);
      if (LV.id === "1-4" && game.dashes < 3 && env.inputMode !== "touch" && d < 0.5) keycap("Shift", dx + 9 - 17, dy + 21);
    }
    drawHearts(p);
    ctx.restore();
    ctx.save();
    ctx.translate(-inset * A, 0);
    // Sticker strip: this level's three slots, top right under the buttons. A
    // sticker in its socket = taken this run; a gold outline = already in the save.
    const sx0 = AW - 8 - 46,
      sy0 = 30;
    paintPlate(g, sx0, sy0, 46, 17);
    game.stickers.forEach((st, i) => {
      const sx = sx0 + 3 + i * 14,
        sy = sy0 + 3;
      paintSocket(g, sx, sy, 11);
      if (st.collected) sticker(sx + 5, sy + 5, 7, -1);
      else if (st.owned) g.frame(sx + 2, sy + 2, 7, 7, 1, PAL.gold);
    });
    let below = sy0 + 24;
    // The "Quick" stamp, shown as the seal it awards: its seconds count down
    // while it can still be earned; at zero the seal empties and the label is
    // struck through (a medal only: nothing fails).
    if (game.stolen && game.theftTime !== null && LV.par !== null) {
      const left = Math.max(0, LV.par - ((game.finishTime ?? game.time) - game.theftTime)),
        on = left > 0,
        cx = sx0 + 10,
        cy = below + 9;
      paintSeal(g, cx, cy, 8, on);
      T(on ? String(Math.ceil(left)) : "-", cx, cy + 4, { color: PAL.white, align: "center", outline: on ? PAL.redDark : null });
      T("Quick", cx + 13, cy + 4, { color: on ? PAL.cream : PAL.stone });
      if (!on) g.rect(cx + 12, cy, 30, 1, PAL.stone);
      below += 22;
    }
    if (settings.timer) T(env.fmtTime(game.time), AW - 8, below + 7, { color: PAL.cream, align: "right" });
    ctx.restore();
    ctx.save();
    ctx.translate(inset * A, 0);
    // During the getaway, a home arrow at the left edge until home is on screen.
    if (game.stolen && game.phase !== "won" && LV.home && LV.home.x1 < env.cam.x) {
      if (!live() || Math.floor(env.clock * 4) % 4 !== 3) {
        const y = AH / 2 - 14;
        paintPlate(g, 5, y, 34, 26, { field: PAL.cream, edge: PAL.white });
        g.rows(8, y + 6, ["....#", "...##", "..###", ".####", "#####", ".####", "..###", "...##", "....#"], { "#": PAL.red });
        paintChalkFace(g, 20, y + 6, 6, PAL.ink, null);
      }
    }
    ctx.restore();
  }

  // ------------------------------------------------------ cards over the play --
  function drawIntro() {
    const { fx, LV, save } = env,
      card = fx.intro;
    if (!card) return;
    const t = card.age,
      out = card.skipped ? Math.min(1, t * 6) : Math.max(0, (t - card.dur) / 0.4),
      a = Math.max(0, Math.min(1, t / 0.12, 1 - out));
    if (a <= 0) return;
    dim(Math.round(4 * a));
    const cw = 150,
      ch = 96,
      x = AW / 2 - cw / 2,
      drop = live() ? [-14, -8, -3, 0][Math.min(3, Math.floor(Math.min(1, t / 0.25) * 4))] : 0,
      y = 72 + drop,
      rec = C.levelRecord(save, LV.id);
    paintCard(g, x, y, cw, ch);
    T(LV.id, AW / 2, y + 42, { s: 2, color: PAL.lemon, align: "center", shadow: PAL.void });
    T(LV.name, AW / 2, y + 62, { color: PAL.white, align: "center" });
    LV.stickers.forEach((st, i) => {
      const sx = AW / 2 - 19 + i * 14;
      paintSocket(g, sx, y + 70, 11);
      if (rec.stickers.includes(st.id)) sticker(sx + 5, y + 75, 7);
    });
  }
  function drawGetCard() {
    const { fx, GET_CARDS } = env,
      get = fx.get;
    if (!get) return;
    const info = GET_CARDS[get.ability],
      t = get.age,
      a = Math.max(0, Math.min(1, t / 0.12, (M.WORLD.hitstop.get + 0.1 - t) / 0.15));
    dim(Math.round(4 * a));
    const color = get.ability === "dash" ? "white" : get.ability,
      cw = 220,
      ch = 136,
      x = AW / 2 - cw / 2,
      drop = live() ? [-16, -9, -4, 0][Math.min(3, Math.floor(Math.min(1, t / 0.24) * 4))] : 0,
      y = 56 + drop;
    paintCard(g, x, y, cw, ch, { field: get.ability === "dash" ? PAL.indigo : formColour(color) });
    T(info.title, x + cw / 2, y + 26, { s: 2, color: PAL.white, align: "center", shadow: PAL.void });
    // Rubik at 4x source pixels (2 art px each) in the new colour, on a cream disc.
    g.ellipse(x + 56, y + 76, 38, 34, PAL.cream);
    ctx.imageSmoothingEnabled = false;
    if (get.ability === "dash") {
      const f = 1 + (live() ? Math.floor(env.clock * 10) % 3 : 0);
      ctx.drawImage(img.storm, f * 32, 0, 32, 32, (x + 24) * A, (y + 44) * A, 128, 128);
    } else ctx.drawImage(img[color], (Math.floor(env.clock * 4) % 2) * 32, 0, 32, 32, (x + 24) * A, (y + 42) * A, 128, 128);
    // The key (or touch pad) and, for a form, its card, centred in the right half.
    const ky = y + 70,
      mid = x + 158;
    if (get.ability === "dash") {
      const kw = env.inputMode === "touch" ? tw("DASH") + 7 : Math.max(13, tw(info.key) + 7);
      if (env.inputMode === "touch") dashPill(mid - Math.floor(kw / 2), ky);
      else keycap(info.key, mid - Math.floor(kw / 2), ky, { big: true });
    } else {
      const kw = env.inputMode === "touch" ? 0 : Math.max(13, tw(info.key) + 7),
        total = 18 + (kw ? 8 + kw : 0),
        sx = mid - Math.floor(total / 2);
      paintFormCard(g, sx, y + 56, 18, 25, color);
      if (kw) keycap(info.key, sx + 26, ky, { big: true });
    }
    paintPlate(g, x + 8, y + ch - 28, cw - 16, 20, { field: PAL.void, edge: PAL.plum, shadow: false });
    T(info.caption, x + cw / 2, y + ch - 14, { color: PAL.white, align: "center" });
  }
  function drawReverse() {
    const { fx, game } = env;
    if (fx.reverse < 0 || fx.get) return;
    // Never over Rubik: the card and the caption take the half of the screen
    // he isn't in (the cards are held still meanwhile, model.mjs theftCalm).
    const rubikY = env.wy(game.player.y + M.PLAYER.h / 2),
      low = rubikY < 270,
      t = fx.reverse / 1.1,
      cx = live() ? Math.round(AW + 80 - (AW + 160) * Math.min(1, t * 1.15)) : AW / 2,
      cy = low ? AH - 75 : 75;
    // A blink-out near the end instead of a fade.
    const hidden = live() && t > 0.85 && Math.floor(env.clock * 24) % 2;
    if (!hidden) {
      paintCard(g, cx - 62, cy - 42, 124, 84, { field: PAL.red });
      g.ellipse(cx, cy, 46, 26, PAL.cream);
      // Two arrows chasing each other: pixel arcs with arrowheads.
      for (const [from, to, head, dx, dy] of [[0.8, 1.2, "right", 15, -5], [0.3, 0.7, "left", -15, 5]]) {
        for (const q of ringPixels(15, 3)) {
          const turn = q.turn < from - 0.5 ? q.turn + 1 : q.turn;
          if ((turn >= from && turn <= to) || (q.turn >= from && q.turn <= to)) g.px(cx + q.dx, cy + q.dy, PAL.red);
        }
        g.rows(cx + dx - (head === "right" ? 2 : 3), cy + dy - 3, ICON_ROWS[head === "right" ? "arrowRight" : "arrowLeft"], { "#": PAL.red });
      }
      T("REVERSE!", cx, cy + 62, { s: 2, color: PAL.white, align: "center", shadow: PAL.void });
    }
    // The goal, stated once, after the card has swept by.
    if (fx.reverse > 0.95) {
      const a = Math.max(0, Math.min(1, (fx.reverse - 0.95) * 5, (2.6 - fx.reverse) * 3));
      if (a > 0.3 || !live()) {
        const by = low ? AH - 75 : 44,
          touch = env.inputMode === "touch",
          rowW = touch ? 150 : 170,
          rx = AW / 2 - rowW / 2;
        T("Run home!", AW / 2, by + 20, { s: 2, color: PAL.white, align: "center", shadow: PAL.void });
        paintPlate(g, rx - 5, by + 27, rowW + 10, 27, { field: PAL.void, edge: PAL.plum });
        paintFormCard(g, rx, by + 29, 15, 22, "red");
        T("+", rx + 22, by + 44, { color: PAL.cream });
        const kw = touch ? dashPill(rx + 30, by + 34) : keycap("Shift", rx + 30, by + 34, { big: true });
        T("breaks stones", rx + 36 + kw, by + 44, { color: PAL.cream, outline: null });
      }
    }
  }
  /** The hit's red edge flash (dithered bands) and the colour flashes (a dither). */
  function drawFlash() {
    const { fx } = env;
    if (fx.edge > 0) paintEdgeFlash(ctx, Math.min(1, fx.edge / 0.4));
    if (fx.flash > 0) {
      const colour = nearestColour(fx.flashColor);
      scrim(ctx, Math.round(Math.min(0.5, fx.flash) * 20), colour);
    }
  }
  const iris = (t, cx, cy) => paintIris(ctx, t, img.cutout, cx, cy);

  // ----------------------------------------------------------- front-end ----
  function drawBoot() {
    ctx.fillStyle = PAL.ink;
    ctx.fillRect(0, 0, 960, 540);
    // A spinning 3x3 cube face while the art loads: the cells swap places in
    // quarter turns (no rotation of the squares).
    const palette = [PAL.cream, PAL.green, PAL.red, PAL.blue, PAL.lemon, PAL.gold, PAL.cream, PAL.green, PAL.red],
      turn = live() ? Math.floor(env.clock * 3) : 0;
    for (let i = 0; i < 9; i++) {
      const x = AW / 2 - 17 + (i % 3) * 12,
        y = AH / 2 - 17 + Math.floor(i / 3) * 12;
      g.rect(x, y, 10, 10, PAL.ink);
      g.rect(x + 1, y + 1, 8, 8, palette[(i + turn) % 9]);
    }
  }
  function drawTitle() {
    ctx.drawImage(img.title, 0, 0, 960, 540);
    // On touch screens "press any key" is wrong: an opaque plate covers the
    // baked line (source y 184-198 -> art y 184-198) and says tap.
    if (env.inputMode === "touch") {
      paintCard(g, AW / 2 - 150, 176, 300, 28, { field: PAL.navy, shadow: false });
      T("Tap to start", AW / 2, 196, { s: 2, color: PAL.white, align: "center", shadow: PAL.void });
    }
  }
  /** The comic's skip arrows. */
  function drawStorySkip() {
    const s = arrowSprite("right", PAL.cream);
    blit(ctx, s, AW - 26, AH - 14);
    blit(ctx, s, AW - 17, AH - 14);
  }
  function drawEnding() {
    const { save } = env;
    ctx.drawImage(derived.forestColor, 0, 0, 960, 540);
    dim(7);
    // The page itself at 2x (its pixels are art pixels): a 280x100 window of
    // end_game.png, framed. Its baked "That's it by now." is covered by a plate.
    const sw = 280,
      sh = 100,
      fx0 = AW / 2 - sw / 2,
      fy0 = 46;
    paintCard(g, fx0 - 4, fy0 - 4, sw + 8, sh + 8, { field: PAL.ink });
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(img.ending, 100, 100, sw, sh, fx0 * A, fy0 * A, sw * A, sh * A);
    g.rect(fx0 + 68, fy0 + 66, 150, 22, PAL.ink);
    T("That's it for now.", AW / 2, fy0 + 80, { color: PAL.white, align: "center", outline: null });
    const feet = (fy0 + sh + 8 + 14) * A;
    env.drawRubik("red", (Math.floor(env.clock * 4) % 2) * 32, 0, (fx0 - 40) * A, feet, 1);
    env.drawRubik("green", (Math.floor(env.clock * 4 + 1) % 2) * 32, 0, (fx0 + sw + 40) * A, feet, -1);
    T("World 2: Blue Mountains - coming soon", AW / 2, fy0 + sh + 52, { color: PAL.white, align: "center", shadow: PAL.void });
    T(`${C.stickerTotal(save)}/${C.TOTAL_STICKERS} stickers`, AW / 2, fy0 + sh + 70, { color: PAL.lemon, align: "center" });
    if (env.screenTime > 1.2) T(env.inputMode === "touch" ? "tap to continue" : "any key to continue", AW / 2, AH - 10, { color: PAL.mist, align: "center" });
    iris(Math.max(0, 1 - env.screenTime / 0.8));
  }

  // ---------------------------------------------------------- tally screens --
  /** Card panel shared by the tally screens (cream rim, plum field). */
  const panel = (x, y, w, h) => paintCard(g, x, y, w, h);
  /** A stamp: a seal and its label; filled when earned, hollow when not. */
  function stamp(label, got, x, y, icon, count) {
    paintSeal(g, x, y, 11, got);
    const rows = ICON_ROWS[icon],
      ix = x - Math.floor(rows[0].length / 2),
      iy = y - Math.floor(rows.length / 2);
    paintIcon(g, icon, ix, iy, got ? PAL.white : PAL.stone);
    T(label, x + 16, y - (count ? 2 : -4), { color: got ? PAL.white : PAL.fog, outline: got ? PAL.redDark : null });
    if (count) T(count, x + 16, y + 8, { color: got ? PAL.lemon : PAL.fog, outline: null });
  }
  /** The clock icon (rows built from a ring: a clock has no fixed row table). */
  function clockIcon(x, y, color) {
    for (const p of ringPixels(5, 1)) g.px(x + 5 + p.dx, y + 5 + p.dy, color);
    g.rect(x + 5, y + 2, 1, 4, color);
    g.rect(x + 5, y + 5, 3, 1, color);
  }
  function chainIcon(x, y, color) {
    g.frame(x, y + 1, 8, 6, 1, color);
    g.frame(x + 6, y + 1, 8, 6, 1, color);
  }
  function stampIcon(kind, got, x, y) {
    const c = got ? PAL.white : PAL.stone;
    if (kind === "Quick") clockIcon(x - 5, y - 5, c);
    else if (kind === "Chain") chainIcon(x - 7, y - 4, c);
    else paintIcon(g, kind === "Ghost" ? "ghost" : "stomp", x - Math.floor((kind === "Ghost" ? 11 : 11) / 2), y - (kind === "Ghost" ? 6 : 5), c);
  }
  function stampFull(label, got, x, y, count) {
    paintSeal(g, x, y, 11, got);
    stampIcon(label, got, x, y);
    T(label, x + 16, y - (count ? 2 : -4), { color: got ? PAL.white : PAL.fog, outline: got ? PAL.redDark : null });
    if (count) T(count, x + 16, y + 8, { color: got ? PAL.lemon : PAL.fog, outline: null });
  }
  function dais(x, y) {
    g.notched(x, y, 52, 7, PAL.ink);
    g.rect(x + 1, y + 1, 50, 5, PAL.mauve);
    g.rect(x + 1, y + 1, 50, 1, PAL.stone);
  }
  function drawResults() {
    const { fx, LV, save, game } = env;
    ctx.drawImage(env.colorAmount > 0.01 ? derived.forestColor : img.forest, 0, 0, 960, 540);
    dim(8);
    const r = fx.result || { time: game.finishTime ?? game.time, best: null, stickers: game.stickers.map((x) => ({ id: x.id, got: x.collected, owned: x.owned })), unseen: null, takedown: null, quick: null };
    const x = 85,
      y = 26,
      w = 310,
      h = 190;
    panel(x, y, w, h);
    T(`World 1 - ${LV.id}`, AW / 2, y + 17, { color: PAL.mist, align: "center", outline: null });
    T(`${LV.name}: clear!`, AW / 2, y + 38, { s: 2, color: PAL.white, align: "center", shadow: PAL.void });
    // Rubik, in the colour he finished in, on a dais.
    dais(x + 30, y + 104);
    env.drawRubik(game.player.color, (Math.floor(env.clock * 4) % 2) * 32, 0, (x + 56) * A, (y + 106) * A, 1);
    const rows = [
      ["Time", env.fmtTime(r.time ?? 0), r.newBest && !r.firstClear ? "best!" : ""],
      ["Best", r.best === null ? "-" : env.fmtTime(r.best), ""],
    ];
    if (game.escapeTime !== null) rows.push(["Getaway", env.fmtTime(game.escapeTime), ""]);
    rows.push(["Hearts lost", String(r.hits ?? 0), r.hits === 0 ? "none!" : ""]);
    rows.push(["Best chain", r.chainN >= 2 ? `x${r.chainN}` : "-", ""]);
    rows.forEach(([k, v, note], i) => {
      const ry = y + 62 + i * 13;
      T(k, x + 100, ry, { color: PAL.mist, outline: null });
      T(v, x + 188, ry, { color: PAL.white, align: "right", outline: null });
      if (note) T(note, x + 192, ry, { color: PAL.lemon, outline: null });
    });
    // Stickers drop into their sockets one by one, in whole-pixel steps.
    r.stickers.forEach((st, i) => {
      const sx = x + 105 + i * 34,
        sy = y + 130,
        land = 0.35 + i * 0.15,
        k = live() ? Math.max(0, Math.min(1, (env.screenTime - land) / 0.15)) : 1;
      paintSocket(g, sx, sy, 28);
      if (st.got || st.owned) {
        const drop = Math.round((1 - k) * 30);
        if (st.got) sticker(sx + 14, sy + 14 - drop, 18, -1);
        else g.frame(sx + 5, sy + 5, 18, 18, 2, PAL.gold); // owned from an earlier run: an outline
      }
      if (st.got && k > 0 && k < 1 && !st.pinged) {
        st.pinged = true;
        env.play("tally");
      }
    });
    const got = r.stickers.filter((q) => q.got || q.owned).length;
    T(`${got}/3`, x + 214, y + 150, { color: PAL.lemon, outline: null });
    // Stamps where this level can award them, in one column.
    const sx = x + 238;
    let sy = y + 62;
    if (r.unseen !== null) {
      stampFull("Ghost", r.unseen, sx, sy);
      sy += 33;
    }
    if (r.takedown) {
      stampFull("Takedown", r.takedown.got, sx, sy, `${r.takedown.n}/${r.takedown.of}${r.takedown.best > r.takedown.n ? ` b${r.takedown.best}` : ""}`);
      sy += 33;
    }
    if (r.quick !== null) {
      stampFull("Quick", r.quick, sx, sy);
      sy += 33;
    }
    if (r.chain) stampFull("Chain", r.chain.got, sx, sy, `${r.chainN}/${r.chain.par}${r.chain.best > r.chainN ? ` b${r.chain.best}` : ""}`);
    if (r.assisted && (r.unseen !== null || r.takedown || r.quick !== null || r.chain)) T("Slow spotting: no stamps", x + 156, y + h - 24, { color: PAL.mist, align: "center", outline: null });
    if (r.unlocked) T(`${r.unlocked} is open!`, AW / 2, y + h - 8, { color: PAL.lime, align: "center", outline: null });
  }
  function drawWorldClear() {
    const { save, game } = env;
    ctx.drawImage(derived.forestColor, 0, 0, 960, 540);
    dim(7);
    const x = 40,
      y = 9,
      w = 400,
      h = 208;
    panel(x, y, w, h);
    T("World 1 - Green Forest: clear!", AW / 2, y + 20, { color: PAL.mist, align: "center", outline: null });
    T("You got your red back!", AW / 2, y + 42, { s: 2, color: PAL.white, align: "center", shadow: PAL.void });
    dais(x + 30, y + 104);
    env.drawRubik("red", (Math.floor(env.clock * 4) % 2) * 32, 0, (x + 56) * A, (y + 106) * A, 1);
    const total = C.stickerTotal(save),
      rows = [
        ["Stickers", `${total}/${C.TOTAL_STICKERS}`],
        ["Levels", `${C.WORLD1.filter((id) => C.isCleared(save, id)).length}/${C.WORLD1.length}`],
        ["Getaway", env.fmtTime(game.escapeTime ?? 0)],
      ];
    rows.forEach(([k, v], i) => {
      T(k, x + 110, y + 70 + i * 18, { color: PAL.mist, outline: null });
      T(v, x + 235, y + 70 + i * 18, { color: PAL.white, align: "right", outline: null });
    });
    // Six little faces: each level's sticker count.
    C.WORLD1.forEach((id, i) => {
      const rec = C.levelRecord(save, id),
        full = rec.stickers.length === 3;
      paintChalkFace(g, x + 262 + (i % 3) * 38, y + 56 + Math.floor(i / 3) * 34, 8, full ? PAL.white : PAL.fog, (k) => (k < rec.stickers.length ? PAL.lemon : PAL.void));
    });
    const medals = C.worldMedals(save),
      list = [
        ["Full face", medals.fullFace, `all ${C.TOTAL_STICKERS} stickers`],
        ["Ghost", medals.ghost, "Ghost: 1-3 1-5 1-6"],
        ["Quick getaway", medals.quickGetaway, `home in ${env.getLevel("1-6").par} s`],
      ];
    list.forEach(([name, got, how], i) => {
      const appear = Math.max(0, Math.min(1, (env.screenTime - 0.4 - i * 0.35) / 0.3)),
        cx = x + 68 + i * 132,
        cy = y + 140;
      if (appear <= 0) return;
      // The flip is three widths (never a squashed scale): a sliver, a half, the card.
      const step = live() ? (appear < 0.34 ? 0.15 : appear < 0.67 ? 0.6 : 1) : 1,
        mw = Math.max(8, Math.round((120 * step) / 2) * 2);
      paintCard(g, cx - mw / 2, cy - 22, mw, 44, { field: got ? PAL.red : PAL.void, rim: got ? PAL.cream : PAL.stone, shadow: false });
      if (step >= 0.6 || !live()) {
        T(name, cx, cy - 4, { color: got ? PAL.white : PAL.fog, align: "center", outline: got ? PAL.redDark : null });
        T(got ? "earned!" : how, cx, cy + 12, { color: got ? PAL.lemon : PAL.fog, align: "center", outline: null });
      }
    });
    // One narration box, the comic's caption style, after the medals.
    if (env.screenTime > 1.6) {
      const bx = AW / 2 - 168,
        by = y + h - 30;
      g.rect(bx, by, 336, 20, PAL.ink);
      g.rect(bx + 1, by + 1, 334, 18, PAL.cream);
      T("Green and red are back. Blue is up in the mountains.", AW / 2, by + 13, { color: PAL.ink, align: "center", outline: null });
    }
  }

  // ------------------------------------------------ world effects, in pixels --
  /** A radial glow as a Bayer dither (replaces the radial gradients): art-px
   * centre and radii, `peak` the density (0..16) at the centre falling to 0. */
  function glow(cx, cy, rx, ry, peak, color) {
    for (let j = -ry; j <= ry; j++)
      for (let i = -rx; i <= rx; i++) {
        const d = Math.hypot(i / rx, j / ry);
        if (d <= 1 && ditherOn(cx + i, cy + j, Math.round(peak * (1 - d)))) g.px(cx + i, cy + j, color);
      }
  }
  /** An elliptical ring (canvas-px centre and radii) of two layers: a wide ink
   * one under a narrower coloured one, like the old stroked ring. */
  function ring(xPx, yPx, rxPx, ryPx, color, thick = 2) {
    const cx = toArt(xPx),
      cy = toArt(yPx),
      rx = Math.max(2, toArt(rxPx)),
      ry = Math.max(2, toArt(ryPx));
    g.ellipseRing(cx, cy, rx + 1, ry + 1, thick + 1, PAL.ink);
    g.ellipseRing(cx, cy, rx, ry, thick - 1 || 1, color);
  }
  /** The cracks on a red-only stone: an ink polyline in art px relative to the
   * stone's top-left (canvas px given), `color` for the cracks' lit edge. */
  function crack(xPx, yPx, color) {
    const x = toArt(xPx),
      y = toArt(yPx),
      path = [[5, 3], [13, 12], [10, 19], [19, 25], [17, 30]],
      branch = [[13, 12], [24, 9], [29, 15]];
    for (const pts of [path, branch])
      for (let i = 0; i + 1 < pts.length; i++) {
        g.line(x + pts[i][0], y + pts[i][1], x + pts[i + 1][0], y + pts[i + 1][1], PAL.ink);
        g.line(x + pts[i][0] + 1, y + pts[i][1], x + pts[i + 1][0] + 1, y + pts[i + 1][1], color);
      }
  }
  /** The charger's iron cap (card-local, left-facing): a 30 x 20 art-px sprite
   * of ink, steel and a cream horn. Drawn by the caller inside the card's own
   * transform, so it turns with the card exactly like the card art does. */
  function helmet() {
    return sprite("helmet", 30, 20, (b) => {
      const dome = ellipseSpansTop(12, 8);
      dome.forEach((hw, i) => b.rect(15 - hw, 4 + i, hw * 2 + 1, 1, PAL.ink));
      ellipseSpansTop(10, 6).forEach((hw, i) => b.rect(15 - hw, 6 + i, hw * 2 + 1, 1, PAL.stone));
      b.rect(1, 12, 28, 4, PAL.ink);
      b.rect(2, 13, 26, 1, PAL.fog);
      b.rect(9, 8, 4, 2, PAL.mist);
      // The horn: an ink wedge rising to the left, cream inside.
      for (let i = 0; i < 9; i++) b.rect(2 + Math.floor(i * 0.9), 11 - i, 8 - Math.floor(i * 0.5), 1, PAL.ink);
      for (let i = 1; i < 8; i++) b.rect(3 + Math.floor(i * 0.9), 11 - i, Math.max(1, 6 - Math.floor(i * 0.7)), 1, PAL.cream);
    });
  }
  const ellipseSpansTop = (rx, ry) => ellipseSpans(rx, ry).slice(0, ry + 1);
  /** A dithered dark wash over a canvas-px rectangle (an unlit chalk cell). */
  const dimWash = (x, y, w, h) => scrim(ctx, 6, PAL.void, x, y, w, h);
  const scrimPx = (level, color, x, y, w, h) => scrim(ctx, level, color, x, y, w, h);
  // -------------------------------------------------------------- the map ----
  /** A source image shown through a Bayer dither at `level`/16 of its art pixels
   * (the colour regain on the map, the title-to-grey drain, a panel arriving):
   * the replacement for globalAlpha cross-fades. Canvas-px rectangles. The
   * masks are one art pixel per cell and are cached per level. */
  const masks = new Map();
  let layer = null;
  function mask(level) {
    let m = masks.get(level);
    if (!m) {
      m = bake(AW, AH, (b) => {
        for (let j = 0; j < AH; j++) for (let i = 0; i < AW; i++) if (ditherOn(i, j, level)) b.px(i, j, "#000");
      });
      masks.set(level, m);
    }
    return m;
  }
  function ditherDraw(source, level, sx, sy, sw, sh, dx, dy, dw, dh) {
    if (level <= 0) return;
    if (level >= 16) return ctx.drawImage(source, sx, sy, sw, sh, dx, dy, dw, dh);
    if (!layer) {
      layer = document.createElement("canvas");
      layer.width = 960;
      layer.height = 540;
    }
    const x = layer.getContext("2d");
    x.imageSmoothingEnabled = false;
    x.globalCompositeOperation = "source-over";
    x.clearRect(0, 0, 960, 540);
    x.drawImage(source, sx, sy, sw, sh, dx, dy, dw, dh);
    x.globalCompositeOperation = "destination-in";
    x.drawImage(mask(level), 0, 0, 960, 540);
    ctx.drawImage(layer, 0, 0);
  }
  const NODE_Y = 200; // art y of the path's top edge (canvas 400)
  function drawMap() {
    const { save, map, fx, MAP_NODES } = env,
      amount = C.forestColor(save),
      level = Math.round(amount * 16);
    ctx.fillStyle = derived.skyFill;
    ctx.fillRect(0, 0, 960, 540);
    // bg1-sky continues bg1 upward: its bottom 20 rows fill the 40 px band the
    // forest (shifted down 40 px) leaves at the top, both at exactly 2x.
    ctx.drawImage(img.sky, 0, 431, 480, 20, 0, 0, 960, 40);
    if (level) ditherDraw(derived.skyColor, level, 0, 431, 480, 20, 0, 0, 960, 40);
    ctx.drawImage(img.forest, 0, 40, 960, 540);
    if (level) ditherDraw(derived.forestColor, level, 0, 0, 480, 270, 0, 40, 960, 540);
    ctx.fillStyle = derived.groundFill;
    ctx.fillRect(0, 40 + 540 - 2, 960, 4);
    // (No red beacon behind the vault node: removed at the owner's request.)
    T("World 1", AW / 2, 24, { color: PAL.cream, align: "center", shadow: PAL.void });
    T("Green Forest", AW / 2, 46, { s: 2, color: PAL.white, align: "center", shadow: PAL.void });
    // Path: slab cells (atlas row 0, cells 12-17, top 12 source px) at 2x, one
    // continuous strip; segments to locked nodes are dithered down, and a newly
    // opened segment draws in over 0.6 s.
    const first = MAP_NODES[0].x - 48,
      last = MAP_NODES[MAP_NODES.length - 1].x + 48,
      cells = Math.round((last - first) / 32);
    for (let j = 0; j < cells; j++) {
      const x = first + j * 32,
        seg = Math.max(0, Math.min(MAP_NODES.length - 2, Math.floor((x + 16 - MAP_NODES[0].x) / 140))),
        to = seg + 1,
        revealing = map.reveal && map.reveal.to === to,
        reached = x + 16 <= MAP_NODES[0].x + 4 || C.isUnlocked(save, MAP_NODES[to].id),
        along = (x + 16 - MAP_NODES[seg].x) / 140,
        lit = revealing ? along <= Math.min(1, map.reveal.age / 0.6) : reached,
        cell = j === 0 ? 12 : j === cells - 1 ? 17 : 13 + (j % 4);
      ctx.drawImage(img.tiles, cell * 16, 0, 16, 12, x, NODE_Y * A, 32, 24);
      if (!lit) scrim(ctx, 10, PAL.void, x, NODE_Y * A, 32, 24);
    }
    // Nodes: chalk faces on sticks. Locked ones are a grey outline, open ones
    // bob, cleared ones are filled with the colour Rubik finished in.
    MAP_NODES.forEach((node, i) => {
      const rec = C.levelRecord(save, node.id),
        open = C.isUnlocked(save, node.id) && !(map.reveal && map.reveal.to === i),
        bob = open && !rec.clear && live() ? Math.round(Math.sin(env.clock * 3 + i) * 1.5) : 0,
        x = node.x / A,
        y = NODE_Y - 55 + bob,
        full = rec.stickers.length === 3;
      // The stick.
      g.rect(x - 1, y + 13, 2, NODE_Y - y - 13, open ? PAL.mist : PAL.stone);
      if (full) g.frame(x - 17, y - 17, 34, 34, 2, PAL.lemon);
      if (i === MAP_NODES.length - 1) {
        // The vault node: cofre.png at 2x.
        ctx.drawImage(img.vault, (x - 12) * A, (y - 10) * A, 46, 40);
        if (rec.clear) scrim(ctx, 8, PAL.red, (x - 8) * A, (y - 7) * A, 30, 28);
        else if (!open) scrim(ctx, 8, PAL.void, (x - 12) * A, (y - 10) * A, 46, 40);
      } else {
        const line = i === map.cursor && open ? PAL.white : open ? PAL.cream : PAL.stone;
        paintChalkFace(g, x - 12, y - 12, 8, line, rec.clear ? () => formColour(rec.color || "white") : open ? () => PAL.void : null);
      }
      T(node.id, x, y - 22, { color: open ? PAL.cream : PAL.fog, align: "center" });
      // Three sticker pips under the path, and a red seal for any stamp.
      for (let k = 0; k < 3; k++) {
        const px = x - 12 + k * 9;
        g.rect(px, NODE_Y + 16, 7, 7, PAL.ink);
        g.rect(px + 1, NODE_Y + 17, 5, 5, rec.stickers.includes(k + 1) ? PAL.lemon : open ? PAL.void : PAL.slate);
      }
      if (rec.unseen || rec.takedown || rec.quick || rec.chain) {
        g.disc(x + 19, y - 14, 5, PAL.ink);
        g.disc(x + 19, y - 14, 4, PAL.red);
        g.disc(x + 19, y - 14, 2, PAL.cream);
        g.disc(x + 19, y - 14, 1, PAL.red);
      }
    });
    // Rubik walks node to node on the path (his 2x run row).
    const a = MAP_NODES[map.from],
      b = MAP_NODES[map.cursor],
      k = map.walk,
      rx = a.x + (b.x - a.x) * k,
      walking = k < 1,
      dir = b.x >= a.x ? 1 : -1,
      color = C.isCleared(save, "1-6") ? "red" : C.isCleared(save, "1-2") ? "green" : "white";
    env.drawRubik(color, walking ? (Math.floor(env.clock * 12) % 4) * 32 : (Math.floor(env.clock * 4) % 2) * 32, walking ? 64 : 0, Math.round((rx + 34) / A) * A, a.y + 2 - (walking && live() ? Math.round(Math.abs(Math.sin(k * Math.PI)) * 5) * A : 0), dir);
    // HUD: owned forms (top left) and the world's sticker total (top right).
    const forms = ["white", "green", "red"].filter((c) => c === "white" || (c === "green" && C.isCleared(save, "1-2")) || (c === "red" && C.isCleared(save, "1-6")));
    forms.forEach((c, i) => paintFormCard(g, 8 + i * 15, 7, 17, 24, c));
    paintPlate(g, AW - 8 - 62, 27, 62, 18);
    sticker(AW - 8 - 50, 36, 9);
    T(`${C.stickerTotal(save)}/${C.TOTAL_STICKERS}`, AW - 14, 40, { color: PAL.lemon, align: "right", outline: null });
    // Bottom panel: the selected level.
    const level0 = env.getLevel(C.WORLD1[map.cursor]),
      rec = C.levelRecord(save, level0.id),
      px = 75,
      py = 237;
    paintPlate(g, px, py, 330, 29, { field: PAL.void, edge: PAL.plum });
    T(`${level0.id}  ${level0.name}`, px + 8, py + 12, { color: PAL.white, outline: null });
    T(level0.idea, px + 8, py + 24, { color: PAL.mist, outline: null });
    T(rec.best === null ? "" : `best ${env.fmtTime(rec.best)}`, px + 245, py + 12, { color: PAL.mist, align: "right", outline: null });
    for (let i = 0; i < 3; i++) paintSocket(g, px + 253 + i * 13, py + 4, 10);
    for (let i = 0; i < 3; i++) if (rec.stickers.includes(i + 1)) sticker(px + 258 + i * 13, py + 9, 6, -1);
    const touch = env.inputMode === "touch",
      prompt = map.prompt > 0 ? "locked" : touch ? "tap again: play" : "Enter: play";
    T(prompt, px + 322, py + 24, { color: map.prompt > 0 ? PAL.rose : PAL.lemon, align: "right", outline: null });
  }

  return {
    A, bubble, note, strikeZone, openMarker, dazeRing, drawPopups, drawHint, drawHud, drawIntro, drawGetCard, drawReverse, drawFlash,
    iris, drawBoot, drawTitle, drawStorySkip, drawEnding, drawResults, drawWorldClear, drawMap, badge, keycap, sticker, star, text: T,
    formCard, dashPill, keycapCentered, stickerOutline, ditherDraw, glow, ring, crack, helmet, dimWash, scrimPx,
  };
}
