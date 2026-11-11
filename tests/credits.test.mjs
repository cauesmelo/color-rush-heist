/** The ending and the credits: the reel's timing rules (lockout, held keys,
 * Esc), the data's integrity, and the truth guard on what the credits say.
 * The pictures are judged in Chrome (tests/browser-ending.mjs, pixel-audit.mjs). */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as R from "../credits.mjs";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const read = (f) => readFileSync(path.join(root, f), "utf8");
/** Every string a player reads in the credits. */
const roll = () => R.CREDITS.flatMap((c) => [c.head, c.note, ...c.lines, c.foot].filter(Boolean));

// ------------------------------------------------------------- the reel ----
test("a reel moves on by itself when a page's time is up, and carries the leftover time", () => {
  let reel = R.createReel(R.ENDING_PAGES);
  assert.equal(R.pageOf(reel).id, "home");
  assert.equal(R.tick(reel, R.ENDING_PAGES[0].dur - 0.01), reel, "nothing changes before the page is up (same object)");
  reel = R.tick(reel, R.ENDING_PAGES[0].dur + 0.05);
  assert.equal(reel.index, 1);
  assert.ok(Math.abs(reel.start - R.ENDING_PAGES[0].dur) < 1e-9, "the next page starts when the last one ended, not when the frame came");
  reel = R.tick(reel, R.totalSeconds(R.ENDING_PAGES) + 0.01);
  assert.equal(reel.done, true, "the last page ends the reel");
  assert.equal(R.tick(reel, 1e6), reel, "a finished reel stays finished");
});
test("credit cards run CARD_SECONDS each, in the order of the data, then the reel is done", () => {
  let reel = R.createReel(R.CREDITS);
  const order = [];
  for (let i = 0; i < R.CREDITS.length; i++) {
    order.push(R.pageOf(reel).id);
    reel = R.tick(reel, (i + 1) * R.CARD_SECONDS + 1e-6);
  }
  assert.deepEqual(order, R.CREDITS.map((c) => c.id));
  assert.equal(reel.done, true);
  assert.ok(Math.abs(R.totalSeconds(R.CREDITS) - R.CREDITS.length * R.CARD_SECONDS) < 1e-9);
});
test("lockout: a press in a page's first 0.6 s does nothing; after it, it moves on", () => {
  const reel = R.createReel(R.CREDITS);
  for (const t of [0, 0.1, R.LOCKOUT - 0.001]) assert.deepEqual(R.press(reel, t), { reel, outcome: "ignored" }, `at ${t}`);
  const { reel: next, outcome } = R.press(reel, R.LOCKOUT);
  assert.equal(outcome, "next");
  assert.equal(next.index, 1);
  assert.equal(next.start, R.LOCKOUT, "the next page starts at the press");
  // ... and the new page has its own lockout: two quick taps do not skip two cards.
  assert.equal(R.press(next, R.LOCKOUT + 0.2).outcome, "ignored");
  assert.equal(R.press(next, R.LOCKOUT + R.LOCKOUT).outcome, "next");
});
test("a held key never skips: auto-repeat (repeat: true) is ignored at any age", () => {
  const reel = R.createReel(R.CREDITS);
  for (const t of [0, 0.3, 1, 2.5, 4]) assert.equal(R.press(reel, t, { repeat: true }).outcome, "ignored", `at ${t}`);
  assert.equal(R.press(reel, 1, { repeat: true, escape: true }).outcome, "ignored", "a held Esc does not leave either");
  assert.equal(R.press(reel, 1).outcome, "next", "while a fresh press at the same moment does");
});
test("Esc after the lockout ends the whole reel at once; inside it, nothing", () => {
  const reel = R.createReel(R.CREDITS);
  assert.equal(R.press(reel, 0.2, { escape: true }).outcome, "ignored");
  const out = R.press(reel, 1, { escape: true });
  assert.equal(out.outcome, "done");
  assert.equal(out.reel.done, true);
});
test("a press on the last page ends the reel; a finished reel ignores everything", () => {
  let reel = R.createReel(R.ENDING_PAGES);
  let now = 0,
    outcomes = [];
  for (let i = 0; i < R.ENDING_PAGES.length; i++) {
    now = reel.start + R.LOCKOUT + 0.05;
    const r = R.press(reel, now);
    outcomes.push(r.outcome);
    reel = r.reel;
  }
  assert.deepEqual(outcomes, ["next", "next", "done"]);
  assert.equal(R.press(reel, now + 100).outcome, "ignored");
});
test("frameOf reports whether a press would count (past the lockout, not done)", () => {
  const reel = R.createReel(R.CREDITS);
  assert.equal(R.frameOf(reel, 0.3).canPress, false);
  assert.equal(R.frameOf(reel, 0.7).canPress, true);
  const f = R.frameOf(reel, 1);
  assert.equal(f.count, R.CREDITS.length);
  assert.ok(Math.abs(f.left - (R.CARD_SECONDS - 1)) < 1e-9);
});

// ----------------------------------------------------------- the timing ----
test("calm timing: pages are long enough to read and the whole thing is short", () => {
  for (const c of R.CREDITS) assert.ok(R.CARD_SECONDS >= 3.5 && R.CARD_SECONDS <= 6, "a card stays 3.5-6 s");
  for (const p of R.ENDING_PAGES) assert.ok(p.dur >= 3 && p.dur <= 6, `${p.id} lasts 3-6 s`);
  assert.ok(R.totalSeconds(R.ENDING_PAGES) <= 15, "the ending is at most 15 s");
  assert.ok(R.totalSeconds(R.CREDITS) <= 30, "the credits are at most 30 s");
  assert.ok(R.LOCKOUT >= 0.4 && R.LOCKOUT <= 1, "a short lockout");
});
test("fadeLevel: four steps up over SETTLE, four down over the last SETTLE, full between; reduced is always full", () => {
  // Mid-bin ages (a bin is SETTLE / 4 = 0.07 s), so float noise cannot move a value.
  const up = [0, 0.035, 0.105, 0.175, 0.245, 0.3].map((age) => R.fadeLevel(age, 9));
  assert.deepEqual(up, [0, 0, 1, 2, 3, 3]);
  const down = [0.3, 0.245, 0.175, 0.105, 0.035, 0].map((left) => R.fadeLevel(9, left));
  assert.deepEqual(down, [3, 3, 2, 1, 0, 0]);
  assert.equal(R.fadeLevel(2, 2), 3);
  for (const [a, l] of [[0, 4], [0.1, 3], [4, 0]]) assert.equal(R.fadeLevel(a, l, { reduced: true }), 3);
});
test("the colour wave: whole steps, never backwards, full at the end, and wide enough for the farthest corner", () => {
  let last = -1;
  for (let age = 0; age <= R.ENDING_PAGES[1].dur; age += 0.05) {
    const r = R.waveRadius(age);
    assert.equal(r % R.WAVE_STEP, 0);
    assert.ok(r >= last, "monotone");
    last = r;
  }
  assert.equal(R.waveRadius(0.2), 0, "it starts a beat after the page");
  assert.equal(R.waveRadius(R.WAVE_END), R.WAVE_MAX);
  assert.ok(R.WAVE_END + 0.4 < R.ENDING_PAGES[1].dur, "full colour holds for a moment before the last page");
  // The dithered band is solid once radius - distance >= WAVE_BAND, so the corner must be inside that.
  const farthest = Math.max(Math.hypot(R.HOME.x, R.HOME.wave), Math.hypot(480 - R.HOME.x, R.HOME.wave), Math.hypot(R.HOME.x, 270 - R.HOME.wave), Math.hypot(480 - R.HOME.x, 270 - R.HOME.wave));
  assert.ok(R.WAVE_MAX - R.WAVE_BAND >= farthest, `wave ${R.WAVE_MAX - R.WAVE_BAND} covers ${farthest.toFixed(1)}`);
  assert.equal(R.waveRadius(0.1, { reduced: true }), R.WAVE_MAX, "reduced motion cuts to full colour");
});
test("the parade enters from the left, is whole-pixel, and ends short of the title art's own credit in the corner", () => {
  assert.ok(R.paradeX(0) < 0);
  let last = -Infinity;
  for (let t = 0; t <= R.totalSeconds(R.CREDITS); t += 0.1) {
    const x = R.paradeX(t);
    assert.ok(Number.isInteger(x) && x >= last);
    last = x;
  }
  // The leader is drawn 16 px right of x and is 16 px wide; the baked credit starts near x 375.
  assert.ok(R.paradeX(R.totalSeconds(R.CREDITS)) + 32 < 372, "the leader stops before the baked corner credit");
  assert.equal(R.paradeX(5, { reduced: true }), R.paradeX(90, { reduced: true }), "reduced motion: they stand still");
});

// ------------------------------------------------------------- the data ----
test("the credit data is complete: unique ids, text that fits the plate, a provenance for every card", () => {
  const ids = new Set();
  for (const c of R.CREDITS) {
    assert.ok(c.id && !ids.has(c.id), `unique id ${c.id}`);
    ids.add(c.id);
    assert.ok(c.head && Array.isArray(c.lines));
    assert.ok(c.source && c.source.length > 20, `${c.id} says where its claims come from`);
    // The plate is 280 art px wide: the large heading is 12 px a letter, the rest 6.
    assert.ok(c.head.length * 12 <= 256, `${c.id}: heading fits`);
    for (const t of [c.note, ...c.lines, c.foot].filter(Boolean)) assert.ok(t.length <= R.MAX_LINE && t.length * 6 <= 256, `${c.id}: "${t}" fits`);
    // Text the bitmap font can draw: printable ASCII and the e-circumflex of Cauê.
    for (const t of [c.head, c.note, ...c.lines, c.foot].filter(Boolean)) assert.match(t, /^[\x20-\x7eê]+$/, `${c.id}: "${t}" is drawable text`);
  }
  assert.ok(R.CREDITS.length >= 4 && R.CREDITS.length <= 8, "one card at a time, a short list");
  assert.equal(R.CREDITS.at(-1).id, "thanks");
  for (const p of R.ENDING_PAGES) assert.ok(p.id && p.top && p.top.length <= 60, `${p.id} caption`);
  assert.equal(R.ENDING.teaser, null, "no 'coming soon': the ending closes the game (owner, 2026-11-10)");
});
test("the roll names only what the workspace supports (the truth guard)", () => {
  const text = roll().join("\n");
  // The original game's authors, as its own cards spell them, and what ships.
  for (const must of ["Vitor Farias", "@cauesmelo", "Cauê Melo", "minigamejam 22", "monogram", "datagoblin", "CC0", "Claude Code", "Music: the original game's track"])
    assert.ok(text.includes(must), `the roll says "${must}"`);
  // Names that belong to OTHER projects or to an unverified source must not leak in.
  for (const never of ["Daniel", "Calônico", "Calonico", "Lucas", "Santos", "Rafael", "Lima", "Solarum", "raenkumi", "Kimoh", "LSdS", "Amanda", "meromei", "Bruno", "Mareto", "nklbdev", "Pink Monster", "craftpix", "Tiny Hero"])
    assert.ok(!text.includes(never), `the roll must not contain "${never}"`);
  // The soundtrack's composer is unknown: the music line carries no name and no "by".
  const music = roll().filter((t) => /^music/i.test(t));
  assert.deepEqual(music, ["Music: the original game's track"]);
  assert.ok(!/composed|composer|music by/i.test(text), "no composer is claimed");
});
test("the pause menu's Credits panel and the roll say the same things", () => {
  const html = read("index.html"),
    panel = html.match(/<div data-panel="credits"[\s\S]*?<\/div>/)[0].replace(/<[^>]+>/g, " "),
    text = roll().join("\n");
  for (const part of ["Vitor Farias", "@cauesmelo", "minigamejam 22", "monogram", "datagoblin", "CC0", "Claude Code"]) {
    assert.ok(panel.includes(part), `the pause panel says ${part}`);
    assert.ok(text.includes(part), `the roll says ${part}`);
  }
  assert.ok(panel.includes("music: the original game's track"), "the pause panel's music wording matches the roll");
  assert.ok(!/jam track/i.test(panel), "the old 'original jam track' wording is gone (the refs do not call it a jam track)");
});
test("ITCH_IO.md carries the CREDITS_TODO: every open question about the credits", () => {
  const doc = read("ITCH_IO.md"),
    at = doc.indexOf("CREDITS_TODO");
  assert.ok(at > 0, "a CREDITS_TODO section");
  const todo = doc.slice(at);
  for (const topic of ["track.mp3", "composer", "tileset", "nklbdev", "Art by Vitor Farias", "Pink Monster", "Cauê Melo"]) assert.ok(todo.includes(topic), `CREDITS_TODO mentions ${topic}`);
});
