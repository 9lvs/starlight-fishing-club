// Every named stat and its base value. Upgrades, bait, decorations, and features
// change these only through modifiers (see src/core/stats.ts).
import type { StatDef } from '../core/stats';
import { FISHING } from './tuning';

export const CORE_STATS: StatDef[] = [
  { id: 'biteWindowMs', base: 1200, min: 400, max: 4000, label: 'Bite window', format: 'ms' },
  { id: 'castSpeed', base: 1, min: 0.25, max: 4, label: 'Cast speed', format: 'mult' },
  { id: 'waitMinMs', base: FISHING.waitMinMs, min: 500, label: 'Shortest wait', format: 'ms' },
  { id: 'waitMaxMs', base: FISHING.waitMaxMs, min: 1000, label: 'Longest wait', format: 'ms' },
  { id: 'luck', base: 0, min: 0, label: 'Luck', format: 'int' },
  { id: 'sellValueMult', base: 1, min: 0, label: 'Sell value', format: 'mult' },
  { id: 'storageCap', base: 6, min: 1, integer: true, label: 'Creel space', format: 'int' },
  { id: 'boatRange', base: 0, min: 0, integer: true, label: 'Boat range', format: 'int' },
  { id: 'crewSlots', base: 0, min: 0, integer: true, label: 'Crew slots', format: 'int' },
  /** Bunks on your boat: you can hire as many crew as you have both slots and bunks. */
  { id: 'crewBunks', base: 0, min: 0, integer: true, label: 'Boat bunks', format: 'int' },
  /** Slow on purpose (was 12 s, now 30 s): crew are a gentle helper, not the main income. */
  { id: 'crewIntervalMs', base: 30000, min: 4000, label: 'Crew catch time', format: 'ms' },
  { id: 'crewSellMult', base: 0.5, min: 0, max: 1, label: 'Crew sell value', format: 'mult' },
  { id: 'crewLuck', base: 0, min: 0, label: 'Crew luck', format: 'int' },
  { id: 'offlineCapHours', base: 8, min: 0, max: 24, label: 'Offline cap', format: 'hours' },
  /** Most fish the crew bring back from one stretch away (Cozy Hammock raises it). Kept low so away time is a treat, not the income. */
  { id: 'awayCatchCap', base: 4, min: 0, integer: true, label: 'Fish brought back', format: 'int' },
  /** Below 1 means kept fish are ready for market sooner (Ice Chest). */
  { id: 'prepTimeMult', base: 1, min: 0.1, label: 'Creel prep time', format: 'percent' },
  /** Chance a hand catch also brings up a gem, before the rarity bonus (see GEMS in tuning). */
  { id: 'gemChance', base: 0, min: 0, max: 1, label: 'Gem chance', format: 'percent' },
  /** Rods, boats, and bait: how well you can land rarer fish (see systems/catchOdds.ts). */
  { id: 'tackle', base: 0, min: 0, label: 'Tackle', format: 'int' },
  /** Below 1 means fewer fish slip the hook (Sharp Hooks). */
  { id: 'escapeMult', base: 1, min: 0.1, label: 'Slip chance', format: 'percent' },
  /** Widens the quick-catch bonus window (Smooth Reel). */
  { id: 'quickWindow', base: 1, min: 0.5, label: 'Quick-catch window', format: 'percent' },
  /** Bait: hand-caught fish grow by this factor, and bigger fish sell for more. */
  { id: 'fishSizeMult', base: 1, min: 0.5, label: 'Fish size', format: 'mult' },
];

/** Stat id for a bait that draws out fish of one time of day or weather (0.5 = they bite 50% more). */
export function conditionBoostStat(kind: 'time' | 'weather', id: string): string {
  return `boost_${kind}_${id}`;
}

/** One boost stat per time of day and per weather in content. */
export function conditionBoostStats(phases: readonly { id: string; name: string }[], weather: readonly { id: string; name: string }[]): StatDef[] {
  return [
    ...phases.map((p) => ({ id: conditionBoostStat('time', p.id), base: 0, min: 0, label: `${p.name} fish bites`, format: 'bonus' as const })),
    ...weather.map((w) => ({ id: conditionBoostStat('weather', w.id), base: 0, min: 0, label: `${w.name} fish bites`, format: 'bonus' as const })),
  ];
}

/** Stat id for the lure bonus of one rarity: extra weight moved to that tier. */
export function rarityBoostStat(rarityId: string): string {
  return `boost_${rarityId}`;
}

/**
 * One boost stat per rarity in content, so a new rarity gets its own lure stat
 * with no code change. The lowest tier never gets one (it is where weight comes from).
 */
export function rarityBoostStats(rarities: readonly { id: string; name: string; tier: number }[]): StatDef[] {
  const lowest = Math.min(...rarities.map((r) => r.tier));
  return rarities
    .filter((r) => r.tier > lowest)
    .map((r) => ({ id: rarityBoostStat(r.id), base: 0, min: 0, label: `${r.name} lure`, format: 'number' as const }));
}
