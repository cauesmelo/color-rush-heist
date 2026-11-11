# Color Theft Story: Color Rush Heist (World 1 "Green Forest")

A standalone 2D action-stealth platformer built from **Color Theft Story's original
art**. Rubik starts colorless on his home cliff. Over six short levels he learns to
jump twice, stomp awake Uno cards from behind, steal green from a card that holds it,
hide among green cards, catch a storm swirl that lets him dash, and read lookouts.
Then he steals his red back from the vault and runs the same forest in REVERSE,
smashing sealed stones on the way home.

This build answers four rounds of feedback: *"show mechanics slowly over several
levels, like Mario"* (World 1 as six levels, `RESEARCH_PROGRESSION.md`); *"no
sleeping enemies, redo level 2; I like the head stomp and the dash"* (every card is
awake, 1-2 rebuilt around the stomp); and *"crispy, precise movement on Celeste's
principles, with room for player expression"* (the movement pass below); and *"I get
stuck in the final room; the cards exist just to exist, several on top of each other"*
(the vault room rebuild and "every card has a job", below). A playtester's fix list is
folded in. **World 2 "Blue Mountains" is not built** (its
plan is in the brief, §8). `LEVEL_DESIGN.md` covers each level beat by beat.

## Run

```sh
npm run dev          # http://127.0.0.1:4174 (this folder only, loopback)
npm test             # 179 tests: model, levels, movement audit, campaign/save, combat, held input, human proxies, release, pixel UI, credits and the ending's wiring (~20 s)
node tests/cone-blind-audit.mjs   # ~40 s: full report of what a cone-blind player gets past (LEVEL_DESIGN.md)
npm run routes       # regenerate tests/routes.mjs after a level edit
npm run build:itch   # dist/color-rush-heist-itch.zip
npm run audit:pixels -- http://127.0.0.1:4174/ --out /tmp/pixel-audit   # Chrome: every screen's pixels vs the UI palette and grid (UI_STYLE.md)
node tests/browser-ending.mjs http://127.0.0.1:4174/ [shots-dir]        # Chrome, real keys and clicks: the ending, the credits, the title's button (~90 s)
```

No CDN, account, backend or parent server. HTTP is needed for ES modules.

## Controls

| Action | Keyboard | Touch |
| --- | --- | --- |
| Move / choose a level on the map | ← → or A D | ◀ ▶ pads (88+ CSS px) |
| Jump (hold for height; white jumps twice) / enter a level | Space, W, ↑ (Enter on the map) | JUMP (or tap the node twice) |
| Dash (from 1-4 on; once in the air; jump during a ground dash to dash-jump) | Shift, K, J | DASH (shown only once owned) |
| White / green / red | Z / X / C (or 1 2 3) | form cards (only owned ones) |
| Back to checkpoint | R | pause menu |
| Pause (in a level) / menu (on the map) | P, Esc, ❚❚ button | ❚❚ button |
| The ending and the credits: next page / skip them | any key (not a held one, not Shift/Ctrl/Alt/Tab alone) or a click, after a 0.6 s lockout / Esc | tap |
| The title's Credits | Tab to the button, Enter or Space (or a click) | tap |

Any key or tap starts the title and skips the comic; the key that skips also counts
as your first input. Leaving the tab pauses.

## World 1 at a glance

| Lv | Name | New idea | Twist | Kit at start | GET |
| --- | --- | --- | --- | --- | --- |
| 1-1 | Home Cliff | Jump | Double jump (4-tile wall on dry ground) | white | — |
| 1-2 | Stomping Ground | Stomp a card's head | A walker at a 7-tile wall's foot: stomp it, air-jump at the peak; the flat card stays a springboard | white | GREEN, at the end |
| 1-3 | Hide in Green | Disguise | White/green trade-off: every white climb has a watcher; a card's "!" sends Rubik back (caught) | white, green (spawns green) | — |
| 1-4 | Storm Dash | Dash | Refills chain dashes (orb, lookout, a turning card over 27 tiles) | white, green (starts green) | DASH, in the first seconds |
| 1-5 | Lookouts | The awareness ladder and the spear | A red card sees green | white, green, dash | — |
| 1-6 | The Vault | Every earlier verb, compressed | Theft → REVERSE run home | white, green, dash | RED, at the theft |

Each level is 120–168 columns with one new idea in introduce → develop → twist →
conclude order, a midpoint checkpoint just before its twist, three stickers (main
line, off the line, mastery: 18 in total) and at most two hint bubbles. **Kits are
fixed per level, also on replays.** The HUD shows only what is owned: no dash glyph
or DASH pad before 1-4, no red card before the theft, no key glyph while white is the
only form. **Every card is awake** (patrols, sentries turning on timers, lookouts that
hold one facing); a test asserts no card is ever asleep in any route. **Every card has
a job** (gate, refill, knock, watch, swap, teach, disguise): each declares one and a
test proves it on the routes; two cards on a floor never stack (2+ tiles apart unless a
declared pair). `LEVEL_DESIGN.md` lists each card's safe and expert line.

## Front end (original art, original order)

**All of it is pixel art** (`UI_STYLE.md`): every menu, panel, button, stamp, sticker socket, bubble, bar, icon, focus frame and transition is drawn on the art's own 2x pixel grid in a 22-colour palette taken from the art files (no new shade), with square corners, hard +1,+1 shadows, dithers instead of fades and gradients, and bitmap text. `ui-draw.mjs` draws it from state, `pixel-ui.mjs` is the kit, and `npm run audit:pixels` measures the real pixels in Chrome. The world's own art and Rubik and the cards' sprite transforms are untouched.

1. **Boot:** a small spinning cube face while assets load.
2. **Title:** full-frame `title_screen.png` (touch: a "Tap to start" plate). Music on
   by default, nothing requested before the first key or tap.
3. **First visit:** title → the comic (`bg1` drain, `bg_black`, the four panels in
   their `story.tscn` layout, the `cutout.png` iris) → 1-1 (skipping the comic still
   shows the "1-1 Home Cliff" card). **Returning players:**
   title → world map, Rubik on the next level; the comic is skipped.
4. **Level intro card:** an Uno-style card ("1-3" at 64 px, the name at 32 px, the
   three sticker slots) over the opening iris for 1 s (0.5 s once cleared). The world
   is held for its first 0.4 s; any key skips it and counts as input.
5. **GET moments:** hit-stop, then a 1.2 s card: Rubik at 4× in the new color (the
   storm frames for dash), the form card and its key, one caption ("Green cards can't
   see green.", "Dash once per jump.", "Red dash smashes stones."). The card is then
   dealt into the HUD. The caption has its own band below the portrait. The freeze is
   part of the simulation (routes include it), and each GET saves a checkpoint, so a
   death can't take an ability away.
6. **Goal face:** a 2× chalk cube face on a stick (the checkpoint language, no new
   art). Touching it flips it and fills it with Rubik's color; the iris closes on him.
7. **Level clear tally:** time and best, the three stickers flying into their slots
   (0.15 s each, with a sound; faint = owned from an earlier run), stamps where the
   level awards them, stacked in one column: "Ghost" (never spotted) on the stealth
   levels 1-3, 1-5 and 1-6, "Takedown" (every card stomped or knocked, with this run's
   tally and the best saved) on 1-5 and 1-6, "Quick" on 1-6, "Chain" (a stomp chain of
   at least the level's `chainPar`, with this run's chain and the best saved) on 1-2.
   The rows also show hearts lost and the best stomp chain. "1-x is open!" on a first clear. **Continue** (default) or **Retry**; arrow
   keys move between them.
8. **World map:** a 960×540 side view from `bg1-sky` over `bg1`, regaining 12% color
   per cleared level and full color after 1-6. A slab-cell path (atlas row 0, cells
   12–17) links six chalk-face nodes 140 px apart; 1-6 is `cofre.png`. Locked nodes are faint, open ones bob, cleared ones are filled with the color
   Rubik finished in, a 3/3 node gets a gold rim, and each shows three sticker pips and
   a red seal for stamps. After a first clear the path draws in (0.6 s) and Rubik walks
   to the new node (0.35 s per node, his 2× run row). HUD: owned forms, "n/18"
   stickers, pause and fullscreen; a bottom panel shows the level, its idea, best time
   and sticker slots. Unlocks are linear.
9. **World clear (after 1-6):** "You got your red back!", world totals (stickers n/18,
   levels, getaway), six little faces for per-level stickers, three world medals
   (Full face 18/18, Ghost = the Ghost stamp on 1-3, 1-5 and 1-6, Quick getaway = 1-6 par) and one
   caption in the comic's style: "Rubik is home. Now the forest can wake up in color."
   The forest behind it is the map's: 12% of its colour per cleared level 1-1..1-5 (60%),
   so the ending has colour left to bring back. Continue starts the ending.
10. **The ending (screen `ending`, three pages, 13.4 s on its own):** the comic's voice,
    its first beat in reverse. *Rubik ran all the way home with his red.* (the dull
    forest, Rubik red, "He did it!") → *...and the colors came back, one tree at a time.*
    (after a beat a wave of colour spreads out from Rubik: a Bayer-dithered ring of the
    title picture over the dull forest, in steps of 4 art px, until the whole picture,
    logo included, is back; "Welcome home!"; "any key or click: next   Esc: skip" appears in the
    corner after 1.2 s; reduced motion cuts to the finished picture) → *Once again, Rubik
    shone with all his colors.* (the title art whole, THE END, the original game's own
    "Thanks for playing!" line cut from `end_game.png` in a frame, and white, green and
    red Rubik hopping in turn). `credits.mjs` holds the pages and the timing rules;
    `ending-draw.mjs` paints them. The title art's baked "PRESS ANY KEY TO START" line is
    lifted out once at runtime (a derived canvas; the file is untouched).
11. **The credits (screen `credits`, 26.4 s on its own):** six cards, one at a time, on one
    plum plate that covers the title art's logo, over the finished forest, with white,
    green and red Rubik walking home along the bottom (15 art px a second, stopping short
    of the title art's own credit in the corner). The words step in and out in four
    grey-to-white levels (never alpha) and small pips under the words count the cards.
    The cards (`CREDITS` in `credits.mjs`, each with its `source`): *Color Rush Heist*;
    *Color Theft Story, the original game, made by Vitor Farias and Cauê Melo
    (@cauesmelo), minigamejam 22, 2023*; *Pixel art, Vitor Farias*; *Sound: Music: the
    original game's track; Effects: made in the browser*; *Web version, 2026: built with AI
    assistance (Claude Code); font: monogram by datagoblin (CC0)*; *Thanks for playing!*
    The credits end on the title. Nothing is claimed that the workspace cannot support:
    the open questions (the track's composer, the tileset, who made what, the MIT file's
    "nklbdev") are in `ITCH_IO.md` under CREDITS_TODO.
12. **Pressing during the ending and the credits:** a page times itself out, so nobody has
    to press. A fresh key (or a primary click) moves on after the page's first 0.6 s; a
    held key never counts (auto-repeat arrives as `repeat`); Shift, Ctrl, Alt, Meta and Tab
    alone are not presses; Esc leaves for the title (credits skipped too). The title's
    **Credits** button (bottom centre, the same pixel button and focus frame as the
    menus) plays the same six cards and returns to the title with the button focused.
    The track keeps playing under the ending and the credits and stops at the title.
    After the credits a returning player goes title → world map as before, all six levels
    open and Rubik on 1-6; winning the vault again plays the ending again.

**Pause (in a level):** Resume, Back to checkpoint, Restart level, World map, Sound /
Music / Options, Controls, Art ("Art by Vitor Farias"), Credits. **Options:** Slow
spotting (the assist), Less motion and Timer. **Map menu (P/Esc on the map):** Resume,
the same settings and panels, and **Reset progress** (with a confirm panel). Pausing,
the map menu, blur or a hidden tab suspend all audio. The title shows the release as a
`v1.0` DOM label (bottom left); Credits add the jam track, the version line and the
AI-assistance disclosure.

## Accessibility (v1.0)

- **Never colour alone.** White, green and red each have a glyph: a square, a triangle
  and a diamond. Every colour mechanic wears it as a badge: a cream disc with an ink rim.
  - The cards carry it at the corner, beside their original suit numerals (green 1,
    red 3).
  - Rubik wears his current form's badge at the back of his head, from 1-2 on.
  - The red-only stones carry red's badge over their crack pattern.
  - The HUD form cards and the touch pads use the same glyphs, ink-outlined.
  - Cone states read by the "?" and "!" bubbles, and a cone that can see Rubik's colour
    is lit with a crisp edge, while one that can't is faint. None of these depends on
    hue.
  - Checked on real frames with Chrome's emulated protanopia, deuteranopia, tritanopia
    and achromatopsia. Before the badges, Rubik's forms differed by hue only, and the
    stones' bare red diamond vanished on their olive centre under protanopia and
    deuteranopia.
- **Slow spotting** (assist, off by default, saved): a card must keep Rubik in sight
  twice as long before "?" (0.5 s) and "!" (1.2 s; 0.3 s for "?" in the escape).
  - Cones, patrols, turns, the spear and every physics number are unchanged. Every
  baseline and mastery route still wins with 0 deaths (tested).
  - A run with it on at any moment clears, unlocks and keeps its stickers and best
    time, but earns no Ghost, Takedown or Quick stamp. The result card says so. Stamps
    already earned are never removed.
- **Less motion:** follows `prefers-reduced-motion` until the player picks in Options,
  which then wins. Under it there is no shake, flash, particle (including stone
  debris), squash or iris, and the map snaps. State cues stay, steady instead of
  pulsing. The root QA asserts all of this from both the system and Options.

## Save (campaign.mjs)

One versioned key, `color-rush-heist:v2:save` (version 2, since 1.0.0). It holds the
last level, comic seen, the hint budget, and per level `clear`, `best`, `stickers`,
`unseen`, `takedown`, `takedownBest`, `quick` and `color`. It also holds `settings`
(`sfx`, `music`, `timer`, `slowSpotting`, and `reduceMotion`: null follows the
system) and `migratedFrom`.

- A sticker is saved the moment it is touched and is never removed. A clear is saved at
  the goal. Mid-level positions are never saved.
- Loading sanitizes everything: unknown levels, bad sticker numbers, non-finite times,
  unknown hint states and malformed settings fall back field by field.
- **Migration:** when the v2 key is absent, the 0.x v1 save (`color-rush-heist:save`)
  and the old per-setting keys (`:sfx`, `:music`, `:timer`, and `:storySeen` from
  before World 1) are imported once and written as v2. The old keys are left in place
  for a rollback, and the v2 key's presence marks the migration done. A corrupt or
  unknown-version v2 value gives a fresh save, never a re-import.
- Every storage call is wrapped in `try`. With blocked storage (a private window, a
  sandboxed or third-party itch iframe), the game boots and plays and keeps progress for
  the visit; the release gate probes this.
- Reset progress keeps the settings.

## Movement (crisp, readable, expressive)

All numbers are in `model.mjs` `WORLD` with comments and pinned by tests (120 Hz
fixed ticks, px/s; deterministic, so routes replay identically in Node and Chrome).
`MOVEMENT_AUDIT.md` measures every item of the shared movement rubric
(`common/docs/MOVEMENT_CRITERIA.md`) before and after the audit pass; the
measurements live on as `tests/movement-audit.test.mjs`. Input events are stamped
and applied on the tick they happened in (`loop.mjs`), so every window below is the
same at 30, 60, 120 or 240 Hz and through frame hitches.

| Feel | Value | Why |
| --- | --- | --- |
| Run / start / stop | 330 px/s; 0→330 in 0.10 s; 330→0 in 0.10 s | snappy, no ice |
| Turnaround (ground) | momentum gone in 0.042 s (8000 px/s²), full speed back in 0.142 s | reversing never feels heavy |
| Air control | 79% of the ground's acceleration; reversing 4200 px/s² (0.21 s, never a flip); letting go drifts ~18 px | precision first, a little carry |
| Jump | 470 px/s → 93 px held (2 tiles safe, 3 never); a tap (release keeps 60% of vy) = 34 px, 0.35 of the hold | variable height |
| Apex hang | half gravity while jump is held and \|vy\| < 60 (+0.12 s) | a readable peak to aim from |
| Fall | 1.3× gravity past the apex band, capped at 760 px/s | an asymmetric arc: landings read firm and quick |
| White air jump | ×0.94 (+83 px, 175 px total); two small puffs under Rubik's feet while it is unspent | 4-tile ledges; the resource reads on him |
| Support | the feet (±11 px, within 2 px of the drawn legs), not the 40 px box | he never stands on the air past an edge |
| Lip rest | when only the box's edge meets a lip, ≤ 4 ticks on it: scramble on when moving toward it, otherwise slip off | no "looked landed but fell", no landing with the feet short |
| Coyote / buffer | 14 ticks (117 ms) from the feet leaving / 0.12 s; buffers age in real time through freezes (kept alive through an air dash) | no lost inputs, no stale ones |
| Corner correction | rising into a ceiling corner, or dashing into a lip's underside, by ≤ 6 px slides past it | no unfair bonks |
| Ledge assist | meeting a lip with the feet ≤ 12 px below its top steps onto it | no "visually made it but didn't"; 12 < 32 so it never creates a climb (93+12 < 128, 175+12 < 192) |
| Dash | horizontal only (left/right/facing), 850 px/s × 0.17 s = 145 px, gravity-free, one in the air, 4-tick freeze-frame | horizontal keeps the gap rules exact and readable |
| Dash-jump | jump during a ground dash keeps 560 px/s, bleeding to run speed at 900 px/s² | player expression; never required |
| Stomp | hold jump (or press it as you land: 0.12 s before, in the 0.08 s freeze or 0.05 s after) for the high bounce (195 px over the card's floor), else a hop (~150) | bounce-height variety; a freeze press never spends the air jump |
| Respawn | 0.45 s hop; a direction held since the death waits a 0.2 s landing beat, then runs (released and pressed again: at once); a jump pressed in its last 0.12 s fires; every checkpoint has 0.8 s of runway both ways | a player who keeps holding right is never ignored (it used to stay locked until released and looked frozen), no lost input |
| Pause | a direction held through a pause applies on resume; presses in the menu never reach Rubik | no lost or phantom input |
| Hitbox | Rubik 40×52 inside his 56×60 drawn art, feet on the ground line; card body 48×84 (8 px inside the drawn card); spear band = the drawn spear head (green 50–68, red 46–64 px up) | tested against the PNG alpha and the canvas |

Juice supports precision rather than hiding it: squash/stretch on jump, landing, air
jump, dash-jump and stomps, the stomped card squashed flat, dust on landings and
sharp turnarounds, dash afterimages as solid silhouettes in the form's color, a dash
refill flash and a light spent-dash shade on Rubik, freeze-frames on dash (4 ticks),
stomp (0.08 s), smash, knock and theft, and a small shake only on stomps and big
impacts. Reduced motion (the system setting, or Options → Less motion) turns off shake,
flashes, particles and squash.

**Measured envelope** (a 1-tick sweep of takeoff, air-jump and dash timing on the real
model, re-checked in tests): green jump crosses 11 water tiles, green dash-jump 13,
green jump + dash 17, white double jump **19** (an air jump saved for the fall resets
the falling speed; the brief estimated 15), white dash-jump + double jump 22. So 1-4's
orb twist gap is **20 tiles** (white needs the dash) and 1-2's stomp-only heights are
7–8 tiles (the double jump's 175 px never reaches them). The movement audit's gap lab
(bank to bank at the same height, `tests/movement-audit.test.mjs` F) gives green jump
10, green jump + dash 15, white double 17, white double + dash 20 tiles, identical
before and after the audit's tuning; every level gate test re-passes.

## Mechanics (what is implemented)

- **A card can't see its own color.** Green cards see white and red; red enforcers
  see white and green. The sight area *is* `cone_de_visao.png` (per-column alpha
  silhouette at 2×, tested pixel for pixel); walls cut the cone and its drawing at the
  same distance. Cones that can see Rubik's current color get a crisp edge.
- **Hearts and combat (revision five, `RESEARCH_COMBAT.md`):** Rubik has **3 hearts** (under the
  form cards). A spear strike, a card's body and a fall into water each cost **one**. A hit freezes
  the world for 0.12 s, knocks him back (300 px/s bump, 380 px/s spear) with a hop, and makes him blink
  for **1.5 s** (solid but unhurt; water ignores it). **Water** hops him back onto the last safe ground
  (a bank he stood 14 px inside both edges of, with no live card within 130 px) after 0.45 s, the cards
  holding still for 0.75 s; the third fall, or the last heart, is a death: the checkpoint segment is
  restored with full hearts. **A new checkpoint refills every heart**, and a stomp chain of 3 pays one.
  1-3 is unchanged: a card's "!" there is "caught!" (back to the checkpoint, no heart).
- **Three enemy types, one state machine:** calm -> "?" (the card stops and turns to face Rubik) -> "!"
  (a 0.45 s beat) -> chase -> **windup** (committed, drawn as a hatched strip on the floor: the exact
  swept zone) -> **strike** (the only moment the spear hurts; the hit shape is the drawn spear within
  2 px) -> **recover** (open: no body damage, stompable, a bobbing arrow marks the head) -> search (1.2 s)
  -> patrol. A card that cannot reach him gives up after 1 s instead of staring.
  - **Walker** (green patrols): chases at 190 px/s inside its bounds, windup 0.55 s, steps 72 px.
  - **Sentinel** (cards nailed to a post): never moves, windup 0.65 s, the same spear in place.
  - **Charger** (red mobile cards, 1-5's enforcer): windup 0.8 s, rushes 288 px in 0.6 s; a rush that
    ends on its bound dazes it for 1.6 s.
  - From first sight to the first possible hit is at least 1.5 s for every type (measured 1.6 / 1.7 / 1.9 s).
- **Stomp:** from above, behind or the **front**, while falling, with the feet within **34 px** of the
  head's top, over a head 76 px wide. No spear-up rule and no pop any more. Hold jump for the high bounce,
  tap for the hop (unchanged). A walker or sentinel is **defeated** (flattens, bursts into confetti); the
  armoured charger is **dazed** for a visible 2.0 s ring (a second stomp or a red dash defeats it); a card
  flagged `pad` (1-2's gates, 1-4's springboards) flattens grey and stays a springboard, so one missed
  bounce never strands Rubik. **Chain:** every stomp or dash-knock before touching the ground is a link:
  +20 px/s of bounce per link after the first (at most +40), a longer freeze, a higher sound, an "xN"
  popup; the 3rd pays a heart; `chainBest` is saved and 1-2's **Chain** stamp wants 4 (the island chain).
- **Dash-knock:** a red dash into any card (including a dazed red one) defeats it, refunds the dash and
  joins the chain; any other dash into a card is a bump.
- **A card can't see its own color.** Green cards see white and red; red enforcers see white and green. The
  sight area *is* `cone_de_visao.png` (per-column alpha silhouette at 2x, tested pixel for pixel); walls cut
  the cone and its drawing at the same distance. Cones that can see Rubik's current color get a crisp edge.
  A card that has shown "?" is locked on: in its cone or right before its face it sees him in any colour,
  and its body blocks him even in its own colour (no swap-and-walk-through). **Before 1-5 only 1-4 and
  1-3 are attack-free:** 1-3 sends "!" to the checkpoint, 1-4's cards are springboards (their bodies still
  cost a heart).
- **Mid-air swap** with a 0.15 s cooldown; a green jump keeps white's unspent air jump.
- **Dash charge:** one air dash; ground, stomps, refill orbs, smashed stones and
  knocked cards refill it. Before DASH GET, Shift does nothing at all.
- **Theft → REVERSE (1-6):** RED GET, the chamber door slams (two stones), every card
  turns to face the incoming Rubik, two escape-only cards arrive (the alarm card on the
  landing, staring at the door, and the island card), the music speeds up, a home
  arrow and the Quick seal appear. The room's only card is the red vault guard, which
  can't see red: the forced first smash is safe, and the same dash from the doorway
  carries into the alarm card (the first knock). While the door is sealed it pulses,
  storm streaks run into it and its upper stone carries the dash key. **Fairness:**
  once the GET card closes, every card holds still through the REVERSE card plus 0.8 s
  and Rubik is untouchable; the REVERSE card and "Run home!" take the half of the
  screen Rubik isn't in. A death after the theft respawns him inside the sealed room
  next to the door (cards held 1.25 s), so the forced first smash always happens;
  nothing in there can hurt red, so it is never a trap. Respawns elsewhere hold every
  card for 0.75 s. A card whose cone is on Rubik in its own colour hums (♪), also
  while searching after a stun.
- **Critic round (revision five):**
  - **Vault room:** taking red drains the vault's red guard. The room's one threat after the
    theft is the alarm card, which comes out at the back, turns and walks at the vault at 60%
    pace (the card outside the door is gone).
  - **Cone lock:** a card that has shown "?" keeps seeing Rubik in its cone whatever colour he
    swaps to, until he leaves the cone; its "?" and lit cone persist.
  - **1-5:** the enforcer is the gate; no perch stands over it.
  - **1-6 ledge:** a red/green pair, so no single colour passes.
- **Checkpoints:** whole-segment restore; markers only advance in the direction of
  travel; signs stand beside the respawn spot; no respawn point lies inside any
  possible cone (the theft's in-room point is covered by its own test). The longest
  gap is ≤ 12 s of baseline route time wherever Rubik can die (1-3 has no water and
  no spears, so it keeps just two).
- **Hints:** six bubbles in all, at most two per level, each taught in one level and
  saved in the player's hint budget: ◀▶ and "jump, jump" (1-1), "from behind" after
  the first spear-up (1-2, drawn: a card and an arrow onto its back), "white card + Z"
  and "green card + X" (1-3), "Shift/DASH" (1-4).

## Original art: on screen vs archive

All **103 images** in `assets/` are byte-identical to the original Godot project
(SHA-256 recorded in `art-manifest.json`, checked in `npm test`, and also compared with
`../refs/color-theft-story/assets/` when the workspace is present).
`art-manifest.json` records each file as `screen` or `archive` with a note; the
on-screen tile record is computed from all six maps, the map path and the vault
pillars by `tilesOnScreen()` in `levels/builder.mjs`.

- **On screen (43):** `title_screen`, `bg1`, `bg1-sky` (levels and world map),
  `bg_black`, `quadro1–4`, `cutout`, `end_game` (its "Thanks for playing!" line, on the last
  ending page), `intro.jpeg` (credits), `title_screen` also returns, logo and all, as the
  ending's colour wave and under the credit cards,
  `tiles/Tileset.png`, `rubik_white` (also the map walker), `rubik_green`, `rubik_red`
  (also 4× on GET cards), `rubik_storm` (swirl pickup, DASH GET card, refill orbs),
  `inimigo_verde`, `inimigo3-Sheet`, `cone_de_visao`, `cofre` (vault and map node), and
  23 Tile slices (1–3, 6–13, 15, 20–24, 26, 30, 35, 40, 45, 50). Tile_35 and Tile_45,
  the darkened pillar strip beside the vault, were always drawn but had been recorded
  as archive; that record is now correct.
- **Archive (60):** World 2 art (`bg2`, `bg2exp`, `tileset_ice`, `inimigo2-Sheet`),
  `rubik_blue` (blue is not playable), `rubik.png` (duplicate of white rows 0–4), 37
  unused Tile slices and the whole `player/` folder (a generic third-party pack, license
  unverified, never used by the original game). **The itch.io ZIP withholds
  `player/`** (`itch.json` `withhold`, studio decision for v1.0): the repository keeps
  all 103 images byte-identical, and the packaged gallery shows the 17 withheld entries
  as "not in this build" notes. Details are in `ITCH_IO.md`.

Runtime-only effects (time-of-day tints, the grey card, the colorized forest) are
derived canvases; no asset file is modified.

## Source structure

- `levels/builder.mjs` — level builder (fill/ground/ledge/water/back) and the pure
  auto-tiler; `levels/1-1.mjs … 1-6.mjs` — one frozen data module per level;
  `levels/index.mjs` — the order.
- `model.mjs` — pure deterministic simulation of one level (`createGame(level, {hints, owned})`).
- `loop.mjs` — the pure fixed-step clock: stamped input changes applied on their own tick.
- `campaign.mjs` — pure campaign rules and the try-wrapped save.
- `game.mjs` — front end: renderer, map, cards, tallies, HUD, input, audio, `window.__game`.
- `index.html`, `style.css`, `embed.css`, `embed.js` — the plain green page and itch iframe mode.
- `gallery.html`, `gallery.mjs`, `gallery.css`, `art-manifest.json` — the art archive
  (still shipped for QA; nothing in the game links to it).
- `tests/movement-audit.test.mjs` — the movement rubric, measured (`MOVEMENT_AUDIT.md`);
  `tests/browser-movement.mjs` — its real-Chrome checks (dev tool, needs Playwright).
- `credits.mjs` — the ending's pages, the credit cards (with their sources) and the pure
  reel rules (lockout, held keys, Esc, fade steps, the colour wave, the parade); no
  imports. `ending-draw.mjs` — paints them with the pixel kit. `tests/credits.test.mjs`
  (rules, data, the truth guard), `tests/ending-flow.test.mjs` (source wiring),
  `tests/browser-ending.mjs` (Chrome, real keys; not in `npm test`).
- `tests/model.test.mjs`, `tests/campaign.test.mjs` — the suites; `tests/routes.mjs` —
  generated route fixtures; `tests/route-planner.mjs`, `tests/route-scripts.mjs`,
  `tests/generate-routes.mjs` — the planner that produced them; `tests/png.mjs` — a
  tiny PNG reader for the cone check.

## QA interface (`window.__game`)

Kept: `setManual(bool)`, `restart()` (the current level straight into play: 1-1 on a
fresh page), `step(seconds, input, {render})`, `getState()`, `start()`, `skipStory()`,
`model`, `togglePause()`. DOM ids are unchanged: `#start`, `#game`, `#pause`, `#resume`,
`[data-action="jump"]`, `#continue` (level clear → map; 1-6 → world clear → ending → credits → title), `#credits-btn` (the title's Credits button),
the Pause → Art panel; `#again` is now labelled Retry.

New: `startLevel(id)` (any of `"1-1"…"1-6"`, straight into play, no card, the level's
own kit), `openMap(id?)`, `resetSave()`, `campaign` (the `campaign.mjs` module),
`showEnding()` and `showCredits(from = "title")` (QA shortcuts into the closing pages and the
credit cards; the real route is a 1-6 clear, then Continue).

`getState()` keeps `screen` (`boot|title|story|play|results|map|world|ending|credits`),
`phase`, `stickers` (0–3, this run), `stickerIds`, `stickerList`, `smashes`, `stolen`,
`stomps`, `spotted`, `knockouts`, `medals` (after a win: `fullFace` = 3/3 this run,
`neverSpotted`, `quickGetaway` = 1-6 par or `null` elsewhere), `escapeTime`,
`finishTime`, `checkpoint`, `hint`, `guards`, `stones`, `events`, `camera`,
`settings`, `motion {reduced, source}`, `effects {shake, flash, particles, squash, iris}`, `audio {musicDecoded, musicPlaying, musicRate, context}` and `player {x, y,
color, jumps, grounded, vy, dashTime, dashCooldown, dashCharge, …}`. New fields:
`levelId`, `level {id, name, idea, kit, gets, par, cols}`, `dashUnlocked`, `gets`,
`doorCue` (1-6: the sealed-door cue is drawn), `hp`, `maxHp`, `invuln`, `chain`,
`chainBest`, `hits`, `falls` (combat; each guard also carries `type` and `defeatT`),
`hud {hearts, heartFx, popups, edge}` (what the hearts row and the hit edge show),
`bounces`, `dashes`, `calm`, `intro`, `getCard`, `map {cursor, id, walking, revealing,
menuOpen}`, `reel` (null, or `{kind: "ending"|"credits", from, id, index, count, age, canPress, done}`), `campaign {levels, unlocked, stickerTotal, totalStickers, worldClear,
worldMedals, forestColor}`, `save`, `result` (the last tally), `simClock` (the
`performance.now()` moment the simulation corresponds to, for mapping a key's
`timeStamp` to its tick).

Routes (`tests/routes.mjs`): `ROUTES[levelId] = { baseline, mastery }` (plus
`takedown` on 1-5 and 1-6: every card put down), plain JSON
`[seconds, input]` arrays using only `left/right/jump/jumpReleased/dash/color`; each
starts from `startLevel(id)` / `createGame(id)`. `BASELINE_ROUTE` / `MASTERY_ROUTE`
remain as aliases for 1-6's routes.

## Validation (actual results)

**Ending and credits (ending squad), 2026-11-10/11** (head `9cd555f` plus these docs; evidence in `common/artifacts/revision-5/crh-ending/`):

- `npm test`: **179/179** (162 before; 15 new in `tests/credits.test.mjs`: the reel's auto-advance and carry-over, the 0.6 s lockout and its per-page reset, a held key (`repeat`) never counting at any age, Esc, the last page, fade steps, the wave's whole steps and corner coverage, the parade stopping short of the corner credit, the data's unique ids and text fits, **the truth guard** (required names present; other projects' names, "nklbdev", Pink Monster, craftpix and any composer claim absent; the music line exactly "Music: the original game's track"), the pause panel and the roll saying the same, CREDITS_TODO present; 2 in `tests/ending-flow.test.mjs`: the source wiring and module boundaries; `tests/pixel-ui.test.mjs` now scans `ending-draw.mjs` too).
- Chrome, real keys and clicks, `tests/browser-ending.mjs` on the source (load 20-28 beside it): **53/53**. World clear → Enter on the focused Continue → the three pages → the six cards in data order → the title; presses inside the lockout ignored (keys, Esc, clicks); a key held 1+ s past the lockout never skips (page 1 and card 1, Enter that opened the credits included); Shift and Tab alone do nothing; a right click is not a press; Esc leaves from the ending (to the title) and from the credits, with Credits focused again when opened from the title; Tab reaches the Credits button, its focus frame is the lemon pixel outline; the title's Credits (click and Enter) plays the same cards; the unattended timeline reaches the credits and then the title and takes at least its authored 39.8 s; a finished save goes title → map on 1-6 with all six open and the vault replays; 1-2's results Retry and Continue and the map menu still work; reduced motion cuts to colour; no console errors. The page clock is frame time (0.1 s per frame at most), so the waits are in the game's own clock; the first version waited in wall time and failed under load, which is how that was found.
- Pixel audit (`npm run audit:pixels`, Chrome 1280x720, DPR 1 and 2, deterministic clock): **72/72 runs, 166/166 regions** (was 60/134; new states: the three ending pages, credits card, names card, a card mid-fade, the focus frame on Credits, the title's Credits button), off-palette 0 / 20,169,516 px, intermediate 0, bad art blocks 0 / 918,430, blur blocks 0 / 18,662,400.
- Root QA `ONLY=CTS` on the packaged ZIP of a clean clone at `9cd555f` (a mirrored workspace in the session scratchpad): **16/16**, 0 console, script or asset errors. The new check plays the ending by real keys on the packaged build, served from the strict nested host. Release gate `--only=crh` there: Build, ZIP, Refs, Meta, Tests 179/179, RootZIP 1/1, BrowserQA 16/16, Probe all PASS; the only WARN is "on branch ending" (ready in 1.64 s, 0.28 MiB before ready, title frames median 16.7 ms, boots with storage blocked).
- ZIP: **116 files, 7.07 MiB** (7,412,129 bytes, sha256 `42a67fda4630a2dae8baa7b72923d80600798101f7116548f1b813af5727b59e`; was 114 files, the two new modules are the difference), root `index.html`, relative paths only, no `.mjs` left, no external request, no tests or research notes, largest file `track.mp3`.
- Not done: nobody has watched the ending or listened to it with the music; the wave is judged from still frames and the audit, not in motion on a GPU (SwiftShader only); no physical keyboard, only Playwright's; the credits' truth is limited to what the workspace supports (see CREDITS_TODO).

### Levels round (2026-11-10, level-design squad; `LEVEL_DESIGN_V1.md`)

Rebuilt and re-tuned on top of the combat; the human-proxy table is in `LEVEL_DESIGN_V1.md`
("Measured"), the raw runs in `common/artifacts/revision-5/crh-levels/proxy/`.
- 1-2 rebuilt: a sentinel to learn on, the wall duel (a walker at the 7-tile wall's foot, its pad
  stays flat there), the island chain, the green card. 1-4: the swirl is on the path, recovery rocks
  at the develop gaps, a second orb and a rock at the orb gap. 1-6: a longer ledge (5-tile first
  water), one card on the ledge, a stepping rock under the orb, no card on the escape's island. 1-1, 1-3, 1-5 unchanged.
- Model, one condition: the theft no longer brings defeated cards back.
- The human proxies were fixed first (flat pads are springboards, an air jump after a bounce has to
  land where walking on is safe, swap to white before the jump, brake over a wall, widest-margin
  technique for the casual and expert, a fight reflex against a chasing walker) and a Chrome driver
  (`tests/human-proxy-chrome.mjs`) plays the levels with real key events.

**Combat redesign (combat squad), 2026-11-10** (`RESEARCH_COMBAT.md`; movement physics unchanged):

- `npm test`: **145/145** (20 new in `tests/combat.test.mjs`: hearts, the blink, safe-ground respawn,
  the 0.4 s windup and 1.5 s first-sight floors, the stomp window and chain numbers, defeat vs daze vs
  flatten, the knock, clean routes, 1-3's catch). Every baseline, mastery and takedown route wins with
  0 deaths and **0 hearts lost** (the planner rejects any option that costs one).
- Movement audit: still 27 PASS / 2 WARN / 0 FAIL; C2 asserts the spear hit shape equals the drawn spear
  within 2 px. `tests/browser-movement.mjs` 23/23 in Chrome.
- Root QA `ONLY=CTS`: **15/15** on the packaged ZIP of a clean clone of the branch (new check: windup
  telegraph, a heart lost with the blink and the HUD, the 4-stomp chain and Chain stamp, a water fall
  that hops back). Release gate `--only=crh`: all steps PASS, one WARN (branch is not `main`).
- Human proxies, hearts lost and deaths per level: before -> after clears of 12 (first-timer / casual / expert): 1-1 12/12/12 -> 12/12/12; 1-2 4/0/0 -> 10/1/4; 1-3 6/12/12 -> 7/12/12; 1-4 0/6/6 -> 8/7/8; 1-5 11/11/10 -> 11/11/12; 1-6 1/0/2 -> 1/0/5. Median deaths 1-5 3/2/5 -> 0/0/0 (hearts lost 1/0/1); 1-4 30/26/24 -> 9/4/1 (hearts lost 30/12/5, almost all water); 1-6 22/10/16 -> 10/6/7. Full table in `RESEARCH_COMBAT.md` section 8.

**v1.0 release candidate (release squad), 2026-11-10:** see `ITCH_IO.md` "Release gate"
for the gate tables before and after.

- `npm test`: **115/115**. New tests cover the save v2 migration fixtures, the
  settings, the assist's timings, assisted clears and stamps, every route winning with
  the assist on, and the release facts.
- Movement audit: still 27 PASS / 2 WARN / 0 FAIL (no physics or route changed).
  `tests/browser-movement.mjs` passes 21/21 against the source.
- Root QA `ONLY=CTS`: **14/14** on the packaged ZIP. New: the withheld-pack gallery
  check (86 images and 17 notes), and reduced motion from the system and from Options
  together with the assist.
- Colour vision: real frames (1-3, 1-5 white and green, 1-6 inbound and escape, the HUD)
  were captured under emulated protanopia, deuteranopia, tritanopia and achromatopsia,
  before and after the badges.
- The ZIP now has 112 files: 17 `assets/player/` files and 5 research or audit docs
  were removed, and `CHANGELOG.md` was added.

**Revision five, critic round two (cards with teeth, Ghost/Takedown), 2026-11-10:**

- `npm test`: **106/106 pass** in ~18 s. New: the cone-blind rule (every gate/watch card
  stops the bot in at least half of 31 arrival times; the exempt list is pinned), 1-3's
  catch, the stamps on scripted routes, the Takedown save.
- Cone-blind rule breaks: 12 cards on `6a94a2a` (1-2 pit; 1-3 roof, lookout, floor,
  alcove, pillar-a, pillar-b, platform; 1-5 p1; 1-6 corridor), 0 now. The bot no longer
  wins 1-3 (31/31 → 0/31) or the 1-6 escape (5/31 → 0/31). Details: LEVEL_DESIGN.md.
- Routes, baseline / mastery: 1-2 21.3 / 30.9 s, 1-3 32.0 / 24.3, 1-4 16.5 / 17.0, 1-5
  19.5 / 20.8, 1-6 35.1 / 36.3 (escape 12.2 / 13.4). Takedown: 1-5 36.6 s, 1-6 37.2 s
  (escape 14.3), every card down. All 0 deaths, all unseen.
- D2: 1-4 7.9% (was 2.3%), 1-5 26.6% (was 20.3%), 1-6 escape 8.0%.
- Movement audit: still 27 PASS / 2 WARN / 0 FAIL (physics untouched);
  `tests/browser-movement.mjs` 21/21 against the source in Chrome.
- Real-key Chrome playtest (Playwright, port 4421):
  - 1-3, a white climb into the lookout's face: "?", "!", "caught!", back at the midpoint.
  - 1-3, a swap about 0.25 s after the air jump slipped under the "?" (the expert's line).
  - 1-2, a jump under the lip doesn't rise (12 px of headroom); walking off drops into the pit.
  - 1-5's Takedown route: the result card shows Ghost and Takedown 6/6, and both are saved.
- Root QA `ONLY=CTS`: 13/13 on the packaged ZIP, with a new check for 1-3's catch and
  the 1-5 Takedown stamp.

**Revision five, critic round, 2026-11-10:**

- `npm test`: 98/98 pass.
- Routes, baseline / mastery: 1-5 19.4 / 20.5 s; 1-6 35.1 / 36.3 s (escape 12.2 / 13.4).
  All win with 0 deaths and unseen.
- D2: 1-4 2.3%, 1-5 20.3%, 1-6 escape 8.0%.
- Cone-blind audit:
  - 1-6 escape: the bot wins 5/31, was 29/31.
  - 1-5: the enforcer is passed 3/31, was 31/31.
  - The full table is in LEVEL_DESIGN.md.
- Root QA `ONLY=CTS` on the packaged ZIP: 12/12.

**Revision five, 2026-11-10** (vault room rebuild, "every card has a job"; movement
physics unchanged):

- `npm test`: **97/97 pass** (64 model/level, 22 movement audit, 11 campaign). New: every
  card's job proved on the routes (30 cards); no stacked cards; the vault room never
  strands Rubik (six kinds of 20 s dawdling after the theft never kill, then one dash
  opens the door; a dash from deep in the room stops in the doorway and a second one
  knocks the alarm card); sticker 3 stays sealed inbound (a sweep of white jumps from
  the roof's left end: 0 reach it, against 1543 of 2460 with the old 2-tile gate); 1-5's
  goal block needs white and its green card stops white (swap to green before landing).
- Routes, baseline / mastery: 1-1 11.5 / 15.7 s, 1-2 20.9 / 24.6, 1-3 20.1 / 25.3, 1-4
  14.7 / 15.1, 1-5 19.4 / 20.2, 1-6 35.0 / 36.7 (escape 12.2 / 13.9; the Quick par stays
  18 s). All win with 0 deaths, mastery 3/3, every route unseen.
- Movement audit unchanged at 27 PASS / 2 WARN / 0 FAIL; D2 now 1-4 2.3%, 1-5 11.2% (was
  4.8%), 1-6 escape 8.0% (was 8.4%).
- Real Chrome: `tests/browser-movement.mjs` against `node serve.mjs --port 4420`: every
  check passes, all 12 routes win. Real-key playtest of the escape (Playwright keyboard,
  real-time loop from the theft): walking to the door and pressing Shift smashes and
  knocks with 0 deaths; 12 s of a "lost" player pacing and jumping in the room: 0
  deaths, the cue still drawn; a dash from deep in the room plus a second dash: out, 0
  deaths. Root QA on the packaged ZIP (`ONLY=CTS npm run test:browser`): 12/12, with a
  new vault-room check (10 s lost in the room, cue on, one dash out, cue off).

**Movement audit, 2026-11-10** (`MOVEMENT_AUDIT.md`: 29 rubric items, before 19 PASS /
4 WARN / 6 FAIL, after 27 PASS / 2 WARN / 0 FAIL):

- `npm test`: **92/92 pass** (59 model/level, 22 movement audit, 11 campaign).
- Routes regenerated for the new movement, baseline / mastery: 1-1 11.5 / 15.7 s,
  1-2 20.9 / 26.1, 1-3 20.1 / 25.3, 1-4 14.7 / 15.1, 1-5 18.1 / 20.2, 1-6 34.7 / 36.4
  (escape 11.75 / 13.5; the Quick par stays 18 s, within 1 s of 1.5 × 11.75). All win
  with 0 deaths, mastery 3/3; stealth baselines and every mastery route unseen (1-2's
  baseline is seen once, as before: it is not a stealth level).
- `npm run build:itch`: 133 files (now with `loop.js` and this audit), a 7.1 MiB ZIP (exact size and
  SHA-256 in `dist/build-report.json`).
- Real Chrome, trusted key events (`tests/browser-movement.mjs` against `node serve.mjs
  --port 4401` on this folder and on the built `dist/itch` folder): all 12 routes win;
  a press shows on the next rendered frame or the one after; under 40-90 ms main-thread
  hitches every jump fires on its keydown's tick; a direction held through pause/resume
  keeps moving; Space on the focused Resume resumes without a jump; the drawn sprite,
  diffed on the canvas, has its feet line on the floor and its feet within 2 px of the
  support; lookahead 1.57 s at run speed. The built game also plays with real keys in a
  sandboxed 960×640 iframe. No console errors or failed requests.

**Earlier pass, 2026-11-09** (before the movement audit; the flow checks below were not
all re-run on the new build, and the route times and test counts above supersede):

- `npm test`: **70/70 pass** (59 model/level/movement, 11 campaign). They cover the six
  levels' shape and kits; **no sleeping card in any level or route**; GET order and
  checkpoints; each taught mechanic as a reachability sweep on the real model (1-1's
  wall needs the double jump; 1-2's 7–8-tile targets need a stomp; stomps from
  above/behind vs the spear-up from the front or when aware; held vs tap bounces;
  the unskippable green card; 1-3's wall stops green and its 12-tile pillar hops need
  white and expose him long enough to be spotted; 1-4's 12/14-tile gaps stop green
  without the dash and its 20-tile orb gap stops white's double jump at any timing; a
  run-and-jump can't stomp 1-5's facing red guard; the 1-6 theft hold, the sealed
  door and the in-room respawn); no 3-tile climb anywhere; no checkpoint in a cone;
  the hint budget; sticker permanence and segment restore; cone = PNG; awareness,
  contact, the edge-pin give-up, swap, smash/knock; the movement feel (start/stop/
  turn timings, air drift, variable jump, apex hang, firmer fall and the cap, coyote
  and buffer windows to the tick, corner correction, ledge assist, dash-jump carry,
  dash freeze, no third jump); hitboxes against the sprite art; every level's
  baseline and mastery route winning with zero deaths (mastery 3/3); campaign unlock
  order, color, stamps (Unseen on 1-3/1-5/1-6), medals, save round-trip, throwing
  storage and corrupt saves; 103 byte-identical images.
- Routes (QA reachability, not human times), baseline / mastery: 1-1 11.6 / 15.9 s,
  1-2 21.0 / 26.2, 1-3 20.1 / 25.3, 1-4 15.8 / 15.2, 1-5 18.2 / 20.5, 1-6 35.1 /
  36.8 (escape 12.2 / 13.9; the Quick par stays 18 s = 12.2 × 1.5). Baselines on the
  stealth levels and every mastery route are unseen; 1-6 mastery has 5 smashes.
- `npm run build:itch`: 131 files, a 7.0 MiB ZIP (exact size and SHA-256 in
  `dist/build-report.json`).
- Real Chrome (Playwright scratch scripts outside the repo, `node serve.mjs --port
  4394` and the built `dist/itch` folder): all 12 routes win in the browser on the
  built folder; a sandboxed 960×640 iframe plays; throwing `localStorage` keeps
  progress for the visit; title → comic → key → the 1-1 card → play; 1-1 win → tally
  → map reveal; reload → map; pause suspends audio; the pit stomp, island chain,
  wall stomp and GREEN GET of 1-2; the 1-3 pillar finale; DASH GET and the storm
  wisps; the 1-5 enforcer with cone edges; RED GET, REVERSE kept off Rubik, the
  escape and the roof line; world clear; the new ending; 390×844 portrait (a taller
  level view with the HUD pulled in, the deck on the map, no DASH pad before DASH
  GET, the touch title plate, no overflow). No console errors or failed requests.

Known limits: white can double-jump 1-4's develop gaps (the level starts green, so the
dash is the guided way); 1-4's pillar gap can also be crossed by stomping its
lookout and air-jumping (an intended alternative); 1-5's perch-to-perch jump passes
the enforcer; guards follow fixed timers. Movement audit WARNs: the skill gradient
(expert lines 2-8% faster than the frame-perfect guided bots, below the rubric's 15%;
see `MOVEMENT_AUDIT.md`) and the original art's stride/dash frames, whose feet sit
4-10 px off the support (all standing, landing and falling frames are within 2 px).

Not verified: physical phones, Safari/Firefox, subjective audio, first-play times and
whether players find it fun. Those need the user's playtest (RESEARCH_PROGRESSION.md
§12 lists what to watch first).
