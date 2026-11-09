# Color Rush Heist itch.io build

This project exports independently. Run `npm run build:itch` here, then upload `dist/color-rush-heist-itch.zip` as an HTML Game on its own itch.io page. There is no shared launcher or server runtime in the ZIP.

The entry is root `index.html`. All art, audio, scripts and renderer dependencies are local. The exporter normalizes runtime module extensions to `.js`, preserves asset bytes, and writes the unpacked site to `dist/itch/` plus a hash/size report to `dist/build-report.json`.

Standalone index.html is a plain green page with only the actual game centered. The same game fills its iframe, with its HUD, pause card and touch pads inside the game surface; no surrounding website or shared launcher is included. Music is on by default but the 7 MB track is requested only after the player's first key or tap; it is downloaded once and played through Web Audio, so no media request stays open (and none is cancelled when the player opens the art archive). The setting is remembered.

Use Click to Play, a 960×540 embed (the game is exactly 2× the original 480×270) and fullscreen support. Taller frames letterbox the same 960×540 canvas on the green page. Embedded mode is detected automatically; `index.html?embed=1` lets you inspect it directly. Test the uploaded draft preview before publishing. Do not enable Mobile Friendly solely on the basis of desktop touch emulation.

The runtime has no CDN, account, API key, backend, Node process or cross-origin isolation requirement. Start/audio input is user-initiated.

The package excludes local development servers, tests, Node dependencies and build tools. Keep those development files outside the upload. Rebuild the ZIP after edits; editing source does not update a previously generated/uploaded archive.

The full workspace contains detailed deployment rationale in `../common/docs/ITCH_IO.md`, validation evidence in `../common/docs/VALIDATION.md`, and shared continuity in `../common/SHARED_MEMORY.md`. These documents are optional when copying this project elsewhere. Official upload reference: https://itch.io/docs/creators/html5
