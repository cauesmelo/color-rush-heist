/** Cone-blind bot for tests/cone-blind-audit.mjs (dev tool, not a test).
 * Written by the revision-five playtest critic; kept verbatim below this
 * header. A terrain-competent, guard-ignorant player: it uses each owned
 * verb for terrain and colour rules only (green by default, white for 3+
 * tile walls and wide gaps, dash over water, red dash into stones) and never
 * waits for a cone or aims a stomp. A card that stops it does real work. */
// Naive-player bot (critic scratch). Pure: reads a game object `g` and the
// model module `M`, returns the keys it wants held. Used both in Node (model
// stepping) and in the page (where Node turns the wish into real key events).
//
// mode "runner": hold the travel direction, jump walls / water / deep drops,
//                white air-jumps when still blocked or over water. No stomp
//                intent, no dash, no colour swap. Walks into cards.
// mode "hopper": runner + jumps when a card body is ahead on its floor (Mario
//                instinct). Head landings may stomp by accident (counted).
// opts.dash:     allow Shift when stuck at a wall/door or over water (escape probe).
export function makeBot(mode = "runner", opts = {}) {
  return { mode, opts, jumpHeld: false, airUsed: false, best: -1e9, bestAt: 0, unstick: 0, unstickDir: 0, t: 0, stuck: false, lastStones: 0, dashPress: false, colorPress: null };
}

const T = 32;
function solid(g, M, tx, ty) {
  if (ty < 0) return false;
  return M.blocked(g, tx, ty);
}
function tileCh(g, tx, ty) {
  const row = g.level.map[ty];
  return row ? row[tx] : "#";
}
function supportBelow(g, M, x, feetY) {
  // first non-air tile below feet at world x: returns {kind, depthTiles}
  const tx = Math.floor(x / T);
  for (let ty = Math.floor(feetY / T); ty < 22; ty++) {
    const ch = tileCh(g, tx, ty);
    if (ch === "~") return { kind: "water", depth: ty - feetY / T };
    if (solid(g, M, tx, ty) || ch === "=") return { kind: "ground", depth: ty - feetY / T };
  }
  return { kind: "void", depth: 99 };
}

export function decide(g, M, bot, dt) {
  bot.t += dt;
  const p = g.player,
    want = { left: false, right: false, jump: false, dash: false, color: null };
  if (g.phase !== "playing") {
    bot.jumpHeld = false;
    return want;
  }
  const dir = g.stolen ? -1 : 1,
    cx = p.x + p.w / 2,
    feet = p.y + p.h,
    prog = dir * cx;
  if (prog > bot.best + 8) {
    bot.best = prog;
    bot.bestAt = bot.t;
  }
  // Give up after 15 s with no new progress.
  if (bot.t - bot.bestAt > 15) bot.stuck = true;
  if (bot.stuck) return want;

  let moveDir = dir;
  if (bot.unstick > 0) {
    bot.unstick -= dt;
    moveDir = bot.unstickDir;
  } else if (bot.t - bot.bestAt > 2.2 && p.grounded && ((bot.t * 10) | 0) % 30 === 0) {
    // stalled: back up a little and try again
    bot.unstick = 0.35;
    bot.unstickDir = -dir;
    moveDir = -dir;
  }
  if (moveDir > 0) want.right = true;
  else want.left = true;

  const frontX = moveDir > 0 ? p.x + p.w + 4 : p.x - 4,
    frontTx = Math.floor(frontX / T),
    feetRow = Math.floor((feet - 2) / T),
    wall = solid(g, M, frontTx, feetRow) || solid(g, M, frontTx, feetRow - 1),
    wall2 = solid(g, M, Math.floor((frontX + moveDir * 20) / T), feetRow) || solid(g, M, Math.floor((frontX + moveDir * 20) / T), feetRow - 1);
  // edge ahead: what is under the column 20 px ahead of the front foot
  const aheadSup = supportBelow(g, M, cx + moveDir * (p.w / 2 + 14), feet),
    hereSup = supportBelow(g, M, cx, feet),
    edge = p.grounded && (aheadSup.kind !== "ground" || aheadSup.depth > 2.5);

  let guardAhead = false;
  if (bot.mode === "hopper") {
    for (const gd of g.guards) {
      if (gd.state === "away" || gd.state === "stunned" || gd.state === "drained") continue;
      const dx = (gd.x - cx) * moveDir;
      if (dx > 20 && dx < 110 && Math.abs(gd.floor - feet) < 40) guardAhead = true;
    }
  }

  // Ground jump
  if (p.grounded) {
    bot.airUsed = false;
    if (wall || wall2 || edge || guardAhead) {
      want.jump = true;
    }
  }
  // Keep holding jump while rising / at apex
  if (!p.grounded && bot.jumpHeld && p.vy < 120) want.jump = true;
  // White air jump: falling and still blocked, or over water/void, or a card below/ahead (hopper)
  if (!p.grounded && p.vy > 40 && p.color === "white" && !p.airJumped && !bot.airUsed) {
    const under = supportBelow(g, M, cx, feet),
      underAhead = supportBelow(g, M, cx + moveDir * 40, feet);
    const overHazard = (under.kind !== "ground" && underAhead.kind !== "ground") || under.depth > 4;
    if (wall || overHazard || guardAhead) {
      if (bot.jumpHeld) {
        // need a fresh press: release this frame, press next
        bot.jumpHeld = false;
        want.jump = false;
        return want; // jump false -> release
      }
      want.jump = true;
      bot.airUsed = true;
    }
  }
  if (bot.opts.dash) {
    // Escape probe: dash when pushing into a wall/stone, or mid-air over water.
    const stone = g.stones.some((s) => !s.broken && Math.abs(s.x * T + T - (moveDir > 0 ? p.x + p.w : p.x)) < 40 && Math.abs(s.y * T + T - p.y) < 90);
    if ((stone || (wall && bot.t - bot.bestAt > 0.6)) && p.dashCharge > 0 && !bot.dashPress) {
      want.dash = true;
    }
    if (!p.grounded && p.vy > 60 && hereSup.kind === "water" && p.dashCharge > 0 && !bot.dashPress) want.dash = true;
  }
  if (bot.mode === "smart") smart(g, M, bot, want, { moveDir, frontX, feetRow, feet, cx, hereSup });
  bot.dashPress = want.dash;
  bot.jumpHeld = want.jump;
  return want;
}

// "Terrain-competent, guard-ignorant": uses each owned verb only for terrain
// and colour rules (green by default, white for 3+ tile walls / wide gaps,
// green again before landing, dash over water, red dash into stones), never
// waits for a cone, never aims a stomp. This is a player who has learned the
// controls but treats cards as scenery.
function smart(g, M, bot, want, k) {
  const p = g.player, { moveDir, frontX, feetRow, feet, cx } = k;
  let wallH = 0;
  for (let i = 0; i < 3; i++) {
    const tx = Math.floor((frontX + moveDir * i * 32) / T);
    let h = 0;
    while (h < 8 && solid(g, M, tx, feetRow - h)) h++;
    wallH = Math.max(wallH, h);
  }
  // water width ahead (from the first water column within 3 tiles)
  let gapW = 0;
  {
    let tx = Math.floor((cx + moveDir * 20) / T), seen = false;
    for (let i = 0; i < 40; i++, tx += moveDir) {
      const ch = tileCh(g, tx, 20);
      if (ch === "~") { seen = true; gapW++; } else if (seen) break; else if (i > 3) break;
    }
  }
  const dashOwned = g.dashUnlocked;
  let target = g.unlocked.green ? "green" : p.color;
  if (g.stolen) {
    target = "red";
    const stoneAhead = g.stones.some((s) => !s.broken && (s.x * T + 16 - cx) * moveDir > 0 && (s.x * T + 16 - cx) * moveDir < 220 && Math.abs(s.y * T + 32 - (p.y + 26)) < 120);
    const greenAhead = g.guards.some((gd) => gd.kind === "green" && !["away", "stunned", "drained"].includes(gd.state) && (gd.x - cx) * moveDir > -10 && (gd.x - cx) * moveDir < 200 && Math.abs(gd.floor - feet) < 60);
    if (greenAhead && !stoneAhead && g.unlocked.green) target = "green";
    if (stoneAhead) target = "red";
  } else if (g.unlocked.white) {
    const needWhite = wallH >= 3 || gapW > 10;
    if (needWhite && p.grounded) target = "white";
    if (!p.grounded && p.color === "white" && !(p.airJumped && p.vy > 30)) target = "white";
    if (!p.grounded && p.color === "white" && !p.airJumped && wallH >= 3) target = "white";
  }
  if (target !== p.color && g.unlocked[target] && g.colorCooldown <= 0 && bot.colorPress !== target) want.color = target;
  bot.colorPress = want.color;
  if (dashOwned && p.dashCharge > 0 && !bot.dashPress) {
    const under = supportBelow(g, M, cx, feet), ahead = supportBelow(g, M, cx + moveDir * 60, feet);
    if (!p.grounded && p.vy > -60 && under.kind !== "ground" && ahead.kind !== "ground") want.dash = true;
    if (g.stolen) {
      const stoneClose = g.stones.some((s) => !s.broken && (s.x * T + 16 - cx) * moveDir > 0 && (s.x * T + 16 - cx) * moveDir < 70 && Math.abs(s.y * T + 32 - (p.y + 26)) < 60);
      if (stoneClose && p.color === "red") want.dash = true;
    }
  }
}

// Per-card engagement tracker. A card is "passed" when Rubik's centre gets
// 30 px beyond it in the travel direction (inbound: right; escape: left).
export function makeTracker(g) {
  const cards = {};
  for (const gd of g.level.guards) cards[gd.id] = { id: gd.id, job: gd.job, kind: gd.kind, escapeOnly: !!gd.escapeOnly, passed: null, stomp: 0, bounce: 0, bump: 0, suspect: 0, spotted: 0, spike: 0, knock: 0, killed: 0, seen: 0, hum: 0 };
  return { cards, lastEvent: 0, deaths: [], maxX: 0, theft: null, won: false };
}
export function track(g, M, tr, dt) {
  const p = g.player,
    cx = p.x + p.w / 2;
  tr.maxX = Math.max(tr.maxX, cx);
  for (const ev of g.events) {
    if (ev.id <= tr.lastEvent) continue;
    tr.lastEvent = ev.id;
    const c = ev.guard && tr.cards[ev.guard];
    if (c && c[ev.type] !== undefined) c[ev.type]++;
    if (ev.type === "die") {
      let near = null, best = 1e9;
      for (const gd of g.guards) {
        const d = Math.abs(gd.x - cx);
        if (["lunge", "windup", "recover"].includes(gd.state) && d < best) { best = d; near = gd.id; }
      }
      if (ev.reason === "spear" && near) tr.cards[near].killed++;
      tr.deaths.push({ t: +g.time.toFixed(2), reason: ev.reason, x: Math.round(cx), col: Math.floor(cx / 32), by: ev.reason === "spear" ? near : null });
    }
    if (ev.type === "theft") tr.theft = +g.time.toFixed(2);
  }
  for (const gd of g.guards) {
    const c = tr.cards[gd.id];
    if (gd.sees) c.seen += dt;
    if (gd.disguiseSeen) c.hum += dt;
    const dir = gd.escapeOnly || g.stolen ? -1 : 1;
    if (gd.state === "away") continue;
    if (c.passed == null && (cx - gd.x) * dir > 30 && (!gd.escapeOnly || g.stolen) && (dir > 0 ? !g.stolen : g.stolen)) c.passed = +g.time.toFixed(2);
    if (g.stolen && !gd.escapeOnly && c.passedEscape == null && (cx - gd.x) * -1 > 30) c.passedEscape = +g.time.toFixed(2);
  }
  if (g.phase === "won") tr.won = true;
}
export function summarize(tr) {
  const rows = Object.values(tr.cards).map((c) => {
    const engaged = c.stomp + c.bounce + c.knock > 0,
      noticed = c.spotted + c.suspect + c.bump + c.spike + c.killed > 0;
    return { ...c, seen: +c.seen.toFixed(2), hum: +c.hum.toFixed(2), freePass: c.passed != null && !engaged && !noticed, engaged, noticed };
  });
  return rows;
}
