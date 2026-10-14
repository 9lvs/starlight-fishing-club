// Gems: found now and then on a catch (1% for a common fish up to 3% for a
// legendary), by you or your crew, or traded for coins. They buy looks that
// stay with you when the club moves.
import { ECONOMY } from '../../config/balance';
import { GEMS } from '../../config/tuning';
import { clubBonus } from '../../core/club';
import type { GameContext } from '../../core/context';

export class GemService {
  constructor(private readonly ctx: GameContext) {}

  get enabled(): boolean {
    return this.ctx.registries.currencies.has(GEMS.currency);
  }

  /** Chance that a catch of this rarity tier also finds a gem. */
  chance(tier: number): number {
    const bonus = this.ctx.stats.get('gemChance');
    return Math.min(GEMS.max + bonus, GEMS.base + tier * GEMS.perTier + bonus);
  }

  private tierOf(fishId: string): number {
    const r = this.ctx.registries;
    return r.rarities.tryGet(r.fish.tryGet(fishId)?.rarity ?? '')?.tier ?? 0;
  }

  /** Roll for one catch. Returns the gems found (0 or 1). */
  rollCatch(fishId: string): number {
    if (!this.enabled || this.ctx.rng() >= this.chance(this.tierOf(fishId))) return 0;
    this.ctx.wallet.add(GEMS.currency, 1);
    return 1;
  }

  /** Crew catches from time away: each fish gets its own roll. */
  rollBatch(entries: readonly { fishId: string; count: number }[]): number {
    let found = 0;
    for (const e of entries) for (let i = 0; i < e.count; i++) found += this.rollCatch(e.fishId);
    return found;
  }

  /** Coins for one gem right now: it follows what fish pay at the club's water, so gems stay a choice later on. */
  get rate(): number {
    const water = this.ctx.registries.waters.tryGet(this.ctx.world.clubWater());
    const raw = GEMS.tradeCoins * (water?.fishValue ?? 1) * (1 + clubBonus(this.ctx));
    return Math.round(raw / GEMS.tradeRound) * GEMS.tradeRound;
  }

  canTrade(gems: number): boolean {
    return this.enabled && this.ctx.wallet.canAfford(ECONOMY.defaultCurrency, this.rate * gems);
  }

  trade(gems: number): boolean {
    if (!this.canTrade(gems) || !this.ctx.wallet.spend(ECONOMY.defaultCurrency, this.rate * gems)) return false;
    this.ctx.wallet.add(GEMS.currency, gems);
    this.ctx.bus.emit('audio:play', { key: 'gem' });
    return true;
  }
}

let active: GemService | null = null;
export function setGemService(s: GemService): void {
  active = s;
}
export function getGemService(): GemService {
  if (!active) throw new Error('gems feature is not initialised');
  return active;
}
