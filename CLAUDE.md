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
- Internal resolution 180x320 portrait (`src/config/display.ts`), integer scaling,
  pixel art rendering. On touch devices the canvas grows on the free axis to fill
  the screen; on desktop it is letterboxed.
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
  scenes/     Boot, World, Hud, StyleGuide, Error (core scenes only)
  ui/         reusable components: Button, Panel, ProgressBar, Tooltip, Toast, Icon, TreeNode, text
  design/     tokens.ts: palette, spacing, typography, rarity styles
  art/        spriteManifest.ts, placeholderGenerator.ts
  debug/      debug panel and core debug commands
docs/         ARCHITECTURE, ADDING_CONTENT, ADDING_FEATURES, SPRITES, TUNING, ROADMAP, DECISIONS, BUILD_LOG
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
- **Water**: add to `waters.json`, give it a `rangeRequired`, and use an existing scene preset.
- **Upgrade**: add to `upgrades.json` with `modifiers: [{ "stat": "luck", "op": "add", "value": 1 }]`.
- **Crew type / weather / rarity / decoration / currency**: add to the matching JSON file.
- **Content pack**: create `src/content/<pack>/pack.json` plus any content files.
- **Feature**: create `src/features/<name>/index.ts` exporting a `GameFeature`, add it to
  `src/features/index.ts`. See `docs/ADDING_FEATURES.md` (worked example: daily gift).
- **Sprite**: drop a PNG in `public/sprites/` and add an `image` entry in `src/art/spriteManifest.ts`.
- **Sound**: drop files in `public/audio/` and set `files` in `src/config/audio.ts`.

## Workflow

- `main` is always playable; features go on `feature/<name>` branches (CONTRIBUTING.md).
- Run `npm run check` before every commit.
- Record decisions in `docs/DECISIONS.md` and progress in `docs/BUILD_LOG.md`.
