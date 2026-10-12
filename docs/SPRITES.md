# Sprites

Every sprite the game draws, with the size and frame count real art must match.
Until a PNG exists, each key gets a procedural placeholder from the palette
(`src/art/placeholderGenerator.ts`). See it all at `?debug=styleguide`.

## How to replace a placeholder

1. Draw the sprite at 1x (no scaling, no anti-aliasing), using only the 16 palette colors in `src/design/tokens.ts`.
2. Sprite sheets are horizontal strips: frame N starts at x = N x width. Transparent background.
3. Save it under `public/sprites/` (any sub-folder), for example `public/sprites/fish/lantern_carp.png`.
4. Add one line to `ART_FILES` in `src/art/spriteManifest.ts`:
   `fish_lantern_carp: 'sprites/fish/lantern_carp.png',`
5. Reload. A missing or broken file falls back to the placeholder with a console warning.

Facing: fish face right; the boat faces right with the bow on the right; the fisher faces right.

## Characters and world

| Key | Size (px) | Frames | Notes |
|---|---|---|---|
| `boat` | 32x32 | 1 | Starter boat. Hull bottom near y=26, rail around y=18-20, mast at x=17 from y=3. Fisher stands behind the hull. |
| `boat_1` .. `boat_10` | 32x32 | 1 | Boat tier hulls (Patched Dinghy to Starlight Schooner). Same footprint as `boat`; no mast. |
| `rig_1` .. `rig_10` | 32x48 | 1 | Mast and sail for each tier, drawn BEHIND the fisher and placed 16 px above the hull (row 16 lines up with the hull top). Mast at x=17. |
| `fisher` | 16x24 | 4 | 0 idle, 1 idle breathing (1 px lower), 2 cast (arm forward), 3 reel/cheer (arm up). Hand positions for the rod are in `FISHER_HAND` in `placeholderGenerator.ts`. |
| `bobber` | 8x8 | 2 | 0 floating, 1 dipped (bite). |
| `fx_sparkle` | 5x5 | 2 | Rarity sparkle, two twinkle frames. |
| `fx_splash` | 12x6 | 3 | Splash when a fish is hooked, played once. |

The sky, hills, water, clouds, and foreground are painted procedurally per time of day (`src/scenes/world/painters.ts`), and the sun and moon are drawn in `WorldScene`. Swapping those for PNG layers is on the roadmap.

## Fish (16x16, 1 frame)

Idle frame; a second swim frame (32x16 strip) can be added later. Keep the fish within 15x13 so the outline fits.

| Key | Fish | Rarity | Waters |
|---|---|---|---|
| `fish_pebble_minnow` | Pebble Minnow | common | pond, river |
| `fish_puddle_perch` | Puddle Perch | common | pond |
| `fish_mossback_bream` | Mossback Bream | common | pond |
| `fish_doodle_loach` | Doodle Loach | common | pond, river |
| `fish_lantern_carp` | Lantern Carp | uncommon | pond |
| `fish_lily_sunfish` | Lily Sunfish | uncommon | pond |
| `fish_drizzle_guppy` | Drizzle Guppy | uncommon | pond, river |
| `fish_reed_pike` | Reed Pike | uncommon | pond |
| `fish_velvet_catfish` | Velvet Catfish | rare | pond |
| `fish_moonscale_koi` | Moonscale Koi | rare | pond |
| `fish_mirror_pike` | Mirror Pike | epic | pond |
| `fish_hush_snapper` | Hush Snapper | epic | pond |
| `fish_old_whisker` | Old Whisker | legendary | pond |
| `fish_brook_dace` | Brook Dace | common | river |
| `fish_ripple_chub` | Ripple Chub | common | river |
| `fish_willow_shiner` | Willow Shiner | common | river |
| `fish_copper_trout` | Copper Trout | uncommon | river |
| `fish_rainbow_darter` | Rainbow Darter | uncommon | river |
| `fish_mistfin_grayling` | Mistfin Grayling | uncommon | river |
| `fish_ember_salmon` | Ember Salmon | rare | river |
| `fish_glass_eel` | Glass Eel | rare | river |
| `fish_pinecone_bass` | Pinecone Bass | rare | river |
| `fish_riverkeeper_gar` | Riverkeeper Gar | epic | river |
| `fish_thunder_sturgeon` | Thunder Sturgeon | epic | river |
| `fish_golden_riverking` | Golden Riverking | legendary | river |
| `fish_sand_dab` | Sand Dab | common | cove |
| `fish_tidepool_goby` | Tidepool Goby | common | cove |
| `fish_kelp_wrasse` | Kelp Wrasse | common | cove |
| `fish_bubble_puffer` | Bubble Puffer | uncommon | cove |
| `fish_coral_snapper` | Coral Snapper | uncommon | cove |
| `fish_starry_flounder` | Starry Flounder | uncommon | cove |
| `fish_silver_barracuda` | Silver Barracuda | rare | cove |
| `fish_moonjelly_ray` | Moonjelly Ray | rare | cove |
| `fish_ghostfin` | Ghostfin | rare | cove |
| `fish_nebula_grouper` | Nebula Grouper | epic | cove |
| `fish_aurora_marlin` | Aurora Marlin | epic | cove |
| `fish_pearl_dragonet` | Pearl Dragonet | legendary | cove |
| `fish_starwhale` | Starwhale | legendary | cove |
| `fish_sunrise_smelt` | Sunrise Smelt | uncommon | river |
| `fish_pale_tetra` | Pale Tetra | common | glowing_cave |
| `fish_pebble_blindfish` | Pebble Blindfish | common | glowing_cave |
| `fish_drip_minnow` | Drip Minnow | common | glowing_cave |
| `fish_glowcap_loach` | Glowcap Loach | uncommon | glowing_cave |
| `fish_crystal_shrimpfish` | Crystal Shrimpfish | uncommon | glowing_cave |
| `fish_echo_bass` | Echo Bass | uncommon | glowing_cave |
| `fish_lantern_eel` | Lantern Eel | rare | glowing_cave |
| `fish_amethyst_cichlid` | Amethyst Cichlid | rare | glowing_cave |
| `fish_mist_wraith` | Mist Wraith | rare | glowing_cave |
| `fish_opal_arowana` | Opal Arowana | epic | glowing_cave |
| `fish_spore_puffer` | Spore Puffer | epic | glowing_cave |
| `fish_deep_lantern` | The Deep Lantern | legendary | glowing_cave |
| `fish_puff_minnow` | Puff Minnow | common | sky_lake |
| `fish_breeze_dace` | Breeze Dace | common | sky_lake |
| `fish_cloud_bream` | Cloud Bream | common | sky_lake |
| `fish_kite_fin` | Kite Fin | uncommon | sky_lake |
| `fish_sunbeam_perch` | Sunbeam Perch | uncommon | sky_lake |
| `fish_drizzle_swift` | Drizzle Swift | uncommon | sky_lake |
| `fish_rainbow_ray` | Rainbow Ray | rare | sky_lake |
| `fish_zephyr_eel` | Zephyr Eel | rare | sky_lake |
| `fish_comet_koi` | Comet Koi | epic | sky_lake |
| `fish_halo_marlin` | Halo Marlin | epic | sky_lake |
| `fish_sky_leviathan` | Sky Leviathan | legendary | sky_lake |
| `fish_dawn_carp` | Dawn Carp | legendary | sky_lake |
| `fish_gust_minnow` | Gust Minnow | uncommon | pond |
| `fish_thunder_bream` | Thunder Bream | rare | pond |
| `fish_windrider_dace` | Windrider Dace | uncommon | river |
| `fish_squall_trout` | Squall Trout | rare | river |
| `fish_gale_flyingfish` | Gale Flyingfish | uncommon | cove |
| `fish_tempest_eel` | Tempest Eel | epic | cove |
| `fish_draft_tetra` | Draft Tetra | uncommon | glowing_cave |
| `fish_echo_ray` | Echo Ray | rare | glowing_cave |
| `fish_thunderhead_ray` | Thunderhead Ray | epic | sky_lake |

## Crew portraits (16x24, 2 frames)

Frame 0 idle, frame 1 one pixel lower (breathing).

| Key | Crew |
|---|---|
| `crew_deckhand` | Deckhand Pip |
| `crew_old_salt` | Old Salt Marge |
| `crew_otter` | Otto the Otter |

## Map vignettes (32x24, 1 frame)

| Key | Water |
|---|---|
| `water_pond` | Willow Pond |
| `water_river` | Whisper River |
| `water_cove` | Moonlit Cove |
| `water_cave` | Glowing Cave |
| `water_sky` | Sky Lake |

## Boat decorations (20x12, 1 frame)

Placed by `anchor` and `offset` in `decorations.json`. Mast anchors align the sprite's top-right corner to the mast top; bow and stern align bottom-center.

| Key | Decoration | Anchor |
|---|---|---|
| `decor_lanterns` | Paper Lanterns | mast |
| `decor_chimes` | Wind Chimes | stern |
| `decor_cat` | Ship Cat | bow |
| `decor_pennant` | Club Pennant | mast |
| `decor_flowers` | Flower Box | stern |
| `decor_fairy_lights` | Fairy Lights | mast (strung toward the bow) |

## Icons (12x12, 1 frame)

Used in the HUD, menu bar, buttons, and upgrade nodes. Keep a 1 px margin.

| Key | Used for |
|---|---|
| `icon_coin` | Coins currency, sell buttons |
| `icon_rod` | Cast button, Gear upgrades |
| `icon_boat` | Boat branch, Sail here |
| `icon_crew` | Crew menu, Crew branch |
| `icon_journal` | Journal menu |
| `icon_settings` | Settings menu |
| `icon_mute` | Sound off |
| `icon_sound` | Sound on |
| `icon_lock` | Locked nodes and waters |
| `icon_map` | Map menu, chart upgrades |
| `icon_star` | Upgrades menu, lures |
| `icon_bait` | Bait upgrades |
| `icon_creel` | Creel button, storage upgrades |
| `icon_note` | Sea Shanties, Wind Chimes |
| `icon_moon` | Night, offline summary, Cozy Hammock |
| `icon_sun` | Day |
| `icon_dusk` | Dusk |
| `icon_dawn` | Dawn |
| `icon_clear` | Clear weather |
| `icon_rain` | Rain |
| `icon_wind` | High Winds weather |
| `icon_storm` | Rainstorm weather, Storm Sails |
| `icon_fog` | Fog |
| `icon_lantern` | Paper Lanterns |
| `icon_cat` | Ship Cat |
| `icon_flag` | Club Pennant |
| `icon_close` | Close panel |
| `icon_check` | Done |
| `icon_gift` | Daily gift, Club Mailbox |
| `icon_arrow` | Next |
| `icon_motion` | Reduced motion setting |

## Font

Pixelify Sans (SIL Open Font License 1.1, `public/fonts/OFL.txt`) is baked at boot into a bitmap font at 11 px, where one design pixel equals one screen pixel. Cap height 7 px, x-height 5 px, descender 2 px, line height 13 px. To use another pixel font, change `TYPOGRAPHY` in `src/design/tokens.ts` (size, grid offsets, ascent/descent).

## Commission checklist

- 16-color palette only; no anti-aliasing; transparent background.
- Exact sizes and frame counts above; frames in a horizontal strip.
- 1 px outline in a darker palette color reads best on both day and night skies.
- Count: 1 boat, 1 fisher (4 frames), 1 bobber (2), 2 effects, 39 fish, 3 crew (2 each), 5 map vignettes, 4 decorations, 29 icons.
