// Balance numbers for loot and economy. Per-rarity numbers (weights, base values,
// luck shares, chance caps) live in src/content/<pack>/rarities.json.

export const LOOT = {
  /** Weight moved from the lowest tier into higher tiers per point of luck. */
  luckWeightPerPoint: 1,
  /** After this many rolls without minPityTier or better, the next roll is guaranteed. */
  pityThreshold: 40,
  /** The tier (rarity "tier" number) the pity guarantee reaches. 2 = rare. */
  pityMinTier: 2,
} as const;

export const ECONOMY = {
  defaultCostGrowth: 1.15,
  defaultCurrency: 'coins',
  /** Minimum coins any sold fish is worth. */
  minSellValue: 1,
} as const;

export const SIZE = {
  /** Default size range (cm) when a fish entry does not give one. */
  defaultRange: [10, 30] as [number, number],
  decimals: 1,
} as const;
