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
  /** Rested bonus: catches left that pay double, and time away toward the next one. */
  rested: number;
  restedMs: number;
}

/**
 * v1 (Phase 1 prototype) stored the creel as a list of fish ids.
 * v2 stores size and time per kept fish.
 * v3 adds the rested bonus.
 */
export const fishingSlice: SaveSliceDef<FishingSlice> = {
  key: 'fishing',
  version: 3,
  defaults: () => ({ pity: 0, creel: [], totals: { casts: 0, catches: 0, misses: 0 }, rested: 0, restedMs: 0 }),
  migrate: (old, from) => {
    const o = (old ?? {}) as Record<string, unknown>;
    let s = o as unknown as FishingSlice;
    if (from < 2) {
      const ids = Array.isArray(o.creel) ? (o.creel as unknown[]) : [];
      s = {
        pity: typeof o.pity === 'number' ? o.pity : 0,
        creel: ids.filter((id): id is string => typeof id === 'string').map((fishId) => ({ fishId, size: 0, at: 0 })),
        totals: { casts: 0, catches: 0, misses: 0 },
        rested: 0,
        restedMs: 0,
      };
    }
    if (from < 3) s = { ...s, rested: 0, restedMs: 0 };
    return s;
  },
};

/** Add time away to the rested bonus. Returns how many charges it added. */
export function addRest(s: Pick<FishingSlice, 'rested' | 'restedMs'>, ms: number, cfg: { perChargeMs: number; max: number }): number {
  if (s.rested >= cfg.max) {
    s.restedMs = 0;
    return 0;
  }
  const total = s.restedMs + Math.max(0, ms);
  const gained = Math.min(cfg.max - s.rested, Math.floor(total / cfg.perChargeMs));
  s.rested += gained;
  s.restedMs = s.rested >= cfg.max ? 0 : total % cfg.perChargeMs;
  return gained;
}
