// Pure rules for cloud saves: a small summary of a save to show and compare,
// and what to do when this device and the cloud may disagree. The game never
// overwrites progress on its own when both sides changed: it asks.
import { checksum, type SaveRoot } from '../../systems/saveManager';

export interface SaveSummary {
  /** Hash of everything that matters (not the save time), to spot changes. */
  hash: string;
  waterId: string;
  rank: number;
  species: number;
  catches: number;
  coins: number;
  savedAt: number;
}

/** What this device last agreed with the cloud, per account. */
export interface SyncMarker {
  userId: string;
  hash: string;
}

export type SyncAction = 'upload' | 'download' | 'ask' | 'none';

const obj = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' ? (v as Record<string, unknown>) : {});
const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0);

export function summarize(root: SaveRoot): SaveSummary {
  const s = root.slices;
  const world = obj(s.world?.data);
  const journal = obj(s.journal?.data);
  const fishing = obj(s.fishing?.data);
  const wallet = obj(s.wallet?.data);
  return {
    hash: checksum(JSON.stringify(s)),
    waterId: typeof world.waterId === 'string' ? world.waterId : '',
    rank: num(world.clubRank),
    species: Object.keys(obj(journal.entries)).length,
    catches: num(obj(fishing.totals).catches),
    coins: Math.floor(num(obj(wallet.balances).coins)),
    savedAt: root.savedAt,
  };
}

/** A brand new save: nothing caught and the club never moved. */
export function isFresh(s: SaveSummary): boolean {
  return s.species === 0 && s.catches === 0 && s.rank === 0;
}

/**
 * - No cloud save yet: upload this one.
 * - Same save on both sides: nothing to do.
 * - First sign-in on this device: a fresh device takes the cloud save; a device
 *   with its own progress asks which to keep.
 * - Otherwise compare both sides with what they last agreed on: whichever side
 *   changed wins, and if both changed, ask.
 */
export function decide(local: SaveSummary, cloud: Pick<SaveSummary, 'hash'> | null, marker: SyncMarker | null, userId: string): SyncAction {
  if (!cloud) return 'upload';
  if (cloud.hash === local.hash) return 'none';
  const agreed = marker && marker.userId === userId ? marker.hash : null;
  if (agreed === null) return isFresh(local) ? 'download' : 'ask';
  const localChanged = local.hash !== agreed;
  const cloudChanged = cloud.hash !== agreed;
  if (localChanged && cloudChanged) return 'ask';
  if (cloudChanged) return 'download';
  return localChanged ? 'upload' : 'none';
}
