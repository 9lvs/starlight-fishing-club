// Rested bonus: time away fills a bait tin, and the next hand catches pay
// double. It only adds coins and never stops play.
import { afterEach, describe, expect, it } from 'vitest';
import { RESTED } from '../src/config/tuning';
import { bootstrap } from '../src/core/bootstrap';
import { parseContent } from '../src/core/content/parseContent';
import { debugOverrides } from '../src/core/debugOverrides';
import { FishingController } from '../src/features/fishing/controller';
import { addRest, fishingSlice } from '../src/features/fishing/state';
import { MemoryStorage } from '../src/systems/saveManager';
import { readContentFiles } from './helpers/content';

describe('filling the bait tin', () => {
  it('adds a charge per stretch of time away, keeps the leftover, and stops at the max', () => {
    const s = { rested: 0, restedMs: 0 };
    expect(addRest(s, RESTED.perChargeMs * 2.5, RESTED)).toBe(2);
    expect(s.restedMs).toBe(RESTED.perChargeMs / 2);
    expect(addRest(s, RESTED.perChargeMs / 2, RESTED)).toBe(1);
    expect(s.rested).toBe(3);
    addRest(s, 24 * 3_600_000, RESTED);
    expect(s.rested).toBe(RESTED.max);
    expect(addRest(s, RESTED.perChargeMs * 3, RESTED)).toBe(0);
    expect(s.restedMs).toBe(0);
  });

  it('old saves start with an empty tin', () => {
    const migrated = fishingSlice.migrate!({ pity: 3, creel: [], totals: { casts: 1, catches: 1, misses: 0 } }, 2);
    expect(migrated).toMatchObject({ pity: 3, rested: 0, restedMs: 0 });
  });
});

function boot() {
  const ctx = bootstrap({ features: [], loadContent: () => parseContent(readContentFiles()), storage: new MemoryStorage(), debug: false }).ctx!;
  const ctl = new FishingController(ctx, fishingSlice.defaults());
  ctl.easyReel = true;
  return { ctx, ctl };
}

function catchOne(ctl: FishingController): void {
  ctl.update(500);
  ctl.tap();
  ctl.update(1000);
  ctl.update(60000);
  ctl.tap();
  ctl.update(2000);
}

afterEach(() => {
  debugOverrides.forceRarity = null;
});

describe('rested catches', () => {
  it('pay the fish value again as a bonus, one charge each', () => {
    const { ctx, ctl } = boot();
    debugOverrides.forceRarity = 'common';
    ctl.addRest(RESTED.perChargeMs * 2);
    const paid: number[] = [];
    ctx.bus.on('restedCatch', (e) => paid.push(e.coins));
    catchOne(ctl);
    expect(ctl.pending).not.toBeNull();
    expect(ctl.rested?.coins).toBe(Math.round(ctl.pending!.value * RESTED.bonus));
    expect(ctx.wallet.get('coins')).toBeGreaterThanOrEqual(ctl.rested!.coins);
    expect(ctl.state.rested).toBe(1);
    ctl.sellPending();
    catchOne(ctl);
    ctl.sellPending();
    catchOne(ctl);
    expect(paid).toHaveLength(2);
    expect(ctl.rested).toBeNull();
    expect(ctl.state.rested).toBe(0);
  });

  it('a fish that slips away does not use a charge', () => {
    const { ctx, ctl } = boot();
    debugOverrides.forceRarity = 'legendary';
    ctx.rng = () => 0;
    ctl.addRest(RESTED.perChargeMs);
    catchOne(ctl);
    expect(ctl.pending).toBeNull();
    expect(ctl.state.rested).toBe(1);
  });
});
