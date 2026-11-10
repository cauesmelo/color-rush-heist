import test from "node:test";
import assert from "node:assert/strict";
import * as C from "../campaign.mjs";
import * as M from "../model.mjs";
import { ROUTES } from "./routes.mjs";

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
    escapeTime: g.escapeTime,
    color: g.player.color,
  });
}

test("a new save: only 1-1 open, nothing collected, the comic not yet seen", () => {
  const save = C.newSave();
  assert.deepEqual(save, { v: 1, last: "1-1", comicSeen: false, hints: {}, levels: {} });
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
test("stamps: Unseen only on the stealth levels (1-3, 1-5, 1-6); Quick only on 1-6; best time only improves", () => {
  assert.deepEqual(
    C.WORLD1.map((id) => C.levelStamps(id)),
    [
      { unseen: false, quick: false },
      { unseen: false, quick: false },
      { unseen: true, quick: false },
      { unseen: false, quick: false },
      { unseen: true, quick: false },
      { unseen: true, quick: true },
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
  const reset = C.resetSave(storage);
  assert.deepEqual(reset, C.newSave());
  assert.equal(storage.data.has(C.SAVE_KEY), false);
  assert.deepEqual(C.loadSave(storage), C.newSave());
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
  assert.deepEqual(save.levels["1-1"], { clear: true, best: null, stickers: [1, 3], unseen: false, quick: true, color: null });
});
