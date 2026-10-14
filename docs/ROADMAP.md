# Roadmap

Ideas the architecture is ready for. None are built yet; each note says where it plugs in.

| Idea | Status | How it fits |
|---|---|---|
| Random encounters and events (a passing whale, a lantern festival night) | Not built | Feature with `onTick` and a layer scene; event definitions as a feature content type; effects as temporary stat sources. |
| Bait crafting | Not built | Feature that turns creel fish into bait items; bait as content with modifiers applied while equipped (`stats.setSource('bait', ...)`). |
| Aquarium or cabin decorating | Not built | Kept creel fish plus `decorations.json`; a panel scene to place them; `decoration` effect handler already exists. |
| Achievements | Not built | Feature listening to `catchLanded`, `upgradePurchased`, `waterUnlocked`; definitions as content. |
| Seasons and holidays | Not built | Content packs per season with `order`, `enabled`, and `"override": true`; optional feature to switch packs by date. |
| Daily rewards beyond the gift | Built (daily gift, Daily Catch) | `dailyCatch` feature: one shared fish a day with a share grid. A board of fewest casts would need a small backend. |
| Translations (Spanish first) | Not built | Move UI strings to a strings file per language; content names could come from a pack per language. |
| Share card image of a big catch | Not built | Render the catch card to a canvas and use the Web Share API with a file. |
| Sign in and cloud saves | Later | Owner's call: not yet. Plan: Supabase with Google or email link, offline first, sync the save. |
| Make it yours | Idea | Name the club, boat, and crew; pick a favorite color for the pennant, sails, and menus. |
| Water-specific boats | Idea | Boat styles and upgrades that change with each water, like the per-water sound and music. |
| Moving the club (prestige) | Built | Six waters; each move resets coins, gear, and crew for a bigger permanent coin bonus (`core/club.ts`, `clubBonus` in `waters.json`). |
| More waters after Sky Lake | Ready | Add a water with `rangeRequired: 5`, fish, a reach boat at `requiresRank: 4`, and higher tiers at `requiresRank: 5`. |
| Boat paint and other cosmetic choices | Not built | Club branch items are kept across moves; a paint would be a `look` effect on a new slot. |
| Equip a chosen bait or lure | Not built | Today every owned bait and lure applies. A picker would set one `bait` stat source at a time. |
| Second currency (Star Pearls) | Not built | Add to `currencies.json` (`hidden: true`), grant from legendary catches via a small feature. |
| Fish size records | Partly (best size in journal) | Leaderboard-free personal records; journal already stores `bestSize`. |
| Cloud save | Not built | Wrap `SaveManager.exportString` / `importString` with a sync feature. |
| Capacitor wrap for iOS and Android | Not built | Static build with relative paths already works offline; safe areas handled; storage would move to Capacitor Preferences behind `StorageLike`. |
| Menu overflow | Not built | The menu bar fits about 7 buttons; add a "More" panel when features exceed that. |
| Real art and sound | Placeholders | Drop files and list them (`docs/SPRITES.md`, `src/config/audio.ts`). Painted PNG parallax layers would need a small change in `WorldScene`. |
| Fish swim animation frames | Not built | Raise fish frames in `PREFIX_RULES` and animate in the catch card and journal. |
| Crew visible in the world | Not built | Layer scene from the crew feature drawing helpers in small boats. |
| Landscape layout | Prepared | Change `DISPLAY.baseWidth/baseHeight` to 320x180 and adjust `core/layout.ts`. |
