// zod schemas for every content type. The file name prefix of a content file
// (before the first ".") picks the schema: fish.json, fish.autumn.json -> "fish".
import { z } from 'zod';
import { PALETTE_NAMES, type PaletteName } from '../../design/tokens';

const id = z.string().regex(/^[a-z0-9_]+$/, 'ids use lowercase letters, digits, and underscores');
const paletteName = z.enum(PALETTE_NAMES as [PaletteName, ...PaletteName[]]);
const spriteKey = z.string().min(1);

/** Scene landmarks a water can list. Each one has a painter in scenes/world/landmarks.ts. */
export const LANDMARKS = [
  'willows',
  'shed',
  'jetty',
  'cabin',
  'dock',
  'lighthouse',
  'harbor',
  'moored_boats',
  'palms',
  'bungalows',
  'coral',
  'grotto',
  'lantern_string',
  'pavilion',
  'floating_isles',
] as const;

/** Moving scene touches a water can list. Each one is drawn in scenes/world/sceneEffects.ts. */
export const SCENE_EFFECTS = [
  'leaves',
  'dragonflies',
  'current',
  'smoke',
  'beam',
  'gulls',
  'buoy',
  'fish_school',
  'turtle',
  'drips',
  'waterfall',
  'balloon',
  'sky_lanterns',
] as const;

export const modifierSchema = z.object({
  stat: z.string().min(1),
  op: z.enum(['add', 'mult', 'set']),
  value: z.number(),
  priority: z.number().optional(),
});

export const effectRefSchema = z.object({
  handler: z.string().min(1),
  args: z.record(z.string(), z.unknown()).optional(),
});

export const raritySchema = z.object({
  id,
  name: z.string().min(1),
  tier: z.number().int().min(0),
  weight: z.number().min(0),
  baseValue: z.number().min(0),
  /** Share of luck-shifted weight this tier receives (lowest tier gives, others take). */
  luckShare: z.number().min(0).default(0),
  /** Hard cap on the final chance of this tier, 0..1. */
  maxChance: z.number().min(0).max(1).optional(),
  /** Chance a hooked fish of this rarity slips away even with enough tackle. */
  escape: z.number().min(0).max(1).default(0),
  /** Tackle needed to land this rarity reliably. */
  tackleNeed: z.number().min(0).default(0),
  /** Share of the water's tackle need this rarity also has (tougher waters, tougher rare fish). */
  waterNeedShare: z.number().min(0).max(1).default(0),
  /** Multiplies matching set bonuses for this rarity (3 legendaries pay more than 3 commons). */
  setMult: z.number().min(0).default(1),
  color: paletteName,
  frame: paletteName,
  glow: z.number().int().min(0).max(4).default(0),
  /** Pip count shown next to color so rarity never relies on color alone. */
  pips: z.number().int().min(1).max(5),
  shape: z.enum(['circle', 'diamond', 'star', 'crown', 'sun']),
  sting: z.string().optional(),
});

export const fishSchema = z.object({
  id,
  name: z.string().min(1),
  rarity: id,
  waters: z.array(id).min(1),
  timeOfDay: z.array(z.string()).default([]),
  weather: z.array(id).default([]),
  baseValue: z.number().min(0),
  spriteKey,
  description: z.string().min(1).max(140),
  size: z.tuple([z.number().positive(), z.number().positive()]).optional(),
  /** Relative chance among fish of the same rarity. */
  weight: z.number().positive().default(1),
  /** Placeholder art hints, ignored once a real sprite exists. */
  art: z
    .object({
      body: paletteName.optional(),
      accent: paletteName.optional(),
      shape: z.enum(['slim', 'round', 'long', 'tiny', 'whale', 'ray', 'eel', 'puffer']).optional(),
    })
    .optional(),
});

export const waterSchema = z.object({
  id,
  name: z.string().min(1),
  description: z.string().min(1).max(140),
  order: z.number().int(),
  /**
   * The water's place in the club's journey (0 = the starting water). The club
   * can move here once boatRange reaches this value and it is the next stop.
   */
  rangeRequired: z.number().int().min(0).default(0),
  /** Extra coins earned everywhere once the club has moved here (1 = +100%). */
  clubBonus: z.number().min(0).default(0),
  /** Fish here fight harder: added to every rarity's tackle need. */
  tackleNeed: z.number().min(0).default(0),
  comingSoon: z.boolean().default(false),
  spriteKey,
  scene: z
    .object({
      hills: z.enum(['rolling', 'pines', 'cliffs', 'cave', 'clouds', 'none']).default('rolling'),
      foreground: z.enum(['reeds', 'rocks', 'lilies', 'crystals', 'none']).default('reeds'),
      /** Buildings and props on the far shore, painted in order (see scenes/world/landmarks.ts). */
      landmarks: z.array(z.enum(LANDMARKS)).default([]),
      /** Moving touches for this water (see scenes/world/sceneEffects.ts). */
      effects: z.array(z.enum(SCENE_EFFECTS)).default([]),
      /**
       * Optional scene palette overrides per phase, e.g. { "night": { "waterTop": "teal" } }.
       * Values are palette names, lists of palette names (skyBands), or numbers (stars, fireflies).
       */
      tint: z
        .record(z.string(), z.record(z.string(), z.union([paletteName, z.array(paletteName).min(1), z.number().min(0).max(1)])))
        .default({}),
    })
    .default({ hills: 'rolling', foreground: 'reeds', landmarks: [], effects: [], tint: {} }),
});

export const branchSchema = z.object({
  id,
  name: z.string().min(1),
  icon: spriteKey,
  order: z.number().int(),
  /** Upgrades in this branch stay owned when the club moves to a new water. */
  keepOnMove: z.boolean().default(false),
  /** A button above the tree that opens a panel (e.g. the gem exchange), shown only if that panel exists. */
  panel: z.object({ label: z.string().min(1).max(24), sceneKey: z.string().min(1) }).optional(),
});

const prerequisite = z.union([id, z.object({ id, level: z.number().int().min(1) })]);

export const upgradeSchema = z.object({
  id,
  branch: id,
  name: z.string().min(1).max(24),
  description: z.string().min(1).max(100),
  prerequisites: z.array(prerequisite).default([]),
  maxLevel: z.number().int().min(1),
  baseCost: z.number().min(0),
  costGrowth: z.number().min(1).optional(),
  currency: id.optional(),
  modifiers: z.array(modifierSchema).default([]),
  effects: z.array(effectRefSchema).default([]),
  icon: spriteKey.optional(),
  /** Short tag on the tree node (e.g. "T3" for a rod tier). */
  label: z.string().max(3).optional(),
  /** The club must have reached this water rank (0 = starting water) before it can be bought. */
  requiresRank: z.number().int().min(0).default(0),
  /** Optional tree slot; nodes without one are laid out by prerequisite depth. */
  position: z.object({ row: z.number().int().min(0), col: z.number().int().min(0) }).optional(),
});

export const crewSchema = z.object({
  id,
  name: z.string().min(1),
  description: z.string().min(1).max(100),
  spriteKey,
  hireCost: z.number().min(0),
  currency: id.optional(),
  /** Multiplies the crewIntervalMs stat for this helper. Lower is faster. */
  intervalMult: z.number().positive().default(1),
  /** Multiplies sale value of this helper's catches. */
  valueMult: z.number().positive().default(1),
  /** Extra luck on top of the crewLuck stat. */
  luck: z.number().min(0).default(0),
  order: z.number().int().default(0),
});

export const weatherSchema = z.object({
  id,
  name: z.string().min(1),
  icon: spriteKey,
  weight: z.number().min(0),
  visuals: z
    .object({
      rain: z.number().min(0).max(1).default(0),
      fog: z.number().min(0).max(1).default(0),
      clouds: z.number().min(0).max(1).default(0.3),
      dim: z.number().min(0).max(1).default(0),
      /** Gusts: faster clouds, slanted rain, wind streaks, and a wind sound. */
      wind: z.number().min(0).max(1).default(0),
      /** Soft distant flashes now and then (storms). */
      flashes: z.boolean().default(false),
    })
    .default({ rain: 0, fog: 0, clouds: 0.3, dim: 0, wind: 0, flashes: false }),
});

export const decorationSchema = z.object({
  id,
  name: z.string().min(1),
  description: z.string().min(1).max(100),
  spriteKey,
  /** `club` decorations dress the club's building in every water (scenes/world/landmarks.ts). */
  anchor: z.enum(['bow', 'stern', 'mast', 'water', 'sky', 'club']),
  offset: z.tuple([z.number().int(), z.number().int()]).default([0, 0]),
});

export const currencySchema = z.object({
  id,
  name: z.string().min(1),
  icon: spriteKey,
  color: paletteName,
  start: z.number().min(0).default(0),
  order: z.number().int().default(0),
  /** Hidden currencies stay off the HUD until the player has some. */
  hidden: z.boolean().default(false),
  /** Keep the balance when the club moves to a new water (otherwise it resets to start). */
  keepOnMove: z.boolean().default(false),
});

export const packSchema = z.object({
  id,
  name: z.string().min(1),
  order: z.number().int().default(0),
  enabled: z.boolean().default(true),
  /** Feature ids this pack needs. The pack is skipped when any is not registered. */
  requires: z.array(z.string()).default([]),
});

export type RarityDef = z.infer<typeof raritySchema>;
export type FishDef = z.infer<typeof fishSchema>;
export type WaterDef = z.infer<typeof waterSchema>;
export type BranchDef = z.infer<typeof branchSchema>;
export type UpgradeDef = z.infer<typeof upgradeSchema>;
export type CrewDef = z.infer<typeof crewSchema>;
export type WeatherDef = z.infer<typeof weatherSchema>;
export type DecorationDef = z.infer<typeof decorationSchema>;
export type CurrencyDef = z.infer<typeof currencySchema>;
export type PackDef = z.infer<typeof packSchema>;
export type ModifierData = z.infer<typeof modifierSchema>;
export type EffectRef = z.infer<typeof effectRefSchema>;

/** Every content type the loader knows. Features can add more at runtime. */
export const CORE_CONTENT_SCHEMAS = {
  rarities: raritySchema,
  fish: fishSchema,
  waters: waterSchema,
  branches: branchSchema,
  upgrades: upgradeSchema,
  crew: crewSchema,
  weather: weatherSchema,
  decorations: decorationSchema,
  currencies: currencySchema,
} as const;

export type CoreContentType = keyof typeof CORE_CONTENT_SCHEMAS;

export interface CoreContent {
  rarities: RarityDef[];
  fish: FishDef[];
  waters: WaterDef[];
  branches: BranchDef[];
  upgrades: UpgradeDef[];
  crew: CrewDef[];
  weather: WeatherDef[];
  decorations: DecorationDef[];
  currencies: CurrencyDef[];
}
