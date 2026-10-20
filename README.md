# Starlight Fishing Club

A calm pixel art fishing idle game for the web. Cast from a little boat under a
shifting sky, catch fish of gentle rarities, fill your journal, grow your club
with a visible upgrade tree, and hire a crew who keep fishing while you are away.

- One-tap loop, generous timing, no fail states, nothing to lose.
- 87 fish across six waters, with time-of-day and weather exclusives. Each water has its own buildings, props, and moving scenery, and the boat sails between them.
- Ten rod tiers, ten boat tiers, and six baits; bigger waters unlock the higher tiers.
- Move the club to the next water for a fresh start and a bigger coin bonus, all the way to Sky Lake.
- A Daily Catch: one shared fish a day, and your first five catches make a luck score to share.
- Rarer fish glow in the water and fight back: tap each dip (and hold for a legendary) for a clean
  landing bonus. Rods, boats, and bait add Tackle so fewer slip away. Easy reel makes it one tap.
- Every boat upgrade makes the boat bigger, with bunks for crew who stand on deck beside you.
- Reel in fast for a quick-catch bonus. Wind, storms, rain, fog, and night each bring their own fish.
- Calm composed music that follows the time of day, and a soft sound for every action.
- A goal bar that always shows your next step, a Logbook of tasks for each water, tags on every
  upgrade that say what it helps, and a How to play page in Settings.
- Gentle tips for new players. Keep fish in your creel for bundle and matching set bonuses
  (3, 5, or 10 of a rarity), but sell them while they are fresh.
- Gems: a rare find on any catch, or traded for coins. They buy looks for your boat,
  fisher, and clubhouse that stay when the club moves.
- Every water sounds like itself: birds and frogs at the pond, a stream, gulls and a bell buoy,
  cave drips, wind chimes in the sky, each with its own music key and voice.
- A Feedback button that opens a short form with your device filled in.
- Installable from the browser and playable offline.

Launching it, testing on phones, and finding players: see `docs/LAUNCH.md`.
- 10-minute day cycle with dithered palette shifts, rain, fog, fireflies, and shooting stars.
- Crew auto-fishing. While you are away they fill your creel (up to 8 hours, 24 with upgrades).
- Built to grow: content is JSON, systems are plug-in features (see `CLAUDE.md` and `docs/`).

## Run

Needs Node 20 or newer.

```bash
npm install
npm run dev
```

Open the "Local" URL. Controls: tap or click anywhere on the water (or press Space or
Enter) to cast and to reel in; `K` keeps a catch; `M` toggles sound; `Esc` closes panels.

**On your phone:** keep the phone on the same Wi-Fi as your computer, run `npm run dev`,
and open the "Network" URL that Vite prints (for example `http://192.168.1.20:5173`).
Allow Node through the macOS firewall if asked. Add it to the home screen for full screen.

URL flags: `?debug=1` shows the debug panel (always available in dev builds);
`?debug=styleguide` opens the style guide with every color, component, and sprite.

## Test and build

```bash
npm test            # unit tests
npm run typecheck   # TypeScript
npm run build       # production build into dist/
npm run check       # all three; run before every commit on main
npm run preview     # serve the production build locally
```

## Deploy

The build is fully static with relative paths, so `dist/` works from any folder.

### GitHub Pages

Live at **https://starlight-fishing-club.sofcb2004.workers.dev/** (Cloudflare; the GitHub Pages copy at https://9lvs.github.io/starlight-fishing-club/ also updates). Every push to `main` runs
`.github/workflows/deploy.yml` (install, `npm run check`, publish `dist/`). One-time setup,
already done: Settings > Pages > Build and deployment > Source: **GitHub Actions**.

### itch.io

```bash
npm run package:itch
```

This builds and writes `starlight-fishing-club-itch.zip` (with `index.html` at the root).
On itch.io: Create new project > Kind of project: **HTML** > upload the zip > tick
"This file will be played in the browser". Suggested embed: 360 x 640, enable
"Mobile friendly" (portrait) and "Fullscreen button".

## Project map

- `CLAUDE.md`: start here (vision, rules, folder map, how to add things).
- `docs/ARCHITECTURE.md`: how the systems fit together.
- `docs/ADDING_CONTENT.md`: recipes for fish, waters, upgrades, crew, weather, rarities, packs, sprites, sounds.
- `docs/ADDING_FEATURES.md`: the feature recipe with the daily gift as a worked example.
- `docs/SPRITES.md`: every sprite with sizes and frame counts, for commissioning art.
- `docs/TUNING.md`: where every balance number lives.
- `docs/ROADMAP.md`: ideas the architecture is ready for.
- `docs/DECISIONS.md` and `docs/BUILD_LOG.md`: why things are the way they are, and what was verified.

## Credits and licenses

- Font: Pixelify Sans by the Pixelify Sans Project Authors, SIL Open Font License 1.1
  (`public/fonts/OFL.txt`).
- Engine: Phaser 3 (MIT). Validation: zod (MIT). Tooling: Vite, Vitest, TypeScript.
- All art and sounds are procedural placeholders generated in code.
