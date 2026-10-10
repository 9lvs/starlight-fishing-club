# Roadmap

Ideas the architecture is ready for. None are built yet; each note says where it plugs in.

| Idea | Status | How it fits |
|---|---|---|
| Random encounters and events (a passing whale, a lantern festival night) | Not built | Feature with `onTick` and a layer scene; event definitions as a feature content type; effects as temporary stat sources. |
| Bait crafting | Not built | Feature that turns creel fish into bait items; bait as content with modifiers applied while equipped (`stats.setSource('bait', ...)`). |
| Aquarium or cabin decorating | Not built | Kept creel fish plus `decorations.json`; a panel scene to place them; `decoration` effect handler already exists. |
| Achievements | Not built | Feature listening to `catchLanded`, `upgradePurchased`, `waterUnlocked`; definitions as content. |
| Seasons and holidays | Not built | Content packs per season with `order`, `enabled`, and `"override": true`; optional feature to switch packs by date. |
| Daily rewards beyond the gift | Partly (daily gift) | Extend `dailyGift` content and stats. No streak penalties. |
| Prestige ("retire to a new club") | Not built | New currency in `currencies.json`, a slice storing prestige level, permanent stat sources. |
| More waters: Glowing Cave, Sky Lake | Teased on the map | Set `comingSoon` to false, add fish, add a range upgrade. New scene presets (cave ceiling, cloud sea) would be new painters. |
| Second currency (Star Pearls) | Not built | Add to `currencies.json` (`hidden: true`), grant from legendary catches via a small feature. |
| Fish size records | Partly (best size in journal) | Leaderboard-free personal records; journal already stores `bestSize`. |
| Cloud save | Not built | Wrap `SaveManager.exportString` / `importString` with a sync feature. |
| Capacitor wrap for iOS and Android | Not built | Static build with relative paths already works offline; safe areas handled; storage would move to Capacitor Preferences behind `StorageLike`. |
| Menu overflow | Not built | The menu bar fits about 7 buttons; add a "More" panel when features exceed that. |
| Real art and sound | Placeholders | Drop files and list them (`docs/SPRITES.md`, `src/config/audio.ts`). Painted PNG parallax layers would need a small change in `WorldScene`. |
| Fish swim animation frames | Not built | Raise fish frames in `PREFIX_RULES` and animate in the catch card and journal. |
| Crew visible in the world | Not built | Layer scene from the crew feature drawing helpers in small boats. |
| Landscape layout | Prepared | Change `DISPLAY.baseWidth/baseHeight` to 320x180 and adjust `core/layout.ts`. |
