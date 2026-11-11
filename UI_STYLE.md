# UI style: all of Color Rush Heist's interface is pixel art

Owner decision (2026-11-10): all of the art is pixel art, so the menus must be too.
Before this pass the HUD, panels, buttons, stamps, sticker slots, bubbles and
transitions were built from smooth vector shapes (rounded corners, soft
shadows, anti-aliased arcs, rotated squares, gradients, fades, a system font for
the arrows) and clashed with the art. Every pixel that is not the game world is
now drawn on the same grid, in the same palette, by the same code.

The rules below are enforced twice: `tests/pixel-ui.test.mjs` (in `npm test`)
guards the sources and the pure geometry, and `tests/pixel-audit.mjs` measures the
real pixels in Chrome. Read the limits at the end before relying on either.

## The grid

- The surface is **960 x 540** canvas px, exactly 2x the original 480 x 270 art.
  **One art pixel = 2 canvas px.** Sprites are drawn at 2x, so a pixel of Rubik, a
  tile or a title letter is a 2 x 2 block, and the UI is drawn in the same blocks.
- The browser shows the canvas at a **whole number of device pixels per canvas
  pixel** (`fitSurface()` in `game.mjs`): 1x on a 1280 x 720 window, 2 device px
  per canvas px on a 2x display (960 CSS px), 3x when the window holds it, with
  `image-rendering: pixelated`. A window that cannot hold 1x is fitted below it and
  the browser resamples nearest-neighbour (hard edges, uneven pixel sizes).
- In the DOM, `--ap` is one art pixel in CSS px (the surface width / 480; 2px for
  the 960 px game). **Every length in `style.css` is a whole number of `--ap`**, so
  borders, boxes and glyph rows land on the canvas grid. The pause card's height is
  snapped to an even number of art pixels in JS so it centres on the grid.
- UI drawing code takes **art-pixel coordinates** (`ui-draw.mjs`, `pixel-ui.mjs`).
  Anything anchored to the world (a bubble over a card, a popup) is converted from
  world canvas px and rounded to the 2 px grid; the world itself moves at 1 px
  (camera rounding), and was left alone.

## The palette

22 colours, all **already present in the art files** (a test checks each one
against every PNG in `assets/`). No UI-only shade was added, and no UI colour is
translucent.

| Token | Hex | From the art |
| --- | --- | --- |
| ink | `#000000` | the outline of Rubik and every card |
| void | `#25131a` | the Tileset's darkest plum: hard shadows, wells |
| plum | `#3d253b` | the Tileset's body: panel fields |
| mauve | `#523b40` | the Tileset: a button's face |
| slate / stone / fog / mist | `#323234` `#737375` `#999ca4` `#c9d2d4` | Rubik's four greys |
| white | `#ffffff` | Rubik's highlight |
| cream | `#f7fbe3` | the title screen: card rims, bubbles, chalk |
| gold / lemon | `#cbb540` `#f0f679` | the vault: stickers, focus, "on" accents |
| red / redDark / wine / rose | `#dc3232` `#a43131` `#82425d` `#ee7984` | the red card and Rubik |
| green / forest / lime | `#6abe30` `#2e7d37` `#b4e34f` | the green card and Rubik |
| blue / indigo / navy | `#639bff` `#5850ab` `#143464` | the storm swirl, the title |

The itch.io page green (`#168546`) is the page behind the game, not part of it.
The form colours as the UI paints them are `FORM` in `pixel-ui.mjs`: white forms
use mist, green and red their own. **Shape, not hue, tells the forms apart** (a
hollow square, a triangle, a diamond: on the cards, Rubik's badge, the touch pads),
and a heart that is empty is cracked as well as dark.

## Rules (what the code does, and the tests enforce)

1. **No rounded corners.** A corner is cut by one pixel (`Grid.notched`, the
   button and panel sprites). `border-radius` does not appear in any stylesheet.
2. **No blur, no soft shadow.** Every shadow is a hard offset of **+1,+1 art
   pixel in `void`**; text has a 1 font-pixel ink outline.
3. **No gradients.** A gradient is an ordered (Bayer 4x4) dither of palette pixels:
   dimmed backdrops, the title-to-grey drain, the forest regaining colour (on the
   map and in play), the hit flash, the vault glow, goal halo, pickups.
4. **No translucency, no blends.** `globalAlpha` and `rgba()` are not used by the UI.
   A fade is a dither or a blink of whole frames; a pop is a drop in 3-4 discrete
   steps.
5. **No fractional scaling or rotation.** Nothing is scaled except by whole art
   pixels. A tilted sticker is a **pre-rotated sprite** (`stickerSprite`, nearest
   neighbour from an upright source). The iris is a pixel-stepped zoom of the
   cut-out on a ladder of integer (or 1/integer) magnifications (`IRIS_LADDER`).
6. **No anti-aliased arcs.** Circles, rings and ellipses are pixel spans
   (`discSpans`, `ringPixels`, `Grid.ellipse/ellipseRing`); lines are Bresenham.
7. **Text is on the grid.** monogram is a 5 x 7 font on a 6 px pitch. It is baked
   into bitmaps at 32 px (every font pixel an exact 2 x 2 block, a ~14% alpha
   fringe thresholded away) and drawn as sprites: **S** = one font pixel is one
   art pixel (the body size) and **L** = two (headings). There is no 16 px text and
   no 48 px text; the old half-size and 1.5x sizes were off the grid. In the DOM the
   font is `16 --ap` (S) or `32 --ap` (L), with line heights chosen so a glyph's
   baseline falls on a whole art pixel (S: odd count of `--ap`; L: even).
8. **Motion is stepped.** Positions change by whole art pixels; easing is
   `stepped()`; CSS has no `transition` or `animation` except `none` (reduced motion).
9. **Icons are sprites.** The music note, pause bars, expand corners, arrows,
   ghost, stomp and chain icons are row tables baked by the kit (the fallback-font
   glyphs the buttons used before are gone).
10. **Keyboard focus is a pixel frame:** 2 art px of lemon over 1 of ink, square,
    on every control (and a lemon inset frame on the title's "press any key").

## The ending and the credits (added 2026-11-10)

Both follow the rules above and are painted by `ending-draw.mjs` from the data in `credits.mjs`:

- **Comic captions** (the closing pages): a flat cream box in a 1 px ink outline, ink text at S, on art-pixel
  coordinates, as the original panels carry theirs. No notch, no shadow.
- **The colour wave**: the title picture shown through an ordered-dither mask (the 4 x 4 Bayer matrix over a
  36 art px band, a whole step of 4 art px at a time), over the dull forest. Pixels switch between two textures;
  nothing blends.
- **The credits plate**: one `paintCard` (cream rim, plum field, hard shadow), 280 x 130 art px, standing where the
  title's logo is. Its words fade in and out in **four steps** through palette colours (void, stone, mist or fog,
  white or cream), never alpha; progress pips (4 x 4 art px squares, the current one lemon) sit under them.
- **The hint** ("any key or click: next   Esc: skip", or "tap: next" on a touch screen) is S text in cream with the ink outline, top right, shown once a press
  would count.
- **Rubik** (the three forms, hopping on the last page, walking in the credits) is the world's own sprite with a
  hard `void` ellipse for a shadow, as on the other screens.
- **The title's Credits button** is a DOM `.title-btn`: the menu button sprite (`--spr-btn`, hover and pressed
  variants), S text, 54 x 19 art px, on the same baseline as the `v1.0` label; focus is the usual pixel frame.
- **The title picture, reused**: `title_screen.png` with its baked "PRESS ANY KEY TO START" line lifted out
  once at runtime (a derived canvas; the strip's text pixels take the colour of the pixel 18 rows lower in the
  same column). The file is untouched. Its own corner credit ("an awesome game made by ...") stays, and the
  parade stops short of it.

## Where things live

| File | Role |
| --- | --- |
| `pixel-ui.mjs` | Palette, geometry (pure, tested), `Grid` painter, sprite bake, bitmap text, panel/plate/bubble/key/button/heart/sticker/seal painters, dither scrim, pixel iris, CSS sprite export |
| `ui-draw.mjs` | Every screen and HUD element (state in, pixels out): HUD, hearts, chain, hints, awareness bubbles, popups, level/GET/REVERSE cards, results, world clear, map, flashes |
| `ending-draw.mjs`, `credits.mjs` | The three closing pages and the credit cards: drawing (same kit, same rules, scanned by the same source test) and data/timing (pure, no imports) |
| `style.css`, `embed.css`, `gallery.css` | DOM overlays in `--ap` units; sprites are CSS custom properties (`--spr-*`) baked at boot by `installCss()` |
| `game.mjs` | State, input, audio and the world; reads UI state into `createUiDraw(env)` |
| `tests/pixel-ui.test.mjs` | Palette = art, CSS and source rules, geometry |
| `tests/pixel-audit.mjs`, `tests/pixel-sheet.mjs`, `tests/itch-shots.mjs` | The Chrome audit, before/after contact sheets, the itch screenshots |

The model, campaign, levels and loop never import the UI modules (tested).

## The audit (`npm run audit:pixels`)

Drives the real game in Chrome through 30 screens and states (boot, title, comic,
iris, map x3, every pause/map-menu panel, HUD x4, bubbles, pause, level card,
GET, REVERSE, getaway, hit flash, results x3, world clear, the three ending pages,
the credit cards (at rest, part way through a fade), three focus states), at
device-pixel ratio 1 and 2, on a deterministic page clock, and
measures UI regions of each screenshot:

- **off-palette**: pixels that are neither a palette colour, an original art
  colour, nor a derived world colour (the colorized forest and sky, darkened
  tiles, the backdrop's time-of-day tints, read from `__game.worldColours()`);
- **intermediate**: off-palette pixels that also lie between two neighbours'
  colours (anti-aliasing, blends, soft shadows);
- **grid**: 2 x 2 art-pixel blocks of an opaque UI plate that are not one colour
  (rotation, arcs, half-size text, odd offsets, fractional scaling).

A run passes when every region has none. The same rectangles judge the old and the
new UI.

## Limits (honest list)

- **The world is not UI.** The original art, the derived textures, Rubik's and
  the cards' sprite transforms (squash, spin, blink), the sight cones (the
  original gradient art), the per-level time-of-day multiply on the backdrop and
  the colour composites are untouched, and the audit allows their colours. The
  few code-drawn world bits that used gradients or blends (chalk faces, glows,
  cracks, water, particles, the charger's cap) were converted to
  palette pixels. `tests/pixel-ui.test.mjs` pins the functions in `game.mjs` that
  still use a non-pixel call to exactly that list.
- **The credits' jam title card** (`intro.jpeg`, an original JPEG) is shown
  decimated by 4 (60 x 34 art px: a whole factor, 2 on a 2x display) in a pixel
  frame; its colours are its own and the audit masks it out.
- **Windows below 1x** and phones: the browser resamples (nearest neighbour). Phones
  are out of scope (owner decision); the touch pads keep working and wear the same
  sprites, and are not audited.
- **Surfaces of 3x and more** (a window of 2880 x 1620 CSS px at DPR 1, or a
  4K fullscreen): the canvas UI and the DOM's body text stay crisp, but the browser's
  rasteriser leaves a faint edge on the DOM's large headings ("Paused", "Options").
  Measured at 1x and 2x (and 2x on a DPR 1 window of 2000 x 1200: 0 stray pixels in
  3.1 M), not at 3x.
- **Sub-pixel layout**: the CSS relies on the browser placing boxes on the device
  grid; at a display scale that is not a whole number of device pixels per art
  pixel the DOM text could blur. The audit covers DPR 1 and 2 only.
- The audit checks colours and block structure, not taste: read the contact sheets
  in `common/artifacts/revision-5/crh-pixel-ui/`.
