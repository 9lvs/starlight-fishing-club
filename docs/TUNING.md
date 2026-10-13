# Tuning

Every balance number lives in `src/config/` or in content JSON. After changing
numbers, run `npm test`: the pacing test prints and checks the time to the first
upgrade (~1 min), first new water (~20 min), and first crew hire (~30 min).

## Hand fishing feel: `src/config/tuning.ts` (`FISHING`)

| Value | Default | What it does |
|---|---|---|
| `castAnimMs` | 650 | Bobber flight time after tapping Cast. |
| `waitMinMs` / `waitMaxMs` | 2000 / 6000 | Random wait before a bite (base values of the `waitMinMs`/`waitMaxMs` stats), divided by `castSpeed`. |
| `biteGraceMs` | 180 | Hidden extra time after the bite window closes. |
| `reelAnimMs` | 900 | Fish leaping to the boat. |
| `missMessageMs` | 1400 | How long "It swam away" shows before idle (tap to recast any time). |
| `tapDebounceMs` | 120 | Ignores double taps right after a state change. |
| `castDistance`, `bobAmplitude`, `biteDipPx` | 46, 1, 2 | Visual distances in game pixels. |

`SAVE.autosaveMs` (15000) is the autosave period. `OFFLINE.minCatchUpMs` (5000) is the
smallest gap treated as offline time; `OFFLINE.minSummaryMs` (60000) is the shortest
absence that shows "While you were away"; `OFFLINE.maxTickMs` (1000) clamps live ticks.

## Stats: `src/config/stats.ts`

Base values; upgrades and features change them only through modifiers.

| Stat | Base | Meaning |
|---|---|---|
| `biteWindowMs` | 1200 | Time to tap after a bite. |
| `castSpeed` | 1 | Divides the wait before a bite. |
| `waitMinMs`, `waitMaxMs` | 2000, 6000 | Wait range before a bite. |
| `luck` | 0 | Hand-fishing luck (see loot). |
| `sellValueMult` | 1 | Multiplies every sale. |
| `storageCap` | 6 | Creel capacity. |
| `boatRange` | 0 | The club can move to the next water once this reaches its `rangeRequired`. |
| `crewSlots` | 0 | How many helpers can be hired. |
| `crewIntervalMs` | 12000 | Time between crew rolls (times the helper's `intervalMult`). |
| `crewSellMult` | 0.5 | Share of value crew catches sell for. |
| `crewLuck` | 0 | Luck for crew rolls (plus the helper's `luck`). |
| `offlineCapHours` | 8 | Longest absence that earns (24 max). |
| `offlineValueMult` | 1 | Multiplies what crew earn while you are away. |
| `fishSizeMult` | 1 | Bait: hand-caught fish are this much bigger and sell for this much more. |
| `boost_<rarity>` | 0 | Lures: weight moved from common to that rarity (hand fishing). One per rarity. |
| `dailyGiftCoins` | 60 | Defined by the daily gift feature. |

## Landing a fish: `src/config/tuning.ts` (`CATCH`), `rarities.json`, `waters.json`

- Slip chance = (rarity `escape`, eased by spare tackle down to 30% of it, plus 5% per point
  of tackle short of the need) times `escapeMult`, capped at 88%. Need = rarity `tackleNeed`
  (uncommon 1, rare 4, epic 8, legendary 13) plus water `tackleNeed` (pond 0, river 3, cove 10,
  cave 17, sky 25) times the rarity's `waterNeedShare` (uncommon 0, rare 0.6, epic 0.8,
  legendary 1). Base `escape`: 0, 3%, 8%, 15%, 25%.
- Tackle comes from rod tiers (+2 each), boat tiers (+1), bait tiers (+2), Smooth Reel and
  Steady Anchor (+1 per level). Fully geared: about 23 at the pond and 52 at Sky Lake.
- Quick catch: reel within 35% of the bite window for +25% of the fish's value in coins,
  within 65% for +10%. Smooth Reel widens both.
- Crew and offline rolls never slip away (their math is unchanged).

## Loot: `src/config/balance.ts` (`LOOT`) and `rarities.json`

- `rarities.json`: `weight` (60/25/10/4/1), `baseValue` (2/6/25/100/500, a reference;
  each fish has its own `baseValue`), `luckShare` (how luck-shifted weight is split:
  0/0.4/0.3/0.2/0.1), `maxChance` (legendary 0.06).
- `LOOT.luckWeightPerPoint` (1): weight moved out of common per point of luck. With the
  base table, luck stops mattering at 50 (legendary reaches its 6% cap).
- `LOOT.pityThreshold` (40) and `LOOT.pityMinTier` (2 = rare): after 40 hand catches
  below rare, the next is rare or better. Crew and offline rolls do not use pity.
- `fish.json`: per-fish `baseValue`, `weight` (chance within its rarity), `size` range.

## Economy: `src/config/balance.ts` (`ECONOMY`, `SIZE`) and `upgrades.json`

- Cost of the next level = `round(baseCost * costGrowth ^ ownedLevel)`;
  `ECONOMY.defaultCostGrowth` is 1.15 when an upgrade omits it.
- `ECONOMY.minSellValue` (1): no sale is worth less.
- Pacing levers: `rod_1` / `cork_grip` costs (first upgrade), `boat_3` (first move),
  the reach boats `boat_5`, `boat_7`, `boat_8`, `boat_9` (later moves), `hire_help.baseCost` and
  `crew.json` `deckhand.hireCost` (first crew), and `clubBonus` in `waters.json`.
- The journey: Willow Pond (+0%), Whisper River (+200%), Moonlit Cove (+400%),
  Sunlit Reef (+600%), Glowing Cave (+900%), Sky Lake (+2400%). Tier costs rise about 6x per water
  (36x and 600x of the pond for cove and cave, 4000x for the Sky Lake finale).
- `tests/pacing.test.ts` plays the whole journey with a goal-directed player model
  (`tests/helpers/journeySim.ts`) and checks: first upgrade under 1.5 min, first move
  15 to 28 min, each later water a little longer but under 80 min, the first boats
  coming back in under half the time after a move, and a Sky Lake finale of 30 to
  150 min. Current median: 20, 31, 56, 63, 65 min per water, a 107 min finale, about 5.8 h total.
- Crew helpers in `crew.json`: `hireCost`, `intervalMult`, `valueMult`, `luck`. While you play
  they sell at `crewSellMult`; while you are away they only fill the creel (`storageCap`).

## Creel and gems: `src/config/tuning.ts` (`CREEL`, `GEMS`) and `rarities.json`

- Freshness (`CREEL.freshness`): kept fish are full value for `graceMs` (3 min) of play,
  then lose `perMinute` (2%) a minute down to `floor` (60%). Time away never counts.
  `freshDecayMult` (Ice Chest) slows it.
- Bundle: `bundlePerFish` (+5%) per fish after the first, up to `bundleMax` (+50%).
- Matching sets (`CREEL.sets`): 3, 5, or 10 of one rarity add `share` (12%, 25%, 60%) of
  those fish's value, times the rarity's `setMult` (common 1, uncommon 1.3, rare 1.8,
  epic 2.5, legendary 3.5). Each rarity earns its biggest set; sets of different rarities stack.
- Gems (`GEMS`): each catch finds one at `base + tier * perTier` (1% common to 3% legendary,
  capped at `max`), plus the `gemChance` stat. The exchange costs `tradeCoins` (1,000) times
  `1 + clubBonus`, so 3,000 at Whisper River and 25,000 at Sky Lake. Club items cost 2 to 25 gems.

## Sound: `src/config/audio.ts`

- `AUDIO.musicLevel`, `musicDefault`, `bedLevel`, and the `limiter` set the mix. `MUSIC.gain` per voice.
- `BED`: each sound bed layer (loops: filter, swell; calls: voice, `everyS`, `phases`, gain).
  Waters pick layers and their music `transpose`, `voice`, and `tempo` in `waters.json` `sound`.

## Time and weather: `src/config/time.ts`

- `TIME.dayCycleMs` (10 min) and `TIME.phases` shares (day 0.4, dusk 0.15, night 0.3, dawn 0.15).
- `TIME.transitionMs` (8000) / `transitionSteps` (16): palette dissolve.
- `WEATHER.periodMs` (3 min): weather is rolled per period from `weather.json` weights
  with `WEATHER.seed`, deterministically, so offline time sees the same weather.

## Display and look

- `src/config/display.ts`: design size (180x320) and `minGame`, the least room kept per
  orientation (portrait 180x320, landscape 320x240). Lower these to make everything
  bigger on screen, raise them to show more world.
- `UI.menuSlotMax`, `UI.panelMaxWidth`, `UI.panelMaxHeight`, `UI.boatGroupOffset` in
  `src/design/tokens.ts`: how the layout behaves on wide screens.
- `src/design/tokens.ts`: palette, scene palettes per time of day, UI metrics
  (`UI.minTouch` 24), motion timings, typography bake settings.
- `src/config/audio.ts`: volumes, the `masterCeiling` (0.6), placeholder mode, and files.
