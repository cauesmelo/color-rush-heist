# Changelog

Player-facing changes in Color Rush Heist. Versions follow `package.json`; the title screen shows the release as `v1.0`.

## [Unreleased]

### Combat

- **Three hearts.** A spear strike, a card's body and a fall into water each cost one. A hit freezes the world for a beat, knocks Rubik back and makes him blink for 1.5 seconds. A new checkpoint refills every heart; losing the last one sends you back to the checkpoint as before.
- **Water is cheaper:** a fall costs a heart and hops Rubik back onto the last safe ground. The third fall is a real death.
- **Cards fight:** every card chases (walkers), holds its post (sentinels) or charges (the red enforcer). Each attack has a clear wind-up with the swept ground drawn on the floor, a short strike, and an open recovery. A card that cannot reach you gives up instead of staring.
- **The head stomp works from any side** and defeats a card with a poof. The armoured red card is dazed first (a visible ring) and needs a second stomp or a red dash. Gate cards that are the way over a wall flatten and stay as springboards.
- **Stomp chains:** each chained stomp bounces a little higher and sounds a little higher; the third pays a heart. 1-2 has a new Chain stamp for the island chain.

## [1.0.0] - 2026-11-10

The first release of Color Rush Heist, a browser remake of the jam game *Color Theft Story* (minigamejam 22, by Vitor Farias and @cauesmelo). Every picture is Vitor Farias's original art.

### Compared with the original jam game

- **World 1, "Green Forest": six short levels** (1-1 Home Cliff to 1-6 The Vault), grown from the jam's green level. Each level teaches one idea and then twists it: the double jump, the head stomp, hiding in green, the storm dash, reading lookouts, and finally the vault. The jam's blue level waits in the art archive for World 2.
- **A world map** with linear unlocks, level cards, GET moments when Rubik gains green, the dash and red, a world-clear ending, and "World 2: Blue Mountains, coming soon".
- **The heist:** steal your red back in the vault, then run the same forest home in REVERSE, smashing sealed stones with red's dash.
- **Every card guard is awake** and has a job. Cards can't see their own colour. They ask "?" before they shout "!", raise their spear when you come at them from the front, and can be stomped from above or behind. In 1-3 a card's "!" sends you back to the checkpoint.
- **Crisp movement:** variable jump height, coyote time and a jump buffer, corner correction, a ledge assist, a dash once per jump with refills, and dash-jumps. Inputs are applied on the exact tick they happen, so the game plays the same at any frame rate.
- **Collectables:** three stickers per level (18 in all), plus the Ghost (never spotted), Takedown (every card down) and Quick (beat 1-6's par) stamps, and three world medals.
- **Checkpoints** about every 12 seconds of play, and a respawn that never drops you into a cone.
- **Original music, on by default.** It starts on your first key or tap, and pausing silences everything.
- **Touch controls** on screen: move pads, JUMP, DASH and the form cards.

### New in 1.0

- **Options** in the pause menu:
  - **Slow spotting** (an assist, off by default): cards take twice as long to spot Rubik. Clears, stickers and unlocks still count, but a run with it on earns no stamps.
  - **Less motion:** no screen shake, flashes, particles or squash. It follows your system's reduced-motion setting until you choose.
  - **Timer.**
- **Colour badges:** white, green and red always carry a shape as well as a colour (square, triangle and diamond). You see it on Rubik, on every card and on the stones only red can break, so the game reads with any kind of colour vision.
- **Saves:** progress and settings now live in one versioned save. Progress from earlier test builds carries over once, automatically. If your browser blocks storage (some itch.io embeds, private windows), the game still plays and keeps your progress for the visit.
- **`v1.0` on the title screen**, and fuller Credits in the pause menu.
- **A smaller download:** the itch.io build carries only the game, its art, this changelog, the README and the licence.

### Known limits

- World 2, "Blue Mountains", is not built yet.
- Keys can't be remapped. Arrows and WASD both work, and every binding is listed under Pause → Controls.
- Touch play has not yet been tested on a physical phone, so the itch.io page does not yet mark the game as mobile-friendly.
