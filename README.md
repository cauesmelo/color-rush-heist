# Color Theft Story — Color Rush Heist (Stage 1 "Green Forest")

A standalone 2D action-stealth platformer built from **Color Theft Story's original
art**. Rubik starts colorless on his home cliff, takes green from a dozing Uno card,
walks unseen among green cards, steals his red back from the vault by touching it,
and runs the same forest in REVERSE, smashing sealed stones on the way home.

This revision answers the feedback *"the beginning makes no sense; use the original
assets better"* and *"the UI is generic and lifeless"*. It implements Stage 1 of the
approved brief (`RESEARCH.md` §7–§11). **Stage 2 "Blue Mountains" was not built.**

## Run

```sh
npm run dev          # http://127.0.0.1:4174 (this folder only, loopback)
npm test             # 35 model tests (node:test)
npm run build:itch   # dist/color-rush-heist-itch.zip
```

No CDN, account, backend or parent server. HTTP is needed for ES modules.

## Controls

| Action | Keyboard | Touch |
| --- | --- | --- |
| Move | ← → or A D | ◀ ▶ pads (88+ CSS px) |
| Jump (hold for height; white jumps twice) | Space, W, ↑ | JUMP |
| Dash (once in the air) | Shift, K, J | DASH |
| White / green / red | Z / X / C (or 1 2 3) | form cards (only unlocked ones) |
| Back to checkpoint | R | pause menu |
| Pause | P, Esc, ❚❚ button | ❚❚ button |

Any key or tap starts the title and skips the comic; the key that skips also counts
as your first input. Leaving the tab pauses.

## The front end (original art, in the original order)

1. **Boot:** a small spinning cube face while assets load.
2. **Title:** full-frame `title_screen.png` (on touch screens a pill over its "press any
   key" line says "Tap to start"). Corner buttons: music and fullscreen. Music is **on by
   default** but nothing is requested before the first key or tap; the track is fetched
   once and played through Web Audio (no media element, so no request is left open to be
   cancelled by a page change). The choice is remembered.
3. **Story:** the title forest crossfades into `bg1.png` (the same composition with its
   color drained: the theft told in-world), then `bg_black.png` and the four comic
   panels pop in at their `story.tscn` positions (1.8 s cadence, "▸▸" skip). The
   `cutout.png` Rubik-face iris closes with the original shader curve
   `s = 2^(10t−10)·5` and opens on the stage. Replays skip the comic automatically
   (`localStorage`, wrapped in `try`).
4. **Stage:** "Green forest" in the original font at 64 px, input live immediately.
5. **Results:** "You got your red back!", red Rubik idling, time, getaway time, times
   spotted, the 3×3 sticker face and three medal cards that flip in. One primary
   action (**Continue**), plus Play again. (The itch build links no art archive in-game; Pause → Art shows "Art by Vitor Farias".)
6. **Ending:** full-frame `end_game.png` ("That's it by now."); any key → title.

## Mechanics (what is actually implemented)

Physics (`model.mjs`, 120 Hz whole ticks, px/s): run 330, acceleration 2600, braking
3300, jump 470 with half gravity near the apex while held (~95 px: 2 tiles safe, 3
never), white air jump ×0.94 (+83 px: 4-tile ledges), 100 ms coyote, 120 ms jump
buffer, variable height, ≤6 px ceiling-corner correction, max fall 760.

- **Colorless start → green (M1).** Only white is unlocked. A 6-tile rock overhang
  covers the last 4 tiles of the run-up and the drop (2 tiles of headroom), and the
  dozing card has a ±24 px stomp catch: every walk, run, jump, coyote jump or double
  jump off the edge lands on it (tested over 50 jump points). Walking off lands
  on the dozing card; its green swirls into Rubik at the bounce apex, the card turns
  grey and stays dazed forever (a springboard home later). That moment also saves a
  checkpoint, so green can't be lost or drained twice. Later stomps stun for 3 s.
- **A card can't see its own color.** Green cards see white and red; red enforcers
  (the unused `inimigo3` sheet) see white and green. Each card wears its color glyph.
- **Readable guards (M2).** The sight area *is* `cone_de_visao.png`: the model stores
  the PNG's per-column alpha silhouette at 2× and tests compare it pixel for pixel.
  Walls cut the cone and its drawing at the same distance. In sight 0.25 s → "?"
  (stops, cone orange); 0.6 s → "!" (charge 240 px/s, slower than Rubik); in range →
  wind-up (attack frames 0–3, 0.35 s) → spear lunge (frames 4–6, up to 4 tiles) →
  0.7 s stompable recovery; unseen for 1 s → "?" search → calm. Every "!" starts with a
  0.45 s stand-still beat before the charge. A disguised Rubik in a cone makes the card
  hum (drawn ♪); cones are bright only for cards that can see his current color, faint
  otherwise, and dozing cards show none. **Cards are solid to other colors**: you
  can't walk through a guard. A bump throws Rubik back the way he came (harder from an
  aware card); bumping an aware card again shortens its reaction (0.6 → 0.3 s) and the
  3rd bump is answered with the spear. In the corridor, ramming as white dies, green
  passes, freezing at "!" gets ~1.1 s of warning, backing off survives (tested). Only
  the spear (30–70 px up, so it can be jumped in the open) and water kill.
- **Mid-air swap (M4).** Swapping works in the air with a 0.15 s cooldown; a green jump
  keeps white's unspent air jump, a spent one never refreshes.
- **Dash charge (M5).** 145 px gravity-free burst. One air dash; the ground restores
  it (ground re-dash after 0.25 s); stomps, refill orbs (`rubik_storm` frames 1–3,
  respawn 2.5 s, only taken when empty), smashed stones and knocked cards refill it.
  The state is on Rubik: a spent charge dims him, a refill flashes him white.
- **Theft → REVERSE (M6).** Touch the vault: 250 ms hit-stop, red burst, storm into red,
  the vault door swings open, an Uno REVERSE card sweeps across, then a 2 s caption
  "Run home!" with [red card] + [Shift] (or DASH on touch) "breaks stones". The music
  speeds up ×1.12, every card turns to face the route home, the two cards behind the
  vault charge, green cards hunt (×1.6 patrol speed, suspicious after 0.15 s), and an
  **escape-only card** appears on the island between Gap A and the water. A home arrow
  sits at the left screen edge until home is in view, and the "Quick getaway" par
  (27 s) counts down under the sticker face. **No fail timer**: at zero it only greys
  out. Reaching the home cliff top with red ends the stage.
- **Red smash (M7).** Sealed stones (Tile_15 art, red cracks and red's diamond glyph)
  are inert walls until a red dash, which breaks them, keeps going and refunds the
  dash. A red dash also knocks green cards aside. Red cards ignore red Rubik.
- **Lost stickers (M8).** Nine yellow stickers (peeled corner, square: never confused
  with round orbs) fill the 3×3 face in the HUD and are permanent once taken.
  The forest regains color with Rubik: a little at green, more at the theft and on the
  way home, fully at the finish (runtime `color` compositing of the title's palette
  onto `bg1`; asset files untouched).
- **Checkpoints.** Chalk cube faces on sticks that fill with Rubik's color. Six
  (home, clearing, descent, enforcer post, stair 1, and stair 3 saved by the theft;
  a test proves none can lie in any card's cone); the longest
  gap is 8.1 s in the baseline route and 9.4 s in the mastery route (first-time
  players are slower; the test bound is 35 s). Death: the original hop, cut at 0.45 s,
  0.75 s grace. **Whole-segment restore:** cards, stones, orbs, unlocks, theft and
  stomp/smash/knockout counters rewind to the snapshot; stickers are permanent;
  time, deaths and times-spotted stay cumulative; markers only advance in the
  direction of travel. Nothing can be farmed by dying.
- **Hints.** Four teaching bubbles plus one safety net ("back": if a green card sees
  white Rubik before green is unlocked, a bubble points back at the dozing card, which
  can be stomped from the clearing floor), device-matched: ◀▶ after 4 s idle at the start;
  a thought bubble "white card + Z" after 2 s of green jumps at the 4-tile ledge;
  "green card + X" on the first "?" from a green card while white; "Shift" (or DASH)
  after two slow landings on the recovery rock. Three deaths at one checkpoint
  re-offer its bubble once. No world labels anywhere.

Cut from the old build: laser, glow orb, loot/score/chain meter, blue relics, letter
ranks, E/STEAL key, minimap, DOM status/palette bars, world labels, the in-level title
billboard and the mountain overlay.

## UI

Everything is inside the 960×540 game surface (2× the original 480×270) on the
plain `#168546` page. The surface is integer-scaled when the window allows (960×540 at
a 960×540 viewport, 1920×1080 at 2000×1200, fullscreen likewise) and only fitted below
1× when it must; the canvas always fills its box exactly (`image-rendering:
pixelated`). Pixel UI in the original `font.ttf` (monogram, CC0) at
16/32/48/64 px. Top-left: Uno-style form cards (current in front, unlocked ones fanned
behind with Z/X/C). Top-right: fullscreen and pause buttons over the 3×3 sticker face
(optional timer below). Pause is a card panel with keyboard navigation (↑ ↓, Enter,
thick yellow focus): Resume, Back to checkpoint, Restart stage, Sound / Music / Timer
toggles, Controls, Art, Credits (`intro.jpeg`). Every state change has a synthesized
sound and music (both on by default, starting with the first gesture; pausing, blur or a hidden tab suspends all audio). Reduced motion removes shake, flashes,
particles, iris animation and bobbing; state cues stay.

Touch devices always show pads during play. Landscape: small, faded pads in the
bottom corners and the camera frames Rubik higher so the floor ahead stays visible.
Portrait: the game spans the width and the rest is a control deck styled as an Uno
card table (form cards drawn as real form cards, pause and fullscreen, a rotate hint,
96 px arrows, DASH and a large JUMP). Touch shows no keyboard glyphs in the HUD.

## Original art: on screen vs archive

All **103 images** in `assets/` are byte-identical to the original Godot project (`../refs/color-theft-story/assets/` in the workspace; hashes recorded in `art-manifest.json`) (SHA-256 checked in
`npm test`). `art-manifest.json` records each file as `screen` or `archive` with a
note, and the art archive (`gallery.html`) shows all 103 with that badge.

The vault is `cofre.png` at 4× (an even multiple of the 2× grid, so its pixels stay
square and aligned) on a dais built from the slab tiles, between two pillar strips.

- **On screen (41):** `title_screen`, `bg1`, `bg1-sky`, `bg_black`, `quadro1–4`,
  `cutout`, `end_game`, `intro.jpeg` (credits), `tiles/Tileset.png`, `rubik_white`,
  `rubik_green`, `rubik_red`, `rubik_storm`, `inimigo_verde`, `inimigo3-Sheet`,
  `cone_de_visao`, `cofre`, and 21 of the 60 `Tile_NN.png` slices. The Tile files are
  pixel-identical 32×32 slices of `Tileset.png` (verified); the renderer draws 16 px
  atlas cells, and `tilesOnScreen()` in `level.mjs` computes which slices the map
  really uses (1–3, 6–13, 15, 20–24, 26, 30, 40, 50).
- **Archive (62):** Stage 2 art (`bg2`, `bg2exp`, `tileset_ice`, `inimigo2-Sheet`),
  `rubik_blue` (blue is not playable), `rubik.png` (duplicate of white rows 0–4), the
  39 unused Tile slices, and the whole `player/` folder (Pink Monster, dust and rock
  sheets: a generic third-party pack whose license is unverified and that the original
  game never used; dust and debris are drawn procedurally and from Tile_15 instead).

Sprite slicing: Rubik 32×32 cells (rows: idle, dash, run, jump, landing, storm in/out);
green cards 86×67 (attack ×10, walk ×7, idle); red cards 110×86 (attack ×9, walk ×8,
idle ×2); cone 176×47; vault 23×20; all drawn at exactly 2×, nearest-neighbor.

## Source structure

- `level.mjs` — the authored map (builder with per-beat comments, decoded from
  `level_green.tscn` and re-authored), entities, and the pure auto-tiler.
- `model.mjs` — pure deterministic simulation (no DOM).
- `game.mjs` — front end, renderer, HUD, input, audio, `window.__game`.
- `index.html`, `style.css`, `embed.css`, `embed.js` — the page and itch iframe mode.
- `gallery.html`, `gallery.mjs`, `gallery.css`, `art-manifest.json` — art archive.
- `tests/model.test.mjs`, `tests/routes.mjs`, `tests/png.mjs` — tests, routes, a tiny
  PNG reader used to compare the cone with its pixels.
- `LEVEL_DESIGN.md` — the map beat by beat; `RESEARCH.md` — the approved brief.

## QA interface (`window.__game`)

`setManual(bool)`, `restart()` (straight into play, no comic), `step(seconds, input,
{render})`, `getState()`, `start()` (title → story/play), `skipStory()`, `model`,
`togglePause()`.

`getState()` fields: `assetsReady`, `screen` (`boot|title|story|play|results|ending`),
`phase` (`ready|playing|paused|dead|won`), `time`, `deaths`, `spotted`, `stomps`,
`smashes`, `knockouts`, `stolen`, `unlocked {white,green,red}`, `stickers` (count 0–9),
`stickerIds`, `stickerList`, `medals {fullFace, neverSpotted, quickGetaway}` (after
the win), `escapeTime`, `finishTime`, `checkpoint`, `hint`, `guards`, `stones`,
`events`, `camera`, `settings`, `audio {musicDecoded, musicPlaying, musicRate}`, and
`player {x, y, w, h, vx, vy, color, direction,
grounded, jumps, dashTime, dashCooldown, dashCharge, coyote, jumpBuffer, grace, …}`.
Removed: `score`, `bestCombo`, `relicCount`, `rank`, `relics`, `pickups`, `gates`,
`laserActive`, `combo`.

Routes (`tests/routes.mjs`): `BASELINE_ROUTE` and `MASTERY_ROUTE`, plain JSON
`[seconds, input]` arrays using only `left/right/jump/dash/color`. `interact` is gone:
theft is by touching the vault. Each entry is stepped in whole 1/120 s ticks.

## Validation (actual results, 2026-11-09)

- `npm test`: **35/35 pass** (fix round: + unskippable opening over 50 jump points
  and nudges, the "back" safety net, corridor ram/green/freeze/back-off, solid bumps
  that throw Rubik back, the escape-only island card). Covers the opening (green absorbed at 4.4 s with the
  ditch-arc and bounce-apex stickers), colorless start/locked forms, the dozing card,
  absorb-once/stun/springboard, cone = PNG silhouette for both facings plus wall
  cuts, awareness timings and calming down, knockback vs spear (and jumping the spear),
  own-color blindness, mid-air swap, dash-charge refills, red knockouts, stones only
  breaking to red dashes, white unable to hop the roof gate, theft/REVERSE, no escape
  timer (120 s wait), home only after the theft, permanent stickers, whole-segment
  checkpoint restore and direction-only markers, no respawn point inside any possible
  sight cone, ≤35 s checkpoint gaps, the four
  hints, jump/geometry rules including a scan proving no 3-tile climb exists, pause,
  frame capping, coyote/buffer/variable/same-tick jumps, both routes, route format, and
  103 byte-identical images with a computed on-screen record.
- Routes: **baseline** wins in 42.0 s, 0 deaths, 0 times spotted, 3 stickers, escape
  17.5 s (it goes green to pass the island card); **mastery** wins in 48.8 s, 0 deaths,
  9/9 stickers, 4 smashes, 5 knockouts, escape 20.2 s. Longest checkpoint gap 8.1 s /
  9.4 s. "Quick getaway" par = 27 s (baseline escape × 1.5). The stair-3 wait for the
  vault guard (now turning every 2.0 s) dropped from 4.3 s to 2.6 s.
- `npm run build:itch`: 122 files, a 7.0 MiB ZIP (exact size and sha256 in `dist/build-report.json`).
- Real Chrome (Playwright, scratch scripts outside the repo) against the **built itch
  folder** on a strict nested-path host: green page centres a 960×540 game at
  1440×1050; title → story → key skips into play; held arrow moves, dash, X stays white
  before the first stomp, P pauses the clock; Space on focused Pause/Resume never jumps;
  both routes win in the browser; results → ending → title; a reload skips the comic;
  gallery decodes 103 images; 960×640 sandboxed iframe gets the same 960×540 canvas,
  Space starts play, fullscreen visible; 390×844 touch + reduced motion: tap start, tap
  JUMP, keyboard-activated JUMP, no overflow. No console errors or failed requests.
  Screenshots inspected: title, story, opening, corridor, white ledge, gaps, water,
  enforcer, vault, theft/REVERSE, roof escape, results, ending, pause, hints, cone
  states, death hop, 960×540, 1440×1050, 390×844 portrait and 844×390 landscape touch.

Not verified: physical phones, Safari/Firefox, subjective audio, and whether players
find it fun. Those need the user's playtest.
