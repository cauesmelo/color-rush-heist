# Color Rush Heist: combat design brief (revision five, combat squad)

Written 2026-11-10 by the combat squad (designer, gameplay programmer, animator, playtester).
It records what was wrong, what the great games do about it (with sources), the decisions with
their numbers, and what was measured. What is built is in `README.md` ("Combat") and
`LEVEL_DESIGN.md`; the rules are pinned by `tests/combat.test.mjs`.

**The brief we were given (owner, translated):** the game is unplayable as it stands; the
proposal and the player's movement are fine; every enemy interaction is sad: the enemy's attack,
the damage it deals (none), its movement, how you stomp its head. Review all of it.

## 1. Diagnosis: what we saw playing it first

Played 1-2 and 1-5 in Chrome with real keys as a first-timer would (hold right, jump at obstacles).
Screenshots and traces are in the squad's scratch folder; the facts:

1. **1-2, the pit.** The first enemy of the game drops Rubik into a dry pit with a card that turns
   "!" and then does *nothing*: it stood pinned at its patrol bound, staring, for the 6 s we
   watched (the spear-less rule: no attack existed before 1-5). Rubik stood a body-width away.
   The only way out was a stomp, and the card faced him, so the stomp was refused (a "raised
   spear"). The level's first lesson was unsolvable by instinct, and the enemy was furniture.
2. **1-5, the first spear.** The same first-timer walked into the first lookout, saw "?" then "!",
   and died to one spear thrust: instant, no hearts, back to the checkpoint. So the whole game
   split into two states: enemies that did nothing (1-1 to 1-4) and one that killed on contact
   with a thrust (1-5 on). Nothing in between to learn from.
3. **Stomp.** A stomp stunned a card for 3 s. It then got up. Nobody knew when. The head only
   counted from above or behind; landing at a face, or on an aware card, was a "pop" off a spear
   (150 px/s, no damage, no gain), so the best verb in the game worked about half the time and
   failed silently the other half.
4. **Body contact** only knocked Rubik back: no cost, so touching a card was free.
5. **Movement of enemies:** patrol until a cone sees you, then walk straight at you at 240 px/s,
   or pin at the bound forever. One behaviour for every card.
6. Cones, the colour disguise, the awareness bubbles, the art and the movement were good, and are
   untouched. The owner loves the stomp and the dash; those stay.

## 2. What great games do (sources) and what we took

Only items marked verified were checked against the cited page on 2026-11-10; the rest is design
judgement and says so.

- **Super Mario Bros. / World: the stomp is the reward verb and it chains.** Consecutive stomps in
  one jump score 100, 200, 400, 500, 800, 1000, 2000, 4000, 5000, 8000, then a 1-Up; a shell kick
  chain climbs the same way. SMW's chain pays a 1-Up on the 8th. Verified:
  https://www.mariowiki.com/Point and https://www.mariowiki.com/Score. A Koopa stomped retreats
  into a shell you can kick into other enemies (verified:
  https://themushroomkingdom.net/smb_breakdown.shtml). *Taken:* a chain counter that resets on
  the ground, escalating bounce and pitch, and a payoff (a heart on the 3rd link, since this game's
  levels are short; SMW's 8 would never happen). The shell became the **armoured card**: one stomp
  flips it, a second (or a red dash) finishes it.
- **Super Mario 3D Land: make the stomp easy to hit.** The team put the player's shadow on enemies
  so stomping is easy and fudged realistic movement toward stompability (Iwata Asks, vol. 1 and 2:
  https://www.nintendo.com/en-gb/Iwata-Asks/Iwata-Asks-SUPER-MARIO-3D-LAND/Vol-2-The-producers/4-What-Is-Stomping-/4-What-Is-Stomping-215798.html).
  *Taken:* a deliberately generous window: 34 px of depth below the head top, a head 76 px wide
  (the body is 48), from the front, behind or above, while falling.
- **Shovel Knight / Hollow Knight: down-strike pogo and enemies as terrain.** Shovel Knight's
  Shovel Drop bounces off enemies and cannot be cancelled early (verified, Game Informer interview:
  https://gameinformer.com/b/features/archive/2014/07/29/shovel-knight-devs-discuss-co-op-pogo-jumping-and-beyond.aspx).
  Hollow Knight benches refill all health (https://hollowknight.wiki/w/Bench_(Hollow_Knight), search
  snippet only) and a parry gives 0.25 s of invulnerability
  (https://hollowknight.wiki.fextralife.com/Combat). **Unverified and not relied on:** Hollow
  Knight's base post-hit invulnerability seconds and hit-stop numbers; Shovel Knight's flicker
  duration. *Taken:* the bounce is the stomp (controllable by holding jump), health refills at
  rest points, and the post-hit blink length (1.5 s) is our own decision.
- **Celeste and Super Meat Boy: freeze-frames and cheap failure.** Celeste's own `Player.cs` freezes
  the world for 0.05 s on a dash start and 0.1 s on an explosion launch (verified:
  https://github.com/NoelFB/Celeste/blob/master/Source/Player/Player.cs). Super Meat Boy cut lives
  and respawn time and kept levels short (verified, Team Meat postmortem:
  https://www.gamedeveloper.com/audio/postmortem-team-meat-s-i-super-meat-boy-i-). *Taken:* hit-stop
  on every impact (stomp 0.08 s + chain, hurt 0.12 s, knock 0.12 s), and a failure that costs
  seconds, not minutes: water takes one heart and hops Rubik back to the last safe ground.
- **Vlambeer / Jonasson and Purho: juice.** Secondary summaries name screenshake, brief pauses on
  hit, recoil, particles, bigger and bassier sound, squash and stretch
  (https://rpgplayground.com/research-making-a-juicy-game/; the talks:
  https://gdcvault.com/play/1016487/Juice-It-or-Lose). *Taken:* every stomp, hit, defeat and knock
  has a pause, a shake scaled by the chain, particles in the card's own colour and a sound.
- **Mark of the Ninja and Metal Gear: readable detection, then a combat state.** Mark of the Ninja
  gives guards three clear awareness levels, each with an evident cause, and checkpoints between
  nearly every encounter (https://gamedeveloper.com/design/-i-mark-of-the-ninja-i-s-five-stealth-design-rules);
  a guard that loses you searches, gives up and returns to its post
  (https://critpoints.net/2015/03/30/stealth-game-spotting-deconstruction/). MGS1 runs
  alert, then an evasion countdown, then back to infiltration
  (https://en.wikipedia.org/wiki/Metal_Gear_Solid_(1998_video_game)); the "Caution" phase came in
  MGS2. **Unverified:** MGS timer values. *Taken:* the cones and the colour disguise stay the
  stealth layer; "?" now makes the card *stop and turn to face you*; "!" is a beat, then a chase;
  losing you ends in a 1.2 s look-around ("search") and a return to its patrol, never a stare
  forever. Combat is what happens when stealth fails or is chosen.
- **Telegraph timing.** Simple visual reaction time is about 190 ms for young adults
  (https://en.wikipedia.org/wiki/Mental_chronometry). Celia Wagar: enemy attacks should have 20+
  startup frames at 60 fps (about 333 ms), and 16 is acceptable only with a learnable setup
  (https://critpoints.net/2017/09/22/which-should-be-faster-players-or-enemies). Jerry Zhang on
  Dark Souls 3: attack signal plus attack phase of at least 340 ms, hitbox active only 2 to 4 frames,
  an end pose of at least 240 ms as bait (https://www.gamedeveloper.com/game-platforms/anatomy-of-an-enemy-attack-in-dark-souls-3).
  *Taken:* windups of 0.55 to 0.8 s (the owner asked for at least 0.4 s; first-timers are slower
  than the sources' assumed player), a hit window of 0.16 to 0.2 s (the strike), and a 0.9 to 1.1 s
  recovery as the bait.
- **GMTK / Mark Brown.** Verified: "Super Mario 3D World's 4 Step Level Design" (introduction,
  development, twist, conclusion; https://youtu.be/dBmIkEvEBtA), already the structure of every
  level here, and "How Cuphead's Bosses (Try to) Kill You" (patterns, phases, telegraphing; the
  takeaway that attacks make the player move is a transcript summary). **Not found, so not cited:**
  "How Mario Teaches" and any "What Makes a Good Enemy" episode. *Taken:* each enemy type is a
  different spatial problem (a walker you can bait and dodge, a sentinel that owns a zone, a charger
  you step aside from), not three skins of one rule.

## 3. Damage model (decisions and numbers)

| Rule | Decision | Why |
| --- | --- | --- |
| Health | **3 hearts**, drawn under the form cards from level 1 | Few enough that each one is felt; the pixel hearts differ by fill and by shape (a full heart and a cracked dark one), so they are not hue-only |
| What costs a heart | **Exactly one heart each:** a spear strike, a card's body, a fall into water | One number to learn. "What hurt me" is always one of three drawn things |
| Hit reaction | 0.12 s freeze, knockback away from the source (300 px/s bump, 380 px/s spear), a 280 px/s hop, 0.2 s without steering, a hit pose, white flash, edge flash and shake (not under reduced motion), a heart that cracks and falls | Mario/Celeste-style impact: the hit is a moment, not a number |
| Invulnerability | **1.5 s of blinking** (steady 0.65 alpha under reduced motion). Solid but unhurt: Rubik cannot walk through a gate card by getting hit on purpose. Water ignores it | Long enough to leave the fight and be hit once per chase; the freeze does not run it down |
| Water | **−1 heart and a hop back to the last safe ground** (0.45 s, the cards hold still for 0.75 s, a blinking Rubik). Safe ground is ground he stood on 14 px or more inside both edges, with no live card within 130 px | Water used to be an instant checkpoint reset. A failed jump now costs seconds, not a walk; the third fall is a real death. 1-1's puddle and stump stay cheap |
| Zero hearts | A **death**: the checkpoint snapshot restores the world as it always did, Rubik returns with full hearts, defeated cards are back | Checkpoint progress and its ≤ 12 s gaps are preserved |
| Refill | **A new checkpoint refills every heart** (the chalk face is a rest), a death refills, and **a stomp chain of 3 pays one heart** | Rest points are the refill (Hollow Knight benches); the chain is the skilled player's shortcut (Super Mario World's chain payoff) |
| 1-3 | Unchanged: a card's "!" sends Rubik back ("caught!"), no heart | 1-3 is the stealth lesson; the "!" is its consequence. Its cards' bodies still cost a heart |
| Stamps | Ghost (never spotted) and Takedown (every card defeated) and Quick work as before; **Chain** is new (best chain ≥ `chainPar`, only 1-2 sets it: 4) | One more thing to chase, on the one level whose layout chains |

## 4. Enemy types, attacks and behaviour

One state machine, three tables (`model.mjs` `ENEMY`): **calm** (patrol or turn) → **suspect "?"** (the
card stops and turns to face Rubik) → **alert "!"** (a 0.45 s beat, then it moves) → **windup** (committed:
it cannot move or turn) → **strike** (the only moment the spear hurts) → **recover** (open) → **search**
(1.2 s looking around) → **calm**. A card that cannot reach Rubik (pinned at its bound, nailed to its
post, he is on another floor) gives up after 1 s instead of staring: the 1-2 pit bug, and the level
lead's request.

| Type | Who | Moves | Tell (windup) | Hit shape | Recovery (the opening) | Stomp |
| --- | --- | --- | --- | --- | --- | --- |
| **Walker** | green patrols (and any mobile green sentry) | patrols 100 px/s; chases at 190 px/s inside its patrol bounds (Rubik runs at 330) | **0.55 s**: "!!" bubble, shake, lean, the strike strip drawn on the floor | the drawn spear within 2 px: tip 102 px from its centre, band 50-68 px up; steps 72 px forward in 0.2 s | 0.9 s, then a 0.3 s beat before it can attack again | defeated (a poof) |
| **Sentinel** | cards nailed to a post (min = max), and any card with `type: "sentinel"` | never leaves its post; turns on its timers | **0.65 s**, the slowest and clearest tell because it guards a zone | the same spear, in place (reach 100 px from its centre) | 1.0 s | defeated |
| **Charger** | red mobile cards (1-5's enforcer) | walks 120 px/s | **0.8 s**: dust at its feet, the strike strip | rushes 288 px in 0.6 s, spear out (red: tip 98 px, band 46-64 px) | 1.1 s; **if the rush ends on its bound it is dazed 1.6 s** | **armoured**: the first stomp flips it for a 2.0 s shrinking ring; a second stomp or a red dash defeats it; neither and it gets up angry |

- **No bluffing, no off-screen strikes.** A card never starts a windup it could not finish with a hit
  (the strip is exactly the swept zone), and the largest reach from a windup start is 260 + 288 + 102 =
  650 px, inside the 960 px viewport (tested). From first sight to the first possible hit, a Rubik who
  ignores the card has at least **1.5 s** for every type (tested: walker 1.6, sentinel 1.7, charger 1.9).
- **Hit shapes vs the art.** The spear is exactly the drawn spear (tip 102 px green / 98 px red from the
  card's centre, band 50-68 / 46-64 px up; the box is 2 px inside the tip), tested against the PNG alpha
  (`C2`). The card's **body box is deliberately 8 px inside each side of the 64 px drawn card** (48 px wide):
  the owner asked for bodies that hurt, and a body that hurts must forgive the last few pixels of art, so
  this is a documented exception to the 2 px rule, in the player's favour. Rubik's own box (40 x 52 in a
  56 x 60 drawing) is unchanged.
- **Baiting and dodging are the spatial problems.** A walker commits to a 72 px line: step back out of
  it, or hop it (a held jump is 93 px, the spear is 68 px) and land on its head or behind it. A charger's
  rush is a fixed line: let it run into its bound and stomp the dazed card, or jump the spear and stomp
  the open recovery. A sentinel owns the ground in front of it: wait out the tell from outside, or come
  down from above.
- **Body contact hurts** (one heart, a small bump) from the front, side or behind, except on the head.
  The recovery, a dazed card, a defeated card and a flattened pad are harmless bodies. A calm card
  walked into from behind hurts but does not notice (a bump, not an alarm).
- **Not built:** a *hopper* (a card that moves in arcs) and a *wall-pacer*. They need new movement
  rules, a vertical stomp window and new level data; the type table (`ENEMY` plus `type` in level data)
  is where they would go. No sleeping enemies; cards never stack (a test).

## 5. The stomp

- **Window:** falling (`vy > 0`), feet no deeper than **34 px** under the head's top on the previous
  tick, over a head 76 px wide (48 px body + 14 px each side; the glow card keeps its wider one).
  From the front, from behind or from above, whatever the card is doing. The spear-up pop is deleted.
  Rising into a card's side is a bump (it is a body).
- **Feel:** a 0.08 s freeze, +0.015 s per chain link (capped at +0.04 s), squash, a burst in the card's
  colour, a shake scaled by the chain, a pitched sound that climbs a pentatonic scale with the chain, an
  "xN" popup and a CHAIN meter from the 2nd link.
- **Bounce:** hold jump for the high bounce (520 px/s, 195 px over the card's floor), tap for the hop
  (400): unchanged. Each chained stomp adds 20 px/s, at most two steps (+40 px/s, about +14 px of apex),
  small on purpose: it must not open a stomp-only height the levels did not plan (the movement audit
  still has 0 FAIL).
- **Chain:** every stomp and every dash-knock before Rubik touches the ground or is hit is a link. The
  3rd pays a heart (if hurt). It resets on the ground, on a hit and on water. A springboard re-bounce is
  not a link (nothing is farmed). `chainBest` is saved per level; **Chain stamp** = best ≥ `chainPar`.
- **Defeat vs stun, never an ambiguous 3 s:** walkers and sentinels are *defeated* (the card flattens
  and bursts into paper confetti and a ring; no body, no cone). The charger is *dazed* for a visible 2.0 s
  ring that says what ends it. There is no other stun.
- **Springboard cards (`pad`):** a gate card whose bounce is the only way over (1-2's pit, islands and
  wall; 1-4's pillar and chain) is flattened grey instead of removed, and stays a springboard for good.
  Reason: a defeated gate would strand a player below a 7-tile wall after one missed bounce. It counts
  for Takedown and for the chain once. The rule is the glow card's, already in the game.
- **The dash-knock** (red dash into any card, including a dazed red one) defeats it at once with its own
  feedback (a 0.12 s freeze, a bigger burst and shake, the card spins off for 0.5 s with "KO!"), refunds
  the dash, and joins the chain. A non-red dash into a card is just a bump.

## 6. Level changes the combat required (minimal, for the level lead)

- `levels/1-2.mjs`: `pad: true` on the pit card, the four islands and the wall card; `chainPar: 4`; the
  `spears: false` flag is gone (1-2's cards attack now: the pit is the first fight).
- `levels/1-4.mjs`: `pad: true` on the pillar and the chain card; `spears: false` stays (the dash level's
  cards are springboards; their bodies still cost a heart).
- `levels/1-5.mjs`: `type: "sentinel"` on `cross-red` (a red card on the main line that must die to one
  stomp, not two).
- `levels/1-6.mjs`: the ambush card's job is now `knock` (a landing on its head is a stomp now, so the
  green swap-through is no longer the way past; the guided line knocks it with a red ground dash).
- The Quick par, the checkpoints and every route are unchanged in meaning: every baseline and mastery
  route is regenerated by the planner and takes **zero hearts** (a `choose` that costs a heart is
  rejected by the planner itself).

## 7. Tests and targets

- `tests/combat.test.mjs` (20 tests): one heart per source, the 1.5 s blink, safe-ground respawn, a
  death restoring the segment, the windup floor (0.4 s) and first-sight floor (1.5 s) for each type,
  the strike's committed line, the open recovery, the stomp window and bounce numbers, the chain's
  escalation, cap and heal, defeat vs daze vs flatten, the knock, clean routes, and 1-3's catch.
- `tests/movement-audit.test.mjs`: C2 now asserts the hit shape equals the drawn spear within 2 px; C4
  asserts the heart sources; D3 and F assert the front stomp. Movement is untouched: 0 FAIL.
- Cone-blind gate: a bot "passes clean" only if it stomped nothing and took no heart; every gate and watch
  card still stops it in at least half of 31 arrival times (`tests/cone-blind.test.mjs`).
- Human proxies (`tests/human-proxy-run.mjs`, 12 seeds per level and persona): see section 8. They do not
  fight (they still play for stealth and stomps by their own habits), so "hearts lost" is what a
  stealth-and-jump player pays; a person who fights should pay less.

## 8. Measured (actual)

Human-proxy players (`tests/human-proxy-run.mjs all 12 all`, 12 seeds per level and persona, on the
model; before = `origin/main` 31c51e1's model with the same harness, after = this branch). **Deaths**
before counted every fall into water; after they count only checkpoint restores (the last heart), so
"hearts lost" (cards + water) is the comparable damage number.

| Level | Persona | Clear before | Clear after | Deaths med/p90 before | Deaths med/p90 after | Hearts lost med/p90 after | Time med after (s) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1-1 | first-timer / casual / expert | 12 / 12 / 12 | 12 / 12 / 12 | 0/0 | 0/0 | 0/0 | 17.5 / 14.5 / 12 |
| 1-2 | first-timer | 4 | **10** | 0/3 | 0/1 | 1/4 | 14.7 |
| 1-2 | casual | 0 | 1 | 2/8 | 0/0 | 1/1 | 13.4 |
| 1-2 | expert | 0 | 4 | 0/4 | 0/0 | 1/1 | 15.2 |
| 1-3 | first-timer / casual / expert | 6 / 12 / 12 | 7 / 12 / 12 | 0/0 | 0/0 | 0/0 | 146.5 / 37.6 / 32.2 |
| 1-4 | first-timer | 0 | **8** | 30/30 | 9/21 | 30/65 | 72.6 |
| 1-4 | casual | 6 | 7 | 26/30 | 4/23 | 12/70 | 34.1 |
| 1-4 | expert | 6 | 8 | 24/30 | 1/17 | 5/54 | 21.2 |
| 1-5 | first-timer | 11 | 11 | 3/6 | **0/0** | 1/1 | 27.1 |
| 1-5 | casual | 11 | 11 | 2/6 | 0/1 | 0/4 | 20.8 |
| 1-5 | expert | 10 | **12** | 5/8 | 0/1 | 1/3 | 19.9 |
| 1-6 | first-timer | 1 | 1 | 22/28 | 10/11 | 33/35 | 71.6 |
| 1-6 | casual | 0 | 0 | 10/18 | 6/9 | 20/30 | - |
| 1-6 | expert | 2 | 5 | 16/23 | 7/9 | 22/29 | 48.7 |

Reading it honestly:
- Hearts do what they were for: 1-5 went from a median of 2-5 deaths to **0**, with 0-1 hearts lost, because
  the first strike is a heart and a lesson instead of a restart. 1-4's water gaps (the dash level) went
  from 24-30 deaths to a median of 1-9: a fall is a hop back, and the first-timer clears 8/12 instead of 0/12.
- 1-2's new clears (10 / 1 / 4 of 12) come from the pit fight and the stomp from any side; the casual and
  expert still stop at the 7-tile wall (`stuck@80`, 11 and 8 runs): that is the wall puzzle (stomp from
  behind, then an air jump at the bounce's peak), which the level lead is rebuilding, not a combat rule.
- 1-6 is still hard for the proxies (1 / 0 / 5 of 12 clear): the heart pool absorbs mistakes (median
  deaths 22/10/16 down to 10/6/7) but they stall in the vault room (`stuck@116`, 8 first-timer runs) and
  die most around the escape's island crossing (heat bin 76). The proxies do not fight: every "cards" hit
  is a stealth failure. No combat number was tuned to make them pass; the level needs its own tuning
  pass (level lead).
- The cone-blind gate holds (`tests/cone-blind.test.mjs`, 5 tests) and every scripted route takes 0 hearts.

Raw output: `common/artifacts/revision-5/crh-combat/before/proxy-before.txt` and `after/proxy-after.txt` (+ `.json`).

## 9. Open questions for the owner

- 3 hearts and a 1.5 s blink are our numbers; the research above does not give a verified standard.
  Both are one constant (`WORLD.hearts`, `WORLD.invuln`).
- Whether the hopper and wall-pacer are wanted (section 4).
- Whether a springboard card should also die once the player has crossed (it stays flat for good now).
- No human has played the new combat; the proxies and the real-key traces say it is winnable and
  readable, not that it is fun.
