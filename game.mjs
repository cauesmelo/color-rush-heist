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
import { PAL, FORM, installCss, ditherOn, nearestColour } from "./pixel-ui.mjs";
import { createUiDraw } from "./ui-draw.mjs";

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
const fx = { vaultOpen: 0, particles: [], flash: 0, flashColor: "#fff", reverse: -1, iris: 0, irisDir: 0, intro: null, get: null, refill: 0, swirl: null, clear: 0, chipDeal: {}, locked: 0, death: null, goal: 0, goalColor: null, result: null, popups: [], hearts: [], hudShake: 0, hurtFlash: 0, edge: 0, shownHp: null };
/** Dazed cards' ring: the longest daze timer seen since each card was last
 * dazed (the model starts it at ENEMY.charger.daze or .wallDaze), so the ring
 * empties from full whichever it was. Keyed by guard id. */
const dazeMax = new Map();
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
 * death a direction held since the death waits the model's 0.2 s landing
 * beat (WORLD.respawnHold), then moves Rubik. */
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
  // Windups by type, so the ear knows what is coming before the eye does: the
  // walker's rising saw, the charger's lower and longer one (its 0.8 s
  // telegraph), the sentinel's metallic ticks (it never moves, it jabs).
  windup: [["sawtooth", 220, 330, 0.25, 0.03]],
  windupCharger: [["sawtooth", 98, 196, 0.6, 0.045], ["noise", 300, 140, 0.5, 0.03, 0.05]],
  windupSentinel: [["square", 1760, 1760, 0.02, 0.035], ["square", 1760, 1760, 0.02, 0.035, 0.14], ["triangle", 2640, 2093, 0.06, 0.03, 0.28]],
  strike: [["noise", 2600, 500, 0.14, 0.06]],
  hurt: [["square", 150, 55, 0.16, 0.1], ["triangle", 660, 165, 0.28, 0.06, 0.04]],
  heal: [["triangle", 659, 659, 0.08, 0.06], ["triangle", 988, 988, 0.16, 0.06, 0.08]],
  // The heart a 3-chain pays: the heal pair plus a little run on top.
  healChain: [["square", 784, 784, 0.07, 0.05], ["square", 988, 988, 0.07, 0.05, 0.07], ["square", 1175, 1175, 0.07, 0.05, 0.14], ["triangle", 1568, 1568, 0.25, 0.06, 0.21]],
  fall: [["noise", 1500, 180, 0.32, 0.1], ["triangle", 180, 70, 0.3, 0.07, 0.06]],
  defeat: [["noise", 1300, 260, 0.2, 0.08], ["square", 420, 1260, 0.07, 0.05, 0.03]],
  daze: [["sine", 620, 420, 0.12, 0.05], ["sine", 500, 740, 0.12, 0.05, 0.12], ["sine", 520, 330, 0.18, 0.05, 0.24]],
  chain: [["square", 1568, 1568, 0.05, 0.03]],
  bonk: [["triangle", 110, 60, 0.18, 0.1], ["square", 1400, 1100, 0.04, 0.03, 0.02]],
  bump: [["triangle", 160, 80, 0.12, 0.08]],
  smash: [["noise", 600, 120, 0.25, 0.1]],
  // Bigger than a stomp: a low punch under a noise crack.
  knock: [["square", 320, 70, 0.18, 0.1], ["noise", 1000, 200, 0.2, 0.09]],
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
  dashjump: [["noise", 1100, 400, 0.1, 0.05], ["square", 520, 820, 0.08, 0.04]],
  hint: [["sine", 660, 880, 0.08, 0.03]],
  ui: [["square", 700, 700, 0.03, 0.03]],
};
/** `pitch` scales every frequency of the cue (the stomp chain climbs). */
function play(name, pitch = 1) {
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
    const a0 = f0 * pitch,
      a1 = f1 * pitch;
    if (type === "noise") {
      const buffer = a.createBuffer(1, Math.ceil(a.sampleRate * dur), a.sampleRate),
        d = buffer.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      const src = a.createBufferSource(),
        filter = a.createBiquadFilter();
      src.buffer = buffer;
      filter.type = "bandpass";
      filter.frequency.setValueAtTime(a0, t0);
      filter.frequency.exponentialRampToValueAtTime(a1, t0 + dur);
      src.connect(filter).connect(gain);
      src.start(t0);
    } else {
      const osc = a.createOscillator();
      osc.type = type;
      osc.frequency.setValueAtTime(a0, t0);
      osc.frequency.exponentialRampToValueAtTime(a1, t0 + dur);
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
  fx.popups = [];
  fx.hearts = [];
  fx.hudShake = 0;
  fx.hurtFlash = 0;
  fx.edge = 0;
  fx.shownHp = game.player.hp;
  dazeMax.clear();
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
  snapCard();
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
  // be used to farm anything; it simply isn't counted as a death. Pressed
  // during a water fall's hop it is still a full retry (checkpoint, full
  // hearts), not the fall's partial hop back.
  if (game.deathKind === "fall") game.deathKind = "death";
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
/** Integer scaling where possible: the 960x540 surface is shown at a whole
 * number of DEVICE pixels per canvas pixel (1x, 2x, 3x...; on a 2x display
 * that is 960 CSS px for 2 device px per pixel), so every pixel is a crisp
 * square and the DOM's art-pixel unit (--ap) lands on the device grid. When the
 * window cannot hold 1x it is fitted below 1x and the browser's
 * nearest-neighbour scaling applies (hard edges, uneven pixel sizes; a known
 * limit, UI_STYLE.md). Portrait phones use the CSS column layout instead. */
function fitSurface() {
  const surface = $("surface"),
    stage = $("stage"),
    dpr = window.devicePixelRatio || 1,
    /** Whole device px per canvas px for a box of css px, else the fractional fit. */
    scaleFor = (cssW, cssH) => {
      const k = Math.min((cssW * dpr) / W, (cssH * dpr) / H);
      return k >= 1 ? Math.floor(k) : k;
    },
    cssWidth = (k) => (W * k) / dpr;
  if (document.fullscreenElement) {
    stage.style.width = cssWidth(scaleFor(innerWidth, innerHeight)) + "px";
    surface.style.width = "";
    return setUnit();
  }
  stage.style.width = "";
  if (portrait() && touchPadsShown()) {
    surface.style.width = "";
    return setUnit();
  }
  const embedded = document.documentElement.classList.contains("itch-embed"),
    pad = embedded ? 0 : 16;
  let k = scaleFor(innerWidth - pad * 2, innerHeight - pad * 2);
  if (k < 1) k = scaleFor(innerWidth, innerHeight); // drop the margin before shrinking
  surface.style.width = cssWidth(k) + "px";
  setUnit();
}
/** --ap: one art pixel in CSS px (the stage is 480 art px wide); every DOM
 * length in style.css is a whole number of it. */
function setUnit() {
  const w = $("stage").getBoundingClientRect().width || W;
  document.documentElement.style.setProperty("--ap", w / (W / 2) + "px");
  snapCard();
}
/** The pause card's height is a whole, even number of art px, so it centres on
 * the grid (an odd height would sit half an art pixel off). */
function snapCard() {
  const card = ui.pauseCard;
  if (!card || card.hidden) return;
  const ap = parseFloat(document.documentElement.style.getPropertyValue("--ap")) || 2;
  card.style.height = "auto";
  const natural = card.getBoundingClientRect().height;
  card.style.height = "";
  card.style.setProperty("--card-h", String(Math.min(262, Math.ceil(natural / ap / 2) * 2)));
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
  save = C.recordClear(save, id, { time: game.finishTime, stickers: collected, spotted: game.spotted, takedowns: game.takedowns.length, cards: game.guards.length, escapeTime: game.escapeTime, chain: game.medals?.chain ?? game.chainBest, color: game.player.color, assisted: game.assisted });
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
    hits: game.medals?.hits ?? game.hits + game.falls, // hearts lost (cards and water)
    chainN: game.medals?.chain ?? game.chainBest,
    chain: stamps.chain ? { got: !game.assisted && (game.medals?.chain ?? 0) >= LV.chainPar, par: LV.chainPar, best: after.chainBest } : null,
    unlocked: C.unlockedIds(save).find((x) => !wasOpen.includes(x)) || null,
  };
}
/** Rubik's squash/stretch: scale x/y for `dur` seconds, easing back to 1. */
function squash(sx, sy, dur) {
  if (reducedMotion) return;
  fx.squash = { sx, sy, t: dur, dur };
}
/** Major pentatonic steps: a chained stomp climbs one per link (5 notes and
 * the octave), so a long chain is heard as a run, never as a clash. */
const PENTATONIC = [1, 9 / 8, 5 / 4, 3 / 2, 5 / 3, 2];
const chainPitch = (n) => PENTATONIC[Math.max(0, Math.min(PENTATONIC.length - 1, (n || 1) - 1))];
/** The cue for an event: most are the event's own name; windups differ by
 * enemy type, stomps and chain pings climb with the chain, and the heart a
 * chain pays gets its fanfare. */
function cue(e) {
  if (e.type === "windup") return play(e.etype === "charger" ? "windupCharger" : e.etype === "sentinel" ? "windupSentinel" : "windup");
  if (e.type === "stomp") return play("stomp", chainPitch(e.chain));
  if (e.type === "chain") return e.n >= 2 ? play("chain", chainPitch(e.n)) : undefined;
  if (e.type === "heal") return play(e.source === "chain" ? "healChain" : "heal");
  play(e.type);
}
const guardOf = (id) => game.guards.find((c) => c.id === id);
/** A floating word in the pixel font at a world point ("x3", "+1"). It is
 * information, so reduced motion keeps it (it only stops rising). */
function popup(label, x, y, color = "#fbf9f2", opts = {}) {
  fx.popups.push({ label, x, y, color, age: 0, life: opts.life ?? 0.8, size: opts.size ?? 32, heart: !!opts.heart });
  if (fx.popups.length > 12) fx.popups.shift();
}
/** Paper confetti in a card's colour: small spinning rects (no new art). */
function confetti(x, y, color, count = 16) {
  if (reducedMotion) return;
  for (let i = 0; i < count; i++) {
    const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.4,
      sp = 160 + Math.random() * 220;
    fx.particles.push({ x: x + (Math.random() - 0.5) * 30, y: y + (Math.random() - 0.5) * 40, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0.7 + Math.random() * 0.4, age: 0, color: i % 3 === 0 ? "#fbf9f2" : color, size: 9, gravity: 700, spin: (Math.random() - 0.5) * 24, rot: Math.random() * 3 });
  }
}
const heartsWord = (n) => `${n} heart${n === 1 ? "" : "s"}`;
/** Consume new model events: sounds, particles, transitions. */
function handleEvents() {
  for (const e of game.events) {
    if (e.id <= lastEventId) continue;
    lastEventId = e.id;
    cue(e);
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
      case "dash":
        dust(e.x - e.direction * 16, p.y + p.h, -e.direction, 6);
        break;
      case "stomp": {
        // The best feeling in the game: every link of a chain bursts more,
        // squashes harder and shakes more (capped at a 4-chain, so a long
        // chain never shakes the screen unreadable).
        const n = Math.max(1, Math.min(4, e.chain || 1));
        burst(e.x, e.y, 8 + n * 4, "#fff6c4", 140 + n * 25, 0.45);
        burst(e.x, e.y, 2 + n * 2, "#1b1420", 110 + n * 20, 0.35, 3);
        squash(0.86 - n * 0.03, 1.16 + n * 0.05, 0.14 + n * 0.015);
        cam.shake = reducedMotion ? 0 : Math.max(cam.shake, 1 + n);
        break;
      }
      case "bounce":
        burst(e.x, e.y, 10, "#fff6c4", 150, 0.45);
        squash(0.84, 1.2, 0.14);
        cam.shake = reducedMotion ? 0 : Math.max(cam.shake, 1.5);
        break;
      case "chain":
        // The "x2 / x3" beside the card just put down (stomps and knocks),
        // 40 px aside so Rubik's bounce never rises through it.
        if (e.n >= 2) popup(`x${e.n}`, e.x + 40, e.y - 24, e.n >= M.WORLD.chainHeal ? "#ffd84a" : "#fbf9f2", { size: 32 + Math.min(3, e.n - 2) * 8 });
        break;
      case "hurt":
        // The hit: Rubik flashes white, the screen edges flash, a shake and a
        // spray, and the knock pose / blink come from the model's timers.
        fx.hurtFlash = reducedMotion ? 0 : 0.12;
        fx.edge = reducedMotion ? 0 : 0.4;
        cam.shake = reducedMotion ? 0 : Math.max(cam.shake, 5);
        burst(e.x, e.y, 12, "#ffffff", 190, 0.4, 4, 500);
        burst(e.x, e.y, 6, "#1b1420", 150, 0.35, 3, 500);
        announce(e.hp > 0 ? `Hit! ${heartsWord(e.hp)} left.` : "Out of hearts!");
        break;
      case "heal":
        popup("+1", e.x, e.y - 18, "#ffd84a", { heart: true, life: 1 });
        burst(e.x, e.y, 10, "#ffd84a", 120, 0.5, 3, 80);
        announce(`Heart back: ${e.hp} of ${M.WORLD.hearts}.`);
        break;
      case "fall":
        // Splash: water spray at the surface Rubik went into.
        burst(e.x, e.y + M.PLAYER.h, 16, "#cfe8ff", 240, 0.55, 4, 900);
        burst(e.x, e.y + M.PLAYER.h, 6, "#6fa8d8", 160, 0.45, 5, 900);
        cam.shake = reducedMotion ? 0 : Math.max(cam.shake, 3);
        announce(`Splash! ${heartsWord(e.hp)} left.`);
        break;
      case "windup": {
        // The windup is the committed telegraph: the card's own pose, bubble
        // and strike strip are drawn from its state; this is the kick-off.
        const c = guardOf(e.guard);
        if (!c) break;
        if (e.etype === "charger") dust(c.x - c.dir * 22, c.floor, -c.dir, 10);
        else if (e.etype === "sentinel") burst(c.x + c.dir * 44, c.floor - 58, 5, "#fbf9f2", 70, 0.25, 3, 0);
        else dust(c.x - c.dir * 18, c.floor, -c.dir, 4);
        break;
      }
      case "strike": {
        const c = guardOf(e.guard);
        if (c) dust(c.x - c.dir * 18, c.floor, -c.dir, e.etype === "charger" ? 12 : 6);
        break;
      }
      case "defeat": {
        const c = guardOf(e.guard);
        if (e.pad) {
          // A springboard card flattens grey and stays.
          burst(e.x, e.y + 30, 10, "#b9b4bf", 120, 0.4, 4, 300);
          break;
        }
        confetti(e.x, e.y, COLORS[c?.kind] || COLORS.green, e.how === "knock" ? 22 : 16);
        if (e.how !== "knock") cam.shake = reducedMotion ? 0 : Math.max(cam.shake, 2.5);
        break;
      }
      case "daze":
        dazeMax.set(e.guard, enemyOf(guardOf(e.guard) || { type: "charger" }).daze ?? M.ENEMY.charger.daze);
        burst(e.x, e.y, 8, "#ffe066", 120, 0.4, 3, 100);
        popup("dazed", e.x, e.y - 30, "#ffe066", { size: 16, life: 0.9 });
        break;
      case "bonk":
        // A charge into its bound: the card stops dead and is dazed.
        dazeMax.set(e.guard, M.ENEMY.charger.wallDaze);
        dust(e.x, e.y + M.GUARD.h / 2, 0, 8);
        burst(e.x, e.y, 6, "#ffe066", 110, 0.35, 3, 200);
        cam.shake = reducedMotion ? 0 : Math.max(cam.shake, 2.5);
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
        // Flying rock debris is motion too: under reduced motion the stone
        // just goes (the smash sound and the open gap carry the cue).
        if (!reducedMotion)
          for (let i = 0; i < 14; i++)
            fx.particles.push({ x: e.x + (Math.random() - 0.5) * 50, y: e.y + (Math.random() - 0.5) * 50, vx: (Math.random() - 0.5) * 420 + p.dashDirection * 160, vy: -Math.random() * 360, life: 0.9, age: 0, gravity: 1400, size: 16, debris: [128 + (i % 2) * 8, 32 + (i % 4 < 2 ? 0 : 8)] });
        break;
      case "knock":
        // The dash-knock outranks a stomp: a bigger burst in the red dash's
        // colour, a short red flash and the strongest shake short of the theft.
        burst(e.x, e.y, 22, "#ff5a4a", 280, 0.5, 5);
        burst(e.x, e.y, 8, "#ffffff", 200, 0.35, 4);
        popup("KO!", e.x, e.y - 50, "#ff8a7a", { size: 32 });
        cam.shake = reducedMotion ? 0 : Math.max(cam.shake, 6);
        fx.flash = reducedMotion ? 0 : 0.14;
        fx.flashColor = "#ff3b30";
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
    if (q.spin) q.rot += q.spin * dt;
    q.vy += q.gravity * dt;
    q.x += q.vx * dt;
    q.y += q.vy * dt;
  }
  fx.particles = fx.particles.filter((q) => q.age < q.life);
  fx.flash = Math.max(0, fx.flash - dt);
  fx.refill = Math.max(0, fx.refill - dt);
  fx.hurtFlash = Math.max(0, fx.hurtFlash - dt);
  fx.edge = Math.max(0, fx.edge - dt);
  fx.hudShake = Math.max(0, fx.hudShake - dt);
  for (const q of fx.popups) q.age += dt;
  fx.popups = fx.popups.filter((q) => q.age < q.life);
  // Hearts: diff what the HUD shows against the model, whatever changed it
  // (a hit, water, a checkpoint, a chain, a death's refill, a retry), so the
  // row can never disagree with game.player.hp. Each change animates.
  const hp = game.player.hp;
  if (fx.shownHp === null) fx.shownHp = hp;
  if (hp < fx.shownHp) {
    for (let i = hp; i < fx.shownHp; i++) fx.hearts.push({ i, kind: "loss", age: 0 });
    fx.hudShake = reducedMotion ? 0 : 0.35;
  } else if (hp > fx.shownHp) for (let i = fx.shownHp; i < hp; i++) fx.hearts.push({ i, kind: "gain", age: (fx.shownHp - i) * 0.08 });
  fx.shownHp = hp;
  for (const h of fx.hearts) h.age += dt;
  fx.hearts = fx.hearts.filter((h) => h.age < 0.6);
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
/** The world's own palette of the three forms (the UI uses pixel-ui.mjs FORM). */
const COLORS = { white: "#f3f0e4", green: "#5fbf3a", red: "#e8382c" };
/** Every UI element is drawn by ui-draw.mjs on the art-pixel grid (UI_STYLE.md);
 * game.mjs only supplies the state it reads. The `let` variables are getters so
 * the module always sees the live value. */
const pix = createUiDraw({
  ctx,
  M,
  C,
  img,
  derived,
  fx,
  cam,
  map,
  dazeMax,
  settings,
  GET_CARDS,
  MAP_NODES,
  getLevel,
  play: (name) => play(name),
  fmtTime: (t) => fmtTime(t),
  wx: (x) => wx(x),
  wy: (y) => wy(y),
  drawRubik: (...a) => drawRubik(...a),
  get game() {
    return game;
  },
  get save() {
    return save;
  },
  get LV() {
    return LV;
  },
  get screen() {
    return screen;
  },
  get screenTime() {
    return screenTime;
  },
  get clock() {
    return clock;
  },
  get reducedMotion() {
    return reducedMotion;
  },
  get inputMode() {
    return inputMode;
  },
  get hudInset() {
    return hudInset;
  },
  get colorAmount() {
    return colorAmount;
  },
});
/** World-anchored UI helpers: canvas px in, the 2 px art grid out. */
const badge = (color, x, y) => pix.badge(color, Math.round(x / 2), Math.round(y / 2));
const keycap = (label, x, y) => pix.keycapCentered(label, x, y);
const worldText = (str, x, y, color) => pix.text(str, Math.round(x / 2), Math.round(y / 2), { color, align: "center" });

/** The backdrop regains colour with the campaign as an ordered DITHER, never a
 * blend: a texture whose art pixels are the grey original except where the
 * Bayer pattern at `level`/16 takes the colorized one (UI_STYLE.md: no alpha
 * blends). Each level's texture is built once and the last few are kept. */
const mixCache = new Map();
function mixTexture(base, colour, level) {
  const [c, x] = makeCanvas(base.width, base.height, true),
    [, y] = makeCanvas(base.width, base.height, true);
  x.drawImage(base, 0, 0);
  y.drawImage(colour, 0, 0);
  const a = x.getImageData(0, 0, c.width, c.height),
    b = y.getImageData(0, 0, c.width, c.height);
  for (let j = 0; j < c.height; j++)
    for (let i = 0; i < c.width; i++)
      if (ditherOn(i, j, level)) {
        const p = (j * c.width + i) * 4;
        if (b.data[p + 3]) a.data.set(b.data.subarray(p, p + 4), p);
      }
  x.putImageData(a, 0, 0);
  return c;
}
function backdrop(kind) {
  const level = Math.min(16, Math.max(0, Math.round(colorAmount * 16))),
    grey = kind === "sky" ? img.sky : img.forest,
    colour = kind === "sky" ? derived.skyColor : derived.forestColor;
  if (level <= 0) return grey;
  if (level >= 16) return colour;
  const key = kind + level;
  let tex = mixCache.get(key);
  if (!tex) {
    tex = mixTexture(grey, colour, level);
    mixCache.set(key, tex);
    if (mixCache.size > 6) mixCache.delete(mixCache.keys().next().value);
  }
  return tex;
}
function drawBackground() {
  ctx.fillStyle = derived.skyFill;
  ctx.fillRect(0, 0, W, H);
  const bx = -((cam.x * 0.35) % W),
    by = Math.round((maxCamY - cam.y) * 0.35);
  // bg1-sky continues the drained sky above bg1 (originally at y = -268).
  const sx = -((cam.x * 0.15) % 2880);
  for (const ox of [0, 2880]) ctx.drawImage(backdrop("sky"), Math.round(sx + ox), by - 902, 2880, 902);
  for (const ox of [0, W]) ctx.drawImage(backdrop("forest"), Math.round(bx + ox), by, W, H);
  ctx.fillStyle = derived.groundFill;
  if (by + H < H) ctx.fillRect(0, by + H, W, H - by - H);
  // No red beacon behind the forest: the owner disliked the distant red light
  // pillar (2026-11-10), so the backdrop is only sky, forest and the
  // time-of-day tint. The goal reads from the level itself.
  const tint = TINTS[LV.tint];
  if (tint) {
    ctx.save();
    ctx.globalCompositeOperation = "multiply";
    ctx.fillStyle = tint;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }
}
/** Time of day per level, multiplied over the backdrop only (tiles, cards and
 * Rubik keep their true colors): 1-4 a storm, 1-5 dusk, 1-6 night. */
const TINTS = { storm: "#a9b6cf", dusk: "#f3c39b", night: "#8d88b8" };
/** Snap a canvas coordinate to the 2 px art grid. */
const even = (v) => Math.round(v / 2) * 2;
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
    // A deeper tint as a navy dither (no translucent fill), then the surface:
    // a blue band, two drifting light pixels and a foam line, all on the grid.
    pix.scrimPx(5, PAL.navy, x, top + 6, T, 58);
    ctx.fillStyle = PAL.blue;
    ctx.fillRect(x, top + 6, T, 8);
    const phase = reducedMotion ? 0 : clock * 40 + tx * 13;
    ctx.fillStyle = PAL.mist;
    ctx.fillRect(x + even(phase % 32), top + 6 + (Math.floor(phase / 8) % 2) * 2, 8, 2);
    ctx.fillRect(x + even((phase * 0.6 + 16) % 32), top + 10, 4, 2);
    ctx.fillStyle = PAL.white;
    ctx.fillRect(x, top + 4 + even(Math.sin((tx + (reducedMotion ? 0 : clock * 3)) * 1.3) * 1.5), T, 2);
  }
}
function drawStones() {
  for (const s of game.stones) {
    if (s.broken) continue;
    const x = wx(s.x * T),
      y = wy(s.y * T);
    if (x < -80 || x > W + 20) continue;
    // Tile_15's art (atlas cells 8..9 x 2..3) at 2x, plus a crack pattern and
    // red's badge: "only red breaks this", never told by color alone (a bare
    // red diamond on the stone's olive centre vanished under protanopia and
    // deuteranopia: red and olive are the confusion pair).
    ctx.drawImage(img.tiles, 128, 32, 32, 32, x, y, 64, 64);
    pix.crack(x, y, game.stolen ? PAL.rose : PAL.redDark);
    badge("red", x + 32, y + 32, 9);
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
  // The seal's frame pulses between two reds in 2 px lines (no alpha); streaks
  // at Rubik's body height flow left into it, blinking instead of fading.
  ctx.fillStyle = reducedMotion || Math.sin(clock * 5) > 0 ? PAL.rose : PAL.red;
  const fx0 = even(sx - 4),
    fy0 = even(wy(y0) - 4),
    fw = 2 * T + 8,
    fh = y1 - y0 + 8;
  ctx.fillRect(fx0, fy0, fw, 4);
  ctx.fillRect(fx0, fy0 + fh - 4, fw, 4);
  ctx.fillRect(fx0, fy0, 4, fh);
  ctx.fillRect(fx0 + fw - 4, fy0, 4, fh);
  for (let i = 0; i < 3; i++) {
    const t = reducedMotion ? 0.5 : (clock * 0.9 + i / 3) % 1,
      len = 20 - i * 4,
      px0 = right + 10 + (1 - t) * 70,
      py0 = floor - 46 + i * 14;
    if (!reducedMotion && Math.sin(t * Math.PI) < 0.3) continue;
    ctx.fillStyle = i === 1 ? PAL.mist : PAL.white;
    ctx.fillRect(even(px0), even(py0), len, 2);
    ctx.fillRect(even(px0), even(py0 - 4), 4, 2);
  }
  // The sign, in the HUD's own keycap language, once REVERSE has said it.
  if (fx.reverse < 0 && !(fx.reverseDelay > 0) && !fx.get) {
    const bob = reducedMotion ? 0 : Math.round(Math.sin(clock * 3) * 2);
    keycap(inputMode === "touch" ? "DASH" : "Shift", sx + T, wy(y0) + 38 + bob);
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
      fill = active ? FORM[game.snapshot?.color || "white"] : null;
    // A chalk 3x3 cube face (the cutout shape) on a stick: home-made, not a
    // platform. It fills with Rubik's color when it is his current checkpoint.
    ctx.fillStyle = PAL.mist;
    ctx.fillRect(even(x - 2), y - 32, 4, 32);
    ctx.fillStyle = PAL.stone;
    ctx.fillRect(even(x - 2), y - 32, 2, 32);
    chalkFace(x, y - 50, 12, fill, active);
  });
}
/** A chalk 3x3 cube face on the 2 px grid: `cell` canvas px per cell (even),
 * 2 px chalk lines, `fill` a palette colour, "dim" (a dithered dark wash) or
 * null. scaleX flips it in stepped widths (never a fractional scale). */
function chalkFace(x, y, cell, fill, bright, scaleX = 1) {
  const k = Math.max(0.25, Math.round(scaleX * 4) / 4),
    cw = Math.max(2, Math.round((cell * k) / 2) * 2),
    left = even(x - 1.5 * cw),
    top = even(y - 1.5 * cell);
  for (let i = 0; i < 9; i++) {
    const cx = left + (i % 3) * cw,
      cy = top + Math.floor(i / 3) * cell;
    if (fill === "dim") pix.dimWash(cx, cy, cw, cell);
    else if (fill) {
      ctx.fillStyle = fill;
      ctx.fillRect(cx, cy, cw, cell);
    }
    ctx.fillStyle = bright ? PAL.white : PAL.cream;
    ctx.fillRect(cx, cy, cw, 2);
    ctx.fillRect(cx, cy + cell - 2, cw, 2);
    ctx.fillRect(cx, cy, Math.min(2, cw), cell);
    ctx.fillRect(cx + cw - Math.min(2, cw), cy, Math.min(2, cw), cell);
  }
}
/** The goal face: the checkpoint face at 2x on a taller stick. Touching it
 * flips it and fills it with Rubik's current color. */
function drawGoal() {
  const goal = LV.goal;
  if (!goal) return;
  const x = wx(goal.x),
    y = wy(goal.floor);
  if (x < -80 || x > W + 80) return;
  ctx.fillStyle = PAL.mist;
  ctx.fillRect(even(x - 3), y - 64, 6, 64);
  ctx.fillStyle = PAL.stone;
  ctx.fillRect(even(x - 3), y - 64, 2, 64);
  const won = game.phase === "won",
    k = won ? fx.goal : 0,
    flip = reducedMotion ? 1 : Math.cos(k * Math.PI * 2),
    bob = reducedMotion || won ? 0 : Math.round(Math.sin(clock * 2.2) * 2);
  // A dithered halo so the goal reads from afar, without words.
  if (!won) pix.glow(Math.round(x / 2), Math.round((y - 100 + bob) / 2), 32, 32, 5, PAL.cream);
  chalkFace(x, y - 100 + bob, 22, won && k > 0.25 ? FORM[fx.goalColor || game.player.color] : "dim", won, Math.max(0.08, Math.abs(flip)));
}
/** 1-4's stray storm swirl: rubik_storm frames 1-3 at 2x over a stump. */
/** Storm wisps at the lip of every gap 1-4's main line dashes: the swirl's
 * own streaks drifting across (pointing the way), never text. */
function drawDashMarks() {
  for (const mark of LV.dashMarks || []) {
    const x = wx(mark.x),
      y = wy(mark.floor);
    if (x < -120 || x > W + 60) continue;
    // Storm wisps drifting along the gap: they blink in and out (no fading).
    for (let i = 0; i < 3; i++) {
      const t = reducedMotion ? 0.5 : (clock * 0.9 + i / 3) % 1,
        len = 22 - i * 4,
        sx = x + 6 + t * 70,
        sy = y - 46 - i * 14;
      if (!reducedMotion && Math.sin(t * Math.PI) < 0.3) continue;
      ctx.fillStyle = i === 1 ? PAL.mist : PAL.white;
      ctx.fillRect(even(sx), even(sy), len, 2);
      ctx.fillRect(even(sx + len - 4), even(sy - 4), 4, 2);
    }
  }
}
function drawPickups() {
  for (const pickup of game.pickups) {
    if (pickup.taken) continue;
    const x = wx(pickup.x),
      y = wy(pickup.y) + (reducedMotion ? 0 : Math.round(Math.sin(clock * 3) * 4));
    if (x < -60 || x > W + 60) continue;
    pix.glow(Math.round(x / 2), Math.round(y / 2), 23, 23, 8, PAL.mist);
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
    // The vault's red glow: a dithered pool (its strength pulses in steps).
    const strength = (game.stolen ? 0.9 * (1 - open) : 0.55) * pulse;
    pix.glow(Math.round((x + v.w / 2) / 2), Math.round((y + v.h / 2) / 2), 75, 75, Math.round(16 * strength), PAL.red);
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
    ctx.fillStyle = PAL.void;
    ctx.fillRect(dx, dy, dw, dh);
    pix.scrimPx(Math.round(8 * (1 - k * 0.6)), PAL.red, dx + 4, dy + 4, dw - 8, dh - 8);
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
      // Recharging: a ring that grows back, in grey (a hollow, not a faded, orb).
      pix.ring(x, y, 14 * (1 - orb.respawn / M.WORLD.orbRespawn) + 6, 14 * (1 - orb.respawn / M.WORLD.orbRespawn) + 6, PAL.stone, 2);
      continue;
    }
    // rubik_storm.png frames 1-3, cropped to their 20x20 centre, at 2x, in a
    // ring so it reads as a pickup (round, unlike square stickers).
    const f = 1 + (reducedMotion ? 0 : Math.floor(clock * 8) % 3),
      bob = reducedMotion ? 0 : Math.round(Math.sin(clock * 3) * 1.5) * 2;
    pix.glow(Math.round(x / 2), Math.round((y + bob) / 2), 13, 13, 5, PAL.white);
    pix.ring(x, y + bob, 26, 26, PAL.white, 2);
    ctx.drawImage(img.storm, f * 32 + 6, 6, 20, 20, x - 20, y - 20 + bob, 40, 40);
  }
}
function drawSticker(x, y, size, glint) {
  pix.sticker(Math.round(x / 2), Math.round(y / 2), Math.round(size / 2), glint);
}
function drawStickers() {
  for (const s of game.stickers) {
    if (s.collected) continue;
    const x = wx(s.x),
      y = wy(s.y);
    if (x < -40 || x > W + 40 || y < -40 || y > H + 40) continue;
    const bob = reducedMotion ? 0 : Math.round(Math.sin(clock * 2.6 + s.id) * 3);
    // Already in the save from an earlier run: a hollow outline (NSMB's
    // collected star coins), still worth touching for this run's tally.
    if (s.owned) pix.stickerOutline(Math.round(x / 2), Math.round((y + bob) / 2), 10);
    else drawSticker(x, y + bob, 20, reducedMotion ? -1 : ((clock * 0.6 + s.id * 0.37) % 1.6) / 0.6);
  }
}
const SHEETS = {
  green: { cw: 86, ch: 67, cx: 51, feet: 64, walk: [1, 7], idle: [2, 1], attack: [0, 10] },
  red: { cw: 110, ch: 86, cx: 53, feet: 68, walk: [1, 8], idle: [2, 2], attack: [0, 9] },
};
function drawCone(guard) {
  // Only active threats get a clear cone: dozing cards show none, and a card
  // that can't see Rubik's current color shows only a faint one.
  if (["stunned", "drained", "asleep", "away", "defeated"].includes(guard.state)) return;
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
const enemyOf = (guard) => M.ENEMY[guard.type] || M.ENEMY.walker;
/** Sheet frame for a card. Attack row 0: frames 0-3 the windup, 4-6 the
 * strike, 7+ the recovery, each spread over that type's own timing
 * (M.ENEMY), so a charger's 0.8 s windup draws as slowly as it plays. */
function guardFrame(guard, sheet) {
  const t = guard.anim,
    e = enemyOf(guard),
    k = (total) => Math.max(0, Math.min(1, 1 - guard.timer / total));
  switch (guard.state) {
    case "windup":
      return [0, Math.min(3, Math.floor(k(e.windup) * 4))];
    case "lunge":
      return [0, 4 + Math.min(2, Math.floor(k(e.strike) * 3))];
    case "recover":
      return [0, Math.min(sheet.attack[1] - 1, 7 + Math.floor(k(e.recover) * (sheet.attack[1] - 7)))];
    case "alert":
      // A sentinel holds its post: aware, it stands ready (idle frames, a
      // planted lean, drawGuard) and never walks; walkers and chargers chase.
      if (e.chase === 0) return [2, Math.floor(t * 8) % sheet.idle[1]];
      return [1, Math.floor(t * (guard.type === "charger" ? 11 : 14)) % sheet.walk[1]];
    case "calm":
      if (guard.mode === "patrol" && guard.turning <= 0) return [1, Math.floor(t * 7) % sheet.walk[1]];
      return [2, Math.floor(t * 5) % sheet.idle[1]];
    default:
      return [2, 0];
  }
}
/** The charger's armour, drawn in code over its head (card-local space,
 * left-facing): an iron cap with a horn, so the heavy type reads by its
 * silhouette as well as by its pace; its colour badge stays as it is. */
function chargerHelmet() {
  // Card-local px: the drawn card's top edge is ~84 px above its feet and
  // its face centre ~4 px forward of the body centre (measured on the red
  // sheet's idle and walk frames). The cap is a 30 x 20 art-px sprite (pixel-ui
  // kit) drawn at 2x in the card's own transform: its centre column is the
  // old ellipse's centre (-2 px) and its brim sits at the old y = -80.
  ctx.drawImage(pix.helmet(), -2 - 30, -80 - 24, 60, 40);
}
/** A defeated card for M.GUARD.defeatTime (0.5 s), then nothing (it has no
 * body from the first tick). A stomp flattens it and it bursts into paper
 * (confetti from handleEvents) inside a ring poof; a dash-knock sends it
 * spinning off along defeatDir. Reduced motion: it fades in place inside a
 * still ring (no squash, no spin), so "it is gone" still reads. */
function drawDefeat(guard, sheet, x, floor) {
  const t = guard.defeatT,
    T = M.GUARD.defeatTime;
  if (!(t < T)) return;
  const k = t / T,
    image = guard.kind === "red" ? img.cardRed : img.cardGreen,
    src = [0, 6 * sheet.cw, 0, sheet.cw, sheet.ch];
  // The fade-out is a blink (whole frames), never a blend.
  const card = (alpha) => {
    if (alpha < 0.55 && Math.floor(clock * 24) % 2) return;
    ctx.drawImage(image, src[1], src[2], src[3], src[4], -sheet.cx * 2, -sheet.feet * 2, sheet.cw * 2, sheet.ch * 2);
  };
  ctx.save();
  if (reducedMotion) {
    ctx.translate(x, floor);
    if (guard.dir > 0) ctx.scale(-1, 1);
    card(1 - k);
  } else if (guard.defeatHow === "knock") {
    const d = guard.defeatDir || 1;
    ctx.translate(x + d * 560 * t, floor - 40 - 420 * t + 1300 * t * t);
    ctx.rotate(d * t * 16);
    ctx.translate(0, 40);
    if (guard.dir > 0) ctx.scale(-1, 1);
    card(1 - k * 0.6);
  } else if (t < 0.16) {
    const f = t / 0.16;
    ctx.translate(x, floor);
    if (guard.dir > 0) ctx.scale(-1, 1);
    ctx.scale(1 + 0.6 * f, 1 - 0.82 * f);
    card(1);
  }
  ctx.restore();
  if (guard.defeatHow === "knock" && !reducedMotion) return;
  // The ring poof at the body's centre: two pixel ellipses that grow, then blink out.
  const rk = reducedMotion ? 0.5 : Math.min(1, t / (T * 0.8)),
    r = 24 + rk * 70,
    cy = floor - 40;
  if (k > 0.6 && Math.floor(clock * 24) % 2) return;
  pix.ring(x, cy, r, r * 0.6, PAL.cream, Math.max(1, Math.round(4 * (1 - rk)) + 1));
}
function drawGuard(guard) {
  if (guard.state === "away") return; // escape-only card, not here yet
  const sheet = SHEETS[guard.kind],
    x = wx(guard.x),
    floor = wy(guard.floor);
  if (x < -200 || x > W + 200) return;
  if (guard.state === "defeated") return drawDefeat(guard, sheet, x, floor);
  const e = enemyOf(guard),
    windK = guard.state === "windup" ? Math.max(0, Math.min(1, 1 - guard.timer / e.windup)) : 0;
  if (guard.state === "windup") pix.strikeZone(guard, windK);
  const image = guard.state === "drained" ? derived.cardGrey : guard.kind === "red" ? img.cardRed : img.cardGreen,
    [row, col] = guardFrame(guard, sheet),
    dw = sheet.cw * 2,
    dh = sheet.ch * 2;
  if (guard.absorb && guard.state !== "drained" && !game.unlocked.green) {
    // The glowing card holds Rubik's green: it pulses, unlike its neighbours.
    pix.glow(Math.round(x / 2), Math.round((floor - 44) / 2), 40, 40, reducedMotion ? 6 : 5 + Math.round(Math.sin(clock * 4) * 2), PAL.lime);
  }
  // The windup shake (motion: off under reduced motion; the lean stays).
  const jitter = guard.state === "windup" && !reducedMotion ? Math.round(Math.sin(clock * 75) * (1 + windK * 1.5)) : 0;
  ctx.save();
  ctx.translate(x + jitter, floor);
  // Sheets face left; a right-facing card mirrors around its body centre.
  // In this left-facing space a positive rotation tips the card's top back.
  if (guard.dir > 0) ctx.scale(-1, 1);
  if (guard.state === "windup") ctx.rotate((guard.type === "charger" ? 0.16 : 0.1) * windK);
  else if (guard.state === "recover") ctx.rotate(-0.09); // spent: drooped forward
  else if (guard.type === "sentinel" && ["alert", "suspect"].includes(guard.state)) ctx.rotate(-0.04); // planted, spear ready
  if (guard.state === "stunned" || guard.state === "drained") {
    ctx.translate(0, -6);
    const wobble = guard.state === "stunned" && !reducedMotion ? Math.sin(clock * 9) * 0.07 : 0;
    ctx.rotate(guard.state === "drained" ? 0.22 : (guard.type === "charger" ? -0.3 : -0.18) + wobble);
  }
  if (guard.squash > 0 && !reducedMotion) {
    // Stomped: squashed flat for a beat, springing back.
    const k = guard.squash / 0.16;
    ctx.scale(1 + 0.28 * k, 1 - 0.36 * k);
  }
  ctx.drawImage(image, col * sheet.cw, row * sheet.ch, sheet.cw, sheet.ch, -sheet.cx * 2, -sheet.feet * 2, dw, dh);
  if (guard.type === "charger" && guard.state !== "drained") chargerHelmet();
  ctx.restore();
  // Corner badge: the card's own glyph (it can't see its own color), beside
  // the original suit numeral (green 1, red 3).
  if (guard.state !== "drained") badge(guard.kind, x - guard.dir * 14, floor - 74, 9);
  // Awareness bubbles: every state change has a cue.
  const head = floor - M.GUARD.h - 14 - (guard.type === "charger" ? 18 : 0),
    bob = reducedMotion ? 0 : Math.sin(clock * 6 + guard.x) * 2;
  // A card whose cone is on Rubik in its own colour hums, even while it is
  // still searching after a stun: a "?" there read as "it suspects me" (the
  // red vault guard beside red Rubik after the theft, user playtest).
  const humming = guard.disguiseSeen && ["calm", "suspect", "search"].includes(guard.state);
  if (["suspect", "search"].includes(guard.state) && !humming) pix.bubble(x, head + bob, "?", { fill: PAL.lemon });
  else if (guard.state === "windup") pix.bubble(x + jitter, head - 4, "!!", { fill: PAL.red, w: 23, h: 19 });
  else if (["alert", "lunge"].includes(guard.state)) pix.bubble(x, head + bob, "!", { fill: PAL.rose });
  else if (guard.state === "recover") pix.openMarker(x, floor - M.GUARD.h - (guard.type === "charger" ? 14 : 0));
  else if (guard.state === "stunned") pix.dazeRing(guard, x, head - 8);
  else if (humming) {
    // Humming: the cone is on Rubik but he wears their color (a drawn note;
    // the pixel font has no music glyph).
    const b = pix.bubble(x, head + bob, "", { w: 15, h: 15 });
    pix.note(b.x + 3, b.y + 3);
  }
  if (guard.state === "calm" && guard.turning > 0 && guard.turning < M.GUARD.lookBack) worldText("…", x, head + 6, PAL.cream);
}
function playerFrame(p) {
  if (p.storm > 0) {
    const t = 1 - p.storm / M.WORLD.storm;
    if (t < 0.25) return [p.stormFrom, 64, 160];
    if (t < 0.75) return ["storm", (1 + Math.floor((t - 0.25) * 4)) * 32, 0];
    return [p.color, 0, 192];
  }
  if (p.dashTime > 0) return [p.color, (Math.floor((1 - p.dashTime / M.WORLD.dashDuration) * 6) % 6) * 32, 32];
  // The hit pose: the knock frame for the model's hurt timer (0.35 s), longer
  // than the 0.2 s of lost steering, so the hit reads even mid-air.
  if (p.knock > 0 || p.hurt > 0) return [p.color, 160, 96];
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
    if (d.reason === "caught") worldText("caught!", wx(d.x + M.PLAYER.w / 2), wy(d.y) - 18, PAL.lemon);
    return;
  }
  const p = game.player,
    [sheet, sx, sy] = playerFrame(p),
    cx = wx(p.x + p.w / 2),
    feet = wy(p.y + p.h);
  // Dash afterimages: three silhouettes in the form's colour, close behind.
  if (p.dashTime > 0 && sheet !== "storm")
    for (let i = 3; i > 0; i--) drawRubik(p.color + "Ghost", sx, sy, cx - p.dashDirection * i * (reducedMotion ? 26 : 20), feet, p.direction, reducedMotion ? 0.3 : 0.62 - i * 0.14);
  // Respawn grace and the post-hit invulnerability blink (a steady 0.65
  // alpha under reduced motion: a cue, not a flash).
  const graced = p.grace > 0 || p.invuln > 0,
    blink = graced && (reducedMotion || Math.floor(clock * 14) % 2 === 0);
  // Dash state lives on Rubik (Celeste's hair): spent charge dims him.
  let key = sheet;
  if (sheet !== "storm") {
    if (fx.hurtFlash > 0) key = p.color + "Flash"; // the hit's white flash
    else if (fx.refill > 0) key = p.color + "Flash";
    else if (p.dashCharge <= 0 && !p.grounded && p.dashTime <= 0) key = p.color + "Dim";
  }
  const sq = fx.squash,
    k = sq ? sq.t / sq.dur : 0,
    scaleX = sq ? 1 + (sq.sx - 1) * k : 1,
    scaleY = sq ? 1 + (sq.sy - 1) * k : 1;
  drawRubik(key, sx, sy, cx, feet, p.direction, blink ? (reducedMotion ? 0.65 : 0.45) : 1, 0, scaleX, scaleY);
  // His form's badge at the back of his head (the eyes are at the front), so
  // white, green and red Rubik differ by shape as well as hue. Not during a
  // swap's storm (the original transformation hides him), and only once he
  // owns a second form (1-1 is white only: nothing to tell apart).
  if (p.storm <= 0 && (game.unlocked.green || game.unlocked.red)) badge(p.color, cx - p.direction * 17 * scaleX, feet - 49 * scaleY, 7);
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
    // Particles are opaque squares on the 2 px grid; the last third of a life
    // blinks out instead of fading.
    const a = 1 - q.age / q.life;
    if (a < 0.3 && Math.floor(clock * 24 + q.age * 7) % 2) continue;
    if (q.debris) ctx.drawImage(img.tiles, q.debris[0], q.debris[1], 8, 8, even(wx(q.x) - 8), even(wy(q.y) - 8), 16, 16);
    else if (q.spin) {
      // Confetti: a paper slip turning over (its width follows the spin).
      const w = Math.max(2, Math.round((Math.abs(Math.cos(q.rot * 1.7)) * q.size + 2) / 2) * 2);
      ctx.fillStyle = PAL.ink;
      ctx.fillRect(even(wx(q.x) - w / 2 - 2), even(wy(q.y) - 4), w + 4, 8);
      ctx.fillStyle = nearestColour(q.color);
      ctx.fillRect(even(wx(q.x) - w / 2), even(wy(q.y) - 2), w, 4);
    } else {
      ctx.fillStyle = nearestColour(q.color);
      const size = Math.max(2, even(q.size));
      ctx.fillRect(even(wx(q.x) - size / 2), even(wy(q.y) - size / 2), size, size);
    }
  }
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
  pix.drawPopups();
  pix.drawHint();
  ctx.restore();
}
// ------------------------------------------------------- front-end screens --
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
    // the logo fading with its colors, then the comic's black page. Each
    // cross-fade is an ordered dither (pixels switch, colours never blend).
    ctx.drawImage(img.title, 0, 0, W, H);
    pix.ditherDraw(img.forest, Math.round(Math.min(1, t / STORY.drain) * 16), 0, 0, 480, 270, 0, 0, W, H);
    pix.ditherDraw(img.black, Math.round(Math.max(0, Math.min(1, (t - STORY.drain) / STORY.black)) * 16), 0, 0, 480, 270, 0, 0, W, H);
    return;
  }
  ctx.drawImage(img.black, 0, 0, W, H);
  PANELS.forEach(([key, x, y], i) => {
    const at = start + i * STORY.panel,
      age = t - at;
    if (age < 0) return;
    const image = img[key],
      k = reducedMotion ? 1 : Math.min(1, age / 0.18);
    // Each panel dissolves in at its own 2x size, placed on the 2 px grid (its
    // centre was at an odd canvas pixel for the odd-sized panels).
    pix.ditherDraw(image, Math.round(k * 16), 0, 0, image.width, image.height, Math.round(x - image.width / 2) * 2, Math.round(y - image.height / 2) * 2, image.width * 2, image.height * 2);
  });
  pix.drawStorySkip();
  if (t >= end) pix.iris(Math.min(1, (t - end) / 0.8));
  if (t >= close) startLevel(C.WORLD1[0], { skipIntro: false });
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
  if (!assetsReady) return pix.drawBoot();
  if (screen === "title") return pix.drawTitle();
  if (screen === "story") return drawStory();
  if (screen === "ending") return pix.drawEnding();
  if (screen === "results") return pix.drawResults();
  if (screen === "world") return pix.drawWorldClear();
  if (screen === "map") {
    pix.drawMap();
    return pix.iris(fx.iris);
  }
  drawWorld();
  pix.drawHud();
  pix.drawReverse();
  pix.drawGetCard();
  pix.drawFlash();
  // The win iris closes on Rubik himself; the opening iris is screen-centred.
  if (game.phase === "won") pix.iris(fx.iris, wx(game.player.x + M.PLAYER.w / 2), wy(game.player.y + M.PLAYER.h / 2));
  else pix.iris(fx.iris);
  pix.drawIntro(); // the level card sits on top while the iris opens behind it
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
    // Combat at a glance (QA): hearts, the blink, the chain and run totals.
    hp: game.player.hp,
    maxHp: M.WORLD.hearts,
    invuln: game.player.invuln,
    chain: game.player.chain,
    chainBest: game.chainBest,
    hits: game.hits,
    falls: game.falls,
    guards: s.guards.map((c) => ({ ...c, type: c.type, defeatT: c.defeatT ?? null })),
    hud: { hearts: fx.shownHp, heartFx: fx.hearts.length, popups: fx.popups.map((q) => q.label), edge: fx.edge },
    // What reduced motion removes (QA: all stay 0 / false under it).
    effects: { shake: cam.shake, flash: fx.flash, particles: fx.particles.length, squash: !!fx.squash, iris: fx.iris },
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
  /** QA (the pixel audit): every opaque colour of the runtime-derived world
   * textures (colorized forest and sky, darkened tiles, cones, tinted sheets,
   * the sampled fills), as 0xRRGGBB integers. Those are the colours the world
   * may legitimately show under the UI; the audit allows them in addition to
   * the UI palette and the original art. */
  worldColours() {
    const set = new Set(),
      take = (value) => {
        if (value instanceof HTMLCanvasElement) {
          const [c, x] = makeCanvas(value.width, value.height, true);
          x.drawImage(value, 0, 0);
          const d = x.getImageData(0, 0, c.width, c.height).data;
          for (let i = 0; i < d.length; i += 4) if (d[i + 3] === 255) set.add((d[i] << 16) | (d[i + 1] << 8) | d[i + 2]);
        } else if (typeof value === "string") {
          const m = value.match(/rgb\((\d+),(\d+),(\d+)\)/);
          if (m) set.add((m[1] << 16) | (m[2] << 8) | +m[3]);
        } else if (Array.isArray(value)) value.forEach(take);
        else if (value && typeof value === "object" && !(value instanceof Map)) Object.values(value).forEach(take);
      };
    take(derived);
    return [...set];
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
installCss(); // the DOM's pixel sprites, baked by the same painters as the canvas UI
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
