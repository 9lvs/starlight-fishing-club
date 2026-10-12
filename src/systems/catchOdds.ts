// Pure rules for the moment a fish is on the line: will it slip the hook, and
// did a quick reel earn a bonus? Rarer fish fight harder, and every rarity and
// water asks for some tackle (rods, boats, bait). Short of it, a fish is likely
// to slip away; well above it, even legends rarely do.

export interface EscapeConfig {
  /** Extra escape chance per point of tackle short of what the fish needs. */
  perShortfall: number;
  /** Each point of tackle above the need takes this share off the base chance... */
  surplusRelief: number;
  /** ...but never below this share of it. */
  minFactor: number;
  /** Even with no tackle at all, at least this much chance remains to land it. */
  max: number;
}

/**
 * Chance (0..1) that a hooked fish slips away.
 * base: the rarity's own chance; need: rarity plus water tackle need;
 * tackle: the player's tackle stat; mult: upgrades like Sharp Hooks (below 1 helps).
 */
export function escapeChance(base: number, need: number, tackle: number, mult: number, cfg: EscapeConfig): number {
  const shortfall = Math.max(0, need - tackle);
  const surplus = Math.max(0, tackle - need);
  const eased = base * Math.max(cfg.minFactor, 1 - surplus * cfg.surplusRelief);
  return Math.max(0, Math.min(cfg.max, (eased + shortfall * cfg.perShortfall) * Math.max(0, mult)));
}

export interface QuickTier {
  /** Reeled within this share of the bite window. */
  within: number;
  /** Bonus share of the fish's value, paid as coins. */
  bonus: number;
  label: string;
}

/** The best quick-catch tier for a reaction time, if any. windowMult widens every tier (Smooth Reel). */
export function quickBonus(reactionMs: number, windowMs: number, tiers: readonly QuickTier[], windowMult = 1): QuickTier | null {
  if (windowMs <= 0 || reactionMs < 0) return null;
  const share = reactionMs / (windowMs * Math.max(0.01, windowMult));
  return [...tiers].sort((a, b) => a.within - b.within).find((t) => share <= t.within) ?? null;
}
