# Build Log

## Phase 0: Project setup
- Built: git repo on `main`, `.gitignore`, `package.json` scripts (`dev`, `build`, `test`, `check`), strict `tsconfig.json`, Vite config with relative base, CONTRIBUTING.md, CLAUDE.md, docs skeleton.
- Verified: `tsc --noEmit` passes, `vitest run --passWithNoTests` passes, `vite build` succeeds.
- Notable: `gh` not installed, so the GitHub remote was skipped (see README for manual commands).

## Phase 1: Scaffold and first playable loop
- Built: Vite + Phaser + strict TS scaffold; core (event bus, registries, stats/modifier pipeline, context, world state, clock, rng, scaling and layout, tick driver); config files; design tokens (16-color palette with day/dusk/night/dawn scene palettes, rarity styles, spacing, motion); procedural placeholder art for every sprite key; Pixelify Sans baked into a crisp bitmap font; UI kit (Button, Panel, ProgressBar, Tooltip, Toast, Icon, RarityBanner, TreeNode, ScrollArea); World scene with dithered parallax sky, hills, water, foreground, stars, sun/moon, fireflies, shooting stars, rain and fog; HUD with currency counter, water name, time and weather icons, feature menu bar, toasts, panel host; fishing feature (cast, wait, bite with ring pulse and "!", reel with leaping fish, catch popup with Sell/Keep, creel panel); style guide scene (`?debug=styleguide`); DOM debug panel; content error screen; docs skeleton and CLAUDE.md.
- Verified: typecheck clean, 25 unit tests pass (event bus, registry, stat pipeline order, scaling, fishing session timing, time of day), production build succeeds. Played the loop in the browser pane at phone size: cast, bite, miss message, hook, popup, sell, coins update, autosave writes.
- Notable: tests run in a single thread because worker start-up is very slow in the sandbox.

## Phase 2: Content pipeline and loot
- Built: zod schemas for every content type with file/entry/field error messages and cross-file reference checks (unknown rarity, water, stat, effect handler, prerequisite, missing always-available fish per water); content packs with `pack.json`, ordering, disable flag, and explicit `"override": true`; 38 fish across Willow Pond, Whisper River, and Moonlit Cove with time-of-day and weather exclusives; loot table with luck shifting weight out of common (capped so legendary never passes 6%), pity counter (40 rolls), pool filtering and tier fallback; journal feature (silhouette grid, rarity borders and shapes, completion %, detail view with best size, first caught date, count, and where-to-find hints; marks first catches NEW); debug "simulate N casts".
- Verified: 44 tests pass including the seeded 10,000-cast simulation (every tier within 1 percentage point of 60/25/10/4/1), luck cap, pity guarantee and reset, fallback, schema errors naming file/entry/field, duplicate/override rules. Typecheck and build pass on exactly the committed tree.
- Notable: the project folder is on an iCloud-synced Desktop and the disk is 99% full, so macOS evicts files constantly; reads of evicted files hang inside the build sandbox. Gates now run on a mirror copy in the session scratchpad (see DECISIONS).
