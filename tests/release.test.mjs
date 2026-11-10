/** v1.0 release facts that must move together (common/docs/V1_RELEASE_PLAN.md
 * S7, S10-S12): the package version, the title's DOM label, the changelog
 * heading, the in-game credits and the itch.io embed decisions. The release
 * gate checks the built ZIP; this keeps the source from drifting first. */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (name) => readFileSync(path.join(root, name), "utf8");
const pkg = JSON.parse(read("package.json"));
const itch = JSON.parse(read("itch.json"));
const index = read("index.html");

test("one version everywhere: package.json, the title's v-label and the changelog heading", () => {
  const [major, minor] = pkg.version.split(".");
  assert.match(pkg.version, /^\d+\.\d+\.\d+$/);
  const label = index.match(/<p id="version" class="version">([^<]+)<\/p>/);
  assert.ok(label, "the title carries a DOM version label");
  assert.equal(label[1], `v${major}.${minor}`);
  assert.match(read("CHANGELOG.md"), new RegExp(`^## \\[${pkg.version.replace(/\./g, "\\.")}\\]`, "m"));
});

test("credits a player can find in game: the artist, the jam game, the font", () => {
  const text = index.replace(/<br\s*\/?>/g, " ").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
  for (const credit of ["Art by Vitor Farias", "Color Theft Story by Vitor Farias and @cauesmelo (minigamejam 22)", "Font: monogram by datagoblin (CC0)"])
    assert.ok(text.includes(credit), credit);
  // The Art panel (Pause -> Art) still credits the artist on its own.
  assert.match(index, /data-panel="art"[\s\S]*?Art by<br \/><strong>Vitor Farias<\/strong>/);
});

test("itch.io embed decisions: the 960x540 surface, click to play, fullscreen, mobile off until phones pass", () => {
  assert.deepEqual(itch.embed, { width: 960, height: 540, clickToPlay: true, fullscreenButton: true, mobileFriendly: false, orientation: "landscape" });
  assert.match(index, /<canvas[\s\S]*?width="960"[\s\S]*?height="540"/);
  // The unverified third-party pack stays in the repo but out of the upload.
  assert.ok(itch.withhold["assets/player/"]);
});
