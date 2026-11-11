/** The ending and the credits of Color Rush Heist, as DATA plus the pure timing
 * rules around it. No DOM, no drawing, no imports: tests/credits.test.mjs runs
 * it in Node, and ending-draw.mjs / game.mjs only read it.
 *
 * Two small "reels" play after the vault level, one page at a time:
 *   ENDING_PAGES  three closing comic pages (the colours come back)
 *   CREDITS       the credit cards (also played by the title's Credits button)
 * A page lasts `dur` seconds and then gives way to the next one by itself, so
 * nobody has to press anything. A fresh press moves on early, but never in the
 * first LOCKOUT seconds of a page (a reflex press from the level, or a double
 * tap, must not skip a page nobody has read), and a held key never counts
 * (auto-repeat arrives as `repeat: true`). Esc leaves the whole reel.
 *
 * EDIT THE CREDITS HERE. Every card names where its claims come from in
 * `source`: a line that no file in the workspace supports must not be added
 * (the owner's open questions are listed in ITCH_IO.md under CREDITS_TODO). */

/** Seconds a page ignores presses after it appears. */
export const LOCKOUT = 0.6;
/** Seconds one credit card stays up on its own. Calm: a card is 2 to 4 short
 * lines, read in about three seconds, then it lingers. */
export const CARD_SECONDS = 4.4;
/** The words' fade in and out, in seconds (four steps, see `fadeLevel`). */
export const SETTLE = 0.28;

/** The closing comic. Same voice as the original four panels ("Once there was
 * a rubik's cube that shone with all its colors. His name was Rubik."): a long
 * caption top left, an optional short one bottom right. Page 3 mirrors the
 * first panel on purpose.
 *   home    the forest is as dull as when the cards left it; only Rubik has red
 *   colors  a wave of colour spreads out from Rubik, tree by tree
 *   end     every colour is back, THE END, and the original game's own line
 * `teaser` is the one place a "next world" line can come back. It is null on
 * purpose: World 2 (Blue Mountains) is not built, and the owner wants the game
 * to end here (2026-11-10). */
export const ENDING = Object.freeze({
  teaser: null,
  pages: Object.freeze([
    Object.freeze({ id: "home", dur: 3.6, top: "Rubik ran all the way home with his red.", note: "He did it!" }),
    Object.freeze({ id: "colors", dur: 4.6, top: "...and the colors came back, one tree at a time.", note: "Welcome home!" }),
    Object.freeze({ id: "end", dur: 5.2, top: "Once again, Rubik shone with all his colors.", note: "" }),
  ]),
});
export const ENDING_PAGES = ENDING.pages;

/** The credit cards: { id, head, note?, lines, foot?, source }. `head` is the
 * big line, `note` a dim line over the names, `lines` the names (white), `foot`
 * a dim line under them. Text is monospace on a 6 art px pitch: a line may hold
 * at most MAX_LINE characters (the card is 300 art px wide). */
export const MAX_LINE = 44;
export const CREDITS = Object.freeze([
  Object.freeze({
    id: "game",
    head: "Color Rush Heist",
    note: "World 1: Green Forest",
    lines: [],
    source: "The game's own name (itch.json, README): a web remake of the original, built from its art.",
  }),
  Object.freeze({
    id: "original",
    head: "Color Theft Story",
    note: "the original game, made by",
    lines: ["Vitor Farias", "Cauê Melo (@cauesmelo)"],
    foot: "minigamejam 22, 2023",
    source:
      "refs/color-theft-story: its intro card reads 'Made by: Vitor Farias @cauesmelo' (assets/intro.jpeg) and its title art 'an awesome game made by: @cauesmelo @vitorf.png' (assets/title_screen.png); every commit is by Cauê Melo, dated 2023-09-30 to 2023-10-01; project.godot names it 'minigamejam-22'.",
  }),
  Object.freeze({
    id: "art",
    head: "Pixel art",
    lines: ["Vitor Farias"],
    source:
      "The owner's own credit (the pause menu's Art panel, 'Art by Vitor Farias'). The original cards only say 'made by' for both names, and the tileset's author is not recorded (ITCH_IO.md CREDITS_TODO).",
  }),
  Object.freeze({
    id: "sound",
    head: "Sound",
    lines: ["Music: the original game's track", "Effects: made in the browser"],
    source:
      "assets/track.mp3 is byte-identical to refs/color-theft-story/assets/track.mp3 and is the AudioStreamPlayer of its world.tscn; no tag or file names its composer, so none is named. The effects are Web Audio oscillators written for this version (game.mjs SOUNDS).",
  }),
  Object.freeze({
    id: "web",
    head: "Web version, 2026",
    lines: ["Built with AI assistance (Claude Code)", "Font: monogram by datagoblin (CC0)"],
    source:
      "The AI line is the plan's disclosure, already in the pause menu's Credits. The font is assets/font.ttf (family monogramextended); datagoblin's itch.io page lists monogram, with its extended version, as CC0 (checked 2026-11-10).",
  }),
  Object.freeze({
    id: "thanks",
    head: "Thanks for playing!",
    lines: [],
    foot: "Rubik says thanks.",
    source: "Closing line, no claim.",
  }),
]);

// ------------------------------------------------------------------- reels --
/** A reel is a plain object: { pages, index, start, done }. `start` is the
 * screen time (seconds) at which the current page appeared. All functions
 * return new objects. */
export const createReel = (pages) => ({ pages, index: 0, start: 0, done: false });
export const pageOf = (reel) => reel.pages[Math.min(reel.index, reel.pages.length - 1)];
export const pageAge = (reel, now) => Math.max(0, now - reel.start);
export const totalSeconds = (pages) => pages.reduce((sum, page) => sum + (page.dur ?? CARD_SECONDS), 0);
const durOf = (page) => page.dur ?? CARD_SECONDS;

/** Let time pass: a page whose time is up gives way to the next (carrying the
 * leftover time, so a late frame never stretches the reel). */
export function tick(reel, now) {
  let next = reel;
  while (!next.done && now - next.start >= durOf(pageOf(next))) next = advance(next, next.start + durOf(pageOf(next)));
  return next;
}
function advance(reel, at) {
  return reel.index + 1 >= reel.pages.length ? { ...reel, done: true, start: at } : { ...reel, index: reel.index + 1, start: at };
}
/** A press (a fresh key down, a click). Returns { reel, outcome }:
 *   "ignored"  an auto-repeat, inside the lockout, or already over
 *   "next"     moved on to the following page
 *   "done"     that was the last page, or Esc (leaves the whole reel) */
export function press(reel, now, { repeat = false, escape = false } = {}) {
  if (repeat || reel.done || pageAge(reel, now) < LOCKOUT) return { reel, outcome: "ignored" };
  if (escape) return { reel: { ...reel, done: true, start: now }, outcome: "done" };
  const next = advance(reel, now);
  return { reel: next, outcome: next.done ? "done" : "next" };
}

/** Everything a picture needs at screen time `now`. */
export function frameOf(reel, now) {
  const page = pageOf(reel),
    age = pageAge(reel, now),
    left = Math.max(0, durOf(page) - age);
  return { index: reel.index, count: reel.pages.length, page, age, left, canPress: age >= LOCKOUT && !reel.done, done: reel.done };
}

// ------------------------------------------------------------- the pictures --
/** How readable a card's words are: 0 (not drawn) to 3 (full), stepping up over
 * the first SETTLE seconds of a page and down over the last SETTLE. The picture
 * maps the levels to palette colours (void, stone, mist, white), so a fade is
 * four whole steps and never a blend. Reduced motion: always full. */
export function fadeLevel(age, left, { reduced = false } = {}) {
  if (reduced) return 3;
  const u = Math.min(1, age / SETTLE, left / SETTLE);
  return Math.max(0, Math.min(3, Math.floor(u * 4)));
}

/** Where Rubik stands for the three closing pages (art px; `wave` is the y the
 * colour spreads from, a little above his feet). */
export const HOME = Object.freeze({ x: 240, feet: 214, wave: 190 });

/** The colour wave of the "colors" page: the radius (art px) of the circle in
 * which the forest is back in colour, a whole multiple of WAVE_STEP so the
 * edge moves in blocks. It starts a beat after the page and reaches WAVE_MAX
 * (the farthest corner is about 310 away, plus the dithered band) at WAVE_END.
 * Reduced motion cuts: the colour is already back. */
export const WAVE_START = 0.5,
  WAVE_END = 3.4,
  WAVE_MAX = 352,
  WAVE_STEP = 4,
  WAVE_BAND = 36;
export function waveRadius(age, { reduced = false } = {}) {
  if (reduced) return WAVE_MAX;
  const u = Math.max(0, Math.min(1, (age - WAVE_START) / (WAVE_END - WAVE_START)));
  return u === 0 ? 0 : Math.floor((u * WAVE_MAX) / WAVE_STEP) * WAVE_STEP;
}

/** Rubik, green Rubik and white Rubik crossing the credits at a walking pace:
 * the left edge of the leader in art px at screen time t, a whole pixel. They
 * start off screen to the left and the leader is at x 336 when the last card
 * ends (about 26 s): they stop short of the title art's own credit in the
 * bottom right corner. Reduced motion: they stand still in the middle. */
export const PARADE_SPEED = 15, // art px per second
  PARADE_FROM = -60;
export const paradeX = (t, { reduced = false } = {}) => (reduced ? 270 : PARADE_FROM + Math.floor(t * PARADE_SPEED));
