# Starlight Fishing Club

A calm pixel art fishing idle game for the web. Cast from a little boat under a
shifting sky, catch fish of gentle rarities, fill your journal, grow your club
with a visible upgrade tree, and hire a crew who keep fishing while you are away.

- One-tap loop, generous timing, no fail states, nothing to lose.
- 63 fish across five waters, with time-of-day and weather exclusives.
- Ten rod tiers, ten boat tiers, and six baits; bigger waters unlock the higher tiers.
- Move the club to the next water for a fresh start and a bigger coin bonus, all the way to Sky Lake.
- A Daily Catch: one shared fish a day, with a spoiler-free grid to share.
- Installable from the browser and playable offline.

Launching it, testing on phones, and finding players: see `docs/LAUNCH.md`.
- 10-minute day cycle with dithered palette shifts, rain, fog, fireflies, and shooting stars.
- Crew auto-fishing and offline progress (up to 8 hours, 24 with upgrades).
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

1. Create the repo and push (the GitHub CLI was not installed when this project was set up):

   ```bash
   gh repo create starlight-fishing-club --private --source=. --remote=origin --push --tags
   ```

   Or without `gh`: create an empty private repo named `starlight-fishing-club` on github.com, then

   ```bash
   git remote add origin git@github.com:<your-user>/starlight-fishing-club.git
   git push -u origin main --tags
   ```

2. On GitHub: Settings > Pages > Build and deployment > Source: **GitHub Actions**.
3. Every push to `main` runs `.github/workflows/deploy.yml` (install, `npm run check`, publish `dist/`).
   The game appears at `https://<your-user>.github.io/starlight-fishing-club/`.
   Note: Pages on a private repo needs a paid GitHub plan; otherwise make the repo public
   or use itch.io.

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
