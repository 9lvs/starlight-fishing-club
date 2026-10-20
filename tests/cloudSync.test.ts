// Cloud saves: a summary to compare saves, and the rule for which way to sync.
// Progress is never overwritten on its own when both sides changed.
import { describe, expect, it } from 'vitest';
import { decide, isFresh, summarize, type SaveSummary } from '../src/features/cloud/sync';
import type { SaveRoot } from '../src/systems/saveManager';

const root = (catches: number, species: string[], rank = 0, savedAt = 1): SaveRoot => ({
  version: 1,
  createdAt: 0,
  savedAt,
  slices: {
    world: { v: 3, data: { waterId: 'pond', clubRank: rank, knownUnlocked: ['pond'] } },
    fishing: { v: 4, data: { totals: { casts: catches, catches, misses: 0 } } },
    journal: { v: 2, data: { entries: Object.fromEntries(species.map((s) => [s, { count: 1 }])) } },
    wallet: { v: 1, data: { balances: { coins: 12.7 } } },
  },
});

describe('save summary', () => {
  it('reads progress from the slices and ignores the save time in its hash', () => {
    const a = summarize(root(5, ['a', 'b'], 1, 100));
    expect(a).toMatchObject({ waterId: 'pond', rank: 1, species: 2, catches: 5, coins: 12 });
    expect(summarize(root(5, ['a', 'b'], 1, 999)).hash).toBe(a.hash);
    expect(summarize(root(6, ['a', 'b'], 1, 100)).hash).not.toBe(a.hash);
    expect(isFresh(summarize(root(0, [])))).toBe(true);
    expect(isFresh(a)).toBe(false);
  });

  it('copes with a save missing slices', () => {
    const s = summarize({ version: 1, createdAt: 0, savedAt: 0, slices: {} });
    expect(isFresh(s)).toBe(true);
  });
});

describe('which way to sync', () => {
  const played = summarize(root(10, ['a']));
  const other = summarize(root(30, ['a', 'b', 'c']));
  const fresh = summarize(root(0, []));
  const me = 'user-1';

  it('uploads when the cloud is empty, and does nothing when both match', () => {
    expect(decide(played, null, null, me)).toBe('upload');
    expect(decide(played, { hash: played.hash }, null, me)).toBe('none');
  });

  it('a new device takes the cloud save; a device with its own progress asks first', () => {
    expect(decide(fresh, other, null, me)).toBe('download');
    expect(decide(played, other, null, me)).toBe('ask');
    // A marker from someone else's account on this device counts as no marker.
    expect(decide(played, other, { userId: 'user-2', hash: played.hash }, me)).toBe('ask');
  });

  it('whichever side changed since they last agreed wins; both changed asks', () => {
    const agreed = { userId: me, hash: played.hash };
    expect(decide(played, other, agreed, me)).toBe('download');
    expect(decide(other, played, agreed, me)).toBe('upload');
    expect(decide(other, fresh, agreed, me)).toBe('ask');
  });
});

describe('fresh saves', () => {
  it('a summary with progress in any of rank, species, or catches is not fresh', () => {
    const base: SaveSummary = { hash: '', waterId: '', rank: 0, species: 0, catches: 0, coins: 0, savedAt: 0 };
    expect(isFresh({ ...base, rank: 1 })).toBe(false);
    expect(isFresh({ ...base, catches: 1 })).toBe(false);
  });
});
