# Adding Content

All content is JSON in `src/content/<pack>/`. Files are picked up automatically
(Vite glob import). The part of the file name before the first `.` is the content
type: `fish.json`, `fish.autumn.json`, and `fish.extra.json` are all fish. Every
entry is validated at boot; mistakes stop the game with a message like:

```
mypack/fish.json > entry "glow_minnow" > field "rarity": unknown rarity "mythic"
```

Ids use lowercase letters, digits, and underscores. Colors are palette names from
`src/design/tokens.ts` (`ink, midnight, dusk, sky, mist, gold, coral, rose, plum,
lavender, teal, moss, sage, slate, bark, sand`).

After adding content, run `npm test` (the content tests validate every pack) and
`npm run dev` to see it.

---

## Add a fish

`src/content/base/fish.json` (or any pack's `fish*.json`):

```json
{
  "id": "sunrise_smelt",
  "name": "Sunrise Smelt",
  "rarity": "uncommon",
  "waters": ["river"],
  "timeOfDay": ["dawn"],
  "weather": [],
  "baseValue": 7,
  "spriteKey": "fish_sunrise_smelt",
  "size": [8, 16],
  "description": "Rises with the sun and glows peach for an hour.",
  "art": { "body": "sand", "accent": "coral", "shape": "slim" }
}
```

- `timeOfDay`: any of `day, dusk, night, dawn` (empty = any time). `weather`: weather ids (empty = any).
- `weight` (optional, default 1) is the relative chance among fish of the same rarity.
- `art` only shapes the placeholder sprite (`slim, round, long, tiny, whale, ray, eel, puffer`).
- The journal, loot table, crew, and offline catch-up pick it up automatically.
- Each playable water must keep at least one fish with no time or weather limits.

## Add a water

`waters.json`:

```json
{
  "id": "lantern_lake",
  "name": "Lantern Lake",
  "description": "Paper lanterns float on the water all year round.",
  "order": 3,
  "rangeRequired": 3,
  "spriteKey": "water_lantern_lake",
  "scene": { "hills": "pines", "foreground": "lilies", "tint": { "night": { "waterTop": "gold" } } }
}
```

- It unlocks when the `boatRange` stat reaches `rangeRequired`. Give it a way to get
  there: an upgrade with `{ "stat": "boatRange", "op": "add", "value": 1 }`.
- `scene.hills`: `rolling, pines, cliffs, none`. `scene.foreground`: `reeds, rocks, lilies, none`.
- `scene.tint` overrides any scene palette color per time of day (see `ScenePalette` in tokens).
- `"comingSoon": true` shows it on the map as a teaser that cannot be visited.
- Add at least one always-available fish with `"waters": ["lantern_lake"]`.

## Add an upgrade

`upgrades.json`:

```json
{
  "id": "tackle_box",
  "branch": "gear",
  "name": "Tackle Box",
  "description": "Neatly sorted hooks. Fish bite a little sooner.",
  "prerequisites": ["cork_grip", { "id": "smooth_reel", "level": 2 }],
  "maxLevel": 3,
  "baseCost": 150,
  "costGrowth": 1.5,
  "icon": "icon_rod",
  "modifiers": [{ "stat": "waitMaxMs", "op": "add", "value": -400 }],
  "effects": []
}
```

- Cost of the next level = `round(baseCost * costGrowth ^ ownedLevel)`; `costGrowth` defaults to 1.15.
- Modifiers describe ONE level: `add` stacks per level, `mult` compounds, `set` ignores level.
- Stats you can use are in `src/config/stats.ts` (plus any a feature defines, like `dailyGiftCoins`).
- `effects` run named handlers for things that are not stats, for example
  `{ "handler": "decoration", "args": { "id": "lanterns" } }` shows a decoration on the boat.
- `position: { "row": 0, "col": 2 }` pins a node in the tree; otherwise it is placed by prerequisite depth.
- `currency` (optional) pays with another registered currency.

## Add a crew type

`crew.json`:

```json
{
  "id": "heron",
  "name": "Hattie the Heron",
  "description": "Patient. Very patient. Catches rare things.",
  "spriteKey": "crew_heron",
  "hireCost": 25000,
  "intervalMult": 1.2,
  "valueMult": 1,
  "luck": 6,
  "order": 3
}
```

Each type can be hired once into a free crew slot (`crewSlots` stat).

## Add a weather type

`weather.json`:

```json
{ "id": "snow", "name": "Snowfall", "icon": "icon_snow", "weight": 1, "visuals": { "rain": 0.3, "fog": 0.3, "clouds": 1, "dim": 0.15 } }
```

`weight` is the chance relative to other weather. Visuals combine existing effects
(rain particles, fog, cloud cover, dimming). Fish can then list `"weather": ["snow"]`.

## Add a rarity tier

`rarities.json`:

```json
{ "id": "mythic", "name": "Mythic", "tier": 5, "weight": 0.2, "baseValue": 2000, "luckShare": 0.05, "maxChance": 0.02,
  "color": "lavender", "frame": "gold", "glow": 4, "pips": 5, "shape": "sun", "sting": "sting_legendary" }
```

- `tier` must be unique; higher is rarer. Luck moves weight out of the lowest tier into
  others in proportion to `luckShare`; `maxChance` caps a tier's final chance.
- `shape` (`circle, diamond, star, crown, sun`) and `pips` keep rarity readable without color.
- Rolled tiers with no valid fish fall back one tier lower.

## Add a decoration

`decorations.json`, then show it with an upgrade effect:

```json
{ "id": "bell", "name": "Brass Bell", "description": "Rings when fish bite.", "spriteKey": "decor_bell", "anchor": "bow", "offset": [0, -2] }
```

Anchors: `mast, bow, stern, water, sky`.

## Add a currency

`currencies.json`:

```json
{ "id": "pearls", "name": "Star Pearls", "icon": "icon_pearl", "color": "lavender", "start": 0, "order": 1, "hidden": true }
```

It appears on the HUD once the player has some (`hidden: true`) or always. Upgrades and
crew can cost it with `"currency": "pearls"`; code grants it with `ctx.wallet.add('pearls', 1)`.

## Add a content pack

Create a folder, for example `src/content/winter/`:

```json
// src/content/winter/pack.json
{ "id": "winter", "name": "Winter Festival", "order": 10, "enabled": true }
```

Add any content files to it (`fish.json`, `waters.json`, ...). Packs load in `order`
(base is -1000). To replace an entry from an earlier pack on purpose, repeat its id
and add `"override": true`. Set `"enabled": false` to switch a pack off.

## Add or replace a sprite

Every key gets a procedural placeholder. To use real art, drop a PNG in
`public/sprites/` and add it to `ART_FILES` in `src/art/spriteManifest.ts`:

```ts
export const ART_FILES: Record<string, string> = {
  fish_sunrise_smelt: 'sprites/fish/sunrise_smelt.png',
};
```

Sizes and frame counts are in `docs/SPRITES.md`.

## Add or replace a sound

Drop files in `public/audio/` (ship `.ogg` and `.mp3`) and list them in `src/config/audio.ts`:

```ts
cast: { volume: 0.5, files: ['audio/cast.ogg', 'audio/cast.mp3'], tone: { ... } },
```

New keys can be played from any feature with `ctx.bus.emit('audio:play', { key: 'my_sound' })`.
