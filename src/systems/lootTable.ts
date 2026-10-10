// Pure loot logic: rarity weights with luck, the pity counter, pool filtering,
// and tier fallback. Used by hand fishing, crew, offline catch-up, and the
// debug simulator, so all of them agree.
import { weightedPick, type Rng } from '../core/rng';

export interface LootRarity {
  id: string;
  tier: number;
  weight: number;
  luckShare: number;
  maxChance?: number;
}

export interface LootFish {
  id: string;
  rarity: string;
  waters: readonly string[];
  timeOfDay: readonly string[];
  weather: readonly string[];
  weight: number;
}

export interface Conditions {
  waterId: string;
  phase: string;
  weather: string;
}

export interface LootConfig {
  luckWeightPerPoint: number;
  pityThreshold: number;
  pityMinTier: number;
}

export function byTier<R extends LootRarity>(rarities: readonly R[]): R[] {
  return [...rarities].sort((a, b) => a.tier - b.tier);
}

/**
 * The most luck that still has an effect. Luck moves weight out of the lowest
 * tier, so it stops when that tier is empty or when any tier would pass its
 * maxChance (legendary is capped at 6% in the base pack).
 */
export function maxEffectiveLuck(rarities: readonly LootRarity[], cfg: Pick<LootConfig, 'luckWeightPerPoint'>): number {
  const sorted = byTier(rarities);
  const donor = sorted[0];
  if (!donor || cfg.luckWeightPerPoint <= 0) return 0;
  const takers = sorted.slice(1);
  const shareSum = takers.reduce((s, r) => s + r.luckShare, 0);
  if (shareSum <= 0) return 0;
  const total = sorted.reduce((s, r) => s + r.weight, 0);
  const k = cfg.luckWeightPerPoint;
  let limit = donor.weight / k;
  for (const r of takers) {
    if (r.maxChance === undefined || r.luckShare <= 0) continue;
    const share = r.luckShare / shareSum;
    const l = (r.maxChance * total - r.weight) / (share * k);
    limit = Math.min(limit, Math.max(0, l));
  }
  return Math.max(0, limit);
}

/** Lure bonuses: rarity id -> weight moved from the lowest tier into that tier. */
export type RarityBoosts = Readonly<Record<string, number>>;

/**
 * Final rarity weights for a luck value and optional lures. Total weight is
 * conserved: luck and lures both take weight from the lowest tier, which never
 * goes below zero, and no tier ever passes its maxChance (the excess goes back
 * to the lowest tier).
 */
export function rarityWeights(
  rarities: readonly LootRarity[],
  luck: number,
  cfg: Pick<LootConfig, 'luckWeightPerPoint'>,
  boosts: RarityBoosts = {},
): { id: string; tier: number; weight: number }[] {
  const sorted = byTier(rarities);
  const effective = Math.min(Math.max(0, luck), maxEffectiveLuck(sorted, cfg));
  const shift = effective * cfg.luckWeightPerPoint;
  const takers = sorted.slice(1);
  const shareSum = takers.reduce((s, r) => s + r.luckShare, 0);
  const out = sorted.map((r, i) => {
    let weight = r.weight;
    if (shareSum > 0) {
      if (i === 0) weight -= shift;
      else weight += (shift * r.luckShare) / shareSum;
    }
    return { id: r.id, tier: r.tier, weight: Math.max(0, weight) };
  });
  const donor = out[0];
  if (!donor) return out;
  for (let i = 1; i < out.length; i++) {
    const want = Math.max(0, boosts[out[i]!.id] ?? 0);
    const take = Math.min(want, donor.weight);
    out[i]!.weight += take;
    donor.weight -= take;
  }
  const total = out.reduce((s, w) => s + w.weight, 0);
  for (let i = 1; i < out.length; i++) {
    const cap = sorted[i]!.maxChance;
    if (cap === undefined) continue;
    const excess = out[i]!.weight - cap * total;
    if (excess > 1e-9) {
      out[i]!.weight -= excess;
      donor.weight += excess;
    }
  }
  return out;
}

export function rarityChances(
  rarities: readonly LootRarity[],
  luck: number,
  cfg: Pick<LootConfig, 'luckWeightPerPoint'>,
  boosts: RarityBoosts = {},
): Map<string, number> {
  const weights = rarityWeights(rarities, luck, cfg, boosts);
  const total = weights.reduce((s, w) => s + w.weight, 0) || 1;
  return new Map(weights.map((w) => [w.id, w.weight / total]));
}

/** Fish catchable right now. Empty timeOfDay or weather lists mean "any". */
export function filterPool<F extends LootFish>(fish: readonly F[], c: Conditions): F[] {
  return fish.filter(
    (f) =>
      f.waters.includes(c.waterId) &&
      (f.timeOfDay.length === 0 || f.timeOfDay.includes(c.phase)) &&
      (f.weather.length === 0 || f.weather.includes(c.weather)),
  );
}

/**
 * The tier that actually gets used when `rarityId` is rolled: the same tier if it
 * has fish, otherwise one tier lower, and so on. If nothing lower has fish, try
 * higher tiers so a cast never comes up empty.
 */
export function resolveTier<F extends LootFish>(
  pool: readonly F[],
  rarityId: string,
  sorted: readonly LootRarity[],
): string | null {
  const start = sorted.findIndex((r) => r.id === rarityId);
  if (start < 0) return null;
  const has = (i: number) => pool.some((f) => f.rarity === sorted[i]!.id);
  for (let i = start; i >= 0; i--) if (has(i)) return sorted[i]!.id;
  for (let i = start + 1; i < sorted.length; i++) if (has(i)) return sorted[i]!.id;
  return null;
}

export interface RollInput<F extends LootFish> {
  rarities: readonly LootRarity[];
  fish: readonly F[];
  conditions: Conditions;
  luck: number;
  rng: Rng;
  cfg: LootConfig;
  /** Current pity counter. Pass undefined to skip pity (crew, offline). */
  pity?: number;
  /** Lure bonuses (hand fishing). */
  boosts?: RarityBoosts;
}

export interface RollOutput<F extends LootFish> {
  fish: F;
  rarityId: string;
  rolledRarityId: string;
  pityTriggered: boolean;
  /** Next pity counter value (unchanged when pity is not used). */
  pity: number | undefined;
}

export function rollCatch<F extends LootFish>(input: RollInput<F>): RollOutput<F> | null {
  const { cfg, rng } = input;
  const sorted = byTier(input.rarities);
  const pool = filterPool(input.fish, input.conditions);
  if (pool.length === 0) return null;

  let weights = rarityWeights(sorted, input.luck, cfg, input.boosts);
  const pityTriggered = input.pity !== undefined && input.pity >= cfg.pityThreshold;
  if (pityTriggered) weights = weights.filter((w) => w.tier >= cfg.pityMinTier);

  const rolled = weightedPick(
    weights.map((w) => ({ item: w.id, weight: w.weight })),
    rng,
  );
  if (!rolled) return null;
  const tierId = resolveTier(pool, rolled, sorted);
  if (!tierId) return null;
  const candidates = pool.filter((f) => f.rarity === tierId);
  const fish = weightedPick(
    candidates.map((f) => ({ item: f, weight: f.weight })),
    rng,
  );
  if (!fish) return null;

  let pity = input.pity;
  if (pity !== undefined) {
    const tier = sorted.find((r) => r.id === tierId)?.tier ?? 0;
    pity = tier >= cfg.pityMinTier ? 0 : pity + 1;
  }
  return { fish, rarityId: tierId, rolledRarityId: rolled, pityTriggered, pity };
}

/**
 * Exact chance of each fish for one roll without pity, including tier fallback.
 * Offline catch-up multiplies this by the number of rolls instead of looping.
 */
export function fishChances<F extends LootFish>(
  rarities: readonly LootRarity[],
  fish: readonly F[],
  conditions: Conditions,
  luck: number,
  cfg: Pick<LootConfig, 'luckWeightPerPoint'>,
  boosts: RarityBoosts = {},
): Map<string, number> {
  const sorted = byTier(rarities);
  const pool = filterPool(fish, conditions);
  const out = new Map<string, number>();
  for (const [rarityId, p] of rarityChances(sorted, luck, cfg, boosts)) {
    if (p <= 0) continue;
    const tierId = resolveTier(pool, rarityId, sorted);
    if (!tierId) continue;
    const candidates = pool.filter((f) => f.rarity === tierId);
    const total = candidates.reduce((s, f) => s + f.weight, 0);
    for (const f of candidates) out.set(f.id, (out.get(f.id) ?? 0) + (p * f.weight) / total);
  }
  return out;
}
