/** Stage 1 "Green Forest": authored map data for Color Rush Heist.
 *
 * Scale: ONE pixel grid. 1 tile = 32 world px = one original 16 px Tileset.png
 * cell drawn at 2x, exactly like Rubik (32 px frames -> 64 px), the cards and
 * the vault. The 960x540 view is 2x the original 480x270 window, so a screen
 * shows the same 30 x 16.9 cells the Godot game showed.
 *
 * The macro shape is bootstrapped from the original scenes/level_green.tscn (workspace: ../refs/color-theft-story/scenes/) (decoded
 * PackedInt32Array triplets: (y<<16)|x, source|(atlasX<<16), atlasY): a tall
 * home wall on the left, flats and pits, floating ledges, a staircase and a
 * vault against a tall end wall. It is trimmed from 281 to 200 columns and
 * re-authored beat by beat (RESEARCH.md section 9).
 *
 * Geometry rules (physics in model.mjs): a full jump rises ~95 px, so ledges any
 * form can reach are <=2 tiles; white-only ledges are 4 (5 for mastery); never 3
 * (96 px is 1 px out of reach and feels broken). Card bodies are 84 px tall:
 * a 3-tile corridor fits a card but not Rubik's jump over it.
 *
 * Map legend:  #  solid ground (auto-tiled)   =  one-way ledge (land from above)
 *              ~  water (pit hazard)          .  air
 * Background layer: b = darkened back wall (the original tilemap_no_col idea).
 */
export const TILE = 32;
export const COLS = 208;
export const ROWS = 22;
export const WATER_ROW = 20; // water surface: y = 640

function makeGrid(fillChar) {
  return Array.from({ length: ROWS }, () => Array(COLS).fill(fillChar));
}

function build() {
  const map = makeGrid("."),
    backGrid = makeGrid(".");
  const fill = (x0, x1, y0, y1, ch = "#", grid = map) => {
    for (let y = y0; y <= y1; y++)
      for (let x = x0; x <= x1; x++) grid[y][x] = ch;
  };
  const ground = (x0, x1, top) => fill(x0, x1, top, ROWS - 1);
  const ledge = (x0, x1, y) => fill(x0, x1, y, y, "=");
  const water = (x0, x1) => fill(x0, x1, WATER_ROW, ROWS - 1, "~");
  const back = (x0, x1, y0, y1) => fill(x0, x1, y0, y1, "b", backGrid);

  // --- A. Home and first steps (introduce: move, jump, safe ditch) ---------
  fill(0, 2, 0, ROWS - 1); // the original tall start wall
  ground(3, 12, 12); // home cliff: spawn, and the finish line after the theft
  ground(13, 17, 14); // 2-tile drop (climbable by every form on the way back)
  ground(18, 23, 15); // 1-tile drop
  ground(24, 29, 14); // 1-tile step up: the first jump (6 wide: a running jump lands on it)
  ground(30, 32, 16); // 4-tile ditch, floor only 2 tiles down: safe failure
  ground(33, 33, 15); // walk-out step inside the ditch
  ground(34, 41, 14); // run-up whose end overhangs the sleeping card
  // A rock overhang over the last 4 tiles of the run-up and the drop: 2 tiles
  // of headroom, so no jump near the edge can sail over the dozing card, and
  // 6 tiles tall, so even white's double jump can't hop onto it. Every way off
  // the edge (walk, run, jump, coyote jump) falls onto the card's head.
  fill(38, 47, 6, 11);
  // --- B. The sleeping card (develop/twist: stomp -> absorb green) ---------
  // The ledge above is 4 tiles over this clearing, so the card's head (84 px)
  // sits 44 px below the ledge: simply walking off lands on it.
  ground(42, 55, 18);
  // --- C. Disguise corridor (conclude: green walks among green cards) -----
  ground(56, 90, 18);
  fill(56, 88, 12, 14); // low canopy: 3-tile clearance, no jumping over cards
  back(57, 87, 15, 17); // dark interior behind the corridor
  // Roof route (escape only): blocked inbound by a 2-stone stack on its right
  // end (see STONES). Sticker #3 is visible from the corridor below.
  // --- D. White again (twist: 4-tile ledge, first "?", mid-air swap) ------
  ground(91, 104, 14); // white-only: green's 95 px jump cannot reach 128 px
  ledge(98, 101, 9); // swap alcove 5 tiles up: green jump + white air jump
  ground(105, 112, 16);
  // --- E. Canopy gaps (introduce dash) -------------------------------------
  water(113, 118); // gap A: 10 tiles, x 113..122
  fill(119, 122, 18, ROWS - 1); // recovery rock 2 tiles down: a slow, safe line
  ground(123, 126, 16);
  water(127, 142); // 16-tile water stretch: jump, dash, refill orb, dash
  // --- F. Enforcer post (develop/twist: red sentry sees green) ------------
  ground(143, 165, 16);
  fill(147, 148, 14, 15); // step up to the perch
  ledge(149, 152, 12); // perch above the enforcer's cone
  ledge(159, 162, 12); // perch behind it (sticker #6)
  // --- G. Vault steps and chamber (conclude) -------------------------------
  ground(166, 169, 14);
  ground(170, 172, 12);
  ground(173, 175, 10);
  ground(176, 202, 8); // landing and a wide chamber floor (22 tiles)
  fill(181, 202, 1, 2); // chamber ceiling: 5-tile room, room to stomp
  back(181, 202, 3, 7);
  fill(203, COLS - 1, 0, ROWS - 1); // tall end wall
  fill(203, 204, 6, 7, "."); // alcove in the end wall (sticker #7)
  back(203, 204, 6, 7);
  return {
    map: map.map((row) => row.join("")),
    back: backGrid.map((row) => row.join("")),
  };
}

const built = build();
/** Row strings, one char per tile; frozen so the model can't mutate geometry. */
export const MAP = Object.freeze(built.map);
export const BACK = Object.freeze(built.back);

const px = (tiles) => tiles * TILE;

/** Sealed stones: 2x2-tile blocks drawn with Tile_15's art (atlas cells 8..9 x
 * 2..3). Solid until a RED dash hits them. Inbound they are visible but inert:
 * foreshadowing, never a wall that red is needed to pass before the theft. */
export const STONES = Object.freeze([
  // Roof-route gate: two stacked so white's 176 px double jump can't hop it.
  { id: "roof-low", x: 87, y: 10 },
  { id: "roof-high", x: 87, y: 8 },
  // Mid-roof gate with sticker #8 sealed between it and the low gate.
  { id: "roof-mid", x: 79, y: 10 },
  // Vault alcove (sticker #7) in the end wall.
  { id: "alcove", x: 201, y: 6 },
]);

/** Cards. x = body centre (px), floor = feet y (px). dir -1 faces left.
 * Patrol bounds (min/max) also bound charges, so cards never walk off ledges.
 * kind green sees white/red; kind red (enforcer, unused inimigo3 sheet) sees
 * white/green. Rule shown to players: a card can't see its own color. */
export const GUARDS = Object.freeze([
  // The dozing first card: faces away, cone dim, never detects while asleep.
  // catch: its stomp head is 24 px wider each side (not 10): together with the
  // overhang, every walk/run/jump off the edge lands on it (tested).
  { id: "sleeper", kind: "green", mode: "sleep", x: 1420, floor: px(18), dir: 1, min: 1400, max: 1440, absorb: true, catch: 24 },
  // Disguise corridor patrols (100 px/s, turn at bounds after a 0.4 s look-back).
  { id: "corridor-a", kind: "green", mode: "patrol", x: 2100, floor: px(18), dir: -1, min: 1970, max: 2230 },
  { id: "corridor-b", kind: "green", mode: "patrol", x: 2480, floor: px(18), dir: 1, min: 2420, max: 2720 },
  // White-ledge lookout: faces away first, so its first "?" has room to retreat.
  { id: "ledge", kind: "green", mode: "patrol", x: 3150, floor: px(14), dir: 1, min: 3090, max: 3300 },
  // Enforcer post: stationary red sentry turning every 3 s.
  { id: "enforcer", kind: "red", mode: "sentry", x: 4976, floor: px(16), dir: -1, min: 4850, max: 5110, turnEvery: 3 },
  // Vault approach: a green patrol outside and a red sentry inside.
  { id: "landing", kind: "green", mode: "patrol", x: 5700, floor: px(8), dir: 1, min: 5650, max: 5770 },
  // Turns every 1.6 s (+0.4 s look-back): the wait on stair 3 is short.
  { id: "vault-guard", kind: "red", mode: "sentry", x: 5872, floor: px(8), dir: -1, min: 5830, max: 5960, turnEvery: 1.6 },
  // Behind the vault: asleep inbound, they wake and charge at the theft.
  { id: "burst-a", kind: "green", mode: "sleep", x: 6236, floor: px(8), dir: -1, min: 5800, max: 6260, wakeOnTheft: true },
  { id: "burst-b", kind: "green", mode: "sleep", x: 6380, floor: px(8), dir: -1, min: 5800, max: 6400, wakeOnTheft: true },
  // Escape only: absent inbound, it arrives at the theft on the little island
  // between Gap A and the water, so the way home is not a plain backtrack.
  { id: "ambush", kind: "green", mode: "patrol", x: 4000, floor: px(16), dir: 1, min: 3956, max: 4044, escapeOnly: true },
]);

/** Nine lost stickers (Rubik's own yellow face). Permanent once taken. */
export const STICKERS = Object.freeze([
  { id: 1, x: 1066, y: 344, note: "ditch arc (main line)" },
  { id: 2, x: 1476, y: 412, note: "sleeping-card bounce, under the overhang (main line)" },
  { id: 3, x: 2290, y: 352, note: "corridor roof: seen now, reached in the escape" },
  { id: 4, x: 3200, y: 256, note: "swap alcove: green jump + white air jump" },
  { id: 5, x: 4470, y: 394, note: "refill line over the water (main line)" },
  { id: 6, x: 5150, y: 350, note: "perch behind the enforcer" },
  { id: 7, x: 6528, y: 224, note: "vault alcove behind a stone (escape only)" },
  { id: 8, x: 2648, y: 350, note: "roof route between stones (escape only)" },
  { id: 9, x: 800, y: 200, note: "home sky: white double jump + dash (mastery)" },
]);

/** Dash refill orbs (rubik_storm.png frames 1-3). Respawn 2.5 s after use. */
export const ORBS = Object.freeze([{ id: "water", x: 4330, y: 398 }]);

/** Checkpoints: chalk cube faces. <=35 s of first-play time apart, never more
 * than one new idea between two. hint = bubble re-offered after 3 deaths. */
export const CHECKPOINTS = Object.freeze([
  { id: "home", x: 176, floor: px(12), hint: "move" },
  { id: "clearing", x: 1540, floor: px(18), hint: "green" },
  { id: "descent", x: 3440, floor: px(16), hint: "dash" },
  { id: "post", x: 4650, floor: px(16), hint: "white" },
  // On stair 1: the enforcer's cone is cut by the stair's riser, so a respawn
  // here is never inside a sight cone (tests check every marker).
  { id: "stairs", x: 5376, floor: px(14), hint: "green" },
  // Saved automatically by the theft; respawn on stair 3, below every chamber
  // cone, facing home.
  { id: "vault", x: 5590, floor: px(10), hint: null, auto: true },
]);

export const SPAWN = Object.freeze({ x: 204, floor: px(12) });
/** The vault: cofre.png drawn at 4x (an even multiple of the 2x grid, so its
 * pixels stay square and aligned) on a carved dais, raised 24 px. */
export const VAULT = Object.freeze({ cx: 6064, floor: px(8) - 24, w: 92, h: 80 });
/** Reaching the home cliff top while carrying red ends the stage. */
export const HOME = Object.freeze({ x0: px(3), x1: px(13), floor: px(12) });

/** Hint zones (world px). Bubbles are offered at most once each (<=4 total). */
export const HINT_ZONES = Object.freeze({
  white: { x0: px(85), x1: px(91), floor: px(18), top: px(14) },
  dash: { x0: px(105), x1: px(123) },
});

// --------------------------------------------------------------- auto-tile --
const solidTile = (x, y) =>
  x < 0 || x >= COLS || y >= ROWS ? true : y < 0 ? false : MAP[y][x] === "#";
const cellHash = (x, y) => (((x * 73856093) ^ (y * 19349663)) >>> 0) % 997;
/** Atlas cell ([x, y] in 16 px Tileset.png cells) for a solid map tile, the way
 * level_green.tscn used the atlas: the 6x6 mossy block (cells 0..5) is a
 * nine-slice with interior variety, the inner frame (cells 7/10 x 1/4) gives
 * concave corners, and row 0 cells 12..17 is the thin floating slab. */
export function tileCell(x, y) {
  const N = solidTile(x, y - 1),
    S = solidTile(x, y + 1),
    W = solidTile(x - 1, y),
    E = solidTile(x + 1, y),
    h = cellHash(x, y),
    v = 1 + (h % 4),
    v2 = 1 + ((h >> 2) % 4);
  if (!N) {
    if (!S) return !W && !E ? [17, 8] : !W ? [12, 0] : !E ? [17, 0] : [13 + (h % 4), 0];
    return !W ? [0, 0] : !E ? [5, 0] : [v, 0];
  }
  if (!S) return !W ? [0, 5] : !E ? [5, 5] : [v, 5];
  if (!W) return [0, v2];
  if (!E) return [5, v2];
  if (!solidTile(x + 1, y - 1)) return [7, 4];
  if (!solidTile(x - 1, y - 1)) return [10, 4];
  if (!solidTile(x + 1, y + 1)) return [7, 1];
  if (!solidTile(x - 1, y + 1)) return [10, 1];
  return [v, v2];
}
/** One-way ledge cell: the floating slab's ends and middle. */
export function ledgeCell(x, y) {
  const left = MAP[y][x - 1] === "=",
    right = MAP[y][x + 1] === "=";
  return !left && !right ? [17, 8] : !left ? [12, 0] : !right ? [17, 0] : [13 + (cellHash(x, y) % 4), 0];
}
/** Back wall: interior cells (1..4 x 1..4), darkened by the renderer. */
export const backCell = (x, y) => [1 + (cellHash(x, y) % 4), 1 + ((cellHash(x, y) >> 2) % 4)];
/** Fixed atlas regions: Tile_15 is the sealed stone (and its debris); the
 * right column (cells 18..19 x 0..9, Tile_10/20/30/40/50) is five water frames. */
export const ATLAS = Object.freeze({ stone: [8, 2], waterColumn: 18, waterFrames: 5 });
/** Tile_NN.png files are pixel-identical 32x32 slices of Tileset.png (10x6
 * grid). Which slices actually appear on screen through the atlas? */
export function tilesOnScreen() {
  const used = new Set(),
    add = ([cx, cy]) => used.add(Math.floor(cy / 2) * 10 + Math.floor(cx / 2) + 1);
  for (let y = 0; y < ROWS; y++)
    for (let x = 0; x < COLS; x++) {
      if (MAP[y][x] === "#") add(tileCell(x, y));
      if (MAP[y][x] === "=") add(ledgeCell(x, y));
      if (BACK[y][x] === "b") add(backCell(x, y));
    }
  add(ATLAS.stone);
  for (let f = 0; f < ATLAS.waterFrames; f++) add([ATLAS.waterColumn, f * 2]);
  return [...used].sort((a, b) => a - b);
}
