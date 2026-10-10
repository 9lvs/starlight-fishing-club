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
- Gates (typecheck, tests, build) run on a mirror of the project in the session scratchpad with its own `npm install`, because the Desktop folder is iCloud-synced on a 99%-full disk and evicted files block reads inside the sandbox. Each phase commit is exported with `git checkout-index` and gated before committing.
- Journal learns about first catches by annotating `catch.flags.new` in its `catchLanded` listener; the popup reads the flag. No feature imports another.
- Pacing is checked with a goal-directed player model (saves for the next water or crew slot, buys small upgrades under 20% of that goal). A purely greedy "cheapest first" model delayed the first water to 38 min and does not match how people play.
- Tuned: Cork Grip base cost 12 -> 20, River Charts 900 -> 1100, Hire Help 1600 -> 1800 to hit the pacing targets.
- Offline coins are the exact expected value of the simulated rolls (no luck either way); journal counts use largest-remainder rounding so they sum to the roll count. Rounding catches first and pricing them biased short absences upward (one lucky legendary).
- Offline time and the live tick share one path: any wall-clock gap over 5 s triggers catch-up, so closing the tab, a background tab, laptop sleep, and the debug fast-forward behave the same.
- Audio placeholders are soft synthesized pentatonic tones instead of pure silence (`AUDIO.placeholder = 'synth'`, switch to `'silent'` in `src/config/audio.ts`), so the game can be judged by ear before real files exist. Nothing plays before a user gesture.
- Content packs can declare `requires` (feature ids). Feature-dependent content lives in its own pack so removing a feature never breaks boot.
- Daily gift has no streak, so skipping days never costs anything (no-punishment pillar).
- The game fills the whole screen on every device (replaces the touch-only fill and desktop letterbox). Zoom is the largest whole number of device pixels per game pixel that still leaves 180x320 (portrait) or 320x240 (landscape); the internal size is rounded up to an even number, so the canvas overhangs the screen by under two game pixels instead of showing bars. Even sizes avoid a 1 px edge gap from Phaser's pixel rounding.
- On wide screens UI groups stay centered (boat with bobber, Cast with the creel beside it, menu bar slots capped at 40 px, panels capped at 200x340) so nothing drifts to far edges.
- Progression is a journey of five waters with an opt-in fresh start (prestige). The boat tier that reaches the next water makes the move possible; moving resets coins, rods, boats, bait, and crew, and raises a permanent coin bonus set per water (`clubBonus`: +100%, +400%, +900%, +2400%). It never happens by surprise: the map asks twice and lists what starts over (no-punishment pillar). The journal, the daily gift, and the Club branch (cosmetics, `keepOnMove`) are kept.
- Waters the club has reached stay visitable for the journal; the bonus applies everywhere, so the newest water is about new fish and scenery, not a better payout per fish.
- Rods (luck), boats (creel space, quicker bites, reach), and bait (bigger fish that sell for more, a little luck) are chained tier nodes with `requiresRank`, so each water unlocks the next two tiers. The old Gear/Boat/Club tree became Rods, Boats, Bait, Crew, and Club.
- Lures are per-rarity weight boosts (`boost_<rarity>` stats, one per rarity, generated from `rarities.json`). They and bait apply to hand fishing only; crew get their own luck and sale upgrades, so offline math is unchanged. A tier's `maxChance` still caps the final chance.
- Club cosmetics are pure looks with no stats, since they survive every move.
- Costs were tuned with a whole-journey simulation (`tests/helpers/journeySim.ts`) rather than by hand: about 23, 39, 45, and 50 minutes per water, an 88 minute Sky Lake finale, about 4 hours in all for an active player.
- World save slice v2 adds `clubRank`. Older saves keep every water they had reached (rank from `knownUnlocked`), with that water's bonus, and keep their coins.
