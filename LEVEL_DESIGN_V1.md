# Levels v1: playable on top of the combat (levels round, 2026-11-10)

Written by the level-design squad. `LEVEL_DESIGN.md` says what each level is (as built);
this file says what this round changed, why, the targets it was held to and what it
measured. Combat rules are `RESEARCH_COMBAT.md`; the proxies are `tests/human-proxy.mjs`.

**The brief (owner, translated, earlier today):** the first level was impassable and every
enemy interaction was bad. The combat rebuild landed; the levels now have to be genuinely
playable and fun for a person on top of it, not just route-possible for a bot. Standing
taste: Celeste-crisp movement (untouched), the head stomp and the dash are loved, no
sleeping enemies, no stacking enemies, every guard has a job, precise hitboxes, simple
games with conceptual integrity.

## Targets (set before building; 12 seeded proxy runs per level and persona)

| Level | First-timer clears | Casual clears | Expert clears | Damage | Fairness floors |
| --- | --- | --- | --- | --- | --- |
| each of 1-1..1-6 | >= 8 of 12 within the proxy's budget | >= 10 of 12 | 12 of 12 | an expert still loses a heart sometimes in 1-4..1-6; 1-1 and 1-2 may be near zero | unchanged: first sight to first hit >= 1.5 s, windup >= 0.4 s, checkpoints refill hearts and sit in no cone, every route takes 0 hearts |

Also required: difficulty rises 1-1 to 1-6 (teach, test, twist); early failures are dry and
cheap (before any water); no guard where the player has no room to react; each level uses
the new combat in a way the player can see and choose (a fight, a stomp that is the clever
move, a place where avoiding is the clever move); the original art is used where it fits
(`art-manifest.json` and README record what is on screen).

## What the proxies are, and what was fixed in them first

The proxies model execution (timing noise, reaction, habits), not discovery. Tracing why
1-2's casual and expert "could not clear" showed the proxy, not the level, was wrong in
four ways; each was fixed with a reason and the numbers below use the fixed proxy for the
before as well as the after (the old-proxy "before" numbers are kept in the table too):

1. A flattened `pad` card was treated as gone, so a bounce at a wall happened once at most.
2. An air jump counted as good if it landed 16 px further on, so a bounce plus an air jump
   at a 7-tile wall used the earliest window (the wall's foot). It now has to land where
   walking on is safe.
3. The first-timer's mash press came a fixed delay after the takeoff; it now draws
   0.1-0.55 s per airtime, so the apex is hit now and then.
4. The casual and expert stood still in front of a chasing walker; they now pick a jump
   that lands on its head.
5. The stuck logic no longer walks him back at the vault after the theft (Chrome driver).

These made the proxies stronger. One discovery rule is deliberately weak: a first-timer
thinks of a card as a way over a wall only if it stands within 2.5 tiles of where he is
stuck and he has bounced on a card before. That reproduces what a person did on the old
1-2 (he hopped at the wall for minutes with the flat pad 3-5 tiles behind him) and it is
a tuned number, not a measurement. With it the old 1-2 still clears for most first-timer
seeds: the proxy does not reproduce the person's failure, so 1-2 was redesigned for the
reason the person had, not for the proxy's score.


## Per level: the idea, the beats, the combat role, what changed and why

Combat roles use the words of `RESEARCH_COMBAT.md`: a fight the player can see and choose, a
place where the stomp is the clever move, a place where avoiding is.

### 1-1 Home Cliff (verify only)

One idea: jump, then jump twice. No cards at all: it is the body only; the combat's only link is
the water (a heart and a hop back, the puddle and the stump make the first one cheap). Not changed
this round (the rescue round rebuilt its water). Proxies: 12/12/12, 0 deaths, 0 hearts, 17.8 / 14.4 /
12.3 s. Real keys (Chrome driver, first-timer): cleared in 17.7 s through the title, comic and level card.

### 1-2 Stomping Ground: the head stomp

- **Teach (sentinel on its post).** The first card of the game cannot chase: the first strike is a
  read (a 0.65 s windup with the strike strip on the floor, a jab 100 px ahead), and the head is the
  answer. A fight the player can see; walking past it is allowed and costs a heart at worst.
- **Test (the wall duel).** A walker patrols a dry dip up to a 7-tile wall's foot. The card he has to
  stomp is the card standing at the thing it opens, and it chases: pinned against the wall, jumping
  over it is the instinct, the landing is the stomp (the clever move), and the air jump at the peak
  tops the wall. The flat pad stays at the foot; a hop beside it bounces again.
- **Twist (the island chain).** Four sentinels over the first water: bounce from back to back (the
  Chain stamp). A checkpoint on the wall's top.
- **Conclude.** The green card, unchanged.
- **Why it changed.** The old pit was jumped clean over by a skilled player (its card did nothing for
  him) and the pad card that opened the 7-tile wall was left 8 tiles behind it: a person hopped at the
  wall for minutes (owner, real keys). The proxies did not reproduce that failure (see above), so the
  rebuild follows the person's reason, not the proxy's score.
- **Rejected:** a second 7-tile wall as the twist (levels-wip: the same idea twice; the island chain is
  the more fun second beat); a drained pad that is solid or springs automatically (a model change for a
  placement problem); explaining the pad with text (the "behind" bubble stays, shown by the first hit).

### 1-3 Hide in Green (no level change)

One idea: green cards cannot see green. The combat role is avoiding: a card's "!" is "caught!" (no
heart); bodies still cost a heart. With the fixed proxy the first-timer clears like the others; the
proxy, not the level, was stopping it (it considered only plain jumps because the swap to white came on
the jump's own tick, then mashed at the learned rhythm under a watcher). No level edit was needed.

### 1-4 Storm Dash: the dash and the refill

- **Teach:** the swirl is on the path (walking into it is the GET); Gap A with a recovery rock.
- **Test:** the 12- and 14-tile gaps, each now with a 4-tile recovery rock 2 down at the far side (a late
  dash lands on dry rock; a hop gets back up).
- **Twist:** the 20-tile orb gap (a second orb where the second dash ends, a 3-tile rock at the bank's
  foot out of one dash's reach so the orb is still needed), and the pillar gap whose lookout's stomp is a
  refill. **Conclude:** the 27-tile gap with the turning chain card.
- **Combat role:** stomping is the clever move over water (the pillar and chain cards are springboards
  that refill the dash); the cards' bodies still cost a heart.
- **Why:** DASH GET was a swirl resting on a 1-tile stump a runner could hop clean over (the proxies did,
  then met a 20-tile gap with no dash: 4/12 and 6/12 clears); failures were expensive.

### 1-5 Lookouts (no level change)

The awareness ladder and the spear. A fight to choose (stomp the teaching walker in its recovery, the
charger needs two stomps or a red dash), and avoiding (wait for a watcher's back, go green past a red
sentry's colour): both are clever somewhere. 12/12/12 with the fixed proxy; not edited.

### 1-6 The Vault

- **Develop:** the ledge runs 5 tiles further (cols 54-58) and its water is 5 tiles, not 10: a plain
  jump crosses it in both directions (7 tiles was tried first: coming home from the island a plain jump
  is only 33 px up after 224 px, under the ledge's 64, so red needed the dash and the expert proxy fell
  there again and again). The red sentry that shared the ledge with the green lookout is gone: two cards two tiles
  apart was the stacking the owner dislikes, and a real-key casual run stood between them taking 26 hits
  (`chrome-final/1-6-casual-stuck2.png`). The ledge is one card, the lookout (wait for its back, white up,
  green in the air). The 16-tile orb crossing gets a 3-tile stepping rock under the orb (a plain jump
  reaches it from either bank).
- **Escape:** the island card is gone (a 4-tile island with water on both sides: every hit knocked Rubik
  into the water, a heart for the hit and another for the fall). One card per beat: alarm card,
  ledge lookout, corridor patrol.
- **Model (one condition):** the REVERSE no longer brings defeated cards back (a card stomped on the way
  in was alive again on the way home). The vault guard keeps its old rule (it greys out into its pad
  whether or not it was stomped; the root QA's vault-room scenario relies on that pad).
- **Combat role:** the vault guard (stomp it from behind while it looks at the vault), the red dash
  as the second weapon on the way home (knock the lookout and the alarm card), and avoiding (green past
  the corridor patrol).

## Measured (12 seeded proxy runs per level and persona; first-timer / casual / expert)

Three columns of clears: the combat squad's table (the proxies as they were), the same main-branch levels
under the fixed proxies, and this branch under the fixed proxies. Raw output:
`common/artifacts/revision-5/crh-levels/proxy/{before,after}-*.txt` and `.json` (and `old/`, an earlier
partial pass that mixed proxy versions: not used).

| Level | Clears, old proxies, main | Clears, fixed proxies, main (before) | Clears, fixed proxies, this branch (after) | Deaths med / hearts lost med, after | Time med, after (s) |
| --- | --- | --- | --- | --- | --- |
| 1-1 | 12 / 12 / 12 | 12 / 12 / 12 | 12 / 12 / 12 | 0, 0 / 0, 0 / 0, 0 | 17.8 / 14.4 / 12.3 |
| 1-2 | 10 / 1 / 4 | 11 / 12 / 12 | 12 / 11 / 12 | 0, 0 / 0, 3 / 0, 0 | 14.4 / 33.3 / 14.3 |
| 1-3 | 7 / 12 / 12 | 12 / 12 / 12 | 12 / 12 / 12 | 0, 0 / 0, 0 / 0, 0 | 31.9 / 26.9 / 26.7 |
| 1-4 | 8 / 7 / 8 | 8 / 4 / 6 | 12 / 12 / 12 | 2, 7 / 0, 3 / 1, 3 | 34.4 / 25.1 / 22.3 |
| 1-5 | 11 / 11 / 12 | 12 / 12 / 12 | 12 / 12 / 12 | 0, 1 / 0, 1 / 0, 1 | 17.9 / 20.2 / 16.0 |
| 1-6 | 1 / 0 / 5 | 1 / 0 / 0 | 12 / 12 / 12 | 0, 3 / 0, 3 / 0, 3 | 30.0 / 37.2 / 25.7 |

Reading it honestly:

- **Targets met** (first-timer >= 8, casual >= 10, expert 12 of 12, an expert still loses hearts in
  1-4..1-6): all six levels, on every column. Experts still lose a heart at 1-4 (median 3), 1-5 (1) and
  1-6 (3). Hearts are still many at 1-4 (first-timer median 7, p90 17: water) and 1-6 (casual p90 9).
  Nothing here says the finale is fun, only that the proxies get home.
- **Most of the movement between the first two columns is the proxies, not the levels.** 1-3 and 1-5 did not
  change (1-3: 7 to 12, 1-5: 11 to 12) and 1-2's casual and expert went 1 and 4 to 12 and 12 on the OLD
  level. That is the point of fixing them first: with the old numbers the levels looked broken where the
  proxies were.
- **Level changes with a measurable effect:** 1-4 (8 / 4 / 6 to 12 / 12 / 12: the swirl on the path was
  the biggest, since the proxies never took the dash and then died at the first real gap 100+ times; the
  rocks and the second orb cut falls) and 1-6 (1 / 0 / 0 to 11 / 12 / 12). In 1-6, in the order tried: a
  stepping rock under the orb (1 to 3 of 12 for the first-timer), a longer ledge with a 7-tile water
  (3 to 6), the card stomped on the way in staying down through the theft (6 to 9), the escape island's
  card removed (9 to 10, casual 7 to 12, expert 6 to 11), the ledge's red sentry removed (first-timer 10 to 12;
  casual 12 to 11 and expert 11 to 10, which is seed noise), and a 5-tile water instead of 7 (expert 10
  to 12, casual 11 to 12, first-timer 12 to 11: home from the island a plain jump falls short of the
  ledge at 7 tiles), and the vault guard still greying out into its pad when it was stomped inbound
  (as before; the card-stays-down rule had skipped it): first-timer 11 to 12, hearts p90 22 to 5. Each step was measured on the 12 seeds, not only the last.
- **1-2 did not move on the proxies** (11 / 12 / 12 before, 12 / 11 / 12 after). Its rebuild is for the
  reason the owner's real-key play found (a flat pad 8 tiles from the wall nothing explained); the proxies
  never reproduced that failure. The one stuck casual run (col 48, the wall's foot) is a loop: after the
  stomp the casual stays over the pad's 76 px head and bounces on it every landing, never touching ground.
  A person who keeps still after the bounce would do the same; a person who holds right would not.
- **Unrealistic on purpose or by limit:** the proxies do not read text, do not retreat, do not give up and
  retry (R), and fight only with a stomp reflex against a chasing walker; "hearts lost" is what a
  non-fighter pays. A first-timer's 10 to 13 hearts at 1-6 is mostly water.

### Real keys in Chrome (`tests/human-proxy-chrome.mjs`, headless Chrome 960x540 at DPR 1, final levels)

The proxy brain runs in the page; its wishes are trusted keyboard events (Playwright/CDP). 1-1 goes through
the real title, comic and level card (play live 452 ms after the card with no key). Screenshots and the raw
results: `common/artifacts/revision-5/crh-levels/chrome-final/` (`results.json`, `summary.txt`, PNGs).

| Run | Result | Game s | Deaths | Hearts lost (hits / falls) |
| --- | --- | --- | --- | --- |
| first-timer seed 1: 1-1 / 1-2 / 1-3 / 1-4 / 1-5 / 1-6 | all cleared | 17.7 / 13.8 / 27.6 / 19.9 / 16.7 / 27.0 | 0 / 0 / 0 / 0 / 0 / 0 | 0 / 0 / 0 / 2 (0/2) / 1 (1/0) / 1 (1/0) |
| first-timer seed 2: 1-4 / 1-6 | both cleared | 29.6 / 71.0 | 1 / 3 | 7 (0/7) / 11 (4/7) |
| casual seed 1: 1-2 / 1-4 / 1-6 | all cleared | 31.1 / 17.2 / 26.0 | 0 / 0 / 0 | 0 / 0 / 2 |
| expert seed 1: 1-2 / 1-4 / 1-6 | all cleared | 23.3 / 19.7 / 27.7 | 0 / 0 / 0 | 1 / 2 / 3 |

16 of 16 runs cleared, 0 console or page errors, 0 failed requests. The sanity session (Esc/Esc, Esc then
a click on Resume, R, each with a direction and jump key held) passed: the clock froze for 600 ms, the game
resumed, the held direction moved Rubik (+265, +58 px in 0.8 s), R respawned without counting a death.
Every checked respawn and water hop-back moved Rubik after a held key (a key pressed against a wall is not
counted as a freeze). Latency: wish to key event p50 about 1 ms (p95 2-3 ms), jump press to the game's
latch p50 17-19 ms (one 60 Hz frame).

Two earlier Chrome findings, for the record: the first driver run reported "frozen" respawns and a failed
resume check; both were the harness (a hop-back that lands at a wall's foot, a pause taken while Rubik
stood at 1-1's 4-tile wall), now handled in the driver. No real-key bug in the game was found: no held key
stuck after a death, a hop-back, a pause or a retry.

What a naive human still struggles with in the real-key runs: the first-timer's second seed at 1-6 took
three deaths and 71 s (water at the orb crossing, then the corridor patrol in the escape), and at 1-4 the
first-timer still pays 7 hearts to water on a bad seed. Seeds are not rates: one seed per level is a smoke
test, and Chrome runs are real time so even the same seed differs between runs.
