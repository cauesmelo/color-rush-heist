# Changelog

Player-facing changes in Color Rush Heist. Versions follow `package.json`; the title screen shows the release as `v1.0`.

## [Unreleased]

### Ending and credits

- **The game now has an end.** After the vault level's world clear, Continue plays three closing comic pages in the original's voice: *Rubik ran all the way home with his red*, then *...and the colors came back, one tree at a time* (a wave of colour spreads out from Rubik until the whole title picture, logo and all, is back: the comic's first beat in reverse), then *Once again, Rubik shone with all his colors* with THE END and the original game's own "Thanks for playing!" line.
- **Credits.** Six cards, one at a time, over the finished forest while white, green and red Rubik walk home along the bottom. They credit the original game's makers, the pixel art, the music (the original game's track), the browser-made sound effects, the font and this web version, and say nothing the project cannot back up. After the last card, the title.
- **The title has a Credits button** (bottom centre; the same button and focus frame as the menus). It plays the same six cards.
- **Calm and skippable.** Every page times itself out (the ending takes 13 seconds, the credits 26). Any fresh key or click moves on after a short 0.6 s lockout; a key you are holding never skips a page; Esc skips the rest. The music keeps playing underneath. Reduced motion cuts instead of waving.
- **No "coming soon".** The world clear and the ending no longer announce World 2 (Blue Mountains is not built): the story ends here. The world clear's backdrop now shows the forest as it was before the vault, so the colour the ending brings back is a real change.
- The pause menu's credit line says "music: the original game's track" (it said "the original jam track"; the original repository does not say so).

### Levels

- **1-2 Stomping Ground is rebuilt.** It starts with a sentinel on its post to learn the strike and the head stomp on; then a dry dip ends at a 7-tile wall with a walker patrolling right up to its foot: stomping it is the way up (an air jump at the bounce's peak), and the flat card stays a springboard at the foot. The four-island chain over the first water and the green card are as before.
- **1-4 Storm Dash:** the dash swirl now floats on the path (it used to rest on a stump you could hop over), the 12- and 14-tile gaps have a recovery rock at the far side, and the 20-tile orb gap has a second orb and a rock at the bank's foot.
- **1-6 The Vault:** the ledge runs 3 tiles further so the first water is 7 tiles, a stepping rock sits under the orb crossing, and the island card on the way home is gone. A card you stomped on the way in now stays down after the theft.

### Pixel UI

- **The red beacon is gone.** The distant red light pillar behind the forest (in play and on the world map) was removed at the owner's request. The `beacon` keys in the level files are now unused.

- **Every menu is pixel art now.** The HUD, hearts, chain meter, hint and awareness bubbles, popups, level and GET and REVERSE cards, results and world-clear tallies, stamps, sticker sockets, world map, pause and options panels, buttons, toggles, keys, icons, the title's tap plate, the ending and the transitions are drawn on the same 2x pixel grid as the art, in 22 colours that all come from the art files. No rounded corners, soft shadows, gradients, translucency, rotation or system-font glyphs remain in the interface.
- **Fades are dithers.** The screen dim behind a card, the forest regaining colour (on the map and in play), the comic's drain to grey, the hit flash, the vault's glow and the beacon are ordered dithers of palette pixels. The iris is a pixel-stepped zoom of the Rubik-face cut-out.
- **Text is bitmap text** at two sizes on the grid (body and heading). The 16 px and 48 px sizes are gone.
- **Keyboard focus is a pixel frame** (lemon over ink) on every control.
- **Crisper scaling:** the game is shown at a whole number of device pixels per canvas pixel (on a 2x display, 960 CSS px), and the page's lengths are whole art pixels.
- The stamps are pixel seals with their own icons (ghost, stomp, clock, chain): filled when earned, hollow when not. Heart, sticker, badge and form-card art were redrawn on the grid; the form glyphs (square, triangle, diamond) are unchanged.
- The art archive page wears the same style.
- Gameplay, levels and every number are unchanged. See `UI_STYLE.md`.

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
