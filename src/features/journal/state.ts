// Journal save slice: one entry per fish ever caught.
import type { SaveSliceDef } from '../../core/feature';

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
}

export const journalSlice: SaveSliceDef<JournalSlice> = {
  key: 'journal',
  version: 1,
  defaults: () => ({ entries: {} }),
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
