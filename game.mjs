/** Color Rush Heist: browser front end, renderer, input, audio and QA API.
 *
 * The simulation lives in model.mjs (pure) and the campaign rules in
 * campaign.mjs (pure); this file only observes them, draws, plays sound and
 * owns the one side effect of saving. Every sprite is drawn on ONE 2x pixel
 * grid: 16 px Tileset cells -> 32 px tiles, Rubik 32 px frames -> 64 px, cards
 * 86x67 / 110x86 -> 2x, vault 23x20 -> 4x. Runtime effects (tints, grey card,
 * colorized forest) are derived canvases; asset files are never modified.
 *
 * Front-end flow: title -> comic (first visit) -> 1-1 -> level clear -> world
 * map -> level intro card -> play -> clear ... -> 1-6 -> world clear ->
 * end_game.png -> title. Returning players go from the title to the map.
 */
import * as M from "./model.mjs";
import * as B from "./levels/builder.mjs";
import { LEVELS, getLevel } from "./levels/index.mjs";
import * as C from "./campaign.mjs";
import { FixedStep } from "./loop.mjs";

const W = 960,
  H = 540,
  T = B.TILE;
const canvas = document.querySelector("#game"),
  ctx = canvas.getContext("2d");
ctx.imageSmoothingEnabled = false;
const $ = (id) => document.getElementById(id);

// ---------------------------------------------------------------- storage --
/** Campaign progress and settings in one versioned save (campaign.mjs,
 * "color-rush-heist:v2:save"; 0.x keys are migrated once). Private windows
 * and sandboxed iframes may throw on storage access: loadSave/writeSave
 * quietly keep everything for this visit, and play never depends on it. */
const storage = (() => {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
})();
let save = C.loadSave(storage);
/** The live settings object (sound, music, timer, the Slow spotting assist,
 * the motion choice); persist() copies it into the save. */
const settings = { ...save.settings };
function persist() {
  save.settings = { ...settings };
  C.writeSave(storage, save);
}
// Reduced motion: the player's pause-menu choice, else the system setting.
// Under it: no shake, flashes, particles, squash or iris (cuts instead);
// state cues stay (steady instead of pulsing).
const motionQuery = matchMedia("(prefers-reduced-motion: reduce)");
let reducedMotion = settings.reduceMotion ?? motionQuery.matches;
function syncMotion() {
  reducedMotion = settings.reduceMotion ?? motionQuery.matches;
  document.documentElement.dataset.motion = reducedMotion ? "reduced" : "full";
  if (reducedMotion) {
    cam.shake = 0;
    fx.flash = 0;
    fx.squash = null;
    fx.particles.length = 0;
  }
}
motionQuery.addEventListener?.("change", () => {
  syncMotion();
  syncSettingsLabels();
});

// ----------------------------------------------------------------- assets --
const FILES = {
  title: "title_screen.png",
  forest: "bg1.png",
  sky: "bg1-sky.png",
  black: "bg_black.png",
  q1: "quadro1.png",
  q2: "quadro2.png",
  q3: "quadro3.png",
  q4: "quadro4.png",
  cutout: "cutout.png",
  ending: "end_game.png",
  tiles: "tiles/Tileset.png",
  white: "rubik_white.png",
  green: "rubik_green.png",
  red: "rubik_red.png",
  storm: "rubik_storm.png",
  cardGreen: "inimigo_verde.png",
  cardRed: "inimigo3-Sheet.png",
  cone: "cone_de_visao.png",
  vault: "cofre.png",
};
const img = {},
  derived = {};
let assetsReady = false;

function loadImage(key, file) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      img[key] = image;
      resolve();
    };
    image.onerror = () => reject(new Error("Could not load " + file));
    image.src = "./assets/" + file;
  });
}
/** readback: the canvas is read with getImageData (one-off texture bakes):
 * ask for a CPU-backed context. Canvases drawn every frame stay GPU-backed. */
function makeCanvas(w, h, readback = false) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const x = c.getContext("2d", readback ? { willReadFrequently: true } : undefined);
  x.imageSmoothingEnabled = false;
  return [c, x];
}

/** Derived, runtime-only textures. */
function buildDerived() {
  // Forest recolor: bg1 is the title forest drained of color (same layout).
  // A per-row color strip sampled from the title's logo-free left edge is
  // applied with 'color' compositing: bg1 keeps its own light and shade.
  {
    const [strip, sx] = makeCanvas(1, 270);
    sx.drawImage(img.title, 0, 0, 96, 270, 0, 0, 1, 270);
    const [c, x] = makeCanvas(480, 270);
    x.drawImage(img.forest, 0, 0);
    x.globalCompositeOperation = "color";
    x.drawImage(strip, 0, 0, 480, 270);
    x.globalCompositeOperation = "destination-in";
    x.drawImage(img.forest, 0, 0);
    derived.forestColor = c;
    const [s2, x2] = makeCanvas(1440, 451);
    x2.drawImage(img.sky, 0, 0);
    x2.globalCompositeOperation = "color";
    x2.drawImage(strip, 0, 0, 1, 4, 0, 0, 1440, 451);
    derived.skyColor = s2;
  }
  // Sample fills so letterbox areas match the art.
  {
    const [c, x] = makeCanvas(480, 270, true);
    x.drawImage(img.forest, 0, 0);
    const top = x.getImageData(2, 2, 1, 1).data,
      bottom = x.getImageData(2, 268, 1, 1).data;
    derived.skyFill = `rgb(${top[0]},${top[1]},${top[2]})`;
    derived.groundFill = `rgb(${bottom[0]},${bottom[1]},${bottom[2]})`;
  }
  // The sight cone keeps its original gradient, but its faint far end is
  // raised to a visible minimum so the WHOLE detection area can be seen.
  {
    const [c, x] = makeCanvas(176, 47, true);
    x.drawImage(img.cone, 0, 0);
    const data = x.getImageData(0, 0, 176, 47);
    for (let i = 3; i < data.data.length; i += 4)
      if (data.data[i] > 0) data.data[i] = Math.max(data.data[i], 120);
    x.putImageData(data, 0, 0);
    derived.cones = {};
    for (const [name, tint, amount] of [
      ["calm", null, 0],
      ["suspect", "#ff9b3d", 0.55],
      ["alert", "#ff3b30", 0.7],
      ["calmRed", "#ffd2c4", 0.25],
    ]) {
      const [t, tx] = makeCanvas(176, 47);
      tx.drawImage(c, 0, 0);
      if (tint) {
        tx.globalCompositeOperation = "source-atop";
        tx.globalAlpha = amount;
        tx.fillStyle = tint;
        tx.fillRect(0, 0, 176, 47);
      }
      derived.cones[name] = t;
    }
  }
  // Drained (grey) card: luminance copy of the green sheet.
  {
    const [c, x] = makeCanvas(img.cardGreen.width, img.cardGreen.height, true);
    x.drawImage(img.cardGreen, 0, 0);
    const data = x.getImageData(0, 0, c.width, c.height);
    for (let i = 0; i < data.data.length; i += 4) {
      const l = data.data[i] * 0.3 + data.data[i + 1] * 0.59 + data.data[i + 2] * 0.11;
      data.data[i] = data.data[i + 1] = data.data[i + 2] = l;
    }
    x.putImageData(data, 0, 0);
    derived.cardGrey = c;
  }
  // Darkened tileset for the back-wall layer (the original tilemap_no_col).
  {
    const [c, x] = makeCanvas(320, 192);
    x.drawImage(img.tiles, 0, 0);
    x.globalCompositeOperation = "source-atop";
    x.fillStyle = "rgba(12,6,18,0.62)";
    x.fillRect(0, 0, 320, 192);
    derived.tilesDark = c;
  }
  // Dim (spent dash) and flash (refill) versions of each Rubik sheet.
  for (const color of ["white", "green", "red"]) {
    for (const [suffix, fill] of [
      // Spent air dash: a light shade (the form's colour still reads).
      ["Dim", "rgba(30,28,48,0.28)"],
      ["Flash", "rgba(255,255,255,0.8)"],
      // Dash afterimages: solid silhouettes in the form's own colour.
      ["Ghost", { white: "#dfeeff", green: "#8ee05a", red: "#ff6a52" }[color]],
    ]) {
      const [c, x] = makeCanvas(192, 224);
      x.drawImage(img[color], 0, 0);
      x.globalCompositeOperation = "source-atop";
      x.fillStyle = fill;
      x.fillRect(0, 0, 192, 224);
      derived[color + suffix] = c;
    }
  }
  bakeTiles();
}

// ------------------------------------------------------------------ tiles --
// Auto-tiling lives in level.mjs (pure, tested); the renderer only bakes it.
const CHUNK = 32; // tiles per baked chunk (1024 px): small enough for mobile canvases
/** Two baked layers: the dark back wall is drawn BEHIND the sight cones (so a
 * cone inside the corridor stays visible), the solid tiles in front of them. */
function bakeTiles(level = LV) {
  if (!assetsReady && !img.tiles) return;
  derived.bakedFor = level.id;
  derived.back = [];
  derived.chunks = [];
  for (let c0 = 0; c0 < level.cols; c0 += CHUNK) {
    const [b, bx] = makeCanvas(CHUNK * T, B.ROWS * T),
      [c, x] = makeCanvas(CHUNK * T, B.ROWS * T);
    for (let ty = 0; ty < B.ROWS; ty++)
      for (let tx = c0; tx < Math.min(level.cols, c0 + CHUNK); tx++) {
        const dx = (tx - c0) * T,
          dy = ty * T;
        if (level.back[ty][tx] === "b") {
          const [ax, ay] = B.backCell(tx, ty);
          bx.drawImage(derived.tilesDark, ax * 16, ay * 16, 16, 16, dx, dy, T, T);
        }
        const ch = level.map[ty][tx];
        if (ch === "#" || ch === "=") {
          const [ax, ay] = ch === "#" ? B.tileCell(level, tx, ty) : B.ledgeCell(level, tx, ty);
          x.drawImage(img.tiles, ax * 16, ay * 16, 16, 16, dx, dy, T, T);
        }
      }
    derived.back.push(b);
    derived.chunks.push(c);
  }
}

// ---------------------------------------------------------------- state ----
let LV = getLevel(save.last) || LEVELS[0],
  game = M.createGame(LV.id, C.gameOptions(save, LV.id)),
  screen = "boot",
  screenTime = 0,
  manual = false,
  lastFrame = performance.now(),
  inputMode = matchMedia("(pointer: coarse)").matches ? "touch" : "keyboard",
  coarsePointer = matchMedia("(pointer: coarse)").matches,
  lastEventId = 0,
  lastRespawns = 0,
  clock = 0; // wall clock for decoration (never affects the simulation)
const cam = { x: 0, y: 164, shake: 0, look: 80 };
/** Canvas px hidden at each side by the portrait play crop (HUD pulls in). */
let hudInset = 0;
const fx = { vaultOpen: 0, particles: [], flash: 0, flashColor: "#fff", reverse: -1, iris: 0, irisDir: 0, intro: null, get: null, refill: 0, swirl: null, clear: 0, chipDeal: {}, locked: 0, death: null, goal: 0, goalColor: null, result: null };
/** World-map state: the node Rubik stands on, his walk between nodes, the
 * chalk path that draws in after a new unlock. */
const map = { cursor: 0, from: 0, walk: 1, reveal: null, prompt: 0 };
let colorAmount = 0;
/** Input. `keysDown` is the physical state (every screen, updated at once);
 * `held` and `pulses` are what the simulation sees. During play every change
 * goes through `stepper` stamped with its event time and is applied on the tick
 * that time falls in (loop.mjs), so timing windows are the same at any frame
 * rate. Rules (tests/movement-audit.test.mjs, A3): a direction held is held
 * whenever play is live (also through a pause and into a level); presses only
 * count when made in play, on the level card or on the comic skip; after a
 * death the model locks directions held since the death until released. */
const keysDown = new Set();
const held = new Set();
const pulses = { jump: false, jumpReleased: false, dash: false, color: undefined };
const stepper = new FixedStep();

// ----------------------------------------------------------------- audio ---
let audio = null;
function audioContext() {
  if (!audio) {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    try {
      // 32 kHz keeps the decoded track (~75 MB as float PCM) affordable.
      audio = new Ctx({ sampleRate: 32000 });
    } catch {
      try {
        audio = new Ctx();
      } catch {
        audio = null;
      }
    }
  }
  if (audio && audio.state === "suspended") audio.resume().catch(() => {});
  return audio;
}
/** Tiny synthesized cues: a distinct sound for every state change. */
const SOUNDS = {
  jump: [["square", 330, 520, 0.07, 0.05]],
  airjump: [["square", 440, 760, 0.08, 0.05]],
  land: [["triangle", 140, 90, 0.05, 0.06]],
  dash: [["noise", 900, 300, 0.12, 0.06]],
  stomp: [["square", 200, 620, 0.1, 0.07]],
  bounce: [["square", 180, 560, 0.1, 0.06]],
  drain: [["sine", 300, 900, 0.3, 0.06]],
  absorb: [["triangle", 523, 523, 0.08, 0.06], ["triangle", 659, 659, 0.08, 0.06, 0.08], ["triangle", 784, 784, 0.14, 0.06, 0.16]],
  swap: [["triangle", 660, 990, 0.08, 0.05]],
  refill: [["square", 1200, 1200, 0.03, 0.04], ["sine", 1600, 1800, 0.1, 0.05, 0.03]],
  sticker: [["square", 988, 988, 0.06, 0.05], ["square", 1319, 1319, 0.14, 0.05, 0.06]],
  suspect: [["sine", 500, 700, 0.12, 0.05]],
  spotted: [["square", 880, 880, 0.06, 0.06], ["square", 1175, 1175, 0.1, 0.06, 0.07]],
  windup: [["sawtooth", 220, 330, 0.25, 0.03]],
  bump: [["triangle", 160, 80, 0.12, 0.08]],
  smash: [["noise", 600, 120, 0.25, 0.1]],
  knock: [["square", 300, 120, 0.12, 0.08]],
  theft: [["sawtooth", 196, 392, 0.5, 0.06], ["square", 523, 1046, 0.4, 0.05, 0.05]],
  get: [["square", 392, 392, 0.1, 0.05], ["square", 523, 523, 0.1, 0.05, 0.1], ["square", 659, 659, 0.1, 0.05, 0.2], ["square", 784, 784, 0.12, 0.05, 0.3], ["square", 1046, 1046, 0.35, 0.05, 0.42]],
  goal: [["triangle", 784, 784, 0.08, 0.06], ["triangle", 988, 988, 0.08, 0.06, 0.08], ["triangle", 1175, 1175, 0.22, 0.06, 0.16]],
  tally: [["square", 1319, 1319, 0.05, 0.04]],
  step: [["triangle", 330, 330, 0.04, 0.04]],
  unlock: [["sine", 523, 784, 0.25, 0.05], ["sine", 784, 1046, 0.3, 0.04, 0.2]],
  checkpoint: [["sine", 784, 784, 0.08, 0.05], ["sine", 1046, 1046, 0.16, 0.05, 0.08]],
  die: [["square", 440, 110, 0.35, 0.06]],
  win: [["square", 523, 523, 0.1, 0.06], ["square", 659, 659, 0.1, 0.06, 0.1], ["square", 784, 784, 0.1, 0.06, 0.2], ["square", 1046, 1046, 0.3, 0.06, 0.3]],
  locked: [["square", 110, 100, 0.12, 0.05]],
  spike: [["square", 1400, 900, 0.05, 0.05], ["triangle", 220, 120, 0.12, 0.06, 0.02]],
  dashjump: [["noise", 1100, 400, 0.1, 0.05], ["square", 520, 820, 0.08, 0.04]],
  hint: [["sine", 660, 880, 0.08, 0.03]],
  ui: [["square", 700, 700, 0.03, 0.03]],
};
function play(name) {
  // Paused means silent (user request, rev 4): no new cues while paused, and
  // calling audioContext() here would otherwise resume the suspended context.
  if (!settings.sfx || !SOUNDS[name] || game.phase === "paused") return;
  const a = audioContext();
  if (!a) return;
  const now = a.currentTime;
  for (const [type, f0, f1, dur, vol, delay = 0] of SOUNDS[name]) {
    const t0 = now + delay,
      gain = a.createGain();
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    gain.connect(a.destination);
    if (type === "noise") {
      const buffer = a.createBuffer(1, Math.ceil(a.sampleRate * dur), a.sampleRate),
        d = buffer.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      const src = a.createBufferSource(),
        filter = a.createBiquadFilter();
      src.buffer = buffer;
      filter.type = "bandpass";
      filter.frequency.setValueAtTime(f0, t0);
      filter.frequency.exponentialRampToValueAtTime(f1, t0 + dur);
      src.connect(filter).connect(gain);
      src.start(t0);
    } else {
      const osc = a.createOscillator();
      osc.type = type;
      osc.frequency.setValueAtTime(f0, t0);
      osc.frequency.exponentialRampToValueAtTime(f1, t0 + dur);
      osc.connect(gain);
      osc.start(t0);
      osc.stop(t0 + dur + 0.02);
    }
  }
}
/** Music plays through Web Audio from one finished download, decoded once:
 * a media element keeps a request open (and every page change would cancel
 * it); a completed fetch plus an AudioBuffer leaves nothing in flight. It is
 * on by default but nothing is requested before the player's first key/tap. */
const track = { buffer: null, loading: null, source: null, gain: null, startedAt: 0, offset: 0, rate: 1 };
function loadMusic() {
  track.loading ??= fetch("./assets/track.mp3")
    .then((response) => {
      if (!response.ok) throw new Error("track unavailable");
      return response.arrayBuffer();
    })
    .then((data) => audioContext()?.decodeAudioData(data))
    .then((buffer) => {
      track.buffer = buffer || null;
    })
    .catch(() => {
      track.loading = null;
    });
  return track.loading;
}
function musicPosition() {
  return track.source ? track.offset + (audio.currentTime - track.startedAt) * track.rate : track.offset;
}
function stopMusic() {
  if (!track.source) return;
  track.offset = musicPosition() % track.buffer.duration;
  track.source.stop();
  track.source.disconnect();
  track.source = null;
}
function syncMusic() {
  const wanted = settings.music && ["story", "play", "results", "map", "world"].includes(screen) && game.phase !== "paused" && !menuOpen;
  if (!wanted) return stopMusic();
  const a = audioContext();
  if (!a) return;
  if (!track.buffer) {
    loadMusic().then(() => track.buffer && syncMusic());
    return;
  }
  // The original track "changes gear" for the getaway (Pizza Tower-style).
  const rate = game.stolen && game.phase !== "won" ? 1.12 : 1;
  if (track.source && rate !== track.rate) {
    track.offset = musicPosition();
    track.startedAt = a.currentTime;
    track.source.playbackRate.value = rate;
  }
  track.rate = rate;
  if (track.source) return;
  track.gain ??= a.createGain();
  track.gain.gain.value = 0.3;
  track.gain.connect(a.destination);
  const source = a.createBufferSource();
  source.buffer = track.buffer;
  source.loop = true;
  source.playbackRate.value = rate;
  source.connect(track.gain);
  source.start(0, track.offset % track.buffer.duration);
  track.source = source;
  track.startedAt = a.currentTime;
}

// --------------------------------------------------------------- screens ---
const ui = {
  start: $("start"),
  pause: $("pause"),
  music: $("music"),
  pauseCard: $("pause-card"),
  resume: $("resume"),
  results: $("results-actions"),
  live: $("live"),
  touch: $("touch"),
  panel: $("pause-panel"),
};
function setScreen(name) {
  screen = name;
  screenTime = 0;
  menuOpen = false;
  ui.pauseCard.hidden = true;
  document.documentElement.dataset.screen = name;
  ui.start.hidden = name !== "title";
  ui.results.hidden = !["results", "world"].includes(name);
  // On the world clear there is nothing to retry; on a level clear, Retry.
  $("again").hidden = name !== "results";
  ui.pause.hidden = !["play", "map"].includes(name);
  syncTouch();
  syncMusic();
  if (["results", "world"].includes(name)) setTimeout(() => $("continue").focus({ preventScroll: true }), 50);
  announce(
    {
      title: "Color Theft Story. Press any key to start.",
      story: "Story. Press any key to skip.",
      play: `${LV.id} ${LV.name}.`,
      results: `${LV.id} ${LV.name} clear!`,
      map: `World 1, Green Forest. ${LV.id} ${LV.name}. Left and right choose a level, Enter plays.`,
      world: "World clear! You got your red back!",
      ending: "Thanks for playing! That's it by now.",
    }[name] || "",
  );
}
function announce(text) {
  if (ui.live && text) ui.live.textContent = text;
}
function focusGame() {
  canvas.focus({ preventScroll: true });
}
function beginFrontEnd() {
  if (!assetsReady || screen !== "title") return;
  audioContext();
  // The first visit sees the comic, then 1-1; returning players go to the map.
  if (save.comicSeen) openMap();
  else setScreen("story");
  focusGame();
}
/** Into a level. The kit always comes from the level (fixed on replays); the
 * save only supplies the hint budget and the stickers already owned.
 * intro: show the level card (1 s, 0.5 s once cleared) with the model held
 * for its first 0.4 s; any key skips it and counts as input. */
function startLevel(id, { intro = true, skipIntro = false } = {}) {
  const level = getLevel(id);
  if (!level) return false;
  LV = level;
  newGame();
  if (!save.comicSeen) {
    save.comicSeen = true;
    persist();
  }
  setScreen("play");
  // The Rubik-face iris opens on the level; reduced motion cuts straight in.
  fx.iris = reducedMotion ? 0 : 1;
  fx.irisDir = reducedMotion ? 0 : -1;
  fx.intro = intro ? { age: 0, dur: C.isCleared(save, id) ? 0.5 : 1, skipped: skipIntro } : null;
  focusGame();
  return true;
}
function newGame() {
  game = M.createGame(LV.id, C.gameOptions(save, LV.id));
  M.startGame(game);
  syncHeld(); // a direction still held from the map counts; no press carries over
  if (derived.bakedFor !== LV.id && assetsReady) bakeTiles(LV);
  lastEventId = game.eventId;
  lastRespawns = 0;
  fx.particles = [];
  fx.reverse = -1;
  fx.vaultOpen = 0;
  fx.clear = 0;
  fx.death = null;
  fx.chipDeal = {};
  fx.get = null;
  fx.reverseDelay = 0;
  fx.goal = 0;
  fx.goalColor = null;
  fx.result = null;
  colorAmount = C.forestColor(save);
  snapCamera();
}
/** The world map, with Rubik on `id` (default: the save's next level). */
function openMap(id = save.last) {
  const index = Math.max(0, C.levelIndex(id));
  map.cursor = map.from = index;
  map.walk = 1;
  LV = getLevel(C.WORLD1[index]);
  setScreen("map");
  fx.iris = reducedMotion ? 0 : 1;
  fx.irisDir = reducedMotion ? 0 : -1;
  focusGame();
}
/** The map's menu reuses the pause card (settings, Controls, Art, Credits and
 * Reset progress); it never touches a game in progress. */
let menuOpen = false;
function toggleMapMenu(force) {
  menuOpen = force ?? !menuOpen;
  ui.pauseCard.hidden = !menuOpen;
  ui.pauseCard.dataset.mode = "map";
  if (menuOpen) {
    held.clear();
    clearPulses();
    showPanel("menu");
    setTimeout(() => ui.resume.focus({ preventScroll: true }), 0);
  } else focusGame();
  syncMusic();
  if (menuOpen && audio?.state === "running") audio.suspend().catch(() => {});
}
function togglePause(force) {
  if (screen === "map") return toggleMapMenu(force);
  if (screen !== "play") return;
  ui.pauseCard.dataset.mode = "play";
  const pausing = force ?? game.phase === "playing";
  if (pausing && ["playing", "dead"].includes(game.phase)) {
    game.resumePhase = game.phase;
    game.phase = "paused";
    held.clear();
    clearPulses();
    stepper.clear();
    ui.pauseCard.hidden = false;
    showPanel("menu");
    setTimeout(() => ui.resume.focus({ preventScroll: true }), 0);
  } else if (!pausing && game.phase === "paused") {
    game.phase = game.resumePhase || "playing";
    ui.pauseCard.hidden = true;
    // Directions held through the pause apply at once (keysDown kept
    // tracking them); a jump let go during the pause ends the hold now.
    syncHeld();
    if (game.player.jumpHeld && !KEY.jump.some((k) => keysDown.has(k))) pulses.jumpReleased = true;
    focusGame();
  }
  syncMusic();
  // Pausing freezes ALL audio, including SFX tails already in flight: the
  // music position was saved by stopMusic(), then the context is suspended.
  // syncMusic() -> audioContext() resumes it when play continues.
  if (game.phase === "paused" && audio?.state === "running") audio.suspend().catch(() => {});
}
function showPanel(name) {
  for (const el of ui.pauseCard.querySelectorAll("[data-panel]")) el.hidden = el.dataset.panel !== name;
  const first = ui.pauseCard.querySelector(`[data-panel="${name}"] button, [data-panel="${name}"] a`);
  if (name !== "menu" && first) first.focus({ preventScroll: true });
}
function syncSettingsLabels() {
  // Toggle chips carry their state in aria-pressed (styled as on/off).
  for (const id of ["opt-sfx", "opt-music", "opt-timer"]) $(id).setAttribute("aria-pressed", String(settings[id.slice(4)]));
  $("opt-assist").setAttribute("aria-pressed", String(settings.slowSpotting));
  // Less motion shows the effective state; "(system)" until the player picks.
  $("opt-motion").setAttribute("aria-pressed", String(reducedMotion));
  $("opt-motion").dataset.source = settings.reduceMotion === null ? "system" : "player";
  ui.music.setAttribute("aria-pressed", String(settings.music));
  ui.music.classList.toggle("off", !settings.music);
  ui.music.title = settings.music ? "Music on" : "Music off";
}
function toggleSetting(key) {
  settings[key] = !settings[key];
  persist();
  syncSettingsLabels();
  syncMusic();
  play("ui");
}

// ------------------------------------------------------------------ input --
const KEY = {
  left: ["arrowleft", "a"],
  right: ["arrowright", "d"],
  jump: [" ", "arrowup", "w"],
  dash: ["shift", "k", "j"],
  white: ["z", "1"],
  green: ["x", "2"],
  red: ["c", "3"],
};
const gameKeys = new Set(Object.values(KEY).flat());
function clearPulses() {
  pulses.jump = pulses.jumpReleased = pulses.dash = false;
  pulses.color = undefined;
}
function nativeActivation(event, key) {
  // Space/Enter belong to a focused native control (Pause, Resume, menu items).
  return (key === " " || key === "enter") && event.target instanceof Element && event.target.closest("button, a, input, select, textarea");
}
function queueKey(key) {
  if (KEY.jump.includes(key)) pulses.jump = true;
  if (KEY.dash.includes(key)) pulses.dash = true;
  if (KEY.white.includes(key)) pulses.color = "white";
  if (KEY.green.includes(key)) pulses.color = "green";
  if (KEY.red.includes(key)) pulses.color = "red";
}
/** Apply one input change to what the simulation sees: a keyboard key
 * ({key, down, repeat}), a touch pad ({pad, down}) or a pulse ({pulse, value}). */
function applyChange(c) {
  if (c.pulse) pulses[c.pulse] = c.value ?? true;
  else if (c.pad) {
    if (c.down) held.add(c.pad);
    else held.delete(c.pad);
  } else if (c.down) {
    held.add(c.key);
    if (!c.repeat) queueKey(c.key);
  } else {
    held.delete(c.key);
    if (KEY.jump.includes(c.key)) pulses.jumpReleased = true;
  }
}
/** During live play a change is stamped and waits for its tick; elsewhere
 * (menus, pause) it applies at once. */
function inputChange(time, change) {
  if (screen === "play" && game.phase !== "paused") stepper.push(time, change);
  else applyChange(change);
}
/** What the simulation holds = what is physically down (a new level, a
 * resume). Presses are never replayed: only a fresh press is a pulse. */
function syncHeld() {
  held.clear();
  for (const key of keysDown) held.add(key);
  clearPulses();
  stepper.clear();
}
addEventListener("keydown", (event) => {
  const key = event.key.toLowerCase();
  if (event.metaKey || event.ctrlKey || event.altKey) return;
  inputMode = "keyboard";
  syncTouch();
  if (nativeActivation(event, key)) return;
  if (gameKeys.has(key)) keysDown.add(key); // physical state, on every screen
  if (screen === "boot") return;
  if (screen === "title") {
    if (!event.repeat && key !== "tab") {
      event.preventDefault();
      beginFrontEnd();
    }
    return;
  }
  if (screen === "story") {
    if (event.repeat || key === "tab") return;
    event.preventDefault();
    // The key that skips the comic also counts as input (it is held), but the
    // "1-1 Home Cliff" card still shows: play goes live at 0.4 s as usual.
    startLevel(C.WORLD1[0]);
    if (gameKeys.has(key)) stepper.push(event.timeStamp, { key, down: true });
    return;
  }
  if (screen === "ending") {
    if (!event.repeat && key !== "tab") {
      event.preventDefault();
      setScreen("title");
    }
    return;
  }
  if (["results", "world"].includes(screen)) {
    // Native buttons own these; arrows move focus between Continue and Retry.
    if (key.startsWith("arrow")) {
      event.preventDefault();
      const buttons = [...ui.results.querySelectorAll("button:not([hidden])")],
        at = buttons.indexOf(document.activeElement),
        step = key === "arrowleft" || key === "arrowup" ? -1 : 1;
      buttons[(Math.max(0, at) + step + buttons.length) % buttons.length]?.focus({ preventScroll: true });
    }
    return;
  }
  if (screen === "map") {
    if (menuOpen) {
      if ((key === "escape" || key === "p") && !event.repeat) {
        event.preventDefault();
        toggleMapMenu(false);
      } else if (key === "arrowdown" || key === "arrowup") {
        event.preventDefault();
        moveMenuFocus(key === "arrowdown" ? 1 : -1);
      }
      return;
    }
    if (event.repeat && !["arrowleft", "arrowright", "a", "d"].includes(key)) return;
    if (key === "escape" || key === "p") {
      event.preventDefault();
      toggleMapMenu(true);
    } else if (KEY.left.includes(key) || KEY.right.includes(key)) {
      event.preventDefault();
      mapStep(KEY.left.includes(key) ? -1 : 1);
    } else if (key === "enter" || KEY.jump.includes(key)) {
      event.preventDefault();
      mapEnter();
    }
    return;
  }
  // The level card: any fresh key skips it (and still counts as input below);
  // the auto-repeat of a key held from the map does not.
  if (fx.intro && !fx.intro.skipped && game.phase === "playing" && !event.repeat) fx.intro.skipped = true;
  if (game.phase === "paused") {
    if ((key === "escape" || key === "p") && !event.repeat) {
      event.preventDefault();
      togglePause(false);
    } else if (key === "arrowdown" || key === "arrowup") {
      event.preventDefault();
      moveMenuFocus(key === "arrowdown" ? 1 : -1);
    }
    return;
  }
  if ((key === "escape" || key === "p") && !event.repeat) {
    event.preventDefault();
    togglePause(true);
    return;
  }
  if (key === "r" && !event.repeat) {
    event.preventDefault();
    retryCheckpoint();
    return;
  }
  if (!gameKeys.has(key)) return;
  event.preventDefault();
  stepper.push(event.timeStamp, { key, down: true, repeat: event.repeat });
});
addEventListener("keyup", (event) => {
  const key = event.key.toLowerCase();
  if (nativeActivation(event, key) && !keysDown.has(key)) return;
  keysDown.delete(key);
  inputChange(event.timeStamp, { key, down: false });
});
function moveMenuFocus(step) {
  const items = [...ui.pauseCard.querySelectorAll("[data-panel]:not([hidden]) button, [data-panel]:not([hidden]) a")];
  const index = items.indexOf(document.activeElement);
  items[(index + step + items.length) % items.length]?.focus({ preventScroll: true });
}
addEventListener("blur", () => {
  // Key-ups are invisible while the window is unfocused: forget everything
  // (the OS key repeat re-adds a key still held on return).
  keysDown.clear();
  syncHeld();
  if (screen === "play" && game.phase === "playing") togglePause(true);
});
document.addEventListener("visibilitychange", () => {
  if (document.hidden && screen === "play" && game.phase === "playing") togglePause(true);
});

// Pointer: tapping the stage on title/story/ending screens advances; on the
// map, tapping a node walks there and tapping the current node enters it.
canvas.addEventListener("pointerdown", (event) => {
  if (event.pointerType === "touch") inputMode = "touch";
  syncTouch();
  if (screen === "story") startLevel(C.WORLD1[0]);
  else if (screen === "ending") setScreen("title");
  else if (screen === "map" && !menuOpen) {
    const box = canvas.getBoundingClientRect(),
      x = ((event.clientX - box.left) / box.width) * W,
      y = ((event.clientY - box.top) / box.height) * H;
    const index = MAP_NODES.findIndex((n) => Math.abs(n.x - x) < 60 && y > n.y - 140 && y < n.y + 60);
    if (index < 0) return;
    if (index === map.cursor && map.walk >= 1) mapEnter();
    else if (C.isUnlocked(save, C.WORLD1[index])) mapGo(index);
    else play("locked");
  }
});
ui.start.addEventListener("click", () => beginFrontEnd());
ui.pause.addEventListener("click", () => togglePause());
ui.resume.addEventListener("click", () => togglePause(false));
ui.music.addEventListener("click", (event) => {
  event.stopPropagation();
  toggleSetting("music");
});
$("opt-sfx").addEventListener("click", () => toggleSetting("sfx"));
$("opt-music").addEventListener("click", () => toggleSetting("music"));
$("opt-timer").addEventListener("click", () => toggleSetting("timer"));
$("opt-assist").addEventListener("click", () => {
  toggleSetting("slowSpotting");
  // Applies at once to the level in play; the run is then assisted.
  M.setSlowSpotting(game, settings.slowSpotting);
});
$("opt-motion").addEventListener("click", () => {
  settings.reduceMotion = !reducedMotion;
  syncMotion();
  persist();
  syncSettingsLabels();
  play("ui");
});
$("opt-retry").addEventListener("click", () => {
  togglePause(false);
  retryCheckpoint();
});
$("opt-restart").addEventListener("click", () => {
  ui.pauseCard.hidden = true;
  startLevel(LV.id, { intro: false });
});
$("opt-map").addEventListener("click", () => {
  ui.pauseCard.hidden = true;
  game.phase = "paused";
  rememberHints();
  openMap(LV.id);
});
$("opt-reset-yes").addEventListener("click", () => {
  // Erases clears, stickers, stamps and the hint budget; settings stay.
  save = C.resetSave(storage, settings);
  play("ui");
  toggleMapMenu(false);
  openMap(C.WORLD1[0]);
  announce("Progress erased. World 1 starts again at 1-1.");
});
for (const button of document.querySelectorAll("[data-show]")) button.addEventListener("click", () => showPanel(button.dataset.show));
$("continue").addEventListener("click", () => {
  if (screen === "world") return setScreen("ending");
  // 1-6 is World 1's finale: its clear goes on to the world clear.
  if (LV.id === C.WORLD1[C.WORLD1.length - 1]) return setScreen("world");
  openMap(save.last);
  // A first clear draws the chalk path to the next node, then Rubik walks it.
  if (fx.result?.unlocked) {
    map.reveal = { to: C.levelIndex(fx.result.unlocked), age: 0 };
    map.cursor = map.from = Math.max(0, C.levelIndex(fx.result.unlocked) - 1);
    LV = getLevel(C.WORLD1[map.cursor]);
  }
});
$("again").addEventListener("click", () => startLevel(LV.id, { intro: false }));
// ------------------------------------------------------------- world map --
/** Six nodes 140 px apart on a slab path whose top is y = 400: each a chalk
 * face on a stick above the path (1-6 is the vault). Rubik walks the path. */
const MAP_NODES = C.WORLD1.map((id, i) => ({ id, x: 130 + i * 140, y: 400 }));
const MAP_WALK = 0.35; // s per node (reduced motion snaps)
function mapGo(index) {
  if (index === map.cursor || !C.isUnlocked(save, C.WORLD1[index])) return;
  map.from = map.cursor;
  map.cursor = index;
  map.walk = reducedMotion ? 1 : 0;
  LV = getLevel(C.WORLD1[index]);
  play("step");
  announce(`${LV.id} ${LV.name}${C.isCleared(save, LV.id) ? ", cleared" : ""}. ${C.levelRecord(save, LV.id).stickers.length} of 3 stickers.`);
}
function mapStep(dir) {
  const target = map.cursor + dir;
  if (target < 0 || target >= C.WORLD1.length) return;
  if (!C.isUnlocked(save, C.WORLD1[target])) {
    play("locked");
    map.prompt = 0.4;
    return;
  }
  mapGo(target);
}
function mapEnter() {
  if (map.walk < 1 || map.reveal) return;
  const id = C.WORLD1[map.cursor];
  if (!C.isUnlocked(save, id)) return;
  play("ui");
  startLevel(id);
}
function updateMap(dt) {
  if (map.walk < 1) map.walk = Math.min(1, map.walk + dt / MAP_WALK);
  map.prompt = Math.max(0, map.prompt - dt);
  if (map.reveal) {
    map.reveal.age += dt;
    // The path draws in for 0.6 s, then Rubik walks to the new node.
    if (map.reveal.age >= (reducedMotion ? 0 : 0.6)) {
      const to = map.reveal.to;
      map.reveal = null;
      play("unlock");
      mapGo(to);
    }
  }
}
/** Save the hint budget the player has used so far (a hint never comes back). */
function rememberHints() {
  const next = C.mergeHints(save, game.hints);
  if (JSON.stringify(next.hints) !== JSON.stringify(save.hints)) {
    save = next;
    persist();
  }
}
function retryCheckpoint() {
  if (screen !== "play" || !["playing", "dead"].includes(game.phase)) return;
  // A retry is a respawn: the whole segment snapshot is restored, so it can't
  // be used to farm anything; it simply isn't counted as a death.
  M.respawn(game);
  snapCamera();
}
// Touch pads: pointerdown queues immediately; keyboard/assistive "click"
// (detail = 0) is the only click handled, so taps never double-fire.
for (const button of document.querySelectorAll("[data-input],[data-action],[data-color]")) {
  const activate = () => {
    if (screen === "story") startLevel(C.WORLD1[0]);
    // On the map the deck still works: arrows walk, JUMP enters.
    if (screen === "map" && !menuOpen) {
      if (button.dataset.input) mapStep(button.dataset.input === "left" ? -1 : 1);
      else if (button.dataset.action === "jump") mapEnter();
      return false;
    }
    if (screen !== "play") return false;
    if (fx.intro) fx.intro.skipped = true;
    return true;
  };
  button.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    inputMode = "touch";
    if (!activate()) return;
    button.setPointerCapture?.(event.pointerId);
    button.classList.add("down");
    const time = event.timeStamp;
    if (button.dataset.input) inputChange(time, { pad: button.dataset.input, down: true });
    if (button.dataset.action) inputChange(time, { pulse: button.dataset.action });
    if (button.dataset.color) inputChange(time, { pulse: "color", value: button.dataset.color });
  });
  for (const type of ["pointerup", "pointercancel", "lostpointercapture"])
    button.addEventListener(type, (event) => {
      // lostpointercapture follows pointerup: release only once.
      if (!button.classList.contains("down")) return;
      button.classList.remove("down");
      if (button.dataset.input) inputChange(event.timeStamp, { pad: button.dataset.input, down: false });
      if (button.dataset.action === "jump") inputChange(event.timeStamp, { pulse: "jumpReleased" });
    });
  button.addEventListener("click", (event) => {
    if (event.detail !== 0 || !activate()) return;
    if (button.dataset.action) inputChange(event.timeStamp, { pulse: button.dataset.action });
    if (button.dataset.color) inputChange(event.timeStamp, { pulse: "color", value: button.dataset.color });
    if (button.dataset.action === "jump") setTimeout(() => inputChange(performance.now(), { pulse: "jumpReleased" }), 120);
  });
}
function getInput() {
  return {
    left: KEY.left.some((k) => held.has(k)) || held.has("left"),
    right: KEY.right.some((k) => held.has(k)) || held.has("right"),
    ...pulses,
  };
}
const portrait = () => matchMedia("(orientation: portrait) and (max-width: 820px)").matches;
const touchPadsShown = () => coarsePointer || inputMode === "touch";
/** Integer scaling where possible: the 960x540 surface is shown at 1x, 2x, 3x
 * when the window allows (crisp, square pixels), otherwise fitted below 1x.
 * Portrait phones use the CSS column layout instead. */
function fitSurface() {
  const surface = $("surface"),
    stage = $("stage");
  if (document.fullscreenElement) {
    const k = Math.min(innerWidth / W, innerHeight / H);
    stage.style.width = Math.floor(W * (k >= 1 ? Math.floor(k) : k)) + "px";
    surface.style.width = "";
    return;
  }
  stage.style.width = "";
  if (portrait() && touchPadsShown()) {
    surface.style.width = "";
    return;
  }
  const embedded = document.documentElement.classList.contains("itch-embed"),
    pad = embedded ? 0 : 16;
  let k = Math.min((innerWidth - pad * 2) / W, (innerHeight - pad * 2) / H);
  if (k < 1) k = Math.min(innerWidth / W, innerHeight / H); // drop the margin before shrinking
  surface.style.width = Math.floor(W * (k >= 1 ? Math.floor(k) : k)) + "px";
}
addEventListener("resize", fitSurface);
document.addEventListener("fullscreenchange", fitSurface);
/** Portrait phones in a level: the canvas is shown taller than 16:9 of the
 * width (CSS crops its sides, see style.css), so measure what is hidden. */
function measureCrop() {
  const view = $("view"),
    sw = view?.clientWidth || 0,
    cw = canvas.clientWidth || 0;
  hudInset = cw > sw + 1 ? ((cw - sw) / 2) * (W / cw) : 0;
}
function syncTouch() {
  const root = document.documentElement,
    was = root.classList.contains("touch-pads");
  root.classList.toggle("touch-mode", inputMode === "touch");
  root.classList.toggle("touch-pads", touchPadsShown());
  if (was !== root.classList.contains("touch-pads")) fitSurface();
  if (!ui.touch) return;
  // Touch devices always keep their pads during play (and the comic, so a tap
  // on JUMP can skip it); a keyboard press only changes the hint glyphs.
  const touchDevice = coarsePointer || inputMode === "touch";
  ui.touch.hidden = !(touchDevice && ["play", "story", "map"].includes(screen));
  // Only the pads of the current kit: no DASH pad before DASH GET, no red
  // card before the theft (and none of the form cards on the map).
  const playing = screen === "play";
  for (const b of ui.touch.querySelectorAll("[data-color]")) {
    b.hidden = !playing || !game.unlocked[b.dataset.color];
    b.classList.toggle("selected", game.player.color === b.dataset.color);
  }
  const dashPad = ui.touch.querySelector('[data-action="dash"]');
  if (dashPad) dashPad.hidden = !playing || !game.dashUnlocked;
}

// ----------------------------------------------------------------- camera --
const maxCamX = () => LV.width - W,
  maxCamY = M.WORLD.height - H;
/** Vertical framing follows the last floor Rubik stood on (Mario-style), so a
 * jump over a pit keeps the water below in view; it only chases him when he
 * would leave the comfortable band of the screen. */
function cameraTarget() {
  const p = game.phase === "dead" && game.deathAt ? game.deathAt : game.player,
    cx = p.x + M.PLAYER.w / 2,
    feet = p.y + M.PLAYER.h;
  if (game.player.grounded || cam.floor === undefined) cam.floor = feet;
  // Touch pads cover the bottom corners in landscape: frame Rubik higher.
  const frame = touchPadsShown() && !portrait() ? 0.56 : 0.7;
  let y = cam.floor - H * frame;
  // Over or near a pit, lean down so the water below is always in view.
  const ahead = game.player.direction * 260;
  for (let x = Math.min(cx, cx + ahead) - 120; x <= Math.max(cx, cx + ahead) + 120; x += T)
    if (LV.map[B.WATER_ROW][Math.floor(x / T)] === "~") {
      y = Math.max(y, B.WATER_ROW * T + 64 - H + 8);
      break;
    }
  const screenFeet = feet - y;
  if (screenFeet < H * 0.3) y = feet - H * 0.3;
  if (screenFeet > H * 0.86) y = feet - H * 0.86;
  return {
    // In the portrait crop the hidden side strips may hang past the level's
    // ends, so Rubik stays in the visible middle even at a level's start.
    x: Math.max(-hudInset, Math.min(maxCamX() + hudInset, cx - W / 2 + cam.look)),
    y: Math.max(0, Math.min(maxCamY, y)),
  };
}
function snapCamera() {
  cam.look = game.player.direction * 90;
  cam.floor = undefined;
  const t = cameraTarget();
  cam.x = t.x;
  cam.y = t.y;
}
function updateCamera(dt) {
  const p = game.player;
  const wantLook = (Math.abs(p.vx) > 40 ? Math.sign(p.vx) : p.direction) * (hudInset > 0 ? 60 : 90);
  cam.look += (wantLook - cam.look) * Math.min(1, dt * 2.5);
  const t = cameraTarget();
  if (manual || reducedMotion) {
    cam.x = t.x;
    cam.y = t.y;
  } else {
    cam.x += (t.x - cam.x) * Math.min(1, dt * 9);
    cam.y += (t.y - cam.y) * Math.min(1, dt * 4);
  }
  cam.shake = Math.max(0, cam.shake - dt * 30);
}

// ------------------------------------------------------------- particles ---
function burst(x, y, count, color, speed = 160, life = 0.5, size = 4, gravity = 600, source) {
  if (reducedMotion) return;
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2 + Math.random() * 0.5,
      s = speed * (0.5 + Math.random() * 0.6);
    fx.particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - speed * 0.4, life, age: 0, color, size, gravity, source });
  }
}
function dust(x, y, dir = 0, count = 5) {
  if (reducedMotion) return;
  for (let i = 0; i < count; i++)
    fx.particles.push({ x: x + (Math.random() - 0.5) * 24, y: y - 2, vx: (dir || (Math.random() - 0.5)) * (40 + Math.random() * 60), vy: -20 - Math.random() * 40, life: 0.35, age: 0, color: "#e8e6dc", size: 4, gravity: 40 });
}
/** GET cards: the new form (or the storm for dash) at 4x, its key, and one
 * caption of at most six words. */
const GET_CARDS = {
  green: { title: "GREEN GET!", caption: "Green cards can't see green.", key: "X", say: "Green get! Green cards can't see green. X for green, Z for white." },
  dash: { title: "DASH GET!", caption: "Dash once per jump.", key: "Shift", touch: "DASH", say: "Dash get! Shift dashes, once per jump. Landing, stomps and orbs refill it." },
  red: { title: "RED GET!", caption: "Red dash smashes stones.", key: "C", say: "Red get! Red dash smashes cracked stones and knocks cards aside. Run home!" },
};
/** Save the clear at the goal and keep what the tally needs. */
function recordWin() {
  const id = LV.id,
    before = C.levelRecord(save, id),
    wasOpen = C.unlockedIds(save),
    collected = game.stickers.filter((x) => x.collected).map((x) => x.id),
    stamps = C.levelStamps(id);
  rememberHints();
  save = C.recordClear(save, id, { time: game.finishTime, stickers: collected, spotted: game.spotted, takedowns: game.takedowns.length, cards: game.guards.length, escapeTime: game.escapeTime, color: game.player.color, assisted: game.assisted });
  persist();
  const after = C.levelRecord(save, id);
  fx.result = {
    id,
    time: game.finishTime,
    best: after.best,
    newBest: before.best === null || game.finishTime < before.best,
    firstClear: !before.clear,
    stickers: game.stickers.map((x) => ({ id: x.id, got: x.collected, owned: x.owned })), // owned = in the save before this run
    // An assisted run shows the stamps it could have earned, unearned.
    assisted: game.assisted,
    unseen: stamps.unseen ? !game.assisted && game.spotted === 0 : null, // the Ghost stamp
    takedown: stamps.takedown ? { got: !game.assisted && !!game.medals?.takedown, n: game.takedowns.length, of: game.guards.length, best: after.takedownBest } : null,
    quick: stamps.quick ? !game.assisted && !!game.medals?.quickGetaway : null,
    unlocked: C.unlockedIds(save).find((x) => !wasOpen.includes(x)) || null,
  };
}
/** Rubik's squash/stretch: scale x/y for `dur` seconds, easing back to 1. */
function squash(sx, sy, dur) {
  if (reducedMotion) return;
  fx.squash = { sx, sy, t: dur, dur };
}
/** Consume new model events: sounds, particles, transitions. */
function handleEvents() {
  for (const e of game.events) {
    if (e.id <= lastEventId) continue;
    lastEventId = e.id;
    play(e.type);
    const p = game.player;
    switch (e.type) {
      case "jump":
      case "land":
        dust(e.x, e.y, 0, e.type === "land" ? 6 : 4);
        // Stretch on takeoff, squash on landing (a beat, never longer).
        if (e.type === "jump") squash(0.86, 1.16, 0.12);
        else if (Math.abs(e.speed ?? 0) > 0 || true) squash(1.18, 0.84, 0.1);
        break;
      case "airjump":
        burst(e.x, e.y, 8, "#f4f1e6", 90, 0.3, 4, 80);
        squash(0.9, 1.12, 0.1);
        break;
      case "dashjump":
        dust(e.x, e.y, -game.player.dashDirection, 8);
        squash(1.2, 0.86, 0.12);
        break;
      case "spike":
        // The raised spear: a bright clink, Rubik popped away (no damage).
        burst(e.x, e.y - 6, 8, "#fbf9f2", 140, 0.3, 3, 200);
        squash(1.15, 0.88, 0.1);
        break;
      case "dash":
        dust(e.x - e.direction * 16, p.y + p.h, -e.direction, 6);
        break;
      case "stomp":
      case "bounce":
        burst(e.x, e.y, 10, "#fff6c4", 150, 0.45);
        squash(0.84, 1.2, 0.14);
        cam.shake = reducedMotion ? 0 : Math.max(cam.shake, 1.5);
        break;
      case "drain":
        fx.swirl = { x: e.x, y: e.y, age: 0 };
        burst(e.x, e.y, 14, "#7fd04b", 170, 0.6);
        break;
      case "absorb":
        fx.flash = reducedMotion ? 0 : 0.25;
        fx.flashColor = "#9be36a";
        break;
      case "get":
        // GET card (Mega Man's weapon get): drawn for the model's 1.2 s
        // hit-stop, then the form card is dealt into the HUD.
        fx.get = { ability: e.ability, age: 0 };
        announce(GET_CARDS[e.ability].say);
        break;
      case "swap":
        burst(p.x + p.w / 2, p.y + p.h / 2, 10, e.color === "green" ? "#7fd04b" : e.color === "red" ? "#ff5a4a" : "#ffffff", 120, 0.35, 4, 100);
        break;
      case "refill":
        fx.refill = 0.14;
        break;
      case "sticker":
        burst(e.x, e.y, 12, "#ffd84a", 140, 0.5, 4, 200);
        // A sticker is the player's for good the moment it is touched.
        save = C.collectSticker(save, LV.id, e.sticker);
        persist();
        announce(`Sticker ${e.count} of 3${e.owned ? " (already yours)" : ""}.`);
        break;
      case "hint":
        rememberHints();
        break;
      case "smash":
        cam.shake = reducedMotion ? 0 : 4;
        for (let i = 0; i < 14; i++)
          fx.particles.push({ x: e.x + (Math.random() - 0.5) * 50, y: e.y + (Math.random() - 0.5) * 50, vx: (Math.random() - 0.5) * 420 + p.dashDirection * 160, vy: -Math.random() * 360, life: 0.9, age: 0, gravity: 1400, size: 16, debris: [128 + (i % 2) * 8, 32 + (i % 4 < 2 ? 0 : 8)] });
        break;
      case "knock":
        burst(e.x, e.y, 12, "#ff7a5a", 200, 0.45);
        cam.shake = reducedMotion ? 0 : 3;
        break;
      case "bump":
        burst(e.x, e.y, 6, "#ffffff", 100, 0.3);
        break;
      case "theft":
        syncMusic(); // gear change
        // The REVERSE card sweeps in once the RED GET card is done.
        fx.reverse = -1;
        fx.reverseDelay = M.WORLD.hitstop.get;
        fx.flash = reducedMotion ? 0 : 0.5;
        fx.flashColor = "#ff3b30";
        cam.shake = reducedMotion ? 0 : 6;
        fx.chipDeal.red = 1;
        burst(e.x, e.y, 26, "#ff4b3a", 260, 0.8, 5, 300);
        break;
      case "die":
        fx.death = { ...game.deathAt, age: 0, reason: e.reason };
        break;
      case "respawn":
        snapCamera();
        fx.death = null;
        break;
      case "checkpoint":
        burst(e.x, e.y - 60, 8, "#ffffff", 80, 0.4, 3, 60);
        break;
      case "spotted":
        announce("Spotted!");
        break;
      case "locked":
        fx.locked = 0.3;
        break;
      case "win":
        syncMusic();
        fx.clear = 0;
        fx.goal = 0;
        fx.goalColor = e.color;
        recordWin();
        announce(game.stolen ? "Home! You got your red back!" : `${LV.id} clear!`);
        break;
    }
  }
}
function updateFx(dt) {
  for (const q of fx.particles) {
    q.age += dt;
    q.vy += q.gravity * dt;
    q.x += q.vx * dt;
    q.y += q.vy * dt;
  }
  fx.particles = fx.particles.filter((q) => q.age < q.life);
  fx.flash = Math.max(0, fx.flash - dt);
  fx.refill = Math.max(0, fx.refill - dt);
  if (fx.squash) {
    fx.squash.t -= dt;
    if (fx.squash.t <= 0) fx.squash = null;
  }
  // Dust kicked up on a sharp turnaround on the ground.
  const pp = game.player;
  if (pp.grounded && fx.lastVx !== undefined && Math.sign(pp.vx) !== Math.sign(fx.lastVx) && Math.abs(fx.lastVx) > 200) dust(pp.x + pp.w / 2, pp.y + pp.h, Math.sign(pp.vx), 5);
  fx.lastVx = pp.vx;
  fx.locked = Math.max(0, fx.locked - dt);
  if (fx.intro) {
    fx.intro.age += dt;
    if (fx.intro.age > fx.intro.dur + 0.4) fx.intro = null;
  }
  if (fx.get) {
    fx.get.age += dt;
    if (fx.get.age > M.WORLD.hitstop.get + 0.1) {
      fx.chipDeal[fx.get.ability === "dash" ? "dash" : fx.get.ability] = 1;
      fx.get = null;
    }
  }
  if (game.phase === "won") fx.goal = Math.min(1, fx.goal + dt * 2.5);
  // The REVERSE card waits out the RED GET card (fx.reverseDelay).
  if (fx.reverseDelay > 0) {
    fx.reverseDelay -= dt;
    if (fx.reverseDelay <= 0) fx.reverse = 0;
  } else if (fx.reverse >= 0) fx.reverse += dt;
  if (fx.reverse > 2.6) fx.reverse = -1;
  if (game.stolen) fx.vaultOpen = Math.min(1, fx.vaultOpen + dt * 2);
  if (fx.swirl) {
    fx.swirl.age += dt;
    if (fx.swirl.age > 0.7) fx.swirl = null;
  }
  if (fx.death) fx.death.age += dt;
  for (const k in fx.chipDeal) fx.chipDeal[k] = Math.max(0, fx.chipDeal[k] - dt * 1.6);
  if (fx.irisDir) {
    fx.iris = Math.max(0, Math.min(1, fx.iris + fx.irisDir * dt * (1 / 0.8)));
    if (fx.iris === 0 || fx.iris === 1) fx.irisDir = 0;
  }
  // The forest regains color with the campaign (0.12 per cleared level) and
  // within a level as Rubik does (Gris): the GETs, the theft, the road home.
  const p = game.player,
    base = C.forestColor(save),
    homeward = game.stolen && LV.home && LV.vault ? 1 - Math.max(0, Math.min(1, (p.x - LV.home.x1) / (LV.vault.cx - LV.home.x1))) : 0,
    target =
      game.phase === "won" && game.stolen
        ? 1
        : Math.min(1, base + (game.gets.includes("green") ? 0.08 : 0) + (game.stolen ? 0.22 + homeward * 0.4 : 0) + (game.phase === "won" ? 0.12 : 0));
  colorAmount += (target - colorAmount) * Math.min(1, dt * (game.phase === "won" ? 1.4 : 2));
}

// ---------------------------------------------------------------- drawing --
function text(str, x, y, size = 32, color = "#fff", align = "left", outline = "#1b1420") {
  ctx.font = `${size}px monogram, ui-monospace, monospace`;
  ctx.textAlign = align;
  ctx.textBaseline = "alphabetic";
  x = Math.round(x);
  y = Math.round(y);
  if (outline) {
    const o = size >= 48 ? 4 : 2;
    ctx.fillStyle = outline;
    for (const [dx, dy] of [[-o, 0], [o, 0], [0, -o], [0, o], [-o, -o], [o, o], [-o, o], [o, -o], [0, o + (size >= 48 ? 2 : 1)]]) ctx.fillText(str, x + dx, y + dy);
  }
  ctx.fillStyle = color;
  ctx.fillText(str, x, y);
}
function roundRect(x, y, w, h, r) {
  ctx.beginPath();
  ctx.roundRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h), r);
}
const COLORS = { white: "#f3f0e4", green: "#5fbf3a", red: "#e8382c" };
/** Color glyphs so form is never told by color alone (Xbox AG 103). */
function glyph(color, x, y, s = 12, ink = "#1b1420") {
  ctx.save();
  ctx.translate(Math.round(x), Math.round(y));
  ctx.fillStyle = ink;
  ctx.strokeStyle = ink;
  ctx.lineWidth = Math.max(2, s / 5);
  if (color === "white") ctx.strokeRect(-s / 2 + 1, -s / 2 + 1, s - 2, s - 2);
  else if (color === "green") {
    ctx.beginPath();
    ctx.moveTo(0, -s / 2);
    ctx.lineTo(s / 2, s / 2);
    ctx.lineTo(-s / 2, s / 2);
    ctx.closePath();
    ctx.fill();
  } else {
    ctx.beginPath();
    ctx.moveTo(0, -s / 2 - 1);
    ctx.lineTo(s / 2 + 1, 0);
    ctx.lineTo(0, s / 2 + 1);
    ctx.lineTo(-s / 2 - 1, 0);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}
/** Uno-style form card: white rounded border, colored field, tilted oval. */
function formCard(color, x, y, w, h, keyLabel, angle = 0, alpha = 1) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(x + w / 2, y + h / 2);
  ctx.rotate(angle);
  ctx.fillStyle = "rgba(10,8,14,0.55)";
  roundRect(-w / 2 + 3, -h / 2 + 4, w, h, 7);
  ctx.fill();
  ctx.fillStyle = "#fbf9f2";
  roundRect(-w / 2, -h / 2, w, h, 7);
  ctx.fill();
  ctx.fillStyle = color === "white" ? "#cfcbbe" : COLORS[color];
  roundRect(-w / 2 + 4, -h / 2 + 4, w - 8, h - 8, 4);
  ctx.fill();
  ctx.fillStyle = "#fbf9f2";
  ctx.beginPath();
  ctx.ellipse(0, 0, w * 0.32, h * 0.36, 0.5, 0, Math.PI * 2);
  ctx.fill();
  glyph(color, 0, 0, w * 0.32, color === "white" ? "#6f6a5e" : COLORS[color]);
  ctx.restore();
  if (keyLabel) {
    const kx = x + w / 2 + Math.cos(angle) * 0,
      ky = y + h + 14;
    keycap(keyLabel, kx, ky, alpha);
  }
}
function keycap(label, x, y, alpha = 1, size = 16) {
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.font = `${size}px monogram, monospace`;
  const w = Math.max(18, ctx.measureText(label).width + 10);
  ctx.fillStyle = "#1b1420";
  roundRect(x - w / 2, y - 12, w, 18, 4);
  ctx.fill();
  ctx.fillStyle = "#fbf9f2";
  roundRect(x - w / 2 + 1, y - 13, w - 2, 16, 3);
  ctx.fill();
  ctx.fillStyle = "#1b1420";
  ctx.textAlign = "center";
  ctx.fillText(label, Math.round(x), Math.round(y));
  ctx.restore();
}

function drawBackground() {
  ctx.fillStyle = derived.skyFill;
  ctx.fillRect(0, 0, W, H);
  const bx = -((cam.x * 0.35) % W),
    by = Math.round((maxCamY - cam.y) * 0.35);
  // bg1-sky continues the drained sky above bg1 (originally at y = -268).
  const sx = -((cam.x * 0.15) % 2880);
  for (const ox of [0, 2880]) {
    ctx.drawImage(img.sky, Math.round(sx + ox), by - 902, 2880, 902);
    if (colorAmount > 0.01) {
      ctx.globalAlpha = colorAmount;
      ctx.drawImage(derived.skyColor, Math.round(sx + ox), by - 902, 2880, 902);
      ctx.globalAlpha = 1;
    }
  }
  for (const ox of [0, W]) {
    ctx.drawImage(img.forest, Math.round(bx + ox), by, W, H);
    if (colorAmount > 0.01) {
      ctx.globalAlpha = colorAmount;
      ctx.drawImage(derived.forestColor, Math.round(bx + ox), by, W, H);
      ctx.globalAlpha = 1;
    }
  }
  ctx.fillStyle = derived.groundFill;
  if (by + H < H) ctx.fillRect(0, by + H, W, H - by - H);
  // The red the cards stole glows from the vault, far beyond the trees, so the
  // goal is visible from the first frame without an arrow or label.
  // Playtest (rev 4): a hard-edged beam with a core line and a floating base
  // ring read as a laser/glitch hanging in the sky. It is now a soft light
  // pillar "screen"-blended over the backdrop: wide feathered column, no core
  // line, brightest where it meets the far treeline (bg1's canopy band sits
  // at y≈190–260 of the 2x art) and fading upward, like light rising from
  // behind the forest. The 0.075 parallax keeps it reading as very distant;
  // it lands centred over the vault room when the camera reaches it.
  // Each level brings the beacon closer (level.beacon 0..1): a faint speck on
  // the horizon in 1-1, the full pillar over the vault in 1-6.
  const tint = TINTS[LV.tint];
  if (tint) {
    ctx.save();
    ctx.globalCompositeOperation = "multiply";
    ctx.fillStyle = tint;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }
  if (!game.stolen) {
    const near = LV.beacon ?? 1,
      anchor = LV.vault ? LV.vault.cx : LV.width + 2400 * (1 - near),
      gx = Math.round(W / 2 + (anchor - (cam.x + W / 2)) * 0.075),
      base = by + 236,
      pulse = (reducedMotion ? 0.85 : 0.8 + Math.sin(clock * 2) * 0.2) * (0.35 + 0.65 * near);
    if (gx > -90 && gx < W + 90) {
      ctx.save();
      ctx.globalCompositeOperation = "screen";
      // feathered column: horizontal falloff × vertical fade
      for (const [half0, alpha] of [
        [44, 0.1],
        [22, 0.16],
        [9, 0.2],
      ]) {
        const half = Math.max(3, Math.round(half0 * (0.3 + 0.7 * near)));
        const v = ctx.createLinearGradient(0, base, 0, base - 300);
        v.addColorStop(0, `rgba(230,70,50,${alpha * pulse})`);
        v.addColorStop(1, "rgba(230,70,50,0)");
        ctx.fillStyle = v;
        ctx.fillRect(gx - half, base - 300, half * 2, 300);
      }
      // glow pooled on the canopy where the light "emerges"
      const g = ctx.createRadialGradient(gx, base, 0, gx, base, 90);
      g.addColorStop(0, `rgba(240,90,60,${0.35 * pulse})`);
      g.addColorStop(1, "rgba(240,90,60,0)");
      ctx.fillStyle = g;
      ctx.save();
      ctx.translate(gx, base);
      ctx.scale(1, 0.4);
      ctx.translate(-gx, -base);
      ctx.fillRect(gx - 90, base - 90, 180, 180);
      ctx.restore();
      // a few motes drifting up (static under reduced motion)
      for (let i = 0; i < 5; i++) {
        const t = reducedMotion ? (i + 0.5) / 5 : (clock * 0.12 + i / 5) % 1,
          sy = base - t * 240;
        ctx.fillStyle = `rgba(255,200,180,${(1 - t) * 0.5 * pulse})`;
        ctx.fillRect(gx - 6 + ((i * 7) % 12), Math.round(sy), 2, 2);
      }
      ctx.restore();
    }
  }
}
/** Time of day per level, multiplied over the backdrop only (tiles, cards and
 * Rubik keep their true colors): 1-4 a storm, 1-5 dusk, 1-6 night. */
const TINTS = { storm: "#a9b6cf", dusk: "#f3c39b", night: "#8d88b8" };
const wx = (x) => Math.round(x - cam.x),
  wy = (y) => Math.round(y - cam.y);
function drawChunks(list) {
  const first = Math.max(0, Math.floor(cam.x / (CHUNK * T)));
  for (let i = first; i <= first + 1 && i < list.length; i++) ctx.drawImage(list[i], wx(i * CHUNK * T), wy(0));
}
function drawTiles() {
  drawChunks(derived.chunks);
  // Water: the right atlas column's five frames at 2x, cropped below their
  // mossy top (that lime fringe read as grass/floor), tinted deeper, with a
  // drawn animated surface so a pit never reads as ground.
  const frame = reducedMotion ? 0 : Math.floor(clock * 5) % 5;
  const c0 = Math.max(0, Math.floor(cam.x / T)),
    c1 = Math.min(LV.cols - 1, Math.ceil((cam.x + W) / T)),
    top = wy(B.WATER_ROW * T);
  for (let tx = c0; tx <= c1; tx++) {
    if (LV.map[B.WATER_ROW][tx] !== "~") continue;
    const x = wx(tx * T),
      sx = 288 + (tx % 2) * 16;
    ctx.drawImage(img.tiles, sx, frame * 32 + 7, 16, 25, x, top + 14, T, 50);
    ctx.fillStyle = "rgba(24,70,170,0.35)";
    ctx.fillRect(x, top + 6, T, 58);
    ctx.fillStyle = "#3d7fe0";
    ctx.fillRect(x, top + 6, T, 8);
    // ripple: two light pixels drifting along each tile, plus foam dashes
    const phase = reducedMotion ? 0 : clock * 40 + tx * 13;
    ctx.fillStyle = "#bfeaff";
    ctx.fillRect(x + Math.floor(phase % 32), top + 6 + (Math.floor(phase / 8) % 2) * 2, 8, 2);
    ctx.fillRect(x + Math.floor((phase * 0.6 + 16) % 32), top + 10, 4, 2);
    ctx.fillStyle = "rgba(255,255,255,0.55)";
    ctx.fillRect(x, top + 4 + Math.round(Math.sin((tx + (reducedMotion ? 0 : clock * 3)) * 1.3) * 1.5), T, 2);
  }
}
function drawStones() {
  for (const s of game.stones) {
    if (s.broken) continue;
    const x = wx(s.x * T),
      y = wy(s.y * T);
    if (x < -80 || x > W + 20) continue;
    // Tile_15's art (atlas cells 8..9 x 2..3) at 2x, plus a crack pattern and
    // red's diamond glyph: "only red breaks this", never told by color alone.
    ctx.drawImage(img.tiles, 128, 32, 32, 32, x, y, 64, 64);
    ctx.strokeStyle = "#3a0b0b";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x + 10, y + 6);
    ctx.lineTo(x + 26, y + 24);
    ctx.lineTo(x + 20, y + 38);
    ctx.lineTo(x + 38, y + 50);
    ctx.lineTo(x + 34, y + 60);
    ctx.moveTo(x + 26, y + 24);
    ctx.lineTo(x + 48, y + 18);
    ctx.lineTo(x + 58, y + 30);
    ctx.stroke();
    ctx.strokeStyle = game.stolen ? "#ff6a50" : "#b8463a";
    ctx.lineWidth = 1;
    ctx.stroke();
    glyph("red", x + 32, y + 32, 10, game.stolen ? "#ff4a3a" : "#9e3a30");
  }
}
/** 1-6 after the theft, while the chamber door is still sealed: the way out
 * reads in the world, not only in the REVERSE caption (shown once). The
 * seal pulses, storm streaks (1-4's dash marks) run from Rubik's side into
 * it, and once the caption has gone the upper stone carries the dash key.
 * Added after the user's playtest stalled in this room (2026-11-10). */
function doorSealed() {
  if (!game.stolen || game.phase === "won") return false;
  // Breaking the low stone opens the doorway (the upper one stays as a
  // lintel), so the cue ends with the first broken seal stone.
  const seal = game.stones.filter((s) => s.sealOnTheft);
  return seal.length > 0 && !seal.some((s) => s.broken);
}
function drawDoorCue() {
  if (!doorSealed()) return;
  const seal = game.stones.filter((s) => s.sealOnTheft),
    x0 = Math.min(...seal.map((s) => s.x)) * T,
    y0 = Math.min(...seal.map((s) => s.y)) * T,
    y1 = (Math.max(...seal.map((s) => s.y)) + 2) * T,
    sx = wx(x0),
    right = wx(x0 + 2 * T),
    floor = wy(y1);
  if (right < -40 || sx > W + 120) return;
  const pulse = reducedMotion ? 0.8 : 0.55 + Math.sin(clock * 5) * 0.35;
  ctx.strokeStyle = `rgba(255,96,72,${pulse.toFixed(3)})`;
  ctx.lineWidth = 3;
  ctx.strokeRect(sx - 2, wy(y0) - 2, 2 * T + 4, y1 - y0 + 4);
  // Streaks at Rubik's body height, flowing left into the seal.
  for (let i = 0; i < 3; i++) {
    const t = reducedMotion ? 0.5 : (clock * 0.9 + i / 3) % 1,
      len = 22 - i * 5,
      px0 = right + 10 + (1 - t) * 70,
      py0 = floor - 46 + i * 13;
    ctx.globalAlpha = reducedMotion ? 0.75 : Math.sin(t * Math.PI) * 0.85;
    ctx.fillStyle = i === 1 ? "#ffd0c4" : "#ffffff";
    ctx.fillRect(Math.round(px0), Math.round(py0), len, 3);
    ctx.fillRect(Math.round(px0), Math.round(py0 - 3), 4, 3);
  }
  ctx.globalAlpha = 1;
  // The sign, in the HUD's own keycap language, once REVERSE has said it.
  if (fx.reverse < 0 && !(fx.reverseDelay > 0) && !fx.get) {
    const bob = reducedMotion ? 0 : Math.round(Math.sin(clock * 3) * 2);
    keycap(inputMode === "touch" ? "DASH" : "Shift", sx + T, wy(y0) + 38 + bob, 1, 16);
  }
}
function drawCheckpoints() {
  LV.checkpoints.forEach((cp, index) => {
    if (cp.get) return; // saved by a GET moment: no marker
    // The sign stands 40 px behind the respawn spot (the side Rubik came
    // from), so a respawned Rubik never wears it like a hat.
    const back = LV.home && index >= LV.checkpoints.findIndex((c) => c.get) ? 40 : -40,
      x = wx(cp.x + back),
      y = wy(cp.floor);
    if (x < -60 || x > W + 60) return;
    const active = game.checkpointIndex === index,
      fill = active ? COLORS[game.snapshot?.color || "white"] : null;
    // A chalk 3x3 cube face (the cutout shape) on a stick: home-made, not a
    // platform. It fills with Rubik's color when it is his current checkpoint.
    ctx.fillStyle = "#c9b48a";
    ctx.fillRect(x - 2, y - 30, 4, 30);
    ctx.fillStyle = "#6b5a3e";
    ctx.fillRect(x - 2, y - 30, 1, 30);
    for (let i = 0; i < 9; i++) {
      const cx = x - 16 + (i % 3) * 11,
        cy = y - 64 + Math.floor(i / 3) * 11;
      if (fill) {
        ctx.fillStyle = fill;
        ctx.fillRect(cx + 1, cy + 1, 9, 9);
      }
      ctx.strokeStyle = active ? "#ffffff" : "rgba(244,240,226,0.72)";
      ctx.lineWidth = 2;
      ctx.strokeRect(cx + 1, cy + 1, 9, 9);
    }
  });
}
/** A chalk 3x3 cube face drawn with `cell` px squares (the checkpoint and
 * goal art language: the cutout's shape, home-made, never a platform). */
function chalkFace(x, y, cell, fill, bright, scaleX = 1) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scaleX, 1);
  const size = cell * 3 + 2;
  for (let i = 0; i < 9; i++) {
    const cx = -size / 2 + (i % 3) * cell,
      cy = -size / 2 + Math.floor(i / 3) * cell;
    if (fill) {
      ctx.fillStyle = typeof fill === "function" ? fill(i) : fill;
      ctx.fillRect(cx + 1, cy + 1, cell - 2, cell - 2);
    }
    ctx.strokeStyle = bright ? "#ffffff" : "rgba(244,240,226,0.78)";
    ctx.lineWidth = 2;
    ctx.strokeRect(cx + 1, cy + 1, cell - 2, cell - 2);
  }
  ctx.restore();
}
/** The goal face: the checkpoint face at 2x on a taller stick. Touching it
 * flips it and fills it with Rubik's current color. */
function drawGoal() {
  const goal = LV.goal;
  if (!goal) return;
  const x = wx(goal.x),
    y = wy(goal.floor);
  if (x < -80 || x > W + 80) return;
  ctx.fillStyle = "#c9b48a";
  ctx.fillRect(x - 3, y - 64, 6, 64);
  ctx.fillStyle = "#6b5a3e";
  ctx.fillRect(x - 3, y - 64, 2, 64);
  const won = game.phase === "won",
    k = won ? fx.goal : 0,
    flip = reducedMotion ? 1 : Math.cos(k * Math.PI * 2),
    bob = reducedMotion || won ? 0 : Math.round(Math.sin(clock * 2.2) * 2);
  if (!won) {
    // a soft halo so the goal reads from afar, without words
    const g = ctx.createRadialGradient(x, y - 100 + bob, 4, x, y - 100 + bob, 70);
    g.addColorStop(0, "rgba(255,240,190,0.28)");
    g.addColorStop(1, "rgba(255,240,190,0)");
    ctx.fillStyle = g;
    ctx.fillRect(x - 70, y - 170, 140, 140);
  }
  chalkFace(x, y - 100 + bob, 22, won && k > 0.25 ? COLORS[fx.goalColor || game.player.color] : "rgba(20,16,26,0.35)", won, Math.max(0.08, Math.abs(flip)));
}
/** 1-4's stray storm swirl: rubik_storm frames 1-3 at 2x over a stump. */
/** Storm wisps at the lip of every gap 1-4's main line dashes: the swirl's
 * own streaks drifting across (pointing the way), never text. */
function drawDashMarks() {
  for (const mark of LV.dashMarks || []) {
    const x = wx(mark.x),
      y = wy(mark.floor);
    if (x < -120 || x > W + 60) continue;
    for (let i = 0; i < 3; i++) {
      const t = reducedMotion ? 0.5 : (clock * 0.9 + i / 3) % 1,
        len = 22 - i * 5,
        sx = x + 6 + t * 70,
        sy = y - 46 - i * 13;
      ctx.globalAlpha = reducedMotion ? 0.75 : Math.sin(t * Math.PI) * 0.85;
      ctx.fillStyle = i === 1 ? "#cfe3ff" : "#ffffff";
      ctx.fillRect(Math.round(sx), Math.round(sy), len, 3);
      ctx.fillRect(Math.round(sx + len - 4), Math.round(sy - 3), 4, 3);
    }
    ctx.globalAlpha = 1;
  }
}
function drawPickups() {
  for (const pickup of game.pickups) {
    if (pickup.taken) continue;
    const x = wx(pickup.x),
      y = wy(pickup.y) + (reducedMotion ? 0 : Math.round(Math.sin(clock * 3) * 4));
    if (x < -60 || x > W + 60) continue;
    const g = ctx.createRadialGradient(x, y, 4, x, y, 46);
    g.addColorStop(0, "rgba(255,255,255,0.55)");
    g.addColorStop(1, "rgba(200,220,255,0)");
    ctx.fillStyle = g;
    ctx.fillRect(x - 46, y - 46, 92, 92);
    const f = 1 + (reducedMotion ? 0 : Math.floor(clock * 10) % 3);
    ctx.drawImage(img.storm, f * 32, 0, 32, 32, x - 32, y - 32, 64, 64);
  }
}
/** The vault as the set piece: cofre.png at 4x (an even multiple of the 2x
 * grid) on a dais made of the slab tiles, flanked by two pillar strips from the
 * atlas, under a pulsing red glow. On the theft its door swings open and the
 * red pours out. */
function drawVault() {
  const v = LV.vault;
  if (!v) return;
  const x = wx(v.cx - v.w / 2),
    y = wy(v.floor - v.h),
    floor = wy(v.floor + 24);
  if (x < -200 || x > W + 200) return;
  // pillars (atlas cells 8..9 x 6..9: the vertical pillar strip)
  for (const px of [x - 54, x + v.w + 22]) ctx.drawImage(derived.tilesDark, 128, 96, 32, 64, px, floor - 128, 32, 128);
  const pulse = reducedMotion ? 0.8 : 0.65 + Math.sin(clock * 3) * 0.25,
    open = fx.vaultOpen;
  if (!game.stolen || open < 1) {
    const g = ctx.createRadialGradient(x + v.w / 2, y + v.h / 2, 6, x + v.w / 2, y + v.h / 2, 150);
    g.addColorStop(0, `rgba(255,60,40,${(game.stolen ? 0.9 * (1 - open) : 0.55) * pulse})`);
    g.addColorStop(1, "rgba(255,60,40,0)");
    ctx.fillStyle = g;
    ctx.fillRect(x - 110, y - 110, v.w + 220, v.h + 200);
  }
  // dais: the thin slab's ends and middle, top 12 source px, at 2x
  for (let i = 0; i < 4; i++) ctx.drawImage(img.tiles, (i === 0 ? 12 : i === 3 ? 17 : 13 + i) * 16, 0, 16, 12, x - 18 + i * 32, floor - 24, 32, 24);
  ctx.drawImage(img.vault, x, y, v.w, v.h);
  if (game.stolen) {
    // door (source 2..16 x 3..17) swings on its left hinge, revealing the
    // empty, red-lit inside
    const dx = x + 8,
      dy = y + 12,
      dw = 56,
      dh = 56,
      k = reducedMotion ? 1 : open;
    ctx.fillStyle = "#14080c";
    ctx.fillRect(dx, dy, dw, dh);
    ctx.fillStyle = `rgba(255,70,50,${0.5 * (1 - k * 0.6)})`;
    ctx.fillRect(dx + 4, dy + 4, dw - 8, dh - 8);
    const width = Math.max(6, Math.round(dw * Math.cos(k * 1.3)));
    ctx.drawImage(img.vault, 2, 3, 14, 14, dx - (dw - width) * 0.15, dy, width, dh);
  }
}
function drawOrbs() {
  for (const orb of game.orbs) {
    const x = wx(orb.x),
      y = wy(orb.y);
    if (x < -40 || x > W + 40) continue;
    if (orb.respawn > 0) {
      ctx.strokeStyle = "rgba(255,255,255,0.25)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, y, 14 * (1 - orb.respawn / M.WORLD.orbRespawn) + 4, 0, Math.PI * 2);
      ctx.stroke();
      continue;
    }
    // rubik_storm.png frames 1-3, cropped to their 20x20 centre, at 2x, in a
    // soft ring so it reads as a pickup (round, unlike square stickers).
    const f = 1 + (reducedMotion ? 0 : Math.floor(clock * 8) % 3),
      bob = reducedMotion ? 0 : Math.sin(clock * 3) * 3,
      ring = reducedMotion ? 0.5 : 0.35 + Math.sin(clock * 5) * 0.15;
    ctx.fillStyle = `rgba(255,255,255,${ring * 0.35})`;
    ctx.beginPath();
    ctx.arc(x, y + bob, 26, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = `rgba(255,255,255,${ring + 0.2})`;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.drawImage(img.storm, f * 32 + 6, 6, 20, 20, x - 20, y - 20 + bob, 40, 40);
  }
}
function drawSticker(x, y, size, glint) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(-0.12);
  ctx.fillStyle = "#1b1420";
  ctx.fillRect(-size / 2 - 2, -size / 2 - 2, size + 4, size + 4);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(-size / 2, -size / 2, size, size);
  ctx.fillStyle = "#ffcf2e";
  ctx.fillRect(-size / 2 + 3, -size / 2 + 3, size - 6, size - 6);
  // peeled corner: the shape differs from round orbs and cones
  ctx.fillStyle = "#fff4c2";
  ctx.beginPath();
  ctx.moveTo(size / 2 - 7, size / 2);
  ctx.lineTo(size / 2, size / 2 - 7);
  ctx.lineTo(size / 2, size / 2);
  ctx.closePath();
  ctx.fill();
  if (glint >= 0 && glint < 1) {
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    const gx = -size / 2 + glint * size;
    ctx.fillRect(gx, -size / 2 + 3, 3, size - 6);
  }
  ctx.restore();
}
function drawStickers() {
  for (const s of game.stickers) {
    if (s.collected) continue;
    const x = wx(s.x),
      y = wy(s.y);
    if (x < -40 || x > W + 40 || y < -40 || y > H + 40) continue;
    const bob = reducedMotion ? 0 : Math.round(Math.sin(clock * 2.6 + s.id) * 3);
    // Already in the save from an earlier run: a faint outline (NSMB's
    // collected star coins), still worth touching for this run's tally.
    if (s.owned) ctx.globalAlpha = 0.38;
    drawSticker(x, y + bob, 20, reducedMotion || s.owned ? -1 : ((clock * 0.6 + s.id * 0.37) % 1.6) / 0.6);
    ctx.globalAlpha = 1;
  }
}
const SHEETS = {
  green: { cw: 86, ch: 67, cx: 51, feet: 64, walk: [1, 7], idle: [2, 1], attack: [0, 10] },
  red: { cw: 110, ch: 86, cx: 53, feet: 68, walk: [1, 8], idle: [2, 2], attack: [0, 9] },
};
function drawCone(guard) {
  // Only active threats get a clear cone: dozing cards show none, and a card
  // that can't see Rubik's current color shows only a faint one.
  if (["stunned", "drained", "asleep", "away"].includes(guard.state)) return;
  // A card locked on after its "?" keeps a lit cone through any swap.
  const asleep = !M.canSee(guard, game.player.color) && !guard.locked,
    reach = guard.reach,
    tip = guard.x + guard.dir * M.CONE.offset;
  if (reach <= 0) return;
  const key = ["alert", "windup", "lunge", "recover"].includes(guard.state) ? "alert" : ["suspect", "search"].includes(guard.state) ? "suspect" : guard.kind === "red" ? "calmRed" : "calm";
  const pulse = asleep ? 0.12 : reducedMotion ? 0.55 : 0.42 + 0.22 * Math.abs(((clock * 0.8 + guard.x * 0.001) % 2) - 1);
  ctx.save();
  // Clip at the same wall-truncated reach the model uses for detection.
  ctx.beginPath();
  if (guard.dir > 0) ctx.rect(wx(tip), 0, reach, H);
  else ctx.rect(wx(tip - reach), 0, reach, H);
  ctx.clip();
  ctx.globalAlpha = pulse;
  const top = wy(guard.floor - M.CONE.top);
  if (guard.dir > 0) {
    ctx.translate(wx(tip + M.CONE.length), top);
    ctx.scale(-2, 2);
  } else {
    ctx.translate(wx(tip - M.CONE.length), top);
    ctx.scale(2, 2);
  }
  ctx.drawImage(derived.cones[key], 0, 0);
  ctx.restore();
  // A crisp edge on cones that can see Rubik's current colour, so the
  // detection area reads against the busy forest (same clip as above).
  if (asleep) return;
  ctx.save();
  ctx.beginPath();
  if (guard.dir > 0) ctx.rect(wx(tip), 0, reach, H);
  else ctx.rect(wx(tip - reach), 0, reach, H);
  ctx.clip();
  const edge = coneEdge(guard.dir);
  ctx.translate(wx(guard.x), wy(guard.floor));
  ctx.lineWidth = 2;
  ctx.strokeStyle = key === "alert" ? "rgba(120,10,10,0.85)" : key === "suspect" ? "rgba(110,50,0,0.8)" : "rgba(24,14,30,0.6)";
  ctx.stroke(edge);
  ctx.restore();
}
/** The cone silhouette's top and bottom edges as one path, relative to the
 * card (x = its centre, y = its floor), cached per facing. */
const coneEdges = {};
function coneEdge(dir) {
  if (coneEdges[dir]) return coneEdges[dir];
  const path = new Path2D(),
    card = { x: 0, floor: 0, dir },
    cols = [];
  for (let c = 175; c >= 1; c--) if (M.CONE_PROFILE[c]) cols.push(c);
  const xAt = (c) => M.coneColumnX(card, c) + (dir > 0 ? 0 : 2);
  cols.forEach((c, i) => {
    const y = -M.CONE.top + M.CONE_PROFILE[c][0] * 2;
    if (i === 0) path.moveTo(xAt(c), y);
    else path.lineTo(xAt(c), y);
  });
  [...cols].reverse().forEach((c) => path.lineTo(xAt(c), -M.CONE.top + (M.CONE_PROFILE[c][1] + 1) * 2));
  path.closePath();
  return (coneEdges[dir] = path);
}
function guardFrame(guard, sheet) {
  const t = guard.anim;
  switch (guard.state) {
    case "windup":
      return [0, Math.min(3, Math.floor((1 - guard.timer / M.GUARD.windup) * 4))];
    case "lunge":
      return [0, 4 + Math.min(2, Math.floor((1 - guard.timer / M.GUARD.lunge) * 3))];
    case "recover":
      return [0, Math.min(sheet.attack[1] - 1, 7 + Math.floor((1 - guard.timer / M.GUARD.recover) * (sheet.attack[1] - 7)))];
    case "alert":
      return [1, Math.floor(t * 14) % sheet.walk[1]];
    case "calm":
      if (guard.mode === "patrol" && guard.turning <= 0) return [1, Math.floor(t * 7) % sheet.walk[1]];
      return [2, Math.floor(t * 5) % sheet.idle[1]];
    default:
      return [2, 0];
  }
}
function bubble(x, y, label, opts = {}) {
  const w = opts.w || 34,
    h = opts.h || 34;
  ctx.save();
  ctx.translate(Math.round(x), Math.round(y));
  ctx.fillStyle = "#1b1420";
  roundRect(-w / 2 - 2, -h - 2, w + 4, h + 4, 9);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(-6, -2);
  ctx.lineTo(0, 10);
  ctx.lineTo(6, -2);
  ctx.fill();
  ctx.fillStyle = opts.fill || "#fbf9f2";
  roundRect(-w / 2, -h, w, h, 8);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(-4, -1);
  ctx.lineTo(0, 7);
  ctx.lineTo(4, -1);
  ctx.fill();
  if (label) text(label, 0, -h / 2 + 10, 32, opts.ink || "#1b1420", "center", null);
  ctx.restore();
}
function drawGuard(guard) {
  if (guard.state === "away") return; // escape-only card, not here yet
  const sheet = SHEETS[guard.kind],
    x = wx(guard.x),
    floor = wy(guard.floor);
  if (x < -200 || x > W + 200) return;
  const image = guard.state === "drained" ? derived.cardGrey : guard.kind === "red" ? img.cardRed : img.cardGreen,
    [row, col] = guardFrame(guard, sheet),
    dw = sheet.cw * 2,
    dh = sheet.ch * 2;
  if (guard.absorb && guard.state !== "drained" && !game.unlocked.green) {
    // The glowing card holds Rubik's green: it pulses, unlike its neighbours.
    const a = reducedMotion ? 0.4 : 0.3 + Math.sin(clock * 4) * 0.12,
      g = ctx.createRadialGradient(x, floor - 44, 6, x, floor - 44, 80);
    g.addColorStop(0, `rgba(127,208,75,${a})`);
    g.addColorStop(1, "rgba(127,208,75,0)");
    ctx.fillStyle = g;
    ctx.fillRect(x - 80, floor - 124, 160, 160);
  }
  ctx.save();
  ctx.translate(x, floor);
  // Sheets face left; a right-facing card mirrors around its body centre.
  if (guard.dir > 0) ctx.scale(-1, 1);
  if (guard.state === "stunned" || guard.state === "drained") {
    ctx.translate(0, -6);
    ctx.rotate(guard.state === "drained" ? 0.22 : -0.18);
  }
  if (guard.squash > 0 && !reducedMotion) {
    // Stomped: squashed flat for a beat, springing back.
    const k = guard.squash / 0.16;
    ctx.scale(1 + 0.28 * k, 1 - 0.36 * k);
  }
  ctx.drawImage(image, col * sheet.cw, row * sheet.ch, sheet.cw, sheet.ch, -sheet.cx * 2, -sheet.feet * 2, dw, dh);
  ctx.restore();
  spearUp(guard, x, floor);
  // Corner badge: the card's own glyph (it can't see its own color).
  if (guard.state !== "drained") {
    const bx = x - guard.dir * 14,
      by = floor - 74;
    ctx.fillStyle = "#fbf9f2";
    ctx.beginPath();
    ctx.arc(bx, by, 8, 0, Math.PI * 2);
    ctx.fill();
    glyph(guard.kind, bx, by, 8, COLORS[guard.kind]);
  }
  // Awareness bubbles: every state change has a cue.
  const head = floor - M.GUARD.h - 14,
    bob = reducedMotion ? 0 : Math.sin(clock * 6 + guard.x) * 2;
  // A card whose cone is on Rubik in its own colour hums, even while it is
  // still searching after a stun: a "?" there read as "it suspects me" (the
  // red vault guard beside red Rubik after the theft, user playtest).
  const humming = guard.disguiseSeen && ["calm", "suspect", "search"].includes(guard.state);
  if (["suspect", "search"].includes(guard.state) && !humming) bubble(x, head + bob, "?", { fill: "#ffe3b0" });
  else if (["alert", "windup", "lunge", "recover"].includes(guard.state)) bubble(x, head + bob, "!", { fill: "#ffb3a6" });
  else if (guard.state === "stunned") {
    for (let i = 0; i < 3; i++) {
      const a = clock * 4 + (i * Math.PI * 2) / 3;
      drawStar(x + Math.cos(a) * 18, head + 6 + Math.sin(a) * 5);
    }
  } else if (humming) {
    // Humming: the cone is on Rubik but he wears their color (a drawn note;
    // the pixel font has no music glyph).
    bubble(x, head + bob, "", { w: 30, h: 30 });
    ctx.fillStyle = "#1b1420";
    ctx.fillRect(x + 2, head + bob - 25, 3, 13);
    ctx.fillRect(x + 2, head + bob - 25, 8, 3);
    ctx.fillRect(x - 4, head + bob - 14, 8, 6);
  }
  if (guard.state === "calm" && guard.turning > 0 && guard.turning < M.GUARD.lookBack) text("…", x, head + 6, 32, "#fbf9f2", "center");
}
/** The spear-up tell: while Rubik is above a card it can't be stomped from
 * (it faces where he came from, or it is aware), its spear tip stands over
 * its head. Drawn, not written: the same art language as the lunge. */
function spearUp(guard, x, floor) {
  if (["drained", "stunned", "away"].includes(guard.state) || M.stompable(game, guard)) return;
  const p = game.player,
    dx = p.x + p.w / 2 - guard.x,
    above = p.y + p.h < guard.floor - M.GUARD.h + 6;
  if (Math.abs(dx) > 110 || !above) return;
  const tipX = x + guard.dir * 6,
    tipY = floor - M.GUARD.h - 26;
  ctx.fillStyle = "#1b1420";
  ctx.fillRect(tipX - 2, tipY + 8, 4, 22);
  ctx.beginPath();
  ctx.moveTo(tipX, tipY - 4);
  ctx.lineTo(tipX + 8, tipY + 10);
  ctx.lineTo(tipX - 8, tipY + 10);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#fbf9f2";
  ctx.beginPath();
  ctx.moveTo(tipX, tipY);
  ctx.lineTo(tipX + 4, tipY + 8);
  ctx.lineTo(tipX - 4, tipY + 8);
  ctx.closePath();
  ctx.fill();
}
function drawStar(x, y) {
  ctx.fillStyle = "#ffe066";
  ctx.fillRect(Math.round(x) - 1, Math.round(y) - 4, 2, 8);
  ctx.fillRect(Math.round(x) - 4, Math.round(y) - 1, 8, 2);
}
function playerFrame(p) {
  if (p.storm > 0) {
    const t = 1 - p.storm / M.WORLD.storm;
    if (t < 0.25) return [p.stormFrom, 64, 160];
    if (t < 0.75) return ["storm", (1 + Math.floor((t - 0.25) * 4)) * 32, 0];
    return [p.color, 0, 192];
  }
  if (p.dashTime > 0) return [p.color, (Math.floor((1 - p.dashTime / M.WORLD.dashDuration) * 6) % 6) * 32, 32];
  if (p.knock > 0) return [p.color, 160, 96];
  if (!p.grounded) {
    const f = p.vy < -280 ? 0 : p.vy < -80 ? 1 : p.vy < 60 ? 2 + (Math.floor(clock * 8) % 2) : p.vy < 300 ? 4 : 5;
    return [p.color, f * 32, 96];
  }
  if (p.landed > 0) return [p.color, Math.min(3, Math.floor((1 - p.landed / 0.1) * 4)) * 32, 128];
  if (Math.abs(p.vx) > 20) return [p.color, (Math.floor(clock * (8 + Math.abs(p.vx) / 40)) % 4) * 32, 64];
  return [p.color, (Math.floor(clock * 4) % 2) * 32, 0];
}
function drawRubik(sheetKey, sx, sy, cx, feet, direction, alpha = 1, rotation = 0, scaleX = 1, scaleY = 1) {
  const image = sheetKey === "storm" ? img.storm : sheetKey.length > 5 ? derived[sheetKey] : img[sheetKey];
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(Math.round(cx), Math.round(feet));
  if (rotation) ctx.rotate(rotation);
  if (scaleX !== 1 || scaleY !== 1) ctx.scale(scaleX, scaleY); // feet stay planted
  if (direction < 0) ctx.scale(-1, 1);
  ctx.drawImage(image, sx, sy, 32, 32, -33, -64, 64, 64);
  ctx.restore();
}
function drawPlayer() {
  if (game.phase === "dead" && fx.death) {
    // Original death hop: pop up, then fall; cut at 0.45 s.
    const d = fx.death,
      t = d.age,
      y = d.y + M.PLAYER.h - 300 * t + 900 * t * t;
    drawRubik(d.color, 160, 96, wx(d.x + M.PLAYER.w / 2), wy(y), d.direction, 1, t * 5 * d.direction);
    // 1-3's catch is not a death: the card raised the alarm, so say so over
    // the hop (Rubik is sent back to the checkpoint).
    if (d.reason === "caught") text("caught!", wx(d.x + M.PLAYER.w / 2), wy(d.y) - 18, 32, "#ffd84a", "center");
    return;
  }
  const p = game.player,
    [sheet, sx, sy] = playerFrame(p),
    cx = wx(p.x + p.w / 2),
    feet = wy(p.y + p.h);
  // Dash afterimages: three silhouettes in the form's colour, close behind.
  if (p.dashTime > 0 && sheet !== "storm")
    for (let i = 3; i > 0; i--) drawRubik(p.color + "Ghost", sx, sy, cx - p.dashDirection * i * (reducedMotion ? 26 : 20), feet, p.direction, reducedMotion ? 0.3 : 0.62 - i * 0.14);
  // Grace blinks (steady half-alpha under reduced motion: a cue, not a flash).
  const graced = p.grace > 0 || p.bumpGrace > 0,
    blink = graced && (reducedMotion || Math.floor(clock * 14) % 2 === 0);
  // Dash state lives on Rubik (Celeste's hair): spent charge dims him.
  let key = sheet;
  if (sheet !== "storm") {
    if (fx.refill > 0) key = p.color + "Flash";
    else if (p.dashCharge <= 0 && !p.grounded && p.dashTime <= 0) key = p.color + "Dim";
  }
  const sq = fx.squash,
    k = sq ? sq.t / sq.dur : 0,
    scaleX = sq ? 1 + (sq.sx - 1) * k : 1,
    scaleY = sq ? 1 + (sq.sy - 1) * k : 1;
  drawRubik(key, sx, sy, cx, feet, p.direction, blink ? (reducedMotion ? 0.65 : 0.45) : 1, 0, scaleX, scaleY);
  // White's air jump, unspent while airborne: two small puffs under the feet
  // (the air jump's own burst colour; they are what bursts when it fires), so
  // the double jump reads on Rubik himself, like the dash's dim (rubric E2).
  // 4 px each, outlined, below the feet: they never cover Rubik.
  if (p.color === "white" && !p.grounded && !p.airJumped && p.storm <= 0 && game.phase === "playing") {
    for (const side of [-1, 1]) {
      const x = Math.round(cx + side * 13) - 2,
        y = Math.round(feet) + 3;
      ctx.fillStyle = "#1b1420";
      ctx.fillRect(x - 1, y - 1, 6, 6);
      ctx.fillStyle = "#f4f1e6";
      ctx.fillRect(x, y, 4, 4);
    }
  }
  if (fx.swirl && !reducedMotion) {
    const t = fx.swirl.age / 0.7,
      sx0 = wx(fx.swirl.x),
      sy0 = wy(fx.swirl.y);
    for (let i = 0; i < 6; i++) {
      const k = Math.max(0, Math.min(1, t - i * 0.06)),
        a = k * 9 + i;
      const px = sx0 + (cx - sx0) * k + Math.cos(a) * 18 * (1 - k),
        py = sy0 + (feet - 30 - sy0) * k + Math.sin(a) * 18 * (1 - k);
      ctx.fillStyle = i % 2 ? "#7fd04b" : "#b8ef7c";
      ctx.fillRect(Math.round(px) - 3, Math.round(py) - 3, 6, 6);
    }
  }
}
function drawParticles() {
  for (const q of fx.particles) {
    const a = 1 - q.age / q.life;
    ctx.globalAlpha = Math.max(0, a);
    if (q.debris) ctx.drawImage(img.tiles, q.debris[0], q.debris[1], 8, 8, wx(q.x) - 8, wy(q.y) - 8, 16, 16);
    else {
      ctx.fillStyle = q.color;
      ctx.fillRect(wx(q.x) - q.size / 2, wy(q.y) - q.size / 2, q.size, q.size);
    }
  }
  ctx.globalAlpha = 1;
}
/** The five contextual bubbles (at most two per level). Each shows device-matched glyphs only:
 * keycaps on a keyboard, the on-screen button's look on touch. */
const HINTS = {
  move: { keys: ["<", ">"], touch: ["<", ">"] },
  // 1-1's twist: the jump key twice ("jump, jump" - white's air jump).
  airjump: { keys: ["Space", "Space"], touch: ["JUMP", "JUMP"] },
  // 1-2: after the first spear-up, a card with an arrow dropping onto its back.
  behind: { keys: [], touch: [], art: "behind" },
  white: { keys: ["Z"], touch: [], chip: "white", thought: true },
  green: { keys: ["X"], touch: [], chip: "green" },
  dash: { keys: ["Shift"], touch: ["DASH"], dash: true },
};
function bigKey(label, x, y) {
  // 30 px keycap; arrows are drawn, not typed (the pixel font has no arrows).
  ctx.font = "32px monogram, monospace";
  const arrow = label === "<" || label === ">",
    w = arrow ? 34 : Math.max(34, Math.round(ctx.measureText(label).width) + 16);
  ctx.fillStyle = "#1b1420";
  roundRect(x, y - 30 + 3, w, 30, 6);
  ctx.fill();
  ctx.fillStyle = "#fbf9f2";
  roundRect(x + 2, y - 30, w - 4, 28, 5);
  ctx.fill();
  ctx.fillStyle = "#1b1420";
  if (arrow) {
    const cx = x + w / 2,
      cy = y - 16,
      d = label === "<" ? -1 : 1;
    ctx.beginPath();
    ctx.moveTo(cx + d * 7, cy);
    ctx.lineTo(cx - d * 5, cy - 8);
    ctx.lineTo(cx - d * 5, cy + 8);
    ctx.closePath();
    ctx.fill();
  } else {
    ctx.textAlign = "center";
    ctx.fillText(label, Math.round(x + w / 2), Math.round(y - 8));
  }
  return w;
}
function drawHint() {
  const id = game.hint;
  if (!id || screen !== "play" || game.phase !== "playing") return;
  const hint = HINTS[id],
    p = game.player,
    labels = inputMode === "touch" ? hint.touch : hint.keys;
  ctx.font = "32px monogram, monospace";
  let w = 20;
  for (const label of labels) w += (label.length > 1 ? ctx.measureText(label).width + 16 : 34) + 8;
  if (hint.chip) w += 34;
  if (hint.dash) w += 34;
  if (hint.art) w += 64;
  const x = wx(p.x + p.w / 2),
    y = wy(p.y) - 16;
  ctx.save();
  ctx.globalAlpha = Math.min(1, game.hintAge * 4);
  if (hint.thought) {
    ctx.fillStyle = "#1b1420";
    ctx.beginPath();
    ctx.arc(x - 8, y + 2, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#fbf9f2";
    ctx.beginPath();
    ctx.arc(x - 8, y + 2, 4, 0, Math.PI * 2);
    ctx.fill();
  }
  bubble(x, y - 8, "", { w, h: 46 });
  let cx = x - w / 2 + 10;
  if (hint.chip) {
    formCard(hint.chip, cx, y - 50, 26, 36, null);
    cx += 34;
  }
  for (const label of labels) cx += bigKey(label, cx, y - 16) + 8;
  if (hint.dash) {
    ctx.fillStyle = "#1b1420";
    for (let i = 0; i < 3; i++) ctx.fillRect(cx + i * 4, y - 40 + i * 8, 26 - i * 6, 4);
  }
  if (hint.art === "behind") {
    // A card facing right (its spear at the front) and an arrow curving
    // down onto its back: stomp from behind.
    ctx.fillStyle = COLORS.green;
    ctx.fillRect(cx + 30, y - 38, 18, 26);
    ctx.fillStyle = "#1b1420";
    ctx.fillRect(cx + 50, y - 46, 2, 30);
    ctx.beginPath();
    ctx.moveTo(cx + 51, y - 52);
    ctx.lineTo(cx + 56, y - 44);
    ctx.lineTo(cx + 46, y - 44);
    ctx.fill();
    ctx.strokeStyle = "#1b1420";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(cx + 6, y - 46);
    ctx.quadraticCurveTo(cx + 22, y - 54, cx + 32, y - 42);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx + 34, y - 38);
    ctx.lineTo(cx + 26, y - 44);
    ctx.lineTo(cx + 36, y - 47);
    ctx.fill();
  }
  ctx.restore();
}
function drawHud() {
  const p = game.player,
    forms = ["white", "green", "red"].filter((c) => game.unlocked[c]);
  // In the portrait crop the canvas is wider than the view: pull the HUD in.
  ctx.save();
  ctx.translate(hudInset, 0);
  // Form cards: the current form in front, unlocked others fanned behind.
  const others = forms.filter((c) => c !== p.color);
  const shake = fx.locked > 0 && !reducedMotion ? Math.sin(fx.locked * 60) * 3 : 0;
  others.forEach((color, i) => {
    const deal = fx.chipDeal[color] || 0;
    formCard(color, 46 + i * 26 + shake + deal * 60, 18 - deal * 40, 34, 48, keyFor(color), 0.16 + i * 0.12, 0.88 - deal);
  });
  const deal = fx.chipDeal[p.color] || 0;
  formCard(p.color, 16 + shake, 14 - deal * 30, 40, 56, keyFor(p.color), -0.05, 1);
  // After DASH GET: a storm streak by the form cards, and a Shift (or DASH)
  // keycap for the first 3 dashes of 1-4. State itself stays on Rubik.
  if (game.dashUnlocked) {
    const deal = fx.chipDeal.dash || 0,
      dx = 18 + forms.length * 26 + 36 + deal * 50,
      dy = 26 - deal * 30;
    ctx.globalAlpha = 1 - deal * 0.8;
    ctx.fillStyle = "rgba(10,8,14,0.55)";
    roundRect(dx + 2, dy + 3, 36, 36, 8);
    ctx.fill();
    ctx.fillStyle = "#fbf9f2";
    roundRect(dx, dy, 36, 36, 8);
    ctx.fill();
    ctx.fillStyle = p.dashCharge > 0 || p.grounded ? "#1b1420" : "#a9a1ae";
    for (let i = 0; i < 3; i++) ctx.fillRect(dx + 7 + i * 4, dy + 9 + i * 7, 22 - i * 6, 4);
    ctx.globalAlpha = 1;
    if (LV.id === "1-4" && game.dashes < 3 && inputMode !== "touch") keycap("Shift", dx + 18, dy + 52);
  }
  ctx.restore();
  ctx.save();
  ctx.translate(-hudInset, 0);
  // Sticker strip: this level's three slots, top right under the buttons.
  // Solid = taken this run; faint = already in the save from an earlier run.
  const fx0 = W - 16 - 84,
    fy0 = 54;
  ctx.fillStyle = "#1b1420";
  roundRect(fx0 - 2, fy0 - 2, 88, 34, 8);
  ctx.fill();
  ctx.fillStyle = "#2b2230";
  roundRect(fx0, fy0, 84, 30, 7);
  ctx.fill();
  game.stickers.forEach((st, i) => {
    const sx = fx0 + 5 + i * 26,
      sy = fy0 + 4;
    ctx.fillStyle = st.collected ? "#ffcf2e" : st.owned ? "rgba(255,207,46,0.28)" : "#463b4a";
    roundRect(sx, sy, 22, 22, 4);
    ctx.fill();
    if (st.collected) {
      ctx.fillStyle = "#fff4c2";
      ctx.fillRect(sx + 3, sy + 3, 7, 4);
    } else if (st.owned) {
      ctx.strokeStyle = "#ffcf2e";
      ctx.lineWidth = 2;
      ctx.strokeRect(sx + 1, sy + 1, 20, 20);
    }
  });
  let below = fy0 + 58;
  // The "Quick" stamp, shown as the seal it awards: its seconds count down
  // while it can still be earned; at zero the seal greys and is struck
  // through (medal only - nothing fails, the escape goes on).
  if (game.stolen && game.theftTime !== null && LV.par !== null) {
    const left = Math.max(0, LV.par - ((game.finishTime ?? game.time) - game.theftTime)),
      on = left > 0,
      cx = W - 16 - 84 + 22,
      cy = below + 8;
    ctx.fillStyle = on ? COLORS.red : "#4a3f4e";
    ctx.beginPath();
    ctx.arc(cx, cy, 18, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = on ? "#fbf9f2" : "#7a6f80";
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 3]);
    ctx.beginPath();
    ctx.arc(cx, cy, 14, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    text(on ? String(Math.ceil(left)) : "-", cx, cy + 8, 16, "#ffffff", "center", on ? "#5a0e0a" : null);
    text("Quick", cx + 26, cy + 8, 16, on ? "#fbf9f2" : "#7a6f80", "left", on ? "#1b1420" : null);
    if (!on) {
      ctx.fillStyle = "#7a6f80";
      ctx.fillRect(cx + 24, cy + 1, 44, 2);
    }
    below += 40;
  }
  if (settings.timer) text(fmtTime(game.time), W - 16, below + 4, 32, "#fbf9f2", "right");
  ctx.restore();
  ctx.save();
  ctx.translate(hudInset, 0);
  // During the getaway, a small home arrow at the left edge until home is on
  // screen (the chalk cube face is the home marker).
  if (game.stolen && game.phase !== "won" && LV.home && LV.home.x1 < cam.x) {
    const a = reducedMotion ? 1 : 0.75 + Math.sin(clock * 6) * 0.25,
      y = H / 2 - 22;
    ctx.globalAlpha = a;
    ctx.fillStyle = "#1b1420";
    roundRect(10, y - 2, 64, 48, 10);
    ctx.fill();
    ctx.fillStyle = "#fbf9f2";
    roundRect(12, y, 60, 44, 9);
    ctx.fill();
    ctx.fillStyle = COLORS.red;
    ctx.beginPath();
    ctx.moveTo(18, y + 22);
    ctx.lineTo(32, y + 10);
    ctx.lineTo(32, y + 34);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "#1b1420";
    ctx.lineWidth = 2;
    for (let i = 0; i < 9; i++) ctx.strokeRect(38 + (i % 3) * 9, y + 9 + Math.floor(i / 3) * 9, 8, 8);
    ctx.globalAlpha = 1;
  }
  ctx.restore();
}
// No key glyph while white is the only form (1-1, 1-2): nothing to switch to.
const keyFor = (color) => (inputMode === "touch" || !game.unlocked.green ? null : { white: "Z", green: "X", red: "C" }[color]);
/** The level card: "1-3" at 64 px, the name at 32 px and three sticker
 * slots on an Uno-style card over the dimmed first frame (1 s; 0.5 s once
 * the level is cleared). Any key skips it. */
function drawIntro() {
  const card = fx.intro;
  if (!card) return;
  const t = card.age,
    out = card.skipped ? Math.min(1, t * 6) : Math.max(0, (t - card.dur) / 0.4),
    a = Math.max(0, Math.min(1, t / 0.12, 1 - out));
  if (a <= 0) return;
  ctx.save();
  ctx.globalAlpha = a;
  ctx.fillStyle = "rgba(10,8,14,0.45)";
  ctx.fillRect(0, 0, W, H);
  const cw = 300,
    ch = 190,
    x = W / 2 - cw / 2,
    y = H / 2 - ch / 2 - 30,
    rec = C.levelRecord(save, LV.id);
  ctx.translate(W / 2, y + ch / 2);
  ctx.rotate(reducedMotion ? 0 : -0.04 + (1 - Math.min(1, t / 0.25)) * -0.12);
  ctx.translate(-W / 2, -(y + ch / 2));
  ctx.fillStyle = "rgba(0,0,0,0.45)";
  roundRect(x + 6, y + 8, cw, ch, 18);
  ctx.fill();
  ctx.fillStyle = "#fbf9f2";
  roundRect(x, y, cw, ch, 18);
  ctx.fill();
  ctx.fillStyle = "#2b1f2e";
  roundRect(x + 8, y + 8, cw - 16, ch - 16, 12);
  ctx.fill();
  text(LV.id, W / 2, y + 74, 64, "#ffcf2e", "center", "#000");
  text(LV.name, W / 2, y + 112, 32, "#ffffff", "center", "#000");
  LV.stickers.forEach((st, i) => {
    const sx = W / 2 - 40 + i * 28;
    ctx.fillStyle = rec.stickers.includes(st.id) ? "#ffcf2e" : "#463b4a";
    roundRect(sx, y + 132, 22, 22, 4);
    ctx.fill();
  });
  ctx.restore();
}
/** GET card: hit-stop, then the new color at 4x with its key and a caption,
 * held for the model's 1.2 s GET freeze; the form card is then dealt into
 * the HUD (chipDeal). */
function drawGetCard() {
  const get = fx.get;
  if (!get) return;
  const info = GET_CARDS[get.ability],
    t = get.age,
    a = Math.max(0, Math.min(1, t / 0.12, (M.WORLD.hitstop.get + 0.1 - t) / 0.15)),
    pop = reducedMotion ? 1 : Math.min(1, 0.6 + t * 3);
  ctx.save();
  ctx.globalAlpha = a;
  ctx.fillStyle = "rgba(10,8,14,0.5)";
  ctx.fillRect(0, 0, W, H);
  // 420 x 250: narrow enough for the portrait crop; the caption has its own
  // band under the portrait so it never runs into the circle.
  const color = get.ability === "dash" ? "white" : get.ability,
    cw = 420,
    ch = 250,
    x = W / 2 - cw / 2,
    y = H / 2 - ch / 2 - 20;
  ctx.translate(W / 2, H / 2 - 20);
  ctx.scale(pop, pop);
  ctx.translate(-W / 2, -(H / 2 - 20));
  ctx.fillStyle = "#fbf9f2";
  roundRect(x, y, cw, ch, 20);
  ctx.fill();
  ctx.fillStyle = get.ability === "dash" ? "#3d4f7a" : COLORS[color];
  roundRect(x + 10, y + 10, cw - 20, ch - 20, 14);
  ctx.fill();
  ctx.fillStyle = "rgba(251,249,242,0.9)";
  ctx.beginPath();
  ctx.ellipse(x + 104, y + 98, 74, 78, -0.4, 0, Math.PI * 2);
  ctx.fill();
  // Rubik at 4x in the new color (dash: the storm frames).
  ctx.imageSmoothingEnabled = false;
  if (get.ability === "dash") {
    const f = 1 + (reducedMotion ? 0 : Math.floor(clock * 10) % 3);
    ctx.drawImage(img.storm, f * 32, 0, 32, 32, x + 40, y + 34, 128, 128);
  } else ctx.drawImage(img[color], (Math.floor(clock * 4) % 2) * 32, 0, 32, 32, x + 40, y + 30, 128, 128);
  text(info.title, x + 296, y + 78, 48, "#ffffff", "center", "#000");
  if (get.ability === "dash") {
    if (inputMode === "touch") dashPill(x + 260, y + 136);
    else bigKey(info.key, x + 258, y + 136);
  } else {
    formCard(color, x + 244, y + 100, 30, 42, null);
    if (inputMode !== "touch") bigKey(info.key, x + 288, y + 136);
  }
  ctx.fillStyle = "rgba(10,8,14,0.35)";
  roundRect(x + 18, y + 188, cw - 36, 44, 10);
  ctx.fill();
  text(info.caption, W / 2, y + 218, 32, "#ffffff", "center", "#000");
  ctx.restore();
}
/** Uno REVERSE card sweeping across: the theft's turning point. */
function drawReverse() {
  if (fx.reverse < 0 || fx.get) return;
  // Never over Rubik: the card and the caption take the half of the screen
  // he isn't in (the cards are held still meanwhile, model.mjs theftCalm).
  const rubikY = wy(game.player.y + M.PLAYER.h / 2),
    low = rubikY < H / 2,
    t = fx.reverse / 1.1,
    x = reducedMotion ? W / 2 : W + 160 - (W + 320) * Math.min(1, t * 1.15),
    y = low ? H - 150 : 150;
  ctx.save();
  ctx.globalAlpha = reducedMotion ? 1 : Math.min(1, (1 - t) * 4);
  ctx.translate(x, y);
  ctx.rotate(-0.12);
  ctx.fillStyle = "rgba(0,0,0,0.45)";
  roundRect(-118, -78, 244, 164, 16);
  ctx.fill();
  ctx.fillStyle = "#fbf9f2";
  roundRect(-124, -84, 248, 168, 16);
  ctx.fill();
  ctx.fillStyle = COLORS.red;
  roundRect(-114, -74, 228, 148, 10);
  ctx.fill();
  ctx.fillStyle = "#fbf9f2";
  ctx.beginPath();
  ctx.ellipse(0, 0, 92, 52, -0.5, 0, Math.PI * 2);
  ctx.fill();
  // two arrows chasing each other
  ctx.strokeStyle = COLORS.red;
  ctx.fillStyle = COLORS.red;
  ctx.lineWidth = 8;
  for (const s of [1, -1]) {
    ctx.beginPath();
    ctx.arc(0, 0, 30, s > 0 ? Math.PI * 1.1 : Math.PI * 0.1, s > 0 ? Math.PI * 1.9 : Math.PI * 0.9);
    ctx.stroke();
    const ax = s * 26,
      ay = s * 12;
    ctx.beginPath();
    ctx.moveTo(ax + s * 12, ay - s * 2);
    ctx.lineTo(ax - s * 4, ay - s * 14);
    ctx.lineTo(ax - s * 6, ay + s * 8);
    ctx.fill();
  }
  ctx.restore();
  if (fx.reverse < 1.1) text("REVERSE!", x, y + 120, 48, "#ffffff", "center", "#000000");
  // The goal, stated once, after the card has swept by: run home; red dash
  // breaks the cracked stones.
  if (fx.reverse > 0.95) {
    const a = Math.min(1, (fx.reverse - 0.95) * 5, (2.6 - fx.reverse) * 3);
    ctx.globalAlpha = Math.max(0, a);
    const by = low ? H - 150 : 88; // the caption block's top
    text("Run home!", W / 2, by + 40, 48, "#ffffff", "center", "#000000");
    const touch = inputMode === "touch",
      rowW = touch ? 300 : 320,
      rx = W / 2 - rowW / 2;
    ctx.fillStyle = "rgba(27,20,32,0.8)";
    roundRect(rx - 10, by + 52, rowW + 20, 52, 12);
    ctx.fill();
    formCard("red", rx, by + 56, 30, 42, null);
    text("+", rx + 46, by + 88, 32, "#fbf9f2", "center", null);
    const kw = touch ? dashPill(rx + 60, by + 94) : bigKey("Shift", rx + 60, by + 94);
    text("breaks stones", rx + 72 + kw, by + 88, 32, "#fbf9f2", "left", null);
    ctx.globalAlpha = 1;
  }
}
function dashPill(x, y) {
  ctx.font = "32px monogram, monospace";
  const w = Math.round(ctx.measureText("DASH").width) + 18;
  ctx.fillStyle = "rgba(251,249,242,0.35)";
  roundRect(x, y - 30, w, 30, 10);
  ctx.fill();
  ctx.strokeStyle = "#1b1420";
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = "#fbf9f2";
  ctx.textAlign = "center";
  ctx.fillText("DASH", x + w / 2, y - 8);
  return w;
}
/** The original cutout.png iris: a Rubik-face hole, scaled with the original
 * shader's curve s = 2^(10t-10)*5 (t=1 closed, t=0 open). */
function drawIris(t, cx = W / 2, cy = H / 2) {
  if (t <= 0) return;
  if (t >= 1 || reducedMotion) {
    if (t >= 0.5) {
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, W, H);
    }
    return;
  }
  const s = Math.pow(2, 10 * t - 10) * 5;
  if (!derived.iris) derived.iris = makeCanvas(W, H);
  const [c, x] = derived.iris;
  x.globalCompositeOperation = "source-over";
  x.fillStyle = "#000";
  x.fillRect(0, 0, W, H);
  x.globalCompositeOperation = "destination-out";
  const w = W / s,
    h = H / s;
  x.drawImage(img.cutout, cx - w / 2, cy - h / 2, w, h);
  ctx.drawImage(c, 0, 0);
}
function drawWorld() {
  ctx.save();
  if (cam.shake > 0) ctx.translate(Math.round((Math.random() - 0.5) * cam.shake * 2), Math.round((Math.random() - 0.5) * cam.shake * 2));
  drawBackground();
  drawChunks(derived.back);
  for (const guard of game.guards) drawCone(guard);
  drawTiles();
  drawStones();
  drawDoorCue();
  drawCheckpoints();
  drawGoal();
  drawVault();
  drawPickups();
  drawDashMarks();
  drawOrbs();
  drawStickers();
  for (const guard of game.guards) drawGuard(guard);
  drawPlayer();
  drawParticles();
  drawHint();
  ctx.restore();
}
function drawFlash() {
  if (fx.flash <= 0) return;
  ctx.globalAlpha = Math.min(0.5, fx.flash);
  ctx.fillStyle = fx.flashColor;
  ctx.fillRect(0, 0, W, H);
  ctx.globalAlpha = 1;
}

// ------------------------------------------------------- front-end screens --
function drawBoot() {
  ctx.fillStyle = "#0b0a10";
  ctx.fillRect(0, 0, W, H);
  // A small spinning 3x3 cube face while the art loads.
  ctx.save();
  ctx.translate(W / 2, H / 2);
  ctx.rotate(reducedMotion ? 0 : clock * 2.5);
  const palette = ["#f3f0e4", "#5fbf3a", "#e8382c", "#3a7bd5", "#ffcf2e", "#f08a24", "#f3f0e4", "#5fbf3a", "#e8382c"];
  for (let i = 0; i < 9; i++) {
    ctx.fillStyle = palette[(i + Math.floor(clock * 3)) % 9];
    ctx.fillRect(-21 + (i % 3) * 14, -21 + Math.floor(i / 3) * 14, 12, 12);
  }
  ctx.restore();
}
function drawTitle() {
  ctx.drawImage(img.title, 0, 0, W, H);
  // On touch screens "press any key" is wrong: an opaque pixel plate covers
  // the baked line (source y 184-198 -> 368-396 at 2x) and says tap.
  if (inputMode === "touch") {
    ctx.fillStyle = "#0b1226";
    roundRect(W / 2 - 300, 356, 600, 52, 10);
    ctx.fill();
    ctx.strokeStyle = "#fbf9f2";
    ctx.lineWidth = 3;
    ctx.stroke();
    text("Tap to start", W / 2, 394, 48, "#ffffff", "center", "#000000");
  }
}
const STORY = { drain: 0.8, black: 0.35, panel: 1.8, first: 1.15, hold: 1.4 };
const PANELS = [
  ["q1", 135, 78],
  ["q2", 360, 74],
  ["q3", 117, 211],
  ["q4", 347, 210],
];
function storyTimes() {
  const start = STORY.drain + STORY.black,
    end = start + STORY.panel * 3 + STORY.hold;
  return { start, end, close: end + 0.8 };
}
function drawStory() {
  const t = screenTime,
    { start, end, close } = storyTimes();
  if (t < STORY.drain + STORY.black) {
    // The theft told in-world: the title forest is drained to bg1's grey,
    // the logo fading with its colors, then the comic's black page.
    ctx.drawImage(img.title, 0, 0, W, H);
    ctx.globalAlpha = Math.min(1, t / STORY.drain);
    ctx.drawImage(img.forest, 0, 0, W, H);
    ctx.globalAlpha = Math.max(0, Math.min(1, (t - STORY.drain) / STORY.black));
    ctx.drawImage(img.black, 0, 0, W, H);
    ctx.globalAlpha = 1;
    return;
  }
  ctx.drawImage(img.black, 0, 0, W, H);
  PANELS.forEach(([key, x, y], i) => {
    const at = start + i * STORY.panel,
      age = t - at;
    if (age < 0) return;
    const image = img[key],
      k = reducedMotion ? 1 : Math.min(1, age / 0.18),
      scale = 2 * (0.92 + 0.08 * k);
    ctx.globalAlpha = k;
    ctx.drawImage(image, Math.round(x * 2 - (image.width * scale) / 2), Math.round(y * 2 - (image.height * scale) / 2), Math.round(image.width * scale), Math.round(image.height * scale));
    ctx.globalAlpha = 1;
  });
  text("▸▸", W - 18, H - 14, 32, "#fbf9f2", "right");
  if (t >= end) drawIris(Math.min(1, (t - end) / 0.8));
  if (t >= close) startLevel(C.WORLD1[0], { skipIntro: false });
}
/** The ending: the colorized forest, red Rubik home, and end_game.png framed
 * as the comic's last page. The original line "That's it by now." is
 * covered by a plate reading "That's it for now." (the asset is untouched),
 * and one more line says what comes next. */
function drawEnding() {
  ctx.drawImage(derived.forestColor, 0, 0, W, H);
  ctx.fillStyle = "rgba(14,10,20,0.45)";
  ctx.fillRect(0, 0, W, H);
  const fw = 480,
    fh = 270,
    fx0 = W / 2 - fw / 2,
    fy0 = 60;
  ctx.fillStyle = "#fbf9f2";
  roundRect(fx0 - 12, fy0 - 12, fw + 24, fh + 24, 14);
  ctx.fill();
  ctx.drawImage(img.ending, fx0, fy0, fw, fh); // exactly 1x: the page itself
  ctx.fillStyle = "#000000";
  ctx.fillRect(fx0 + 168, fy0 + 166, 150, 22);
  text("That's it for now.", W / 2, fy0 + 184, 16, "#ffffff", "center", null);
  drawRubik("red", (Math.floor(clock * 4) % 2) * 32, 0, fx0 - 60, fy0 + fh + 4, 1, 1);
  drawRubik("green", (Math.floor(clock * 4 + 1) % 2) * 32, 0, fx0 + fw + 60, fy0 + fh + 4, -1, 1);
  text("World 2: Blue Mountains - coming soon", W / 2, fy0 + fh + 70, 32, "#ffffff", "center", "#000");
  text(`${C.stickerTotal(save)}/${C.TOTAL_STICKERS} stickers`, W / 2, fy0 + fh + 104, 16, "#ffcf2e", "center", null);
  if (screenTime > 1.2) text(inputMode === "touch" ? "tap to continue" : "any key to continue", W / 2, H - 18, 16, "#cfc6d6", "center", null);
  drawIris(Math.max(0, 1 - screenTime / 0.8));
}
/** Card panel shared by the tally screens. */
function panel(px, py, pw, ph) {
  ctx.fillStyle = "rgba(0,0,0,0.5)";
  roundRect(px + 6, py + 8, pw, ph, 22);
  ctx.fill();
  ctx.fillStyle = "#fbf9f2";
  roundRect(px, py, pw, ph, 22);
  ctx.fill();
  ctx.fillStyle = "#2b1f2e";
  roundRect(px + 8, py + 8, pw - 16, ph - 16, 16);
  ctx.fill();
}
/** A stamp: a small round seal, colored when earned, a grey outline when not. */
function stamp(label, got, x, y) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(-0.12);
  ctx.fillStyle = got ? COLORS.red : "#3a3040";
  ctx.beginPath();
  ctx.arc(0, 0, 30, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = got ? "#fbf9f2" : "#6a5f70";
  ctx.lineWidth = 3;
  ctx.setLineDash([5, 4]);
  ctx.beginPath();
  ctx.arc(0, 0, 25, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();
  text(label, x, y + 8, 16, got ? "#ffffff" : "#8a7f90", "center", got ? "#5a0e0a" : null);
}
/** Level clear: time and best, stickers flying into their slots (0.15 s
 * each, with a sound), stamps; Continue (default) or Retry. */
function drawResults() {
  ctx.drawImage(colorAmount > 0.01 ? derived.forestColor : img.forest, 0, 0, W, H);
  ctx.fillStyle = "rgba(14,10,20,0.55)";
  ctx.fillRect(0, 0, W, H);
  const r = fx.result || { time: game.finishTime ?? game.time, best: null, stickers: game.stickers.map((x) => ({ id: x.id, got: x.collected, owned: x.owned })), unseen: null, takedown: null, quick: null };
  const px = 170,
    py = 52,
    pw = 620,
    ph = 380;
  panel(px, py, pw, ph);
  text(`World 1 - ${LV.id}`, W / 2, py + 34, 16, "#cfc6d6", "center", null);
  text(`${LV.name}: clear!`, W / 2, py + 76, 48, "#ffffff", "center", "#000");
  // Rubik in the color he finished in, on his chalk face.
  ctx.fillStyle = "#3d3042";
  roundRect(px + 60, py + 196, 100, 14, 7);
  ctx.fill();
  drawRubik(game.player.color, (Math.floor(clock * 4) % 2) * 32, 0, px + 110, py + 202, 1, 1);
  const rows = [
    ["Time", fmtTime(r.time ?? 0), r.newBest && !r.firstClear ? "best!" : ""],
    ["Best", r.best === null ? "-" : fmtTime(r.best), ""],
  ];
  if (game.escapeTime !== null) rows.push(["Getaway", fmtTime(game.escapeTime), ""]);
  rows.forEach(([k, v, note], i) => {
    text(k, px + 210, py + 138 + i * 36, 32, "#cfc6d6", "left", null);
    text(v, px + 420, py + 138 + i * 36, 32, "#ffffff", "right", null);
    if (note) text(note, px + 430, py + 138 + i * 36, 32, "#ffcf2e", "left", null);
  });
  // Stickers fly into their slots one by one.
  r.stickers.forEach((st, i) => {
    const sx = px + 214 + i * 70,
      sy = py + 262,
      land = 0.35 + i * 0.15,
      k = reducedMotion ? 1 : Math.max(0, Math.min(1, (screenTime - land) / 0.15));
    ctx.fillStyle = "#1b1420";
    roundRect(sx - 4, sy - 4, 56, 56, 9);
    ctx.fill();
    ctx.fillStyle = "#463b4a";
    roundRect(sx, sy, 48, 48, 7);
    ctx.fill();
    if (st.got || st.owned) {
      if (!st.got) ctx.globalAlpha = 0.4; // owned from an earlier run
      drawSticker(sx + 24, sy + 24 - (1 - k) * 60, 40, -1);
      ctx.globalAlpha = 1;
    }
    if (st.got && k > 0 && k < 1 && !st.pinged) {
      st.pinged = true;
      play("tally");
    }
  });
  const got = r.stickers.filter((x) => x.got || x.owned).length;
  text(`${got}/3`, px + 452, py + 296, 32, "#ffcf2e", "left", null);
  // Stamps where this level can award them, in one column: Ghost (never
  // spotted) and Takedown (every card put down) compete; Quick is 1-6's par.
  const sx = px + 530;
  let sy = py + 130;
  if (r.unseen !== null) {
    stamp("Ghost", r.unseen, sx, sy);
    sy += 82;
  }
  if (r.takedown) {
    stamp("Takedown", r.takedown.got, sx, sy);
    // The tally under it: this run, and the best one saved.
    text(`${r.takedown.n}/${r.takedown.of}${r.takedown.best > r.takedown.n ? ` (best ${r.takedown.best})` : ""}`, sx, sy + 48, 16, r.takedown.got ? "#ffcf2e" : "#cfc6d6", "center", null);
    sy += 92;
  }
  if (r.quick !== null) stamp("Quick", r.quick, sx, sy);
  if (r.assisted && (r.unseen !== null || r.takedown || r.quick !== null)) text("Slow spotting: no stamps", sx, py + ph - 62, 16, "#cfc6d6", "center", null);
  if (r.unlocked) text(`${r.unlocked} is open!`, W / 2, py + ph - 26, 32, "#9be36a", "center", null);
}
/** World clear: the old results screen, retitled, with world totals and the
 * three world medals, then one caption in the comic's style. */
function drawWorldClear() {
  ctx.drawImage(derived.forestColor, 0, 0, W, H);
  ctx.fillStyle = "rgba(14,10,20,0.5)";
  ctx.fillRect(0, 0, W, H);
  const px = 120,
    py = 18,
    pw = 720,
    ph = 412;
  panel(px, py, pw, ph);
  text("World 1 - Green Forest: clear!", W / 2, py + 40, 32, "#cfc6d6", "center", null);
  text("You got your red back!", W / 2, py + 86, 48, "#ffffff", "center", "#000");
  ctx.fillStyle = "#3d3042";
  roundRect(px + 60, py + 196, 100, 14, 7);
  ctx.fill();
  drawRubik("red", (Math.floor(clock * 4) % 2) * 32, 0, px + 110, py + 202, 1, 1);
  const total = C.stickerTotal(save),
    rows = [
      ["Stickers", `${total}/${C.TOTAL_STICKERS}`],
      ["Levels", `${C.WORLD1.filter((id) => C.isCleared(save, id)).length}/${C.WORLD1.length}`],
      ["Getaway", fmtTime(game.escapeTime ?? 0)],
    ];
  rows.forEach(([k, v], i) => {
    text(k, px + 220, py + 142 + i * 36, 32, "#cfc6d6", "left", null);
    text(v, px + 470, py + 142 + i * 36, 32, "#ffffff", "right", null);
  });
  // Six little faces: each level's sticker count.
  C.WORLD1.forEach((id, i) => {
    const rec = C.levelRecord(save, id);
    chalkFace(px + 540 + (i % 3) * 52, py + 150 + Math.floor(i / 3) * 56, 14, (k) => (k < rec.stickers.length ? "#ffcf2e" : "#463b4a"), rec.stickers.length === 3);
  });
  const medals = C.worldMedals(save),
    list = [
      ["Full face", medals.fullFace, `all ${C.TOTAL_STICKERS} stickers`],
      ["Ghost", medals.ghost, "Ghost on 1-3, 1-5, 1-6"],
      ["Quick getaway", medals.quickGetaway, `home in ${getLevel("1-6").par} s`],
    ];
  list.forEach(([name, got, how], i) => {
    const appear = Math.max(0, Math.min(1, (screenTime - 0.4 - i * 0.35) / 0.3)),
      cx = px + 140 + i * 220,
      cy = py + 296,
      flip = reducedMotion ? 1 : Math.abs(Math.cos((1 - appear) * Math.PI * 0.5));
    if (appear <= 0) return;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(Math.max(0.05, flip), 1);
    ctx.fillStyle = got ? "#fbf9f2" : "#4a3f4e";
    roundRect(-100, -40, 200, 84, 10);
    ctx.fill();
    ctx.fillStyle = got ? COLORS.red : "#2b2230";
    roundRect(-94, -34, 188, 72, 6);
    ctx.fill();
    ctx.restore();
    if (flip > 0.6) {
      text(name, cx, cy - 6, 32, got ? "#ffffff" : "#9a8fa0", "center", got ? "#5a0e0a" : null);
      text(got ? "earned!" : how, cx, cy + 26, 32, got ? "#ffe066" : "#9a8fa0", "center", got ? "#5a0e0a" : null);
    }
  });
  // One narration box, the comic's caption style, after the medals.
  if (screenTime > 1.6) {
    const a = reducedMotion ? 1 : Math.min(1, (screenTime - 1.6) / 0.4);
    ctx.globalAlpha = a;
    ctx.fillStyle = "#1b1420";
    ctx.fillRect(W / 2 - 320, py + ph - 66, 640, 44);
    ctx.fillStyle = "#f6efd9";
    ctx.fillRect(W / 2 - 317, py + ph - 63, 634, 38);
    text("Green and red are back. Blue is up in the mountains.", W / 2, py + ph - 36, 32, "#1b1420", "center", null);
    ctx.globalAlpha = 1;
  }
}
/** The world map: a side view built from bg1-sky over bg1 that regains color
 * with every clear, a path of slab cells, six chalk-face nodes (1-6 is the
 * vault under the red beacon), Rubik walking node to node. */
function drawMap() {
  const amount = C.forestColor(save);
  ctx.fillStyle = derived.skyFill;
  ctx.fillRect(0, 0, W, H);
  // bg1-sky continues bg1 upward: its bottom 20 rows fill the 40 px band the
  // forest (shifted down 40 px) leaves at the top, both at exactly 2x.
  ctx.drawImage(img.sky, 0, 431, 480, 20, 0, 0, 960, 40);
  if (amount > 0.01) {
    ctx.globalAlpha = amount;
    ctx.drawImage(derived.skyColor, 0, 431, 480, 20, 0, 0, 960, 40);
    ctx.globalAlpha = 1;
  }
  ctx.drawImage(img.forest, 0, 40, W, H);
  if (amount > 0.01) {
    ctx.globalAlpha = amount;
    ctx.drawImage(derived.forestColor, 0, 40, W, H);
    ctx.globalAlpha = 1;
  }
  ctx.fillStyle = derived.groundFill;
  ctx.fillRect(0, 40 + H - 2, W, 4);
  // The red beacon rises behind the vault node until World 1 is clear.
  const vault = MAP_NODES[MAP_NODES.length - 1];
  if (!C.worldClear(save)) {
    const pulse = reducedMotion ? 0.85 : 0.8 + Math.sin(clock * 2) * 0.2;
    ctx.save();
    ctx.globalCompositeOperation = "screen";
    for (const [half, alpha] of [
      [40, 0.12],
      [18, 0.2],
      [7, 0.24],
    ]) {
      const v = ctx.createLinearGradient(0, vault.y - 20, 0, vault.y - 360);
      v.addColorStop(0, `rgba(230,70,50,${alpha * pulse})`);
      v.addColorStop(1, "rgba(230,70,50,0)");
      ctx.fillStyle = v;
      ctx.fillRect(vault.x - half, vault.y - 360, half * 2, 340);
    }
    ctx.restore();
  }
  text("World 1", W / 2, 46, 32, "#fbf9f2", "center", "#000");
  text("Green Forest", W / 2, 88, 48, "#ffffff", "center", "#000");
  // Path: slab cells (atlas row 0, cells 12-17, top 12 source px) at 2x, one
  // continuous strip; segments to locked nodes are faint, and a newly opened
  // segment draws in over 0.6 s.
  const first = MAP_NODES[0].x - 48,
    last = MAP_NODES[MAP_NODES.length - 1].x + 48,
    cells = Math.round((last - first) / 32);
  for (let j = 0; j < cells; j++) {
    const x = first + j * 32,
      seg = Math.max(0, Math.min(MAP_NODES.length - 2, Math.floor((x + 16 - MAP_NODES[0].x) / 140))),
      to = seg + 1,
      revealing = map.reveal && map.reveal.to === to,
      reached = x + 16 <= MAP_NODES[0].x + 4 || C.isUnlocked(save, MAP_NODES[to].id),
      along = (x + 16 - MAP_NODES[seg].x) / 140,
      lit = revealing ? along <= Math.min(1, map.reveal.age / 0.6) : reached;
    ctx.globalAlpha = lit ? 1 : 0.35;
    const cell = j === 0 ? 12 : j === cells - 1 ? 17 : 13 + (j % 4);
    ctx.drawImage(img.tiles, cell * 16, 0, 16, 12, x, MAP_NODES[0].y, 32, 24);
  }
  ctx.globalAlpha = 1;
  // Nodes: chalk faces on sticks; locked ones are a faint outline, open ones
  // bob, cleared ones are filled with the color Rubik finished in.
  MAP_NODES.forEach((node, i) => {
    const rec = C.levelRecord(save, node.id),
      open = C.isUnlocked(save, node.id) && !(map.reveal && map.reveal.to === i),
      bob = open && !rec.clear && !reducedMotion ? Math.round(Math.sin(clock * 3 + i) * 3) : 0,
      x = node.x,
      y = node.y - 82 + bob,
      full = rec.stickers.length === 3;
    ctx.globalAlpha = open ? 1 : 0.4;
    ctx.fillStyle = "#c9b48a";
    ctx.fillRect(x - 2, y + 28, 4, node.y - y - 28);
    if (full) {
      // A 3/3 level gets a gold rim on its node (Celeste's lesson).
      ctx.strokeStyle = "#ffcf2e";
      ctx.lineWidth = 4;
      ctx.strokeRect(x - 31, y - 31, 62, 62);
    }
    if (i === MAP_NODES.length - 1) {
      // The vault node: cofre.png at 2x.
      ctx.drawImage(img.vault, x - 23, y - 20, 46, 40);
      if (rec.clear) {
        ctx.fillStyle = "rgba(232,56,44,0.55)";
        ctx.fillRect(x - 15, y - 13, 30, 28);
      }
    } else chalkFace(x, y, 17, rec.clear ? COLORS[rec.color || "white"] : open ? "rgba(20,16,26,0.5)" : null, open && i === map.cursor);
    ctx.globalAlpha = 1;
    text(node.id, x, y - 38, 16, open ? "#fbf9f2" : "#bdb4c2", "center", "#1b1420");
    // Three sticker pips under the path, and a red seal for any stamp.
    for (let k = 0; k < 3; k++) {
      ctx.fillStyle = rec.stickers.includes(k + 1) ? "#ffcf2e" : open ? "rgba(27,20,32,0.75)" : "rgba(27,20,32,0.35)";
      roundRect(x - 23 + k * 16, node.y + 32, 12, 12, 3);
      ctx.fill();
    }
    if (rec.unseen || rec.takedown || rec.quick) {
      ctx.fillStyle = COLORS.red;
      ctx.beginPath();
      ctx.arc(x + 34, y - 26, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#fbf9f2";
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  });
  // Rubik walks node to node on the path (his 2x run row).
  const a = MAP_NODES[map.from],
    b = MAP_NODES[map.cursor],
    k = map.walk,
    rx = a.x + (b.x - a.x) * k,
    walking = k < 1,
    dir = b.x >= a.x ? 1 : -1,
    color = C.isCleared(save, "1-6") ? "red" : C.isCleared(save, "1-2") ? "green" : "white";
  drawRubik(color, walking ? (Math.floor(clock * 12) % 4) * 32 : (Math.floor(clock * 4) % 2) * 32, walking ? 64 : 0, rx + 34, a.y + 2 - (walking && !reducedMotion ? Math.abs(Math.sin(k * Math.PI)) * 10 : 0), dir, 1);
  // HUD: owned forms (top left) and the world's sticker total (top right).
  const forms = ["white", "green", "red"].filter((c) => c === "white" || (c === "green" && C.isCleared(save, "1-2")) || (c === "red" && C.isCleared(save, "1-6")));
  forms.forEach((c, i) => formCard(c, 16 + i * 30, 14, 34, 48, null, -0.05 + i * 0.12, 1));
  ctx.fillStyle = "#1b1420";
  roundRect(W - 16 - 124, 54, 124, 36, 8);
  ctx.fill();
  drawSticker(W - 16 - 104, 72, 20, -1);
  text(`${C.stickerTotal(save)}/${C.TOTAL_STICKERS}`, W - 24, 82, 32, "#ffcf2e", "right", null);
  // Bottom panel: the selected level.
  const level = getLevel(C.WORLD1[map.cursor]),
    rec = C.levelRecord(save, level.id),
    py = 470;
  ctx.fillStyle = "rgba(27,20,32,0.86)";
  roundRect(150, py, 660, 60, 12);
  ctx.fill();
  text(`${level.id}  ${level.name}`, 170, py + 28, 32, "#ffffff", "left", null);
  text(level.idea, 170, py + 52, 16, "#cfc6d6", "left", null);
  text(rec.best === null ? "" : `best ${fmtTime(rec.best)}`, 640, py + 28, 32, "#cfc6d6", "right", null);
  for (let i = 0; i < 3; i++) {
    ctx.fillStyle = rec.stickers.includes(i + 1) ? "#ffcf2e" : "#463b4a";
    roundRect(656 + i * 26, py + 10, 20, 20, 4);
    ctx.fill();
  }
  const touch = inputMode === "touch",
    prompt = map.prompt > 0 ? "locked" : touch ? "tap again: play" : "Enter: play";
  text(prompt, 790, py + 52, 16, map.prompt > 0 ? "#ff9b8a" : "#ffcf2e", "right", null);
}
function fmtTime(t) {
  return `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, "0")}.${Math.floor((t % 1) * 10)}`;
}

// ------------------------------------------------------------------- loop --
function stepPlay(now) {
  // QA steps and the level card's first 0.4 s (unless a key skips it) hold
  // the world: the clock follows the frame, queued input waits for play.
  if (manual || (fx.intro && !fx.intro.skipped && fx.intro.age < 0.4)) return stepper.hold(now);
  // Fixed 120 Hz ticks; each stamped input change lands on its own tick.
  stepper.run(now, applyChange, () => {
    M.update(game, M.TICK, getInput());
    clearPulses();
  });
}
function frame(now) {
  const dt = Math.min(0.1, (now - lastFrame) / 1000);
  lastFrame = now;
  clock += dt;
  screenTime += dt;
  // Off the play screen the simulation clock only follows the frames, so
  // entering a level never fast-forwards through the time spent in menus.
  if (screen !== "play") stepper.hold(now);
  if (screen === "play") {
    stepPlay(now);
    handleEvents();
    if (game.respawns !== lastRespawns) {
      lastRespawns = game.respawns;
      snapCamera();
    }
    updateFx(dt);
    updateCamera(dt);
    if (game.phase === "won") {
      // 0.25 s of stillness, the goal face flips and fills, the iris closes
      // on Rubik, then the tally (at most ~2.5 s, skippable by Continue).
      fx.clear += dt;
      if (fx.clear > 1.2 && fx.irisDir === 0 && fx.iris === 0) fx.irisDir = 1;
      if (fx.clear > 2.1) {
        setScreen(LV.id === C.WORLD1[C.WORLD1.length - 1] ? "world" : "results");
        play("win");
      }
    }
  } else if (screen === "map") {
    updateMap(dt);
    if (fx.irisDir) fx.iris = Math.max(0, Math.min(1, fx.iris + fx.irisDir * dt * (1 / 0.8)));
    if (fx.iris === 0 || fx.iris === 1) fx.irisDir = 0;
  }
  measureCrop();
  render();
  syncTouch();
  requestAnimationFrame(frame);
}
function render() {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.imageSmoothingEnabled = false;
  if (!assetsReady) return drawBoot();
  if (screen === "title") return drawTitle();
  if (screen === "story") return drawStory();
  if (screen === "ending") return drawEnding();
  if (screen === "results") return drawResults();
  if (screen === "world") return drawWorldClear();
  if (screen === "map") {
    drawMap();
    return drawIris(fx.iris);
  }
  drawWorld();
  drawHud();
  drawReverse();
  drawGetCard();
  drawFlash();
  // The win iris closes on Rubik himself; the opening iris is screen-centred.
  if (game.phase === "won") drawIris(fx.iris, wx(game.player.x + M.PLAYER.w / 2), wy(game.player.y + M.PLAYER.h / 2));
  else drawIris(fx.iris);
  drawIntro(); // the level card sits on top while the iris opens behind it
}

// ---------------------------------------------------------------- QA API ---
function getState() {
  const s = structuredClone(game);
  return {
    ...s,
    stickers: M.stickerCount(game),
    stickerIds: game.stickers.filter((x) => x.collected).map((x) => x.id),
    stickerList: s.stickers,
    screen,
    assetsReady,
    level: { id: LV.id, name: LV.name, idea: LV.idea, kit: structuredClone(LV.kit), gets: C.getsIn(LV.id), par: LV.par, cols: LV.cols },
    intro: !!fx.intro,
    getCard: fx.get?.ability ?? null,
    map: { cursor: map.cursor, id: C.WORLD1[map.cursor], walking: map.walk < 1, revealing: !!map.reveal, menuOpen },
    campaign: {
      levels: [...C.WORLD1],
      unlocked: C.unlockedIds(save),
      stickerTotal: C.stickerTotal(save),
      totalStickers: C.TOTAL_STICKERS,
      worldClear: C.worldClear(save),
      worldMedals: C.worldMedals(save),
      forestColor: C.forestColor(save),
    },
    save: structuredClone(save),
    result: fx.result ? structuredClone(fx.result) : null,
    camera: { x: cam.x, y: cam.y },
    settings: { ...settings },
    motion: { reduced: reducedMotion, source: settings.reduceMotion === null ? "system" : "player" },
    audio: { musicDecoded: !!track.buffer, musicPlaying: !!track.source, musicRate: track.rate, context: audio?.state ?? "none" },
    // 1-6: the sealed-door cue is drawn (drawDoorCue) while this is true.
    doorCue: doorSealed(),
    // QA: the performance.now() moment the simulation state corresponds to
    // (loop.mjs), so a browser test can map a key's timeStamp to its tick.
    simClock: stepper.time,
  };
}
/** Straight into play for QA (no card, no iris): the level's own kit. */
function qaStart(id) {
  keysDown.clear(); // QA starts clean: nothing held, nothing queued
  held.clear();
  clearPulses();
  ui.pauseCard.hidden = true;
  startLevel(id, { intro: false });
  fx.iris = 0;
  fx.irisDir = 0;
  render();
  return getState();
}
window.__game = {
  getState,
  start: beginFrontEnd,
  skipStory() {
    if (screen === "story") startLevel(C.WORLD1[0], { skipIntro: true });
    return getState();
  },
  /** Restart the current level (1-1 on a fresh page) straight into play. */
  restart: () => qaStart(LV.id),
  /** Start any World 1 level by id ("1-1" .. "1-6"), unlocked or not. */
  startLevel: (id) => {
    if (!getLevel(id)) throw new Error(`Unknown level ${id}`);
    return qaStart(id);
  },
  openMap(id) {
    openMap(id || save.last);
    fx.iris = 0;
    fx.irisDir = 0;
    render();
    return getState();
  },
  /** Erase campaign progress (clears, stickers, stamps, hints); settings stay. */
  resetSave() {
    save = C.resetSave(storage, settings);
    return getState();
  },
  setManual(value) {
    manual = Boolean(value);
    stepper.hold(performance.now());
  },
  step(seconds, input = {}, options = {}) {
    if (screen !== "play") qaStart(LV.id);
    M.advance(game, seconds, input);
    handleEvents();
    updateFx(Math.min(seconds, 5));
    const target = cameraTarget();
    cam.x = target.x;
    cam.y = target.y;
    if (options.render !== false) render();
    return getState();
  },
  get model() {
    return game;
  },
  get campaign() {
    return C;
  },
  togglePause,
};

// ------------------------------------------------------------------- boot --
syncMotion();
syncSettingsLabels();
fitSurface();
setScreen("boot");
ui.start.disabled = true;
const font = new FontFace("monogram", "url(./assets/font.ttf)");
Promise.all([
  font
    .load()
    .then((face) => document.fonts.add(face))
    .catch(() => {}),
  ...Object.entries(FILES).map(([key, file]) => loadImage(key, file)),
])
  .then(() => {
    buildDerived();
    assetsReady = true;
    ui.start.disabled = false;
    setScreen("title");
  })
  .catch((error) => {
    console.error(error);
    announce("The art could not load. Please reload the page.");
  });
requestAnimationFrame(frame);
