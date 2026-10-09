# Architecture

Starlight Fishing Club is built so content and features can be added for years
without touching the core. Five ideas carry the design: data-driven content,
feature modules, an event bus, a stat/modifier pipeline, and versioned save slices.

## Overview

```
                 src/main.ts  (composition root: the only file that sees core AND features)
                      |
          +-----------+-------------------------------+
          |                                           |
   core/bootstrap.ts                         features/index.ts  (THE feature list)
   builds GameContext                         fishing, journal, upgrades, crew,
          |                                   map, settings, offline, dailyGift
          v                                           |
  +----------------------- GameContext ---------------+------------------+
  | bus (EventBus<GameEvents>)   stats (StatsService)   registries         |
  | wallet (currencies)          save (SaveManager)     world (water/time) |
  | clock (debuggable)           rng                    ui (toast, panels) |
  +-----------------------------------------------------------------------+
          |                                   ^
          v                                   | onTick / onOfflineCatchUp
   core/game.ts (Phaser)                      |
   Boot -> World -> [feature layer scenes] -> Hud -> [feature panel scenes]
                                              |
   systems/ (pure, no Phaser, unit tested): lootTable, economy, offlineSim,
            saveManager, timeOfDay
```

## Boot sequence

1. `main.ts` calls `bootstrap()` with the feature list, the content loader, and storage.
2. Content: every `src/content/<pack>/*.json` is imported with `import.meta.glob`
   and validated with zod (`core/content/schemas.ts`, `parseContent.ts`). Any error
   stops boot and shows a screen naming the file, entry id, and field.
3. Registries are filled from content. Core stats (`config/stats.ts`) are defined.
4. Save slices are registered (core `wallet`, `world`, then one per feature) and the
   save is loaded and migrated.
5. Each feature's `init(ctx)` runs (features may define stats, effect handlers,
   listeners). Then cross references are validated (unknown stats, effect handlers,
   waters, rarities...). Then each feature's `start(ctx)` runs.
6. Phaser starts. `BootScene` loads any real art, generates placeholders for every
   other sprite key, bakes the pixel font, and launches World, feature layers, and Hud.
7. The first tick catches up time since the last save (offline progress).

## Core pieces

| Piece | File | Purpose |
|---|---|---|
| Event bus | `core/eventBus.ts`, `core/events.ts` | Typed pub/sub. Features extend `GameEvents` with declaration merging. A throwing listener never breaks others. |
| Registry | `core/registry.ts` | `register / get / tryGet / list / has` for fish, waters, rarities, currencies, weather, branches, upgrades, crew types, decorations, effect handlers. |
| Stats | `core/stats.ts`, `config/stats.ts` | Named stats with base values. Modifiers (`add`, `mult`, `set`, priority, source) are the only way to change them. |
| Context | `core/context.ts` | What features receive. Scenes call `getContext()`. |
| World | `core/world.ts` | Current water, time of day, weather, active decorations. Emits change events. |
| Catching | `core/catching.ts` | One function turns a loot roll into a `CatchResult`; hand, crew, offline, debug all use it. |
| Layout | `core/layout.ts`, `core/scaling.ts`, `core/viewport.ts` | Integer scaling, safe areas, and named screen positions. |
| Tick | `core/bootstrap.ts` (`TickDriver`) | Calls `onTick(dt)` and detects gaps (closed tab, sleep, debug fast-forward) to run offline catch-up. |

## Feature modules

A feature implements `GameFeature` (`core/feature.ts`):

```ts
interface GameFeature {
  id: string;
  contentTypes?: Record<string, ZodType>;   // extra JSON content types
  init(ctx): void;
  start?(ctx): void;
  onTick?(dtMs, ctx): void;
  onOfflineCatchUp?(elapsedMs, ctx): OfflineReport | void;
  scenes?: { key, scene, kind: 'layer' | 'panel' }[];
  menuEntries?: MenuEntry[];
  saveSlice?: { key, version, defaults, migrate };
  debugCommands?: DebugCommand[];
}
```

Rules: features are listed only in `features/index.ts`; the core never imports a
feature; features never import each other. They cooperate through the bus, stats,
registries, and the world state. Removing a feature from the list removes its
scenes, menu button, debug commands, and save slice handling; its stored save
data is preserved untouched in case it comes back.

## Stats and modifiers

Final value = base, then modifiers sorted by priority (low first), and within a
priority `set`, then `add`, then `mult`. Then clamp to min/max and round integer
stats. Upgrade data describes one level; `add` stacks linearly with level, `mult`
compounds, `set` ignores level. Each source (`upgrade:<id>`, `decor:<id>`,
`debug:...`) is replaced as a group with `stats.setSource()`.

Effects that are not stat changes use named effect handlers
(`ctx.registries.effects`), referenced from data by string, e.g.
`{ "handler": "decoration", "args": { "id": "lanterns" } }`.

## Save file

```
{ version: 1, createdAt, savedAt,
  slices: { wallet: { v: 1, data }, world: { v: 1, data }, fishing: { v: 2, data }, ... } }
```

Each slice has its own version and `migrate(old, fromVersion)`. Missing fields are
filled from defaults, so adding a field rarely needs a migration. The root also
has migrations (v0 flat prototype format to v1 slices). Autosave every 15 s and
on tab hide or close. Export is `SFC1.<base64>.<checksum>`; import validates the
checksum, the root shape, and dry-runs every slice migration before writing, so
a bad code never touches the current save.

## Rendering

- Internal resolution 180x320 (`config/display.ts`), drawn by Phaser at that size and
  upscaled by a whole number of device pixels. On touch devices the internal size
  grows on the free axis so phones are filled edge to edge.
- `WorldScene` draws parallax layers painted from the palette into canvas textures.
  Time-of-day changes dissolve between palettes with a 4x4 Bayer dither, so every
  frame stays on the 16-color palette.
- Text is a bitmap font baked at boot from Pixelify Sans with alpha thresholding,
  aligned to the font's own pixel grid, so it is crisp at 1x.
- Scenes only render and handle input; logic lives in systems and feature controllers.
