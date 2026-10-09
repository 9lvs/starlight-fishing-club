// Offline crew simulation with math instead of a tick loop. Time is split into
// segments of constant time-of-day and weather; each crew member's roll count per
// segment is computed directly, then multiplied by exact per-fish chances.
// Expected counts are rounded with the largest remainder method so the integer
// catches always add up to the number of rolls.
import { fishChances, type LootConfig, type LootFish, type LootRarity } from './lootTable';
import { segmentsBetween, type TimeConfig, type WeatherConfig, type WeightedWeather } from './timeOfDay';
import { sellValue } from './economy';

export interface CrewSimMember {
  id: string;
  waterId: string;
  intervalMs: number;
  /** Time already accumulated toward the next roll. */
  progressMs: number;
  luck: number;
  valueMult: number;
}

export interface SimFish extends LootFish {
  baseValue: number;
}

export interface OfflineSimInput {
  startMs: number;
  elapsedMs: number;
  crew: readonly CrewSimMember[];
  time: TimeConfig;
  weatherList: readonly WeightedWeather[];
  weatherCfg: WeatherConfig;
  rarities: readonly LootRarity[];
  fish: readonly SimFish[];
  lootCfg: Pick<LootConfig, 'luckWeightPerPoint'>;
  /** sellValueMult x crewSellMult, applied to every crew catch. */
  valueMult: number;
}

export interface CrewSimResult {
  id: string;
  rolls: number;
  coins: number;
  catches: Record<string, number>;
  progressMs: number;
}

export interface OfflineSimResult {
  rolls: number;
  coins: number;
  catches: Record<string, number>;
  perCrew: CrewSimResult[];
}

/** Number of k >= 0 with a <= first + k * interval < b. */
export function rollsInWindow(first: number, interval: number, a: number, b: number): number {
  if (b <= a) return 0;
  const kMin = Math.max(0, Math.ceil((a - first) / interval));
  const kMax = Math.ceil((b - first) / interval) - 1;
  return Math.max(0, kMax - kMin + 1);
}

/** Round expected counts to integers that sum to `total`. Ties break by id for determinism. */
export function largestRemainder(expected: Map<string, number>, total: number): Record<string, number> {
  const entries = [...expected.entries()].map(([id, e]) => ({ id, base: Math.floor(e), frac: e - Math.floor(e) }));
  let assigned = entries.reduce((s, e) => s + e.base, 0);
  entries.sort((a, b) => b.frac - a.frac || a.id.localeCompare(b.id));
  for (let i = 0; assigned < total && entries.length > 0; i = (i + 1) % entries.length) {
    entries[i]!.base += 1;
    assigned += 1;
  }
  const out: Record<string, number> = {};
  for (const e of entries) if (e.base > 0) out[e.id] = e.base;
  return out;
}

export function simulateOffline(input: OfflineSimInput): OfflineSimResult {
  const end = input.startMs + input.elapsedMs;
  const segments = segmentsBetween(input.startMs, end, input.time, input.weatherList, input.weatherCfg);
  const fishById = new Map(input.fish.map((f) => [f.id, f]));
  const chanceCache = new Map<string, Map<string, number>>();

  const perCrew: CrewSimResult[] = input.crew.map((member) => {
    const interval = Math.max(1, member.intervalMs);
    const first = input.startMs + (interval - Math.min(member.progressMs, interval));
    const expected = new Map<string, number>();
    let rolls = 0;
    for (const seg of segments) {
      const n = rollsInWindow(first, interval, seg.start, seg.end);
      if (n === 0) continue;
      rolls += n;
      const key = `${member.waterId}|${seg.phase}|${seg.weather}|${member.luck}`;
      let chances = chanceCache.get(key);
      if (!chances) {
        chances = fishChances(
          input.rarities,
          input.fish,
          { waterId: member.waterId, phase: seg.phase, weather: seg.weather },
          member.luck,
          input.lootCfg,
        );
        chanceCache.set(key, chances);
      }
      for (const [fishId, p] of chances) expected.set(fishId, (expected.get(fishId) ?? 0) + n * p);
    }
    const catches = largestRemainder(expected, rolls);
    let coins = 0;
    for (const [fishId, count] of Object.entries(catches)) {
      const f = fishById.get(fishId);
      if (f) coins += count * sellValue(f.baseValue, input.valueMult * member.valueMult);
    }
    // Whatever time was not spent on counted rolls carries over to the live tick.
    const progressMs = Math.min(member.progressMs, interval) + input.elapsedMs - rolls * interval;
    return { id: member.id, rolls, coins, catches, progressMs };
  });

  const catches: Record<string, number> = {};
  for (const c of perCrew) for (const [id, n] of Object.entries(c.catches)) catches[id] = (catches[id] ?? 0) + n;
  return {
    rolls: perCrew.reduce((s, c) => s + c.rolls, 0),
    coins: perCrew.reduce((s, c) => s + c.coins, 0),
    catches,
    perCrew,
  };
}
