# Build Log

## Phase 0: Project setup
- Built: git repo on `main`, `.gitignore`, `package.json` scripts (`dev`, `build`, `test`, `check`), strict `tsconfig.json`, Vite config with relative base, CONTRIBUTING.md, CLAUDE.md, docs skeleton.
- Verified: `tsc --noEmit` passes, `vitest run --passWithNoTests` passes, `vite build` succeeds.
- Notable: `gh` not installed, so the GitHub remote was skipped (see README for manual commands).

## Phase 1: Scaffold and first playable loop
- Built: Vite + Phaser + strict TS scaffold; core (event bus, registries, stats/modifier pipeline, context, world state, clock, rng, scaling and layout, tick driver); config files; design tokens (16-color palette with day/dusk/night/dawn scene palettes, rarity styles, spacing, motion); procedural placeholder art for every sprite key; Pixelify Sans baked into a crisp bitmap font; UI kit (Button, Panel, ProgressBar, Tooltip, Toast, Icon, RarityBanner, TreeNode, ScrollArea); World scene with dithered parallax sky, hills, water, foreground, stars, sun/moon, fireflies, shooting stars, rain and fog; HUD with currency counter, water name, time and weather icons, feature menu bar, toasts, panel host; fishing feature (cast, wait, bite with ring pulse and "!", reel with leaping fish, catch popup with Sell/Keep, creel panel); style guide scene (`?debug=styleguide`); DOM debug panel; content error screen; docs skeleton and CLAUDE.md.
- Verified: typecheck clean, 25 unit tests pass (event bus, registry, stat pipeline order, scaling, fishing session timing, time of day), production build succeeds. Played the loop in the browser pane at phone size: cast, bite, miss message, hook, popup, sell, coins update, autosave writes.
- Notable: tests run in a single thread because worker start-up is very slow in the sandbox.
