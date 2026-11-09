/** Color Rush Heist: browser front end, renderer, input, audio and QA API.
 *
 * The simulation lives in model.mjs (pure); this file only observes it. Every
 * sprite is drawn on ONE 2x pixel grid: 16 px Tileset cells -> 32 px tiles,
 * Rubik 32 px frames -> 64 px, cards 86x67 / 110x86 -> 2x, vault 23x20 -> 46x40.
 * Runtime effects (tints, grey card, colorized forest) are derived canvases;
 * asset files are never modified.
 */
import * as M from "./model.mjs";
import * as L from "./level.mjs";

const W = 960,
  H = 540,
  T = L.TILE;
const canvas = document.querySelector("#game"),
  ctx = canvas.getContext("2d");
ctx.imageSmoothingEnabled = false;
const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
const $ = (id) => document.getElementById(id);

// ---------------------------------------------------------------- storage --
// Private windows and sandboxed iframes may throw on storage access.
const store = {
  get(key, fallback) {
    try {
      const v = localStorage.getItem("color-rush-heist:" + key);
      return v === null ? fallback : JSON.parse(v);
    } catch {
      return fallback;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem("color-rush-heist:" + key, JSON.stringify(value));
    } catch {
      /* storage unavailable: settings last for this visit only */
    }
  },
};
const settings = {
  sfx: store.get("sfx", true),
  // On by default, but nothing streams before the player's first key or tap
  // (browsers require that gesture anyway); the choice is remembered.
  music: store.get("music", true),
  timer: store.get("timer", false),
};

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
function makeCanvas(w, h) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const x = c.getContext("2d");
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
    const [c, x] = makeCanvas(480, 270);
    x.drawImage(img.forest, 0, 0);
    const top = x.getImageData(2, 2, 1, 1).data,
      bottom = x.getImageData(2, 268, 1, 1).data;
    derived.skyFill = `rgb(${top[0]},${top[1]},${top[2]})`;
    derived.groundFill = `rgb(${bottom[0]},${bottom[1]},${bottom[2]})`;
  }
  // The sight cone keeps its original gradient, but its faint far end is
  // raised to a visible minimum so the WHOLE detection area can be seen.
  {
    const [c, x] = makeCanvas(176, 47);
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
    const [c, x] = makeCanvas(img.cardGreen.width, img.cardGreen.height);
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
      ["Dim", "rgba(20,20,40,0.42)"],
      ["Flash", "rgba(255,255,255,0.8)"],
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
function bakeTiles() {
  derived.back = [];
  derived.chunks = [];
  for (let c0 = 0; c0 < L.COLS; c0 += CHUNK) {
    const [b, bx] = makeCanvas(CHUNK * T, L.ROWS * T),
      [c, x] = makeCanvas(CHUNK * T, L.ROWS * T);
    for (let ty = 0; ty < L.ROWS; ty++)
      for (let tx = c0; tx < Math.min(L.COLS, c0 + CHUNK); tx++) {
        const dx = (tx - c0) * T,
          dy = ty * T;
        if (L.BACK[ty][tx] === "b") {
          const [ax, ay] = L.backCell(tx, ty);
          bx.drawImage(derived.tilesDark, ax * 16, ay * 16, 16, 16, dx, dy, T, T);
        }
        const ch = L.MAP[ty][tx];
        if (ch === "#" || ch === "=") {
          const [ax, ay] = ch === "#" ? L.tileCell(tx, ty) : L.ledgeCell(tx, ty);
          x.drawImage(img.tiles, ax * 16, ay * 16, 16, 16, dx, dy, T, T);
        }
      }
    derived.back.push(b);
    derived.chunks.push(c);
  }
}

// ---------------------------------------------------------------- state ----
let game = M.createGame(),
  screen = "boot",
  screenTime = 0,
  manual = false,
  lastFrame = performance.now(),
  accumulator = 0,
  inputMode = matchMedia("(pointer: coarse)").matches ? "touch" : "keyboard",
  coarsePointer = matchMedia("(pointer: coarse)").matches,
  storySeen = store.get("storySeen", false),
  lastEventId = 0,
  lastRespawns = 0,
  clock = 0; // wall clock for decoration (never affects the simulation)
const cam = { x: 0, y: 164, shake: 0, look: 80 };
const fx = { vaultOpen: 0, particles: [], flash: 0, flashColor: "#fff", reverse: -1, iris: 0, irisDir: 0, stageTitle: 0, refill: 0, swirl: null, clear: 0, chipDeal: {}, locked: 0, death: null };
let colorAmount = 0;
const held = new Set();
const pulses = { jump: false, jumpReleased: false, dash: false, color: undefined };

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
  checkpoint: [["sine", 784, 784, 0.08, 0.05], ["sine", 1046, 1046, 0.16, 0.05, 0.08]],
  die: [["square", 440, 110, 0.35, 0.06]],
  win: [["square", 523, 523, 0.1, 0.06], ["square", 659, 659, 0.1, 0.06, 0.1], ["square", 784, 784, 0.1, 0.06, 0.2], ["square", 1046, 1046, 0.3, 0.06, 0.3]],
  locked: [["square", 110, 100, 0.12, 0.05]],
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
  const wanted = settings.music && ["story", "play", "results"].includes(screen) && game.phase !== "paused";
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
  document.documentElement.dataset.screen = name;
  ui.start.hidden = name !== "title";
  ui.results.hidden = name !== "results";
  ui.pause.hidden = name !== "play";
  syncTouch();
  syncMusic();
  if (name === "results") setTimeout(() => $("continue").focus({ preventScroll: true }), 50);
  announce(
    {
      title: "Color Theft Story. Press any key to start.",
      story: "Story. Press any key to skip.",
      play: "Green Forest. Steal back the red.",
      results: "You got your red back!",
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
  // Replays skip the comic automatically; the first visit sees the story.
  if (storySeen) enterPlay(true);
  else setScreen("story");
  focusGame();
}
function enterPlay(fresh = true) {
  if (fresh) newGame();
  storySeen = true;
  store.set("storySeen", true);
  setScreen("play");
  // The Rubik-face iris opens on the stage; reduced motion cuts straight in.
  fx.iris = reducedMotion ? 0 : 1;
  fx.irisDir = reducedMotion ? 0 : -1;
  fx.stageTitle = 2.6;
  focusGame();
}
function newGame() {
  game = M.createGame();
  M.startGame(game);
  lastEventId = game.eventId;
  lastRespawns = 0;
  fx.particles = [];
  fx.reverse = -1;
  fx.vaultOpen = 0;
  fx.clear = 0;
  fx.death = null;
  fx.chipDeal = {};
  colorAmount = 0;
  snapCamera();
}
function togglePause(force) {
  if (screen !== "play") return;
  const pausing = force ?? game.phase === "playing";
  if (pausing && ["playing", "dead"].includes(game.phase)) {
    game.resumePhase = game.phase;
    game.phase = "paused";
    held.clear();
    clearPulses();
    ui.pauseCard.hidden = false;
    showPanel("menu");
    setTimeout(() => ui.resume.focus({ preventScroll: true }), 0);
  } else if (!pausing && game.phase === "paused") {
    game.phase = game.resumePhase || "playing";
    ui.pauseCard.hidden = true;
    held.clear();
    clearPulses();
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
  ui.music.setAttribute("aria-pressed", String(settings.music));
  ui.music.classList.toggle("off", !settings.music);
  ui.music.title = settings.music ? "Music on" : "Music off";
}
function toggleSetting(key) {
  settings[key] = !settings[key];
  store.set(key, settings[key]);
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
addEventListener("keydown", (event) => {
  const key = event.key.toLowerCase();
  if (event.metaKey || event.ctrlKey || event.altKey) return;
  inputMode = "keyboard";
  syncTouch();
  if (nativeActivation(event, key)) return;
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
    // The key that skips the comic also counts as the first input of play.
    enterPlay(true);
    if (gameKeys.has(key)) {
      held.add(key);
      queueKey(key);
    }
    return;
  }
  if (screen === "ending") {
    if (!event.repeat && key !== "tab") {
      event.preventDefault();
      setScreen("title");
    }
    return;
  }
  if (screen === "results") return; // native buttons own the results screen
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
  held.add(key);
  if (!event.repeat) queueKey(key);
});
addEventListener("keyup", (event) => {
  const key = event.key.toLowerCase();
  if (nativeActivation(event, key) && !held.has(key)) return;
  held.delete(key);
  if (KEY.jump.includes(key)) pulses.jumpReleased = true;
});
function moveMenuFocus(step) {
  const items = [...ui.pauseCard.querySelectorAll("[data-panel]:not([hidden]) button, [data-panel]:not([hidden]) a")];
  const index = items.indexOf(document.activeElement);
  items[(index + step + items.length) % items.length]?.focus({ preventScroll: true });
}
addEventListener("blur", () => {
  held.clear();
  clearPulses();
  if (screen === "play" && game.phase === "playing") togglePause(true);
});
document.addEventListener("visibilitychange", () => {
  if (document.hidden && screen === "play" && game.phase === "playing") togglePause(true);
});

// Pointer: tapping the stage on title/story/ending screens advances.
canvas.addEventListener("pointerdown", (event) => {
  if (event.pointerType === "touch") inputMode = "touch";
  syncTouch();
  if (screen === "story") enterPlay(true);
  else if (screen === "ending") setScreen("title");
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
$("opt-retry").addEventListener("click", () => {
  togglePause(false);
  retryCheckpoint();
});
$("opt-restart").addEventListener("click", () => {
  ui.pauseCard.hidden = true;
  enterPlay(true);
});
for (const button of document.querySelectorAll("[data-show]")) button.addEventListener("click", () => showPanel(button.dataset.show));
$("continue").addEventListener("click", () => setScreen("ending"));
$("again").addEventListener("click", () => enterPlay(true));
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
    if (screen === "story") enterPlay(true);
    if (screen !== "play") return false;
    return true;
  };
  button.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    inputMode = "touch";
    if (!activate()) return;
    button.setPointerCapture?.(event.pointerId);
    button.classList.add("down");
    if (button.dataset.input) held.add(button.dataset.input);
    if (button.dataset.action) pulses[button.dataset.action] = true;
    if (button.dataset.color) pulses.color = button.dataset.color;
  });
  for (const type of ["pointerup", "pointercancel", "lostpointercapture"])
    button.addEventListener(type, () => {
      button.classList.remove("down");
      if (button.dataset.input) held.delete(button.dataset.input);
      if (button.dataset.action === "jump") pulses.jumpReleased = true;
    });
  button.addEventListener("click", (event) => {
    if (event.detail !== 0 || !activate()) return;
    if (button.dataset.action) pulses[button.dataset.action] = true;
    if (button.dataset.color) pulses.color = button.dataset.color;
    if (button.dataset.action === "jump") setTimeout(() => (pulses.jumpReleased = true), 120);
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
  ui.touch.hidden = !(touchDevice && ["play", "story"].includes(screen));
  for (const b of ui.touch.querySelectorAll("[data-color]")) {
    b.hidden = !game.unlocked[b.dataset.color];
    b.classList.toggle("selected", game.player.color === b.dataset.color);
  }
}

// ----------------------------------------------------------------- camera --
const maxCamX = M.WORLD.width - W,
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
    if (L.MAP[L.WATER_ROW][Math.floor(x / T)] === "~") {
      y = Math.max(y, L.WATER_ROW * T + 64 - H + 8);
      break;
    }
  const screenFeet = feet - y;
  if (screenFeet < H * 0.3) y = feet - H * 0.3;
  if (screenFeet > H * 0.86) y = feet - H * 0.86;
  return {
    x: Math.max(0, Math.min(maxCamX, cx - W / 2 + cam.look)),
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
  const wantLook = (Math.abs(p.vx) > 40 ? Math.sign(p.vx) : p.direction) * 90;
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
        break;
      case "airjump":
        burst(e.x, e.y, 8, "#f4f1e6", 90, 0.3, 4, 80);
        break;
      case "dash":
        dust(e.x - e.direction * 16, p.y + p.h, -e.direction, 6);
        break;
      case "stomp":
      case "bounce":
        burst(e.x, e.y, 10, "#fff6c4", 150, 0.45);
        break;
      case "drain":
        fx.swirl = { x: e.x, y: e.y, age: 0 };
        burst(e.x, e.y, 14, "#7fd04b", 170, 0.6);
        break;
      case "absorb":
        fx.chipDeal.green = 1;
        fx.flash = reducedMotion ? 0 : 0.25;
        fx.flashColor = "#9be36a";
        announce("Green absorbed. Green cards can't see you. Press X for green, Z for white.");
        break;
      case "swap":
        burst(p.x + p.w / 2, p.y + p.h / 2, 10, e.color === "green" ? "#7fd04b" : e.color === "red" ? "#ff5a4a" : "#ffffff", 120, 0.35, 4, 100);
        break;
      case "refill":
        fx.refill = 0.14;
        break;
      case "sticker":
        burst(e.x, e.y, 12, "#ffd84a", 140, 0.5, 4, 200);
        announce(`Sticker ${e.count} of 9.`);
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
        fx.reverse = 0;
        fx.flash = reducedMotion ? 0 : 0.5;
        fx.flashColor = "#ff3b30";
        cam.shake = reducedMotion ? 0 : 6;
        fx.chipDeal.red = 1;
        burst(e.x, e.y, 26, "#ff4b3a", 260, 0.8, 5, 300);
        announce("Red stolen! REVERSE: run home. Red dash smashes cracked stones and knocks cards aside.");
        break;
      case "die":
        fx.death = { ...game.deathAt, age: 0 };
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
        announce("Home! You got your red back!");
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
  fx.locked = Math.max(0, fx.locked - dt);
  fx.stageTitle = Math.max(0, fx.stageTitle - dt);
  if (fx.reverse >= 0) fx.reverse += dt;
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
  // The forest regains color as Rubik does (Gris): green, theft, the road home.
  const p = game.player,
    homeward = game.stolen ? 1 - Math.max(0, Math.min(1, (p.x - L.HOME.x1) / (L.VAULT.cx - L.HOME.x1))) : 0,
    target = game.phase === "won" ? 1 : (game.unlocked.green ? 0.18 : 0) + (game.stolen ? 0.22 + homeward * 0.35 : 0);
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
  if (!game.stolen) {
    const gx = Math.round(W / 2 + (L.VAULT.cx - (cam.x + W / 2)) * 0.075),
      base = by + 236,
      pulse = reducedMotion ? 0.85 : 0.8 + Math.sin(clock * 2) * 0.2;
    if (gx > -90 && gx < W + 90) {
      ctx.save();
      ctx.globalCompositeOperation = "screen";
      // feathered column: horizontal falloff × vertical fade
      for (const [half, alpha] of [
        [44, 0.1],
        [22, 0.16],
        [9, 0.2],
      ]) {
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
    c1 = Math.min(L.COLS - 1, Math.ceil((cam.x + W) / T)),
    top = wy(L.WATER_ROW * T);
  for (let tx = c0; tx <= c1; tx++) {
    if (L.MAP[L.WATER_ROW][tx] !== "~") continue;
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
function drawCheckpoints() {
  L.CHECKPOINTS.forEach((cp, index) => {
    if (cp.auto) return;
    const x = wx(cp.x),
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
/** The vault as the set piece: cofre.png at 4x (an even multiple of the 2x
 * grid) on a dais made of the slab tiles, flanked by two pillar strips from the
 * atlas, under a pulsing red glow. On the theft its door swings open and the
 * red pours out. */
function drawVault() {
  const v = L.VAULT,
    x = wx(v.cx - v.w / 2),
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
    drawSticker(x, y + bob, 20, reducedMotion ? -1 : ((clock * 0.6 + s.id * 0.37) % 1.6) / 0.6);
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
  const asleep = !M.canSee(guard, game.player.color),
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
  ctx.save();
  ctx.translate(x, floor);
  // Sheets face left; a right-facing card mirrors around its body centre.
  if (guard.dir > 0) ctx.scale(-1, 1);
  if (guard.state === "stunned" || guard.state === "drained") {
    ctx.translate(0, -6);
    ctx.rotate(guard.state === "drained" ? 0.22 : -0.18);
  }
  if (guard.state === "asleep") ctx.translate(0, 4);
  ctx.drawImage(image, col * sheet.cw, row * sheet.ch, sheet.cw, sheet.ch, -sheet.cx * 2, -sheet.feet * 2, dw, dh);
  ctx.restore();
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
  if (guard.state === "asleep") {
    for (let i = 0; i < 3; i++) {
      const t = (clock * 0.6 + i / 3) % 1;
      text("z", x + guard.dir * -10 + t * 18 * -guard.dir, head - t * 34, 16 + i * 8, "#fbf9f2", "center", "#1b1420");
    }
  } else if (["suspect", "search"].includes(guard.state)) bubble(x, head + bob, "?", { fill: "#ffe3b0" });
  else if (["alert", "windup", "lunge", "recover"].includes(guard.state)) bubble(x, head + bob, "!", { fill: "#ffb3a6" });
  else if (guard.state === "stunned") {
    for (let i = 0; i < 3; i++) {
      const a = clock * 4 + (i * Math.PI * 2) / 3;
      drawStar(x + Math.cos(a) * 18, head + 6 + Math.sin(a) * 5);
    }
  } else if (guard.state === "calm" && guard.disguiseSeen) {
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
function drawRubik(sheetKey, sx, sy, cx, feet, direction, alpha = 1, rotation = 0) {
  const image = sheetKey === "storm" ? img.storm : sheetKey.length > 5 ? derived[sheetKey] : img[sheetKey];
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(Math.round(cx), Math.round(feet));
  if (rotation) ctx.rotate(rotation);
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
    return;
  }
  const p = game.player,
    [sheet, sx, sy] = playerFrame(p),
    cx = wx(p.x + p.w / 2),
    feet = wy(p.y + p.h);
  if (p.dashTime > 0 && !reducedMotion)
    for (let i = 3; i > 0; i--) drawRubik(sheet, sx, sy, cx - p.dashDirection * i * 22, feet, p.direction, 0.12 * (4 - i));
  // Grace blinks (steady half-alpha under reduced motion: a cue, not a flash).
  const graced = p.grace > 0 || p.bumpGrace > 0,
    blink = graced && (reducedMotion || Math.floor(clock * 14) % 2 === 0);
  // Dash state lives on Rubik (Celeste's hair): spent charge dims him.
  let key = sheet;
  if (sheet !== "storm") {
    if (fx.refill > 0) key = p.color + "Flash";
    else if (p.dashCharge <= 0 && !p.grounded && p.dashTime <= 0) key = p.color + "Dim";
  }
  drawRubik(key, sx, sy, cx, feet, p.direction, blink ? (reducedMotion ? 0.65 : 0.45) : 1);
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
/** The four contextual bubbles. Each shows device-matched glyphs only:
 * keycaps on a keyboard, the on-screen button's look on touch. */
const HINTS = {
  move: { keys: ["<", ">"], touch: ["<", ">"] },
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
  ctx.restore();
}
function drawHud() {
  const p = game.player,
    forms = ["white", "green", "red"].filter((c) => game.unlocked[c]);
  // Form cards: the current form in front, unlocked others fanned behind.
  const others = forms.filter((c) => c !== p.color);
  const shake = fx.locked > 0 && !reducedMotion ? Math.sin(fx.locked * 60) * 3 : 0;
  others.forEach((color, i) => {
    const deal = fx.chipDeal[color] || 0;
    formCard(color, 46 + i * 26 + shake + deal * 60, 18 - deal * 40, 34, 48, keyFor(color), 0.16 + i * 0.12, 0.88 - deal);
  });
  const deal = fx.chipDeal[p.color] || 0;
  formCard(p.color, 16 + shake, 14 - deal * 30, 40, 56, keyFor(p.color), -0.05, 1);
  // Sticker face: Rubik's own yellow face, 3x3, top right under the buttons.
  const fx0 = W - 16 - 58,
    fy0 = 54;
  ctx.fillStyle = "#1b1420";
  roundRect(fx0 - 2, fy0 - 2, 62, 62, 8);
  ctx.fill();
  ctx.fillStyle = "#2b2230";
  roundRect(fx0, fy0, 58, 58, 7);
  ctx.fill();
  for (const s of game.stickers) {
    const i = s.id - 1,
      cx = fx0 + 4 + (i % 3) * 17,
      cy = fy0 + 4 + Math.floor(i / 3) * 17;
    ctx.fillStyle = s.collected ? "#ffcf2e" : "#463b4a";
    roundRect(cx, cy, 16, 16, 3);
    ctx.fill();
    if (s.collected) {
      ctx.fillStyle = "#fff4c2";
      ctx.fillRect(cx + 2, cy + 2, 5, 3);
    }
  }
  let below = fy0 + 82;
  // Escape pressure without a fail timer: the "Quick getaway" par counts
  // down under the sticker face. At zero it just greys out; nothing fails.
  if (game.stolen && game.theftTime !== null) {
    const left = Math.max(0, M.MEDAL_PAR_ESCAPE - ((game.finishTime ?? game.time) - game.theftTime)),
      on = left > 0,
      cx = W - 16 - 58 + 14,
      cy = below - 6;
    ctx.fillStyle = on ? "#fbf9f2" : "#6a5f70";
    ctx.beginPath();
    ctx.arc(cx, cy, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#1b1420";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx, cy - 7);
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + 5, cy + 2);
    ctx.stroke();
    text(String(Math.ceil(left)), W - 16, below + 4, 32, on ? (left < 8 ? "#ffcf2e" : "#fbf9f2") : "#6a5f70", "right");
    below += 30;
  }
  if (settings.timer) text(fmtTime(game.time), W - 16, below + 4, 32, "#fbf9f2", "right");
  // During the getaway, a small home arrow at the left edge until home is on
  // screen (the chalk cube face is the home marker).
  if (game.stolen && game.phase !== "won" && L.HOME.x1 < cam.x) {
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
}
const keyFor = (color) => (inputMode === "touch" ? null : { white: "Z", green: "X", red: "C" }[color]);
function drawStageTitle() {
  if (fx.stageTitle <= 0) return;
  const a = Math.min(1, fx.stageTitle / 0.6);
  ctx.globalAlpha = a;
  text("Green forest", W / 2, 150, 64, "#ffffff", "center", "#000000");
  ctx.globalAlpha = 1;
}
/** Uno REVERSE card sweeping across: the theft's turning point. */
function drawReverse() {
  if (fx.reverse < 0) return;
  const t = fx.reverse / 1.1,
    x = reducedMotion ? W / 2 : W + 160 - (W + 320) * Math.min(1, t * 1.15),
    y = H / 2;
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
  // The goal, stated once: run home; red dash breaks the cracked stones.
  if (fx.reverse > 0.35) {
    const a = Math.min(1, (fx.reverse - 0.35) * 5, (2.6 - fx.reverse) * 3);
    ctx.globalAlpha = Math.max(0, a);
    text("Run home!", W / 2, 128, 48, "#ffffff", "center", "#000000");
    const touch = inputMode === "touch",
      rowW = touch ? 300 : 320,
      rx = W / 2 - rowW / 2;
    ctx.fillStyle = "rgba(27,20,32,0.8)";
    roundRect(rx - 10, 140, rowW + 20, 52, 12);
    ctx.fill();
    formCard("red", rx, 144, 30, 42, null);
    text("+", rx + 46, 176, 32, "#fbf9f2", "center", null);
    const kw = touch ? dashPill(rx + 60, 182) : bigKey("Shift", rx + 60, 182);
    text("breaks stones", rx + 72 + kw, 176, 32, "#fbf9f2", "left", null);
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
  drawCheckpoints();
  drawVault();
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
  // On touch screens "press any key" is wrong: a pill over that line says tap.
  if (inputMode === "touch") {
    ctx.fillStyle = "rgba(18,26,48,0.92)";
    roundRect(W / 2 - 290, 354, 580, 48, 14);
    ctx.fill();
    text("Tap to start", W / 2, 388, 48, "#ffffff", "center", "#000000");
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
  if (t >= close) enterPlay(true);
}
function drawEnding() {
  ctx.drawImage(img.ending, 0, 0, W, H);
  drawIris(Math.max(0, 1 - screenTime / 0.8));
}
function drawResults() {
  // Colorized forest behind a dim card panel.
  ctx.drawImage(derived.forestColor, 0, 0, W, H);
  ctx.fillStyle = "rgba(14,10,20,0.55)";
  ctx.fillRect(0, 0, W, H);
  const px = 150,
    py = 44,
    pw = 660,
    ph = 392;
  ctx.fillStyle = "rgba(0,0,0,0.5)";
  roundRect(px + 6, py + 8, pw, ph, 22);
  ctx.fill();
  ctx.fillStyle = "#fbf9f2";
  roundRect(px, py, pw, ph, 22);
  ctx.fill();
  ctx.fillStyle = "#2b1f2e";
  roundRect(px + 8, py + 8, pw - 16, ph - 16, 16);
  ctx.fill();
  text("Color Theft Story: Color Rush Heist", W / 2, py + 30, 16, "#cfc6d6", "center", null);
  text("You got your red back!", W / 2, py + 70, 48, "#ffffff", "center", "#000");
  // Red Rubik idles beside the numbers, on a little chalk home face.
  ctx.fillStyle = "#3d3042";
  roundRect(px + 70, py + 210, 100, 14, 7);
  ctx.fill();
  drawRubik("red", (Math.floor(clock * 4) % 2) * 32, 0, px + 120, py + 216, 1, 1);
  const g = game,
    rows = [
      ["Time", fmtTime(g.finishTime ?? g.time)],
      ["Getaway", fmtTime(g.escapeTime ?? 0)],
      ["Spotted", String(g.spotted)],
    ];
  rows.forEach(([k, v], i) => {
    text(k, px + 230, py + 136 + i * 38, 32, "#cfc6d6", "left", null);
    text(v, px + 440, py + 136 + i * 38, 32, "#ffffff", "right", null);
  });
  // Sticker face, big.
  const fx0 = px + 490,
    fy0 = py + 108;
  ctx.fillStyle = "#1b1420";
  roundRect(fx0 - 4, fy0 - 4, 118, 118, 12);
  ctx.fill();
  for (const s of g.stickers) {
    const i = s.id - 1;
    ctx.fillStyle = s.collected ? "#ffcf2e" : "#463b4a";
    roundRect(fx0 + 4 + (i % 3) * 36, fy0 + 4 + Math.floor(i / 3) * 36, 32, 32, 5);
    ctx.fill();
  }
  text(`${M.stickerCount(g)}/9`, fx0 + 55, fy0 + 146, 32, "#ffcf2e", "center", null);
  // Three medal cards flip in one by one.
  const medals = [
    ["Full face", g.medals?.fullFace, "all 9 stickers"],
    ["Never spotted", g.medals?.neverSpotted, 'never a "!"'],
    ["Quick getaway", g.medals?.quickGetaway, `home in ${M.MEDAL_PAR_ESCAPE} s`],
  ];
  medals.forEach(([name, got, how], i) => {
    const appear = Math.max(0, Math.min(1, (screenTime - 0.4 - i * 0.35) / 0.3)),
      cx = px + 128 + i * 202,
      cy = py + 316,
      flip = reducedMotion ? 1 : Math.abs(Math.cos((1 - appear) * Math.PI * 0.5));
    if (appear <= 0) return;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(Math.max(0.05, flip), 1);
    ctx.fillStyle = got ? "#fbf9f2" : "#4a3f4e";
    roundRect(-94, -40, 188, 84, 10);
    ctx.fill();
    ctx.fillStyle = got ? COLORS.red : "#2b2230";
    roundRect(-88, -34, 176, 72, 6);
    ctx.fill();
    ctx.restore();
    if (flip > 0.6) {
      text(name, cx, cy - 6, 32, got ? "#ffffff" : "#9a8fa0", "center", got ? "#5a0e0a" : null);
      text(got ? "earned!" : how, cx, cy + 26, 32, got ? "#ffe066" : "#9a8fa0", "center", got ? "#5a0e0a" : null);
    }
  });
}
function fmtTime(t) {
  return `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, "0")}.${Math.floor((t % 1) * 10)}`;
}

// ------------------------------------------------------------------- loop --
function stepPlay(dt) {
  if (manual) return;
  accumulator += dt;
  while (accumulator >= M.TICK) {
    M.update(game, M.TICK, getInput());
    clearPulses();
    accumulator -= M.TICK;
  }
}
function frame(now) {
  const dt = Math.min(0.1, (now - lastFrame) / 1000);
  lastFrame = now;
  clock += dt;
  screenTime += dt;
  if (screen === "play") {
    stepPlay(dt);
    handleEvents();
    if (game.respawns !== lastRespawns) {
      lastRespawns = game.respawns;
      snapCamera();
    }
    updateFx(dt);
    updateCamera(dt);
    if (game.phase === "won") {
      fx.clear += dt;
      if (fx.clear > 1.6 && fx.irisDir === 0 && fx.iris === 0) fx.irisDir = 1;
      if (fx.clear > 2.5) {
        setScreen("results");
        play("win");
      }
    }
  }
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
  drawWorld();
  drawHud();
  drawStageTitle();
  drawReverse();
  drawFlash();
  // The win iris closes on Rubik himself; the opening iris is screen-centred.
  if (game.phase === "won") drawIris(fx.iris, wx(game.player.x + M.PLAYER.w / 2), wy(game.player.y + M.PLAYER.h / 2));
  else drawIris(fx.iris);
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
    camera: { x: cam.x, y: cam.y },
    settings: { ...settings },
    audio: { musicDecoded: !!track.buffer, musicPlaying: !!track.source, musicRate: track.rate, context: audio?.state ?? "none" },
  };
}
window.__game = {
  getState,
  start: beginFrontEnd,
  skipStory() {
    if (screen === "story") enterPlay(true);
    return getState();
  },
  restart() {
    held.clear();
    clearPulses();
    ui.pauseCard.hidden = true;
    enterPlay(true);
    fx.iris = 0;
    fx.irisDir = 0;
    render();
    return getState();
  },
  setManual(value) {
    manual = Boolean(value);
    accumulator = 0;
  },
  step(seconds, input = {}, options = {}) {
    if (screen !== "play") enterPlay(true);
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
  togglePause,
};

// ------------------------------------------------------------------- boot --
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
