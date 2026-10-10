// Pure upgrade rules: costs, prerequisites, node state, tree layout.
import { ECONOMY } from '../../config/balance';
import type { UpgradeDef } from '../../core/content/schemas';
import { costAt } from '../../systems/economy';

export type Levels = Record<string, number>;
export type NodeState = 'locked' | 'available' | 'affordable' | 'owned' | 'maxed';

export function levelOf(levels: Levels, id: string): number {
  return levels[id] ?? 0;
}

export function nextCost(u: UpgradeDef, level: number): number {
  return costAt(u.baseCost, u.costGrowth ?? ECONOMY.defaultCostGrowth, level);
}

export function currencyOf(u: UpgradeDef): string {
  return u.currency ?? ECONOMY.defaultCurrency;
}

export function prereqList(u: UpgradeDef): { id: string; level: number }[] {
  return u.prerequisites.map((p) => (typeof p === 'string' ? { id: p, level: 1 } : p));
}

export function missingPrereqs(u: UpgradeDef, levels: Levels): { id: string; level: number }[] {
  return prereqList(u).filter((p) => levelOf(levels, p.id) < p.level);
}

/** Upgrades held back until the club reaches a bigger water. */
export function rankLocked(u: UpgradeDef, clubRank: number): boolean {
  return clubRank < u.requiresRank;
}

export function nodeState(u: UpgradeDef, levels: Levels, balance: (currency: string) => number, clubRank = 0): NodeState {
  const level = levelOf(levels, u.id);
  if (level >= u.maxLevel) return 'maxed';
  if (missingPrereqs(u, levels).length > 0 || rankLocked(u, clubRank)) return 'locked';
  if (balance(currencyOf(u)) >= nextCost(u, level)) return 'affordable';
  return level > 0 ? 'owned' : 'available';
}

export interface TreeSlot {
  id: string;
  row: number;
  col: number;
}

/**
 * Lay out one branch. Nodes with a `position` use it; others go in the row of
 * their prerequisite depth inside the branch, in data order.
 */
export function layoutBranch(upgrades: readonly UpgradeDef[]): TreeSlot[] {
  const inBranch = new Map(upgrades.map((u) => [u.id, u]));
  const depthCache = new Map<string, number>();
  const depth = (u: UpgradeDef, seen = new Set<string>()): number => {
    const cached = depthCache.get(u.id);
    if (cached !== undefined) return cached;
    if (seen.has(u.id)) return 0;
    seen.add(u.id);
    let d = 0;
    for (const p of prereqList(u)) {
      const parent = inBranch.get(p.id);
      if (parent) d = Math.max(d, depth(parent, seen) + 1);
    }
    depthCache.set(u.id, d);
    return d;
  };
  const rows = new Map<number, number>();
  return upgrades.map((u) => {
    if (u.position) return { id: u.id, row: u.position.row, col: u.position.col };
    const row = depth(u);
    const col = rows.get(row) ?? 0;
    rows.set(row, col + 1);
    return { id: u.id, row, col };
  });
}
