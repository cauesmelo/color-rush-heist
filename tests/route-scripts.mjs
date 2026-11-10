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
      // Green from the start: the glade patrol and the corridor cards hum.
      pl.right().to(tx(38));
      pl.jump().land(); // the 1-tile step between the patrols (sticker 1)
      pl.to(tx(63) + 8);
      // The 4-tile wall: white and jump on the same press, jump again, and
      // green again before landing on top (the lookout patrols up there).
      pl.press({ color: "white", jump: true }).airJump().wait(0.15).press({ color: "green" });
      pl.until((p) => p.feet <= tx(12) + 1 && p.p.grounded, { right: true }, 240, "on the wall");
      pl.to(tx(84)).land();
      // Patrol C hums as green Rubik walks through; white up the 4-tile step.
      pl.to(tx(95) + 24).press({ color: "white", jump: true }).airJump().wait(0.15).press({ color: "green" }).land();
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
      // The white climb up the 4-tile step lands in the alcove card's view:
      // time it (the first wait that stays unseen is kept).
      const unseen = pl.g.spotted;
      pl.choose(
        [0, 0.4, 0.8, 1.2, 1.6, 2, 2.4, 2.8, 3.2].map((w) => (f) => {
          f.to(tx(95)).stop().wait(w).right().to(tx(95) + 24);
          f.press({ color: "white", jump: true }).airJump().wait(0.15).press({ color: "green" }).land();
          f.wait(0.8, {});
        }),
        (f) => f.g.spotted === unseen && Math.abs(f.feet - tx(12)) < 1,
        "alcove climb",
      );
      // Sticker 3: green jump up through the alcove card, white air jump at the apex.
      pl.to(tx(103) + 8).stop().wait(0.1).jump().apex().press({ color: "white", jump: true }).land();
      pl.check(pl.g.stickers[2].collected, "alcove sticker");
      pl.color("green").right();
      pillarFinale(pl);
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
      // The chain: dash through orb A, the chain lookout's back, dash through
      // orb B, dash again onto the island (the patrol is green, like Rubik).
      pl.right().to(tx(125) + 26).jump().apex().dash();
      pl.steerTo((p) => p.guard("chain").x - 6);
      pl.check(pl.guard("chain").state === "stunned", "chain stomped");
      pl.right().settle().apex().dash();
      pl.until((p) => p.p.dashTime <= 0, pl.dir, 60, "dash").dash();
      pl.landAt(tx(147));
      pl.right().to(tx(151)).check(pl.g.phase === "won", "goal face");
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
      // Sticker 3: the high line - jump, air jump, dash at its apex, the high
      // orb refills, dash again, and fall straight onto the island.
      pl.right().to(tx(125) + 20).jump().airJump().apex().dash();
      pl.until((p) => p.p.dashCharge > 0 && p.p.dashTime <= 0, pl.dir, 120, "high orb").dash();
      pl.until((p) => p.p.dashTime <= 0, pl.dir, 60, "dash");
      pl.check(pl.g.stickers[2].collected, "high sticker");
      pl.color("green").landAt(tx(147));
      pl.right().to(tx(151)).check(pl.g.phase === "won", "goal face");
    },
  },
  "1-5": {
    baseline(pl) {
      // The arena as green: the teaching card hums.
      pl.right().color("green").to(tx(33) + 8);
      // White double jump onto P1, landing behind the cover block.
      pl.press({ color: "white", jump: true }).airJump().land();
      jumpAt(pl, tx(36) + 8).land(); // hop the cover block
      pl.color("green").to(tx(52) + 4); // green past the P1 patrol
      pl.press({ color: "white", jump: true }).airJump().wait(0.15).press({ color: "green" }).land();
      // Behind P2's cover (it cuts the sentry's cone): wait for its back, hop
      // the cover onto it (a stomp from behind), bounce down to the post.
      p2Hop(pl);
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
      pl.right().to(tx(33) + 8);
      pl.press({ color: "white", jump: true }).airJump().land();
      jumpAt(pl, tx(36) + 8).land();
      pl.color("green").to(tx(52) + 4);
      pl.press({ color: "white", jump: true }).airJump().wait(0.15).press({ color: "green" }).land();
      p2Hop(pl);
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
function p2Hop(pl) {
  const s = (p) => p.guard("p2");
  pl.stop();
  pl.until((p) => s(p).dir === 1 && s(p).turning <= 0 && s(p).turnClock < 0.4, {}, 900, "p2 away");
  pl.right().jump();
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
  pl.color("green").right().to(tx(42) + 8); // the canopy corridor, green
  pl.press({ color: "white", jump: true }).airJump().wait(0.15).press({ color: "green" });
  pl.until((p) => p.p.grounded && Math.abs(p.feet - tx(12)) < 1, { right: true }, 240, "ledge");
  if (alcove) {
    // Sticker 1: green jump up through the lookout, white air jump at the apex.
    pl.to(tx(48) + 8).stop().wait(0.1).jump().apex().press({ color: "white", jump: true }).landAt(tx(49) + 16);
    pl.check(pl.g.stickers[0].collected, "swap alcove");
    // Off the alcove's right end once the lookout below has walked clear
    // (landing on its head would bounce Rubik out over the water).
    pl.color("green").stop();
    pl.until((p) => Math.abs(p.guard("lookout").x - tx(51)) > 70, {}, 900, "lookout clear");
    pl.right().until((p) => !p.p.grounded, { right: true }, 120, "off the alcove").landAt(tx(51));
    pl.check(Math.abs(pl.feet - tx(12)) < 1, "back on the ledge");
  }
  // The crossing: a jump down to the island, jump + dash + orb + dash to the bank.
  pl.right().to(tx(53) + 26).jump().landAt(tx(66));
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
  pl.left();
  if (roof) {
    // Sticker 3: from the ledge's left edge, jump and red-dash into the stacked
    // gate, run the roof, dash the mid gate, drop home.
    pl.color("green").to(tx(44) + 6); // green past the lookout (it faces the vault)
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
  pl.right().to(tx(12) + 4).stop();
  const card = (p) => p.guard("pit");
  pl.until((p) => card(p).dir === 1 && card(p).turning <= 0 && card(p).x > tx(17) && card(p).x < tx(19), {}, 1200, "pit card walking away");
  pl.right().jump().steerTo((p) => card(p).x - 6);
  pl.check(card(pl).state === "stunned", "pit card stomped");
  pl.landAt(tx(29) + 16);
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
/** 1-3 finale: wait as green; when the card you stand by faces you (so the
 * hop goes out behind it), go white and double-jump, green again before
 * landing on the next pillar. */
function pillarFinale(pl) {
  const hop = (card, target) => {
    pl.stop().color("green");
    pl.until((p) => !card || (p.guard(card).dir === -1 && p.guard(card).turning <= 0 && p.guard(card).turnClock < 0.4), {}, 1200, `${card} faces back`);
    pl.right().press({ color: "white", jump: true }).airJump().wait(0.15).press({ color: "green" });
    pl.landAt(target);
    pl.check(Math.abs(pl.feet - tx(12)) < 1, `landed by ${target}`);
  };
  // Land on a pillar's left edge (clear of its card), walk through the card
  // as green to the right edge, hop from there.
  const cross = (target) => pl.right().to(target).stop();
  pl.right().to(tx(113) + 10);
  hop(null, tx(126) + 4);
  cross(tx(129) + 12);
  hop("pillar-a", tx(142) + 4);
  cross(tx(145) + 12);
  hop("pillar-b", tx(158) + 8);
  pl.right().to(tx(164)).check(pl.g.phase === "won", "goal face");
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
    pl.right().to(tx(125) + 26).jump().apex().dash();
    pl.steerTo((p) => p.guard("chain").x - 6);
    pl.check(pl.guard("chain").state === "stunned", "chain stomped");
    pl.right().settle().apex().dash();
    dashEnd().dash();
    // Onto the island beside its patrol, not on its head (a bounce costs ~1 s).
    const stomps = pl.g.stomps;
    pl.choose(
      [150, 151, 149, 148, 147, 146, 145].map((target) => (f) => f.landAt(tx(target)).right().to(tx(151))),
      (f) => f.g.phase === "won" && f.g.stomps === stomps,
      "island",
    );
  },
  // 1-5: no waiting on the two red lookouts - white double jump perch to
  // perch over the enforcer's cone, then the high line of slabs above both
  // crossing cones, a dash off its end onto the goal block.
  "1-5"(pl) {
    pl.right().color("green").to(tx(33) + 8);
    pl.press({ color: "white", jump: true }).airJump().land();
    jumpAt(pl, tx(36) + 8).land();
    pl.color("green").to(tx(52) + 4);
    pl.press({ color: "white", jump: true }).airJump().wait(0.15).press({ color: "green" }).land();
    pl.jump();
    pl.until((p) => p.p.grounded && p.feet > tx(15), (p) => (p.cx < tx(61) ? { right: true } : {}), 600, "down to the post");
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
