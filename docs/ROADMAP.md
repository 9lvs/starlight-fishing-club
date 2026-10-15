# Roadmap

Ideas the architecture is ready for. None are built yet; each note says where it plugs in.

## Next passes (owner's order, each on its own so it is done right)

1. **Animation polish.** Walk through each piece with the owner: fish that jump now and then, gulls landing on the mast, the ship cat walking the deck, lanterns lighting at dusk, a whale far out at sea, rain rings on the water, a little line wobble, Logbook confetti, journal pages that turn.
2. **Logins and cloud saves.** Keep GitHub Pages hosting; Supabase for sign in (Google or email link) and the save. Playing signed out keeps working. Needs the owner's OK for the library and a free Supabase account in the owner's name, plus a short privacy note.
3. **Friends and a friendly leaderboard.** After logins: add friends by a short club code, weekly boards among friends only (Daily Catch luck, biggest fish of the week, journal %, fastest to Sky Lake), reset every Monday, no public lists or chat.
4. **Local gear (later).** Three upgrades per later water, sold only there (Snorkel Mask, Coral Charm, Glass Bottom at the reef; Mushroom Lamps, Echo Bell, Glow-worm Line in the cave; Cloud Nets, Wind Vane, Star Chart at Sky Lake). The owner likes the idea but wants it on the roadmap for now.

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
| Make it yours | Idea | Name the club, boat, and crew; pick a favorite color for the pennant, sails, and menus. |
| Water-specific boats | Started | Tiers 7 to 10 each have their own design (`src/art/boatsHigh.ts`) with lights (`scenes/world/boatGlow.ts`). Local upgrades per water are pass 4 above. |
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
