/** Level builder and auto-tiler shared by every World 1 level.
 *
 * Scale: ONE pixel grid. 1 tile = 32 world px = one original 16 px Tileset.png
 * cell drawn at 2x, exactly like Rubik (32 px frames -> 64 px), the cards and
 * the vault. The 960x540 view is 2x the original 480x270 window, so a screen
 * shows the same 30 x 16.9 cells the Godot game showed.
 *
 * Every level is 22 rows tall (704 px); water surfaces at row 20 everywhere so
 * the camera and the water drawing never need per-level rules. Rows count from
 * the top; most floors sit on rows 14-18.
 *
 * Geometry rules (physics in model.mjs, measured in tests/model.test.mjs): a
 * held jump rises ~95 px, so ledges any form can reach are <=2 tiles; never 3
 * (96 px is 1 px out of reach and feels broken); white's double jump reaches
 * 4-tile ledges (5 only on mastery lines); bounce + white air jump reaches the
 * 8-tile ledges of 1-2. A card is 84 px tall: a 3-tile corridor fits a card but
 * not Rubik's jump over it.
 *
 * Map legend:  #  solid ground (auto-tiled)   =  one-way ledge (land from above)
 *              ~  water (pit hazard)          .  air
 * Background layer: b = darkened back wall (the original tilemap_no_col idea).
 */
export const TILE = 32;
export const ROWS = 22;
export const WATER_ROW = 20; // water surface: y = 640
export const px = (tiles) => tiles * TILE;

const deepFreeze = (value) => {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const key of Object.keys(value)) deepFreeze(value[key]);
  }
  return value;
};

/** Build one level from its spec. `build(api)` draws the map with the same
 * fill/ground/ledge/water/back calls the Stage 1 builder used; everything else
 * is plain data. The result is deep-frozen so the model can't mutate it. */
export function defineLevel(spec) {
  const cols = spec.cols,
    grid = (ch) => Array.from({ length: ROWS }, () => Array(cols).fill(ch)),
    map = grid("."),
    backGrid = grid(".");
  const fill = (x0, x1, y0, y1, ch = "#", target = map) => {
    for (let y = Math.max(0, y0); y <= Math.min(ROWS - 1, y1); y++)
      for (let x = Math.max(0, x0); x <= Math.min(cols - 1, x1); x++) target[y][x] = ch;
  };
  const api = {
    cols,
    fill,
    clear: (x0, x1, y0, y1) => fill(x0, x1, y0, y1, "."),
    ground: (x0, x1, top) => fill(x0, x1, top, ROWS - 1),
    ledge: (x0, x1, y) => fill(x0, x1, y, y, "="),
    water: (x0, x1) => fill(x0, x1, WATER_ROW, ROWS - 1, "~"),
    back: (x0, x1, y0, y1) => fill(x0, x1, y0, y1, "b", backGrid),
  };
  spec.build(api);
  const level = {
    world: 1,
    stones: [],
    guards: [],
    orbs: [],
    pickups: [],
    hints: [],
    hintZones: {},
    goal: null,
    vault: null,
    home: null,
    par: null,
    ...spec,
    rows: ROWS,
    width: cols * TILE,
    height: ROWS * TILE,
    map: map.map((row) => row.join("")),
    back: backGrid.map((row) => row.join("")),
  };
  delete level.build;
  return deepFreeze(level);
}

// --------------------------------------------------------------- auto-tile --
const cellHash = (x, y) => (((x * 73856093) ^ (y * 19349663)) >>> 0) % 997;
/** Out-of-bounds columns count as solid so the level edges read as walls. */
export function solidTile(level, x, y) {
  return x < 0 || x >= level.cols || y >= ROWS ? true : y < 0 ? false : level.map[y][x] === "#";
}
/** Atlas cell ([x, y] in 16 px Tileset.png cells) for a solid map tile, the way
 * level_green.tscn used the atlas: the 6x6 mossy block (cells 0..5) is a
 * nine-slice with interior variety, the inner frame (cells 7/10 x 1/4) gives
 * concave corners, and row 0 cells 12..17 is the thin floating slab. */
export function tileCell(level, x, y) {
  const solid = (dx, dy) => solidTile(level, x + dx, y + dy),
    N = solid(0, -1),
    S = solid(0, 1),
    W = solid(-1, 0),
    E = solid(1, 0),
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
  if (!solid(1, -1)) return [7, 4];
  if (!solid(-1, -1)) return [10, 4];
  if (!solid(1, 1)) return [7, 1];
  if (!solid(-1, 1)) return [10, 1];
  return [v, v2];
}
/** One-way ledge cell: the floating slab's ends and middle. */
export function ledgeCell(level, x, y) {
  const left = level.map[y][x - 1] === "=",
    right = level.map[y][x + 1] === "=";
  return !left && !right ? [17, 8] : !left ? [12, 0] : !right ? [17, 0] : [13 + (cellHash(x, y) % 4), 0];
}
/** Back wall: interior cells (1..4 x 1..4), darkened by the renderer. */
export const backCell = (x, y) => [1 + (cellHash(x, y) % 4), 1 + ((cellHash(x, y) >> 2) % 4)];
/** Fixed atlas regions: Tile_15 is the sealed stone (and its debris); the
 * right column (cells 18..19 x 0..9, Tile_10/20/30/40/50) is five water frames;
 * cells 8..9 x 6..9 are the pillar strip beside the vault. */
export const ATLAS = Object.freeze({ stone: [8, 2], waterColumn: 18, waterFrames: 5, pillar: [8, 6] });
/** Tile_NN.png files are pixel-identical 32x32 slices of Tileset.png (10x6
 * grid). Which slices actually appear on screen through the atlas, over all
 * given levels (the map's slab path and vault pillars included)? */
export function tilesOnScreen(levels) {
  const used = new Set(),
    add = ([cx, cy]) => used.add(Math.floor(cy / 2) * 10 + Math.floor(cx / 2) + 1);
  for (const level of levels)
    for (let y = 0; y < ROWS; y++)
      for (let x = 0; x < level.cols; x++) {
        if (level.map[y][x] === "#") add(tileCell(level, x, y));
        if (level.map[y][x] === "=") add(ledgeCell(level, x, y));
        if (level.back[y][x] === "b") add(backCell(x, y));
      }
  add(ATLAS.stone);
  for (let f = 0; f < ATLAS.waterFrames; f++) add([ATLAS.waterColumn, f * 2]);
  // The world map's path and the vault dais use slab cells 12..17 x 0 (Tile 7-9,
  // already counted by ledges) and the vault pillars use cells 8..9 x 6..9.
  for (let cx = 12; cx <= 17; cx++) add([cx, 0]);
  for (let cy = 6; cy <= 9; cy++) add([ATLAS.pillar[0], cy]);
  return [...used].sort((a, b) => a - b);
}
