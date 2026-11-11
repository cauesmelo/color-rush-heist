/** The ending and credits are wired into the game as the brief says: the
 * flow Continue -> closing pages -> credits -> title, the title's button, and
 * the module boundaries. (The real flow is checked in Chrome by
 * tests/browser-ending.mjs; these guard the source.) */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const read = (f) => readFileSync(path.join(root, f), "utf8");

test("the modules stay apart: credits.mjs imports nothing, the model and campaign never see it", () => {
  assert.doesNotMatch(read("credits.mjs"), /^import /m);
  for (const file of ["model.mjs", "campaign.mjs", "loop.mjs"]) assert.doesNotMatch(read(file), /credits\.mjs|ending-draw/, file);
  assert.match(read("ending-draw.mjs"), /from "\.\/credits\.mjs"/);
});
test("game.mjs wires the flow: Continue -> ending -> credits -> title, and the title's button", () => {
  const src = read("game.mjs").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  assert.match(src, /if \(screen === "world"\) return showEnding\(\)/, "the world clear's Continue starts the ending");
  assert.match(src, /startReel\("credits", "world"\)/, "the ending runs into the credits");
  assert.match(src, /setScreen\("title"\)/);
  assert.match(src, /ui\.credits\.addEventListener\("click", \(\) => showCredits\("title"\)\)/, "the title's button plays the same cards");
  // A held key (repeat) is passed to the rule that ignores it; Esc is the one leave key.
  assert.match(src, /reelPress\(\{ repeat: event\.repeat, escape: key === "escape" \}\)/);
  // Only the primary button is a press.
  assert.match(src, /if \(event\.button === 0\) reelPress\(\{\}\)/);
  // The same cards from both doors: one data list.
  assert.match(src, /CR\.createReel\(name === "ending" \? CR\.ENDING_PAGES : CR\.CREDITS\)/);
});
