# Color Rush Heist: research brief for the Stage 1 rebuild

Research only (2026-11-09); no code changed. Answers the user's feedback: *the beginning makes
no sense, use the original assets better, the UI is generic.* The approved verbs stay: run,
coyote/buffer jump, white double jump, dash, stomp, refills, green disguise, red smash getaway.
What changes: story logic of the first minute, the map, asset use, and UI. Original-game facts
come from decoding `../scenes/*.tscn`, `../scripts` and inspecting every image; external claims
are linked in §12.

## 1. Executive summary (ranked)

1. **Rubik starts colorless and earns green in 15 s.** Today green exists at t=0, contradicting
   the comic. Instead he stomps a dozing green card, absorbs its color and walks unseen among
   green patrols (Hitman's "take the guard's uniform"), taught with zero text.
2. **Build one real place: Stage 1 "Green Forest"** with the original tileset at **one uniform
   2× pixel scale**, the original level's macro shape (home wall → flats/pits → floating ledges
   → staircase → vault against a tall wall), parallax, and a goal glow visible from the start.
3. **Delete all floating labels**, the in-level poster, framed relics, dark overlay, laser,
   minimap, loot counter and the DOM status/palette bars. Use ≤4 contextual comic bubbles.
4. **Readable guards (Mark of the Ninja):** the original cone sprite is the exact detection
   shape; unaware → "?" → "!" then the card's own unused spear-lunge animation. Body contact
   bumps; only spears and pits kill.
5. **Red "enforcer" cards** (`inimigo3`, unused even originally) guard the vault and see through
   green; after the theft they ignore red Rubik while green cards hunt him.
6. **Vault as set piece; theft starts a Pizza Tower/Wario Land 4 escape without a fail timer.**
   Touch the vault (drop the E key), hit-stop, storm into red, Uno "REVERSE" wipe, remixed route
   home through red-only sealed stones (Tile_15).
7. **Dash becomes a Celeste charge** (one air dash, restored by ground/stomp/refill/smash),
   shown on Rubik, not a meter. Today it recharges mid-air every 0.65 s, so refills merely
   shorten a timer.
8. **Replace blue relics, loot and letter ranks with 9 "lost stickers"** filling a 3×3 HUD face,
   plus three medals: Full face, Never spotted, Quick getaway.
9. **Use the original front end:** `title_screen` forest crossfades into `bg1` (same
   composition, pixel-aligned: luminance correlation 0.75), comic in its original 2×2 layout,
   Rubik-face iris (`cutout.png`), and `end_game.png` ("That's it by now.") as the demo ending.
10. **Plan, don't build, Stage 2 "Blue Mountains"** (`bg2`, `bg2exp`, `tileset_ice`, `inimigo2`,
    `rubik_blue` imply it) until the user reacts to Stage 1. No invented blue ability.

## 2. Diagnosis of the current build

- **Labels instead of a place:** nine world labels, a key-list toast, an objective strip,
  "HIDDEN" over Rubik.
- **Story contradictions:** green before recovery; pickups are tiny red Rubiks before red
  exists; blue cubes framed in the sky; title poster as a billboard; a sci-fi laser in a forest.
- **Mixed pixel density:** `Tile_02` (32 px = two 16 px cells) drawn 1:1 while Rubik's 32 px
  frames draw at 64 px, so terrain detail is half-scale; cards drawn 103×80 from 86×67
  (non-integer); vault at 3×. Only one of 60 tiles; platforms are dark-filled rectangles.
- **Too small:** 1,720 px (<2 screens). The original forest was 281 cells (≈9,000 px at 2×)
  with seven guards.
- **Unused:** Rubik's dash/storm rows, card idle/attack rows, red and blue card sheets, cone
  sprite, cutout mask, `bg1-sky`, 59 tiles, dust/rock FX.

## 3. Comparable games

| Game | What works | Player complaints | Steal |
|---|---|---|---|
| SMB 1-1 / Mega Man X intro | Geometry teaches; the first enemy is the easiest; failure is the lesson | — | Sleeping first card, safe pits, zero text |
| Celeste | Coyote/buffer/apex half-gravity/corner correction; refill crystals; dash state in hair | Late precision spikes | Dash charge + refills; state on character; side routes |
| Mark of the Ninja | Visible sight/sound; three awareness levels; behavior never changes without a cue; checkpoint per encounter; ≈1.5-screen spaces | Respawn can drop you near danger | Cone = hitbox; "?"/"!"; dense checkpoints |
| Hitman (2016) | Disguise lets you walk among wearers; marked enforcers see through | Absolution drew a petition; enforcer rules still unclear | Green disguise + always-marked red enforcers |
| Pizza Tower | Goal triggers escape to the entrance; music gear-change; remixed level; ranks/secrets | Precision; timer stress | Theft → remixed reverse route + music shift |
| Wario Land 4 | Frog switch: stress in a familiar space, flipped blocks | ≈5-min escapes "obnoxious" | Short escape (≤60 s), changed blocks |
| Spelunky | Lifting the idol drops a boulder: theft has a physical consequence | — | Visible chain reaction at the vault |
| Hue | Color changes what exists; symbols in colorblind mode | Tight switch windows under urgency | Generous switching; glyph per color |
| Ikaruga | Matching polarity = safe | Steep | "Matching color = invisible", absolute |
| Guacamelee | Colored blocks yield to one move; mid-jump world swaps | Mid-jump swap spikes | Red-only stones; swaps for mastery only |
| Gris | Color returns to the world | — | Forest regains color as Rubik does |
| Super Meat Boy | Instant respawn removes the penalty | Fast retry can skip reflection | ≤0.45 s respawn + one hint after repeats |

## 4. Player-feedback patterns

- **Unclear detection is the top stealth complaint**: an Absolution disguise petition and
  persistent enforcer confusion ([wiki](https://hitman.fandom.com/wiki/Disguise),
  [petition](https://www.change.org/p/square-enix-io-interactive-fix-hitman-absolution-s-disguise-system));
  Mark of the Ninja was designed around clarity ([Game Developer](https://gamedeveloper.com/design/-i-mark-of-the-ninja-i-s-five-stealth-design-rules)).
- **Instant-fail stealth feels punitive**; critics ask why being seen restarts instead of
  playing out ([TheSixthAxis](https://www.thesixthaxis.com/2014/07/10/hide-and-seek-why-stealth-mechanics-need-a-shake-up/),
  [Game Developer](https://www.gamedeveloper.com/design/from-out-of-the-shadows)); Stealth Inc's
  repeated deaths read as tedious ([review](https://www.thesixthaxis.com/2013/07/23/stealth-inc-a-clone-in-the-dark-review-psn/)).
- **Short retries are forgiven**: MOTN checkpoints "never far back" ([Game Informer](https://gameinformer.com/games/mark_of_the_ninja/b/xbox360/archive/2012/09/07/mark-of-the-ninja-review-classic-stealth-with-a-2d-twist));
  Meat Boy removed the penalty ([McMillen](https://gamedeveloper.com/design/raw-meat-game-design-tips-from-team-meat-s-edmund-mcmillen)).
- **Color switching under urgency gets fiddly** ([Hue review](https://www.thexboxhub.com/hue-review/)).
- **Escapes work short, grate long**: WL4 stress in a familiar space is engaging
  ([note](https://publish.obsidian.md/myaiba/Z0+Zettels/The+Frog+Switches+in+Wario+Land+4+are+a+Great+Mechanic+for+Inducing+Stress+in+a+Familiar+Space)),
  five-minute escapes are "obnoxious" ([NWR](https://nintendoworldreport.com/review/37482)).
- **Text, arrows and pop-ups are disliked**; "use mechanics to teach mechanics", fewest words
  ([Game Developer](https://gamedeveloper.com/design/the-perfect-video-game-tutorial-six-flavors-for-the-ideal-appetizer)).
- **Touch fails with small, always-on buttons**; show controls by context ([Apple HIG](https://developer.apple.com/design/human-interface-guidelines/game-controls)).

## 5. Design principles → concrete changes

| Principle | Change |
|---|---|
| Swink: context gives motion meaning; polish sells it | Geometry sized to jump numbers (§9); hit-stop 60 ms stomp / 90 ms smash / 250 ms theft; dust on jump/land/skid |
| Koster: fun = learning patterns | One new pattern per section; the escape remixes, adds no verbs; medals extend mastery |
| Schell, holographic design / theme unity | Every object has a story reason: cards hold colors, vault holds red, stickers are his, home is the start |
| Rogers / "mechanics teach mechanics" | No world labels; ≤4 bubbles, each retired after first success |
| Kishōtenketsu (Hayashida, via GMTK) | Each section: introduce → develop → twist → conclude (§9) |
| World 1-1 / Mega Man X | First card asleep, facing away; first pit has a walk-out floor; first dash gap has a lower ledge |
| Celeste forgiveness | Keep 100 ms coyote and 120 ms buffer; add half gravity while holding jump near apex (\|vy\|<60) and ≤6 px corner correction |
| MOTN transparency | Drawn cone = detection; every state change has a bubble and a sound |
| Never color alone ([Xbox AG 103](https://learn.microsoft.com/en-gb/gaming/accessibility/xbox-accessibility-guidelines/103)) | Glyphs on form chips and card chests; crack pattern on red-only stones |

## 6. Original-asset audit

All 103 images stay byte-identical. "Archive" = gallery only.

| Asset | What it is | Proposed on-screen use |
|---|---|---|
| `title_screen.png` | Colored forest, logo, "PRESS ANY KEY", credits | Full-frame title; its forest crossfades into `bg1` (colors drained). Remove the in-level billboard. |
| `intro.jpeg` | Early jam card crediting Vitor Farias, @cauesmelo | Credits (from Pause) |
| `bg_black.png` | Black 480×270 | Comic backdrop, as in `story.tscn` |
| `quadro1–4.png` | Comic panels | Original 2×2 positions, 2 s cadence, skippable |
| `cutout.png` | 3×3 Rubik-face alpha mask (original iris shader) | Transitions: comic → play, stage clear, results |
| `bg1.png` | **Desaturated** forest (saturation 0.12 vs title 0.48) | Mid parallax 0.35, colorized as the stage clears; no overlay |
| `bg1-sky.png` | 1440×451 sky extension | Above `bg1` for vertical sections (originally at y=-268), parallax 0.15 |
| `Tileset.png`, `Tile_01–60` | 16 px-cell atlas | Terrain at 2×: nine-slice 1–3/11–13/21–23; one-way ledges 7–9; floating blocks 31–34, 39; inner corners 24/26; **15 = sealed stone**; pillars 44–46/54–56 for pedestals; right column 10–60 (unused originally) = water for pit bottoms; slopes 47/48 backdrop only; darkened copy as back layer (`tilemap_no_col`) |
| `tileset_ice.png`, `bg2.png`, `bg2exp.png` | Blue mountain set | Stage 2 only; remove the 13% mountain overlay from the forest |
| `rubik_white/green/red.png` | Rows: idle y0 (2), dash y32 (6), run y64 (4), jump y96 (6), y128 (4, unused), storm y160/y192 | Use the **dash row while dashing** and storm rows in transformations; y128 as a landing pose |
| `rubik_blue.png` | Blue form | Stage 2 finale/ending, not a Stage 1 relic |
| `rubik.png` | Pixel-identical copy of `rubik_white` rows 0–4 | Archive (duplicate) |
| `rubik_storm.png` | Four-frame swirl | Transformation; frames 1–3 as the **dash refill orb** |
| `inimigo_verde.png` | Green card: attack (10), walk (7), idle | Patrols at **2×** (original ≈2× Rubik's height); idle for dozing/sentries; attack = spear lunge |
| `inimigo3-Sheet.png` | Red cards (unused originally) | **Enforcers** near the vault |
| `inimigo2-Sheet.png` | Blue cards | Stage 2, see every color |
| `cone_de_visao.png` | Sight cone | Per-card cone, original pulsing alpha, tinted by state; detection = this shape |
| `cofre.png` | 23×20 safe | Vault at 2× in a tile-built chamber with red glow; favicon |
| `end_game.png` | "Thanks for playing! That's it by now." | Demo ending screen |
| `font.ttf` | monogram extended (datagoblin, CC0) | All UI at 16/32/48/64 px only |
| `track.mp3`, `theme.tres` | Music; font theme | Music (playbackRate 1.12 after theft); theme as reference |
| `player/*Dust*` | White dust FX | Double jump, landing, dash start, skid |
| `player/Rock1–2` | Rocks | Stone-smash debris; Stage 2 falling rocks |
| `player/Pink_Monster_*` (12) | Generic third-party hero | **Archive.** Clean-outline style clashes with the sketchy cube/cards; no story role. Appears to come from the "Tiny Hero Sprites" pack: confirm license/credit if dust or rocks ship. |

## 7. Mechanics proposals

Units: 960×540 logical; 1 tile = 32 px (one original 16 px cell at 2×). Current constants: jump
apex ≈94 px (0.80 s air, ≈263 px at speed); double jump +≈83 px (≈176 px total); dash ≈145 px;
stomp bounce ≈115 px.

| # | Proposal | Why fun / story fit | Tuning | Risk |
|---|---|---|---|---|
| M1 | **Take a card's color.** Stomping the first card ejects its green as a swirl; Rubik absorbs it; the card stays grey (grayscale filter) and dazed. Later stomps only stun. | First stomp = instant, visible reward; cards are colored because they hold his colors | Absorb at bounce apex (keeps white's height); storm 0.18 s; stun 3 s | Players expect every stomp to give color; only the first card shows a swirl |
| M2 | **Readable awareness + spear lunge.** Unaware → "?" after 0.25 s in sight (stops, cone orange) → "!" at 0.6 s: charges, windup (attack frames 0–3), lunge 4 tiles (frames 4–7), 0.7 s stompable recovery. Breaking sight or matching color resets via "?" (1 s). Body contact = 1-tile knockback + alert; only spear/pits kill. | Chase replaces instant fail; original attack frames | Cone 352×94 px; charge 240 px/s vs run 330; patrol 100 px/s (original 50 at 2×); turn every 3 s (original 2–4 s) with 0.4 s look-back | Long cone + fast alert; tune thresholds first |
| M3 | **Red enforcers.** `inimigo3` cards see white and green; mostly stationary sentries (original `no_walking`) on turn timers; stompable; ignore red Rubik. | Makes white vs green matter near the goal; the comic's red card is the boss | Chest glyph showing what each card sees; distinct cone tint | Rules must stay visible |
| M4 | **Mid-air swap as skill ceiling.** Jump green through a patrol, switch white at apex for the unspent extra jump ("You also can change colors mid air", original tip; code already allows it). | Expressive mastery | 0.15 s cooldown (original 2.0 s); never block swaps | Fiddly under urgency; optional routes only, mainline gates need one swap |
| M5 | **Dash charge + storm refills.** One air dash, restored by ground, stomp, orb, smash, knockout; ground re-dash after 0.25 s. Spent = Rubik's highlight dims; refill = white flash + click. Remove the meter. | Refills become routes (Celeste) | Orbs respawn 2.5 s | Orb at 2× may dominate; crop to 20×20 center |
| M6 | **Vault crack → REVERSE.** Touch/dash the vault: 250 ms hit-stop, red burst, storm into red, full-width Uno "REVERSE" card (0.6 s), music rate 1.12, all cones flip toward the return path. | "Steal back his colors", then get home; immediate payoff | No fail timer; par time (QA route × 1.5) awards Quick getaway | Tension must come from alerts and music |
| M7 | **Red smash through sealed stones.** Tile_15 stacks (1×4) break only to red dash; refund charge, rock debris, 4 px shake (off under reduced motion). Visible but inert inbound; open shortcuts and two sticker alcoves on return. Knocking a green card aside also refunds. | Guacamelee-style gates make the return trip a discovery | — | — |
| M8 | **Lost stickers + forest color.** 9 yellow stickers per stage (Rubik's own face, used by no army), white-edged squares with peel glint (shape differs from round orbs); fill the HUD face; permanent once taken. As the stage clears, `bg1` is colorized at runtime via canvas `color` compositing. | Exploration goal; the world visibly changes (Gris) | — | Yellow near yellow cones: stickers solid/outlined, cones translucent/pulsing; verify in browser |

**Cut:** laser, glow orb, loot/multiplier/chain meter, E/STEAL, blue relics, "HIDDEN", S/A/B/C
ranks.

## 8. The opening 30 seconds

**Front end (≈8 s, any key skips):** title → logo fades as the forest crossfades into `bg1`
(0.8 s; the theft told in-world) → comic panels pop in at 2 s each → panel 4 ("He's gonna do
it!") holds as the Rubik-face iris closes, then opens on play.

| t (s) | What happens | Teaches |
|---|---|---|
| 0–3 | Sad, colorless Rubik on his home cliff (original start wall). "GREEN FOREST" fades at 64 px; a faint red glow pulses far right over the trees. | Why he's here; where to go |
| 3–8 | Drop, 1-tile step, 4-tile ditch with a sticker at the jump apex; floor 2 tiles down with a walk-out step. | Move/jump; stickers mark arcs; safe failure |
| 8–15 | A ledge ends above a dozing green card ("z", dim cone facing away). Walking off lands on its head: bounce, swirl, storm, Rubik turns green; HUD gains a green "X" chip. | Stomp; cards hold colors |
| 15–22 | Two green patrols under a low ceiling (no jumping over); cones sweep him, "♪" bubble, they pass. | Green = invisible to green |
| 22–30 | 4-tile ledge with a sticker; green can't double jump. After 2 s of failed jumps a thought bubble shows "Z ⬜"; white double jump. On top, a card facing away gives the first "?" with room to retreat. | White/green tradeoff; awareness states |

## 9. Map and level plan

**Geometry rules:** ledges any form can reach ≤2 tiles; white-only ledges 4 tiles (5 for
mastery); **never 3** (94 px apex misses 96 px by 2 px, which feels broken). Gaps for any form
≤5 tiles; jump + dash 10–11 tiles; **avoid 6–8** in teaching zones (dash need unclear).
Encounter spaces ≤1.5 screens.

Bootstrap terrain from `level_green.tscn`: each tile is a `PackedInt32Array` triplet (position
`(y<<16)|x`, signed 16-bit; `source|(atlasX<<16)`; `atlasY`) on 16 px cells. Trim to ~190
columns.

**Stage 1 inbound** (~190 tiles / 6,080 px; first play 2–3 min including escape, mastery ~70 s):

| Tiles | Section | Beat | Teaches | Stickers | Checkpoint |
|---|---|---|---|---|---|
| 0–40 | Home and first steps | Introduce | Move, jump, safe ditch | #1 ditch arc | CP0 start |
| 40–60 | The sleeping card | Develop/twist | Stomp → absorb green | #2 bounce apex | CP1 at 60 |
| 60–90 | Disguise corridor | Conclude | Green passes green cards | #3 ceiling ledge, seen now, reached later | |
| 90–110 | White again | Twist | 4-tile ledge; "?" lesson; mid-air swap into a patrol | #4 branch needing a swap | CP2 at 110 |
| 110–140 | Canopy gaps | Introduce dash | 10-tile gap with recovery ledge; then jump → dash → refill → dash over water | #5 refill line | CP3 at 140 |
| 140–165 | Enforcer post | Develop/twist | Red sentry turns every 3 s: time it, stomp from a perch, or go white | #6 perch behind it | CP4 at 165 |
| 165–190 | Vault steps | Conclude | Stairs under crossing cones; sealed stones foreshadow; vault chamber at the tall end wall | #7 behind a stone (escape only) | Vault CP after theft |

**Getaway (~45–60 s, right to left):**
- **Burst:** two green cards wake and charge; enforcers ignore red Rubik; stair stones form a
  smash chain.
- **Enforcer post reversed:** alert green patrols; knockbacks refund the charge.
- **Canopy:** mid-air stones let him smash-refund-smash across the big gap (power fantasy);
  CP at 140.
- **Corridor:** green cards now see red Rubik; smash through or swap to green (player's
  choice); #8 behind a ceiling stone.
- **Home:** the opening's grey card is still dazed; #9 on the cliff top needs white double
  jump + dash. Reaching the cliff ends the stage; the forest colorizes; iris closes.

**Checkpoints:** ≤35 s of first-play time apart and never more than one new idea; 0.45 s
respawn, 0.75 s grace, existing whole-segment restore. Marker: a chalk 3×3 face (cutout shape)
on a pillar that fills with the current color.

**Stickers:** three on the main line (teaching arcs), three on white/swap routes, two revealed
by escape smashes, one mastery at home.

**Stage 2 "Blue Mountains" (phase 2, only after feedback):** ice tops (braking 3300 → 1200
px/s²), blue cards see every color, telegraphed falling rocks with a dust warning, vault returns
blue → full-color storm → `end_game.png`. No blue ability, no reverse escape (as the original
ending).

## 10. UI/UX specification

**Global:**
- The canvas is the whole surface: 960×540 (exactly 2× the original 480×270), embedded at
  960×540 on the plain green page.
- Pixel-style UI in `font.ttf` at 16/32/48/64 px, integer positions, 2 px dark outline (like
  the original stage title).
- Card-shaped panels (white rounded border, Uno-style oval).
- Glyph beside every color; a sound for every state change.
- Reduced motion keeps state cues; removes shake, flashes and iris animation (cut instead).

| Screen | Spec |
|---|---|
| Boot | Blank plus a small cube spinner while assets load |
| Title | Full-frame `title_screen.png`; any key or tap starts; 32 px sound/fullscreen corner icons |
| Story | Color-drain crossfade, then comic (§8); 16 px "▸▸" skip hint; auto-skip on replays (storage in `try`) |
| Stage intro | "GREEN FOREST", 64 px with shadow, fades after 2 s; input live immediately |
| HUD | Top-left: 40×56 card chip for the current form, unlocked forms fanned behind with Z/X/C. Top-right: 3×3 sticker face + optional 16 px timer. No minimap, loot or meter. Dash state on Rubik; "?"/"!" on guards. |
| Prompts | ≤4 bubbles: idle 4 s at start ("← →"), "Z ⬜", "X 🟩" when next needed, dash after two falls at the first gap. Device-matched glyphs. |
| Theft | 250 ms hit-stop, red flash (not under reduced motion), storm, REVERSE swipe, music gear change |
| Death | Original death hop (pop up and fall), cut at 0.45 s, grace blink, no text; one hint bubble after three deaths at one checkpoint |
| Pause | P/Esc/corner button. Card panel: Resume, Restart from checkpoint, Restart stage, Sound, Show timer, Controls, Art archive, Credits (`intro.jpeg`). Arrow/Enter navigation, thick yellow focus outline. |
| Results | "You got your red back!" (original wording style); red Rubik idling beside time, sticker face, times spotted; three medal cards flip in; Play again / Art archive (+ Next once Stage 2 exists) |
| Ending | Full-frame `end_game.png`; any key returns to title |
| Touch | Left: two arrow pads ≥88 CSS px. Right: JUMP (largest), DASH; card buttons for **unlocked** forms above the right thumb. No STEAL. Overlaid in landscape; below the canvas in portrait with a rotate hint. |

**Remove:** DOM status bar and bottom palette/descriptions; ATTEMPTS/TIME/LOOT/RELICS stats
and DASH READY; key-list toast and "LET'S GO" briefing paragraph; minimap, loot, chain meter,
"BLUE 0/3", "RECHARGING"; all world labels, gate "≪"/"← DASH", "E / TAKE RED", "← HOME",
"HIDDEN"; title poster, relic frames, gradient shade, mountain overlay; "BACK IN A BLINK".

## 11. Pitfalls to avoid

1. **Color overload:** color is the rules language; never reuse rule colors for pickups (the
   old red-cube sparks).
2. **Mixed pixel scales:** one 2× grid for tiles, cards, vault and FX.
3. **Detection that doesn't match the drawing**, or unsignaled state changes (Absolution).
4. **Instant-fail stealth, long retries:** keep chases, bumps, 0.45 s respawns, dense
   checkpoints.
5. **Ambiguous geometry:** 3-tile ledges, 6–8-tile teaching gaps.
6. **Long or punishing escapes:** ≤60 s, no fail timer.
7. **New verbs in the escape:** red smash only; everything else is remixed.
8. **Text creep:** every new label is a geometry problem left unsolved.
9. **Scope creep:** no playable blue, no Stage 2 before feedback, no restoring the rejected
   first GTR.
10. **Tiny, always-visible touch controls.**
11. **Unchecked third-party art licenses** (Tiny Hero pack).

## 12. Sources

- Mark of the Ninja: [five heresies](https://gamedeveloper.com/design/-i-mark-of-the-ninja-i-s-five-stealth-design-rules), [GDC 2013 talk](https://gdcvault.com/play/1017791/Of-Choice-and-Breaking-New), [Game Informer](https://gameinformer.com/games/mark_of_the_ninja/b/xbox360/archive/2012/09/07/mark-of-the-ninja-review-classic-stealth-with-a-2d-twist)
- Celeste: [Celeste & Forgiveness](https://maddymakesgames.com/articles/celeste_and_forgiveness/), [Wikipedia](https://en.wikipedia.org/wiki/Celeste_(video_game)), [hair as dash UI](https://www.ludo.guide/guide/celeste/getting-started/understanding-the-ui)
- Escapes: [Pizza Tower](https://en.wikipedia.org/wiki/Pizza_Tower), [WL4 switch](https://www.mariowiki.com/Switch_(Wario_Land_4)), [NWR WL4](https://nintendoworldreport.com/review/37482), [WL4 stress note](https://publish.obsidian.md/myaiba/Z0+Zettels/The+Frog+Switches+in+Wario+Land+4+are+a+Great+Mechanic+for+Inducing+Stress+in+a+Familiar+Space), [Spelunky idol](https://spelunky.fandom.com/wiki/Idol_(HD)), [boulder](https://spelunky.fandom.com/wiki/Boulder_(HD))
- Disguise/color: [Hitman disguise](https://hitman.fandom.com/wiki/Disguise), [petition](https://www.change.org/p/square-enix-io-interactive-fix-hitman-absolution-s-disguise-system), [GamesRadar](https://www.gamesradar.com/hitman-everybodys-gunning-sharp-dressed-man/), [Hue](https://www.thexboxhub.com/hue-review/), [Ikaruga](https://en.wikipedia.org/wiki/Ikaruga), [Guacamelee interview](https://www.pocketgamer.com/guacamelee/guacamelee-dev-talks-alternative-dimensions-and-mexican-authenticity), [Guacamelee review](https://worthplaying.com/article/2013/4/22/reviews/88927-ps3-review-guacamelee/), [Gris](https://www.nintendoworldreport.com/review/49068)
- Teaching: [World 1-1](https://gamedeveloper.com/design/how-miyamoto-built-i-super-mario-bros-i-legendary-world-1-1), [Sequelitis](https://tvtropes.org/pmwiki/pmwiki.php/WebVideo/Sequelitis), [MMX intro](https://nintendolife.com/features/soapbox-mega-man-xs-tutorial-is-the-perfect-intro-to-capcoms-sublime-sub-series), [kishōtenketsu/GMTK](https://www.mcvuk.com/development/video-nintendos-level-design-secrets-in-four-steps), [tutorial flavors (cites Rogers)](https://gamedeveloper.com/design/the-perfect-video-game-tutorial-six-flavors-for-the-ideal-appetizer)
- Failure: [McMillen](https://gamedeveloper.com/design/raw-meat-game-design-tips-from-team-meat-s-edmund-mcmillen), [SMB postmortem](https://www.gamedeveloper.com/audio/postmortem-team-meat-s-i-super-meat-boy-i-), [Stealth Inc](https://www.thesixthaxis.com/2013/07/23/stealth-inc-a-clone-in-the-dark-review-psn/), [forced stealth](https://www.thesixthaxis.com/2014/07/10/hide-and-seek-why-stealth-mechanics-need-a-shake-up/), [From out of the shadows](https://www.gamedeveloper.com/design/from-out-of-the-shadows), [Untitled Goose Game](https://www.inverse.com/gaming/untitled-goose-game-anniversary)
- Theory: [Swink](https://www.gamedeveloper.com/design/game-feel-the-secret-ingredient), [Koster](https://www.raphkoster.com/wp-content/uploads/2026/07/Theory-of-Fun-10-Years-Later.pdf), [Schell lenses](https://research.tedneward.com/reading/gamedev/art-of-game-design/index.html)
- UX: [Xbox AG 103](https://learn.microsoft.com/en-gb/gaming/accessibility/xbox-accessibility-guidelines/103), [Apple HIG](https://developer.apple.com/design/human-interface-guidelines/game-controls), [touch controls](https://www.gamedeveloper.com/mobile/designing-better-controls-for-the-touchscreen-experience)
- Assets: [monogram (CC0)](https://datagoblin.itch.io/monogram), [Tiny Hero Sprites](https://free-game-assets.itch.io/free-tiny-hero-sprites-pixel-art), [OGA copy (OGA-BY 3.0)](https://opengameart.org/content/tiny-hero-sprites-pixel-art)
