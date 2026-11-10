/** World 1 campaign: level order, unlocks, stickers, stamps, medals and the
 * local save. Pure functions over plain JSON (no DOM); the only side effects
 * are the explicit load/write/reset calls on a storage object, and each of
 * those is wrapped in try so a private window or a sandboxed iframe (where
 * localStorage throws) simply plays without saving.
 *
 * Save format v2 (since 1.0.0), one versioned key "color-rush-heist:v2:save"
 * (itch.io serves many games from one origin, so every key is game-prefixed):
 *   { v: 2, last: "1-3", comicSeen: true, migratedFrom: 1 | null,
 *     hints: { move: "done", airjump: "shown", ... },
 *     levels: { "1-1": { clear: true, best: 52.4, stickers: [1, 3],
 *                        unseen: false, takedown: false, takedownBest: 0,
 *                        quick: false, color: "white" } },
 *     settings: { sfx: true, music: true, timer: false,
 *                 slowSpotting: false, reduceMotion: null } }
 * `unseen` is the Ghost stamp (its old name, kept so older saves load);
 * `takedownBest` is the most cards put down in one clear of that level.
 * `reduceMotion: null` follows the system setting; true/false is the
 * player's own choice from the pause menu.
 * A sticker is saved the moment it is touched and never removed; a clear is
 * saved at the goal. Mid-level positions are never saved.
 *
 * Older builds (0.x) wrote progress as v1 under "color-rush-heist:save" and
 * each setting under its own key ("color-rush-heist:sfx", ":music", ":timer",
 * and ":storySeen" before World 1). loadSave migrates them once: when the v2
 * key is absent it reads them, writes v2 and leaves the old keys untouched
 * (a rollback to 0.x still finds its save; the v2 key marks the migration).
 */
import { LEVELS, LEVEL_IDS, getLevel } from "./levels/index.mjs";
import { HINT_IDS } from "./model.mjs";

export const SAVE_KEY = "color-rush-heist:v2:save";
export const SAVE_VERSION = 2;
/** The 0.x keys loadSave migrates from (never written by 1.x). */
export const LEGACY_KEYS = Object.freeze({
  save: "color-rush-heist:save",
  sfx: "color-rush-heist:sfx",
  music: "color-rush-heist:music",
  timer: "color-rush-heist:timer",
  storySeen: "color-rush-heist:storySeen",
});
export const WORLD1 = LEVEL_IDS;
export const STICKERS_PER_LEVEL = 3;
export const TOTAL_STICKERS = LEVELS.reduce((sum, level) => sum + level.stickers.length, 0);
/** Forest color on the world map: 0.12 per cleared level 1-1..1-5, full at 1-6. */
export const COLOR_PER_CLEAR = 0.12;

/** Settings defaults: sound and music on, no timer, assist off, motion
 * following the system. */
export const defaultSettings = () => ({ sfx: true, music: true, timer: false, slowSpotting: false, reduceMotion: null });
export function newSave(settings = defaultSettings()) {
  return { v: SAVE_VERSION, last: WORLD1[0], comicSeen: false, migratedFrom: null, hints: {}, levels: {}, settings: sanitizeSettings(settings) };
}
/** Unknown or malformed settings fall back to the defaults one by one. */
export function sanitizeSettings(raw) {
  const out = defaultSettings();
  if (!raw || typeof raw !== "object") return out;
  for (const key of ["sfx", "music", "timer", "slowSpotting"]) if (typeof raw[key] === "boolean") out[key] = raw[key];
  if (typeof raw.reduceMotion === "boolean") out.reduceMotion = raw.reduceMotion;
  return out;
}
const emptyRecord = () => ({ clear: false, best: null, stickers: [], unseen: false, takedown: false, takedownBest: 0, quick: false, color: null });
export const levelRecord = (save, id) => ({ ...emptyRecord(), ...(save.levels[id] || {}) });

/** Which stamps a level can award. "Ghost" (never spotted; saved as
 * `unseen`) only where staying unseen is a real choice: the stealth levels
 * 1-3, 1-5 and 1-6 (1-1 has no cards, 1-2 is the stomp lesson and 1-4 a
 * traversal level, where it would come free or mean nothing: `unseen:
 * false`). "Takedown" (every card stomped or knocked) only where putting a
 * card down is a choice, not the way through: 1-5 and 1-6 (`takedown: true`;
 * every 1-2/1-4 card is a gate or a springboard, and 1-3's corridor card
 * can't be reached from above). "Quick" only where there is a par (1-6). */
export function levelStamps(id) {
  const level = getLevel(id);
  return {
    unseen: !!level && level.unseen !== false && level.guards.length > 0,
    takedown: !!level && level.takedown === true && level.guards.length > 0,
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
 * { time, stickers: [ids collected this run], spotted, takedowns, cards,
 *   escapeTime, color, assisted }.
 * Best time and the best takedown tally only improve; stickers and stamps
 * only accumulate. */
export function recordClear(save, id, result) {
  if (!getLevel(id)) return save;
  let next = clone(save);
  for (const n of result.stickers || []) next = collectSticker(next, id, n);
  const record = levelRecord(next, id),
    // An assisted run (Slow spotting on at any moment) still clears, unlocks,
    // keeps its stickers and best time, but awards no stamp: Ghost, Takedown
    // and Quick measure exactly the reading of cones the assist relaxes.
    // Stamps already earned are never taken away.
    stamps = result.assisted ? { unseen: false, takedown: false, quick: false } : levelStamps(id),
    level = getLevel(id);
  record.clear = true;
  if (Number.isFinite(result.time)) record.best = record.best === null ? result.time : Math.min(record.best, result.time);
  if (stamps.unseen && result.spotted === 0) record.unseen = true;
  if (stamps.takedown && Number.isInteger(result.takedowns)) {
    const n = Math.max(0, Math.min(level.guards.length, result.takedowns));
    record.takedownBest = Math.max(record.takedownBest, n);
    if (n === level.guards.length) record.takedown = true;
  }
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
 * finite times, known hint states and known settings. Anything else falls
 * back to defaults. Reads v2 and the identical v1 progress fields (the
 * migration); any other version is a fresh save. */
export function sanitize(raw) {
  const save = newSave();
  if (!raw || typeof raw !== "object" || ![1, SAVE_VERSION].includes(raw.v)) return save;
  if (WORLD1.includes(raw.last)) save.last = raw.last;
  save.comicSeen = raw.comicSeen === true;
  if (raw.v === SAVE_VERSION) {
    save.settings = sanitizeSettings(raw.settings);
    if (raw.migratedFrom === 1) save.migratedFrom = 1;
  }
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
        takedown: r.takedown === true,
        takedownBest: Number.isInteger(r.takedownBest) ? Math.max(0, Math.min(getLevel(id).guards.length, r.takedownBest)) : 0,
        quick: r.quick === true,
        color: ["white", "green", "red"].includes(r.color) ? r.color : null,
      };
    }
  return save;
}

const readJson = (storage, key) => {
  try {
    const text = storage?.getItem(key);
    return text === null || text === undefined ? undefined : JSON.parse(text);
  } catch {
    return undefined; // blocked storage or corrupt JSON: as if absent
  }
};
/** 0.x -> v2, once: progress from the v1 save, each setting from its own
 * key, and the pre-World-1 "comic seen" flag. Null when nothing old exists. */
export function migrateLegacy(storage) {
  const v1 = readJson(storage, LEGACY_KEYS.save),
    old = Object.fromEntries(["sfx", "music", "timer", "storySeen"].map((k) => [k, readJson(storage, LEGACY_KEYS[k])]));
  if (v1 === undefined && Object.values(old).every((v) => v === undefined)) return null;
  const save = v1 && typeof v1 === "object" && v1.v === 1 ? sanitize(v1) : newSave();
  save.settings = sanitizeSettings({ sfx: old.sfx, music: old.music, timer: old.timer });
  if (old.storySeen === true) save.comicSeen = true;
  save.migratedFrom = 1;
  return save;
}

/** The v2 save, else a one-time migration of the 0.x keys (written back as
 * v2 at once), else a fresh save. Never throws. The v2 key's presence marks
 * the migration as done: a corrupt or unknown-version v2 value gives a fresh
 * save rather than re-importing stale 0.x progress. */
export function loadSave(storage) {
  let text;
  try {
    text = storage?.getItem(SAVE_KEY);
  } catch {
    return newSave(); // storage blocked: progress lasts for this visit
  }
  if (text !== null && text !== undefined) {
    try {
      return sanitize(JSON.parse(text));
    } catch {
      return newSave();
    }
  }
  const migrated = migrateLegacy(storage);
  if (migrated) {
    writeSave(storage, migrated);
    return migrated;
  }
  return newSave();
}
export function writeSave(storage, save) {
  try {
    storage.setItem(SAVE_KEY, JSON.stringify(save));
    return true;
  } catch {
    return false;
  }
}
/** Erase campaign progress (clears, stickers, stamps, hints, the comic) and
 * keep the player's settings. The fresh save is written, so the old 0.x keys
 * (left in place for rollback) are never migrated again. */
export function resetSave(storage, settings = defaultSettings()) {
  const fresh = newSave(settings);
  writeSave(storage, fresh); // storage blocked: a fresh save for this visit either way
  return fresh;
}

/** Options for model.createGame from the save: hint states, owned stickers
 * and the Slow spotting assist. */
export function gameOptions(save, id) {
  return { hints: { ...save.hints }, owned: levelRecord(save, id).stickers, slowSpotting: save.settings?.slowSpotting === true };
}
