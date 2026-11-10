# Color Rush Heist itch.io build

This project exports on its own. Run `npm run build:itch` here, then upload `dist/color-rush-heist-itch.zip` as an HTML game on its own itch.io page. The ZIP has no shared launcher and no server runtime.

The entry point is the root `index.html`. All art, audio, scripts and renderer dependencies are local, including the six level modules in `levels/` and the campaign rules in `campaign.js`. The exporter renames runtime module extensions to `.js` and keeps asset bytes unchanged. It writes the unpacked site to `dist/itch/` and a hash and size report to `dist/build-report.json`. Export timestamps are fixed, so the same source gives the same ZIP bytes.

The standalone `index.html` is a plain green page with only the game centred. In an iframe the same game fills the frame, with its HUD, pause card and touch pads inside the game surface. There is no surrounding website or shared launcher. Music is on by default, but the 7 MB track is requested only after the player's first key or tap. It downloads once and plays through Web Audio, so no media request stays open (and none is cancelled when the player opens the art archive). The setting is remembered.

The runtime needs no CDN, account, API key, backend, Node process or cross-origin isolation. Starting the game and its audio always follows a player's input.

## Embed settings (decided for v1.0, `itch.json`)

| Setting | Value | Why |
| --- | --- | --- |
| Kind | HTML, "This file will be played in the browser" | browser-only release |
| Viewport | **960×540** | the game surface, exactly 2× the original 480×270. Taller frames letterbox the same canvas |
| Click to play | **on** | the first click lands on itch's page; the game's audio starts on the first key or tap inside the iframe |
| Fullscreen button | **on** | itch's own button, plus the game's ⤢ (`embed.js`, which shows a hint if fullscreen is refused) |
| Mobile friendly | **off** (`false`) | Touch play works in emulation, but no physical phone has been tested yet. The plan says to tick it only after the D4/D5 phone rows pass; until then itch still lets phone players start the game, with a warning |
| Orientation | **landscape** (recorded for when Mobile friendly is turned on) | six touch targets (◀ ▶ JUMP DASH and the form cards) need the width |
| SharedArrayBuffer | off | not used |

Embedded mode is detected automatically; open `index.html?embed=1` to inspect it directly. Test the uploaded Restricted draft before publishing.

**Emulated phone, 2026-11-10 (not a physical-device pass):** Chrome at 844×390 landscape with touch, playing the packaged build. Tapping Start and then the stage skipped the comic into 1-1. Holding ▶ moved Rubik 360 px, ◀▶ plus JUMP gave a double jump in the air, and ❚❚ paused. The page did not scroll and there were no console errors. The root QA's 390×844 portrait touch check also passes.

## What the ZIP carries (v1.0)

- **Player docs only.** The exporter ships `README.md`, `CHANGELOG.md` and the licence file (`assets/SOURCE-LICENSE.txt`). Research, audit and design notes stay in the repository: `RESEARCH*.md`, `LEVEL_DESIGN.md`, `MOVEMENT_AUDIT.md` and this file.
- **`assets/player/` is withheld (studio decision, 2026-11-10).**
  - Its 17 files are a generic third-party "Pink Monster" pack whose licence is unverified. The game never draws them; the gallery always listed them as archive-only.
  - The art-preservation rule covers the repository, not the upload. The repository therefore keeps them byte-identical, and the ZIP leaves them out.
  - The rule lives in `itch.json` under `withhold`. The exporter skips the folder and marks those 17 entries `packaged: false` in the ZIP's copy of `art-manifest.json`. It fails the build if any shipped HTML, CSS or JS names one of the withheld files.
  - The packaged gallery shows them as "not in this build" note cards (86 images and 17 notes) and never requests them.
  - **To revert** once the owner has verified the licence: delete the `withhold` entry from `itch.json` and rebuild. The gallery then shows all 103 images again.
- Result: **112 files**, 7.03 MiB ZIP (7.33 MiB unpacked). The 2026-11-10 baseline was 133 files and 7.09 MiB, with 17 `player/` files and 5 research or audit docs removed and `CHANGELOG.md` added.

The package leaves out the local development server, tests, Node dependencies and build tools. Rebuild the ZIP after every edit: editing the source does not update an archive that was already built or uploaded.

## Saves and storage

Progress and settings share one versioned, game-prefixed key, `color-rush-heist:v2:save`. Many itch games share one CDN origin, which is why every key carries the game's name. If the v2 key is absent, the 0.x keys are imported once and written as v2: the v1 save `color-rush-heist:save`, plus `:sfx`, `:music`, `:timer` and `:storySeen`. The old keys stay in place for a rollback. Every storage call is wrapped in `try`.

Inside itch's iframe the save is third-party storage, so Chrome with third-party cookies blocked makes it throw, and Safari or Brave may wipe it. In that case the game still boots and plays, and keeps progress for the visit. The release gate boots the ZIP with `localStorage` and `sessionStorage` throwing. The world map's menu has Reset progress, which keeps the player's settings.

## Accessibility (v1.0)

- **Colour is never the only cue.**
  - White is a square, green a triangle and red a diamond. Rubik, every card (beside its original suit numeral, green 1 and red 3) and the red-only stones wear that glyph as a badge.
  - The HUD form cards and the touch pads use the same glyphs.
  - Checked on real frames with Chrome's emulated protanopia, deuteranopia, tritanopia and achromatopsia. The pass found and fixed two gaps:
    - Rubik's three forms differed by hue alone.
    - The stones' bare red diamond vanished on their olive centre.
- **Slow spotting** (an assist in Pause → Options, off by default):
  - Cards need twice as long to spot Rubik: "?" after 0.5 s instead of 0.25 s, and "!" after 1.2 s instead of 0.6 s.
  - Nothing else changes.
  - An assisted run still clears the level, unlocks the next one and keeps its stickers, but earns no stamps.
- **Less motion:**
  - It follows the system's reduced-motion setting, and Pause → Options overrides it.
  - It turns off shake, flashes, particles (including stone debris), squash and the iris.

## Release gate (`cd ../common && npm run release:gate -- --only=crh`)

**Before** (2026-11-10 14:46 UTC, `main` 2e1453e, report `common/artifacts/release-gate/2026-11-10T14-46-30-468Z/`): overall **FAIL**, with 2 failing steps.

| Repo | Build | ZIP | Refs | Meta | Tests | RootZIP | BrowserQA | Probe | Result |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| PASS | PASS | PASS | PASS | **FAIL** | PASS 106/106 | PASS 1/1 | PASS 13/13 | **FAIL** | FAIL |

The failures were all release chores:

- `meta/package-version`: 0.3.0.
- `meta/itch-mobile`: the placeholder string.
- `meta/version-label`: no label.
- `meta/changelog`: missing.
- `probe/visible-version`: no label on the title.

The ZIP had 133 files and was 7.09 MiB. The probe was ready in 601 ms with 0.24 MiB loaded before ready, and the game booted with storage blocked.

**After** (2026-11-10 15:12 UTC, `main` 0fd2b4d, clean and pushed, report `common/artifacts/release-gate/2026-11-10T15-12-06-412Z/`): overall **PASS**, with 0 FAIL and 0 WARN.

| Repo | Build | ZIP | Refs | Meta | Tests | RootZIP | BrowserQA | Probe | Result |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| PASS | PASS | PASS | PASS | PASS | PASS 115/115 | PASS 1/1 | PASS 14/14 | PASS | **PASS** |

- **ZIP:** 112 files, 7.03 MiB (7,368,659 bytes), 7.33 MiB unpacked. Only two Markdown docs ship (0.04 MiB). The largest file is `assets/track.mp3` at 6.69 MiB. SHA-256 is `a0a4c0db463ba4a5241515dd95cee4eb555417a29f8440fd740780b942e4145f`. The exporter is deterministic, and this file is not shipped, so later commits that touch only repository docs build the same bytes.
- **Refs:** 35 references checked, all relative and present with exact case, with no external loads.
- **Meta:** found the version label `"v1.0"`, plus 1.0.0, the credits, the changelog heading and the decided embed.
- **Probe:** ready in 599 ms, with 0.24 MiB loaded before ready (about 0.2 s at 10 Mbit/s). Title frames had a median of 16.7 ms and a p95 of 16.8 ms on SwiftShader. `v1.0` is visible on the title. There were no requests outside the ZIP and no console errors. The game **boots and starts with storage blocked** (304 ms).
- **BrowserQA:** 14/14 checks on the packaged ZIP. They include the withheld-pack gallery (86 images, 17 notes), reduced motion from the system and from Options with the assist, all six levels on the baseline and mastery routes, the itch iframe and the mobile embed.

No gate check had to change for CRH. The only edits to `common/` were the CTS block of `tests/browser.mjs` (the gallery check now expects the withheld pack; there is a new motion and assist check).

## Page copy (DRAFT for the owner to approve)

- **Title:** Color Rush Heist
  - *Owner:* the title art in the game and on cover A still reads "Color Theft Story". Either keep it as the jam's logo or pick cover B.
- **Short description (tagline):** The card army stole your colours. Sneak, stomp and swap forms mid-air to steal the red back.
- **Description:**
  > Rubik is a colourless cube in a forest of Uno-card guards, and each card is blind to its own colour. Wear white, green or red to slip past them. Stomp them from above or from behind, dash through stone, and steal your red back from the vault before you run home in reverse.
  >
  > Six short levels each teach one idea and then twist it. There are three stickers per level, and Ghost, Takedown and Quick stamps for the daring.
  >
  > Options include a Slow spotting assist and Less motion. Every colour also has its own shape (square, triangle, diamond), so the game reads with any colour vision.
  >
  > Art by Vitor Farias. Based on the jam game *Color Theft Story* by Vitor Farias and @cauesmelo (minigamejam 22).
- **Controls:**
  - ← → / A D: move (and choose a level on the map).
  - Space / W / ↑: jump (hold for height; white jumps twice). Enter also plays a level from the map.
  - Shift / K / J: dash (from 1-4).
  - Z X C or 1 2 3: white, green, red.
  - R: back to the checkpoint.
  - P / Esc: pause, with Options, Controls, Art and Credits.
  - Touch: the on-screen pads (◀ ▶, JUMP, DASH, the form cards).
- **Genre:** Platformer.
- **Tags (10):** stealth, pixel-art, heist, 2d, colorful, cute, singleplayer, short, keyboard, retro.
- **Release status:** Released. **Pricing:** No payments, or donations (*owner decision*). **Visibility:** Restricted for the draft test, then Public after approval.
- **AI disclosure (owner decision, plan section 3.4):** recommended "yes", ticking **Code** and **Text & Dialog**. Do not tick Graphics: the art is Vitor Farias's original pixel art. The in-game Credits already say "Developed with AI assistance (Claude Code)". If the owner answers otherwise, remove that line from `index.html`.
- **Cover (630×500) candidates,** cut from real captures of the packaged build. They are local and gitignored, in `artifacts/itch/`:
  - `cover-a-title-logo-630x500.png`: the original title logo over the forest, at 3× from `title_screen.png`.
  - `cover-b-stomp-630x500.png`: 1-2, with white Rubik leaping over a stunned card and two awake cards on posts above the water.
- **Screenshots (3–5),** real 960×540 frames of the packaged build in `artifacts/itch/`, with no debug overlay:
  1. `01-title.png`: the title, with the `v1.0` label.
  2. `02-stomp-1-2.png`: the stomp lesson over the water.
  3. `03-lookouts-1-5.png`: green Rubik on a green card's head, a red card's cone below, and the triangle and diamond badges.
  4. `04-vault-1-6.png`: the vault and its red guard's cone.
  5. `05-result-stamps.png`: the 1-5 clear with the Ghost and Takedown stamps.
  - Spare: `06-world-map.png`.
  - Regenerate them from `dist/itch/` after any visual change.

## Owner checklist before publishing (not run by the squad)

- [ ] Verify or keep withholding the Pink Monster pack (`itch.json` `withhold`).
- [ ] Confirm the authorship and licence of `assets/track.mp3`. The Credits call it "the original jam track", and no author is recorded in the original repository. Also confirm what `assets/SOURCE-LICENSE.txt` (MIT, "nklbdev", copied from the original repository's root) covers.
- [ ] Approve this page copy, a cover and the screenshots; decide the AI disclosure and the pricing.
- [ ] Upload the RC ZIP as a Restricted draft and run the plan's section 5 checklist, CRH part, on rows D1–D7. Include the colour check with DevTools → Rendering → Emulate vision deficiencies, and the Slow spotting and Less motion toggles.
- [ ] Turn on Mobile friendly (landscape) only after a physical phone passes.
- [ ] The lead tags `v1.0.0` only after approval.

Further references: `../common/docs/V1_RELEASE_PLAN.md`, validation evidence in `../common/docs/VALIDATION.md`, and shared continuity in `../common/SHARED_MEMORY.md`. These are optional when copying this project elsewhere. Official upload reference: https://itch.io/docs/creators/html5
