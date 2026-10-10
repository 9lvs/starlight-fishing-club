// Moving the club: rank gating for higher tiers, the reset on a move, what is
// kept, the coin bonus, and old saves keeping the waters they reached.
import { describe, expect, it } from 'vitest';
import { SAVE } from '../src/config/tuning';
import { bootstrap } from '../src/core/bootstrap';
import { clubBonus, moveClub } from '../src/core/club';
import { parseContent } from '../src/core/content/parseContent';
import type { GameFeature } from '../src/core/feature';
import { CrewService } from '../src/features/crew/service';
import { crewSlice, type CrewSlice } from '../src/features/crew/state';
import { UpgradeService } from '../src/features/upgrades/service';
import { MemoryStorage } from '../src/systems/saveManager';
import { readContentFiles } from './helpers/content';

/** Upgrades and crew without their Phaser scenes, wired the way their features wire them. */
function boot(storage = new MemoryStorage()) {
  let upgrades!: UpgradeService;
  let crew!: CrewService;
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
    {
      id: 'crew',
      saveSlice: crewSlice,
      init(ctx) {
        crew = new CrewService(ctx, ctx.save.slice<CrewSlice>('crew'));
        ctx.bus.on('clubMoved', () => crew.resetForMove());
      },
    },
  ];
  const res = bootstrap({ features, loadContent: () => parseContent(readContentFiles()), storage, debug: false });
  expect(res.errors).toEqual([]);
  return { ctx: res.ctx!, upgrades, crew };
}

/** Buy an upgrade with exactly enough coins. */
function buy(g: ReturnType<typeof boot>, id: string): boolean {
  const u = g.ctx.registries.upgrades.get(id);
  g.ctx.wallet.add('coins', g.upgrades.cost(u));
  return g.upgrades.buy(id);
}

describe('rod and boat tiers', () => {
  it('higher tiers stay locked until the club reaches a bigger water', () => {
    const g = boot();
    for (const id of ['rod_1', 'rod_2', 'rod_3']) expect(buy(g, id)).toBe(true);
    expect(g.upgrades.state(g.ctx.registries.upgrades.get('rod_4'))).toBe('locked');
    expect(g.upgrades.rankNeeded(g.ctx.registries.upgrades.get('rod_4'))).toBe('Whisper River');
    expect(buy(g, 'rod_4')).toBe(false);
  });

  it('better rods raise luck and change the rod look', () => {
    const g = boot();
    buy(g, 'rod_1');
    buy(g, 'rod_2');
    expect(g.ctx.stats.get('luck')).toBe(2);
    expect(g.ctx.world.look('rod')?.color).toBe('sand');
  });
});

describe('moving the club', () => {
  it('needs the boat that reaches the next water', () => {
    const g = boot();
    expect(g.ctx.world.nextWater()).toBe('river');
    expect(g.ctx.world.canMoveTo('river')).toBe(false);
    expect(moveClub(g.ctx, 'river')).toBe(false);
    for (const id of ['boat_1', 'boat_2', 'boat_3']) expect(buy(g, id)).toBe(true);
    expect(g.ctx.world.canMoveTo('river')).toBe(true);
    expect(g.ctx.world.canMoveTo('cove')).toBe(false);
  });

  it('starts coins, gear, and crew over, keeps the journal side of things, and pays the bonus', () => {
    const g = boot();
    for (const id of ['boat_1', 'boat_2', 'boat_3', 'rod_1', 'hire_help', 'paper_lanterns']) expect(buy(g, id)).toBe(true);
    g.ctx.wallet.add('coins', 100);
    expect(g.crew.hire('deckhand')).toBe(true);
    g.ctx.wallet.add('coins', 5000);
    const sellBefore = g.ctx.stats.get('sellValueMult');

    expect(moveClub(g.ctx, 'river')).toBe(true);
    expect(g.ctx.world.clubRank).toBe(1);
    expect(g.ctx.world.waterId).toBe('river');
    expect(g.ctx.wallet.get('coins')).toBe(0);
    expect(g.upgrades.level('rod_1')).toBe(0);
    expect(g.upgrades.level('boat_3')).toBe(0);
    expect(g.ctx.stats.get('boatRange')).toBe(0);
    expect(g.ctx.stats.get('luck')).toBe(0);
    expect(g.crew.slice.members).toEqual([]);
    // Club cosmetics are kept.
    expect(g.upgrades.level('paper_lanterns')).toBe(1);
    expect(g.ctx.world.activeDecorations()).toContain('lanterns');
    // +100% coins at Whisper River.
    expect(clubBonus(g.ctx)).toBe(1);
    expect(g.ctx.stats.get('sellValueMult')).toBeCloseTo(sellBefore * 2);
    // The pond can still be visited, and river tiers are now for sale.
    expect(g.ctx.world.isUnlocked('pond')).toBe(true);
    expect(g.ctx.world.setWater('pond')).toBe(true);
    for (const id of ['rod_1', 'rod_2', 'rod_3']) buy(g, id);
    expect(buy(g, 'rod_4')).toBe(true);
  });

  it('remembers the club home and bonus across a reload', () => {
    const storage = new MemoryStorage();
    const g = boot(storage);
    for (const id of ['boat_1', 'boat_2', 'boat_3']) buy(g, id);
    moveClub(g.ctx, 'river');
    g.ctx.save.save();
    const again = boot(storage);
    expect(again.ctx.world.clubRank).toBe(1);
    expect(clubBonus(again.ctx)).toBe(1);
    expect(again.upgrades.level('boat_3')).toBe(0);
  });

  it('old saves keep every water they had reached', () => {
    const storage = new MemoryStorage();
    const g = boot(storage);
    g.ctx.save.save();
    // Rewrite the world slice as v1 would have stored it: river and cove unlocked by boat range.
    const raw = JSON.parse(storage.getItem(SAVE.storageKey)!);
    raw.slices.world = { v: 1, data: { waterId: 'cove', knownUnlocked: ['pond', 'river', 'cove'] } };
    storage.setItem(SAVE.storageKey, JSON.stringify(raw));
    const old = boot(storage);
    expect(old.ctx.world.clubRank).toBe(2);
    expect(old.ctx.world.waterId).toBe('cove');
    expect(clubBonus(old.ctx)).toBe(4);
  });
});
