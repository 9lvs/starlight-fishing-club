# Decisions

One line per decision, with the reason. Newest at the bottom.

- Project folder is `~/Desktop/starligh-fishing-club` (the existing folder, missing a "t"); kept as-is because work is scoped to the current directory. Package and repo name use `starlight-fishing-club`.
- GitHub CLI (`gh`) is not installed, so no remote was created; manual push commands are in the README.
- Toolchain: Phaser 3.90.0, zod 4, Vite 8, Vitest 5, TypeScript 7 (current stable releases at build time).
- Text uses a bitmap font baked at boot from Pixelify Sans (alpha thresholded at 11px, aligned to the font's 91.5-unit pixel grid), because canvas text anti-aliases and looks blurry at 180x320.
- On touch devices the internal resolution grows on the free axis (up to 1.6x) to fill the phone; desktop keeps a fixed 180x320 letterbox. Layout is anchor based (`core/layout.ts`).
- Drifting parallax layers use two wrapping images instead of Phaser TileSprite, because TileSprite resamples non power-of-two textures and blurs pixels.
- Time-of-day changes dissolve with a 4x4 Bayer dither (16 steps over 8 s) instead of alpha fades, so the palette stays exact.
- The catch popup sells on any tap outside its buttons (one-tap loop); "Keep" stores the fish in the creel (inventory, capped by `storageCap`). Kept fish sell later at current prices.
- Fishing save slice is v2 (creel items with size); v1 (creel as id list) migrates automatically.
- Vitest runs in one thread with `isolate: false` because worker start-up is very slow in the build sandbox; the tests are pure and share no globals.
- Debug panel is plain DOM so it can use real inputs and copyable output; it is only mounted in dev builds or with `?debug=1`.
