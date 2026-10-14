// What an upgrade helps with, worked out from the stats it changes, so every
// upgrade (and any added later in JSON) gets tags without extra data.
import type { UpgradeDef } from '../../core/content/schemas';
import type { PaletteName } from '../../design/tokens';

export interface Focus {
  id: string;
  /** Short name for the card ("Helps: Rarer fish"). */
  name: string;
  color: PaletteName;
  /** Stat ids, or prefixes ending in "_", that count toward this focus. */
  stats: readonly string[];
}

export const FOCUSES: readonly Focus[] = [
  { id: 'speed', name: 'Faster fishing', color: 'sky', stats: ['castSpeed', 'waitMinMs', 'waitMaxMs', 'biteWindowMs', 'quickWindow'] },
  { id: 'coins', name: 'More coins', color: 'gold', stats: ['sellValueMult', 'fishSizeMult', 'dailyGiftCoins'] },
  { id: 'rare', name: 'Rarer fish', color: 'lavender', stats: ['luck', 'tackle', 'escapeMult', 'gemChance', 'boost_'] },
  { id: 'crew', name: 'Crew and away', color: 'sage', stats: ['crewSlots', 'crewBunks', 'crewIntervalMs', 'crewSellMult', 'crewLuck', 'offlineCapHours'] },
  { id: 'creel', name: 'Creel', color: 'coral', stats: ['storageCap', 'freshDecayMult'] },
  { id: 'travel', name: 'Reach new water', color: 'mist', stats: ['boatRange'] },
];

/** Upgrades with no stats (decorations, outfits) are looks only. */
export const LOOKS: Focus = { id: 'looks', name: 'Looks only', color: 'rose', stats: [] };

function matches(f: Focus, stat: string): boolean {
  return f.stats.some((s) => (s.endsWith('_') ? stat.startsWith(s) : stat === s));
}

/** The focuses an upgrade helps, in FOCUSES order. */
export function focusesOf(u: Pick<UpgradeDef, 'modifiers'>): Focus[] {
  if (u.modifiers.length === 0) return [LOOKS];
  return FOCUSES.filter((f) => u.modifiers.some((m) => matches(f, m.stat)));
}
