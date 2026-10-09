// Pacing simulator: a goal-directed player who fishes by hand, always moves to
// the newest water, saves toward the next milestone (a new water or a crew slot),
// and only buys small upgrades that cost under SMALL_SHARE of that milestone.
// Hires the cheapest helper as soon as a slot opens. Used to check pacing targets.
import { LOOT } from '../../src/config/balance';
import { CORE_STATS } from '../../src/config/stats';
import { FISHING } from '../../src/config/tuning';
import type { CoreContent } from '../../src/core/content/schemas';
import { seededRng } from '../../src/core/rng';
import { StatsService, modifierAtLevel } from '../../src/core/stats';
import { costAt, sellValue } from '../../src/systems/economy';
import { fishChances, rollCatch } from '../../src/systems/lootTable';

export interface PacingResult {
  firstUpgradeMin: number;
  firstWaterMin: number;
  firstCrewMin: number;
  coinsAt30: number;
  purchases: { min: number; id: string; level: number }[];
}

/** Seconds a player takes to react to a bite and to dismiss the catch card. */
const REACTION_S = 0.5;
const DISMISS_S = 1.2;
/** Share of bites the player misses (looking away, etc.). */
const MISS_RATE = 0.08;
/** Small upgrades are bought while they cost less than this share of the current goal. */
const SMALL_SHARE = 0.2;
const MILESTONE_STATS = new Set(['boatRange', 'crewSlots']);

export function simulatePacing(content: CoreContent, seed: number, horizonMin = 45): PacingResult {
  const rng = seededRng(seed);
  const stats = new StatsService();
  CORE_STATS.forEach((s) => stats.define(s));
  const levels: Record<string, number> = {};
  const crew: string[] = []; // water ids
  let coins = 0;
  let t = 0;
  let pity = 0;
  const res: PacingResult = { firstUpgradeMin: Infinity, firstWaterMin: Infinity, firstCrewMin: Infinity, coinsAt30: 0, purchases: [] };
  const lv = (id: string) => levels[id] ?? 0;
  const prereqsMet = (u: CoreContent['upgrades'][number]) =>
    u.prerequisites.every((p) => (typeof p === 'string' ? lv(p) >= 1 : lv(p.id) >= p.level));
  const water = () =>
    [...content.waters]
      .filter((w) => !w.comingSoon && stats.get('boatRange') >= w.rangeRequired)
      .sort((a, b) => b.rangeRequired - a.rangeRequired)[0]!.id;
  const cond = () => ({ waterId: water(), phase: 'day', weather: 'clear' });
  const fishById = new Map(content.fish.map((f) => [f.id, f]));

  while (t < horizonMin * 60) {
    // One hand-fishing cycle.
    const wait = (stats.get('waitMinMs') + rng() * (stats.get('waitMaxMs') - stats.get('waitMinMs'))) / stats.get('castSpeed');
    let cycle = FISHING.castAnimMs / 1000 + wait / 1000;
    if (rng() < MISS_RATE) {
      cycle += (stats.get('biteWindowMs') + FISHING.missMessageMs) / 1000;
    } else {
      cycle += REACTION_S + FISHING.reelAnimMs / 1000 + DISMISS_S;
      const r = rollCatch({ rarities: content.rarities, fish: content.fish, conditions: cond(), luck: stats.get('luck'), rng, cfg: LOOT, pity })!;
      pity = r.pity!;
      coins += sellValue(r.fish.baseValue, stats.get('sellValueMult'));
    }
    // Crew income over the same time, by expected value.
    for (const w of crew) {
      const rolls = cycle / (stats.get('crewIntervalMs') / 1000);
      const chances = fishChances(content.rarities, content.fish, { waterId: w, phase: 'day', weather: 'clear' }, stats.get('crewLuck'), LOOT);
      let ev = 0;
      for (const [id, p] of chances) ev += p * sellValue(fishById.get(id)!.baseValue, stats.get('sellValueMult') * stats.get('crewSellMult'));
      coins += rolls * ev;
    }
    t += cycle;
    if (t >= 30 * 60 && res.coinsAt30 === 0) res.coinsAt30 = Math.round(coins);

    // Spend: hire into open slots first, then the cheapest affordable upgrade.
    for (;;) {
      if (crew.length < stats.get('crewSlots')) {
        const helper = [...content.crew].sort((a, b) => a.hireCost - b.hireCost)[crew.length];
        if (helper && coins >= helper.hireCost) {
          coins -= helper.hireCost;
          crew.push(water());
          if (res.firstCrewMin === Infinity) res.firstCrewMin = t / 60;
          continue;
        }
      }
      const open = content.upgrades
        .filter((u) => lv(u.id) < u.maxLevel && prereqsMet(u))
        .map((u) => ({ u, cost: costAt(u.baseCost, u.costGrowth ?? 1.15, lv(u.id)), milestone: u.modifiers.some((m) => MILESTONE_STATS.has(m.stat)) }))
        .sort((a, b) => a.cost - b.cost);
      const goal = open.find((o) => o.milestone);
      const pick = goal && goal.cost <= coins ? goal : open.find((o) => !o.milestone && o.cost <= coins && (!goal || o.cost <= goal.cost * SMALL_SHARE));
      if (!pick) break;
      coins -= pick.cost;
      levels[pick.u.id] = lv(pick.u.id) + 1;
      stats.setSource(`upgrade:${pick.u.id}`, pick.u.modifiers.map((m) => modifierAtLevel(m, levels[pick.u.id]!)));
      res.purchases.push({ min: Math.round((t / 60) * 10) / 10, id: pick.u.id, level: levels[pick.u.id]! });
      if (res.firstUpgradeMin === Infinity) res.firstUpgradeMin = t / 60;
      if (stats.get('boatRange') >= 1 && res.firstWaterMin === Infinity) res.firstWaterMin = t / 60;
    }
  }
  return res;
}

export function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)]!;
}
