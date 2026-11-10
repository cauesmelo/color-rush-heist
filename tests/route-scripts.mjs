/** Planner scripts for every level's QA routes (see tests/route-planner.mjs).
 * Coordinates are world px (tile * 32); comments name the beat being played.
 * baseline = the guided main line; mastery = all three stickers. */
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
      pl.right().to(400);
      pl.until((p) => p.p.vx === 0 && p.p.grounded); // the notch card blocks the path
      pl.jump().steerTo(480 + 30); // hop onto it: boing (sticker 1 at the apex)
      pl.right().land();
      // Island cards: jump off the bank, then ride the bounces across.
      jumpAt(pl, tx(28) + 10);
      for (const col of [34, 41, 48, 56]) pl.steerTo(tx(col) + 16);
      pl.right().land();
      pl.check(Math.abs(pl.feet - tx(18)) < 1, "far bank");
      // The 7-tile wall: hop on its card, jump again in the air.
      pl.to(tx(76)).jump().steerTo(tx(79) + 16);
      pl.right().airJump().land();
      pl.check(Math.abs(pl.feet - tx(11)) < 1, "on the wall");
      // Two cards in a row: the floor card, then the pedestal card, and over.
      pl.to(tx(94) + 20).land();
      pl.to(tx(95)).jump().steerTo(tx(97) + 16);
      pl.steerTo(tx(101));
      pl.right().land();
      jumpAt(pl, tx(106)).land(); // 2-tile steps
      jumpAt(pl, tx(108)).land();
      // Run-up and the drop onto the glowing card: GREEN GET.
      pl.to(tx(118)).until((p) => p.g.gets.includes("green"));
      pl.settle().land();
      pl.right().to(tx(129)).check(pl.g.phase === "won", "goal face");
    },
    mastery(pl) {
      pl.right().to(400);
      pl.until((p) => p.p.vx === 0 && p.p.grounded);
      pl.jump().steerTo(480 + 30);
      pl.right().land();
      jumpAt(pl, tx(28) + 10);
      for (const col of [34, 41, 48, 56]) pl.steerTo(tx(col) + 16);
      pl.right().land();
      // Sticker 2: bounce on the wall card, air jump and drift left onto the ledge.
      pl.to(tx(76)).jump().steerTo(tx(79) + 16);
      pl.left().airJump();
      pl.until((p) => p.p.grounded || p.p.vy > 0 && p.cx < tx(73), { left: true }).stop().land();
      pl.check(Math.abs(pl.feet - tx(10)) < 1, "on the 8-tile ledge");
      // Back down to the wall card and up the wall.
      pl.right().to(tx(75) + 30).land();
      pl.right().to(tx(76)).jump().steerTo(tx(79) + 16);
      pl.right().airJump().land();
      // Sticker 3: bounce chain - floor card, pedestal card, air jump into the nook.
      pl.to(tx(94) + 20).land();
      pl.to(tx(95)).jump().steerTo(tx(97) + 16);
      pl.steerTo(tx(101));
      pl.right().airJump();
      pl.until((p) => p.p.grounded, (p) => (p.cx < tx(104) ? { right: true } : {}));
      pl.check(pl.g.stickers[2].collected, "the nook sticker");
      // Out of the nook: step off its open left end, drift back right below it.
      pl.left().to(tx(102) + 24).stop().wait(0.1);
      pl.until((p) => p.p.grounded && p.feet > tx(17), (p) => (p.cx < tx(104) ? { right: true } : {}), 600, "drop out");
      pl.right();
      jumpAt(pl, tx(106)).land();
      jumpAt(pl, tx(108)).land();
      pl.to(tx(118)).until((p) => p.g.gets.includes("green"));
      pl.settle().land();
      pl.right().to(tx(129)).check(pl.g.phase === "won", "goal face");
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
      pl.to(tx(119)).check(pl.g.phase === "won", "goal face");
    },
    mastery(pl) {
      pl.right().to(tx(38));
      pl.jump().land(); // sticker 1 on the step
      pl.left().to(tx(19) + 8); // back out to the glade
      // Sticker 2: white up the slab, the canopy roof, green past the roof card.
      pl.right().press({ color: "white", jump: true }).airJump();
      pl.until((p) => p.p.grounded && p.feet <= tx(12) + 1, { right: true }, 240, "slab");
      jumpAt(pl, tx(24) + 8).land(); // onto the canopy roof (2 up)
      pl.color("green").to(tx(47));
      pl.stop().wait(0.12).right().press({ color: "white", jump: true }).airJump().land();
      pl.check(pl.g.stickers[1].collected, "roof sticker");
      pl.color("green").to(tx(61) + 8).land(); // off the roof's end
      pl.to(tx(63) + 8);
      pl.press({ color: "white", jump: true }).airJump().wait(0.15).press({ color: "green" });
      pl.until((p) => p.feet <= tx(12) + 1 && p.p.grounded, { right: true }, 240, "on the wall");
      pl.to(tx(84)).land();
      pl.to(tx(95) + 24).press({ color: "white", jump: true }).airJump().wait(0.15).press({ color: "green" }).land();
      // Sticker 3: green jump up through the alcove card, white air jump at the apex.
      pl.to(tx(103) + 8).stop().wait(0.1).jump().apex().press({ color: "white", jump: true }).land();
      pl.check(pl.g.stickers[2].collected, "alcove sticker");
      pl.color("green").right().to(tx(119)).check(pl.g.phase === "won", "goal face");
    },
  },
  "1-4": {
    baseline(pl) {
      pl.right().to(tx(7) + 4).jump(); // hop onto the stump: the swirl -> DASH GET
      pl.until((p) => p.g.dashUnlocked).settle().land();
      // Gap A: jump at the edge, dash at the apex (sticker 1 on that line).
      jumpAt(pl, tx(19) + 26).apex().dash().land();
      pl.check(Math.abs(pl.feet - tx(16)) < 1, "over Gap A");
      jumpAt(pl, tx(37) + 26).apex().dash().land(); // 12 tiles to a higher bank
      jumpAt(pl, tx(55) + 26).apex().dash().land(); // 14 tiles
      pl.check(Math.abs(pl.feet - tx(16)) < 1, "midpoint bank");
      // 18 tiles: jump, dash, the orb refills at the apex, dash again on the way down.
      jumpAt(pl, tx(75) + 26).apex().dash();
      pl.until((p) => p.p.dashCharge > 0 && p.p.dashTime <= 0 && p.p.vy > 150, pl.dir, 120, "orb").dash().land();
      pl.check(Math.abs(pl.feet - tx(16)) < 1, "over the twist");
      // 18 tiles: jump onto the pillar card; its bounce carries to the bank.
      jumpAt(pl, tx(103) + 20).steerTo(tx(112) + 16);
      pl.until((p) => p.p.grounded, (p) => (p.cx < tx(123) ? { right: true } : {}), 240, "bank");
      pl.check(Math.abs(pl.feet - tx(16)) < 1, "over the twist");
      pl.right();
      // The chain: dash through orb A (it refills the charge), drop onto the
      // card, bounce, dash through orb B, dash again; green before landing by
      // the island patrol.
      jumpAt(pl, tx(125) + 26).apex().dash();
      pl.steerTo(tx(135) + 16);
      pl.right().apex().dash();
      pl.until((p) => p.p.dashTime <= 0, pl.dir, 60, "dash").dash();
      pl.color("green").land();
      pl.to(tx(151)).check(pl.g.phase === "won", "goal face");
    },
    mastery(pl) {
      pl.right().to(tx(7) + 4).jump();
      pl.until((p) => p.g.dashUnlocked).settle().land();
      jumpAt(pl, tx(19) + 26).apex().dash().land();
      jumpAt(pl, tx(37) + 26).apex().dash().land();
      jumpAt(pl, tx(55) + 26).apex().dash().land();
      jumpAt(pl, tx(75) + 26).apex().dash();
      pl.until((p) => p.p.dashCharge > 0 && p.p.dashTime <= 0 && p.p.vy > 150, pl.dir, 120, "orb").dash().land();
      // Sticker 2: bounce on the pillar card, then a higher dash line.
      jumpAt(pl, tx(103) + 20).steerTo(tx(112) + 16);
      pl.right().settle().wait(0.02).dash();
      pl.until((p) => p.p.dashTime <= 0, pl.dir, 60, "dash").jump();
      pl.until((p) => p.p.grounded, (p) => (p.cx < tx(123) ? { right: true } : {}), 240, "bank");
      pl.check(pl.g.stickers[1].collected, "second dash line");
      // Sticker 3: the high line - jump, air jump, dash at its apex, the high
      // orb refills, dash again, and fall straight onto the island.
      pl.right().to(tx(125) + 20).jump().airJump().apex().dash();
      pl.until((p) => p.p.dashCharge > 0 && p.p.dashTime <= 0, pl.dir, 120, "high orb").dash();
      pl.until((p) => p.p.dashTime <= 0, pl.dir, 60, "dash");
      pl.check(pl.g.stickers[2].collected, "high sticker");
      pl.color("green").land();
      pl.to(tx(151)).check(pl.g.phase === "won", "goal face");
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
      // Over P2's cover; the sentry up here is green too. Down to the post.
      pl.jump();
      pl.until((p) => p.p.grounded && p.feet > tx(15), (p) => (p.cx < tx(61) ? { right: true } : {}), 600, "down to the post");
      // The enforcer (red) sees green: up the step and the perch, drop on it.
      pl.right();
      pl.to(tx(62) + 16).stop().wait(0.15);
      pl.jump().landAt(tx(65)); // the step...
      pl.jump().landAt(tx(67)); // ...and the perch above the enforcer's cone
      pl.check(Math.abs(pl.feet - tx(12)) < 1, "on the perch");
      pl.right().to(tx(68)).stop();
      pl.until((p) => p.guard("enforcer").dir === 1 && p.guard("enforcer").turning <= 0, {}, 900, "enforcer away");
      pl.right().hop().steerTo(pl.guard("enforcer").x);
      pl.check(pl.guard("enforcer").state === "stunned", "enforcer stomped");
      pl.until((p) => p.p.grounded, (p) => (p.cx < tx(80) ? { right: true } : {}), 240, "past the enforcer");
      // Crossing cones: green for the green patrol; stomp the red sentry from
      // behind once it faces away.
      pl.right();
      jumpAt(pl, tx(82) + 8).land();
      pl.to(tx(85)).stop();
      pl.until((p) => p.guard("cross-red").dir === 1 && p.guard("cross-red").turning <= 0, {}, 900, "red away");
      pl.right().to(pl.guard("cross-red").x - 230).jump().steerTo(pl.guard("cross-red").x);
      pl.check(pl.guard("cross-red").state === "stunned", "red sentry stomped");
      pl.until((p) => p.p.grounded, (p) => (p.cx < tx(110) ? { right: true } : {}), 240, "past the red sentry");
      pl.right();
      jumpAt(pl, tx(117)).land();
      pl.to(tx(120)).check(pl.g.phase === "won", "goal face");
    },
    mastery(pl) {
      // Sticker 1: green (unseen) in the arena, jump as the teaching card
      // walks under, and bounce off its head.
      pl.color("green").right().to(tx(26) + 16).stop();
      pl.until((p) => p.guard("teacher").dir < 0 && p.guard("teacher").x - p.cx < 80 && p.guard("teacher").x > p.cx, {}, 900, "teacher near");
      pl.jump().steerTo((p) => p.guard("teacher").x);
      pl.check(pl.g.stomps === 1, "teacher stomped");
      pl.landAt(tx(27));
      pl.check(pl.g.stickers[0].collected, "arena sticker");
      pl.right().to(tx(33) + 8);
      pl.press({ color: "white", jump: true }).airJump().land();
      jumpAt(pl, tx(36) + 8).land();
      pl.color("green").to(tx(52) + 4);
      pl.press({ color: "white", jump: true }).airJump().wait(0.15).press({ color: "green" }).land();
      pl.jump();
      pl.until((p) => p.p.grounded && p.feet > tx(15), (p) => (p.cx < tx(61) ? { right: true } : {}), 600, "down to the post");
      pl.right();
      pl.to(tx(62) + 16).stop().wait(0.15);
      pl.jump().landAt(tx(65)); // the step...
      pl.jump().landAt(tx(67)); // ...and the perch above the enforcer's cone
      pl.check(Math.abs(pl.feet - tx(12)) < 1, "on the perch");
      pl.right().to(tx(68)).stop();
      // Sticker 2: stomp the enforcer and ride the bounce onto the far perch.
      pl.until((p) => p.guard("enforcer").dir === 1 && p.guard("enforcer").turning <= 0, {}, 900, "enforcer away");
      pl.right().hop().steerTo(pl.guard("enforcer").x);
      pl.right().airJump();
      pl.until((p) => p.p.grounded, (p) => (p.cx < tx(77) + 16 ? { right: true } : {}), 240, "perch");
      pl.check(pl.g.stickers[1].collected, "perch sticker");
      pl.right().to(tx(82)).land();
      jumpAt(pl, tx(82) + 8).land();
      // Sticker 3: white double jump onto the high line, slab to slab, a hop
      // at the end of slab 3, then straight onto the goal block.
      pl.color("white").to(tx(86)).jump().airJump().land();
      pl.check(Math.abs(pl.feet - tx(10)) < 1, "high line");
      jumpAt(pl, tx(91) + 8).land();
      jumpAt(pl, tx(100) + 8).land();
      pl.to(tx(109) + 4).stop().wait(0.1).jump().land();
      pl.check(pl.g.stickers[2].collected, "high sticker");
      pl.right().jump().apex().dash().land();
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
    pl.color("green").right().until((p) => !p.p.grounded, { right: true }, 120, "off the alcove").landAt(tx(51));
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
  pl.until(away, {}, 600, "vault guard away");
  pl.jump().landAt(tx(104) + 16);
  pl.until(away, {}, 600, "vault guard away again");
  pl.jump().landAt((p) => p.guard("vault-guard").x - 180);
  pl.jump().steerTo((p) => p.guard("vault-guard").x);
  pl.check(pl.guard("vault-guard").state === "stunned", "vault guard stomped");
  pl.right().land();
  pl.until((p) => p.g.stolen, { right: true }, 240, "theft");
  pl.settle();
}

/** 1-6 escape: smash the door, knock the landing card, the crossing back,
 * home by the corridor (green) or the roof gates (red smashes). */
function heistEscape(pl, { roof = false, alcove = false } = {}) {
  const dashAt = (id, reach = 120) => {
    pl.until((p) => Math.abs(p.guard(id).x - p.cx) < reach || p.guard(id).state === "stunned", pl.dir, 240, `near ${id}`);
    if (pl.guard(id).state !== "stunned") pl.dash().until((p) => p.p.dashTime <= 0, pl.dir, 60, `knock ${id}`);
    pl.check(pl.guard(id).state === "stunned", `${id} knocked`);
  };
  if (alcove) {
    // Sticker 2: knock both charging burst cards aside (each knock refunds
    // the dash), smash the alcove stone, then turn for home.
    pl.right();
    dashAt("burst-a");
    dashAt("burst-b");
    pl.to(tx(129)).dash();
    pl.until((p) => p.p.dashTime <= 0, pl.dir, 60, "alcove smash");
    pl.check(pl.g.stickers[1].collected, "alcove sticker");
  }
  pl.left();
  pl.until((p) => p.cx < tx(113), { left: true }, 600, "to the door").dash(); // the forced smash
  pl.until((p) => p.p.dashTime <= 0, pl.dir, 60, "smash");
  pl.check(pl.g.smashes >= 1, "door smashed");
  // Knock the landing card aside (it faces the chamber after REVERSE).
  const deaths = pl.g.deaths;
  pl.choose(
    [0, 0.05, 0.1, 0.15, 0.2, 0.3, 0.4].map((wait) => (f) => {
      f.wait(wait).dash();
      f.until((p) => p.p.dashTime <= 0, f.dir, 60, "knock");
      f.to(tx(100)).land();
    }),
    (f) => f.guard("landing").state === "stunned" && f.g.deaths === deaths,
    "landing knock",
  );
  // The crossing back: jump, dash, the orb, dash; then either a bounce off the
  // escape-only island card (its stomp refills the dash) or a landing on the
  // island; either way jump/dash up to the ledge.
  pl.to(tx(85) + 8).jump().apex().dash();
  pl.choose(
    [120, 160, 200, 240, 280, 320, 80, 360].map((vy) => (f) => {
      f.until((p) => p.p.dashCharge > 0 && p.p.dashTime <= 0 && p.p.vy > vy, f.dir, 120, "orb").dash();
      f.until((p) => p.p.dashTime <= 0, f.dir, 60, "dash");
      const stomps = f.g.stomps + f.g.knockouts;
      f.until((p) => p.p.grounded || p.g.stomps + p.g.knockouts > stomps || p.g.phase !== "playing", (p) => (p.cx > tx(66) ? { left: true } : {}), 240, "island");
      f.settle();
      if (!f.p.grounded) f.apex().dash();
      else f.left().jump().apex().dash();
      f.until((p) => p.p.dashTime <= 0, f.dir, 60, "dash").landAt(tx(50));
    }),
    (f) => f.g.deaths === deaths && Math.abs(f.feet - tx(12)) < 1 && f.g.phase === "playing",
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
