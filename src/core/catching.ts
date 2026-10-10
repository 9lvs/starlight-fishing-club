// Shared helpers for turning a roll into a catch. Hand fishing, crew, offline
// catch-up, and debug tools all use these so they agree on odds and values.
import { LOOT, SIZE } from '../config/balance';
import { ECONOMY } from '../config/balance';
import { rollCatch, type LootFish, type RarityBoosts } from '../systems/lootTable';
import { rarityBoostStat } from '../config/stats';
import { sellValue } from '../systems/economy';
import type { FishDef, RarityDef } from './content/schemas';
import type { GameContext } from './context';
import type { Rng } from './rng';
import type { CatchResult } from './types';
import { debugOverrides } from './debugOverrides';

export function lootRarities(ctx: GameContext): RarityDef[] {
  return ctx.registries.rarities.list();
}

export function lootFish(ctx: GameContext): (LootFish & FishDef)[] {
  return ctx.registries.fish.list();
}

export function rollSize(fish: FishDef, rng: Rng): number {
  const [min, max] = fish.size ?? SIZE.defaultRange;
  const f = Math.pow(10, SIZE.decimals);
  return Math.round((min + rng() * (max - min)) * f) / f;
}

/** Coins a fish sells for with the given multiplier. */
export function fishValue(ctx: GameContext, fishId: string, mult: number): number {
  const fish = ctx.registries.fish.get(fishId);
  return sellValue(fish.baseValue, mult);
}

export interface MakeCatchOptions {
  waterId: string;
  luck: number;
  /** Total sell multiplier for this catch. */
  valueMult: number;
  /** Pity counter; omit for crew and offline rolls. */
  pity?: number;
  /** Lure bonuses per rarity (hand fishing). */
  boosts?: RarityBoosts;
  /** Bait: fish come out this much bigger and sell for this much more. */
  sizeMult?: number;
  rng?: Rng;
}

/** Lure bonuses from the boost_<rarity> stats. */
export function rarityBoosts(ctx: GameContext): Record<string, number> {
  const out: Record<string, number> = {};
  for (const r of ctx.registries.rarities.list()) {
    const id = rarityBoostStat(r.id);
    if (ctx.stats.has(id)) out[r.id] = ctx.stats.get(id);
  }
  return out;
}

export function makeCatch(ctx: GameContext, o: MakeCatchOptions): { result: CatchResult; pity: number | undefined } | null {
  const rng = o.rng ?? ctx.rng;
  const conditions = ctx.world.conditions(o.waterId);
  const forced = o.pity !== undefined ? debugOverrides.forceRarity : null;
  const roll = rollCatch({
    rarities: lootRarities(ctx).filter((r) => !forced || r.id === forced),
    fish: lootFish(ctx),
    conditions,
    luck: o.luck,
    rng,
    cfg: LOOT,
    pity: o.pity,
    boosts: o.boosts,
  });
  if (!roll) return null;
  const sizeMult = o.sizeMult ?? 1;
  const f = Math.pow(10, SIZE.decimals);
  const result: CatchResult = {
    fishId: roll.fish.id,
    rarityId: roll.rarityId,
    size: Math.round(rollSize(roll.fish, rng) * sizeMult * f) / f,
    value: sellValue(roll.fish.baseValue, o.valueMult * sizeMult),
    currency: ECONOMY.defaultCurrency,
    waterId: o.waterId,
    phase: conditions.phase,
    weather: conditions.weather,
    pityTriggered: roll.pityTriggered,
    at: ctx.clock.now(),
    flags: {},
  };
  return { result, pity: roll.pity };
}
