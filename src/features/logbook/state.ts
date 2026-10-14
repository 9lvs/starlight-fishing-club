// Logbook save slice, the task schema, and the pure rules for progress.
// Tasks belong to a water: the ones shown are for the club's home water.
import { z } from 'zod';
import type { SaveSliceDef } from '../../core/feature';
import { hashString, seededRng } from '../../core/rng';

/** Today's three daily tasks and how far along they are. A new day starts them over. */
export interface DailyState {
  day: string;
  ids: string[];
  progress: Record<string, number>;
  species: Record<string, string[]>;
  done: string[];
  claimed: string[];
}

export const emptyDaily = (): DailyState => ({ day: '', ids: [], progress: {}, species: {}, done: [], claimed: [] });

export interface LogbookSlice {
  /** Progress counts by task id. */
  progress: Record<string, number>;
  /** Fish ids already counted, for "different fish" tasks. */
  species: Record<string, string[]>;
  /** Finished, and finished-and-paid, task ids. Kept when the club moves. */
  done: string[];
  claimed: string[];
  daily: DailyState;
}

/** v2 adds the daily tasks. */
export const logbookSlice: SaveSliceDef<LogbookSlice> = {
  key: 'logbook',
  version: 2,
  defaults: () => ({ progress: {}, species: {}, done: [], claimed: [], daily: emptyDaily() }),
  migrate: (old) => ({ ...(old as LogbookSlice), daily: emptyDaily() }),
};

const id = z.string().regex(/^[a-z0-9_]+$/);

/** Tasks live in content: src/content/<pack>/tasks.json. */
export const taskSchema = z.object({
  id,
  /** The club's home water this task belongs to. */
  water: id,
  text: z.string().min(1).max(48),
  kind: z.enum(['catch', 'species', 'keep', 'set', 'clean', 'buy', 'hire', 'move']),
  count: z.number().int().min(1).default(1),
  /** catch and clean: lowest rarity tier that counts. */
  minTier: z.number().int().min(0).default(0),
  /** catch: only in this weather (any but clear with "any_weather") or time of day. */
  weather: z.string().optional(),
  phase: z.string().optional(),
  /** set: smallest set size that counts. */
  setSize: z.number().int().min(1).optional(),
  /** buy: this upgrade. move: the water the club moves to. */
  target: id.optional(),
  reward: z.object({ currency: id, amount: z.number().int().min(1) }),
  order: z.number().int().default(0),
});
export type TaskDef = z.infer<typeof taskSchema>;

/** Daily task templates: src/content/<pack>/dailies.json. Coins scale with the club's water. */
export const dailySchema = z.object({
  id,
  text: z.string().min(1).max(48),
  kind: z.enum(['catch', 'species', 'keep', 'set', 'clean']),
  count: z.number().int().min(1).default(1),
  minTier: z.number().int().min(0).default(0),
  weather: z.string().optional(),
  phase: z.string().optional(),
  setSize: z.number().int().min(1).optional(),
  /** Only offered once the club has reached this rank (some need rarer fish). */
  minRank: z.number().int().min(0).default(0),
  /** Reward size next to the other dailies (1 = usual). */
  share: z.number().positive().default(1),
  /** How often it comes up. */
  weight: z.number().positive().default(1),
});
export type DailyDef = z.infer<typeof dailySchema>;

/** What counting progress needs from a task (regular or daily). */
export type TaskRule = Pick<TaskDef, 'id' | 'count' | 'minTier' | 'weather' | 'phase' | 'setSize'> & { kind: TaskDef['kind']; target?: string };

/**
 * The same three dailies for everyone on a given day: a weighted draw seeded
 * by the date, at most one of each kind while the pool allows it.
 */
export function pickDailies(day: string, pool: readonly DailyDef[], count: number): string[] {
  const rng = seededRng(hashString(day));
  const left = [...pool].sort((a, b) => a.id.localeCompare(b.id));
  const picked: DailyDef[] = [];
  while (picked.length < count && left.length > 0) {
    const kinds = new Set(picked.map((p) => p.kind));
    const fresh = left.filter((d) => !kinds.has(d.kind));
    const from = fresh.length > 0 ? fresh : left;
    const total = from.reduce((s, d) => s + d.weight, 0);
    let roll = rng() * total;
    const choice = from.find((d) => (roll -= d.weight) < 0) ?? from[from.length - 1]!;
    picked.push(choice);
    left.splice(left.indexOf(choice), 1);
  }
  return picked.map((d) => d.id);
}

/** Something that happened in the game, as the logbook sees it. */
export type LogEvent =
  | { kind: 'catch'; fishId: string; tier: number; weather: string; phase: string }
  | { kind: 'keep' }
  | { kind: 'set'; size: number }
  | { kind: 'clean'; tier: number }
  | { kind: 'buy'; upgradeId: string }
  | { kind: 'hire' }
  | { kind: 'move'; waterId: string };

/** How much one event adds to a task (0 if it does not count). */
export function counts(t: TaskRule, e: LogEvent): number {
  switch (t.kind) {
    case 'catch':
      if (e.kind !== 'catch' || e.tier < t.minTier) return 0;
      if (t.weather === 'any_weather' ? e.weather === 'clear' : t.weather && e.weather !== t.weather) return 0;
      if (t.phase && e.phase !== t.phase) return 0;
      return 1;
    case 'species':
      return e.kind === 'catch' ? 1 : 0;
    case 'keep':
      return e.kind === 'keep' ? 1 : 0;
    case 'set':
      return e.kind === 'set' && e.size >= (t.setSize ?? 3) ? 1 : 0;
    case 'clean':
      return e.kind === 'clean' && e.tier >= t.minTier ? 1 : 0;
    case 'buy':
      return e.kind === 'buy' && e.upgradeId === t.target ? 1 : 0;
    case 'hire':
      return e.kind === 'hire' ? 1 : 0;
    case 'move':
      return e.kind === 'move' && e.waterId === t.target ? 1 : 0;
  }
}

/**
 * Apply an event to the open tasks. Returns the ids that just finished.
 * "Different fish" tasks only count a fish the first time.
 */
export function record(slice: Pick<LogbookSlice, 'progress' | 'species' | 'done'>, tasks: readonly TaskRule[], e: LogEvent): string[] {
  const finished: string[] = [];
  for (const t of tasks) {
    if (slice.done.includes(t.id)) continue;
    let add = counts(t, e);
    if (add > 0 && t.kind === 'species' && e.kind === 'catch') {
      const seen = (slice.species[t.id] ??= []);
      if (seen.includes(e.fishId)) add = 0;
      else seen.push(e.fishId);
    }
    if (add === 0) continue;
    slice.progress[t.id] = Math.min(t.count, (slice.progress[t.id] ?? 0) + add);
    if (slice.progress[t.id]! >= t.count) {
      slice.done.push(t.id);
      finished.push(t.id);
    }
  }
  return finished;
}
