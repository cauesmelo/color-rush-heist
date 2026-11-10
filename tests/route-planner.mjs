/** Dev planner that produced tests/routes.mjs (not a test; never shipped).
 *
 * It steps the REAL model tick by tick with high-level commands ("run right
 * until x >= ...", "air-jump at the apex", "wait until the card faces away")
 * and records only the ordinary inputs it pressed. `route()` compresses those
 * ticks into the [seconds, input] format that M.advance replays: pulses (jump,
 * dash, color, jumpReleased) on an entry's first tick, left/right held for the
 * whole entry. Nothing is teleported or edited; a replay of the output from a
 * fresh game reproduces the plan exactly (tests/model.test.mjs checks it).
 *
 * Regenerate after a level edit:  node tests/generate-routes.mjs
 */
import * as M from "../model.mjs";

const HELD = ["left", "right"];
const PULSES = ["jump", "jumpReleased", "dash", "color"];

export class Planner {
  constructor(levelId, options = {}) {
    this.levelId = levelId;
    this.options = options;
    this.g = M.startGame(M.createGame(levelId, options));
    this.ticks = [];
    this.dir = {}; // currently held direction for helper commands
  }
  /** An identical copy, rebuilt by replaying every recorded tick (the model
   * is deterministic, so the copy is exact). */
  fork() {
    const copy = new Planner(this.levelId, this.options);
    for (const input of this.ticks) copy.step(input);
    copy.dir = { ...this.dir };
    return copy;
  }
  /** Try alternative command sequences on forks; apply the first one for
   * which ok(fork) holds. Used where a moving card makes timing matter. */
  choose(options, ok, label = "choose") {
    for (const option of options) {
      const trial = this.fork();
      try {
        option(trial);
        if (!ok(trial)) continue;
      } catch {
        continue;
      }
      option(this);
      return this;
    }
    throw new Error(`${label}: no option worked (x=${this.cx.toFixed(1)}, t=${this.g.time.toFixed(2)})`);
  }
  get p() {
    return this.g.player;
  }
  get cx() {
    return this.p.x + this.p.w / 2;
  }
  get feet() {
    return this.p.y + this.p.h;
  }
  guard(id) {
    return this.g.guards.find((x) => x.id === id);
  }
  /** One tick with the given input (held keys + pulses). */
  step(input = {}) {
    if (this.g.phase === "won") return this;
    M.update(this.g, M.TICK, input);
    this.ticks.push({ ...input });
    return this;
  }
  hold(n, input = this.dir) {
    for (let i = 0; i < n; i++) this.step(input);
    return this;
  }
  wait(seconds, input = this.dir) {
    return this.hold(Math.round(seconds * 120), input);
  }
  /** Step with `input` until pred(planner) is true (checked before each tick). */
  until(pred, input = this.dir, max = 120 * 30, label = "until") {
    let n = 0;
    while (!pred(this)) {
      if (n++ > max) throw new Error(`${label}: timed out at x=${this.cx.toFixed(1)} feet=${this.feet.toFixed(1)} t=${this.g.time.toFixed(2)}`);
      if (this.g.phase === "won") return this;
      this.step(typeof input === "function" ? input(this) : input);
    }
    return this;
  }
  right() {
    this.dir = { right: true };
    return this;
  }
  left() {
    this.dir = { left: true };
    return this;
  }
  stop() {
    this.dir = {};
    return this;
  }
  /** Hold the current direction until the player's centre passes x. */
  to(x) {
    const r = !!this.dir.right;
    return this.until((pl) => (r ? pl.cx >= x : pl.cx <= x), this.dir, 120 * 30, `to(${x})`);
  }
  press(pulses) {
    // A swap inside the 0.15 s cooldown would be refused: wait it out first.
    if (pulses.color) this.until((pl) => pl.g.colorCooldown <= 0 && pl.g.hitstop <= 0, this.dir, 60, "swap cooldown");
    return this.step({ ...this.dir, ...pulses });
  }
  jump() {
    return this.press({ jump: true });
  }
  /** Short hop: press then release on the next tick. */
  hop() {
    this.press({ jump: true });
    return this.press({ jumpReleased: true });
  }
  dash() {
    return this.press({ dash: true });
  }
  color(color) {
    return this.press({ color });
  }
  /** Wait for the jump's apex (vy >= 0), then optionally act. */
  apex() {
    return this.until((pl) => pl.p.vy >= 0 || pl.p.grounded, this.dir, 240, "apex");
  }
  airJump() {
    return this.apex().jump();
  }
  land() {
    this.step();
    return this.until((pl) => pl.p.grounded || pl.g.phase !== "playing", this.dir, 600, "land");
  }
  /** In the air, steer toward x until the next bounce or stomp on a card's
   * head (or landing). A plain controller: hold toward x, let go near it. */
  steerTo(target, tolerance = 6) {
    const before = this.g.bounces + this.g.stomps,
      at = (pl) => (typeof target === "function" ? target(pl) : target);
    this.step(this.dir);
    return this.until(
      (pl) => pl.g.bounces + pl.g.stomps > before || pl.p.grounded || pl.g.phase !== "playing",
      (pl) => (pl.cx < at(pl) - tolerance ? { right: true } : pl.cx > at(pl) + tolerance ? { left: true } : {}),
      600,
      "steerTo",
    );
  }
  /** Steer toward x (or a function of the planner) until grounded. */
  landAt(target, tolerance = 6) {
    const at = (pl) => (typeof target === "function" ? target(pl) : target);
    this.step(this.dir);
    return this.until(
      (pl) => pl.p.grounded || pl.g.phase !== "playing",
      (pl) => (pl.cx < at(pl) - tolerance ? { right: true } : pl.cx > at(pl) + tolerance ? { left: true } : {}),
      600,
      "landAt",
    );
  }
  /** Wait for the end of any hit-stop (GET card, stomp freeze). */
  settle() {
    return this.until((pl) => pl.g.hitstop <= 0, this.dir, 400, "settle");
  }
  check(cond, message) {
    if (!cond) throw new Error(`check failed: ${message} (x=${this.cx.toFixed(1)}, t=${this.g.time.toFixed(2)}, phase=${this.g.phase})`);
    return this;
  }
  summary() {
    const g = this.g;
    return {
      phase: g.phase,
      time: +g.time.toFixed(2),
      deaths: g.deaths,
      spotted: g.spotted,
      stickers: M.stickerCount(g),
      stickerIds: g.stickers.filter((s) => s.collected).map((s) => s.id),
      gets: g.gets,
      escape: g.escapeTime === null ? null : +g.escapeTime.toFixed(2),
    };
  }
  /** Compress recorded ticks into [seconds, input] entries (<10 s each). */
  route() {
    const entries = [];
    let current = null;
    const heldKey = (t) => HELD.filter((k) => t[k]).join("+");
    for (const t of this.ticks) {
      const hasPulse = PULSES.some((k) => t[k] !== undefined && t[k] !== false);
      if (!current || hasPulse || heldKey(t) !== heldKey(current.input) || current.n >= 1000) {
        const input = {};
        for (const k of HELD) if (t[k]) input[k] = true;
        for (const k of PULSES) if (t[k] !== undefined && t[k] !== false) input[k] = t[k];
        current = { n: 0, input };
        entries.push(current);
      }
      current.n++;
    }
    return entries.map(({ n, input }) => [+(n / 120).toFixed(6), input]);
  }
}

/** Replay a route from a fresh game, exactly as tests and the browser do. */
export function replay(levelId, route, options = {}, stop = () => false) {
  const g = M.startGame(M.createGame(levelId, options));
  for (const [seconds, input] of route) {
    M.advance(g, seconds, input);
    if (stop(g)) break;
  }
  return g;
}
