# Color Theft Story: Color Rush Heist (World 1 "Green Forest")

A standalone 2D action-stealth platformer built from **Color Theft Story's original
art**. Rubik starts colorless on his home cliff. Over six short levels he learns to
jump twice, bounce on dozing Uno cards, absorb green from a glowing one, hide among
green cards, catch a storm swirl that lets him dash, and read lookouts. Then he
steals his red back from the vault and runs the same forest in REVERSE, smashing
sealed stones on the way home.

This revision answers the feedback *"develop it further with more game-design
technique, like Mario: show mechanics slowly over several levels so the player
feels progress and learning"*. It implements the approved brief
`RESEARCH_PROGRESSION.md`: World 1 as six levels, GET moments, a world map built
from the original art, level intro cards and tallies, a world clear and a local
save. **World 2 "Blue Mountains" is not built** (its plan is in the brief, §8).
`LEVEL_DESIGN.md` covers each level beat by beat.

## Run

```sh
npm run dev          # http://127.0.0.1:4174 (this folder only, loopback)
npm test             # 53 tests: 42 model/level + 11 campaign (node:test)
npm run routes       # regenerate tests/routes.mjs after a level edit
npm run build:itch   # dist/color-rush-heist-itch.zip
```

No CDN, account, backend or parent server. HTTP is needed for ES modules.

## Controls

| Action | Keyboard | Touch |
| --- | --- | --- |
| Move / choose a level on the map | ← → or A D | ◀ ▶ pads (88+ CSS px) |
| Jump (hold for height; white jumps twice) / enter a level | Space, W, ↑ (Enter on the map) | JUMP (or tap the node twice) |
| Dash (from 1-4 on; once in the air) | Shift, K, J | DASH (shown only once owned) |
| White / green / red | Z / X / C (or 1 2 3) | form cards (only owned ones) |
| Back to checkpoint | R | pause menu |
| Pause (in a level) / menu (on the map) | P, Esc, ❚❚ button | ❚❚ button |

Any key or tap starts the title and skips the comic; the key that skips also counts
as your first input. Leaving the tab pauses.

## World 1 at a glance

| Lv | Name | New idea | Twist | Kit at start | GET |
| --- | --- | --- | --- | --- | --- |
| 1-1 | Home Cliff | Jump | Double jump (4-tile wall on dry ground) | white | — |
| 1-2 | Sleeping Cards | Bounce on dozing cards | Bounce + air jump reaches 7–8-tile walls | white | GREEN, at the end |
| 1-3 | Hide in Green | Disguise | White/green trade-off | white, green (spawns green) | — |
| 1-4 | Storm Dash | Dash | Refills chain dashes (orb, card) | white, green | DASH, in the first seconds |
| 1-5 | Lookouts | The awareness ladder and the spear | A red card sees green | white, green, dash | — |
| 1-6 | The Vault | Every earlier verb, compressed | Theft → REVERSE run home | white, green, dash | RED, at the theft |

Each level is 120–154 columns with one new idea in introduce → develop → twist →
conclude order, a midpoint checkpoint just before its twist (two in 1-5 and 1-6),
three stickers (main line, off the line, mastery: 18 in total) and at most two hint
bubbles. **Kits are fixed per level, also on replays**, so sticker gates and QA routes
stay valid. The HUD shows only what is owned: no dash glyph or DASH pad before 1-4,
no red card before the theft, and no key glyph while white is the only form.

## Front end (original art, original order)

1. **Boot:** a small spinning cube face while assets load.
2. **Title:** full-frame `title_screen.png` (touch: a "Tap to start" pill). Music on
   by default, nothing requested before the first key or tap.
3. **First visit:** title → the comic (`bg1` drain, `bg_black`, the four panels in
   their `story.tscn` layout, the `cutout.png` iris) → 1-1. **Returning players:**
   title → world map, Rubik on the next level; the comic is skipped.
4. **Level intro card:** an Uno-style card ("1-3" at 64 px, the name at 32 px, the
   three sticker slots) over the opening iris for 1 s (0.5 s once cleared). The world
   is held for its first 0.4 s; any key skips it and counts as input.
5. **GET moments:** hit-stop, then a 1.2 s card: Rubik at 4× in the new color (the
   storm frames for dash), the form card and its key, one caption ("Green cards can't
   see green.", "Dash once per jump.", "Red dash smashes stones."). The card is then
   dealt into the HUD. The freeze is part of the simulation (routes include it), and
   each GET saves a checkpoint, so a death can't take an ability away.
6. **Goal face:** a 2× chalk cube face on a stick (the checkpoint language, no new
   art). Touching it flips it and fills it with Rubik's color; the iris closes on him.
7. **Level clear tally:** time and best, the three stickers flying into their slots
   (0.15 s each, with a sound; faint = owned from an earlier run), stamps where the
   level awards them ("Unseen" from 1-3 on, "Quick" on 1-6), "1-x is open!" on a
   first clear. **Continue** (default) or **Retry**.
8. **World map:** a 960×540 side view from `bg1-sky` over `bg1`, regaining 12% color
   per cleared level and full color after 1-6. A slab-cell path (atlas row 0, cells
   12–17) links six chalk-face nodes 140 px apart; 1-6 is `cofre.png` under the red
   beacon. Locked nodes are faint, open ones bob, cleared ones are filled with the color
   Rubik finished in, a 3/3 node gets a gold rim, and each shows three sticker pips and
   a red seal for stamps. After a first clear the path draws in (0.6 s) and Rubik walks
   to the new node (0.35 s per node, his 2× run row). HUD: owned forms, "n/18"
   stickers, pause and fullscreen; a bottom panel shows the level, its idea, best time
   and sticker slots. Unlocks are linear.
9. **World clear (after 1-6):** "You got your red back!", world totals (stickers n/18,
   levels, getaway), six little faces for per-level stickers, three world medals
   (Full face 18/18, Ghost = Unseen on 1-3 to 1-6, Quick getaway = 1-6 par) and one
   caption in the comic's style: "Green and red are back. Blue is up in the mountains."
   → `end_game.png` → title.

**Pause (in a level):** Resume, Back to checkpoint, Restart level, World map, Sound /
Music / Timer, Controls, Art ("Art by Vitor Farias"), Credits. **Map menu (P/Esc on
the map):** Resume, the same settings and panels, and **Reset progress** (with a
confirm panel). Pausing, the map menu, blur or a hidden tab suspend all audio.

## Save (campaign.mjs)

Key `color-rush-heist:save`, version 1: last level, comic seen, the hint budget, and
per level `clear`, `best`, `stickers`, `unseen`, `quick`, `color`. A sticker is saved
the moment it is touched and is never removed; a clear is saved at the goal; mid-level
positions are never saved. Loading sanitizes everything (unknown levels, bad sticker
numbers, non-finite times and unknown hint states are dropped). Every storage call is
wrapped in `try`: with blocked storage (private window, sandboxed iframe) progress
lasts for the visit. Settings keep their old keys.

## Mechanics (what is implemented)

Physics (`model.mjs`, 120 Hz whole ticks, px/s): run 330, acceleration 2600, braking
3300, jump 470 with half gravity near the apex while held (93 px: 2 tiles safe, 3
never), white air jump ×0.94 (+83 px, 175 px in all: 4-tile ledges), 100 ms coyote,
120 ms buffer, variable height, ≤6 px ceiling-corner correction, max fall 760.

**Measured envelope** (a 1-tick sweep of takeoff and air-jump/dash timing on the
real model, re-checked in tests): green jump crosses 11 water tiles, green jump + dash
17, white double jump **19** (an air jump saved for the fall resets the falling speed,
so the brief's estimate of 15 was low), bounce apex 195 px over a card's floor, 277
with a white air jump. So 1-4's twist gaps are **20 tiles** (white needs the dash) and
1-2's bounce-only walls and ledges are 7–8 tiles (the double jump's 175 px never
reaches them).

- **A card can't see its own color.** Green cards see white and red; red enforcers
  (the unused `inimigo3` sheet) see white and green. The sight area *is*
  `cone_de_visao.png` (per-column alpha silhouette at 2×, compared pixel for pixel in
  tests); walls cut the cone and its drawing at the same distance.
- **Awareness ladder:** in sight 0.25 s → "?"; 0.6 s → "!" (a 0.45 s beat, then a
  240 px/s charge, slower than Rubik); in range → wind-up → spear lunge (30–70 px up,
  jumpable in the open) → 0.7 s stompable recovery. Body contact only knocks Rubik
  back; only spears and water kill. **Before 1-5 there are no spears**
  (`level.spears: false`): a spotted Rubik is charged and bumped, never killed.
- **Dozing cards** (1-2's trampolines, `trampoline: true`) never wake or see and only
  bounce Rubik (a bounce, not a stun). The glowing card in 1-2 (`absorb`) holds green:
  the overhang drop from the old Stage 1 opening makes it unmissable (tested with 48
  jump and double-jump takeoffs and four slow nudges off the edge).
- **Mid-air swap** with a 0.15 s cooldown; a green jump keeps white's unspent air jump.
- **Dash charge:** 145 px gravity-free burst, one air dash; ground, stomps, bounces,
  refill orbs, smashed stones and knocked cards refill it. Before DASH GET, Shift does
  nothing at all.
- **Theft → REVERSE (1-6):** touching the vault gives hit-stop, RED GET and REVERSE:
  the chamber door slams (two `sealOnTheft` stones drop into it, so the first red smash
  is forced and safe), every card turns to face the route home, the burst cards wake
  and charge, green cards hunt faster, an escape-only card arrives on the island, the
  music speeds up ×1.12, a home arrow and the "Quick" par clock (18 s, no fail timer)
  appear. Reaching the start cliff top while carrying red ends the level and World 1.
- **Checkpoints:** whole-segment restore (cards, stones, orbs, pickups, unlocks and
  counters rewind; stickers stay; time, deaths and "spotted" are cumulative); markers
  only advance in the direction of travel; no respawn point lies inside any possible
  cone (tested over every card's patrol range in both facings). Longest gap: 9.4 s of
  baseline route time.
- **Hints:** five bubbles in all, at most two per level, each taught in one level
  only, saved in the player's hint budget: ◀▶ after 4 s idle (1-1), "jump, jump" at
  the 4-tile wall (1-1), "white card + Z" and "green card + X" (1-3), "Shift/DASH"
  after two slow landings on Gap A's rock (1-4). Three deaths at a checkpoint re-offer
  its bubble once if it was never completed.
- **Slab fix:** rising through a one-way slab used to count as standing on it for a
  tick, silently refreshing the air jump; slabs now support only a Rubik who isn't
  rising.

## Original art: on screen vs archive

All **103 images** in `assets/` are byte-identical to the original Godot project
(SHA-256 recorded in `art-manifest.json`, checked in `npm test`, and also compared with
`../refs/color-theft-story/assets/` when the workspace is present).
`art-manifest.json` records each file as `screen` or `archive` with a note; the
on-screen tile record is computed from all six maps, the map path and the vault
pillars by `tilesOnScreen()` in `levels/builder.mjs`.

- **On screen (43):** `title_screen`, `bg1`, `bg1-sky` (levels and world map),
  `bg_black`, `quadro1–4`, `cutout`, `end_game`, `intro.jpeg` (credits),
  `tiles/Tileset.png`, `rubik_white` (also the map walker), `rubik_green`, `rubik_red`
  (also 4× on GET cards), `rubik_storm` (swirl pickup, DASH GET card, refill orbs),
  `inimigo_verde`, `inimigo3-Sheet`, `cone_de_visao`, `cofre` (vault and map node), and
  23 Tile slices (1–3, 6–13, 15, 20–24, 26, 30, 35, 40, 45, 50). Tile_35 and Tile_45,
  the darkened pillar strip beside the vault, were always drawn but had been recorded
  as archive; that record is now correct.
- **Archive (60):** World 2 art (`bg2`, `bg2exp`, `tileset_ice`, `inimigo2-Sheet`),
  `rubik_blue` (blue is not playable), `rubik.png` (duplicate of white rows 0–4), 37
  unused Tile slices and the whole `player/` folder (a generic third-party pack, license
  unverified, never used by the original game).

Runtime-only effects (time-of-day tints, the grey card, the colorized forest) are
derived canvases; no asset file is modified.

## Source structure

- `levels/builder.mjs` — level builder (fill/ground/ledge/water/back) and the pure
  auto-tiler; `levels/1-1.mjs … 1-6.mjs` — one frozen data module per level;
  `levels/index.mjs` — the order.
- `model.mjs` — pure deterministic simulation of one level (`createGame(level, {hints, owned})`).
- `campaign.mjs` — pure campaign rules and the try-wrapped save.
- `game.mjs` — front end: renderer, map, cards, tallies, HUD, input, audio, `window.__game`.
- `index.html`, `style.css`, `embed.css`, `embed.js` — the plain green page and itch iframe mode.
- `gallery.html`, `gallery.mjs`, `gallery.css`, `art-manifest.json` — the art archive
  (still shipped for QA; nothing in the game links to it).
- `tests/model.test.mjs`, `tests/campaign.test.mjs` — the suites; `tests/routes.mjs` —
  generated route fixtures; `tests/route-planner.mjs`, `tests/route-scripts.mjs`,
  `tests/generate-routes.mjs` — the planner that produced them; `tests/png.mjs` — a
  tiny PNG reader for the cone check.

## QA interface (`window.__game`)

Kept: `setManual(bool)`, `restart()` (the current level straight into play: 1-1 on a
fresh page), `step(seconds, input, {render})`, `getState()`, `start()`, `skipStory()`,
`model`, `togglePause()`. DOM ids are unchanged: `#start`, `#game`, `#pause`, `#resume`,
`[data-action="jump"]`, `#continue` (level clear → map; 1-6 → world clear → ending),
the Pause → Art panel; `#again` is now labelled Retry.

New: `startLevel(id)` (any of `"1-1"…"1-6"`, straight into play, no card, the level's
own kit), `openMap(id?)`, `resetSave()`, `campaign` (the `campaign.mjs` module).

`getState()` keeps `screen` (now `boot|title|story|play|results|map|world|ending`),
`phase`, `stickers` (0–3, this run), `stickerIds`, `stickerList`, `smashes`, `stolen`,
`stomps`, `spotted`, `knockouts`, `medals` (after a win: `fullFace` = 3/3 this run,
`neverSpotted`, `quickGetaway` = 1-6 par or `null` elsewhere), `escapeTime`,
`finishTime`, `checkpoint`, `hint`, `guards`, `stones`, `events`, `camera`,
`settings`, `audio {musicDecoded, musicPlaying, musicRate, context}` and `player {x, y,
color, jumps, grounded, vy, dashTime, dashCooldown, dashCharge, …}`. New fields:
`levelId`, `level {id, name, idea, kit, gets, par, cols}`, `dashUnlocked`, `gets`,
`bounces`, `dashes`, `intro`, `getCard`, `map {cursor, id, walking, revealing,
menuOpen}`, `campaign {levels, unlocked, stickerTotal, totalStickers, worldClear,
worldMedals, forestColor}`, `save`, `result` (the last tally).

Routes (`tests/routes.mjs`): `ROUTES[levelId] = { baseline, mastery }`, plain JSON
`[seconds, input]` arrays using only `left/right/jump/jumpReleased/dash/color`; each
starts from `startLevel(id)` / `createGame(id)`. `BASELINE_ROUTE` / `MASTERY_ROUTE`
remain as aliases for 1-6's routes.

## Validation (actual results, 2026-11-09)

- `npm test`: **53/53 pass** (42 model/level, 11 campaign). They cover: the six
  levels' shape, kits (later abilities absent, also on replays) and GET order with
  their checkpoints; each level's taught mechanic as a reachability sweep on the real
  model (1-1 wall needs the double jump; 1-2's 7–8-tile targets need a bounce; 1-3's
  wall stops green; 1-4's 12/14-tile gaps stop green without the dash and its 20-tile
  gaps stop white's double jump at any air-jump timing); the 1-2 unskippable glowing
  card; no spears before 1-5; the 1-5 ladder and red-sees-green; the 1-6 theft, sealed
  door (white, green and walking red all stay inside), no fail timer and roof gate
  height; no 3-tile climb in any level; no checkpoint in any cone; the hint budget;
  sticker permanence and whole-segment restore; cone = PNG; awareness, contact, swap,
  dash, smash/knock, slab, pause and input forgiveness; every level's baseline and
  mastery route wins with zero deaths (mastery 3/3); checkpoint gaps ≤ 12 s; campaign
  unlock order, forest color, sticker union, stamps, medals, hint budget, save
  round-trip, throwing storage and sanitizing corrupt saves; 103 byte-identical images.
- Routes (QA reachability, not human times): 1-1 11.6 s / 16.1 s, 1-2 18.8 / 24.2,
  1-3 11.9 / 18.5, 1-4 14.1 / 13.6, 1-5 18.2 / 23.2, 1-6 27.8 / 33.3 (baseline /
  mastery). Baselines are never spotted; 1-5's mastery is spotted once. 1-6 baseline
  escape 11.96 s, so the Quick par is 18 s.
- `npm run build:itch`: 131 files, a 7.0 MiB ZIP (exact size and SHA-256 in
  `dist/build-report.json`).
- Real Chrome (Playwright scratch scripts outside the repo, `node serve.mjs --port
  4394` and the built `dist/itch` folder): title → comic → key skip into 1-1 with the
  card; Shift does nothing and X stays white in 1-1; a 1-1 win → goal face → tally →
  Continue → map reveal and walk to 1-2; reload → title → map on 1-2; Enter → 1-2 card;
  pause suspends audio; Art panel; GREEN, DASH and RED GET cards; REVERSE; the roof
  smash line; world clear → ending; all 12 routes win in the browser on the built
  folder; a sandboxed 960×640 iframe starts and plays; a page whose `localStorage`
  throws still plays and keeps progress for the visit; 390×844 touch portrait (deck on
  the map, no DASH pad before DASH GET, no overflow). No console errors or failed
  requests.

Not verified: physical phones, Safari/Firefox, subjective audio, first-play times and
whether players find it fun. Those need the user's playtest (RESEARCH_PROGRESSION.md
§12 lists what to watch first).
