// The moment a fish is on the line, through the real controller: rarer fish
// can slip away (much more often without tackle), nothing is lost when they
// do, and a quick reel pays bonus coins.
import { afterEach, describe, expect, it } from 'vitest';
import { bootstrap } from '../src/core/bootstrap';
import { parseContent } from '../src/core/content/parseContent';
import { debugOverrides } from '../src/core/debugOverrides';
import { FishingController } from '../src/features/fishing/controller';
import { fishingSlice } from '../src/features/fishing/state';
import { MemoryStorage } from '../src/systems/saveManager';
import { readContentFiles } from './helpers/content';

function boot() {
  const ctx = bootstrap({ features: [], loadContent: () => parseContent(readContentFiles()), storage: new MemoryStorage(), debug: false }).ctx!;
  const ctl = new FishingController(ctx, fishingSlice.defaults());
  return { ctx, ctl };
}

/** Cast, wait for the bite, and tap right away. */
function hookOne(ctl: FishingController): void {
  ctl.tap();
  ctl.update(1000);
  ctl.update(60000);
  expect(ctl.session.phase).toBe('bite');
  ctl.tap();
  ctl.update(2000);
}

afterEach(() => {
  debugOverrides.forceRarity = null;
});

describe('landing a fish', () => {
  it('a legendary fish almost always slips away without tackle, rarely with plenty', () => {
    const { ctx, ctl } = boot();
    const need = { rarityId: 'legendary', waterId: 'pond' };
    expect(ctl.escapeChance(need)).toBeGreaterThan(0.8);
    ctx.stats.setSource('test', [{ stat: 'tackle', op: 'add', value: 60 }]);
    expect(ctl.escapeChance(need)).toBeLessThan(0.1);
    expect(ctl.escapeChance({ rarityId: 'common', waterId: 'pond' })).toBe(0);
  });

  it('tougher waters need more tackle for rare fish', () => {
    const { ctl } = boot();
    expect(ctl.escapeChance({ rarityId: 'rare', waterId: 'sky_lake' })).toBeGreaterThan(ctl.escapeChance({ rarityId: 'rare', waterId: 'pond' }));
  });

  it('a fish that slips away costs nothing and keeps the pity count going', () => {
    const { ctx, ctl } = boot();
    debugOverrides.forceRarity = 'legendary';
    const escaped: string[] = [];
    ctx.bus.on('fishEscaped', (e) => escaped.push(e.rarityId));
    const coins = ctx.wallet.get('coins');
    ctl.state.pity = 10;
    ctx.rng = () => 0; // Every roll that can fail does.
    hookOne(ctl);
    expect(escaped).toEqual(['legendary']);
    expect(ctl.pending).toBeNull();
    expect(ctl.state.pity).toBe(11);
    expect(ctx.wallet.get('coins')).toBe(coins);
    expect(ctl.session.phase).toBe('idle');
  });

  it('a quick reel pays bonus coins on landing', () => {
    const { ctx, ctl } = boot();
    const quick: number[] = [];
    ctx.bus.on('quickCatch', (q) => quick.push(q.coins));
    ctx.rng = () => 0.999; // Nothing slips away.
    hookOne(ctl);
    expect(ctl.pending).not.toBeNull();
    expect(quick).toHaveLength(1);
    expect(ctx.wallet.get('coins')).toBe(quick[0]);
  });
});
