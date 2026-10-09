// Daily gift save slice and the pure rules. There is no streak: missing a day
// never takes anything away.
import { z } from 'zod';
import type { SaveSliceDef } from '../../core/feature';

export interface DailyGiftSlice {
  /** Local calendar day of the last claim, as YYYY-MM-DD. */
  lastClaimDay: string | null;
  totalClaims: number;
}

export const dailyGiftSlice: SaveSliceDef<DailyGiftSlice> = {
  key: 'dailyGift',
  version: 1,
  defaults: () => ({ lastClaimDay: null, totalClaims: 0 }),
};

/** Gift notes live in content: src/content/<pack>/gifts.json. */
export const giftNoteSchema = z.object({
  id: z.string().regex(/^[a-z0-9_]+$/),
  text: z.string().min(1).max(80),
});
export type GiftNote = z.infer<typeof giftNoteSchema>;

export function dayKey(ms: number): string {
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function canClaim(slice: DailyGiftSlice, nowMs: number): boolean {
  return slice.lastClaimDay !== dayKey(nowMs);
}
