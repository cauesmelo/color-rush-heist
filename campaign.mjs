/** World 1 campaign: level order, unlocks, stickers, stamps, medals and the
 * local save. Pure functions over plain JSON (no DOM); the only side effects
 * are the explicit load/write/reset calls on a storage object, and each of
 * those is wrapped in try so a private window or a sandboxed iframe (where
 * localStorage throws) simply plays without saving.
 *
 * Save format (RESEARCH_PROGRESSION.md section 9.6), key "color-rush-heist:save":
 *   { v: 1, last: "1-3", comicSeen: true,
 *     hints: { move: "done", airjump: "shown", ... },
 *     levels: { "1-1": { clear: true, best: 52.4, stickers: [1, 3],
 *                        unseen: false, quick: false, color: "white" } } }
 * A sticker is saved the moment it is touched and never removed; a clear is
 * saved at the goal. Mid-level positions are never saved.
 */
import { LEVELS, LEVEL_IDS, getLevel } from "./levels/index.mjs";
import { HINT_IDS } from "./model.mjs";

export const SAVE_KEY = "color-rush-heist:save";
export const SAVE_VERSION = 1;
export const WORLD1 = LEVEL_IDS;
export const STICKERS_PER_LEVEL = 3;
export const TOTAL_STICKERS = LEVELS.reduce((sum, level) => sum + level.stickers.length, 0);
/** Forest color on the world map: 0.12 per cleared level 1-1..1-5, full at 1-6. */
export const COLOR_PER_CLEAR = 0.12;

export function newSave() {
  return { v: SAVE_VERSION, last: WORLD1[0], comicSeen: false, hints: {}, levels: {} };
}
const emptyRecord = () => ({ clear: false, best: null, stickers: [], unseen: false, quick: false, color: null });
export const levelRecord = (save, id) => ({ ...emptyRecord(), ...(save.levels[id] || {}) });

/** Which stamps a level can award. "Unseen" only where staying unseen is a
 * real choice: the stealth levels 1-3, 1-5 and 1-6 (1-1 has no cards, 1-2 is
 * the stomp lesson and 1-4 a traversal level, where it would come free or
 * mean nothing: `unseen: false`). "Quick" only where there is a par (1-6). */
export function levelStamps(id) {
  const level = getLevel(id);
  return {
    unseen: !!level && level.unseen !== false && level.guards.length > 0,
    quick: !!level && level.par !== null,
  };
}

export const levelIndex = (id) => WORLD1.indexOf(id);
export const nextLevel = (id) => WORLD1[levelIndex(id) + 1] || null;
/** Linear unlocks: 1-1 is always open; every other level opens when the one
 * before it is cleared. */
export const isUnlocked = (save, id) => levelIndex(id) === 0 || (levelIndex(id) > 0 && levelRecord(save, WORLD1[levelIndex(id) - 1]).clear);
export const unlockedIds = (save) => WORLD1.filter((id) => isUnlocked(save, id));
export const isCleared = (save, id) => levelRecord(save, id).clear;
export const worldClear = (save) => WORLD1.every((id) => isCleared(save, id));
/** The kit a level always starts with (fixed on replays too). */
export const kitFor = (id) => getLevel(id)?.kit ?? null;
/** Abilities a level hands out at its GET moments, in order. */
export function getsIn(id) {
  const level = getLevel(id);
  if (!level) return [];
  const gets = level.checkpoints.filter((cp) => cp.get).map((cp) => cp.get);
  return gets;
}

export function stickerTotal(save) {
  return WORLD1.reduce((sum, id) => sum + levelRecord(save, id).stickers.length, 0);
}

const clone = (save) => structuredClone(save);
/** A sticker is the player's for good the moment it is touched. */
export function collectSticker(save, id, n) {
  const level = getLevel(id);
  if (!level || !level.stickers.some((s) => s.id === n)) return save;
  const next = clone(save),
    record = levelRecord(next, id);
  if (!record.stickers.includes(n)) record.stickers = [...record.stickers, n].sort((a, b) => a - b);
  next.levels[id] = record;
  return next;
}

/** A level was finished. `result` comes from the model at the win:
 * { time, stickers: [ids collected this run], spotted, escapeTime, color }.
 * Best time only improves; stickers and stamps only accumulate. */
export function recordClear(save, id, result) {
  if (!getLevel(id)) return save;
  let next = clone(save);
  for (const n of result.stickers || []) next = collectSticker(next, id, n);
  const record = levelRecord(next, id),
    stamps = levelStamps(id),
    level = getLevel(id);
  record.clear = true;
  if (Number.isFinite(result.time)) record.best = record.best === null ? result.time : Math.min(record.best, result.time);
  if (stamps.unseen && result.spotted === 0) record.unseen = true;
  if (stamps.quick && Number.isFinite(result.escapeTime) && result.escapeTime <= level.par) record.quick = true;
  if (result.color) record.color = result.color;
  next.levels[id] = record;
  next.last = nextLevel(id) || id;
  return next;
}

/** Hint budget across the whole save: "done" beats "shown" beats "pending". */
const HINT_RANK = { pending: 0, shown: 1, done: 2 };
export function mergeHints(save, hints = {}) {
  const next = clone(save);
  for (const id of HINT_IDS) {
    const a = next.hints[id] || "pending",
      b = hints[id] || "pending";
    const best = HINT_RANK[b] > HINT_RANK[a] ? b : a;
    if (best !== "pending") next.hints[id] = best;
  }
  return next;
}

/** World medals reuse the old three: Full face (18/18), Ghost (Unseen on
 * every level that can award it) and Quick getaway (1-6's par). */
export function worldMedals(save) {
  const unseenLevels = WORLD1.filter((id) => levelStamps(id).unseen),
    quickLevels = WORLD1.filter((id) => levelStamps(id).quick);
  return {
    fullFace: stickerTotal(save) === TOTAL_STICKERS,
    ghost: unseenLevels.every((id) => levelRecord(save, id).unseen),
    quickGetaway: quickLevels.every((id) => levelRecord(save, id).quick),
  };
}

/** How much color the world map's forest has regained. */
export function forestColor(save) {
  if (isCleared(save, WORLD1[WORLD1.length - 1])) return 1;
  return Math.min(1, WORLD1.slice(0, -1).filter((id) => isCleared(save, id)).length * COLOR_PER_CLEAR);
}

/** Never trust stored data: keep only known levels, valid sticker numbers,
 * finite times and known hint states. Anything else falls back to defaults. */
export function sanitize(raw) {
  const save = newSave();
  if (!raw || typeof raw !== "object" || raw.v !== SAVE_VERSION) return save;
  if (WORLD1.includes(raw.last)) save.last = raw.last;
  save.comicSeen = raw.comicSeen === true;
  if (raw.hints && typeof raw.hints === "object")
    for (const id of HINT_IDS) if (["shown", "done"].includes(raw.hints[id])) save.hints[id] = raw.hints[id];
  if (raw.levels && typeof raw.levels === "object")
    for (const id of WORLD1) {
      const r = raw.levels[id];
      if (!r || typeof r !== "object") continue;
      const valid = getLevel(id).stickers.map((s) => s.id);
      save.levels[id] = {
        clear: r.clear === true,
        best: Number.isFinite(r.best) && r.best > 0 ? r.best : null,
        stickers: [...new Set(Array.isArray(r.stickers) ? r.stickers.filter((n) => valid.includes(n)) : [])].sort((a, b) => a - b),
        unseen: r.unseen === true,
        quick: r.quick === true,
        color: ["white", "green", "red"].includes(r.color) ? r.color : null,
      };
    }
  return save;
}

export function loadSave(storage) {
  try {
    const text = storage?.getItem(SAVE_KEY);
    return text ? sanitize(JSON.parse(text)) : newSave();
  } catch {
    return newSave(); // blocked or corrupt storage: progress lasts for this visit
  }
}
export function writeSave(storage, save) {
  try {
    storage.setItem(SAVE_KEY, JSON.stringify(save));
    return true;
  } catch {
    return false;
  }
}
export function resetSave(storage) {
  try {
    storage.removeItem(SAVE_KEY);
  } catch {
    /* nothing stored, or storage blocked: a fresh save either way */
  }
  return newSave();
}

/** Options for model.createGame from the save: hint states and owned stickers. */
export function gameOptions(save, id) {
  return { hints: { ...save.hints }, owned: levelRecord(save, id).stickers };
}
