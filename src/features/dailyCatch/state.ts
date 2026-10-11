// Daily Catch save slice and the pure rules: which fish is today's, and the
// spoiler-free share grid. Nothing here is lost by skipping a day.
import type { SaveSliceDef } from '../../core/feature';
import { hashString } from '../../core/rng';

export interface DailyCatchSlice {
  /** The day the attempts below belong to (YYYY-MM-DD). */
  day: string;
  /** Hand casts at the daily water today: a rarity tier, or -1 for a missed bite. */
  tries: number[];
  /** Set once today's fish is caught. */
  caught: { casts: number; size: number } | null;
  /** Days the daily fish was caught, ever. Only ever goes up. */
  daysCaught: number;
}

export const dailyCatchSlice: SaveSliceDef<DailyCatchSlice> = {
  key: 'dailyCatch',
  version: 1,
  defaults: () => ({ day: '', tries: [], caught: null, daysCaught: 0 }),
};

export interface DailyCandidate {
  id: string;
  rarityTier: number;
  waters: readonly string[];
  weather: readonly string[];
}

/** Fish that can be today's: in the water, in the allowed tiers, and not tied to weather. */
export function candidates<F extends DailyCandidate>(fish: readonly F[], waterId: string, tiers: readonly number[]): F[] {
  return fish
    .filter((f) => f.waters.includes(waterId) && tiers.includes(f.rarityTier) && f.weather.length === 0)
    .sort((a, b) => a.id.localeCompare(b.id));
}

/** Same day, same fish, for everyone. */
export function dailyFishId(day: string, pool: readonly { id: string }[]): string | null {
  if (pool.length === 0) return null;
  return pool[hashString(`daily:${day}`) % pool.length]!.id;
}

export interface GridStyle {
  tierEmoji: readonly string[];
  missEmoji: string;
  targetEmoji: string;
  gridRow: number;
}

/** Wordle-style rows of squares: one per cast, the daily fish last. */
export function shareGrid(tries: readonly number[], caught: boolean, style: GridStyle): string {
  const cells = tries.map((t) => (t < 0 ? style.missEmoji : (style.tierEmoji[t] ?? style.tierEmoji[0]!)));
  if (caught && cells.length > 0) cells[cells.length - 1] = style.targetEmoji;
  const rows: string[] = [];
  for (let i = 0; i < cells.length; i += style.gridRow) rows.push(cells.slice(i, i + style.gridRow).join(''));
  return rows.join('\n');
}
