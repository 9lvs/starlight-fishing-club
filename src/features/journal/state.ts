// Journal save slice: one entry per fish ever caught, and the bottles found.
import type { SaveSliceDef } from '../../core/feature';
import { emptyBottles, type BottlesState } from './bottlesState';

export interface JournalEntry {
  count: number;
  bestSize: number;
  firstCaught: number;
  lastCaught: number;
  /** Times landed with a clean fight (every dip tapped). Rare fish and up. */
  clean?: number;
}

export interface JournalSlice {
  entries: Record<string, JournalEntry>;
  bottles: BottlesState;
}

/** v2 adds message bottles. */
export const journalSlice: SaveSliceDef<JournalSlice> = {
  key: 'journal',
  version: 2,
  defaults: () => ({ entries: {}, bottles: emptyBottles() }),
  migrate: (old, from) => {
    const o = (old ?? {}) as Partial<JournalSlice>;
    const entries = o.entries ?? {};
    return from < 2 ? { entries, bottles: emptyBottles() } : { entries, bottles: o.bottles ?? emptyBottles() };
  },
};

/** Pure: record a catch. Returns true when it is the first of its kind. */
export function recordCatch(slice: JournalSlice, fishId: string, size: number, at: number): boolean {
  const e = slice.entries[fishId];
  if (!e) {
    slice.entries[fishId] = { count: 1, bestSize: size, firstCaught: at, lastCaught: at };
    return true;
  }
  e.count += 1;
  e.bestSize = Math.max(e.bestSize, size);
  e.lastCaught = at;
  return false;
}

export function completion(slice: JournalSlice, allFishIds: readonly string[]): number {
  if (allFishIds.length === 0) return 0;
  const caught = allFishIds.filter((id) => slice.entries[id]).length;
  return caught / allFishIds.length;
}
