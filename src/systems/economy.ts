// Pure economy math and the wallet that holds every registered currency.
import { ECONOMY } from '../config/balance';

/** Cost of buying the next level when `level` levels are already owned. */
export function costAt(baseCost: number, costGrowth: number, level: number): number {
  return Math.round(baseCost * Math.pow(costGrowth, level));
}

export function sellValue(baseValue: number, mult: number): number {
  return Math.max(ECONOMY.minSellValue, Math.round(baseValue * mult));
}

/** Extra share paid when several kept fish are sold together (0.25 = +25%). */
export function bundleBonus(count: number, perFish: number, max: number): number {
  return Math.max(0, Math.min(max, (count - 1) * perFish));
}

export interface SetRule {
  /** Fish of one rarity needed for this set. */
  size: number;
  /** Extra share of those fish's value. */
  share: number;
}

export interface SetGroup {
  /** Rarity id. */
  id: string;
  count: number;
  /** Total value of the fish in this group. */
  value: number;
  /** The rarity's own multiplier on set bonuses (rarer sets pay more). */
  mult: number;
}

export interface SetResult {
  id: string;
  size: number;
  share: number;
  bonus: number;
}

/**
 * Matching sets: each rarity with at least the smallest set size earns its
 * biggest set (only the sizes listed, e.g. 3, 5, and 10). Sets of different
 * rarities stack. A group above the biggest size still counts as that size.
 */
export function matchingSets(groups: readonly SetGroup[], rules: readonly SetRule[]): SetResult[] {
  const sorted = [...rules].sort((a, b) => b.size - a.size);
  const out: SetResult[] = [];
  for (const g of groups) {
    const rule = sorted.find((r) => g.count >= r.size);
    if (!rule) continue;
    const share = rule.share * g.mult;
    out.push({ id: g.id, size: rule.size, share, bonus: Math.round(g.value * share) });
  }
  return out;
}

export type Balances = Record<string, number>;

export class Wallet {
  constructor(
    private balances: Balances,
    private readonly known: () => readonly string[],
    private readonly onChange: (currency: string, amount: number, delta: number) => void = () => {},
  ) {}

  get(currency: string): number {
    return this.balances[currency] ?? 0;
  }

  canAfford(currency: string, amount: number): boolean {
    return this.get(currency) >= amount;
  }

  add(currency: string, amount: number): void {
    this.assertKnown(currency);
    if (amount === 0) return;
    const next = Math.max(0, this.get(currency) + amount);
    const delta = next - this.get(currency);
    this.balances[currency] = next;
    this.onChange(currency, next, delta);
  }

  /** Returns false and changes nothing when the player cannot afford it. */
  spend(currency: string, amount: number): boolean {
    this.assertKnown(currency);
    if (amount < 0 || !this.canAfford(currency, amount)) return false;
    this.add(currency, -amount);
    return true;
  }

  snapshot(): Balances {
    return { ...this.balances };
  }

  private assertKnown(currency: string): void {
    if (!this.known().includes(currency)) throw new Error(`Unknown currency "${currency}"`);
  }
}
