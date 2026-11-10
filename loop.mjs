/** Fixed-step clock for the browser loop (pure: no DOM, tested in Node).
 *
 * The simulation always steps in exact 1/120 s ticks. What used to depend on
 * the display was WHEN an input landed: every key event since the last frame
 * was applied on the first tick of the next frame, so at 30 Hz a press could
 * land up to 33 ms (4 ticks) late, and a 100 ms hitch moved it 12 ticks. Coyote
 * time, the jump buffer and every timed jump then shifted with the frame rate.
 *
 * Here each input change carries its event timestamp (event.timeStamp, the
 * performance.now() timebase) and is applied before the first tick whose end
 * is at or after that time. A key script therefore produces the same tick
 * inputs - and so the same bit-identical trace - at 30, 60, 120 or 240 Hz and
 * through frame hitches (tests/movement-audit.test.mjs, A2).
 *
 * The clock never runs ahead of the frame's time (a tick runs once its end is
 * reached, like the old accumulator), so no event can arrive for a tick that
 * already ran: the mapping is exact. A change lands on its own tick, which
 * runs in the first frame at or after that tick's end - at 60 Hz (or 30 Hz)
 * frames fall on tick boundaries, so a press always shows on the next
 * rendered frame. */
export const TICK_MS = 1000 / 120;

export class FixedStep {
  /** @param maxLag ms of simulation a single frame may catch up. Longer gaps
   *  (a background tab, a debugger stop) drop the excess instead of fast-
   *  forwarding; 250 ms keeps every 0-100 ms hitch exact. */
  constructor({ tick = TICK_MS, maxLag = 250 } = {}) {
    this.tick = tick;
    this.maxLag = maxLag;
    // The moment the simulation state corresponds to is origin + steps * tick:
    // an integer count (not a running float sum) so tick boundaries land on
    // the same values whatever the frame rate.
    this.origin = null;
    this.steps = 0;
    this.queue = [];
  }
  get time() {
    return this.origin === null ? null : this.origin + this.steps * this.tick;
  }
  rebase(time) {
    this.origin = time;
    this.steps = 0;
  }
  /** Queue an input change stamped with its event time (ms). */
  push(time, change) {
    // Events arrive in order; a stamp from before the clock (a key pressed
    // during a hold) simply applies on the next tick.
    this.queue.push({ time: Number.isFinite(time) ? time : this.time ?? 0, change });
  }
  /** The world is held (paused, the level card, a QA step): the clock follows
   * the frame without stepping, so resuming never fast-forwards. Queued
   * changes stay queued and apply on the first tick after the hold. */
  hold(now) {
    this.rebase(now);
  }
  clear() {
    this.queue.length = 0;
  }
  /** Run every tick that ends by `now`. Before each tick, `apply` gets every
   * queued change stamped up to that tick's end, in order; then `step` runs
   * the tick. Returns the number of ticks run. */
  run(now, apply, step) {
    if (this.origin === null) this.rebase(now);
    if (now - this.time > this.maxLag) this.rebase(now - this.maxLag);
    let n = 0;
    // 1e-6 ms of slack: a frame time equal to a tick boundary (up to float
    // rounding) reaches it, so 60 Hz stays a steady 2 ticks a frame.
    for (;;) {
      const end = this.origin + (this.steps + 1) * this.tick;
      if (end > now + 1e-6) break;
      while (this.queue.length && this.queue[0].time <= end) apply(this.queue.shift().change);
      step();
      this.steps++;
      n++;
    }
    return n;
  }
}
