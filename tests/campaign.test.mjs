import test from "node:test";
import assert from "node:assert/strict";
import * as C from "../campaign.mjs";
import * as M from "../model.mjs";
import { ROUTES } from "./routes.mjs";
import { getLevel } from "../levels/index.mjs";

/** In-memory localStorage stand-in, plus one that throws on every call
 * (private windows / sandboxed iframes). */
function memoryStorage() {
  const data = new Map();
  return {
    getItem: (k) => (data.has(k) ? data.get(k) : null),
    setItem: (k, v) => data.set(k, String(v)),
    removeItem: (k) => data.delete(k),
    data,
  };
}
const throwing = {
  getItem() {
    throw new Error("SecurityError");
  },
  setItem() {
    throw new Error("QuotaExceededError");
  },
  removeItem() {
    throw new Error("SecurityError");
  },
};
/** Play a level's route and turn the win into a clear record. */
function clearWith(save, id, kind = "baseline") {
  const g = M.startGame(M.createGame(id, C.gameOptions(save, id)));
  for (const [s, input] of ROUTES[id][kind]) M.advance(g, s, input);
  assert.equal(g.phase, "won");
  return C.recordClear(save, id, {
    time: g.finishTime,
    stickers: g.stickers.filter((x) => x.collected).map((x) => x.id),
    spotted: g.spotted,
    chain: g.medals.chain,
    escapeTime: g.escapeTime,
    color: g.player.color,
  });
}

test("a new save: only 1-1 open, nothing collected, the comic not yet seen", () => {
  const save = C.newSave();
  assert.deepEqual(save, {
    v: 2,
    last: "1-1",
    comicSeen: false,
    migratedFrom: null,
    hints: {},
    levels: {},
    settings: { sfx: true, music: true, timer: false, slowSpotting: false, reduceMotion: null },
  });
  assert.equal(C.SAVE_KEY, "color-rush-heist:v2:save", "versioned and game-prefixed (itch serves many games from one origin)");
  assert.deepEqual(C.unlockedIds(save), ["1-1"]);
  assert.equal(C.stickerTotal(save), 0);
  assert.equal(C.TOTAL_STICKERS, 18);
  assert.equal(C.forestColor(save), 0);
  assert.equal(C.worldClear(save), false);
});
test("map unlock order is linear: each clear opens exactly the next node", () => {
  let save = C.newSave();
  for (let i = 0; i < C.WORLD1.length; i++) {
    const id = C.WORLD1[i];
    assert.deepEqual(C.unlockedIds(save), C.WORLD1.slice(0, i + 1), `before ${id}`);
    for (const later of C.WORLD1.slice(i + 1)) assert.equal(C.isUnlocked(save, later), false, `${later} locked`);
    save = clearWith(save, id);
    assert.equal(save.last, C.nextLevel(id) || id, "the map cursor moves on");
  }
  assert.equal(C.worldClear(save), true);
  assert.equal(C.forestColor(save), 1, "World clear colors the whole map");
  assert.equal(C.nextLevel("1-6"), null);
  // Replaying an earlier level never re-locks anything.
  save = clearWith(save, "1-1");
  assert.equal(C.unlockedIds(save).length, 6);
});
test("forest color: 0.12 per cleared level 1-1..1-5, then full at 1-6", () => {
  let save = C.newSave();
  for (let i = 0; i < 5; i++) {
    save = clearWith(save, C.WORLD1[i]);
    assert.ok(Math.abs(C.forestColor(save) - 0.12 * (i + 1)) < 1e-9);
  }
  save = clearWith(save, "1-6");
  assert.equal(C.forestColor(save), 1);
});
test("stickers are permanent and accumulate: saved on touch, kept by a later worse run", () => {
  let save = C.collectSticker(C.newSave(), "1-1", 3);
  assert.deepEqual(C.levelRecord(save, "1-1").stickers, [3]);
  assert.deepEqual(C.levelRecord(C.collectSticker(save, "1-1", 3), "1-1").stickers, [3], "never counted twice");
  assert.equal(C.collectSticker(save, "1-1", 7), save, "unknown sticker ignored");
  save = clearWith(save, "1-1"); // baseline: only sticker 1
  assert.deepEqual(C.levelRecord(save, "1-1").stickers, [1, 3], "union, never a loss");
  save = clearWith(save, "1-1", "mastery");
  assert.deepEqual(C.levelRecord(save, "1-1").stickers, [1, 2, 3]);
  // The save's stickers are handed back to the model as "owned" outlines.
  const g = M.createGame("1-1", C.gameOptions(save, "1-1"));
  assert.ok(g.stickers.every((s) => s.owned && !s.collected));
});
test("full mastery of World 1 = 18/18 stickers, all three world medals", () => {
  let save = C.newSave();
  for (const id of C.WORLD1) save = clearWith(save, id, "mastery");
  assert.equal(C.stickerTotal(save), 18);
  const medals = C.worldMedals(save);
  assert.equal(medals.fullFace, true);
  assert.equal(medals.quickGetaway, true, "the mastery escape beats the par");
  assert.equal(medals.ghost, true, "every mastery route on a stealth level is unseen");
  // A spotted clear never takes a stamp back; a fresh save needs all three.
  const partial = clearWith(clearWith(C.newSave(), "1-3"), "1-5");
  assert.equal(C.worldMedals(partial).ghost, false, "1-6 not yet unseen");
});
test("stamps: Ghost (saved as unseen) on 1-3, 1-5, 1-6; Takedown on 1-5, 1-6; Quick only on 1-6; Chain only on 1-2; best time only improves", () => {
  assert.deepEqual(
    C.WORLD1.map((id) => C.levelStamps(id)),
    [
      { unseen: false, takedown: false, quick: false, chain: false },
      { unseen: false, takedown: false, quick: false, chain: true },
      { unseen: true, takedown: false, quick: false, chain: false },
      { unseen: false, takedown: false, quick: false, chain: false },
      { unseen: true, takedown: true, quick: false, chain: false },
      { unseen: true, takedown: true, quick: true, chain: false },
    ],
  );
  let save = C.recordClear(C.newSave(), "1-3", { time: 50, stickers: [], spotted: 2, escapeTime: null });
  assert.equal(C.levelRecord(save, "1-3").unseen, false);
  save = C.recordClear(save, "1-3", { time: 70, stickers: [], spotted: 0, escapeTime: null });
  assert.equal(C.levelRecord(save, "1-3").unseen, true);
  assert.equal(C.levelRecord(save, "1-3").best, 50, "a slower clear keeps the best");
  save = C.recordClear(save, "1-3", { time: 40, stickers: [], spotted: 3, escapeTime: null });
  assert.equal(C.levelRecord(save, "1-3").best, 40);
  assert.equal(C.levelRecord(save, "1-3").unseen, true, "a stamp is never taken back");
  const fast = C.recordClear(C.newSave(), "1-6", { time: 30, stickers: [], spotted: 0, escapeTime: 10 });
  const slow = C.recordClear(C.newSave(), "1-6", { time: 30, stickers: [], spotted: 0, escapeTime: 40 });
  assert.equal(C.levelRecord(fast, "1-6").quick, true);
  assert.equal(C.levelRecord(slow, "1-6").quick, false);
});
test("Takedown: the best tally is saved and only improves; the stamp needs every card, and a hostile tally is clamped", () => {
  const cards = getLevel("1-5").guards.length;
  let save = C.recordClear(C.newSave(), "1-5", { time: 30, stickers: [], spotted: 1, takedowns: 4, cards, escapeTime: null });
  assert.deepEqual([C.levelRecord(save, "1-5").takedownBest, C.levelRecord(save, "1-5").takedown], [4, false]);
  save = C.recordClear(save, "1-5", { time: 30, stickers: [], spotted: 0, takedowns: 2, cards, escapeTime: null });
  assert.equal(C.levelRecord(save, "1-5").takedownBest, 4, "a lower tally keeps the best");
  save = C.recordClear(save, "1-5", { time: 30, stickers: [], spotted: 3, takedowns: cards, cards, escapeTime: null });
  assert.deepEqual([C.levelRecord(save, "1-5").takedownBest, C.levelRecord(save, "1-5").takedown], [cards, true]);
  // 1-3 awards no Takedown (its corridor card can't be reached from above).
  const three = C.recordClear(C.newSave(), "1-3", { time: 30, stickers: [], spotted: 0, takedowns: 9, cards: 9, escapeTime: null });
  assert.deepEqual([C.levelRecord(three, "1-3").takedown, C.levelRecord(three, "1-3").takedownBest], [false, 0]);
  const hostile = C.sanitize({ v: 1, levels: { "1-5": { clear: true, takedown: "yes", takedownBest: 99 }, "1-6": { takedownBest: 2.5 } } });
  assert.deepEqual([hostile.levels["1-5"].takedown, hostile.levels["1-5"].takedownBest, hostile.levels["1-6"].takedownBest], [false, cards, 0]);
});
test("GET moments by level and the fixed kits the map hands to each level", () => {
  assert.deepEqual(C.WORLD1.map((id) => C.getsIn(id)), [[], ["green"], [], ["dash"], [], ["red"]]);
  assert.deepEqual(C.kitFor("1-1").forms, ["white"]);
  assert.equal(C.kitFor("1-4").dash, false, "1-4 starts without dash: the swirl gives it");
  assert.equal(C.kitFor("1-5").dash, true);
  assert.equal(C.kitFor("nope"), null);
});
test("hint budget is saved per player: done beats shown beats pending", () => {
  let save = C.mergeHints(C.newSave(), { move: "shown", airjump: "pending" });
  assert.deepEqual(save.hints, { move: "shown" });
  save = C.mergeHints(save, { move: "done", white: "shown" });
  assert.deepEqual(save.hints, { move: "done", white: "shown" });
  save = C.mergeHints(save, { move: "pending", white: "pending" });
  assert.deepEqual(save.hints, { move: "done", white: "shown" }, "never downgraded");
  const g = M.createGame("1-1", C.gameOptions(save, "1-1"));
  assert.equal(g.hints.move, "done");
});
test("save / load / reset round-trip through storage", () => {
  const storage = memoryStorage();
  let save = clearWith(C.newSave(), "1-1", "mastery");
  save = { ...save, comicSeen: true };
  assert.equal(C.writeSave(storage, save), true);
  assert.ok(storage.data.has(C.SAVE_KEY));
  assert.deepEqual(C.loadSave(storage), save);
  // Reset erases progress but keeps the player's settings, and is written.
  const settings = { ...C.defaultSettings(), music: false, slowSpotting: true };
  const reset = C.resetSave(storage, settings);
  assert.deepEqual(reset, C.newSave(settings));
  assert.deepEqual(C.loadSave(storage), C.newSave(settings));
  assert.deepEqual(C.loadSave(storage).levels, {});
});
test("storage that throws never breaks the game: load gives a fresh save, write and reset just return", () => {
  assert.deepEqual(C.loadSave(throwing), C.newSave());
  assert.equal(C.writeSave(throwing, C.newSave()), false);
  assert.deepEqual(C.resetSave(throwing), C.newSave());
  assert.deepEqual(C.loadSave(null), C.newSave());
  assert.deepEqual(C.loadSave(undefined), C.newSave());
});
test("corrupt or hostile saves are sanitized, never trusted", () => {
  const storage = memoryStorage();
  storage.setItem(C.SAVE_KEY, "{not json");
  assert.deepEqual(C.loadSave(storage), C.newSave());
  storage.setItem(C.SAVE_KEY, JSON.stringify({ v: 99, levels: { "1-1": { clear: true } } }));
  assert.deepEqual(C.loadSave(storage), C.newSave(), "unknown version");
  storage.setItem(
    C.SAVE_KEY,
    JSON.stringify({
      v: 1,
      last: "9-9",
      comicSeen: "yes",
      hints: { move: "done", evil: "done", dash: "maybe" },
      levels: {
        "1-1": { clear: true, best: -3, stickers: [3, 3, 1, 9, "2"], unseen: 1, quick: true, color: "blue" },
        "1-2": "nope",
        "7-1": { clear: true },
      },
    }),
  );
  const save = C.loadSave(storage);
  assert.equal(save.last, "1-1");
  assert.equal(save.comicSeen, false);
  assert.deepEqual(save.hints, { move: "done" });
  assert.deepEqual(Object.keys(save.levels), ["1-1"]);
  assert.deepEqual(save.levels["1-1"], { clear: true, best: null, stickers: [1, 3], unseen: false, takedown: false, takedownBest: 0, quick: true, chain: false, chainBest: 0, color: null });
});

// --------------------------------------------------------- v1.0 save ----
/** A 0.x player's storage as the owner left it: a v1 save plus the separate
 * setting keys (and, from before World 1, "comic seen"). */
function legacyStorage({ v1 = true, settings = true, storySeen = false } = {}) {
  const storage = memoryStorage();
  if (v1)
    storage.setItem(
      C.LEGACY_KEYS.save,
      JSON.stringify({
        v: 1,
        last: "1-4",
        comicSeen: false,
        hints: { move: "done", airjump: "shown" },
        levels: {
          "1-1": { clear: true, best: 14.2, stickers: [1, 2, 3], unseen: false, quick: false, color: "white" },
          "1-2": { clear: true, best: 30.5, stickers: [2], color: "green" },
          "1-3": { clear: true, best: 41, stickers: [], unseen: true, takedown: false, takedownBest: 0, color: "green" },
        },
      }),
    );
  if (settings) {
    storage.setItem(C.LEGACY_KEYS.sfx, "false");
    storage.setItem(C.LEGACY_KEYS.music, "false");
    storage.setItem(C.LEGACY_KEYS.timer, "true");
  }
  if (storySeen) storage.setItem(C.LEGACY_KEYS.storySeen, "true");
  return storage;
}
test("migration: a 0.x save and its setting keys become one v2 save, once, and the old keys stay", () => {
  const storage = legacyStorage({ storySeen: true });
  const before = new Map(storage.data);
  const save = C.loadSave(storage);
  assert.equal(save.v, 2);
  assert.equal(save.migratedFrom, 1);
  assert.equal(save.last, "1-4");
  assert.equal(save.comicSeen, true, "the pre-World-1 storySeen flag carries over");
  assert.deepEqual(save.hints, { move: "done", airjump: "shown" });
  assert.deepEqual(C.unlockedIds(save), ["1-1", "1-2", "1-3", "1-4"]);
  assert.deepEqual(save.levels["1-1"].stickers, [1, 2, 3]);
  assert.equal(save.levels["1-2"].best, 30.5);
  assert.equal(save.levels["1-3"].unseen, true, "the Ghost stamp survives");
  assert.deepEqual(save.settings, { sfx: false, music: false, timer: true, slowSpotting: false, reduceMotion: null });
  // Written back as v2 at once; the 0.x keys are untouched (rollback-safe).
  assert.deepEqual(JSON.parse(storage.data.get(C.SAVE_KEY)), save);
  for (const [k, v] of before) assert.equal(storage.data.get(k), v, k);
  // Once: later 0.x writes (a rollback build) never overwrite v2 progress.
  storage.setItem(C.LEGACY_KEYS.save, JSON.stringify({ v: 1, levels: {} }));
  storage.setItem(C.LEGACY_KEYS.music, "true");
  assert.deepEqual(C.loadSave(storage), save);
});
test("migration: settings-only or progress-only 0.x storage, a corrupt v1, and nothing at all", () => {
  const settingsOnly = C.loadSave(legacyStorage({ v1: false }));
  assert.equal(settingsOnly.migratedFrom, 1);
  assert.deepEqual(settingsOnly.levels, {});
  assert.deepEqual([settingsOnly.settings.sfx, settingsOnly.settings.music, settingsOnly.settings.timer], [false, false, true]);
  const progressOnly = C.loadSave(legacyStorage({ settings: false }));
  assert.deepEqual(progressOnly.settings, C.defaultSettings(), "missing setting keys take the defaults");
  assert.equal(progressOnly.levels["1-1"].clear, true);
  const corrupt = memoryStorage();
  corrupt.setItem(C.LEGACY_KEYS.save, "{oops");
  corrupt.setItem(C.LEGACY_KEYS.sfx, '"loud"');
  const fromCorrupt = C.loadSave(corrupt);
  assert.deepEqual(fromCorrupt.levels, {});
  assert.equal(fromCorrupt.settings.sfx, true, "a non-boolean setting falls back");
  const empty = memoryStorage();
  assert.deepEqual(C.loadSave(empty), C.newSave());
  assert.equal(empty.data.size, 0, "a first visit writes nothing until there is something to keep");
  // A corrupt or unknown v2 value is a fresh save, never a re-import of 0.x.
  const bad = legacyStorage();
  bad.setItem(C.SAVE_KEY, "{not json");
  assert.deepEqual(C.loadSave(bad), C.newSave());
  bad.setItem(C.SAVE_KEY, JSON.stringify({ v: 3, levels: { "1-1": { clear: true } } }));
  assert.deepEqual(C.loadSave(bad), C.newSave());
  // Blocked storage: no migration attempt, no throw.
  assert.deepEqual(C.loadSave(throwing), C.newSave());
});
test("v2 settings are sanitised one by one", () => {
  const s = C.sanitize({ v: 2, settings: { sfx: false, music: "yes", timer: 1, slowSpotting: true, reduceMotion: "always", extra: 1 } });
  assert.deepEqual(s.settings, { sfx: false, music: true, timer: false, slowSpotting: true, reduceMotion: null });
  assert.equal(C.sanitize({ v: 2, settings: { reduceMotion: false } }).settings.reduceMotion, false);
  assert.equal(C.sanitize({ v: 2, migratedFrom: "x" }).migratedFrom, null);
});
test("Slow spotting: the save turns it on in new games; an assisted clear counts but earns no stamps", () => {
  let save = C.newSave({ ...C.defaultSettings(), slowSpotting: true });
  const g = M.createGame("1-5", C.gameOptions(save, "1-5"));
  assert.equal(g.slowSpotting, true);
  assert.equal(g.assisted, true);
  assert.equal(M.createGame("1-5", C.gameOptions(C.newSave(), "1-5")).slowSpotting, false, "off by default");
  const cards = getLevel("1-5").guards.length;
  const run = { time: 30, stickers: [1, 2], spotted: 0, takedowns: cards, cards, escapeTime: null, assisted: true };
  save = C.recordClear(save, "1-5", run);
  const r = C.levelRecord(save, "1-5");
  assert.deepEqual([r.clear, r.best, r.stickers], [true, 30, [1, 2]], "clear, time and stickers count");
  assert.deepEqual([r.unseen, r.takedown, r.takedownBest], [false, false, 0], "no Ghost or Takedown");
  assert.equal(C.isUnlocked(save, "1-6"), true, "an assisted clear opens the next level");
  // Earned stamps are never taken away by a later assisted clear.
  save = C.recordClear(save, "1-5", { ...run, assisted: false });
  save = C.recordClear(save, "1-5", run);
  assert.deepEqual([C.levelRecord(save, "1-5").unseen, C.levelRecord(save, "1-5").takedown], [true, true]);
  // 1-6's Quick par: the baseline escape earns it, but not assisted.
  const quick = C.recordClear(C.newSave(), "1-6", { time: 40, stickers: [], spotted: 1, escapeTime: 1, assisted: true });
  assert.equal(C.levelRecord(quick, "1-6").quick, false);
});
test("Chain stamp: 1-2's baseline island chain earns it; the best chain only improves; assisted, short and hostile chains don't", () => {
  assert.equal(getLevel("1-2").chainPar, 4);
  const won = clearWith(C.newSave(), "1-2");
  assert.deepEqual([C.levelRecord(won, "1-2").chain, C.levelRecord(won, "1-2").chainBest >= 4], [true, true], "the baseline route chains all four islands");
  let save = C.recordClear(C.newSave(), "1-2", { time: 40, stickers: [], spotted: 0, chain: 3 });
  assert.deepEqual([C.levelRecord(save, "1-2").chain, C.levelRecord(save, "1-2").chainBest], [false, 3], "3 < chainPar");
  save = C.recordClear(save, "1-2", { time: 40, stickers: [], spotted: 0, chain: 5 });
  save = C.recordClear(save, "1-2", { time: 40, stickers: [], spotted: 0, chain: 1 });
  assert.deepEqual([C.levelRecord(save, "1-2").chain, C.levelRecord(save, "1-2").chainBest], [true, 5], "kept by a later short chain");
  // No chainPar: the best chain is a tally, never a stamp.
  const five = C.recordClear(C.newSave(), "1-5", { time: 40, stickers: [], spotted: 1, chain: 6 });
  assert.deepEqual([C.levelRecord(five, "1-5").chain, C.levelRecord(five, "1-5").chainBest], [false, 6]);
  const assisted = C.recordClear(C.newSave(), "1-2", { time: 40, stickers: [], spotted: 0, chain: 6, assisted: true });
  assert.deepEqual([C.levelRecord(assisted, "1-2").chain, C.levelRecord(assisted, "1-2").chainBest], [false, 0], "assisted: no stamp, no record");
  // Round trip through storage, a save from before the field, and hostile values.
  const storage = memoryStorage();
  C.writeSave(storage, save);
  assert.deepEqual(C.loadSave(storage), save);
  const old = C.sanitize({ v: 2, levels: { "1-2": { clear: true, best: 30, stickers: [1] } } });
  assert.deepEqual([old.levels["1-2"].chain, old.levels["1-2"].chainBest], [false, 0], "an old save loads with no Chain");
  const hostile = C.sanitize({ v: 2, levels: { "1-2": { chain: "yes", chainBest: 1e9 }, "1-3": { chainBest: -2 }, "1-4": { chainBest: 2.5 } } });
  assert.deepEqual([hostile.levels["1-2"].chain, hostile.levels["1-2"].chainBest, hostile.levels["1-3"].chainBest, hostile.levels["1-4"].chainBest], [false, C.CHAIN_CAP, 0, 0]);
  // World medals are untouched by the new stamp.
  assert.deepEqual(Object.keys(C.worldMedals(save)), ["fullFace", "ghost", "quickGetaway"]);
});
