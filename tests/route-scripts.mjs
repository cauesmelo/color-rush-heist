/** Planner scripts for every level's QA routes (see tests/route-planner.mjs).
 * Coordinates are world px (tile * 32); comments name the beat being played.
 * baseline = the guided main line; mastery = all three stickers. */
import * as M from "../model.mjs";

const T = 32;
const tx = (tiles) => tiles * T;

// Small vocabulary shared by the scripts.
const jumpAt = (pl, x) => pl.to(x).jump();
const doubleAt = (pl, x) => pl.to(x).jump().airJump();

export const SCRIPTS = {
  "1-1": {
    baseline(pl) {
      pl.right();
      jumpAt(pl, tx(23) + 8).land(); // first step up
      jumpAt(pl, tx(29) + 16).land(); // the ditch arc (sticker 1)
      jumpAt(pl, tx(38) + 16).land(); // dry ditch and the 2-tile step in one arc
      pl.check(Math.abs(pl.feet - tx(12)) < 1, "on the step");
      pl.to(tx(55)); // walk across the slab, drop back down
      jumpAt(pl, tx(56)).land(); // dry ditch
      doubleAt(pl, tx(68)).land(); // the 4-tile wall: jump, jump
      doubleAt(pl, tx(75)).land(); // the second 4-tile step
      pl.to(tx(92)).land();
      doubleAt(pl, tx(95)).land(); // the first water, bank 4 tiles up
      pl.to(tx(114)).check(pl.g.phase === "won", "goal face");
    },
    mastery(pl) {
      pl.right();
      jumpAt(pl, tx(23) + 8).land();
      jumpAt(pl, tx(29) + 16).land();
      jumpAt(pl, tx(38) + 16).land();
      // On the slab: a held jump straight up reaches sticker 2.
      pl.to(tx(52)).stop().wait(0.15).jump().land();
      pl.right();
      jumpAt(pl, tx(56)).land();
      doubleAt(pl, tx(68)).land();
      doubleAt(pl, tx(75)).land();
      pl.to(tx(92)).land();
      doubleAt(pl, tx(95)).land();
      // Two stacked ledges above the bank: two double jumps (sticker 3).
      pl.left().to(tx(104) + 16).stop().wait(0.2).jump().airJump().land();
      pl.check(Math.abs(pl.feet - tx(6)) < 1, "on ledge 1");
      pl.right().to(tx(106) + 20).stop().wait(0.2).jump().airJump().land();
      pl.check(Math.abs(pl.feet - tx(2)) < 1, "on ledge 2");
      pl.right().to(tx(114)).check(pl.g.phase === "won", "goal face");
    },
  },
  "1-2": {
    baseline(pl) {
      stompIntoPit(pl);
      islandChain(pl, false);
      wallStomp(pl, { ledge: false });
      // Over the dip in one double jump, then the run-up.
      pl.to(tx(93) + 8).jump().airJump().landAt(tx(104));
      pl.right();
      jumpAt(pl, tx(106)).land(); // 2-tile steps
      jumpAt(pl, tx(108)).land();
      glowDrop(pl);
    },
    mastery(pl) {
      stompIntoPit(pl);
      islandChain(pl, true);
      wallStomp(pl, { ledge: true });
      pl.to(tx(93) + 8).jump().airJump().landAt(tx(104));
      pl.right();
      jumpAt(pl, tx(106)).land();
      jumpAt(pl, tx(108)).land();
      glowDrop(pl);
    },
  },
  "1-3": {
    baseline(pl) {
      // Green from the start: the glade patrol and the corridor card hum.
      pl.right().to(tx(38));
      pl.jump().land(); // the 1-tile step in the corridor (sticker 1)
      // The 4-tile wall: wait below the lookout's cone for its back, then
      // white and jump on the same press, jump again, green before landing.
      watchedClimb(pl, "lookout", tx(63) + 8);
      pl.to(tx(84)).land();
      // The step: the alcove card watches it the same way.
      watchedClimb(pl, "alcove", tx(95) + 8);
      pillarFinale(pl);
    },
    mastery(pl) {
      pl.right().to(tx(38));
      pl.jump().land(); // sticker 1 on the step
      pl.left().to(tx(19) + 8); // back out to the glade
      // Sticker 2: white up the slab, the canopy roof, green past the roof card.
      pl.right().press({ color: "white", jump: true }).airJump().landAt(tx(23));
      pl.check(Math.abs(pl.feet - tx(12)) < 1, "slab");
      jumpAt(pl, tx(24) + 8).land(); // onto the canopy roof (2 up)
      pl.color("green").to(tx(47));
      pl.stop().wait(0.12).right().press({ color: "white", jump: true }).airJump();
      // The jump flies on off the roof's end onto the wall top, where the
      // lookout patrols: green right after the sticker, long before its view
      // (once a card has shown "?", a swap in its cone no longer fools it).
      pl.until((p) => p.g.stickers[1].collected, pl.dir, 240, "roof sticker").color("green").land();
      // Off the roof's end: the drop carries onto the 4-tile wall's top (its lip
      // is caught), so the white climb is only needed when it falls short.
      pl.color("green").to(tx(61) + 8).land();
      if (pl.feet > tx(12) + 1) {
        pl.to(tx(63) + 8);
        pl.press({ color: "white", jump: true }).airJump().wait(0.15).press({ color: "green" });
        pl.until((p) => p.feet <= tx(12) + 1 && p.p.grounded, { right: true }, 240, "on the wall");
      }
      pl.check(Math.abs(pl.feet - tx(12)) < 1 && pl.p.color === "green", "on the wall, green");
      pl.to(tx(84)).land();
      // The expert's climb up the step: no wait, green 0.15 s after the air
      // jump, under the 0.25 s the alcove card needs for its "?".
      watchedClimb(pl, "alcove", tx(95) + 8, { quick: true });
      // Sticker 3: green jump up through the alcove card, white air jump at the apex.
      pl.to(tx(103) + 8).stop().wait(0.1).jump().apex().press({ color: "white", jump: true }).land();
      pl.check(pl.g.stickers[2].collected, "alcove sticker");
      pl.color("green").right();
      pillarFinale(pl, { quick: true });
    },
  },
  "1-4": {
    baseline(pl) {
      // Green from the start (no double jump): the dash is the way over.
      pl.right().to(tx(7) + 4).jump(); // hop onto the stump: the swirl -> DASH GET
      pl.until((p) => p.g.dashUnlocked).settle().land();
      jumpDash(pl, tx(19) + 26, tx(16), "Gap A"); // sticker 1 on this line
      jumpDash(pl, tx(37) + 26, tx(16), "develop 12");
      jumpDash(pl, tx(55) + 26, tx(16), "develop 14");
      // 20 tiles: jump, dash, the orb refills at the apex, dash again.
      orbCrossing(pl, tx(75) + 26, tx(16), "twist orb");
      // 20 tiles: jump + dash onto the pillar lookout's back; its stomp
      // refills the dash for the second half.
      pl.right().to(tx(101) + 24).jump().apex().dash();
      pl.until((p) => p.p.dashTime <= 0, pl.dir, 60, "dash").steerTo((p) => p.guard("pillar").x - 6);
      pl.check(pl.guard("pillar").state === "stunned", "pillar stomped");
      pl.settle().apex().dash();
      pl.until((p) => p.p.dashTime <= 0, pl.dir, 60, "dash").landAt(tx(123) + 16);
      pl.check(Math.abs(pl.feet - tx(16)) < 1, "over the pillar gap");
      // The chain: wait on the bank for the turning card's back, jump + dash
      // onto it, the held bounce (jump in the stomp's freeze) and a dash on
      // its refill reach the island.
      chainCard(pl);
      pl.jump().settle().apex().dash();
      pl.until((p) => p.p.dashTime <= 0, pl.dir, 60, "dash").landAt(tx(155));
      pl.right().to(tx(158)).check(pl.g.phase === "won", "goal face");
    },
    mastery(pl) {
      pl.right().to(tx(7) + 4).jump();
      pl.until((p) => p.g.dashUnlocked).settle().land();
      jumpDash(pl, tx(19) + 26, tx(16), "Gap A");
      jumpDash(pl, tx(37) + 26, tx(16), "develop 12");
      jumpDash(pl, tx(55) + 26, tx(16), "develop 14");
      orbCrossing(pl, tx(75) + 26, tx(16), "twist orb");
      // Sticker 2 (white): bounce off the pillar lookout's back, dash low at
      // once on the stomp's refill, air jump up to the bank.
      pl.color("white");
      pl.right().to(tx(101) + 24).jump().apex().dash();
      pl.until((p) => p.p.dashTime <= 0, pl.dir, 60, "dash").steerTo((p) => p.guard("pillar").x - 6);
      pl.right().settle().wait(0.02).dash();
      pl.until((p) => p.p.dashTime <= 0, pl.dir, 60, "dash").jump();
      pl.landAt(tx(123) + 16);
      pl.check(pl.g.stickers[1].collected, "second dash line");
      // Sticker 3: white onto the chain card's back (the jump is still held,
      // so the bounce is the high one), the air jump at its peak, a dash.
      chainCard(pl, "white");
      pl.settle().apex().jump().apex().dash();
      pl.until((p) => p.p.dashTime <= 0, pl.dir, 60, "dash");
      pl.check(pl.g.stickers[2].collected, "high sticker");
      pl.color("green").landAt(tx(155));
      pl.right().to(tx(158)).check(pl.g.phase === "won", "goal face");
    },
  },
  "1-5": {
    baseline(pl) {
      // The arena as green: the teaching card hums. Below the lip, wait for
      // P1's back, white up, green again in the air, through P1 as green.
      pl.right().color("green");
      p1Climb(pl);
      // Below P2's post (out of its cone): wait for its back, white up, green
      // in the air, onto its back, and the bounce carries down to the post.
      p2Climb(pl);
      // The enforcer (red) sees green and it is the gate: wait at the post
      // (the step's riser cuts its cone) for its back, then up the step and
      // straight onto its back.
      enforcerStomp(pl);
      pl.until((p) => p.p.grounded, (p) => (p.cx < tx(80) ? { right: true } : {}), 240, "past the enforcer");
      // Up onto the checkpoint block (its risers cut both floor cones).
      pl.right().to(tx(82) + 4).jump().landAt(tx(85));
      pl.check(Math.abs(pl.feet - tx(14)) < 1, "on the block");
      pl.to(tx(85)).stop();
      pl.until((p) => p.guard("cross-red").dir === 1 && p.guard("cross-red").turning <= 0, {}, 900, "red away");
      pl.right().to(pl.guard("cross-red").x - 230).jump().steerTo((p) => p.guard("cross-red").x - 10);
      pl.check(pl.guard("cross-red").state === "stunned", "red sentry stomped");
      // Down from the bounce between slabs 2 and 3 (a held bounce would reach
      // the high line: that is the mastery's way).
      pl.landAt(tx(103) + 16);
      pl.check(Math.abs(pl.feet - tx(16)) < 1, "past the red sentry, on the floor");
      // The goal block: wait below it (as green) for its card's back, white
      // up the 4-tile face, green again before landing, walk through it.
      pl.right().to(tx(111) + 16).stop();
      const blockCard = (p) => p.guard("cross-green");
      pl.until((p) => blockCard(p).dir === 1 && blockCard(p).turning <= 0, {}, 900, "block card away");
      pl.right().press({ color: "white", jump: true }).airJump().wait(0.15).press({ color: "green" }).land();
      pl.check(pl.p.color === "green", "green through the block's card");
      if (pl.g.phase !== "won") pl.to(tx(120));
      pl.check(pl.g.phase === "won", "goal face");
    },
    mastery(pl) {
      // Sticker 1: green (unseen) in the arena; let the teaching card walk
      // past, then come down on its back and ride the bounce.
      pl.color("green").right().to(tx(27) + 16).stop();
      pl.until((p) => p.guard("teacher").dir < 0 && p.guard("teacher").x < p.cx - 50 && p.guard("teacher").x > tx(24), {}, 1200, "teacher passed");
      pl.jump().steerTo((p) => p.guard("teacher").x + 8);
      pl.check(pl.g.stomps === 1, "teacher stomped");
      pl.landAt(tx(27));
      pl.check(pl.g.stickers[0].collected, "arena sticker");
      p1Climb(pl, { quick: true });
      p2Climb(pl);
      // Sticker 2: white (behind the riser), the same stomp held, and an air
      // jump at the bounce's peak onto the high perch behind it.
      pl.right().to(tx(62) + 16).color("white");
      enforcerStomp(pl);
      pl.airJump().landAt(tx(77) + 16);
      pl.check(pl.g.stickers[1].collected, "perch sticker");
      pl.right().to(tx(81) + 8).land();
      pl.to(tx(82) + 4).stop().wait(0.1).jump().landAt(tx(85)); // onto the checkpoint block
      pl.check(Math.abs(pl.feet - tx(14)) < 1, "on the block");
      // Sticker 3: white double jump onto the high line, slab to slab, a hop
      // at the end of slab 3, then straight onto the goal block.
      pl.color("white").right().to(tx(86)).jump().airJump().landAt(tx(89) + 16);
      pl.check(Math.abs(pl.feet - tx(10)) < 1, "high line");
      jumpAt(pl, tx(91) + 8).land();
      jumpAt(pl, tx(100) + 8).land();
      pl.to(tx(109) + 4).stop().wait(0.1).jump().land();
      pl.check(pl.g.stickers[2].collected, "high sticker");
      // Off slab 3 onto the goal block, green before landing in its card's view.
      pl.right().jump().apex().dash();
      pl.until((p) => p.p.dashTime <= 0, pl.dir, 60, "dash").color("green").land();
      pl.to(tx(120)).check(pl.g.phase === "won", "goal face");
    },
  },
  "1-6": {
    baseline(pl) {
      heistInbound(pl);
      heistEscape(pl, { roof: false });
    },
    mastery(pl) {
      heistInbound(pl, { alcove: true });
      heistEscape(pl, { roof: true, alcove: true });
    },
  },
};

/** 1-5 develop: on P2 behind the cover block (it cuts the sentry's cone),
 * wait for the sentry to face away, then hop the cover onto its back: the
 * stomp bounces Rubik down to the post. (Hopping at its face lands on its
 * raised spear: a stumble since revision five, not a launch.) */
/** 1-5 develop: the arena climb onto P1, timed to P1's back (or, `quick`,
 * the expert's swap 0.15 s after the air jump, under its 0.25 s "?"). */
function p1Climb(pl, { quick = false } = {}) {
  const c = (p) => p.guard("p1");
  pl.right().to(tx(33) + 8);
  if (!quick) {
    pl.stop();
    pl.until((p) => c(p).dir === 1 && c(p).turning <= 0 && c(p).turnClock < 0.3, {}, 1200, "p1 looks away");
    pl.right();
  }
  pl.press({ color: "white", jump: true }).airJump().wait(0.15).press({ color: "green" });
  pl.until((p) => p.p.grounded, { right: true }, 240, "onto P1");
  pl.check(Math.abs(pl.feet - tx(12)) < 1 && pl.p.color === "green", "on P1, green");
}
/** 1-5 develop: the climb onto P2's post. Wait below it until P2 has just
 * turned away, white up (green 0.15 s after the air jump), stomp its back,
 * and ride the bounce down to the post. `quick`: no wait; if P2 faces him,
 * walk through it as green (the quick swap never drew a "?") and drop. */
function p2Climb(pl, { quick = false } = {}) {
  const s = (p) => p.guard("p2");
  pl.right().to(tx(44) + 8).jump().land(); // hop P1's block
  pl.right().to(tx(49) + 8);
  if (!quick) {
    pl.stop();
    pl.until((p) => s(p).dir === 1 && s(p).turning <= 0 && s(p).turnClock < 0.3, {}, 1200, "p2 looks away");
    pl.right();
  }
  pl.press({ color: "white", jump: true }).airJump().wait(0.15).press({ color: "green" });
  pl.until((p) => p.p.grounded || p.g.stomps > 0 && s(p).state === "stunned", { right: true }, 240, "onto P2's post");
  if (s(pl).state !== "stunned" && s(pl).dir === 1) {
    pl.right().jump().steerTo((p) => s(p).x - 6);
    pl.check(s(pl).state === "stunned", "p2 stomped from behind");
  }
  pl.until((p) => p.p.grounded && p.feet > tx(15), (p) => (p.cx < tx(61) ? { right: true } : {}), 600, "down to the post");
}

/** 1-5 twist: wait at the post (behind the step's riser) for the enforcer to
 * face away, up the step, and a held running jump onto its back. */
function enforcerStomp(pl) {
  const e = (p) => p.guard("enforcer");
  pl.right().to(tx(62) + 16).stop();
  // Facing away with >= 1.8 s left of its 3 s: enough for the step and the jump.
  pl.until((p) => e(p).dir === 1 && e(p).turning <= 0 && e(p).turnClock < 1.2, {}, 900, "enforcer away");
  pl.right().jump().landAt(tx(65) + 8); // up the step
  pl.right().jump().steerTo((p) => e(p).x - 10);
  pl.check(e(pl).state === "stunned", "enforcer stomped from behind");
}

/** 1-6 inbound: corridor in green, white up the ledge, green past the lookout
 * (optionally the swap alcove), the dash crossing, the steps, and the vault. */
function heistInbound(pl, { alcove = false } = {}) {
  pl.color("green").right().to(tx(41) + 8); // the canopy corridor, green
  // The ledge pair: the red sentry at the ledge's lip sees green, and its
  // cone covers the whole ledge, so the climb waits below in the corridor
  // for its back. Then white up (green again in the air), through the green
  // lookout, and a stomp on the red sentry's back, a dash at the bounce's
  // apex (the stomp refills it) onto the island.
  // The first wait that stays unseen is kept.
  const red = (p) => p.guard("ledge-red"),
    unseen = pl.g.spotted;
  pl.choose(
    [0, 0.3, 0.6, 0.9, 1.2, 1.5, 1.8, 2.1, 2.4, 2.7, 3, 3.3, 3.6, 3.9, 4.2, 4.5].map((w) => (f) => {
      f.stop().wait(w).right().to(tx(42) + 8);
      f.press({ color: "white", jump: true }).airJump().wait(0.15).press({ color: "green" });
      f.until((p) => p.p.grounded && Math.abs(p.feet - tx(12)) < 1, { right: true }, 240, "ledge");
      if (alcove) {
        // Sticker 1: green jump up through the lookout, white air jump at the apex.
        f.to(tx(47) + 8).stop().wait(0.1).jump().apex().press({ color: "white", jump: true }).landAt(tx(48) + 16);
        f.check(f.g.stickers[0].collected, "swap alcove");
        // The alcove is above the red sentry's cone: wait up here for its back.
        f.color("green").stop();
        f.until((p) => red(p).dir === 1 && red(p).turning <= 0 && red(p).turnClock < 1, {}, 900, "ledge sentry away (alcove)");
      }
      f.right().to(tx(50) + 4).jump().steerTo((p) => red(p).x - 8);
      f.check(red(f).state === "stunned", "ledge sentry stomped");
      // The stomp refilled the dash: dash at the bounce's apex onto the island.
      f.right().apex().dash();
      f.until((p) => p.p.dashTime <= 0, f.dir, 60, "dash").landAt(tx(66));
    }),
    (f) => f.g.spotted === unseen && f.g.deaths === 0 && Math.abs(f.feet - tx(14)) < 1,
    "ledge pair",
  );
  pl.check(Math.abs(pl.feet - tx(14)) < 1, "island");
  pl.to(tx(67) + 26).jump().apex().dash();
  pl.until((p) => p.p.dashCharge > 0 && p.p.dashTime <= 0 && p.p.vy > 120, pl.dir, 120, "orb").dash().land();
  pl.check(Math.abs(pl.feet - tx(14)) < 1, "bank");
  // Stairs: stair 3 is below every chamber cone; hop up to it while the
  // vault guard faces the vault, wait there for its next turn away, then up
  // to the landing (the green patrol hums) and stomp it from behind.
  const away = (p) => p.guard("vault-guard").dir === 1 && p.guard("vault-guard").turning <= 0 && p.guard("vault-guard").turnClock < 0.2;
  jumpAt(pl, tx(99) + 8).land();
  pl.to(tx(101) + 8).stop();
  pl.until(away, {}, 1200, "vault guard away");
  pl.jump().landAt(tx(104) + 16);
  pl.until(away, {}, 1200, "vault guard away again");
  pl.jump().landAt((p) => p.guard("vault-guard").x - 180);
  pl.jump().steerTo((p) => p.guard("vault-guard").x - 8);
  pl.check(pl.guard("vault-guard").state === "stunned", "vault guard stomped");
  pl.right().land();
  pl.until((p) => p.g.stolen, { right: true }, 240, "theft");
  pl.settle();
}

/** 1-6 escape: smash the door (the same dash knocks the alarm card outside
 * it), the crossing back, home by the corridor (green) or the roof gates
 * (red smashes). */
function heistEscape(pl, { roof = false, alcove = false } = {}) {
  if (alcove) {
    // Sticker 2: the alarm card stands between Rubik and the alcove: knock
    // it aside with a red dash (the knock refunds the dash), smash the
    // alcove stone, then turn for home before it gets up (3 s).
    pl.right();
    pl.until((p) => Math.abs(p.guard("alarm").x - p.cx) < 110, pl.dir, 600, "near the alarm card").dash();
    pl.until((p) => p.p.dashTime <= 0, pl.dir, 60, "knock");
    pl.check(pl.guard("alarm").state === "stunned", "alarm card knocked");
    pl.to(tx(129)).dash();
    pl.until((p) => p.p.dashTime <= 0, pl.dir, 60, "alcove smash");
    pl.check(pl.g.stickers[1].collected, "alcove sticker");
  }
  pl.left();
  // The forced smash, from the doorway, before the alarm card gets close.
  pl.until((p) => p.cx < tx(112) + 24, { left: true }, 600, "to the door").dash();
  pl.until((p) => p.p.dashTime <= 0, pl.dir, 60, "smash");
  pl.check(pl.g.smashes >= 1, "door smashed");
  const deaths = pl.g.deaths;
  pl.to(tx(100)).land();
  let spotted = pl.g.spotted;
  // The crossing back: jump, dash, the orb, dash, onto the 4-tile island.
  // The island card faces the incoming Rubik (spear up: no stomp) and
  // patrols the island, so the landing is timed: wait on the bank, then fly
  // and hold toward the island until the feet are over it (a lip caught by
  // the box edge alone is scrambled onto while moving toward it). Green walks
  // through the card; red knocks it aside with a ground dash (refund). Then a
  // jump + dash from the lip reaches the ledge. The first option that reaches
  // the ledge unseen and alive is kept.
  spotted = pl.g.spotted;
  const island = tx(67); // the island's right edge
  pl.choose(
    [0, 0.3, 0.6, 0.9, 1.2, 1.5].flatMap((wait) => [0, 120, 240].flatMap((vy) => [true, false].map((green) => [wait, vy, green]))).map(([wait, vy, green]) => (f) => {
      f.stop().wait(wait).left().to(tx(85) + 8).jump().apex().dash();
      f.until((p) => p.p.dashCharge > 0 && p.p.dashTime <= 0 && p.p.vy >= vy, f.dir, 160, "orb").dash();
      f.until((p) => p.p.dashTime <= 0, f.dir, 60, "dash");
      if (green) f.color("green"); // green lands unseen and walks through it
      f.until((p) => p.p.grounded || p.g.phase !== "playing", (p) => (p.cx - M.PLAYER.foot > island - 4 ? { left: true } : {}), 240, "island");
      if (!green && f.guard("ambush").state !== "stunned") {
        f.until((p) => p.p.dashCooldown <= 0, {}, 60, "cooldown").left().dash();
        f.until((p) => p.p.dashTime <= 0, f.dir, 60, "knock");
      }
      f.left().to(tx(64) + 8).jump().apex().dash();
      f.until((p) => p.p.dashTime <= 0, f.dir, 60, "dash").landAt(tx(50));
    }),
    (f) => f.g.deaths === deaths && f.g.spotted === spotted && Math.abs(f.feet - tx(12)) < 1 && f.g.phase === "playing",
    "island crossing",
  );
  // The ledge pair on the way home: red walks past the red sentry; the green
  // lookout sees red, so knock it aside with a red dash.
  pl.left().color("red");
  pl.until((p) => Math.abs(p.guard("lookout").x - p.cx) < 120 || p.guard("lookout").state === "stunned", pl.dir, 240, "near the lookout");
  if (pl.guard("lookout").state !== "stunned") pl.dash().until((p) => p.p.dashTime <= 0, pl.dir, 60, "knock the lookout");
  pl.check(pl.guard("lookout").state === "stunned", "lookout knocked");
  if (roof) {
    // Sticker 3: from the ledge's left edge, jump and red-dash into the stacked
    // gate, run the roof, dash the mid gate, drop home.
    pl.to(tx(44) + 6);
    pl.press({ color: "red", jump: true }).apex().dash();
    pl.until((p) => p.p.dashTime <= 0, pl.dir, 60, "gate");
    pl.land();
    pl.to(tx(34)).dash();
    pl.until((p) => p.p.dashTime <= 0, pl.dir, 60, "mid gate");
    pl.check(pl.g.stickers[2].collected, "roof sticker");
    pl.to(tx(21)).land();
  } else {
    pl.color("green").to(tx(43)).land(); // drop into the corridor, green past the patrol
    pl.to(tx(21) + 8).land();
  }
  // Green or red, carrying the stolen red is what counts at home.
  jumpAt(pl, tx(17) + 20).land();
  jumpAt(pl, tx(13) + 20).land();
  pl.to(tx(10)).check(pl.g.phase === "won", "home");
}

/** 1-2 introduce: from the cliff's edge, jump onto the slow pit card's back
 * while it walks away; the held bounce clears the far rim. */
function stompIntoPit(pl) {
  // Under the rock lip at the cliff's edge: no jump, so watch the card and
  // walk off onto its back while it walks away; jump in the stomp's freeze
  // for the high bounce, which clears the 6-tile far rim.
  pl.right().to(tx(12) + 4).stop();
  const card = (p) => p.guard("pit");
  pl.until((p) => card(p).dir === 1 && card(p).turning <= 0 && card(p).x > tx(14) + 24 && card(p).x < tx(15) + 24, {}, 1500, "pit card walking away");
  pl.right().until((p) => !p.p.grounded, { right: true }, 120, "off the edge").steerTo((p) => card(p).x - 6);
  pl.check(card(pl).state === "stunned", "pit card stomped");
  pl.jump().landAt(tx(29) + 16);
  pl.check(Math.abs(pl.feet - tx(12)) < 1, "far rim");
}
/** 1-2 develop: bounce from back to back along the island lookouts
 * (mastery: air jump off the last bounce onto sticker 3's slab). */
function islandChain(pl, slab) {
  pl.right().to(tx(32) + 10).jump();
  for (const id of ["isle-a", "isle-b", "isle-c", "isle-d"]) {
    pl.steerTo((p) => p.guard(id).x - 4);
    pl.check(pl.guard(id).state === "stunned", `${id} stomped`);
  }
  if (slab) {
    pl.right().airJump().landAt(tx(61) + 16);
    pl.check(pl.g.stickers[2].collected, "slab sticker");
    pl.right().until((p) => !p.p.grounded, { right: true }, 120, "off the slab");
  }
  pl.landAt(tx(64) + 16);
  pl.right().to(tx(66) + 16).stop().wait(0.1);
  pl.jump().landAt(tx(68) + 24); // onto the 2-tile block
  pl.check(Math.abs(pl.feet - tx(16)) < 1, "on the block");
}
/** 1-2 twist: drop behind the wall patrol as it walks to the wall, stomp,
 * air jump at the bounce's peak onto the wall (or drift left to sticker 2). */
function wallStomp(pl, { ledge }) {
  const card = (p) => p.guard("wall"); // waits on the block, above the patrol's cone
  pl.until((p) => card(p).dir === 1 && card(p).turning <= 0 && card(p).x > tx(74) && card(p).x < tx(76), {}, 1200, "wall card walking to the wall");
  pl.right().jump().steerTo((p) => card(p).x - 6);
  pl.check(card(pl).state === "stunned", "wall card stomped");
  if (ledge) {
    pl.airJump().landAt(tx(75));
    pl.check(pl.g.stickers[1].collected, "the 8-tile ledge");
    // Off the ledge's left end, behind the patrol, for a second stomp.
    pl.left().until((p) => !p.p.grounded, { left: true }, 120, "off the ledge").landAt(tx(71) + 16);
    pl.until((p) => card(p).state !== "stunned" && card(p).dir === 1 && card(p).turning <= 0 && card(p).x > tx(74) && card(p).x < tx(76), {}, 1500, "wall card again");
    pl.right().jump().steerTo((p) => card(p).x - 6);
    pl.check(card(pl).state === "stunned", "wall card stomped again");
  }
  pl.right().airJump();
  pl.until((p) => p.p.grounded, { right: true }, 240, "on the wall");
  pl.check(Math.abs(pl.feet - tx(11)) < 1, "on the wall");
}
/** 1-2 conclude: off the run-up onto the green card's back: GREEN GET. */
function glowDrop(pl) {
  pl.right().to(tx(118)).until((p) => p.g.gets.includes("green"));
  pl.settle().land();
  pl.right().to(tx(128)).check(pl.g.phase === "won", "goal face");
}
/** 1-3: a watched 4-tile climb. Wait on the floor below the watcher's cone
 * (`base`) until it has just turned away, then white + jump, the air jump,
 * green again 0.15 s later, and land on top (green: it can't see him when it
 * turns back). `quick` skips the wait: the expert's mid-air swap, under the
 * 0.25 s a card needs for its "?". */
function watchedClimb(pl, id, base, { quick = false } = {}) {
  pl.right().to(base);
  if (!quick) {
    pl.stop();
    const c = (p) => p.guard(id);
    pl.until((p) => c(p).dir === 1 && c(p).turning <= 0 && c(p).turnClock < 0.3, {}, 1200, `${id} looks away`);
    pl.right();
  }
  pl.press({ color: "white", jump: true }).airJump().wait(0.15).press({ color: "green" });
  pl.until((p) => p.p.grounded || p.g.phase === "won", { right: true }, 240, `${id} climb`);
  pl.check(Math.abs(pl.feet - tx(12)) < 1 && pl.p.color === "green", `on top by ${id}, green`);
}
/** 1-3 finale: off the step into the pit, then three watched climbs, each
 * card walked through in green, each pillar left by its far edge. */
function pillarFinale(pl, opts = {}) {
  pl.right().to(tx(114)).land(); // walk off the step: the pit is below every cone
  watchedClimb(pl, "pillar-a", tx(124) + 8, opts);
  pl.right().to(tx(132)).land();
  watchedClimb(pl, "pillar-b", tx(142) + 8, opts);
  pl.right().to(tx(150)).land();
  watchedClimb(pl, "platform", tx(160) + 8, opts);
  pl.right().to(tx(173)).check(pl.g.phase === "won", "goal face");
}

/** 1-4 conclude: on the late bank, wait until the chain card has just turned
 * to face the island, then jump + dash onto its back (stunned on return). */
function chainCard(pl, color = null) {
  if (color) pl.color(color);
  const c = (p) => p.guard("chain");
  pl.right().to(tx(124)).stop();
  pl.until((p) => c(p).dir === 1 && c(p).turning <= 0 && c(p).turnClock < 0.3, {}, 1200, "chain card faces away");
  pl.right().to(tx(125) + 26).jump().apex().dash();
  pl.until((p) => p.p.dashTime <= 0, pl.dir, 60, "dash").steerTo((p) => c(p).x - 6);
  pl.check(c(pl).state === "stunned", "chain card stomped");
}
/** 1-4: jump at the lip, dash at the apex, land on the far bank (floor y). */
function jumpDash(pl, lip, floor, label) {
  pl.right().to(lip).jump().apex().dash();
  pl.until((p) => p.p.dashTime <= 0, pl.dir, 60, "dash").landAt(lip + 1000);
  pl.check(Math.abs(pl.feet - floor) < 1, label);
}
/** 1-4: jump, dash, the orb refills, a second dash timed on the way down
 * (the first timing among a few that lands is kept). */
function orbCrossing(pl, lip, floor, label) {
  pl.right().to(lip).jump().apex().dash();
  pl.choose(
    [150, 100, 200, 250, 60, 300].map((vy) => (f) => {
      f.until((p) => p.p.dashCharge > 0 && p.p.dashTime <= 0 && p.p.vy > vy, f.dir, 120, "orb").dash();
      f.until((p) => p.p.dashTime <= 0, f.dir, 60, "dash").land();
    }),
    (f) => f.g.deaths === 0 && Math.abs(f.feet - floor) < 1,
    label,
  );
}

/** Expert lines for the skill-gradient audit (tests/movement-audit.test.mjs,
 * D2). Not QA fixtures and not required to finish anything: the same goal by
 * optional technique. 1-4: a dash-jump off every lip (a ground dash with a
 * jump during it keeps 560 px/s) and the air dash at its apex; 1-5: no
 * waiting on its red lookouts (perch to perch, then the high line); 1-6: the
 * guided heist, then home over the roof gates (jump + red dash through the
 * stacked gate, run the roof, dash the mid gate) instead of the corridor. */
export const EXPERT = {
  "1-4"(pl) {
    const dashEnd = () => pl.until((p) => p.p.dashTime <= 0, pl.dir, 60, "dash end");
    const groundDash = () => pl.until((p) => p.p.dashCooldown <= 0 && p.p.grounded && p.g.hitstop <= 0, pl.dir, 60, "cooldown").dash();
    const dashJumpAt = (lip) => {
      pl.to(lip - 60);
      groundDash();
      pl.wait(0.06).jump();
    };
    const gap = (lip, label) => {
      dashJumpAt(lip);
      pl.apex().dash();
      dashEnd().land();
      pl.check(Math.abs(pl.feet - tx(16)) < 1, label);
    };
    pl.right().to(tx(7) + 4).jump();
    pl.until((p) => p.g.dashUnlocked).settle().land();
    gap(tx(19) + 26, "Gap A");
    gap(tx(37) + 26, "develop 12");
    gap(tx(55) + 26, "develop 14");
    dashJumpAt(tx(75) + 26);
    pl.apex().dash();
    pl.choose(
      [150, 100, 200, 60, 250].map((vy) => (f) => {
        f.until((p) => p.p.dashCharge > 0 && p.p.dashTime <= 0 && p.p.vy > vy, f.dir, 120, "orb").dash();
        f.until((p) => p.p.dashTime <= 0, f.dir, 60, "dash").land();
      }),
      (f) => f.g.deaths === 0 && Math.abs(f.feet - tx(16)) < 1,
      "twist orb",
    );
    dashJumpAt(tx(101) + 24);
    pl.apex().dash();
    dashEnd().steerTo((p) => p.guard("pillar").x - 6);
    pl.check(pl.guard("pillar").state === "stunned", "pillar stomped");
    pl.settle().apex().dash();
    dashEnd().landAt(tx(123) + 16);
    // The chain card, without the guided wait: if it faces the island, a
    // dash-jump onto its back; if it faces the bank (spear up), white flies
    // over it, turns back and drops onto its back from the island side,
    // then the bounce, the refreshed air jump and the refilled dash reach
    // the island. The first line that lands is kept (waiting only if both fail).
    const c = (p) => p.guard("chain");
    const direct = (f) => {
      f.right();
      f.check(c(f).dir === 1 && c(f).turning <= 0, "faces away");
      f.to(tx(124));
      f.until((p) => p.p.dashCooldown <= 0 && p.p.grounded && p.g.hitstop <= 0, f.dir, 60, "cooldown").dash();
      f.wait(0.06).jump().apex().dash();
      f.until((p) => p.p.dashTime <= 0, f.dir, 60, "dash end").steerTo((p) => c(p).x - 6);
      f.check(c(f).state === "stunned", "chain stomped");
      f.jump().settle().apex().dash();
      f.until((p) => p.p.dashTime <= 0, f.dir, 60, "dash end").landAt(tx(155));
    };
    const circle = (over) => (f) => {
      f.color("white").right().to(tx(125) + 26).jump().apex().dash();
      f.until((p) => p.p.dashTime <= 0, f.dir, 60, "dash end").airJump();
      f.until((p) => p.cx > c(p).x + over || p.p.grounded || p.g.phase !== "playing", { right: true }, 200, "over the card");
      f.left().steerTo((p) => c(p).x + 4);
      f.check(c(f).state === "stunned", "chain stomped from behind");
      f.right().apex().jump().apex().dash();
      f.until((p) => p.p.dashTime <= 0, f.dir, 60, "dash end").color("green").landAt(tx(155));
    };
    const lines = [direct, circle(40), circle(70)],
      options = [];
    for (const w of [0, 0.2, 0.4, 0.6, 0.8, 1, 1.2, 1.4, 1.6, 1.8, 2, 2.2, 2.4, 2.6, 2.8, 3, 3.2, 3.6, 4, 4.4])
      for (const line of lines) options.push((f) => { if (w) f.stop().wait(w); line(f); });
    pl.choose(options, (f) => f.g.deaths === 0 && f.p.grounded && f.cx > tx(153), "chain card");
    pl.right().to(tx(158)).check(pl.g.phase === "won", "goal face");
  },
  // 1-5: no waiting on the two red lookouts - white double jump perch to
  // perch over the enforcer's cone, then the high line of slabs above both
  // crossing cones, a dash off its end onto the goal block.
  "1-5"(pl) {
    pl.right().color("green");
    p1Climb(pl, { quick: true });
    p2Climb(pl, { quick: true });
    // No wait for the enforcer's back: white, up the step and one double
    // jump over it to the floor beyond, timed so it never sees him long enough
    // (the first timing that stays unseen is kept).
    const unseen = pl.g.spotted;
    pl.right().to(tx(62) + 16).color("white");
    pl.choose(
      [0, 0.2, 0.4, 0.6, 0.8, 1, 1.2, 1.4, 1.6, 1.8, 2, 2.4, 2.8, 3.2].map((w) => (f) => {
        f.stop().wait(w).right().jump().landAt(tx(65) + 8);
        f.right().jump().airJump().landAt(tx(80));
        f.check(f.feet > tx(15) && f.cx > tx(78), "over the enforcer");
      }),
      (f) => f.g.spotted === unseen && f.g.deaths === 0,
      "over the enforcer",
    );
    pl.to(tx(82) + 4).jump().landAt(tx(85));
    pl.check(Math.abs(pl.feet - tx(14)) < 1, "on the block");
    pl.right().to(tx(86)).jump().airJump().landAt(tx(89) + 16);
    pl.check(Math.abs(pl.feet - tx(10)) < 1, "high line");
    jumpAt(pl, tx(91) + 8).land();
    jumpAt(pl, tx(100) + 8).land();
    pl.to(tx(109) + 4).jump().apex().dash();
    pl.until((p) => p.p.dashTime <= 0, pl.dir, 60, "dash").color("green").land();
    pl.right().to(tx(120)).check(pl.g.phase === "won", "goal face");
  },
  "1-6"(pl) {
    heistInbound(pl);
    heistEscape(pl, { roof: true });
  },
};
