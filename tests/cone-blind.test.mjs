/** The cone-blind rule (revision five, critic round two): every card whose
 * job is gate or watch must stop a player who ignores its cone. The bot
 * (tests/cone-blind-bot.mjs) knows the terrain and the colour rules but never
 * waits for a cone or aims a stomp. Each enforced card is probed on its own
 * (tests/cone-blind-audit.mjs `probeCard`): the baseline is replayed to just
 * before it, then the bot takes over at 31 arrival times spread over 6 s (a
 * whole turn or patrol cycle). The card must be passed "clean" (standing past
 * its patrol, never stomped or knocked, no death or catch since its zone) in
 * fewer than half of them. The full report is `node tests/cone-blind-audit.mjs`.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { LEVELS } from "../levels/index.mjs";
import { probeCard, isEnforced, ENFORCED_JOBS } from "./cone-blind-audit.mjs";

/** Cards the rule does not cover, and why (LEVEL_DESIGN.md "Cone-blind
 * audit"). A new card is enforced unless it is listed here. */
const EXEMPT = {
  "1-2 first": "teach: the stomp's first card, walking away on flat ground; going over it is fine",
  "1-3 glade": "teach: the disguise's first card, met in the open; it is supposed to hum and walk through green",
  "1-3 corridor-b": "disguise: walking through it under the canopy is the lesson",
  "1-3 roof": "off the line: guards sticker 2's roof route, which the bot never takes",
  "1-4 pillar": "refill: a springboard mid-gap; the water is the obstacle, its back the way over",
  "1-4 chain": "refill: the only way over the 27-tile gap, and it turns (spear up toward the bank)",
  "1-5 teacher": "teach: shows the whole awareness ladder in the open",
  "1-5 cross-green": "swap: the line swaps to green before landing in its view; passing disguised is the point",
  "1-6 corridor": "swap (escape): red must go green, knock it or take the roof; inbound it is 1-3's disguise",
  "1-6 alarm": "knock (escape): the forced smash's dash knocks it",
  "1-6 ambush": "swap (escape): green after the last dash, land through it",
};

test("cone-blind rule: the exempt cards are exactly the documented ones", () => {
  const exempt = [];
  for (const level of LEVELS) for (const card of level.guards) if (!isEnforced(card)) exempt.push(`${level.id} ${card.id}`);
  assert.deepEqual(exempt.sort(), Object.keys(EXEMPT).sort());
  for (const level of LEVELS)
    for (const card of level.guards) if (card.offLine) assert.ok(ENFORCED_JOBS.includes(card.job), `${level.id} ${card.id}: off-line cards still declare a real job`);
});

for (const level of LEVELS) {
  const cards = level.guards.filter(isEnforced);
  if (!cards.length) continue;
  test(`cone-blind rule ${level.id}: ${cards.map((c) => c.id).join(", ")} each stop the bot in at least half of 31 arrivals`, () => {
    for (const card of cards) {
      const r = probeCard(level.id, card.id);
      assert.equal(r.n, 31, `${level.id} ${card.id}: probed at every arrival time`);
      assert.ok(r.clean * 2 < r.n, `${level.id} ${card.id} (${card.job}): passed clean ${r.clean}/${r.n}`);
    }
  });
}
