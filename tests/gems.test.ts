// Gems: the find chance by rarity, the coin exchange, and keeping gems (and
// what they bought) when the club moves.
import { describe, expect, it } from 'vitest';
import { GEMS } from '../src/config/tuning';
import { bootstrap } from '../src/core/bootstrap';
import { moveClub } from '../src/core/club';
import { parseContent } from '../src/core/content/parseContent';
import type { GameFeature } from '../src/core/feature';
import { GemService } from '../src/features/gems/service';
import { UpgradeService } from '../src/features/upgrades/service';
import { MemoryStorage } from '../src/systems/saveManager';
import { readContentFiles } from './helpers/content';

function boot() {
  let upgrades!: UpgradeService;
  const features: GameFeature[] = [
    {
      id: 'upgrades',
      saveSlice: { key: 'upgrades', version: 1, defaults: () => ({ levels: {} }) },
      init(ctx) {
        upgrades = new UpgradeService(ctx, ctx.save.slice('upgrades'));
        upgrades.applyAll();
        ctx.bus.on('clubMoved', () => upgrades.resetForMove());
      },
    },
  ];
  const res = bootstrap({ features, loadContent: () => parseContent(readContentFiles()), storage: new MemoryStorage(), debug: false });
  expect(res.errors).toEqual([]);
  return { ctx: res.ctx!, upgrades, gems: new GemService(res.ctx!) };
}

describe('gems', () => {
  it('a common catch finds one 1% of the time, a legendary 3%', () => {
    const { gems } = boot();
    expect(gems.chance(0)).toBeCloseTo(0.01);
    expect(gems.chance(4)).toBeCloseTo(0.03);
    expect(gems.chance(9)).toBeCloseTo(GEMS.max);
  });

  it('finds gems at about that rate over many catches', () => {
    const { ctx, gems } = boot();
    const legendary = ctx.registries.fish.list().find((f) => f.rarity === 'legendary')!;
    let found = 0;
    for (let i = 0; i < 20000; i++) found += gems.rollCatch(legendary.id);
    expect(found / 20000).toBeGreaterThan(0.022);
    expect(found / 20000).toBeLessThan(0.038);
    expect(ctx.wallet.get('gems')).toBe(found);
  });

  it('trades 1,000 coins for a gem at the pond, more after a move', () => {
    const { ctx, gems } = boot();
    expect(gems.rate).toBe(1000);
    ctx.wallet.add('coins', 2500);
    expect(gems.trade(1)).toBe(true);
    expect(gems.trade(5)).toBe(false);
    expect(ctx.wallet.get('coins')).toBe(1500);
    expect(ctx.wallet.get('gems')).toBe(1);
    moveClub(ctx, 'river', { force: true });
    expect(gems.rate).toBe(3000);
  });

  it('gems and gem looks stay when the club moves', () => {
    const { ctx, upgrades } = boot();
    ctx.wallet.add('gems', 30);
    expect(upgrades.buy('outfit_sunhat')).toBe(true);
    expect(upgrades.buy('club_bunting')).toBe(true);
    moveClub(ctx, 'river', { force: true });
    expect(ctx.wallet.get('gems')).toBe(30 - 4 - 6);
    expect(upgrades.level('outfit_sunhat')).toBe(1);
    expect(ctx.world.look('fisher')?.sprite).toBe('fisher_sunhat');
    expect(ctx.world.activeDecorations()).toContain('club_bunting');
  });
});
