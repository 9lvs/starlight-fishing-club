// Journey simulator: a goal-directed player who fishes by hand from Willow Pond
// to Sky Lake. Each run they save toward the next boat (the boat that reaches the
// next water is what lets the club move), buy anything else that costs under
// SPEND_SHARE of that boat, hire helpers when a bunk opens, and move the club as
// soon as they can. Moving resets coins, upgrades, and crew, and raises the club
// bonus. Cosmetics are skipped (they change nothing here). Used by the pacing test.
import { LOOT } from '../../src/config/balance';
import { CORE_STATS, conditionBoostStats, rarityBoostStat, rarityBoostStats } from '../../src/config/stats';
import { TIME } from '../../src/config/time';
import { CATCH, FISHING } from '../../src/config/tuning';
import { escapeChance, quickBonus } from '../../src/systems/catchOdds';
import type { CoreContent, UpgradeDef } from '../../src/core/content/schemas';
import { seededRng } from '../../src/core/rng';
import { StatsService, modifierAtLevel } from '../../src/core/stats';
import { costAt, sellValue } from '../../src/systems/economy';
import { fishChances, rollCatch } from '../../src/systems/lootTable';

export interface RunResult {
  waterId: string;
  /** Minutes spent at this water before moving on (or until the horizon at the last water). */
  minutes: number;
  /** Minutes into this run when the Sturdy Skiff (boat_3) was bought. */
  boat3Min: number;
  purchases: { min: number; id: string; level: number }[];
}

export interface JourneyResult {
  firstUpgradeMin: number;
  firstCrewMin: number;
  runs: RunResult[];
  /** Minutes from arriving at the last water until the top rod, boat, and bait are owned. */
  finaleMin: number;
  totalMin: number;
}

const REACTION_S = 0.5;
const DISMISS_S = 1.2;
const MISS_RATE = 0.08;
/** Side purchases are made while they cost under this share of the next boat. */
const SPEND_SHARE = 0.35;
/** Stats this model cannot value (it never leaves the tab), so it skips upgrades that only touch them. */
const AWAY_ONLY = new Set(['offlineCapHours', 'freshDecayMult']);
/** The model always fishes on a clear day, so night and weather bait would be wasted here. */
const conditionOnly = (u: UpgradeDef) => u.modifiers.every((m) => m.stat.startsWith('boost_time_') || m.stat.startsWith('boost_weather_'));
const TOP_TIERS = ['rod_10', 'boat_10', 'bait_6'];

export function simulateJourney(content: CoreContent, seed: number, horizonHours = 10): JourneyResult {
  const rng = seededRng(seed);
  const stats = new StatsService();
  [...CORE_STATS, ...rarityBoostStats(content.rarities), ...conditionBoostStats(TIME.phases, content.weather)].forEach((s) => stats.define(s));
  const waters = [...content.waters].filter((w) => !w.comingSoon).sort((a, b) => a.rangeRequired - b.rangeRequired);
  const fishById = new Map(content.fish.map((f) => [f.id, f]));
  const keep = new Set(content.branches.filter((b) => b.keepOnMove).map((b) => b.id));
  const helpers = [...content.crew].sort((a, b) => a.hireCost - b.hireCost);

  let rank = 0;
  let levels: Record<string, number> = {};
  let crew: string[] = [];
  let coins = 0;
  let t = 0;
  let runStart = 0;
  let pity = 0;
  let run: RunResult = { waterId: waters[0]!.id, minutes: 0, boat3Min: Infinity, purchases: [] };
  const res: JourneyResult = { firstUpgradeMin: Infinity, firstCrewMin: Infinity, runs: [], finaleMin: Infinity, totalMin: 0 };

  const lv = (id: string) => levels[id] ?? 0;
  const setClubBonus = () =>
    stats.setSource('club', [{ stat: 'sellValueMult', op: 'mult', value: 1 + waters[rank]!.clubBonus, priority: 10 }]);
  setClubBonus();
  const crewOnly = (u: UpgradeDef) => u.modifiers.every((m) => m.stat.startsWith('crew') && m.stat !== 'crewSlots');
  const open = (u: UpgradeDef) =>
    !keep.has(u.branch) &&
    !u.modifiers.every((m) => AWAY_ONLY.has(m.stat)) &&
    !conditionOnly(u) &&
    !(crewOnly(u) && crew.length === 0) &&
    lv(u.id) < u.maxLevel &&
    rank >= u.requiresRank &&
    u.prerequisites.every((p) => (typeof p === 'string' ? lv(p) >= 1 : lv(p.id) >= p.level));
  const cost = (u: UpgradeDef) => costAt(u.baseCost, u.costGrowth ?? 1.15, lv(u.id));
  const buy = (u: UpgradeDef) => {
    coins -= cost(u);
    levels[u.id] = lv(u.id) + 1;
    stats.setSource(`upgrade:${u.id}`, u.modifiers.map((m) => modifierAtLevel(m, levels[u.id]!)));
    const min = (t - runStart) / 60;
    run.purchases.push({ min: Math.round(min * 10) / 10, id: u.id, level: levels[u.id]! });
    if (u.id === 'boat_3' && run.boat3Min === Infinity) run.boat3Min = min;
    if (res.firstUpgradeMin === Infinity) res.firstUpgradeMin = t / 60;
  };
  const boosts = () => Object.fromEntries(content.rarities.map((r) => [r.id, stats.has(rarityBoostStat(r.id)) ? stats.get(rarityBoostStat(r.id)) : 0]));

  while (t < horizonHours * 3600) {
    const cond = { waterId: waters[rank]!.id, phase: 'day', weather: 'clear' };
    const wait = (stats.get('waitMinMs') + rng() * (stats.get('waitMaxMs') - stats.get('waitMinMs'))) / stats.get('castSpeed');
    let cycle = FISHING.castAnimMs / 1000 + wait / 1000;
    if (rng() < MISS_RATE) {
      cycle += (stats.get('biteWindowMs') + FISHING.missMessageMs) / 1000;
    } else {
      cycle += REACTION_S + FISHING.reelAnimMs / 1000 + DISMISS_S;
      const r = rollCatch({ rarities: content.rarities, fish: content.fish, conditions: cond, luck: stats.get('luck'), rng, cfg: LOOT, pity, boosts: boosts() })!;
      // Rarer fish can slip away, more often without enough tackle.
      const rar = content.rarities.find((x) => x.id === r.rarityId)!;
      const need = rar.tackleNeed + waters[rank]!.tackleNeed * rar.waterNeedShare;
      if (rng() < escapeChance(rar.escape, need, stats.get('tackle'), stats.get('escapeMult'), CATCH.escape)) {
        pity += 1;
      } else {
        pity = r.pity!;
        const value = sellValue(r.fish.baseValue, stats.get('sellValueMult') * stats.get('fishSizeMult'));
        const quick = quickBonus(REACTION_S * 1000, stats.get('biteWindowMs'), CATCH.quick, stats.get('quickWindow'));
        coins += value + (quick ? Math.max(1, Math.round(value * quick.bonus)) : 0);
      }
    }
    crew.forEach((typeId) => {
      const h = helpers.find((x) => x.id === typeId)!;
      const rolls = cycle / ((stats.get('crewIntervalMs') * h.intervalMult) / 1000);
      const chances = fishChances(content.rarities, content.fish, cond, stats.get('crewLuck') + h.luck, LOOT);
      let ev = 0;
      for (const [id, p] of chances) ev += p * sellValue(fishById.get(id)!.baseValue, stats.get('sellValueMult') * stats.get('crewSellMult') * h.valueMult);
      coins += rolls * ev;
    });
    t += cycle;

    for (;;) {
      const candidates = content.upgrades.filter(open);
      const nextBoat = candidates.filter((u) => u.branch === 'boats' && u.id.startsWith('boat_')).sort((a, b) => cost(a) - cost(b))[0];
      const goal = nextBoat ?? candidates.filter((u) => TOP_TIERS.some((id) => u.id.split('_')[0] === id.split('_')[0])).sort((a, b) => cost(a) - cost(b))[0];
      const budget = goal ? cost(goal) * SPEND_SHARE : Infinity;
      if (crew.length < stats.get('crewSlots')) {
        const h = helpers.find((x) => !crew.includes(x.id));
        if (h && coins >= h.hireCost && h.hireCost <= budget) {
          coins -= h.hireCost;
          crew.push(h.id);
          if (res.firstCrewMin === Infinity) res.firstCrewMin = t / 60;
          continue;
        }
      }
      if (goal && coins >= cost(goal)) {
        buy(goal);
        continue;
      }
      const side = candidates.filter((u) => u !== goal && cost(u) <= coins && cost(u) <= budget).sort((a, b) => cost(a) - cost(b))[0];
      if (!side) break;
      buy(side);
    }

    if (rank < waters.length - 1 && stats.get('boatRange') >= waters[rank + 1]!.rangeRequired) {
      run.minutes = (t - runStart) / 60;
      res.runs.push(run);
      rank += 1;
      for (const u of content.upgrades) if (!keep.has(u.branch) && lv(u.id) > 0) stats.setSource(`upgrade:${u.id}`, []);
      levels = Object.fromEntries(Object.entries(levels).filter(([id]) => keep.has(content.upgrades.find((u) => u.id === id)!.branch)));
      crew = [];
      coins = 0;
      runStart = t;
      run = { waterId: waters[rank]!.id, minutes: 0, boat3Min: Infinity, purchases: [] };
      setClubBonus();
    }
    if (rank === waters.length - 1 && res.finaleMin === Infinity && TOP_TIERS.every((id) => lv(id) > 0)) {
      res.finaleMin = (t - runStart) / 60;
      break;
    }
  }
  run.minutes = (t - runStart) / 60;
  res.runs.push(run);
  res.totalMin = t / 60;
  return res;
}

export function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)]!;
}
