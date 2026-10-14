// What an upgrade helps with, worked out from the stats it changes, so every
// upgrade (and any added later in JSON) gets tags without extra data.
import type { UpgradeDef } from '../core/content/schemas';
import type { PaletteName } from '../design/tokens';

export interface Focus {
  id: string;
  /** Short name for the card ("Helps: Rarer fish"). */
  name: string;
  color: PaletteName;
  /** One line for the How to play page. */
  about: string;
  /** Stat ids, or prefixes ending in "_", that count toward this focus. */
  stats: readonly string[];
}

export const FOCUSES: readonly Focus[] = [
  { id: 'speed', name: 'Faster fishing', color: 'sky', about: 'Bites come sooner, and the bite window is longer.', stats: ['castSpeed', 'waitMinMs', 'waitMaxMs', 'biteWindowMs', 'quickWindow'] },
  { id: 'coins', name: 'More coins', color: 'gold', about: 'Every fish sells for more, and fish grow bigger.', stats: ['sellValueMult', 'fishSizeMult', 'dailyGiftCoins'] },
  { id: 'rare', name: 'Rarer fish', color: 'lavender', about: 'More rare fish bite, and fewer slip the hook.', stats: ['luck', 'tackle', 'escapeMult', 'gemChance', 'boost_'] },
  { id: 'crew', name: 'Crew and away', color: 'sage', about: 'More helpers who fish faster, also while you are away.', stats: ['crewSlots', 'crewBunks', 'crewIntervalMs', 'crewSellMult', 'crewLuck', 'offlineCapHours'] },
  { id: 'creel', name: 'Creel', color: 'coral', about: 'Room for more kept fish, and they are ready for market sooner.', stats: ['storageCap', 'prepTimeMult'] },
  { id: 'travel', name: 'Reach new water', color: 'mist', about: 'A boat that can sail to the next water.', stats: ['boatRange'] },
];

/** Upgrades with no stats (decorations, outfits) are looks only. */
export const LOOKS: Focus = { id: 'looks', name: 'Looks only', color: 'rose', stats: [], about: 'Decorations and outfits, bought with gems. Kept forever.' };

function matches(f: Focus, stat: string): boolean {
  return f.stats.some((s) => (s.endsWith('_') ? stat.startsWith(s) : stat === s));
}

/** The focuses an upgrade helps, in FOCUSES order. */
export function focusesOf(u: Pick<UpgradeDef, 'modifiers'>): Focus[] {
  if (u.modifiers.length === 0) return [LOOKS];
  return FOCUSES.filter((f) => u.modifiers.some((m) => matches(f, m.stat)));
}
