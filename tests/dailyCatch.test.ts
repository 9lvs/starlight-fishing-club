// Daily Catch: same fish for everyone on a given day, a fair pool, the share
// grid, the bonus, and a fresh start each day.
import { describe, expect, it } from 'vitest';
import { DAILY_CATCH } from '../src/config/tuning';
import { bootstrap } from '../src/core/bootstrap';
import { parseContent } from '../src/core/content/parseContent';
import type { CatchResult } from '../src/core/types';
import { DailyCatchService } from '../src/features/dailyCatch/service';
import { candidates, dailyFishId, shareGrid } from '../src/features/dailyCatch/state';
import { MemoryStorage } from '../src/systems/saveManager';
import { readContentFiles } from './helpers/content';

function boot() {
  const ctx = bootstrap({ features: [], loadContent: () => parseContent(readContentFiles()), storage: new MemoryStorage(), debug: false }).ctx!;
  const svc = new DailyCatchService(ctx, { day: '', tries: [], caught: null, daysCaught: 0 });
  return { ctx, svc };
}

function catchOf(fishId: string, rarityId: string, waterId = 'pond'): CatchResult {
  return { fishId, rarityId, size: 30, value: 25, currency: 'coins', waterId, phase: 'day', weather: 'clear', pityTriggered: false, at: 0, flags: {} };
}

describe('daily catch rules', () => {
  it('picks the same fish for the same day, and changes across days', () => {
    const pool = [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }, { id: 'e' }];
    expect(dailyFishId('2026-10-11', pool)).toBe(dailyFishId('2026-10-11', [...pool]));
    const days = Array.from({ length: 30 }, (_, i) => dailyFishId(`2026-11-${String(i + 1).padStart(2, '0')}`, pool));
    expect(new Set(days).size).toBeGreaterThan(2);
  });

  it('only offers fish of the allowed tiers that do not depend on weather', () => {
    const { ctx } = boot();
    const r = ctx.registries;
    const pool = candidates(
      r.fish.list().map((f) => ({ ...f, rarityTier: r.rarities.get(f.rarity).tier })),
      'pond',
      DAILY_CATCH.tiers,
    );
    expect(pool.length).toBeGreaterThanOrEqual(3);
    for (const f of pool) {
      expect(f.waters).toContain('pond');
      expect(f.weather).toEqual([]);
      expect(DAILY_CATCH.tiers as readonly number[]).toContain(f.rarityTier);
    }
  });

  it('draws a spoiler-free grid, the daily fish last', () => {
    expect(shareGrid([0, -1, 1, 2], true, DAILY_CATCH)).toBe('⬜⬛🟩🎣');
    expect(shareGrid([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], false, DAILY_CATCH)).toBe('⬜⬜⬜⬜⬜⬜⬜⬜⬜⬜\n⬜');
  });
});

describe('daily catch service', () => {
  it('records casts at the pond only, pays the bonus once, and stops counting', () => {
    const { ctx, svc } = boot();
    const fish = svc.fish()!;
    svc.onCatch(catchOf('pebble_minnow', 'common'));
    svc.onMiss('pond');
    svc.onCatch(catchOf('copper_trout', 'uncommon', 'river'));
    expect(svc.tries).toEqual([0, -1]);
    const before = ctx.wallet.get('coins');
    svc.onCatch(catchOf(fish.id, fish.rarity));
    expect(svc.caught?.casts).toBe(3);
    expect(ctx.wallet.get('coins') - before).toBe(25 * (DAILY_CATCH.valueMult - 1));
    svc.onCatch(catchOf(fish.id, fish.rarity));
    expect(svc.tries).toHaveLength(3);
    expect(svc.slice.daysCaught).toBe(1);
    const text = svc.shareText('https://example.com/');
    expect(text).toContain('in 3 casts');
    expect(text).toContain('⬜⬛🎣');
    expect(text).not.toContain(fish.name);
  });

  it('starts fresh the next day and never takes anything away', () => {
    const { ctx, svc } = boot();
    const fish = svc.fish()!;
    svc.onCatch(catchOf(fish.id, fish.rarity));
    expect(svc.caught).not.toBeNull();
    ctx.clock.shift(24 * 3600 * 1000);
    expect(svc.caught).toBeNull();
    expect(svc.tries).toEqual([]);
    expect(svc.slice.daysCaught).toBe(1);
  });
});
