// Fishing save slice and its migrations.
import type { SaveSliceDef } from '../../core/feature';

export interface CreelItem {
  fishId: string;
  size: number;
  at: number;
  /** Play time spent in the creel, for freshness (time away does not count). */
  ageMs?: number;
  /** Caught by the crew while you were away. */
  crew?: boolean;
}

export interface FishingSlice {
  pity: number;
  creel: CreelItem[];
  totals: { casts: number; catches: number; misses: number };
}

/**
 * v1 (Phase 1 prototype) stored the creel as a list of fish ids.
 * v2 stores size and time per kept fish.
 */
export const fishingSlice: SaveSliceDef<FishingSlice> = {
  key: 'fishing',
  version: 2,
  defaults: () => ({ pity: 0, creel: [], totals: { casts: 0, catches: 0, misses: 0 } }),
  migrate: (old, from) => {
    const o = (old ?? {}) as Record<string, unknown>;
    if (from < 2) {
      const ids = Array.isArray(o.creel) ? (o.creel as unknown[]) : [];
      return {
        pity: typeof o.pity === 'number' ? o.pity : 0,
        creel: ids.filter((id): id is string => typeof id === 'string').map((fishId) => ({ fishId, size: 0, at: 0 })),
        totals: { casts: 0, catches: 0, misses: 0 },
      };
    }
    return o as unknown as FishingSlice;
  },
};
