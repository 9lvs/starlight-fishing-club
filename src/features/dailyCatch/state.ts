// Daily Catch save slice and the pure rules: which fish is today's, the luck of
// your first five catches, and the share text squares. Nothing here is lost by
// skipping a day.
import type { SaveSliceDef } from '../../core/feature';
import { hashString } from '../../core/rng';

export interface FirstCatch {
  /** Rarity tier (0 = common). */
  tier: number;
  /** Was it today's fish? */
  daily: boolean;
}

export interface DailyCatchSlice {
  /** The day everything below belongs to (YYYY-MM-DD). */
  day: string;
  /** Your first hand catches today, anywhere, up to DAILY_CATCH.firstCount. */
  first: FirstCatch[];
  /** Hand casts at the daily water today, until today's fish is caught. */
  pondCasts: number;
  /** Set once today's fish is caught. */
  caught: { casts: number; size: number } | null;
  /** Days the daily fish was caught, ever. Only ever goes up. */
  daysCaught: number;
}

export const dailyCatchSlice: SaveSliceDef<DailyCatchSlice> = {
  key: 'dailyCatch',
  version: 2,
  defaults: () => ({ day: '', first: [], pondCasts: 0, caught: null, daysCaught: 0 }),
  // v2 shares the first five catches instead of every cast; today starts fresh.
  migrate: (old) => ({ day: '', first: [], pondCasts: 0, caught: null, daysCaught: (old as { daysCaught?: number })?.daysCaught ?? 0 }),
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

/** Sum of (tier + 1) over the first catches: 5 is five commons, 25 is five legends. */
export function luckScore(first: readonly FirstCatch[]): number {
  return first.reduce((s, c) => s + c.tier + 1, 0);
}

export function luckLabel(score: number, labels: readonly { min: number; text: string }[]): string {
  return labels.find((l) => score >= l.min)?.text ?? '';
}

/** One square per catch in rarity colors, today's fish as a hook. */
export function firstFiveSquares(first: readonly FirstCatch[], style: { tierEmoji: readonly string[]; targetEmoji: string }): string {
  return first.map((c) => (c.daily ? style.targetEmoji : (style.tierEmoji[c.tier] ?? style.tierEmoji[0]!))).join('');
}
