# CLAUDE.md: Starlight Fishing Club

Read this first. It gets a new session up to speed.

## Vision

A cozy, soothing pixel art fishing idle game for the web. You fish from a small
boat on gentle water under a shifting sky, catch fish of random rarity, sell
them, and buy upgrades from a visible tree. Hired crew fish for you, even while
the tab is closed.

Pillars: **Soothing** (slow, soft, zero stress), **Easy** (one-tap loop, no
fail states), **Rewarding** (frequent small wins, exciting rare catches),
**Beautiful** (limited palette, parallax, small details), **Expandable**
(content and features plug in without touching the core).

## Stack

- TypeScript (strict), Phaser 3.90, Vite, Vitest, zod. Ask before adding any other dependency.
- Design size 180x320 portrait (`src/config/display.ts`), whole-number device-pixel
  scaling, pixel art rendering. The canvas always fills the whole screen (phone,
  tablet, desktop, either orientation): the zoom keeps at least 180x320 in portrait
  or 320x240 in landscape, and the internal size grows (rounded up to even) to cover the rest.
- Font: Pixelify Sans (SIL OFL 1.1), in `public/fonts/`, baked at boot into a crisp bitmap font.
- Save: localStorage, versioned slices.

## Commands

```bash
npm install          # once
npm run dev          # dev server (also on your LAN; open the "Network" URL on a phone)
npm test             # unit tests (vitest)
npm run typecheck    # tsc --noEmit
npm run build        # production build into dist/
npm run check        # typecheck + tests + build (the gate for every commit on main)
```

URL flags: `?debug=1` debug panel, `?debug=styleguide` style guide scene.
Dev builds always show the debug panel toggle.

## Folder map

```
src/
  core/       bootstrap, eventBus, registry, stats, context, scaling, clock, rng, world state
  config/     display, tuning, balance, stats, time, audio (all tuning numbers)
  content/    content packs: <pack>/*.json (fish, waters, upgrades, crew, weather, rarities, ...)
  features/   index.ts (the ONLY feature registry) + one folder per feature
  systems/    pure logic: lootTable, economy, offlineSim, saveManager, timeOfDay, audioManager
  scenes/     Boot, World, Hud, StyleGuide, PanelScene base (core scenes only)
  ui/         reusable components: Button, Panel, ProgressBar, Tooltip, Toast, Icon, TreeNode, text
  design/     tokens.ts: palette, spacing, typography, rarity styles
  art/        spriteManifest.ts, placeholderGenerator.ts
  debug/      debug panel, core debug commands, content error screen (DOM)
docs/         ARCHITECTURE, ADDING_CONTENT, ADDING_FEATURES, SPRITES, TUNING, ROADMAP, DECISIONS, BUILD_LOG, LAUNCH
tests/        vitest unit tests (pure logic only)
public/       fonts/, sprites/ (real art PNGs), audio/ (real sound files)
```

## Rules (do not break these)

1. **Data-driven content.** Fish, waters, upgrades, crew types, weather, rarities,
   decorations, currencies live in `src/content/<pack>/*.json`. The file name
   prefix (before the first `.`) picks the content type, e.g. `fish.json`,
   `fish.autumn.json`. Dropping in a file adds content.
2. **Schema validation.** Every content file is validated with zod at boot. Bad data
   shows an error screen naming file, entry id, and field.
3. **Features.** Systems beyond the core loop implement `GameFeature`
   (`src/core/feature.ts`) and are registered only in `src/features/index.ts`. The core
   never imports a feature. Removing a feature from the registry must not break the game.
4. **Event bus.** Systems talk through the typed bus (`src/core/events.ts`). Features
   can add events with declaration merging.
5. **Stats and modifiers.** Effects are modifiers on named stats (`src/config/stats.ts`).
   Order: priority ascending, then set, add, mult. Unusual effects use named effect
   handlers registered in `ctx.registries.effects`.
6. **Registries.** Fish, waters, rarities, currencies, weather, upgrades, crew types,
   decorations, effects all have `get / list / register`.
7. **Save slices.** One slice per feature with its own version and migrate function.
   Autosave every 15 s and on tab hide. Export/import string with checksum.
8. **Config.** No magic numbers; tuning lives in `src/config/` or content.
9. **Clean boundaries.** `src/systems` and most of `src/core` never import Phaser and are unit tested.
10. **Sprite manifest.** Sprites are referenced by key via `src/art/spriteManifest.ts`.
    Missing keys get procedural placeholders from the palette.

Also: never punish the player (no fail states, loss, or forced timers). Short
comments that explain *why*. Small files.

## How to add X (short version, full recipes in docs/)

- **Fish**: add an entry to `src/content/base/fish.json` (or a new pack). See `docs/ADDING_CONTENT.md`.
- **Water**: add to `waters.json` with the next `rangeRequired`, a `clubBonus` above the last water's,
  a reach boat for it, and an existing scene preset.
- **Upgrade**: add to `upgrades.json` with `modifiers: [{ "stat": "luck", "op": "add", "value": 1 }]`.
- **Crew type / weather / rarity / decoration / currency**: add to the matching JSON file.
- **Content pack**: create `src/content/<pack>/pack.json` plus any content files. Content that
  needs a feature (e.g. an upgrade on that feature's stat) goes in a pack with `"requires": ["featureId"]`.
- **Feature**: create `src/features/<name>/index.ts` exporting a `GameFeature`, add it to
  `src/features/index.ts`. See `docs/ADDING_FEATURES.md` (worked example: daily gift).
- **Sprite**: drop a PNG in `public/sprites/` and add its key and path to `ART_FILES` in
  `src/art/spriteManifest.ts`. Sizes in `docs/SPRITES.md`.
- **Sound**: drop files in `public/audio/` and set `files` in `src/config/audio.ts`. Music is
  composed live (`MUSIC` in that file); list a file in `MUSIC_FILES` to replace it.
- **Tip**: add to `TIPS` in `src/features/tutorial/tips.ts` and queue it from an event in the
  feature's `index.ts`.

## Workflow

- `main` is always playable; features go on `feature/<name>` branches (CONTRIBUTING.md).
- Run `npm run check` before every commit.
- Record decisions in `docs/DECISIONS.md` and progress in `docs/BUILD_LOG.md`.

## Status

v0.1.0: phases 0 to 9 done (see `docs/BUILD_LOG.md`). Features registered: fishing,
upgrades, journal, crew, map, offline, settings, dailyGift, dailyCatch, tutorial. 109 unit tests.
v0.2.0 adds composed music, a sound for every action, the tutorial, the creel bundle bonus, and
the first-five Daily Catch share. Launch
plan, deploy steps, and marketing notes in `docs/LAUNCH.md`. Five-water journey with
moving the club (prestige), 10 rod and 10 boat tiers, bait and lures (see `docs/DECISIONS.md`). Fills the
whole screen on every device (see the post v0.1.0 entry in `docs/BUILD_LOG.md`).

## Gotchas

- Moving the club resets progress through the `clubMoved` event: each feature resets its own
  slice. A new feature with run progress should listen for it; anything meant to last goes in a
  `keepOnMove` branch or currency.
- `public/sw.js` serves cached files first in production. After shipping a change, a player
  sees it on their second load. Bump `CACHE` in `sw.js` to force old files out.
- Keep the internal game size even: an odd size makes Phaser's pixel rounding leave a
  1 px gap at one edge. `computeViewport` already does this.
- Layout must work from about 180 px wide to 640+ px wide. Read positions from
  `getLayout()` and center groups (menu bar, boat, panels) rather than spreading them.
- Phaser 3 `TileSprite` resamples non power-of-two textures (blurry pixels). Drifting
  layers use two wrapping images instead; only 4x4 dither tiles use TileSprite.
- Use `PixelText` (`src/ui/text.ts`), never `scene.add.text`: canvas text anti-aliases. Text over
  the moving world (HUD, messages) uses `outline: 'ink'` so it reads on any sky.
- Every player action should make a sound: emit a bus event that `core/audioWiring.ts` maps, or
  `audio:play` with a key from `SOUNDS`. Disabled buttons emit `ui:deny` (a soft sound).
- Feature scenes reach their feature through a module-level `set/get` pair in the
  feature's `service.ts`/`controller.ts`; dynamic `import()` in the browser console
  gets a different module instance under Vite, so use `window.sfc` (debug builds) or
  debug commands to poke at state.
- When the Browser pane is hidden, `requestAnimationFrame` stops; step manually with
  `sfc.game.step(performance.now(), 16)` and drive the tick with `sfc.ticker.tick()`.
- This folder sits on an iCloud-synced Desktop. When the disk is nearly full, macOS
  evicts files ("dataless") and sandboxed reads of them hang. `brctl download <file>`
  brings one back; running gates on a copy outside iCloud avoids the problem.
